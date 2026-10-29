import mongoose, { type Types } from "mongoose";
import { Audit, type AuditDocument } from "../../models/Audit";
import { AuditItem, type AuditItemDocument } from "../../models/AuditItem";
import { Report } from "../../models/Report";
import { GitHubClient, GitHubApiError } from "../../integrations/github/client";
import { runTask, untrustedDataBlock } from "../../integrations/ai/gateway";
import { logger } from "../../config/logger";
import { AppError } from "../../middleware/errorHandler";
import { assertOwnership } from "../../middleware/ownership";

const SOURCE_EXTENSIONS = [".js", ".ts", ".tsx", ".jsx", ".py", ".java", ".go", ".rb", ".php", ".cs", ".rs", ".cpp", ".c"];
const CONFIG_FILES = ["package.json", "tsconfig.json", "README.md", "requirements.txt", "Gemfile", "go.mod", "composer.json", "docker-compose.yml", "Dockerfile"];
const AUDIT_FILE_LIMIT = 8;
const FILE_CHAR_LIMIT = 3000;

// --- CRUD (thin wrappers; ownership filtering is enforced by callers) ---

export async function createAudit(data: Partial<AuditDocument>) {
  const newAudit = new Audit(data);
  return newAudit.save();
}

export async function getAuditWithItems(id: string) {
  const audit = await Audit.findById(id).lean();
  if (!audit) return undefined;
  const items = await AuditItem.find({ auditId: id }).lean();
  return { ...audit, items };
}

/**
 * Ownership-enforced audit fetch: a foreign OR untagged (legacy, unbackfilled)
 * audit is indistinguishable from a missing one (404 upstream).
 */
export async function findOwnAuditWithItems(id: string, userId: string) {
  const audit = await Audit.findOne({ _id: id, userId }).lean();
  if (!audit) return undefined;
  const items = await AuditItem.find({ auditId: audit._id }).lean();
  return { ...audit, items };
}

/**
 * Ownership gate for directly-addressed audit items.
 * New items carry their own `userId`; legacy items fall back to the ownership
 * of the parent audit. Any mismatch → 404 (existence not disclosed).
 */
export async function assertItemAccess(itemId: string, userId: string): Promise<AuditItemDocument> {
  const item = await AuditItem.findById(itemId).lean();
  if (!item) {
    throw AppError.notFound("Audit item not found");
  }
  const itemOwner = item.userId != null ? String(item.userId) : null;
  if (itemOwner === userId) {
    return item as AuditItemDocument;
  }
  if (itemOwner !== null) {
    throw AppError.notFound("Audit item not found");
  }
  const parent = await Audit.findById(item.auditId).lean();
  const parentOwner = parent?.userId != null ? String(parent.userId) : null;
  if (parentOwner !== userId) {
    throw AppError.notFound("Audit item not found");
  }
  return item as AuditItemDocument;
}

export async function listAudits(filter: Record<string, unknown> = {}) {
  return Audit.find(filter).sort({ createdAt: -1 }).lean();
}

export async function updateAudit(id: string, patch: Partial<AuditDocument>) {
  return Audit.findByIdAndUpdate(id, { ...patch, updatedAt: new Date() }, { new: true }).lean();
}

export async function deleteAudit(id: string) {
  await AuditItem.deleteMany({ auditId: id });
  await Report.deleteMany({ auditId: id });
  await Audit.findByIdAndDelete(id);
}

export async function createAuditItem(item: Partial<AuditItemDocument>) {
  const newItem = new AuditItem(item);
  return newItem.save();
}

export async function updateAuditItem(id: string, patch: Partial<AuditItemDocument>) {
  return AuditItem.findByIdAndUpdate(id, patch, { new: true }).lean();
}

export async function deleteAuditItem(id: string) {
  return AuditItem.findByIdAndDelete(id);
}

export async function findAuditItem(id: string) {
  return AuditItem.findById(id).lean();
}

// --- Repository deep audit --------------------------------------------------

interface RepoAuditInput {
  owner: string;
  repo: string;
  requestedBranch?: string;
  gh: GitHubClient;
  /** Owning user — stamped onto the audit and every item it produces. */
  userId: string;
  /**
   * Progress hook — the job worker passes one that funnels into the queue;
   * HTTP callers may omit it (migrated 1:1 from the legacy synchronous flow).
   */
  onProgress?: (snapshot: { stage: "fetching" | "analyzing" | "verifying"; percent: number; message?: string }) => void | Promise<void>;
}

