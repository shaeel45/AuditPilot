import React, { useState } from "react";
import { motion } from "framer-motion";
import { GitPullRequest, Loader2, Github, ArrowRight, Shield, Zap, Code2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { usePulls, usePRFiles, usePRAudit, usePRMerge, useUpdatePR } from "@/hooks/use-pulls";
import { useBranches } from "@/hooks/use-audits";
import { useAuthStatus } from "@/hooks/use-repos";
import { useLocation, useParams } from "wouter";
import DashboardLayout from "../DashboardLayout";

export default function PullDetailPage() {
  const { number } = useParams<{ number: string }>();
  const [, setLocation] = useLocation();
  const { data: pulls, isLoading: isLoadingPulls } = usePulls();
  const { data: authStatus } = useAuthStatus();
  
  const pr = pulls?.find(p => p.number === parseInt(number));
  
  const repoOwner = pr?.base?.repo?.owner?.login || pr?.repo?.owner?.login || pr?.repo?.owner || pr?.owner?.login || pr?.owner;
  const repoName = pr?.base?.repo?.name || pr?.repo?.name || pr?.name;

  const { data: files, isLoading: isLoadingFiles } = usePRFiles(repoOwner, repoName, parseInt(number));
  const { data: branches } = useBranches(repoOwner, repoName);
  const auditMutation = usePRAudit();
  const mergeMutation = usePRMerge();
  const updatePRMutation = useUpdatePR();
  const [targetBranch, setTargetBranch] = useState(pr?.base?.ref || 'master');

  const handleAudit = () => {
    if (!pr) return;
    auditMutation.mutate({ owner: repoOwner, repo: repoName, number: pr.number }, {
      onSuccess: (data) => {
        // For transient PR results, we'll use sessionStorage
        sessionStorage.setItem(`pr_audit_${pr.number}`, JSON.stringify(data.issues || []));
        setLocation(`/app/pulls/${pr.number}/results`);
      }
    });
  };

  const handleMerge = () => {
    if (!pr) return;
    mergeMutation.mutate({ owner: repoOwner, repo: repoName, number: pr.number }, {
      onSuccess: () => setLocation('/app/pulls')
    });
  };

  const handleBranchChange = (newBranch: string) => {
    if (!pr) return;
    setTargetBranch(newBranch);
    updatePRMutation.mutate({
      owner: repoOwner,
      repo: repoName,
      number: pr.number,
      data: { base: newBranch }
    });
  };

  if (isLoadingPulls) {
    return <DashboardLayout><div className="flex justify-center py-20"><Loader2 className="animate-spin text-indigo-600" /></div></DashboardLayout>;
  }

  if (!pr) {
    return <DashboardLayout><div className="text-center py-20 text-slate-500 font-bold">PR Not Found</div></DashboardLayout>;
  }

  return (
    <DashboardLayout>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => setLocation('/app/pulls')}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Pull Requests
          </Button>
          <div className="flex gap-2">
            <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-none capitalize px-3">{pr.state}</Badge>
            <Badge variant="outline" className="border-slate-200">#{pr.number}</Badge>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card className="border-slate-200 shadow-sm overflow-hidden">
               <CardHeader className="bg-slate-50/50 border-b border-slate-100 py-4 px-6">
                <CardTitle className="text-lg font-bold text-slate-800">{pr.title}</CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="flex items-start gap-4 mb-8">
                  <img src={pr.user?.avatar_url} className="w-12 h-12 rounded-full border-2 border-slate-100" alt="" />
                  <div>
                    <div className="font-bold text-slate-900 text-lg">{pr.user?.login}</div>
                    <div className="text-sm text-slate-500">opened this pull request on {new Date(pr.created_at).toLocaleDateString()}</div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="text-sm font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <Code2 className="w-4 h-4" /> Changed Files ({files?.length || 0})
                  </h4>
                  <div className="space-y-2">
                    {isLoadingFiles ? (
                      <div className="flex justify-center py-4"><Loader2 className="animate-spin w-4 h-4 text-indigo-600" /></div>
                    ) : (
                      files?.map((file: any) => (
                        <div key={file.filename} className="flex items-center justify-between p-3.5 rounded-xl border border-slate-100 bg-slate-50/30 hover:bg-white hover:border-indigo-100 transition-all group">
                          <div className="flex items-center gap-3">
                            <div className="p-1.5 bg-white rounded-lg border border-slate-100 group-hover:text-indigo-600 transition-colors">
                              <Code2 className="w-4 h-4" />
                            </div>
                            <span className="text-sm font-mono text-slate-700 truncate max-w-[400px]">{file.filename}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-[11px] text-green-600 font-bold bg-green-50 px-2 py-0.5 rounded-full">+{file.additions}</span>
                            <span className="text-[11px] text-red-600 font-bold bg-red-50 px-2 py-0.5 rounded-full">-{file.deletions}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
             <Card className="border-indigo-600/20 bg-indigo-50/30 shadow-lg shadow-indigo-500/5 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition-transform">
                <Shield className="w-20 h-20 text-indigo-600" />
              </div>
              <CardHeader>
                <CardTitle className="text-indigo-900 flex items-center gap-2 font-bold">
                  <Shield className="w-5 h-5 text-indigo-600" /> AI Review
                </CardTitle>
                <CardDescription className="text-indigo-700/70 text-sm">
                  Audit the specific code changes in this PR for vulnerabilities and performance issues.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  onClick={handleAudit}
                  disabled={auditMutation.isPending}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 h-12 text-white font-bold shadow-lg shadow-indigo-200"
                >
                  {auditMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Zap className="w-4 h-4 mr-2" />}
                  Review with AI
                </Button>
              </CardContent>
            </Card>

            <Card className="border-slate-200 shadow-sm overflow-hidden">
               <CardHeader className="pb-3 text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] border-b border-slate-50 bg-slate-50/30 px-6">Branch Configuration</CardHeader>
              <CardContent className="space-y-5 pt-5 px-6 pb-6">
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-slate-500 uppercase px-1">Target Base Branch</label>
                  <select
                    value={targetBranch}
                    onChange={(e) => handleBranchChange(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-4 focus:ring-indigo-500/10 cursor-pointer"
                  >
                    {branches?.map((b: string) => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                  <p className="text-[10px] text-slate-400 px-1">Changing this updates the PR on GitHub instantly.</p>
                </div>

                <div className="pt-2">
                  <Button
                    variant="outline"
                    onClick={handleMerge}
                    disabled={mergeMutation.isPending}
                    className="w-full border-green-200 text-green-700 hover:bg-green-50 hover:border-green-300 font-bold h-11"
                  >
                    {mergeMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <GitPullRequest className="w-4 h-4 mr-2 text-green-600" />}
                    Squash & Merge
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </motion.div>
    </DashboardLayout>
  );
}
