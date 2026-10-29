import React, { useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, Github, ArrowRight, ExternalLink, GitMerge, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation, useParams } from "wouter";
import DashboardLayout from "../DashboardLayout";
import { useMergePr } from "@/hooks/use-audits";

export default function AuditSuccessPage() {
  const { owner = "", repo = "", prNumber = "pr" } = useParams<{ owner: string, repo: string, prNumber: string }>();
  const [, setLocation] = useLocation();
  const searchParams = new URLSearchParams(window.location.search);
  const prUrl = searchParams.get("url");

  const mergeMutation = useMergePr(owner ?? "", repo ?? "", prNumber);
  const [confirmMerge, setConfirmMerge] = useState(false);
  const [merged, setMerged] = useState(false);

  const handleMerge = () => {
    if (!confirmMerge) {
      setConfirmMerge(true);
      return;
    }
    mergeMutation.mutate(undefined, { onSuccess: () => setMerged(true) });
  };

  return (
    <DashboardLayout>
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mb-8 shadow-xl shadow-green-500/10 animate-bounce">
          <CheckCircle2 className="w-12 h-12 text-green-600" />
        </div>
        
        <h2 className="text-4xl font-extrabold text-slate-900 mb-4 tracking-tight">Pull Request Created!</h2>
        <p className="text-slate-500 mb-12 max-w-md text-lg leading-relaxed">
          Your security and performance fixes have been applied to a new branch and a Pull Request <span className="text-slate-900 font-mono font-bold">#{prNumber}</span> has been opened against <span className="font-semibold text-slate-900">{repo}</span>.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center w-full max-w-lg">
          {!merged && (
            <Button
              size="lg"
              onClick={handleMerge}
              disabled={mergeMutation.isPending}
              className="bg-green-600 hover:bg-green-700 text-white h-14 px-8 font-bold shadow-lg shadow-green-500/20"
            >
              {mergeMutation.isPending ? (
                <Loader2 className="w-5 h-5 mr-3 animate-spin" />
              ) : (
                <GitMerge className="w-5 h-5 mr-3" />
              )}
              {confirmMerge ? "Confirm merge now" : "Merge this PR"}
            </Button>
          )}
          {merged && (
            <div className="flex items-center justify-center h-14 px-8 rounded-md bg-green-50 border border-green-200 text-green-700 font-bold">
              <CheckCircle2 className="w-5 h-5 mr-3" /> Merged — fixes are on {repo || "the repo"}
            </div>
          )}

          {prUrl ? (
            <Button asChild size="lg" className="bg-black hover:bg-slate-800 text-white h-14 px-8 font-bold shadow-lg">
              <a href={decodeURIComponent(prUrl)} target="_blank" rel="noopener noreferrer">
                <Github className="w-5 h-5 mr-3" />
                View on GitHub
                <ExternalLink className="w-4 h-4 ml-2 opacity-50" />
              </a>
            </Button>
          ) : (
            <Button asChild size="lg" className="bg-black hover:bg-slate-800 text-white h-14 px-8 font-bold">
               <a href={`https://github.com/${owner}/${repo}/pulls`} target="_blank" rel="noopener noreferrer">
                  <Github className="w-5 h-5 mr-3" />
                  View Pull Requests
               </a>
            </Button>
          )}
          
          <Button variant="outline" size="lg" onClick={() => setLocation('/app/repos')} className="h-14 px-8 border-slate-200 text-slate-600 font-bold hover:bg-slate-50">
            Back to Dashboard
            <ArrowRight className="w-5 h-5 ml-2 opacity-50" />
          </Button>
        </div>

        {confirmMerge && !merged && (
          <p className="text-xs text-slate-400 mt-4">
            Squash-merges the PR into its base branch and removes the temporary fix branch.
          </p>
        )}

        <div className="mt-16 p-6 bg-slate-50 rounded-2xl border border-slate-100 max-w-lg w-full">
           <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mb-3">Next Steps</p>
           <ul className="text-left space-y-3 text-sm text-slate-600">
             <li className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-white flex items-center justify-center text-[10px] font-bold border border-slate-200 shrink-0 mt-0.5">1</div>
                <span>Review the changes in the Pull Request on GitHub.</span>
             </li>
             <li className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-white flex items-center justify-center text-[10px] font-bold border border-slate-200 shrink-0 mt-0.5">2</div>
                <span>Wait for your CI/CD pipeline to complete checks.</span>
             </li>
             <li className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-white flex items-center justify-center text-[10px] font-bold border border-slate-200 shrink-0 mt-0.5">3</div>
                <span>Merge the PR to apply the fixes permanently.</span>
             </li>
           </ul>
        </div>
      </motion.div>
    </DashboardLayout>
  );
}
