import { FileCode2, GitPullRequest, History, Loader2, Plus, Trash2 } from "lucide-react";
import type { DraftRecord, HistoryRecord } from "./types";

function timeAgo(date?: string) {
  if (!date) return "";
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.round(diff / 60000);
  if (Number.isNaN(mins) || date === new Date(date).toISOString() && mins > 60 * 24 * 365) return "";
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

function SectionLoading() {
  return (
    <div className="px-3 py-6 flex items-center justify-center gap-2 text-xs text-slate-500">
      <Loader2 className="w-3.5 h-3.5 animate-spin" /> loading…
    </div>
  );
}

interface SidebarProps {
  drafts: DraftRecord[] | undefined;
  isLoadingDrafts: boolean;
  history: HistoryRecord[] | undefined;
  isLoadingHistory: boolean;
  selectedDraftId?: string;
  onSelectDraft: (draft: DraftRecord) => void;
  onNewDraft: () => void;
  onDeleteDraft: (id: string) => void;
  onSelectHistory: (entry: HistoryRecord) => void;
}

/** Left rail: clickable "Saved Drafts" + "Audit History" lists. */
export default function Sidebar({
  drafts,
  isLoadingDrafts,
  history,
  isLoadingHistory,
  selectedDraftId,
  onSelectDraft,
  onNewDraft,
  onDeleteDraft,
  onSelectHistory,
}: SidebarProps) {
  return (
    <aside className="w-full lg:w-[340px] shrink-0 flex flex-col gap-5">
      {/* Saved drafts */}
      <div className="rounded-2xl border border-gray-700/70 bg-[#121212] overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700/60">
          <span className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-slate-400">
            <FileCode2 className="w-3.5 h-3.5 text-indigo-400" /> Saved Drafts
            <span className="text-[10px] font-bold text-slate-500 bg-white/[0.06] rounded-full px-1.5 py-0.5">
              {drafts?.length ?? 0}
            </span>
          </span>
          <button
            onClick={onNewDraft}
            title="New draft"
            className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-300 hover:bg-indigo-500/10 transition-colors"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
        <div className="max-h-[34vh] lg:max-h-[40vh] overflow-y-auto py-1.5">
          {isLoadingDrafts && <SectionLoading />}
          {!isLoadingDrafts && (drafts?.length ?? 0) === 0 && (
            <p className="px-4 py-5 text-xs text-slate-500">
              No drafts yet. Write your PR description and hit <span className="text-slate-300 font-semibold">Save Draft</span>.
            </p>
          )}
          {drafts?.map((d) => (
            <button
              key={d._id}
              onClick={() => onSelectDraft(d)}
              className={`group w-full text-left px-4 py-2.5 flex items-start justify-between gap-2 border-l-2 transition-colors ${
                selectedDraftId === d._id
                  ? "border-indigo-500 bg-indigo-500/[0.08]"
                  : "border-transparent hover:bg-white/[0.03]"
              }`}
            >
              <span className="min-w-0">
                <span className={`block text-[13px] font-semibold truncate ${selectedDraftId === d._id ? "text-indigo-200" : "text-slate-200"}`}>
                  {d.title || "Untitled draft"}
                </span>
                <span className="mt-0.5 flex items-center gap-2 text-[10px] text-slate-500">
                  <span>{timeAgo(d.updatedAt || d.createdAt)}</span>
                  <span className="bg-white/[0.06] text-slate-400 rounded-full px-1.5 py-0.5">
                    {d.filesChanged?.length ?? 0} file(s)
                  </span>
                  {d.prUrl && <span className="text-emerald-400/90">PR ✔</span>}
                </span>
              </span>
              <span
                role="button"
                tabIndex={-1}
                className="opacity-0 group-hover:opacity-100 p-1 rounded-md text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-all"
                onClick={(e) => {
                  e.stopPropagation();
                  if (d._id) onDeleteDraft(d._id);
                }}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Audit history */}
      <div className="rounded-2xl border border-gray-700/70 bg-[#121212] overflow-hidden">
        <div className="flex items-center px-4 py-3 border-b border-gray-700/60">
          <span className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-slate-400">
            <History className="w-3.5 h-3.5 text-violet-400" /> Audit History
            <span className="text-[10px] font-bold text-slate-500 bg-white/[0.06] rounded-full px-1.5 py-0.5">
              {history?.length ?? 0}
            </span>
          </span>
        </div>
        <div className="max-h-[38vh] lg:max-h-[46vh] overflow-y-auto py-1.5">
          {isLoadingHistory && <SectionLoading />}
          {!isLoadingHistory && (history?.length ?? 0) === 0 && (
            <p className="px-4 py-5 text-xs text-slate-500">
              No audit records yet. <span className="text-slate-400">Finalize &amp; Create PR</span> records a full audit trail here.
            </p>
          )}
          {history?.map((h) => (
            <button
              key={h._id}
              onClick={() => onSelectHistory(h)}
              className="group w-full text-left px-4 py-2.5 flex items-start gap-2.5 border-l-2 border-transparent hover:border-violet-500 hover:bg-violet-500/[0.06] transition-colors"
            >
              <span className="mt-0.5 p-1 rounded-md bg-violet-500/10 text-violet-300 shrink-0">
                <GitPullRequest className="w-3.5 h-3.5" />
              </span>
              <span className="min-w-0">
                <span className="block text-[13px] font-semibold text-slate-200 truncate">{h.aiFixSummary || "AI fix"}</span>
                <span className="mt-0.5 flex items-center gap-2 text-[10px] text-slate-500">
                  <span className="font-mono text-violet-300/90">{h.prId ? `PR #${h.prId}` : "record"}</span>
                  <span className="bg-white/[0.06] text-slate-400 rounded-full px-1.5 py-0.5">
                    {h.changes?.length ?? 0} change(s)
                  </span>
                  <span>{timeAgo(h.createdAt)}</span>
                </span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </aside>
  );
}
