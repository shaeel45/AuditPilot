import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import OpenAI from "openai";
import { User } from "./models/User";
import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { randomBytes } from "node:crypto";
import { stripe, STRIPE_PRICE_IDS, LIMITS, PLANS } from "./lib/stripe";
import { requireAuth, setAuthCookie, clearAuthCookie } from "./middleware/auth";
import { safeEqual } from "./lib/crypto";
import { encryptSecret } from "./lib/crypto";
import { ENV, isProd } from "./config/env";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: (process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || "https://openrouter.ai/api/v1").replace(/\/$/, ""),
  defaultHeaders: {
    "HTTP-Referer": "https://auditpilots.netlify.app",
    "X-Title": "AuditsPilot"
  }
});

console.log(`[AI Config] Model: Gemini 2.0 Flash`);
console.log(`[AI Config] API Key present: ${!!process.env.AI_INTEGRATIONS_OPENAI_API_KEY}`);
console.log(`[AI Config] Base URL: ${process.env.AI_INTEGRATIONS_OPENAI_BASE_URL}`);

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Helper to parse JSON from AI response which might include markdown code blocks
  function safeJsonParse(content: string) {
    try {
      // Find the first '{' and last '}' to extract the JSON object
      const start = content.indexOf('{');
      const end = content.lastIndexOf('}');
      if (start === -1 || end === -1) {
        // Fallback to previous logic if no curlies found
        const cleanContent = content.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim();
        return JSON.parse(cleanContent);
      }
      const jsonStr = content.substring(start, end + 1);
      return JSON.parse(jsonStr);
    } catch (e) {
      console.error("Failed to parse AI response as JSON. Content:", content);
      return null;
    }
  }

  // Middleware to protect routes (now lives in server/middleware/auth.ts)
  void requireAuth;

  // === Auth Routes ===

  app.get("/api/auth/github", (req, res) => {
    const clientId = process.env.GITHUB_CLIENT_ID;
    if (!clientId) {
      return res.status(500).json({ message: "GITHUB_CLIENT_ID is not configured" });
    }
    const redirectUri = process.env.GITHUB_REDIRECT_URI || `${req.protocol}://${req.get("host")}/api/auth/github/callback`;

    // OAuth state: CSRF protection for the redirect dance
    const state = randomBytes(16).toString("hex");
    res.cookie("gh_oauth_state", state, {
      httpOnly: true,
      secure: isProd,
      sameSite: "lax",
      path: "/",
      maxAge: 10 * 60 * 1000,
    });

    const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=repo%20read:user&state=${state}`;
    res.redirect(githubAuthUrl);
  });

  app.get("/api/auth/github/callback", async (req, res) => {
    const { code, state } = req.query;
    const clientId = process.env.GITHUB_CLIENT_ID;
    const clientSecret = process.env.GITHUB_CLIENT_SECRET;

    // 1. Verify the state cookie against the state param (CSRF)
    const cookieState = (req.cookies?.gh_oauth_state as string) || "";
    if (
      !state ||
      typeof state !== "string" ||
      !cookieState ||
      !safeEqual(state, cookieState)
    ) {
      return res.status(403).send("OAuth state validation failed. Please restart sign-in.");
    }
    res.clearCookie("gh_oauth_state", { path: "/" });

    try {
      const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "User-Agent": "Audit-Pilot-App"
        },
        body: JSON.stringify({
          client_id: clientId,
          client_secret: clientSecret,
          code,
        }),
      });

      const tokenData: any = await tokenResponse.json();
      if (tokenData.access_token) {
        const rawToken: string = tokenData.access_token;
        const encryptedToken = encryptSecret(rawToken);

        // Fetch user profile from GitHub to store in MongoDB
        const userProfileResponse = await fetch("https://api.github.com/user", {
          headers: {
            Authorization: `token ${rawToken}`,
            Accept: "application/vnd.github.v3+json",
            "User-Agent": "Audit-Pilot-App"
          },
        });
        const profile = await userProfileResponse.json();
        if (!profile?.id) {
          return res.status(401).send("Failed to verify GitHub profile");
        }

        // Sync with MongoDB — token stored ENCRYPTED, never plaintext
        const user = await User.findOneAndUpdate(
          { githubId: profile.id.toString() },
          {
            username: profile.login,
            displayName: profile.name || profile.login,
            avatarUrl: profile.avatar_url,
            email: profile.email,
            accessTokenEncrypted: encryptedToken,
            $unset: { accessToken: 1 },
            lastLogin: new Date(),
          },
          { upsert: true, new: true }
        );

        // Sign JWT — delivered ONLY via httpOnly cookie, never in a URL
        const jwtToken = jwt.sign(
          { userId: user._id },
          ENV.JWT_SECRET as string,
          { expiresIn: "7d" }
        );
        setAuthCookie(res, jwtToken);

        res.redirect(`/app`);
      } else {
        res.status(401).json({ message: "Failed to obtain access token" });
      }
    } catch (error) {
      console.error("GitHub Auth Error:", error);
      res.status(500).json({ message: "Internal server error during auth" });
    }
  });

  app.get("/api/auth/logout", (req, res) => {
    clearAuthCookie(res);
    res.json({ message: "Logged out successfully" });
  });

  app.get("/api/auth/user", async (req, res) => {
    // Silent auth check: cookie first, Bearer fallback — never 401s (returns JSON flag)
    const bearer = req.headers.authorization?.startsWith("Bearer ")
      ? (req.headers.authorization as string).split(" ")[1]
      : undefined;
    const tokenCandidate =
      bearer ||
      ((req as unknown as { cookies?: Record<string, string> }).cookies?.["audit_token"] as
        | string
        | undefined);
    if (!tokenCandidate) {
      return res.json({ authenticated: false });
    }

    try {
      const decoded: any = jwt.verify(tokenCandidate, ENV.JWT_SECRET as string);
      const user = await User.findById(decoded.userId);
      if (user) {
        // Sanitized — NEVER return token fields, even encrypted ones
        res.json({
          authenticated: true,
          user: {
            _id: user._id,
            username: user.username,
            displayName: user.displayName,
            avatarUrl: user.avatarUrl,
            email: user.email,
            plan: user.plan,
            auditsUsed: user.auditsUsed,
            pullRequestsUsed: user.pullRequestsUsed,
          },
        });
      } else {
        res.json({ authenticated: false });
      }
    } catch (error) {
      res.json({ authenticated: false });
    }
  });

  // === Repo Routes ===

  app.get("/api/repos", requireAuth, async (req, res) => {
    const token = (req as any).githubAccessToken;
    // (requireAuth already checks token)

    try {
      const reposResponse = await fetch("https://api.github.com/user/repos?sort=updated&per_page=100", {
        headers: {
          Authorization: `token ${token}`,
          Accept: "application/vnd.github.v3+json",
          "User-Agent": "Audit-Pilot-App"
        },
      });

      if (!reposResponse.ok) {
        throw new Error("Failed to fetch repositories from GitHub");
      }

      const repos = await reposResponse.json();
      res.json(repos);
    } catch (error) {
      console.error("GitHub Repo Error:", error);
      res.status(500).json({ message: "Failed to fetch repositories" });
    }
  });

  app.get("/api/pulls", requireAuth, async (req, res) => {
    const token = (req as any).githubAccessToken;
    // (requireAuth already checks token)

    try {
      // 1. Get user login to search for PRs authored by them
      const userResponse = await fetch("https://api.github.com/user", {
        headers: {
          Authorization: `token ${token}`,
          Accept: "application/vnd.github.v3+json",
          "User-Agent": "Audit-Pilot-App"
        },
      });
      const userData: any = await userResponse.json();
      const userLogin = userData.login;

      // 2. Search for open PRs authored by the user
      const searchResponse = await fetch(`https://api.github.com/search/issues?q=is:open+is:pr+author:${userLogin}`, {
        headers: {
          Authorization: `token ${token}`,
          Accept: "application/vnd.github.v3+json",
          "User-Agent": "Audit-Pilot-App"
        },
      });

      if (!searchResponse.ok) throw new Error("Failed to search Pull Requests");
      const searchData = await searchResponse.json();

      // The search returns "issues" which are PRs. We need to map them to include repo data.
      const pulls = searchData.items.map((item: any) => {
        // repo_url is like "https://api.github.com/repos/owner/repo"
        const repoFull = item.repository_url.replace("https://api.github.com/repos/", "");
        const [owner, name] = repoFull.split("/");
        return {
          id: item.id,
          number: item.number,
          title: item.title,
          state: item.state,
          repo: { owner, name, full_name: repoFull },
          user: { login: item.user.login, avatar_url: item.user.avatar_url },
          created_at: item.created_at,
          updated_at: item.updated_at,
          html_url: item.html_url
        };
      });

      res.json(pulls);
    } catch (error: any) {
      console.error("Fetch Pulls Error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/repos/:owner/:repo/branches", requireAuth, async (req, res) => {
    const token = (req as any).githubAccessToken;

    const { owner, repo } = req.params;
    try {
      const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/branches`, {
        headers: {
          Authorization: `token ${token}`,
          Accept: "application/vnd.github.v3+json",
          "User-Agent": "Audit-Pilot-App"
        },
      });

      if (!response.ok) throw new Error("Failed to fetch branches");
      const branches = await response.json();
      res.json(branches.map((b: any) => b.name));
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/repos/:owner/:repo/audit", requireAuth, async (req, res) => {
    const token = (req as any).githubAccessToken;

    const { owner, repo } = req.params;
    const { branch: requestedBranch } = req.body;
    const user = (req as any).user;

    // Plan Enforcement
    const plan = user?.plan || PLANS.STARTER;
    const limit = LIMITS[plan].audits;
    if (user && user.auditsUsed >= limit) {
      return res.status(402).json({
        message: `${plan.charAt(0).toUpperCase() + plan.slice(1)} limit reached.`,
        details: `You have used all ${limit} audits included in your plan. Upgrade for more scans.`
      });
    }

    try {
      // 1. Determine target branch
      let targetBranch = requestedBranch;
      if (!targetBranch) {
        const repoInfoResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
          headers: {
            Authorization: `token ${token}`,
            Accept: "application/vnd.github.v3+json",
            "User-Agent": "Audit-Pilot-App"
          },
        });
        const repoInfo = await repoInfoResponse.json();
        targetBranch = repoInfo.default_branch || 'main';
      }

      // 2. Use Trees API to find all files (recursive) on the selected branch
      const treeResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees/${targetBranch}?recursive=1`, {
        headers: {
          Authorization: `token ${token}`,
          Accept: "application/vnd.github.v3+json",
          "User-Agent": "Audit-Pilot-App"
        },
      });

      if (!treeResponse.ok) {
        return res.status(treeResponse.status).json({ message: `Failed to fetch file tree: ${treeResponse.statusText}` });
      }

      const treeData = await treeResponse.json();
      const files = treeData.tree.filter((item: any) => item.type === "blob");

      // 3. Filter for interesting files
      const sourceExtensions = ['.js', '.ts', '.tsx', '.jsx', '.py', '.java', '.go', '.rb', '.php', '.cs', '.rs', '.cpp', '.c'];
      const configFiles = ['package.json', 'tsconfig.json', 'README.md', 'requirements.txt', 'Gemfile', 'go.mod', 'composer.json', 'docker-compose.yml', 'Dockerfile'];

      const prioritizedFiles = files.filter((f: any) => {
        const path = f.path.toLowerCase();
        const isConfig = configFiles.some(cfg => path.endsWith(cfg));
        const isSource = sourceExtensions.some(ext => path.endsWith(ext)) && !path.includes('node_modules') && !path.includes('dist') && !path.includes('build') && !path.includes('.git');
        return isConfig || isSource;
      }).slice(0, 8);

      // If no prioritized files found, fallback to any text files
      let finalFiles = prioritizedFiles;
      if (finalFiles.length === 0) {
        console.log(`No prioritized files found for ${owner}/${repo}, falling back to any files.`);
        finalFiles = files.filter((f: any) => {
          const path = f.path.toLowerCase();
          return !path.includes('node_modules') && !path.includes('dist') && !path.includes('build') && !path.includes('.git') &&
            !path.endsWith('.png') && !path.endsWith('.jpg') && !path.endsWith('.jpeg') && !path.endsWith('.gif') && !path.endsWith('.pdf');
        }).slice(0, 5); // Take a smaller sample in fallback mode
      }

      if (finalFiles.length === 0) {
        console.warn(`No suitable files found for analysis in ${owner}/${repo}.`);
        return res.status(400).json({ message: "No suitable files found for analysis in this repository." });
      }

      console.log(`Auditing ${owner}/${repo}: analyzing ${finalFiles.length} files.`);

      // 4. Fetch content for found files
      let repoContent = "";
      for (const file of finalFiles) {
        try {
          const fileResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${file.path}`, {
            headers: {
              Authorization: `token ${token}`,
              Accept: "application/vnd.github.v3.raw",
              "User-Agent": "Audit-Pilot-App"
            },
          });

          if (fileResponse.ok) {
            const content = await fileResponse.text();
            const truncatedContent = content.length > 3000 ? content.substring(0, 3000) + "\n... [truncated]" : content;
            repoContent += `\n--- File: ${file.path} ---\n${truncatedContent}\n`;
          } else {
            console.warn(`Failed to fetch file content for ${file.path}: ${fileResponse.statusText}`);
          }
        } catch (err: any) {
          console.error(`Error fetching file ${file.path}:`, err.message);
        }
      }

      console.log(`Captured ${repoContent.length} characters of repository content.`);
      if (repoContent.length === 0) {
        console.warn("Repository content is empty despite finding files.");
      }

      // 5. AI Analysis
      let aiResponse;
      try {
        aiResponse = await openai.chat.completions.create({
          model: "nvidia/nemotron-3-nano-30b-a3b:free",
          messages: [
            {
              role: "system",
              content: "You are an expert security and performance auditor. Analyze the provided repository files and identify real issues. For each issue, provide: type (security, performance, accessibility), severity (critical, medium, low), file path, description, and if a fix is available, provide the old code and the new fixed code. Output valid JSON ONLY. Do not include any explanation outside the JSON object. The JSON should have an 'issues' array."
            },
            {
              role: "user",
              content: `REPOSITORY: ${owner}/${repo}\n\nFILES CONTENT:\n${repoContent}\n\nAnalyze the files above and provide the audit issues in the requested JSON format.`
            }
          ]
        });
      } catch (aiError: any) {
        console.error("AI Completion Error:", aiError.message);
        if (aiError.code === 'insufficient_quota') {
          return res.status(429).json({
            message: "OpenAI Quota Exceeded. Please check your billing/credits at platform.openai.com.",
            details: "Your API key has run out of funds or hit its limit."
          });
        }
        throw aiError;
      }

      const aiResult = safeJsonParse(aiResponse.choices[0].message.content || '{"issues": []}') || { "issues": [] };
      const rawIssues = Array.isArray(aiResult.issues) ? aiResult.issues : [];

      // Normalize issues: Ensure fix object exists and has old_code/new_code
      const issues = rawIssues.map((issue: any) => {
        const normalizedIssue = { ...issue };
        // Handle cases where old_code/new_code are at top level
        const oldCode = issue.old_code || issue.oldCode || (issue.fix?.old_code) || (issue.fix?.oldCode);
        const newCode = issue.new_code || issue.newCode || (issue.fix?.new_code) || (issue.fix?.newCode);
        const filePath = issue.file_path || issue.file || issue.path;

        if (oldCode && newCode) {
          normalizedIssue.fix = {
            old_code: oldCode,
            new_code: newCode
          };
        }
        normalizedIssue.file = filePath;
        return normalizedIssue;
      });

      // 6. Create Audit Record
      const audit = await storage.createAudit({
        title: `Audit: ${repo}`,
        description: `Deep AI audit for ${owner}/${repo} using dynamic file discovery.`,
        status: "completed",
        priority: issues.some((i: any) => i.severity === "critical") ? "critical" : "medium",
        scope: "Global Repository Scan",
        branch: targetBranch,
      });

      // 7. Save Audit Items
      const savedItems = [];
      for (const issue of issues) {
        const item = await storage.createAuditItem({
          auditId: audit._id,
          label: issue.description || "Point of interest detected",
          type: issue.type || "security",
          value: issue.file || "Root",
          severity: issue.severity || "medium",
          old_code: issue.fix?.old_code || issue.old_code,
          new_code: issue.fix?.new_code || issue.new_code,
          complianceStatus: "non_compliant",
          auditorNotes: `Rank: ${issue.severity}. Recommendation: ${issue.new_code ? 'Apply suggested fix' : 'Manual review required'}`
        });
        savedItems.push({ ...issue, dbId: item._id });
      }

      // 8. Update usage
      if (user) {
        await User.findByIdAndUpdate(user._id, { $inc: { auditsUsed: 1 } });
      }

      res.json({ audit, issues: savedItems });
    } catch (error: any) {
      console.error("Robust AI Audit Error:", error);

      // Specifically handle 401/403 from AI Provider
      if (error.status === 401 || error.status === 403 || error.message?.includes('401') || error.message?.includes('403')) {
        return res.status(error.status || 401).json({
          message: "AI Provider Authentication failed. Please check your AI_INTEGRATIONS_OPENAI_API_KEY and BASE_URL in Netlify.",
          details: error.message
        });
      }

      res.status(500).json({ message: error.message || "An unexpected error occurred during the audit process." });
    }
  });

  app.post("/api/repos/:owner/:repo/fix", requireAuth, async (req, res) => {
    const token = (req as any).githubAccessToken;

    const { owner, repo } = req.params;
    const { issues, targetBranch } = req.body;

    try {
      // 1. Get default branch/latest SHA for the base
      const repoResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/ref/heads/${targetBranch}`, {
        headers: {
          Authorization: `token ${token}`,
          Accept: "application/vnd.github.v3+json",
          "User-Agent": "Audit-Pilot-App"
        },
      });
      if (!repoResponse.ok) throw new Error(`Target branch ${targetBranch} not found`);
      const repoRef = await repoResponse.json();
      const baseSha = repoRef.object.sha;

      // 2. Create a new branch
      const newBranchName = `auditpilot-fix-${Date.now()}`;
      const createBranchResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/refs`, {
        method: "POST",
        headers: {
          Authorization: `token ${token}`,
          "Content-Type": "application/json",
          "User-Agent": "Audit-Pilot-App"
        },
        body: JSON.stringify({ ref: `refs/heads/${newBranchName}`, sha: baseSha }),
      });
      if (!createBranchResponse.ok) throw new Error("Failed to create new branch");

      // 3. Update files for each issue
      let modifiedFilesCount = 0;
      for (const issue of issues) {
        // Normalize issue data for the fix
        const oldCode = issue.fix?.old_code || issue.old_code || issue.oldCode;
        const newCode = issue.fix?.new_code || issue.new_code || issue.newCode;
        const filePath = issue.file || issue.file_path || issue.path;

        if (!oldCode || !newCode || !filePath) {
          console.warn("Skipping issue fix due to missing data:", { filePath, hasOld: !!oldCode, hasNew: !!newCode });
          continue;
        }

        // Fetch current file content
        const fileResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${filePath}?ref=${newBranchName}`, {
          headers: {
            Authorization: `token ${token}`,
            Accept: "application/vnd.github.v3+json",
            "User-Agent": "Audit-Pilot-App"
          },
        });

        if (fileResponse.ok) {
          const fileData = await fileResponse.json();
          const currentContent = Buffer.from(fileData.content, 'base64').toString('utf-8');

          // Apply fix (robust replacement)
          let newContent = currentContent;
          if (currentContent.includes(oldCode)) {
            newContent = currentContent.replace(oldCode, newCode);
          } else {
            // Internal normalization for matching: trim and unify newlines
            const normalize = (s: string) => s.replace(/\r\n/g, '\n').trim();
            const normalizedContent = normalize(currentContent);
            const normalizedOld = normalize(oldCode);

            if (normalizedContent.includes(normalizedOld)) {
              // If we found a match after normalization, we need to find where it is in the original
              // This is complex, so let's try a split/join on the normalized versions
              // A simpler approach for now: replace if the normalized versions match exactly
              // or just use regex with whitespace flexibility
              const escapedOld = oldCode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
              const regex = new RegExp(escapedOld, 'g');
              newContent = currentContent.replace(regex, newCode);
            }
          }

          if (currentContent !== newContent) {
            const updateResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`, {
              method: "PUT",
              headers: {
                Authorization: `token ${token}`,
                "Content-Type": "application/json",
                "User-Agent": "Audit-Pilot-App"
              },
              body: JSON.stringify({
                message: `AuditPilot: Fix issue in ${filePath}\n\n${issue.description}`,
                content: Buffer.from(newContent).toString('base64'),
                sha: fileData.sha,
                branch: newBranchName,
              }),
            });

            if (updateResponse.ok) {
              modifiedFilesCount++;
            } else {
              const err = await updateResponse.json();
              console.error(`Failed to update file ${filePath}:`, err);
            }
          } else {
            console.warn(`Content mismatch or already fixed for ${filePath}. Replace not applied.`, {
              oldCodeLength: oldCode.length,
              currentMatch: currentContent.includes(oldCode)
            });
          }
        } else {
          console.error(`Failed to fetch file ${filePath} from branch ${newBranchName}`);
        }
      }

      // Check if any files were actually modified
      if (modifiedFilesCount === 0) {
        throw new Error("No changes were applied. The AI-suggested code snippets did not match the current file contents exactly. This usually happens due to whitespace or version differences.");
      }

      // 4. Create Pull Request
      const prResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls`, {
        method: "POST",
        headers: {
          Authorization: `token ${token}`,
          "Content-Type": "application/json",
          "User-Agent": "Audit-Pilot-App"
        },
        body: JSON.stringify({
          title: `AuditPilot: Fix security and performance issues`,
          body: `This PR applies automated fixes for issues identified during the AI audit.\n\nIssues fixed:\n${issues.map((i: any) => `- ${i.label || i.description || "Issue Detected"}`).join('\n')}`,
          head: newBranchName,
          base: targetBranch,
        }),
      });

      if (!prResponse.ok) {
        const err = await prResponse.json();
        console.error("GitHub PR Creation Failed:", {
          status: prResponse.status,
          error: err,
          payload: {
            title: `AuditPilot: Fix security and performance issues`,
            head: newBranchName,
            base: targetBranch,
          }
        });

        let errorMessage = `Failed to create PR: ${err.message || 'Unknown GitHub Error'}`;
        if (err.errors) {
          const details = err.errors.map((e: any) => e.message || e.code).join(', ');
          errorMessage += ` (${details})`;
        }

        throw new Error(errorMessage);
      }

      const prData = await prResponse.json();
      res.json(prData);
    } catch (error: any) {
      console.error("Apply Fix Error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // === Audit Routes ===

  app.get("/api/audits", requireAuth, async (_req, res) => {
    const audits = await storage.getAudits();
    res.json(audits);
  });

  app.get("/api/audits/:id", requireAuth, async (req, res) => {
    const audit = await storage.getAudit(String(req.params.id));
    if (!audit) {
      return res.status(404).json({ message: "Audit not found" });
    }
    res.json(audit);
  });

  app.post("/api/audits", requireAuth, async (req, res) => {
    try {
      const audit = await storage.createAudit(req.body);
      res.status(201).json(audit);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.patch("/api/audits/:id", requireAuth, async (req, res) => {
    try {
      const audit = await storage.updateAudit(String(req.params.id), req.body);
      if (!audit) {
        return res.status(404).json({ message: "Audit not found" });
      }
      res.json(audit);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.delete("/api/audits/:id", requireAuth, async (req, res) => {
    await storage.deleteAudit(String(req.params.id));
    res.status(204).send();
  });

  // === Audit Item Routes ===

  app.post("/api/audits/:auditId/items", requireAuth, async (req, res) => {
    try {
      const item = await storage.createAuditItem({ ...req.body, auditId: req.params.auditId });
      res.status(201).json(item);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.patch("/api/audit-items/:id", requireAuth, async (req, res) => {
    try {
      const item = await storage.updateAuditItem(String(req.params.id), req.body);
      if (!item) {
        return res.status(404).json({ message: "Item not found" });
      }
      res.json(item);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.delete("/api/audit-items/:id", requireAuth, async (req, res) => {
    await storage.deleteAuditItem(String(req.params.id));
    res.status(204).send();
  });

  // === AI Insights Route ===

  app.post("/api/audits/:id/generate-insights", requireAuth, async (req, res) => {
    try {
      const auditId = String(req.params.id);
      const audit = await storage.getAudit(auditId);

      if (!audit) {
        return res.status(404).json({ message: "Audit not found" });
      }

      const auditContext = `
        Title: ${audit.title}
        Description: ${audit.description}
        Priority: ${audit.priority}
        Items:
        ${audit.items.map((i: any) => `- ${i.label}: ${i.value || 'N/A'} (Status: ${i.complianceStatus || 'Pending'})`).join('\n')}
      `;

      const response = await openai.chat.completions.create({
        model: "nvidia/nemotron-3-nano-30b-a3b:free",
        messages: [
          {
            role: "system",
            content: "You are an expert audit compliance assistant. Analyze the following audit data and provide a summary, a risk score (0-100), and detailed insights/recommendations. Output valid JSON ONLY. Do not include any explanation outside the JSON object."
          },
          {
            role: "user",
            content: auditContext
          }
        ]
      });

      const content = response.choices[0].message.content || "{}";
      const result = safeJsonParse(content) || {};

      const summary = result.summary || "No summary generated.";
      const riskScore = typeof result.riskScore === 'number' ? result.riskScore : 50;
      const generatedContent = result.insights || result.recommendations || JSON.stringify(result, null, 2);

      const report = await storage.createReport({
        auditId,
        summary,
        riskScore,
        generatedContent
      });

      res.json(report);
    } catch (error) {
      console.error("AI Generation Error:", error);
      res.status(500).json({ message: "Failed to generate insights" });
    }
  });

  // === PR Detail and AI Flow ===

  app.get("/api/repos/:owner/:repo/pulls/:number/files", requireAuth, async (req, res) => {
    const token = (req as any).githubAccessToken;

    const { owner, repo, number } = req.params;
    try {
      const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls/${number}/files`, {
        headers: {
          Authorization: `token ${token}`,
          Accept: "application/vnd.github.v3+json",
          "User-Agent": "Audit-Pilot-App"
        },
      });

      if (!response.ok) throw new Error("Failed to fetch PR files");
      const files = await response.json();
      res.json(files);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/repos/:owner/:repo/pulls/:number/audit", requireAuth, async (req, res) => {
    const token = (req as any).githubAccessToken;

    const { owner, repo, number } = req.params;
    const user = (req as any).user;

    // Plan Enforcement
    const plan = user?.plan || PLANS.STARTER;
    const limit = LIMITS[plan].pullRequests;
    if (user && user.pullRequestsUsed >= limit) {
      return res.status(402).json({
        message: `${plan.charAt(0).toUpperCase() + plan.slice(1)} PR review limit reached.`,
        details: `You have used all ${limit} PR actions included in your plan. Upgrade for more reviews.`
      });
    }

    try {
      // 1. Fetch PR files to get diffs
      const filesResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls/${number}/files`, {
        headers: {
          Authorization: `token ${token}`,
          Accept: "application/vnd.github.v3+json",
          "User-Agent": "Audit-Pilot-App"
        },
      });
      const files = await filesResponse.json();

      // 2. Prepare context for AI (focus on the patches/diffs)
      const prContext = files.map((f: any) => `File: ${f.filename}\nDiff:\n${f.patch}`).join("\n\n");

      // 3. AI Analysis of the PR
      const aiResponse = await openai.chat.completions.create({
        model: "nvidia/nemotron-3-nano-30b-a3b:free",
        messages: [
          {
            role: "system",
            content: "You are an expert code reviewer. Analyze the following Pull Request diffs and identify any security vulnerabilities, performance issues, or bugs introduced in these changes. For each issue, provide: type, severity, description, and a fix (old_code and new_code). Output valid JSON ONLY with an 'issues' array."
          },
          {
            role: "user",
            content: `Review this Pull Request (${owner}/${repo} #${number}):\n\n${prContext}`
          }
        ]
      });

      const result = safeJsonParse(aiResponse.choices[0].message.content || '{"issues": []}') || { "issues": [] };

      // Update usage
      if (user && user.plan === 'starter') {
        await User.findByIdAndUpdate(user._id, { $inc: { pullRequestsUsed: 1 } });
      }

      res.json(result);
    } catch (error: any) {
      console.error("PR Audit Error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/repos/:owner/:repo/pulls/:number/fix", requireAuth, async (req, res) => {
    const token = (req as any).githubAccessToken;

    const { owner, repo, number } = req.params;
    const { issues } = req.body;

    try {
      // 1. Get PR details to find head branch
      const prResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls/${number}`, {
        headers: {
          Authorization: `token ${token}`,
          Accept: "application/vnd.github.v3+json",
          "User-Agent": "Audit-Pilot-App"
        },
      });
      const prData = await prResponse.json();
      const headBranch = prData.head.ref;

      // 2. Apply fixes to the head branch
      for (const issue of issues) {
        if (!issue.fix) continue;

        const fileResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${issue.file}?ref=${headBranch}`, {
          headers: {
            Authorization: `token ${token}`,
            Accept: "application/vnd.github.v3+json",
            "User-Agent": "Audit-Pilot-App"
          },
        });

        if (fileResponse.ok) {
          const fileData = await fileResponse.json();
          const currentContent = Buffer.from(fileData.content, 'base64').toString('utf-8');
          const newContent = currentContent.replace(issue.fix.old_code, issue.fix.new_code);

          if (currentContent !== newContent) {
            await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${issue.file}`, {
              method: "PUT",
              headers: {
                Authorization: `token ${token}`,
                "Content-Type": "application/json",
                "User-Agent": "Audit-Pilot-App"
              },
              body: JSON.stringify({
                message: `AuditPilot: Correcting PR #${number} - ${issue.description}`,
                content: Buffer.from(newContent).toString('base64'),
                sha: fileData.sha,
                branch: headBranch,
              }),
            });
          }
        }
      }

      res.json({ message: "PR corrected successfully" });
    } catch (error: any) {
      console.error("PR Fix Error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/repos/:owner/:repo/pulls/:number/merge", requireAuth, async (req, res) => {
    const token = (req as any).githubAccessToken;

    const { owner, repo, number } = req.params;
    const user = (req as any).user;

    // Plan Enforcement
    const plan = user?.plan || PLANS.STARTER;
    const limit = LIMITS[plan].pullRequests;
    if (user && user.pullRequestsUsed >= limit) {
      return res.status(402).json({
        message: `${plan.charAt(0).toUpperCase() + plan.slice(1)} PR merge limit reached.`,
        details: `You have used all ${limit} PR actions included in your plan. Upgrade for unlimited merges.`
      });
    }

    try {
      // 1. Get PR info to know the branch name
      const prResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls/${number}`, {
        headers: {
          Authorization: `token ${token}`,
          "User-Agent": "Audit-Pilot-App"
        },
      });

      let branchName = "";
      if (prResponse.ok) {
        const prData = await prResponse.json();
        branchName = prData.head?.ref || "";
      }

      // 2. Perform merge
      const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls/${number}/merge`, {
        method: "PUT",
        headers: {
          Authorization: `token ${token}`,
          "Content-Type": "application/json",
          "User-Agent": "Audit-Pilot-App"
        },
        body: JSON.stringify({
          commit_title: `AuditPilot: Merging PR #${number}`,
          merge_method: "squash"
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || "Failed to merge PR");
      }

      // 3. Delete branch if it's a temporary audit branch
      if (branchName && branchName.startsWith("audit-")) {
        console.log(`Deleting temporary branch: ${branchName}`);
        await fetch(`https://api.github.com/repos/${owner}/${repo}/git/refs/heads/${branchName}`, {
          method: "DELETE",
          headers: {
            Authorization: `token ${token}`,
            "User-Agent": "Audit-Pilot-App"
          },
        });
      }

      // Update usage
      if (user) {
        await User.findByIdAndUpdate(user._id, { $inc: { pullRequestsUsed: 1 } });
      }

      res.json({ message: "PR merged and branch cleaned up successfully" });
    } catch (error: any) {
      console.error("Merge error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/repos/:owner/:repo/pulls/:number", requireAuth, async (req, res) => {
    const token = (req as any).githubAccessToken;
    const { owner, repo, number } = req.params;
    const { base, title, body, state } = req.body;

    try {
      const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls/${number}`, {
        method: "PATCH",
        headers: {
          Authorization: `token ${token}`,
          "Content-Type": "application/json",
          "Accept": "application/vnd.github.v3+json",
          "User-Agent": "Audit-Pilot-App"
        },
        body: JSON.stringify({ base, title, body, state }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || "Failed to update Pull Request");
      }

      const updatedPR = await response.json();
      res.json(updatedPR);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // === Billing Routes ===

  app.post("/api/billing/create-checkout-session", requireAuth, async (req, res) => {
    const { plan } = req.body;
    const user = (req as any).user;

    if (!plan || !STRIPE_PRICE_IDS[plan]) {
      return res.status(400).json({ message: "Invalid plan selected" });
    }

    try {
      if (!process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY === 'sk_test_placeholder') {
        throw new Error("Stripe Secret Key is not configured correctly in .env");
      }

      // 1. Ensure user has a Stripe Customer ID
      let stripeCustomerId = user.stripeCustomerId;
      if (!stripeCustomerId) {
        const customer = await stripe.customers.create({
          email: user.email,
          name: user.displayName || user.username,
          metadata: { userId: user._id.toString() }
        });
        stripeCustomerId = customer.id;
        await User.findByIdAndUpdate(user._id, { stripeCustomerId });
      }

      // 2. Create Checkout Session
      const session = await stripe.checkout.sessions.create({
        customer: stripeCustomerId,
        payment_method_types: ['card'],
        line_items: [
          {
            price: STRIPE_PRICE_IDS[plan],
            quantity: 1,
          },
        ],
        mode: 'subscription',
        success_url: `${req.protocol}://${req.get('host')}/app?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${req.protocol}://${req.get('host')}/app?billing=true`,
        metadata: {
          userId: user._id.toString(),
          plan: plan
        }
      });

      res.json({ url: session.url });
    } catch (error: any) {
      console.error("Stripe Session Error:", error);
      res.status(500).json({ 
        message: "Failed to create checkout session", 
        details: error.message 
      });
    }
  });

  app.post("/api/billing/webhook", async (req: any, res) => {
    const sig = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {
      // Never accept unsigned payloads — a missing secret is a misconfiguration.
      console.error("STRIPE_WEBHOOK_SECRET is not configured — rejecting webhook");
      return res.status(503).json({ message: "Stripe webhook not configured" });
    }

    let event;

    try {
      event = stripe.webhooks.constructEvent(req.rawBody as any, sig as string, webhookSecret);
    } catch (err: any) {
      console.error(`Webhook Error: ${err.message}`);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle the event
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as any;
        const userId = session.metadata.userId;
        const plan = session.metadata.plan;
        const subscriptionId = session.subscription;

        if (userId && plan) {
          await User.findByIdAndUpdate(userId, {
            plan: plan,
            stripeSubscriptionId: subscriptionId
          });
          console.log(`User ${userId} upgraded to ${plan}`);
        }
        break;
      }
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as any;
        const customerId = subscription.customer;
        
        await User.findOneAndUpdate(
          { stripeCustomerId: customerId },
          { plan: PLANS.STARTER, stripeSubscriptionId: null }
        );
        console.log(`Subscription deleted for customer ${customerId}, reverted to starter`);
        break;
      }
      default:
        console.log(`Unhandled event type ${event.type}`);
    }

    res.json({ received: true });
  });

  app.post("/api/billing/verify-session", requireAuth, async (req, res) => {
    const { sessionId } = req.body;
    const user = (req as any).user;

    try {
      const session = await stripe.checkout.sessions.retrieve(sessionId);

      // Ownership check: the session must belong to the requesting user
      // (prevents plan escalation using another account's paid session id)
      if (session.metadata?.userId !== String(user._id)) {
        return res.status(403).json({ message: "This checkout session does not belong to you" });
      }

      if (session.payment_status === 'paid') {
        const plan = session.metadata?.plan;
        const subscriptionId = session.subscription as string;

        if (plan) {
          await User.findByIdAndUpdate(user._id, {
            plan: plan,
            stripeSubscriptionId: subscriptionId
          });
          
          const updatedUser = await User.findById(user._id);
          return res.json({ success: true, plan: updatedUser?.plan });
        }
      }
      
      res.json({ success: false });
    } catch (error: any) {
      console.error("Session Verification Error:", error);
      res.status(500).json({ message: "Failed to verify session" });
    }
  });

  return httpServer;
}
