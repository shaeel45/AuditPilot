import React, { useState, useEffect } from "react";
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
import { Loader2, GitBranch, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface BranchSelectModalProps {
  isOpen: boolean;
  onClose: () => void;
  repo: { owner: { login: string }; name: string } | null;
  onConfirm: (branch: string) => void;
}

export function BranchSelectModal({ isOpen, onClose, repo, onConfirm }: BranchSelectModalProps) {
  const [branches, setBranches] = useState<string[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen && repo) {
      setIsLoading(true);
      api.getBranches(repo.owner.login, repo.name)
        .then((data) => {
          setBranches(data);
          // Auto-select main or master if available
          if (data.includes("main")) setSelectedBranch("main");
          else if (data.includes("master")) setSelectedBranch("master");
          else if (data.length > 0) setSelectedBranch(data[0]);
        })
        .finally(() => setIsLoading(false));
    }
  }, [isOpen, repo]);

  const handleConfirm = () => {
    if (selectedBranch) {
      onConfirm(selectedBranch);
    }
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
            <div className="flex justify-center py-8">
              <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
            </div>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
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
          <Button disabled={!selectedBranch || isLoading} onClick={handleConfirm}>
            Start Audit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