interface AuditIssue {
  type?: string;
  severity?: string;
  description?: string;
  file?: string;
  fix?: { old_code?: string; new_code?: string };
  [k: string]: unknown;
}

async function resolveDefaultBranch(owner: string, repo: string, gh: GitHubClient): Promise<string> {
  const repoInfo = await gh.get<{ default_branch?: string }>(`/repos/${owner}/${repo}`);
  return repoInfo.default_branch || "main";
}

function selectAuditableFiles(paths: string[]): string[] {
  const isConfig = (p: string) => CONFIG_FILES.some(cfg => p.toLowerCase().endsWith(cfg));
  const isBadPath = (p: string) =>
    p.toLowerCase().includes("node_modules") ||
    p.toLowerCase().includes("dist") ||
    p.toLowerCase().includes("build") ||
    p.toLowerCase().includes(".git");
  const isSource = (p: string) =>
    SOURCE_EXTENSIONS.some(ext => p.toLowerCase().endsWith(ext)) && !isBadPath(p);
  const notBinary = (p: string) =>
    !/\.(png|jpg|jpeg|gif|pdf|zip|mp4|mp3|woff2?)$/i.test(p);

  const prioritized = paths.filter(p => (isConfig(p) || isSource(p)) && notBinary(p));
  const finalFiles = prioritized.length > 0 ? prioritized : paths.filter(notBinary);
  return finalFiles.slice(0, prioritized.length > 0 ? AUDIT_FILE_LIMIT : 5);
}

function normalizeIssues(rawIssues: unknown): AuditIssue[] {
  if (!Array.isArray(rawIssues)) return [];
  return rawIssues.map((issue: Record<string, unknown>) => {
    const oldCode = issue.old_code || issue.oldCode || ((issue.fix as Record<string, unknown>)?.old_code) || ((issue.fix as Record<string, unknown>)?.oldCode);
    const newCode = issue.new_code || issue.newCode || ((issue.fix as Record<string, unknown>)?.new_code) || ((issue.fix as Record<string, unknown>)?.newCode);
    const filePath = issue.file_path || issue.file || issue.path;
    const normalized: AuditIssue = {
      ...issue,
      file: filePath != null ? String(filePath) : undefined,
    };
    if (oldCode && newCode) {
      normalized.fix = { old_code: String(oldCode), new_code: String(newCode) };
    }
    return normalized;
  });
}

interface RepoAuditResult {
  audit: { _id: unknown; title: string; status: string; priority: string };
  issues: AuditIssue[];
  auditId: string;
  itemIds: string[];
  branch: string;
}

