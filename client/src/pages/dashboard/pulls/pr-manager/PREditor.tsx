import { useState } from "react";
import {
  Bot,
  ChevronDown,
  FileCode2,
  GitPullRequest,
  Loader2,
  Plus,
  Save,
  Trash2,
  Zap,
} from "lucide-react";
import type { DraftFile, DraftRecord } from "./types";
import { fileStatus } from "./types";

interface PREditorProps {
  draft: DraftRecord;
  onChange: (patch: Partial<DraftRecord>) => void;
  onSaveDraft: () => void;
  saving: boolean;
  onFinalize: () => void;
  finalizing: boolean;
}

const statusChip: Record<string, string> = {
  pending: "bg-slate-500/10 text-slate-400 border-slate-500/30",
  edited: "bg-indigo-500/10 text-indigo-300 border-indigo-500/30",
  committed: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
};

/** Right pane: PR metadata editor with Save Draft + Finalize actions. */
export default function PREditor({
  draft,
  onChange,
  onSaveDraft,
  saving,
  onFinalize,
  finalizing,
}: PREditorProps) {
  const [openFile, setOpenFile] = useState<number | null>(0);
  const files = draft.filesChanged;

  const patchFile = (idx: number, patch: Partial<DraftFile>) =>
    onChange({
      filesChanged: files.map((f, i) => (i === idx ? { ...f, ...patch } : f)),
    });

  return (
    <section className="flex-1 min-w-0 rounded-2xl border border-gray-700/70 bg-[#121212] overflow-hidden flex flex-col">
      {/* Header */}
      <div className="px-6 pt-5 pb-4 border-b border-gray-700/60">
        <div className="flex items-center gap-2">
          <span className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-300">
            <GitPullRequest className="w-4 h-4" />
          </span>
          <h2 className="text-sm font-bold tracking-wide text-slate-100 uppercase">
            {draft._id ? "Editing draft" : "New pull request draft"}
          </h2>
          {draft.prUrl && (
            <a
              href={draft.prUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto text-[11px] text-emerald-300/90 hover:text-emerald-200 underline"
            >
              view PR ↗
            </a>
          )}
        </div>

        {/* Repo context — where the PR is opened */}
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-[1fr_1fr_150px] gap-2.5">
          {(["owner", "repo", "targetBranch"] as const).map((key) => (
            <input
              key={key}
              value={draft[key] ?? ""}
              onChange={(e) => onChange({ [key]: e.target.value } as Partial<DraftRecord>)}
              placeholder={key === "owner" ? "owner" : key === "repo" ? "repo" : "base branch"}
              spellCheck={false}
              className="h-9 rounded-lg bg-[#0d0d0e] border border-gray-700 px-3 text-xs font-mono text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/60 focus:ring-2 focus:ring-indigo-500/20 transition"
            />
          ))}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
        {/* Title */}
        <div>
          <label className="text-[11px] font-bold uppercase tracking-widest text-slate-500">Title</label>
          <input
            value={draft.title}
            onChange={(e) => onChange({ title: e.target.value })}
            placeholder="Add a title — e.g. Fix hardcoded Binance credentials"
            className="mt-1.5 w-full h-10 rounded-xl bg-[#0d0d0e] border border-gray-700 px-4 text-sm font-semibold text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/60 focus:ring-2 focus:ring-indigo-500/20 transition"
          />
        </div>

        {/* Description */}
        <div>
          <label className="text-[11px] font-bold uppercase tracking-widest text-slate-500">Description</label>
          <textarea
            value={draft.description}
            onChange={(e) => onChange({ description: e.target.value })}
            rows={7}
            placeholder="Describe the changes, the risks addressed, and how to review them…"
            className="mt-1.5 w-full rounded-xl bg-[#0d0d0e] border border-gray-700 px-4 py-3 text-sm leading-relaxed text-slate-200 placeholder:text-slate-600 resize-y focus:outline-none focus:border-indigo-500/60 focus:ring-2 focus:ring-indigo-500/20 transition"
          />
        </div>

        {/* Files changed */}
        <div className="rounded-xl border border-gray-700/70 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 bg-white/[0.02] border-b border-gray-700/60">
            <span className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-slate-400">
              <FileCode2 className="w-3.5 h-3.5" /> Files changed
              <span className="text-[10px] bg-white/[0.06] rounded-full px-1.5 py-0.5 text-slate-400">{files.length}</span>
            </span>
            <button
              onClick={() =>
                onChange({
                  filesChanged: [...files, { fileName: "", oldCode: "", newCode: "", status: "pending" }],
                })
              }
              className="flex items-center gap-1 text-[11px] font-semibold text-indigo-300 hover:text-indigo-200"
            >
              <Plus className="w-3.5 h-3.5" /> Add file change
            </button>
          </div>

          {files.length === 0 && (
            <p className="px-4 py-5 text-xs text-slate-500">
              Add a file change to capture before/after snippets — they become the PR's committed diffs.
            </p>
          )}

          {files.map((f, i) => {
            const isOpen = openFile === i;
            return (
              <div key={i} className="border-b border-gray-700/50 last:border-b-0">
                <div className="flex items-center gap-2 px-3 py-2">
                  <button
                    onClick={() => setOpenFile(isOpen ? null : i)}
                    className="flex items-center gap-1.5 min-w-0 flex-1 text-left"
                  >
                    <ChevronDown className={`w-3.5 h-3.5 text-slate-500 transition-transform ${isOpen ? "" : "-rotate-90"}`} />
                    <span className="truncate text-xs font-mono text-slate-300">
                      {f.fileName || "(new file change)"}
                    </span>
                  </button>
                  <span className={`shrink-0 text-[9px] font-bold uppercase border rounded-full px-2 py-0.5 ${statusChip[fileStatus(f)] ?? statusChip.pending}`}>
                    {fileStatus(f)}
                  </span>
                  <button
                    onClick={() => onChange({ filesChanged: files.filter((_, k) => k !== i) })}
                    className="p-1 text-slate-500 hover:text-rose-400 rounded-md hover:bg-rose-500/10 shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                {isOpen && (
                  <div className="px-3 pb-3 space-y-2.5">
                    <input
                      value={f.fileName}
                      onChange={(e) => patchFile(i, { fileName: e.target.value })}
                      placeholder="src/path/file.ts"
                      spellCheck={false}
                      className="w-full h-8 rounded-lg bg-[#0d0d0e] border border-gray-700 px-3 text-xs font-mono text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/60"
                    />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                      <div>
                        <span className="text-[9px] font-bold uppercase tracking-widest text-rose-400/80">− Before</span>
                        <textarea
                          value={f.oldCode}
                          onChange={(e) => patchFile(i, { oldCode: e.target.value })}
                          rows={4}
                          spellCheck={false}
                          className="mt-1 w-full rounded-lg bg-[#0d0d0e] border border-rose-500/20 px-3 py-2 font-mono text-[11px] text-rose-200/90 placeholder:text-slate-600 focus:outline-none focus:border-rose-500/50 resize-y"
                        />
                      </div>
                      <div>
                        <span className="text-[9px] font-bold uppercase tracking-widest text-emerald-400/80">+ After</span>
                        <textarea
                          value={f.newCode}
                          onChange={(e) => patchFile(i, { newCode: e.target.value, status: "edited" })}
                          rows={4}
                          spellCheck={false}
                          className="mt-1 w-full rounded-lg bg-[#0d0d0e] border border-emerald-500/20 px-3 py-2 font-mono text-[11px] text-emerald-200/90 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/50 resize-y"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Action bar */}
      <div className="px-6 py-4 border-t border-gray-700/60 bg-white/[0.02] flex items-center justify-between gap-3 flex-wrap">
        <button
          onClick={onSaveDraft}
          disabled={saving || !draft.title.trim()}
          className="flex items-center gap-2 h-10 px-4 rounded-xl border border-gray-700 text-sm font-semibold text-slate-200 hover:bg-white/[0.05] hover:border-gray-600 disabled:opacity-40 disabled:cursor-not-allowed transition"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save Draft
        </button>
        <div className="flex items-center gap-2 text-[10px] text-slate-600">
          <Bot className="w-3.5 h-3.5" />
          Finalize commits each before→after pair to a fresh branch
        </div>
        <button
          onClick={onFinalize}
          disabled={finalizing || !draft.title.trim()}
          className="flex items-center gap-2 h-10 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold shadow-lg shadow-indigo-950/60 disabled:opacity-40 disabled:cursor-not-allowed transition"
        >
          {finalizing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4 fill-current" />}
          Finalize &amp; Create PR
        </button>
      </div>
    </section>
  );
}
