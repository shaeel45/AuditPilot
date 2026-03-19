import React, { useState } from "react";
import { motion } from "framer-motion";
import { GitPullRequest, Loader2, Github, CheckCircle2, ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAudit, useBranches, useApplyFix } from "@/hooks/use-audits";
import { useLocation, useParams } from "wouter";
import DashboardLayout from "../DashboardLayout";

export default function FixConfirmationPage() {
  const { owner, repo, auditId } = useParams<{ owner: string, repo: string, auditId: string }>();
  const [, setLocation] = useLocation();
  const { data: audit, isLoading: isLoadingAudit } = useAudit(auditId);
  const { data: branches, isLoading: isLoadingBranches } = useBranches(owner, repo);
  const [targetBranch, setTargetBranch] = useState("main");
  const fixMutation = useApplyFix();

  const handleCreatePR = () => {
    if (!audit) return;
    
    // Convert AuditItems to the format expectations of useApplyFix
    const issues = audit.items.map((item: any) => ({
      description: item.label,
      file_path: item.value,
      old_code: item.old_code,
      new_code: item.new_code,
    })).filter((i: any) => i.new_code);

    fixMutation.mutate({ owner, repo, issues, targetBranch }, {
      onSuccess: (data) => {
        const prNumber = data.html_url.split('/').pop();
        setLocation(`/app/audit/${owner}/${repo}/success/${prNumber}?url=${encodeURIComponent(data.html_url)}`);
      }
    });
  };

  if (isLoadingAudit) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  const issuesWithFixes = audit?.items?.filter((i: any) => i.new_code) || [];

  return (
    <DashboardLayout>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center justify-center py-10">
        <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center mb-6 shadow-inner ring-4 ring-indigo-50">
          <GitPullRequest className="w-6 h-6 text-indigo-600" />
        </div>

        <h2 className="text-3xl font-bold text-slate-900 mb-4 text-center">Finalize Fixes</h2>
        <p className="text-slate-600 text-center max-w-md mb-10">
          Select the destination branch to merge the identified security and performance fixes.
        </p>

        <Card className="w-full max-w-2xl bg-white border border-slate-200 shadow-xl overflow-hidden mb-10">
          <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Github className="w-5 h-5 text-slate-700" />
              <span className="text-slate-600 font-medium">{owner} / {repo}</span>
            </div>
            <Badge variant="outline" className="bg-white border-slate-200 text-slate-500">New PR</Badge>
          </div>

          <div className="p-8">
            <div className="space-y-8">
              <div className="p-5 rounded-2xl bg-indigo-50/50 border border-indigo-100/50">
                <h4 className="text-sm font-bold text-indigo-900 mb-4 flex items-center gap-2">
                  <GitPullRequest className="w-4 h-4" />
                  Merge Destination
                </h4>
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <label className="text-[10px] text-slate-400 mb-1.5 block uppercase tracking-widest font-bold">Base Branch</label>
                    <select
                      disabled={isLoadingBranches}
                      value={targetBranch}
                      onChange={(e) => setTargetBranch(e.target.value)}
                      className="w-full h-11 px-4 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-4 focus:ring-indigo-500/10 appearance-none cursor-pointer"
                    >
                      {isLoadingBranches ? (
                        <option>Loading branches...</option>
                      ) : (
                        branches?.map((b: string) => (
                          <option key={b} value={b}>{b}</option>
                        ))
                      )}
                    </select>
                  </div>
                  <div className="pt-5 flex items-center gap-2 text-slate-300">
                    <div className="w-4 h-[2px] bg-current" />
                    <ArrowRight className="w-4 h-4" />
                    <div className="w-4 h-[2px] bg-current" />
                  </div>
                  <div className="flex-1">
                    <label className="text-[10px] text-slate-400 mb-1.5 block uppercase tracking-widest font-bold">New Branch</label>
                    <div className="w-full h-11 px-4 rounded-xl border border-slate-200 bg-slate-50 text-sm flex items-center text-slate-500 font-mono">
                      audit-branch-{auditId.slice(-4)}
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <p className="font-bold text-slate-900 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  Fixes to be included ({issuesWithFixes.length}):
                </p>
                <div className="space-y-2">
                  {issuesWithFixes.slice(0, 4).map((i: any, idx: number) => (
                    <div key={idx} className="flex items-center gap-3 p-3 rounded-lg border border-slate-100 text-sm text-slate-600 bg-slate-50/30">
                      <div className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                      <span className="truncate flex-1">{i.label}</span>
                      <Badge variant="outline" className="text-[9px] font-mono opacity-50 border-none">{i.value}</Badge>
                    </div>
                  ))}
                  {issuesWithFixes.length > 4 && (
                    <div className="text-xs text-slate-400 pl-6 italic">...and {issuesWithFixes.length - 4} more improvements.</div>
                  )}
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                <Button variant="ghost" onClick={() => setLocation(`/app/audit/${owner}/${repo}/results/${auditId}`)}>
                  <ArrowLeft className="w-4 h-4 mr-2" /> Adjust Selection
                </Button>
                <Button
                  onClick={handleCreatePR}
                  disabled={fixMutation.isPending || isLoadingBranches || issuesWithFixes.length === 0}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-12 px-8 rounded-xl shadow-lg shadow-indigo-200"
                >
                  {fixMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <GitPullRequest className="w-4 h-4 mr-2" />}
                  Create Pull Request
                </Button>
              </div>
            </div>
          </div>
        </Card>
      </motion.div>
    </DashboardLayout>
  );
}