/** Runs the full repo audit synchronously (protected by user's plan check in the route). */
export async function runRepoAudit(input: RepoAuditInput): Promise<RepoAuditResult> {
  const { owner, repo, requestedBranch, gh, onProgress } = input;
  const ownerObjectId = new mongoose.Types.ObjectId(input.userId);

  // 1. Resolve target branch
  const targetBranch = requestedBranch || (await resolveDefaultBranch(owner, repo, gh));

  // 2. Fetch the full tree for that branch
  await onProgress?.({ stage: "fetching", percent: 15, message: `Fetching file tree (${targetBranch})…` });
  const treeData = await gh.get<{ tree: { type: string; path: string }[] }>(
    `/repos/${owner}/${repo}/git/trees/${targetBranch}?recursive=1`,
  );
  const allPaths = (treeData.tree || []).filter(f => f.type === "blob").map(f => f.path);
  const finalFiles = selectAuditableFiles(allPaths);

  if (finalFiles.length === 0) {
    throw AppError.badRequest("No suitable files found for analysis in this repository.");
  }

  logger.info(
    { owner, repo, branch: targetBranch, files: finalFiles.length },
    "selecting files for audit",
  );

  // 3. Fetch contents (truncated per file)
  const chunks: string[] = [];
  for (let i = 0; i < finalFiles.length; i++) {
    const path = finalFiles[i];
    try {
      const content = await gh.raw(`/repos/${owner}/${repo}/contents/${path}`);
      const truncated =
        content.length > FILE_CHAR_LIMIT
          ? `${content.substring(0, FILE_CHAR_LIMIT)}\n... [truncated]`
          : content;
      chunks.push(`\n--- File: ${path} ---\n${truncated}`);
    } catch (err) {
      logger.warn({ path, err: (err as Error).message }, "skipped unreadable file during audit");
    }
    await onProgress?.({
      stage: "fetching",
      percent: 15 + Math.round(((i + 1) / finalFiles.length) * 30),
      message: `Reading repository files… (${i + 1}/${finalFiles.length})`,
    });
  }
  const repoContent = chunks.join("\n");
  if (repoContent.length === 0) {
    throw AppError.badRequest("No readable file content available for analysis in this repository.");
  }

  // 4. AI analysis — rereouted through the AI gateway (retries + zod gate +
  // cost tracking). Repository content is untrusted: wrapped in data markers.
  await onProgress?.({ stage: "analyzing", percent: 55, message: "Running AI analysis…" });
  const { data: parsed } = await runTask<{ issues?: unknown }>(
    "repo-audit",
    {
      system:
        "You are an expert security and performance auditor. Analyze the provided repository files and identify real issues. For each issue, provide: type (security, performance, accessibility), severity (critical, medium, low), file path, description, and if a fix is available, provide the old code and the new fixed code. Output valid JSON ONLY with an 'issues' array.",
      user: `REPOSITORY: ${owner}/${repo}\n\n${untrustedDataBlock(`FILES of ${owner}/${repo} @ ${targetBranch}`, repoContent)}\n\nAnalyze the file data above and provide the audit issues in the requested JSON format.`,
    },
    { userId: input.userId },
  );
  await onProgress?.({ stage: "verifying", percent: 80, message: "Verifying and persisting results…" });

  const issues = normalizeIssues(parsed?.issues ?? []);

  // 5. Persist audit + items (owned by the requesting user)
  await onProgress?.({ stage: "verifying", percent: 90, message: "Saving audit results…" });
  const audit = await createAudit({
    userId: ownerObjectId,
    title: `Audit: ${repo}`,
    description: `Deep AI audit for ${owner}/${repo} using dynamic file discovery.`,
    status: "completed",
    priority: issues.some(i => i.severity === "critical") ? "critical" : "medium",
    scope: "Global Repository Scan",
    branch: targetBranch,
  });

  const itemIds: string[] = [];
  for (const issue of issues) {
    const item = await createAuditItem({
      auditId: audit._id,
      userId: ownerObjectId,
      label: String(issue.description || "Point of interest detected"),
      type: String(issue.type || "security"),
      value: issue.file ? String(issue.file) : "Root",
      severity: (issue.severity as never) || "medium",
      old_code: issue.fix?.old_code || (issue.old_code as string),
      new_code: issue.fix?.new_code || (issue.new_code as string),
      complianceStatus: "non_compliant",
      auditorNotes: `Rank: ${issue.severity}. Recommendation: ${issue.new_code ? "Apply suggested fix" : "Manual review required"}`,
    });
    itemIds.push(String(item._id));
  }

  return {
    audit: audit as unknown as { _id: unknown; title: string; status: string; priority: string },
    issues,
    auditId: String(audit._id),
    itemIds,
    branch: targetBranch,
  };
}

// --- Fix application ------------------------------------------------------

export interface CodeLocation {
  /** Line number (1-based) of the first line of the matched snippet. */
  line: number;
  /** true when the file contains the snippet verbatim; false = whitespace-normalized match. */
  exact: boolean;
}

/**
 * Locates `oldCode` inside current file content: exact substring first, then
 * the same whitespace-flexible pattern applyReplacement uses. Returns null
 * when neither matches (the fix cannot be anchored to the live file).
 */
export function locateCode(content: string, oldCode: string): CodeLocation | null {
  if (!oldCode || !oldCode.trim()) return null;
  const exactIdx = content.indexOf(oldCode);
  if (exactIdx >= 0) {
    return { line: content.slice(0, exactIdx).split("\n").length, exact: true };
  }
  const escaped = oldCode.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
  try {
    const regex = new RegExp(escaped);
    const match = regex.exec(content);
    if (match) {
      return { line: content.slice(0, match.index).split("\n").length, exact: false };
    }
  } catch {
    // malformed pattern — treat as not found
  }
  return null;
}

