import { AlertCircle, GitPullRequest, Minus, Plus, Sparkles } from "lucide-react";
import type { HistoryChange, HistoryRecord } from "./types";

const splitLines = (code?: string): string[] => ((code ?? "") === "" ? [] : (code as string).split("\n"));

/** L12–L15 badge (falls back to per-snippet line counts). */
function LineBadge({ change }: { change: HistoryChange }) {
  const nums = change.lineNumbers ?? [];
  if (nums.length > 0) {
    const first = Math.min(...nums);
    const last = Math.max(...nums);
    return (
      <span className="text-[10px] font-mono font-bold text-slate-300 bg-white/[0.06] border border-gray-700 rounded-full px-2 py-0.5">
        {first === last ? `L${first}` : `L${first}–L${last}`}
      </span>
    );
  }
  const oldN = splitLines(change.oldCode).length;
  const newN = splitLines(change.newCode).length;
  return (
    <span className="text-[10px] font-mono font-bold text-slate-300 bg-white/[0.06] border border-gray-700 rounded-full px-2 py-0.5">
      −{oldN} · +{newN} lines
    </span>
  );
}

function DiffFile({ change }: { change: HistoryChange }) {
  const oldLines = splitLines(change.oldCode);
  const newLines = splitLines(change.newCode);
  const rows = Math.max(oldLines.length, newLines.length);

  return (
    <div className="rounded-xl border border-gray-700/70 overflow-hidden">
      {/* File header */}
      <div className="flex items-center justify-between gap-3 px-4 py-2 bg-white/[0.03] border-b border-gray-700/60">
        <span className="flex items-center gap-1.5 min-w-0 font-mono text-[13px]">
          {change.fileName.split("/").map((part, i, arr) => (
            <span key={i} className="truncate">
              <span className={i === arr.length - 1 ? "font-bold text-slate-100" : "text-slate-500"}>
                {part}
              </span>
              {i < arr.length - 1 && <span className="text-slate-600"> / </span>}
            </span>
          ))}
        </span>
        <LineBadge change={change} />
      </div>

      {/* Split diff */}
      <div className="grid grid-cols-2">
        <div className="flex items-center gap-1.5 px-3 py-1 bg-rose-950/40 text-[10px] font-bold uppercase tracking-widest text-rose-300/90 border-b border-rose-500/20">
          <Minus className="w-3 h-3" /> Deleted lines
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-950/40 text-[10px] font-bold uppercase tracking-widest text-emerald-300/90 border-b border-emerald-500/20">
          <Plus className="w-3 h-3" /> Added lines
        </div>
      </div>
      <div className="grid grid-cols-2 font-mono text-[11px] leading-5">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="contents">
            <div className="px-3 py-0.5 whitespace-pre-wrap break-all text-rose-200/90 bg-rose-500/[0.05] border-b border-rose-500/10 border-r border-black/40 min-h-[18px]">
              {oldLines[i] ?? ""}
            </div>
            <div className="px-3 py-0.5 whitespace-pre-wrap break-all text-emerald-100 bg-emerald-500/[0.05] border-b border-emerald-500/10 min-h-[18px]">
              {newLines[i] ?? ""}
            </div>
          </div>
        ))}
      </div>
      {rows === 0 && (
        <p className="px-4 py-3 text-xs text-slate-500">Empty change — no code captured.</p>
      )}
    </div>
  );
}

/**
 * Full audit diff: AI fix summary + one split view per changed file.
 * `audit` is owned by the parent — it always reflects the LAST item clicked,
 * and the parent remounts this viewer by key so there is never stale code.
 */
export default function AuditDiffViewer({ audit }: { audit: HistoryRecord }) {
  const changes = audit.changes ?? [];

  return (
    <div className="p-6 space-y-5">
      {/* AI fix summary */}
      <div className="rounded-xl border border-violet-500/25 bg-violet-500/[0.06] px-4 py-3.5">
        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-violet-300">
          <Sparkles className="w-3.5 h-3.5" /> AI Fix Summary
        </div>
        <p className="mt-1.5 text-sm leading-relaxed text-slate-200">{audit.aiFixSummary || "No summary recorded."}</p>
      </div>

      {/* PR context */}
      <div className="flex items-center gap-2 flex-wrap text-xs">
        {audit.prId ? (
          <span className="flex items-center gap-1.5 rounded-full border border-gray-700 bg-white/[0.03] px-3 py-1 text-slate-300">
            <GitPullRequest className="w-3.5 h-3.5 text-indigo-300" />
            Pull Request #{audit.prId}
          </span>
        ) : (
          <span className="flex items-center gap-1.5 rounded-full border border-gray-700 bg-white/[0.03] px-3 py-1 text-slate-400">
            <AlertCircle className="w-3.5 h-3.5" />
            not PR-linked
          </span>
        )}
        {audit.prUrl && (
          <a
            href={audit.prUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-indigo-300 hover:text-indigo-200 underline"
          >
            open on GitHub ↗
          </a>
        )}
        <span className="text-slate-600">{changes.length} file change(s)</span>
      </div>

      {/* Changes */}
      {changes.length === 0 ? (
        <p className="rounded-xl border border-gray-700/70 bg-white/[0.02] px-4 py-6 text-center text-xs text-slate-500">
          No code changes were recorded for this entry.
        </p>
      ) : (
        <div className="space-y-4">
          {changes.map((c, i) => (
            <DiffFile key={`${c.fileName}-${i}`} change={c} />
          ))}
        </div>
      )}
    </div>
  );
}
