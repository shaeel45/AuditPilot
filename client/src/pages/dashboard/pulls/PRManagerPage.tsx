import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Zap } from "lucide-react";
import { useLocation } from "wouter";
import Sidebar from "./pr-manager/Sidebar";
import PREditor from "./pr-manager/PREditor";
import Modal from "./pr-manager/Modal";
import AuditDiffViewer from "./pr-manager/AuditDiffViewer";
import { blankDraft } from "./pr-manager/types";
import type { DraftRecord, HistoryRecord } from "./pr-manager/types";
import {
  useAuditHistory,
  useCreateAuditHistory,
  useDeleteDraft,
  useDrafts,
  useRepoFix,
  useSaveDraft,
} from "@/hooks/use-pr-manager";
import { useToast } from "@/hooks/use-toast";

/**
 * PR Manager — dark two-pane workspace.
 * The parent owns `editing` (the draft being composed) and `selectedAudit`
 * (the audit-history item behind the diff modal). Clicking a sidebar item
 * sets state from already-fetched data, so content renders on the FIRST
 * paint — no per-click fetching, no stale rendering.
 */
export default function PRManagerPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data: drafts, isLoading: isLoadingDrafts } = useDrafts();
  const { data: history, isLoading: isLoadingHistory } = useAuditHistory();
  const saveDraftMutation = useSaveDraft();
  const deleteDraftMutation = useDeleteDraft();
  const createHistoryMutation = useCreateAuditHistory();
  const repoFixMutation = useRepoFix();

  // ---- parent-level state -----------------------------------------------------
  const [editing, setEditing] = useState<DraftRecord>(blankDraft);
  const [selectedAudit, setSelectedAudit] = useState<HistoryRecord | null>(null);

  const change = (patch: Partial<DraftRecord>) => setEditing((prev) => ({ ...prev, ...patch }));

  const selectDraft = (draft: DraftRecord) => {
    // clone — sidebar clicks must never mutate the cached list
    setEditing({
      _id: draft._id,
      title: draft.title,
      description: draft.description ?? "",
      filesChanged: (draft.filesChanged ?? []).map((f) => ({ ...f })),
      owner: draft.owner,
      repo: draft.repo,
      targetBranch: draft.targetBranch,
      prUrl: draft.prUrl,
    });
  };

  const newDraft = () => setEditing(blankDraft());

  const openAudit = (entry: HistoryRecord) => {
    // State lives here at the parent level: the modal re-mounts (keyed by _id)
    // and always receives the latest clicked data — never blank or stale code.
    setSelectedAudit(entry);
  };

  // ---- actions -----------------------------------------------------------------
  const saveDraft = () => {
    saveDraftMutation.mutate(
      {
        _id: editing._id,
        title: editing.title.trim(),
        description: editing.description,
        filesChanged: editing.filesChanged,
        owner: editing.owner,
        repo: editing.repo,
        targetBranch: editing.targetBranch,
      },
      {
        onSuccess: (saved: { _id: string }) => setEditing((prev) => ({ ...prev, _id: saved._id })),
      },
    );
  };

  const deleteDraft = (id: string) => {
    deleteDraftMutation.mutate(id, {
      onSuccess: () => {
        if (editing._id === id) setEditing(blankDraft());
      },
    });
  };

  const finalize = () => {
    const owner = editing.owner?.trim();
    const repo = editing.repo?.trim();
    const targetBranch = editing.targetBranch?.trim();
    if (!owner || !repo || !targetBranch) {
      toast({
        title: "Repository context missing",
        description: "Fill in owner, repo and the base branch above Finalize.",
        variant: "destructive",
      });
      return;
    }
    const issues = editing.filesChanged
      .filter((f) => f.fileName.trim() && f.newCode.trim())
      .map((f) => ({ file: f.fileName.trim(), old_code: f.oldCode, new_code: f.newCode }));

    if (issues.length === 0) {
      toast({
        title: "No changes to commit",
        description: "Add at least one file change with After-code before finalizing.",
        variant: "destructive",
      });
      return;
    }

    repoFixMutation.mutate(
      { owner, repo, targetBranch, issues },
      {
        onSuccess: async (resp) => {
          const changes = editing.filesChanged.map((f) => ({
            fileName: f.fileName,
            lineNumbers: [],
            oldCode: f.oldCode,
            newCode: f.newCode,
          }));
          if (changes.length === 0) {
            toast({ title: "PR created, but nothing was changed", description: resp.prUrl });
            return;
          }
          // Record the audit trail, then open its diff modal immediately.
          const entry: HistoryRecord = {
            prId: String(resp.prNumber ?? ""),
            prUrl: resp.prUrl,
            aiFixSummary: editing.description?.trim() || editing.title.trim(),
            changes,
          };
          const saved = await createHistoryMutation.mutateAsync(entry);
          setEditing((prev) => ({
            ...prev,
            prUrl: resp.prUrl,
            filesChanged: prev.filesChanged.map((f) => ({ ...f, status: "committed" })),
          }));
          if (editing._id) {
            // Best-effort draft sync — UI already reflects success above.
            saveDraftMutation
              .mutateAsync({
                _id: editing._id,
                title: editing.title.trim(),
                description: editing.description,
                filesChanged: editing.filesChanged.map((f) => ({ ...f, status: "committed" })),
                owner: editing.owner,
                repo: editing.repo,
                targetBranch: editing.targetBranch,
                prUrl: resp.prUrl,
              })
              .catch(() => undefined);
          }
          setSelectedAudit(saved as unknown as HistoryRecord);
          toast({
            title: `Pull Request #${resp.prNumber} created`,
            description: `Audit recorded with ${changes.length} file change(s).`,
          });
        },
      },
    );
  };

  const finalizing = repoFixMutation.isPending || createHistoryMutation.isPending;

  return (
    <div className="min-h-screen bg-[#0b0b0c] text-slate-100 selection:bg-indigo-500/40">
      {/* Top bar */}
      <div className="sticky top-0 z-30 border-b border-gray-700/60 bg-[#0d0d0f]/80 backdrop-blur">
        <div className="max-w-[1500px] mx-auto px-6 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setLocation("/app/pulls")}
              className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-slate-100 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" /> Pull Requests
            </button>
            <span className="h-4 w-px bg-gray-700" />
            <h1 className="text-sm font-bold tracking-wide text-slate-100 uppercase">PR Manager</h1>
            <span className="hidden md:inline text-[11px] text-slate-500">drafts · audit trail · one-click finalization</span>
          </div>
          {editing.owner && editing.repo && (
            <span className="text-[11px] font-mono text-slate-500 truncate">
              {editing.owner}/{editing.repo}
              {editing.targetBranch ? ` → ${editing.targetBranch}` : ""}
            </span>
          )}
        </div>
      </div>

      {/* Two-pane body */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="max-w-[1500px] mx-auto px-6 py-6"
      >
        <div className="flex flex-col lg:flex-row gap-5">
          <Sidebar
            drafts={drafts}
            isLoadingDrafts={isLoadingDrafts}
            history={history}
            isLoadingHistory={isLoadingHistory}
            selectedDraftId={editing._id}
            onSelectDraft={selectDraft}
            onNewDraft={newDraft}
            onDeleteDraft={deleteDraft}
            onSelectHistory={openAudit}
          />
          <PREditor
            draft={editing}
            onChange={change}
            onSaveDraft={saveDraft}
            saving={saveDraftMutation.isPending}
            onFinalize={finalize}
            finalizing={finalizing}
          />
        </div>
      </motion.div>

      {/* Audit diff modal — keyed so each selection mounts fresh */}
      <Modal
        open={selectedAudit !== null}
        onClose={() => setSelectedAudit(null)}
        title={
          <span className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-violet-300" />
            Audit #{(selectedAudit?._id ?? "").slice(-6)}
          </span>
        }
        subtitle={selectedAudit?.prUrl ? "Recorded automatically when this PR was created" : "Audit history record"}
        footer={
          selectedAudit?.prUrl ? (
            <a
              href={selectedAudit.prUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 h-9 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition"
            >
              Open Pull Request ↗
            </a>
          ) : undefined
        }
      >
        {selectedAudit ? <AuditDiffViewer key={selectedAudit._id ?? selectedAudit.prId} audit={selectedAudit} /> : null}
      </Modal>
    </div>
  );
}