/** Whitespace-flexible single-replacing of old→new; returns null if no match. */
export function applyReplacement(currentContent: string, oldCode: string, newCode: string): string | null {
  if (currentContent.includes(oldCode)) {
    const next = currentContent.replace(oldCode, newCode);
    if (next !== currentContent) return next;
  }
  // normalized match
  const normalize = (s: string) => s.replace(/\r\n/g, "\n").trim();
  if (!normalize(currentContent).includes(normalize(oldCode))) return null;
  const escaped = oldCode.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
  try {
    const regex = new RegExp(escaped, "g");
    const next = currentContent.replace(regex, newCode);
    return next !== currentContent ? next : null;
  } catch {
    return null;
  }
}

export async function checkBranchExists(owner: string, repo: string, ref: string, gh: GitHubClient): Promise<string> {
  const refData = await gh.get<{ object: { sha: string } }>(`/repos/${owner}/${repo}/git/ref/heads/${ref}`);
  return refData.object.sha;
}

export interface ApplyFixInput {
  owner: string;
  repo: string;
  targetBranch: string;
  issues: AuditIssue[];
  gh: GitHubClient;
}

export interface ApplyFixResult {
  prUrl: string;
  prNumber: number;
  branch: string;
  modifiedFiles: number;
}

export interface ApplyFixResult {
  prUrl: string;
  prNumber: number;
  branch: string;
  modifiedFiles: number;
  appliedIssues: number;
  /** Issues that could not be anchored to a file, with reasons. */
  skipped: Array<{ file: string; reason: string }>;
}

/** Bounded snapshot of current file content for the review UI. */
const MAX_PREVIEW_LINES = 1500;

export interface FixPreviewResult {
  auditId: string;
  /** Branch the preview (and the PR) is based on. */
  branch: string;
  /** path → bounded current content. */
  files: Record<string, { content: string; truncated: boolean; totalLines: number }>;
  items: Array<{
    itemId: string;
    label: string;
    type: string;
    severity: string;
    file: string | null;
    oldCode: string | null;
    newCode: string | null;
    /** null = snippet not found in the current file / file unreadable. */
    match: { line: number; exact: boolean } | null;
  }>;
}

/**
 * Builds per-item REAL current-code context for the fix-review UI — the UI
 * always shows the live file content, never the AI's stale quote. Each
 * unique file is fetched once; content is capped so big repositories don't
 * blow up the payload.
 */
export async function buildFixPreview(input: {
  owner: string;
  repo: string;
  auditId: string;
  targetBranch: string;
  items: Array<Record<string, unknown>>;
  gh: GitHubClient;
}): Promise<FixPreviewResult> {
  const { owner, repo, auditId, targetBranch, items, gh } = input;

  const fileToPath = (item: Record<string, unknown>): string | null => {
    const value = typeof item.value === "string" ? item.value.trim() : "";
    const file = typeof item.file === "string" ? item.file.trim() : "";
    return (value && value) || (file && file) || null;
  };

  // Unique file paths across all items
  const paths = Array.from(new Set(items.map(fileToPath).filter((p): p is string => !!p)));

  // Fetch each referenced file once
  const contents = new Map<string, string>();
  for (const p of paths) {
    try {
      const fileData = await gh.get<{ content: string }>(
        `/repos/${owner}/${repo}/contents/${p}?ref=${encodeURIComponent(targetBranch)}`,
      );
      contents.set(p, Buffer.from(fileData.content, "base64").toString("utf-8"));
    } catch {
      // unreadable file — item renders with match: null (no usable anchor)
      contents.set(p, "");
    }
  }

  const files: FixPreviewResult["files"] = {};
  for (const [p, content] of Array.from(contents.entries())) {
    const totalLines = content ? content.split("\n").length : 0;
    const lines = content.split("\n");
    files[p] = {
      content: lines.slice(0, MAX_PREVIEW_LINES).join("\n"),
      truncated: totalLines > MAX_PREVIEW_LINES,
      totalLines,
    };
  }

  return {
    auditId,
    branch: targetBranch,
    files,
    items: items.map(item => {
      const filePath = fileToPath(item);
      const oldCode = typeof item.old_code === "string" ? item.old_code : null;
      const newCode = typeof item.new_code === "string" ? item.new_code : null;
      const content = filePath ? contents.get(filePath) ?? "" : "";
      return {
        itemId: String(item._id),
        label: typeof item.label === "string" ? item.label : "Issue",
        type: typeof item.type === "string" ? item.type : "issue",
        severity: typeof item.severity === "string" ? item.severity : "medium",
        file: filePath,
        oldCode,
        newCode,
        match: oldCode ? locateCode(content, oldCode) : null,
      };
    }),
  };
}

