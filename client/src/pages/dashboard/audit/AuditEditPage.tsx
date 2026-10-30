import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  Link2,
  Link2Off,
  Loader2,
  Pencil,
  Plus,
  RotateCcw,
  Save,
  X,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  useAudit,
  useUpdateAuditItem,
  useApplyFixContents,
  useFixPreview,
} from "@/hooks/use-audits";
import { useLocation, useParams } from "wouter";
import DashboardLayout from "../DashboardLayout";
import { useToast } from "@/hooks/use-toast";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MatchInfo {
  line: number;
  exact: boolean;
}

interface FixPreview {
  auditId: string;
  branch: string;
  files: Record<string, { content: string; truncated: boolean; totalLines: number }>;
  items: Array<{
    itemId: string;
    label?: string;
    type?: string;
    severity?: string;
    file: string | null;
    oldCode: string | null;
    newCode: string | null;
    match: MatchInfo | null;
  }>;
}

type ContextSeg = { kind: "context"; id: string; startLine: number; lines: string[] };
type RemovedSeg = { kind: "removed"; id: string; startLine: number; lines: string[] };
/** New content (green, editable). `anchor` = 0-based-count of original lines before it. */
type AddedSeg = { kind: "added"; id: string; anchor: number; lines: string[] };
type Seg = ContextSeg | RemovedSeg | AddedSeg;

interface FileState {
  path: string;
  segments: Seg[];
  truncated: boolean;
  totalLines: number;
  viewed: boolean;
  /** Display window — 1-based ORIGINAL line bounds (leading/trailing context). */
  winTop: number;
  winBottom: number;
  expandedAll: boolean;
}

type Row =
  | { type: "context"; old: number; new: number; text: string; segId: string; i: number }
  | { type: "removed"; old: number; text: string; segId: string; i: number }
  | { type: "added"; new: number; text: string; segId: string; i: number };

const uid = () => Math.random().toString(36).slice(2, 10);
const countLines = (code: string) => (code == null || code === "" ? 0 : code.split("\n").length);

const DEFAULT_WINDOW = 120;
const CONTEXT_PAD = 8;

function draftKey(auditId: string) {
  return `auditfix-edit:${auditId}`;
}

// ---------------------------------------------------------------------------
// Segment construction — tiles the ORIGINAL file with context/removed segs and
// interleaves added content from anchored AI fixes.
// ---------------------------------------------------------------------------

interface ItemEdit {
  auditItemId: string;
  start: number; // 1-based original line of the first replaced/removed line
  oldLen: number;
  newLines: string[];
}

export function buildSegments(lines: string[], edits: ItemEdit[]): Seg[] {
  const segs: Seg[] = [];
  let cursor = 1;
  const sorted = [...edits].sort((a, b) => a.start - b.start);

  for (const e of sorted) {
    if (e.start > lines.length) continue;
    const end = Math.min(lines.length, e.start + e.oldLen - 1);

    if (e.start > cursor) {
      segs.push({
        kind: "context",
        id: uid(),
        startLine: cursor,
        lines: lines.slice(cursor - 1, e.start - 1),
      });
      cursor = e.start;
    }

    // Adjacent/overlapping with a previous edit region → extend its added seg.
    const last = segs[segs.length - 1];
    if (e.start <= cursor && last && last.kind === "added") {
      last.lines.push(...e.newLines);
      continue;
    }

    if (end >= cursor) {
      segs.push({
        kind: "removed",
        id: uid(),
        startLine: cursor,
        lines: lines.slice(cursor - 1, end),
      });
      cursor = end + 1;
    }
    segs.push({ kind: "added", id: uid(), anchor: cursor - 1, lines: [...e.newLines] });
  }

  if (cursor <= lines.length) {
    segs.push({
      kind: "context",
      id: uid(),
      startLine: cursor,
      lines: lines.slice(cursor - 1),
    });
  }
  return segs;
}

// ---------------------------------------------------------------------------
// Derived values
// ---------------------------------------------------------------------------

function buildNewContent(f: FileState): string {
  const out: string[] = [];
  for (const seg of f.segments) {
    if (seg.kind === "removed") continue;
    out.push(...seg.lines);
  }
  return out.join("\n");
}

function countChanges(f: FileState): { added: number; removed: number } {
  let added = 0;
  let removed = 0;
  for (const seg of f.segments) {
    if (seg.kind === "added") added += seg.lines.length;
    if (seg.kind === "removed") removed += seg.lines.length;
  }
  return { added, removed };
}

function hasRealEdits(f: FileState): boolean {
  const { added, removed } = countChanges(f);
  return added > 0 || removed > 0;
}

/** Original positions covered by edits (removed ranges / added anchors). */
function editBounds(f: FileState): { first: number; last: number } | null {
  let first = Infinity;
  let last = -Infinity;
  for (const seg of f.segments) {
    if (seg.kind === "removed") {
      first = Math.min(first, seg.startLine);
      last = Math.max(last, seg.startLine + seg.lines.length - 1);
    } else if (seg.kind === "added" && seg.lines.length > 0) {
      const a = Math.max(0, Math.min(seg.anchor, f.totalLines));
      first = Math.min(first, a === 0 ? 1 : a);
      last = Math.max(last, Math.min(f.totalLines, a + 1));
    }
  }
  if (last < 0) return null;
  return { first, last };
}

