import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api-service";
import { Loader2, GitBranch, Check, AlertTriangle, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The repos API returns raw GitHub JSON — newer clients may see
 * owner as a plain string (e.g. "shaeel45") instead of { login }.
 */
export function ownerLoginOf(repo: BranchRepoInfo): string {
  if (!repo) return "";
  if (typeof repo.owner === "string") return repo.owner;
  return repo.owner?.login ?? "";
}

export interface BranchRepoInfo {
  owner: { login: string } | string;
  name: string;
  default_branch?: string;
}

interface BranchSelectModalProps {
  isOpen: boolean;
  onClose: () => void;
  repo: BranchRepoInfo | null;
  onConfirm: (branch: string) => void;
}

export function BranchSelectModal({ isOpen, onClose, repo, onConfirm }: BranchSelectModalProps) {
  const [branches, setBranches] = useState<string[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);

  useEffect(() => {
    if (!isOpen || !repo) return;
    const owner = ownerLoginOf(repo);
    if (!repo.name || !owner) {
      setErrorMsg("Repository information is incomplete — close and reopen this dialog.");
      return;
    }

    // StrictMode-safe: ignore stale responses from double-invoked effects.
    let cancelled = false;
    setIsLoading(true);
    setErrorMsg(null);
    setBranches([]);
    setSelectedBranch("");

    api.getBranches(owner, repo.name)
      .then((data) => {
        if (cancelled) return;
        // Defensive: the endpoint returns string[], tolerate drift here.
        const list = (Array.isArray(data) ? data : []).filter((b): b is string => typeof b === "string");
        setBranches(list);
        // Auto-select the repo's default branch (falls back to main/master/first).
        const preferred = list.includes(repo.default_branch || "")
          ? repo.default_branch!
          : list.includes("main")
            ? "main"
            : list.includes("master")
              ? "master"
              : (list[0] ?? "");
        setSelectedBranch(preferred);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setErrorMsg(err instanceof Error ? err.message : "Failed to fetch branches from GitHub");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, repo, retryNonce]);

  const handleConfirm = () => {
    if (selectedBranch) onConfirm(selectedBranch);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Select Branch</DialogTitle>
          <DialogDescription>
            Choose the branch you want to audit for {repo?.name}.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center gap-2 py-8 text-slate-500">
              <Loader2 className="w-7 h-7 text-indigo-600 animate-spin" />
              <span className="text-xs">Fetching branches…</span>
            </div>
          ) : errorMsg ? (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm">
              <div className="flex items-start gap-2 text-rose-700">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                <span className="break-all">{errorMsg}</span>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="mt-3 border-rose-200 text-rose-700 hover:bg-rose-100"
                onClick={() => setRetryNonce((n) => n + 1)}
              >
                <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Try again
              </Button>
            </div>
          ) : branches.length === 0 ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              No branches were returned for this repository — it may be empty or your GitHub token may not
              have access. Try reconnecting in Settings.
            </div>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
              {branches.length >= 100 && (
                <p className="text-[10px] text-slate-400 px-1">
                  Showing the 100 most recent branches.
                </p>
              )}
              {branches.map((branch) => (
                <button
                  key={branch}
                  onClick={() => setSelectedBranch(branch)}
                  className={cn(
                    "w-full flex items-center justify-between p-3 rounded-lg border transition-all",
                    selectedBranch === branch
                      ? "border-indigo-600 bg-indigo-50 text-indigo-700"
                      : "border-slate-200 hover:border-slate-300 text-slate-700"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <GitBranch className="w-4 h-4 opacity-50" />
                    <span className="font-medium text-sm">{branch}</span>
                  </div>
                  {selectedBranch === branch && <Check className="w-4 h-4" />}
                </button>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            disabled={!selectedBranch || isLoading}
            onClick={handleConfirm}
            title={selectedBranch ? undefined : "Select a branch to continue"}
          >
            Start Audit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