export async function applyFixesAndCreatePR(input: ApplyFixInput): Promise<ApplyFixResult> {
  const { owner, repo, targetBranch, issues, gh } = input;

  const baseSha = await checkBranchExists(owner, repo, targetBranch, gh);

  const newBranchName = `auditpilot-fix-${Date.now()}`;
  await gh.post(`/repos/${owner}/${repo}/git/refs`, {
    ref: `refs/heads/${newBranchName}`,
    sha: baseSha,
  });

  // Group issues by file: read each file ONCE, apply all its substitutions
  // cumulatively, then make a SINGLE commit per changed file (instead of one
  // commit per issue).
  const perFile = new Map<string, { content: string; sha: string }>();
  const changed = new Set<string>();
  const skipped: Array<{ file: string; reason: string }> = [];

  for (const issue of issues) {
    const oldCode = issue.fix?.old_code || (issue.old_code as string);
    const newCode = issue.fix?.new_code || (issue.new_code as string);
    const filePath =
      (issue.file as string) || (issue.file_path as string) || (issue.path as string) || (issue.value as string);
    if (!oldCode || !newCode || !filePath) {
      skipped.push({ file: filePath || "?", reason: "incomplete fix data — missing old/new code or file path" });
      continue;
    }

    let ctx = perFile.get(filePath);
    if (!ctx) {
      try {
        const fileData = await gh.get<{ content: string; sha: string }>(
          `/repos/${owner}/${repo}/contents/${filePath}?ref=${newBranchName}`,
        );
        ctx = {
          content: Buffer.from(fileData.content, "base64").toString("utf-8"),
          sha: fileData.sha,
        };
        perFile.set(filePath, ctx);
      } catch {
        skipped.push({ file: filePath, reason: "file not found on the target branch" });
        continue;
      }
    }

    const next = applyReplacement(ctx.content, oldCode, newCode);
    if (!next) {
      skipped.push({
        file: filePath,
        reason: "the issue's quoted code no longer matches the current file (version or whitespace drift)",
      });
      continue;
    }
    ctx.content = next;
    changed.add(filePath);
  }

  let modifiedFilesCount = 0;
  for (const filePath of Array.from(changed)) {
    const ctx = perFile.get(filePath)!;
    try {
      await gh.put(`/repos/${owner}/${repo}/contents/${filePath}`, {
        message: `AuditPilot: apply fixes in ${filePath}`,
        content: Buffer.from(ctx.content).toString("base64"),
        sha: ctx.sha,
        branch: newBranchName,
      });
      modifiedFilesCount++;
    } catch (err) {
      skipped.push({ file: filePath, reason: `commit failed: ${(err as Error).message}` });
    }
  }

  const appliedIssues = issues.length - skipped.length;
  if (modifiedFilesCount === 0) {
    throw AppError.badRequest(
      "No changes could be applied — none of the issue snippets matched the current files. Review and edit the fixes, or refresh the preview (the repository may have moved on).",
      skipped,
    );
  }

  const createdPR = await gh.post<{ html_url: string; number: number }>(`/repos/${owner}/${repo}/pulls`, {
    title: "AuditPilot: Fix security and performance issues",
    body: [
      "This PR applies automated fixes for issues identified during the AI audit.",
      "",
      `**Applied:** ${appliedIssues} issue(s) across ${modifiedFilesCount} file(s)`,
      ...(skipped.length
        ? ["", `**Skipped (${skipped.length}):**`, ...skipped.slice(0, 15).map(s => `- \`${s.file}\` — ${s.reason}`)]
        : []),
    ].join("\n"),
    head: newBranchName,
    base: targetBranch,
  });

  return {
    prUrl: createdPR.html_url,
    prNumber: createdPR.number,
    branch: newBranchName,
    modifiedFiles: modifiedFilesCount,
    appliedIssues,
    skipped,
  };
}