/** Effective window: covers edits when present, else anchored/default area. */
function effectiveWindow(f: FileState): { top: number; bottom: number } {
  if (f.expandedAll) return { top: 1, bottom: f.totalLines };
  const bounds = hasRealEdits(f) ? editBounds(f) : null;
  if (bounds) {
    return {
      top: Math.min(f.winTop, Math.max(1, bounds.first - CONTEXT_PAD)),
      bottom: Math.max(f.winBottom, Math.min(f.totalLines, bounds.last + CONTEXT_PAD)),
    };
  }
  return { top: f.winTop, bottom: f.winBottom };
}

function severityBadgeClass(severity?: string) {
  switch ((severity || "").toLowerCase()) {
    case "critical":
      return "bg-rose-50 text-rose-700 border-rose-200";
    case "high":
      return "bg-orange-50 text-orange-700 border-orange-200";
    case "medium":
      return "bg-amber-50 text-amber-700 border-amber-200";
    default:
      return "bg-slate-50 text-slate-600 border-slate-200";
  }
}

/** Breadcrumbs like Bitbucket: src / screens / CategorizeScreen / File.tsx */
function FilePathBreadcrumbs({ path }: { path: string }) {
  const parts = path.split("/");
  return (
    <div className="flex items-center gap-1 flex-wrap min-w-0">
      {parts.map((part, i) => (
        <React.Fragment key={i}>
          {i > 0 && <span className="text-slate-300 text-xs">/</span>}
          <span
            className={
              i === parts.length - 1
                ? "text-[13px] font-semibold text-slate-800 truncate"
                : "text-[13px] text-slate-500 truncate"
            }
          >
            {part}
          </span>
        </React.Fragment>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Hover command cluster
// ---------------------------------------------------------------------------

function RowCommands({
  onEdit,
  onInsert,
  onDelete,
  onRestore,
}: {
  onEdit?: () => void;
  onInsert?: () => void;
  onDelete?: () => void;
  onRestore?: () => void;
}) {
  if (!onEdit && !onInsert && !onDelete && !onRestore) return null;
  return (
    <div className="absolute right-2 top-1 hidden group-hover:flex items-center gap-0.5 bg-white/95 border border-slate-200 rounded-md shadow-sm px-1 py-0.5 z-10">
      {onRestore && (
        <button title="Restore line" className="p-1 text-slate-500 hover:text-emerald-600" onClick={onRestore}>
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      )}
      {onEdit && (
        <button title="Edit line" className="p-1 text-slate-500 hover:text-indigo-600" onClick={onEdit}>
          <Pencil className="w-3.5 h-3.5" />
        </button>
      )}
      {onInsert && (
        <button title="Insert new line below" className="p-1 text-slate-500 hover:text-emerald-600" onClick={onInsert}>
          <Plus className="w-3.5 h-3.5" />
        </button>
      )}
      {onDelete && (
        <button title="Remove line" className="p-1 text-slate-500 hover:text-rose-600" onClick={onDelete}>
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// One diff row
// ---------------------------------------------------------------------------

function DiffRow({
  row,
  editing,
  children,
  onEditCommit,
  onEditCancel,
}: {
  row: Row;
  editing: boolean;
  children?: React.ReactNode;
  onEditCommit: (text: string) => void;
  onEditCancel: () => void;
}) {
  const ref = useRef<HTMLTextAreaElement | null>(null);
  useEffect(() => {
    if (editing && ref.current) {
      ref.current.focus();
      ref.current.select();
    }
  }, [editing]);

  const editor = (initial: string, tone: string) => (
    <textarea
      ref={ref}
      rows={1}
      defaultValue={initial}
      className={`flex-1 font-mono text-xs p-1 pr-2 outline-none resize-none min-h-[24px] bg-white ${tone}`}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          onEditCommit((e.target as HTMLTextAreaElement).value);
        }
        if (e.key === "Escape") onEditCancel();
      }}
      onBlur={(e) => onEditCommit(e.target.value)}
    />
  );

  if (row.type === "context") {
    return editing ? (
      <div className="flex bg-white ring-2 ring-indigo-400 rounded-sm">
        <span className="w-12 shrink-0 select-none text-right pr-2 pt-1 text-[11px] font-mono bg-slate-100 text-slate-400">{row.old}</span>
        <span className="w-12 shrink-0 select-none text-right pr-2 pt-1 text-[11px] font-mono bg-slate-100 text-slate-400">{row.new}</span>
        <span className="w-5 shrink-0 select-none font-mono pt-1 text-center text-slate-300 text-[11px]">·</span>
        {editor(row.text, "text-slate-700")}
      </div>
    ) : (
      <div className="group flex bg-white hover:bg-slate-50 relative">
        <span className="w-12 shrink-0 select-none text-right pr-2 pt-1 text-[11px] font-mono bg-slate-100 text-slate-400">{row.old}</span>
        <span className="w-12 shrink-0 select-none text-right pr-2 pt-1 text-[11px] font-mono bg-slate-100 text-slate-400">{row.new}</span>
        <span className="w-5 shrink-0 select-none font-mono pt-1 text-center text-slate-300 text-[11px]">·</span>
        <pre className="flex-1 pr-24 py-0.5 font-mono text-xs whitespace-pre text-slate-700">{row.text.length ? row.text : " "}</pre>
        {children}
      </div>
    );
  }

  if (row.type === "removed") {
    return (
      <div className="group flex bg-rose-50/70 hover:bg-rose-50 relative">
        <span className="w-12 shrink-0 select-none text-right pr-2 pt-1 text-[11px] font-mono bg-rose-100/60 text-rose-400">{row.old}</span>
        <span className="w-12 shrink-0 select-none bg-rose-100/60 border-l border-rose-100" />
        <span className="w-5 shrink-0 select-none font-mono pt-1 text-center text-rose-500 text-[11px]">−</span>
        <pre className="flex-1 pr-24 py-0.5 font-mono text-xs whitespace-pre text-rose-700">{row.text.length ? row.text : " "}</pre>
        {children}
      </div>
    );
  }

  // added
  return editing ? (
    <div className="flex bg-emerald-50 ring-2 ring-indigo-400 rounded-sm">
      <span className="w-12 shrink-0 select-none bg-emerald-100/60 border-r border-emerald-100" />
      <span className="w-12 shrink-0 select-none text-right pr-2 pt-1 text-[11px] font-mono bg-emerald-100/60 text-emerald-500">{row.new}</span>
      <span className="w-5 shrink-0 select-none font-mono pt-1 text-center text-emerald-600 text-[11px]">+</span>
      {editor(row.text, "text-slate-800 bg-transparent")}
    </div>
  ) : (
    <div className="group flex bg-emerald-50/70 hover:bg-emerald-50 relative">
      <span className="w-12 shrink-0 select-none bg-emerald-100/60 border-r border-emerald-100" />
      <span className="w-12 shrink-0 select-none text-right pr-2 pt-1 text-[11px] font-mono bg-emerald-100/60 text-emerald-500">{row.new}</span>
      <span className="w-5 shrink-0 select-none font-mono pt-1 text-center text-emerald-600 text-[11px]">+</span>
      <pre className="flex-1 pr-24 py-0.5 font-mono text-xs whitespace-pre text-slate-800">{row.text.length ? row.text : " "}</pre>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Per-file info for the card header notes
// ---------------------------------------------------------------------------

interface FileItemInfo {
  itemId: string;
  label: string;
  type?: string;
  severity?: string;
  match: MatchInfo | null;
  newCode: string | null;
}

// ---------------------------------------------------------------------------
// File diff card
// ---------------------------------------------------------------------------

function FileDiffCard({
  file,
  items,
  focus,
  setFocus,
  ops,
}: {
  file: FileState;
  items: FileItemInfo[];
  focus: string | null;
  setFocus: (id: string | null) => void;
  ops: FileOps;
}) {
  const { added, removed } = countChanges(file);
  const edits = hasRealEdits(file);
  const effWin = useMemo(() => effectiveWindow(file), [file]);

  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    let newNo = 0;
    for (const seg of file.segments) {
      if (seg.kind === "context") {
        for (let k = 0; k < seg.lines.length; k++) {
          const origLine = seg.startLine + k;
          if (origLine < effWin.top || origLine > effWin.bottom) continue; // clipped (expand strips cover it)
          out.push({ type: "context", old: origLine, new: ++newNo, text: seg.lines[k], segId: seg.id, i: k });
        }
      } else if (seg.kind === "removed") {
        for (let k = 0; k < seg.lines.length; k++) {
          out.push({ type: "removed", old: seg.startLine + k, text: seg.lines[k], segId: seg.id, i: k });
        }
      } else {
        for (let k = 0; k < seg.lines.length; k++) {
          out.push({ type: "added", new: ++newNo, text: seg.lines[k], segId: seg.id, i: k });
        }
      }
    }
    return out;
  }, [file.segments, effWin]);

  const hunk = useMemo(() => {
    if (!rows.length) return null;
    const rowsWithOld = rows.filter((r) => r.type !== "added") as Array<{ old: number }>;
    const rowsWithNew = rows.filter((r) => r.type !== "removed") as Array<{ new: number }>;
    const oldStart = rowsWithOld[0]?.old ?? effWin.top;
    const oldEnd = rowsWithOld[rowsWithOld.length - 1]?.old ?? oldStart;
    const newStart = rowsWithNew[0]?.new ?? effWin.top;
    const newEnd = rowsWithNew[rowsWithNew.length - 1]?.new ?? newStart;
    return `@@ -${oldStart},${Math.max(1, oldEnd - oldStart + 1)} +${newStart},${Math.max(1, newEnd - newStart + 1)} @@`;
  }, [rows, effWin]);

  const editKeyOf = (row: Row) => `${row.segId}:${row.i}:${row.type}`;

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden" id={`file-${file.path}`}>
      {/* File header */}
      <div className="flex items-center justify-between gap-3 px-4 py-2.5 bg-slate-50/70 border-b border-slate-200">
        <div className="flex items-center gap-2 min-w-0">
          <FilePathBreadcrumbs path={file.path} />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {added > 0 && (
            <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 rounded-full px-2 py-0.5">+{added}</span>
          )}
          {removed > 0 && (
            <span className="text-[11px] font-bold text-rose-600 bg-rose-50 border border-rose-100 rounded-full px-2 py-0.5">−{removed}</span>
          )}
          <label className="flex items-center gap-1.5 text-[11px] text-slate-500 cursor-pointer select-none">
            <input type="checkbox" checked={file.viewed} onChange={() => ops.toggleViewed(file.path)} className="h-3.5 w-3.5 accent-indigo-600" />
            Viewed
          </label>
        </div>
      </div>

      {/* Linked issue notes (comment-thread style) */}
      {items.length > 0 && (
        <div className="px-4 py-2 border-b border-slate-100 bg-white flex flex-col gap-1.5">
          {items.map((it) => (
            <div key={it.itemId} className="flex items-start gap-2 text-xs">
              <AlertCircle
                className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${it.severity === "critical" ? "text-rose-500" : "text-amber-500"}`}
              />
              <div className="min-w-0">
                <p className="text-slate-700 leading-snug">{it.label}</p>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <Badge variant="outline" className={`text-[9px] px-1.5 ${severityBadgeClass(it.severity)}`}>
                    {it.severity || "medium"}
                  </Badge>
                  {it.match ? (
                    <Badge variant="outline" className="text-[9px] px-1.5 text-emerald-700 border-emerald-200 bg-emerald-50">
                      <Link2 className="w-2.5 h-2.5 mr-1" /> anchored at line {it.match.line}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[9px] px-1.5 text-amber-700 border-amber-200 bg-amber-50">
                      <Link2Off className="w-2.5 h-2.5 mr-1" /> not anchored — edit lines manually
                    </Badge>
                  )}
                  {!it.match && it.newCode && (
                    <details className="text-[10px] text-slate-400">
                      <summary className="cursor-pointer hover:text-slate-600 select-none">suggested fix</summary>
                      <pre className="mt-1 p-2 bg-slate-50 border border-slate-100 rounded font-mono text-[10px] whitespace-pre-wrap max-h-40 overflow-auto text-slate-600">
                        {it.newCode}
                      </pre>
                    </details>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Hunk header + expand-all */}
      <div className="flex items-center justify-between px-3 py-1 bg-slate-100/80 border-b border-slate-200 text-[11px] text-slate-500 gap-3">
        <span className="font-mono truncate">{hunk ?? `file window ${effWin.top}–${effWin.bottom}`}</span>
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-slate-400 hidden md:inline">click ✎ to edit a line · ＋ inserts below · × removes</span>
          <button className="text-[10px] underline hover:text-slate-700" onClick={() => ops.expandAll(file.path)}>
            Expand all
          </button>
        </div>
      </div>

      {/* Rows */}
      <div>
        {effWin.top > 1 && (
          <button
            className="w-full px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border-b border-slate-100 text-left text-[11px] text-slate-500"
            onClick={() => ops.setWindow(file.path, Math.max(1, effWin.top - 50), effWin.bottom)}
          >
            ⇧ Expand 50 lines above ({effWin.top - 1} hidden)
          </button>
        )}

        {rows.map((row, ri) => {
          const ek = editKeyOf(row);
          const editing = focus === ek;
          return (
            <DiffRow
              key={`${ek}-${ri}`}
              row={row}
              editing={editing}
              onEditCommit={(text) => {
                setFocus(null);
                if (row.type === "added") ops.editAdded(file.path, row.segId, row.i, text);
                if (row.type === "context") ops.editContext(file.path, row.segId, row.i, text);
              }}
              onEditCancel={() => setFocus(null)}
            >
              {!editing && (
                <RowCommands
                  onEdit={row.type === "removed" ? undefined : () => setFocus(ek)}
                  onInsert={
                    row.type === "context"
                      ? () => ops.insertAfterContext(file.path, row.segId, row.i)
                      : row.type === "added"
                        ? () => ops.insertAfterAdded(file.path, row.segId, row.i)
                        : undefined
                  }
                  onDelete={
                    row.type === "removed"
                      ? undefined
                      : row.type === "added"
                        ? () => ops.deleteAdded(file.path, row.segId, row.i)
                        : () => ops.deleteContext(file.path, row.segId, row.i)
                  }
                  onRestore={row.type === "removed" ? () => ops.restoreRemoved(file.path, row.segId, row.i) : undefined}
                />
              )}
            </DiffRow>
          );
        })}

        {effWin.bottom < file.totalLines && (
          <button
            className="w-full px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-left text-[11px] text-slate-500"
            onClick={() => ops.setWindow(file.path, effWin.top, Math.min(file.totalLines, effWin.bottom + 50))}
          >
            ⇩ Expand 50 lines below ({file.totalLines - effWin.bottom} hidden)
          </button>
        )}
      </div>

      {edits && (
        <div className="px-4 py-2 bg-indigo-50/40 border-t border-indigo-100 text-[11px] text-indigo-600 flex items-center justify-between">
          <span>This file will be committed with your reviewed edits when you create the PR.</span>
          <span className="font-bold">
            {added} new · {removed} removed
          </span>
        </div>
      )}

      {file.truncated && (
        <div className="px-4 py-2 bg-slate-50 text-[11px] text-slate-400 border-t border-slate-100">
          Preview truncated — showing the first {Math.min(file.totalLines, 1500)} of {file.totalLines} lines. Larger files cannot be edited past the preview window.
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Ops contract
// ---------------------------------------------------------------------------

interface FileOps {
  editAdded: (path: string, segId: string, i: number, text: string) => void;
  editContext: (path: string, segId: string, i: number, text: string) => void;
  deleteAdded: (path: string, segId: string, i: number) => void;
  deleteContext: (path: string, segId: string, i: number) => void;
  restoreRemoved: (path: string, segId: string, i: number) => void;
  insertAfterContext: (path: string, segId: string, i: number) => void;
  insertAfterAdded: (path: string, segId: string, i: number) => void;
  setWindow: (path: string, top: number, bottom: number) => void;
  expandAll: (path: string) => void;
  toggleViewed: (path: string) => void;
}

/** Split a context segment at line index i; `make` builds the replacing piece for that line (null = pure split). */
function splitContext(seg: ContextSeg, i: number, make: (line: string) => Seg | null): Seg[] {
  const parts: Seg[] = [];
  if (i > 0) parts.push({ kind: "context", id: i === 1 ? seg.id : uid(), startLine: seg.startLine, lines: seg.lines.slice(0, i) });
  const made = make(seg.lines[i]);
  if (made) parts.push(made);
  const afterStart = seg.startLine + i + 1;
  if (i + 1 < seg.lines.length) parts.push({ kind: "context", id: uid(), startLine: afterStart, lines: seg.lines.slice(i + 1) });
  return parts;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AuditEditPage() {
  const { owner = "", repo = "", auditId = "" } = useParams<{ owner: string; repo: string; auditId: string }>();
  const [, setLocation] = useLocation();
  const { data: audit, isLoading } = useAudit(auditId);
  const { data: preview, isLoading: isPreviewLoading } = useFixPreview<FixPreview | null>(
    auditId || undefined,
    owner || undefined,
    repo || undefined,
  );
  const updateItemMutation = useUpdateAuditItem(auditId);
  const applyContentsMutation = useApplyFixContents();
  const { toast } = useToast();

  const [files, setFiles] = useState<Record<string, FileState>>({});
  const [filter, setFilter] = useState<"all" | "edits">("all");
  const [focus, setFocus] = useState<string | null>(null);
  const restored = useRef(false);
  /** Signature of the preview build the current `files` were built from. */
  const builtKeyRef = useRef<string | null>(null);

  const branch = ((preview?.branch as string) || (audit as unknown as { branch?: string })?.branch || "main") as string;

  // ---- Build initial file states from preview ---------------------------------
  // Guarded: audit refetches (after item PATCHes) must NOT stomp in-progress edits.
  useEffect(() => {
    if (!preview || !audit?.items) return;
    const buildKey = `${auditId}:${Object.keys(preview.files).sort().join(",")}`;
    if (builtKeyRef.current === buildKey) return;
    builtKeyRef.current = buildKey;

    const itemContext = new Map((preview.items || []).map((p) => [p.itemId, p]));

    const perFileEdits = new Map<string, ItemEdit[]>();
    for (const item of audit.items as any[]) {
      const ctx = itemContext.get(String(item._id));
      // Only items with a COMPLETE fix (old + new code) auto-create the diff
      // edit. Items with old_code but no new_code (recovered anchors) stay
      // anchored for manual ✎ editing — auto-removing them would delete code.
      if (!ctx?.file || !item.old_code || !item.new_code || !ctx.match) continue;
      const edit: ItemEdit = {
        auditItemId: String(item._id),
        start: ctx.match.line,
        oldLen: Math.max(1, countLines(String(item.old_code))),
        newLines: String(item.new_code).split("\n"),
      };
      const arr = perFileEdits.get(ctx.file) ?? [];
      arr.push(edit);
      perFileEdits.set(ctx.file, arr);
    }

    const next: Record<string, FileState> = {};
    for (const [path, meta] of Object.entries(preview.files)) {
      const lines = meta.content.split("\n");
      const firstEdit = perFileEdits.get(path)?.[0];
      const win = firstEdit
        ? { top: Math.max(1, firstEdit.start - 40), bottom: Math.min(lines.length, firstEdit.start + 20) }
        : { top: 1, bottom: Math.min(lines.length, DEFAULT_WINDOW) };
      next[path] = {
        path,
        segments: buildSegments(lines, perFileEdits.get(path) ?? []),
        truncated: meta.truncated,
        totalLines: lines.length,
        viewed: false,
        winTop: win.top,
        winBottom: win.bottom,
        expandedAll: lines.length <= DEFAULT_WINDOW,
      };
    }
    setFiles(next);
  }, [preview, audit, auditId]);

  // ---- Draft restore (once) ---------------------------------------------------
  useEffect(() => {
    if (restored.current || Object.keys(files).length === 0) return;
    restored.current = true;
    try {
      const raw = localStorage.getItem(draftKey(auditId));
      if (!raw) return;
      const saved = JSON.parse(raw) as {
        files?: Record<string, { viewed?: boolean; segments?: Seg[]; winTop?: number; winBottom?: number; expandedAll?: boolean }>;
      };
      const savedFiles = saved?.files;
      if (!savedFiles) return;
      setFiles((prev) => {
        const merged: Record<string, FileState> = { ...prev };
        for (const [path, snap] of Object.entries(savedFiles)) {
          const base = prev[path];
          if (!base || !snap?.segments?.length) continue;
          merged[path] = {
            ...base,
            segments: snap.segments,
            viewed: !!snap.viewed,
            winTop: snap.winTop ?? base.winTop,
            winBottom: snap.winBottom ?? base.winBottom,
            expandedAll: !!snap.expandedAll,
          };
        }
        return merged;
      });
      toast({ title: "Draft restored", description: "Your previous inline edits were reloaded." });
    } catch {
      // malformed snapshot — ignore
    }
  }, [files, auditId, toast]);

  // ---- Segment ops (immutable) ------------------------------------------------
  const updateFile = useCallback((path: string, fn: (f: FileState) => FileState) => {
    setFiles((prev) => (prev[path] ? { ...prev, [path]: fn(prev[path]) } : prev));
  }, []);

  const withSeg = (f: FileState, segId: string, fn: (s: Seg) => Seg | Seg[] | null): FileState => ({
    ...f,
    segments: f.segments.flatMap((s) => {
      if (s.id !== segId) return [s];
      const res: Seg | Seg[] | null = fn(s);
      if (res === null) return [];
      return Array.isArray(res) ? res : [res];
    }),
  });

  const ops: FileOps = useMemo(
    () => ({
      editAdded: (path, segId, i, text) =>
        updateFile(path, (f) => {
          const target = f.segments.find((s) => s.id === segId);
          if (!target || target.kind !== "added" || target.lines[i] === text) return f;
          return withSeg(f, segId, (s) =>
            s.kind === "added" ? { ...s, lines: s.lines.map((l, k) => (k === i ? text : l)) } : s,
          );
        }),

      editContext: (path, segId, i, text) =>
        updateFile(path, (f) => {
          const target = f.segments.find((s) => s.id === segId);
          if (!target || target.kind !== "context" || target.lines[i] === text) return f;
          return withSeg(f, segId, (s) =>
            s.kind === "context"
              ? splitContext(s, i, () => ({ kind: "added", id: uid(), anchor: s.startLine + i - 1, lines: [text] }))
              : s,
          );
        }),

      deleteAdded: (path, segId, i) =>
        updateFile(path, (f) =>
          withSeg(f, segId, (s) => {
            if (s.kind !== "added") return s;
            const rest = s.lines.filter((_, k) => k !== i);
            return rest.length ? { ...s, lines: rest } : null; // drop empty added seg
          }),
        ),

      deleteContext: (path, segId, i) =>
        updateFile(path, (f) => {
          const target = f.segments.find((s) => s.id === segId);
          if (!target || target.kind !== "context") return f;
          return withSeg(f, segId, (s) =>
            s.kind === "context"
              ? splitContext(s, i, (line) => ({ kind: "removed", id: uid(), startLine: s.startLine + i, lines: [line] }))
              : s,
          );
        }),

      restoreRemoved: (path, segId, i) =>
        updateFile(path, (f) =>
          withSeg(f, segId, (s) => {
            if (s.kind !== "removed") return s;
            const parts: Seg[] = [];
            if (i > 0) parts.push({ kind: "removed", id: s.id, startLine: s.startLine, lines: s.lines.slice(0, i) });
            parts.push({ kind: "context", id: uid(), startLine: s.startLine + i, lines: [s.lines[i]] });
            if (i + 1 < s.lines.length)
              parts.push({ kind: "removed", id: uid(), startLine: s.startLine + i + 1, lines: s.lines.slice(i + 1) });
            return parts;
          }),
        ),

      insertAfterContext: (path, segId, i) =>
        updateFile(path, (f) => {
          const target = f.segments.find((s) => s.id === segId);
          if (!target || target.kind !== "context") return f;
          const anchor = target.startLine + i; // original line this inserts after
          return withSeg(f, segId, (s) =>
            s.kind === "context" ? splitContext(s, i, () => ({ kind: "added", id: uid(), anchor, lines: [""] })) : s,
          );
        }),

      insertAfterAdded: (path, segId, i) =>
        updateFile(path, (f) =>
          withSeg(f, segId, (s) => {
            if (s.kind !== "added") return s;
            const lines = [...s.lines];
            lines.splice(i + 1, 0, "");
            return { ...s, lines };
          }),
        ),

      setWindow: (path, top, bottom) => updateFile(path, (f) => ({ ...f, winTop: top, winBottom: bottom, expandedAll: false })),
      expandAll: (path) => updateFile(path, (f) => ({ ...f, expandedAll: true })),
      toggleViewed: (path) => updateFile(path, (f) => ({ ...f, viewed: !f.viewed })),
    }),
    [updateFile],
  );

  // ---- Items grouped per file --------------------------------------------------
  const fileItems = useMemo(() => {
    const map: Record<string, FileItemInfo[]> = {};
    if (!preview || !audit?.items) return map;
    const ctx = new Map((preview.items || []).map((p) => [p.itemId, p]));
    for (const item of audit.items as any[]) {
      const c = ctx.get(String(item._id));
      if (!c?.file) continue;
      (map[c.file] ??= []).push({
        itemId: String(item._id),
        label: item.label || "Issue",
        type: item.type,
        severity: item.severity,
        match: c.match,
        newCode: c.newCode,
      });
    }
    return map;
  }, [preview, audit]);

  const unlinkedItems = useMemo(() => {
    if (!preview || !audit?.items) return [] as { itemId: string; label: string; severity?: string }[];
    const linked = new Set((preview.items || []).filter((p) => p.file).map((p) => p.itemId));
    return (audit.items as any[])
      .filter((it) => !linked.has(String(it._id)))
      .map((it) => ({ itemId: String(it._id), label: it.label || "Issue", severity: it.severity }));
  }, [preview, audit]);

  const paths = useMemo(() => Object.keys(files).sort(), [files]);
  const changedPaths = useMemo(() => paths.filter((p) => hasRealEdits(files[p])), [paths, files]);
  const viewedCount = useMemo(() => paths.filter((p) => files[p].viewed).length, [paths, files]);
  const shownPaths = useMemo(() => (filter === "edits" ? changedPaths : paths), [filter, changedPaths, paths]);
  const totalAdded = useMemo(
    () => changedPaths.reduce((n, p) => n + countChanges(files[p]).added, 0),
    [changedPaths, files],
  );

  // Sidebar grouping (directory → files), Bitbucket tree style
  const groups = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const p of shownPaths) {
      const dir = p.includes("/") ? p.slice(0, p.lastIndexOf("/")) : ".";
      const list = map.get(dir) ?? [];
      list.push(p);
      map.set(dir, list);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [shownPaths]);

  // ---- Actions -----------------------------------------------------------------
  const saveDraft = useCallback(async () => {
    try {
      // Sync refined AI suggestions back to the audit items (server-side draft).
      const ctx = new Map((preview?.items || []).map((p) => [p.itemId, p]));
      for (const item of (audit?.items ?? []) as any[]) {
        const c = ctx.get(String(item._id));
        if (!c?.file || !c.match || !item.old_code) continue;
        const f = files[c.file];
        if (!f || !hasRealEdits(f)) continue;

        const itemStart = c.match.line;
        const itemEnd = itemStart + Math.max(1, countLines(String(item.old_code))) - 1;
        const lines: string[] = [];
        for (const seg of f.segments) {
          if (seg.kind !== "added") continue;
          const anchor = Math.max(0, seg.anchor);
          if (anchor >= itemStart - 1 && anchor <= itemEnd) lines.push(...seg.lines);
        }
        if (lines.length) await updateItemMutation.mutateAsync({ id: String(item._id), new_code: lines.join("\n") });
      }

      // Full inline edits stay in a local draft
      localStorage.setItem(
        draftKey(auditId),
        JSON.stringify({
          files: Object.fromEntries(
            Object.entries(files).map(([p, f]) => [
              p,
              { viewed: f.viewed, segments: f.segments, winTop: f.winTop, winBottom: f.winBottom, expandedAll: f.expandedAll },
            ]),
          ),
        }),
      );
      toast({
        title: "Draft saved",
        description: changedPaths.length ? `${changedPaths.length} edited file(s) kept in your local draft.` : "Draft saved.",
      });
    } catch (err) {
      toast({
        title: "Draft error",
        description: err instanceof Error ? err.message : "Could not save draft",
        variant: "destructive",
      });
    }
  }, [audit, preview, files, auditId, changedPaths.length, toast, updateItemMutation]);

  const createPR = useCallback(() => {
    if (changedPaths.length === 0) {
      toast({ title: "No Changes", description: "Edit at least one line before creating the PR." });
      return;
    }
    const payloadFiles: Record<string, string> = {};
    for (const p of changedPaths) {
      const nextContent = buildNewContent(files[p]);
      const origContent = preview?.files?.[p]?.content ?? "";
      if (nextContent !== origContent) payloadFiles[p] = nextContent;
    }
    if (Object.keys(payloadFiles).length === 0) {
      toast({ title: "No Changes", description: "Edited content matches the original — nothing to commit." });
      return;
    }

    applyContentsMutation.mutate(
      {
        owner,
        repo,
        files: payloadFiles,
        targetBranch: branch,
        title: `AuditPilot: reviewed fixes for ${repo}`,
      },
      {
        onSuccess: (data: any) => {
          localStorage.removeItem(draftKey(auditId));
          const url = data.prUrl ? `?url=${encodeURIComponent(data.prUrl)}` : "";
          setLocation(`/app/audit/${owner}/${repo}/success/${data.prNumber}${url}`);
        },
      },
    );
  }, [applyContentsMutation, auditId, branch, changedPaths, files, owner, preview, repo, setLocation, toast]);

  const scrollTo = (path: string) => {
    document.getElementById(`file-${path}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  if (isLoading || !audit) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  const isCreating = applyContentsMutation.isPending;

  return (
    <DashboardLayout>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-7xl mx-auto pb-28">
        {/* ── Header ──────────────────────────────────────────────────── */}
        <div className="px-4 pt-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setLocation(`/app/audit/${owner}/${repo}/results/${auditId}`)}
                className="px-2 h-7 text-sm text-slate-500 hover:text-slate-800"
              >
                <ArrowLeft className="w-4 h-4 mr-1.5" /> Back to report
              </Button>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <div className="w-8 h-8 rounded-md bg-indigo-600 flex items-center justify-center text-xs font-bold text-white">
                  {(repo || owner || "?").slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <h1 className="text-lg font-bold text-slate-900 truncate">Review &amp; edit fixes — {owner}/{repo}</h1>
                  <p className="text-xs text-slate-500">
                    Branch <span className="font-mono font-semibold">{branch}</span>
                    {isPreviewLoading ? " · loading preview…" : ` · ${paths.length} audited file(s)`}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button variant="outline" size="sm" onClick={saveDraft} className="border-slate-200 text-slate-600 h-9">
                <Save className="w-4 h-4 mr-1.5" /> Save draft
              </Button>
              <Button
                onClick={createPR}
                disabled={isCreating || isPreviewLoading}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-9"
              >
                {isCreating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Zap className="w-4 h-4 mr-2 fill-current" />}
                Finalize &amp; Create PR
              </Button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-6 mt-4 border-b border-slate-200 text-sm">
            <button
              className="pb-2 text-slate-500 hover:text-slate-800 font-medium"
              onClick={() => setLocation(`/app/audit/${owner}/${repo}/results/${auditId}`)}
            >
              Overview
            </button>
            <div className="pb-2 border-b-2 border-indigo-600 font-semibold text-slate-900 flex items-center gap-2">
              Files changed
              <span className="text-[11px] bg-slate-100 rounded px-1.5 py-0.5 font-bold text-slate-600">{paths.length}</span>
            </div>
            <span className="pb-2 text-slate-300 cursor-not-allowed" title="Commits appear after the PR is created">
              Commits
            </span>
          </div>

          {/* Toolbar */}
          <div className="flex items-center justify-between gap-3 mt-3">
            <div className="flex items-center gap-2">
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value as typeof filter)}
                className="h-8 text-xs rounded-lg border border-slate-200 bg-white px-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              >
                <option value="all">All changes</option>
                <option value="edits">Edits only ({changedPaths.length})</option>
              </select>
              {totalAdded > 0 && (
                <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-50 px-2 text-[11px]">
                  +{totalAdded} line(s) added
                </Badge>
              )}
            </div>
            <span className="text-[11px] text-slate-400">
              {viewedCount} of {paths.length} files viewed
            </span>
          </div>
        </div>

        {/* ── Body: sidebar + diff area ───────────────────────────────── */}
        <div className="flex gap-4 px-4 mt-3">
          {/* Sidebar */}
          <aside className="hidden lg:block w-72 shrink-0">
            <div className="sticky top-6 rounded-xl border border-slate-200 bg-white overflow-hidden">
              <div className="px-3 py-2.5 flex items-center justify-between border-b border-slate-100">
                <span className="text-xs font-bold text-slate-700">Lines updated</span>
                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 rounded-full px-1.5 py-0.5">+{totalAdded}</span>
              </div>
              <div className="max-h-[70vh] overflow-auto py-1">
                {groups.map(([dir, list]) => (
                  <div key={dir} className="px-3 py-1">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide truncate" title={dir}>
                      {dir}
                    </p>
                    {list.map((p) => {
                      const c = countChanges(files[p]);
                      const name = p.includes("/") ? p.slice(p.lastIndexOf("/") + 1) : p;
                      const changed = hasRealEdits(files[p]);
                      return (
                        <button
                          key={p}
                          onClick={() => scrollTo(p)}
                          className={`w-full text-left flex items-center justify-between gap-2 px-1 py-1.5 rounded-md text-xs hover:bg-slate-50 ${
                            changed ? "text-slate-900" : "text-slate-500"
                          }`}
                        >
                          <span
                            className={`truncate rounded px-1.5 py-0.5 ${changed ? "bg-indigo-50 ring-1 ring-indigo-100" : ""}`}
                            title={p}
                          >
                            {name}
                          </span>
                          <span className="flex items-center gap-1.5 shrink-0 font-mono text-[10px] font-bold">
                            {c.added > 0 && <span className="text-emerald-600">+{c.added}</span>}
                            {c.removed > 0 && <span className="text-rose-500">−{c.removed}</span>}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ))}
                {shownPaths.length === 0 && <p className="px-3 py-6 text-center text-xs text-slate-400">No files match this filter</p>}
              </div>
            </div>
          </aside>

          {/* Diff list */}
          <main className="flex-1 min-w-0 space-y-5">
            {isPreviewLoading && (
              <div className="py-24 flex flex-col items-center gap-3 text-slate-400">
                <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
                <span className="text-sm">Fetching live file contents…</span>
              </div>
            )}

            {!isPreviewLoading && shownPaths.length === 0 && (
              <div className="rounded-xl border border-slate-200 bg-white p-12 text-center">
                <AlertCircle className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <p className="text-sm font-semibold text-slate-600">No audited files resolved to a real path.</p>
                <p className="text-xs text-slate-400 mt-1">
                  Findings without a resolvable file are listed below for manual review — re-run the audit to capture file paths.
                </p>
              </div>
            )}

            {shownPaths.map((p) => (
              <FileDiffCard key={p} file={files[p]} items={fileItems[p] ?? []} focus={focus} setFocus={setFocus} ops={ops} />
            ))}

            {/* Unlinked findings */}
            {unlinkedItems.length > 0 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-4">
                <p className="text-xs font-bold text-amber-700 uppercase tracking-wide flex items-center gap-2">
                  <Link2Off className="w-3.5 h-3.5" /> Not linked to a file ({unlinkedItems.length})
                </p>
                <ul className="mt-2 space-y-2">
                  {unlinkedItems.map((it) => (
                    <li key={it.itemId} className="text-xs text-slate-600 flex items-start gap-2">
                      <AlertCircle className="w-3.5 h-3.5 mt-0.5 text-amber-500 shrink-0" />
                      <span className="flex-1">{it.label}</span>
                      <Badge variant="outline" className={`text-[9px] shrink-0 ${severityBadgeClass(it.severity)}`}>
                        {it.severity || "medium"}
                      </Badge>
                    </li>
                  ))}
                </ul>
                <p className="text-[11px] text-amber-600/80 mt-2">
                  These findings had no resolvable repository path — review them manually on GitHub.
                </p>
              </div>
            )}
          </main>
        </div>

        {/* Sticky create bar */}
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40">
          <Button
            onClick={createPR}
            disabled={isCreating}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 h-12 text-base font-bold rounded-full border-4 border-white shadow-2xl shadow-indigo-500/25 disabled:opacity-60"
          >
            {isCreating ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Check className="w-5 h-5 mr-2" />}
            Create PR with {changedPaths.length} edited file{changedPaths.length === 1 ? "" : "s"}
          </Button>
        </div>
      </motion.div>
    </DashboardLayout>
  );
}
