import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, AlertCircle, ArrowRight, Zap, CheckCircle2, Loader2, Code2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { usePRFix, usePulls } from "@/hooks/use-pulls";
import { useLocation, useParams } from "wouter";
import DashboardLayout from "../DashboardLayout";

export default function PullResultsPage() {
  const { number } = useParams<{ number: string }>();
  const [, setLocation] = useLocation();
  const { data: pulls } = usePulls();
  const pr = pulls?.find(p => p.number === parseInt(number));
  
  const [issues, setIssues] = useState<any[]>([]);
  const fixMutation = usePRFix();

  useEffect(() => {
    const saved = sessionStorage.getItem(`pr_audit_${number}`);
    if (saved) {
      setIssues(JSON.parse(saved));
    }
  }, [number]);

  const handleApplyFixes = () => {
    if (!pr) return;
    const repoOwner = pr.base?.repo?.owner?.login || pr.repo?.owner?.login || pr.repo?.owner || pr.owner?.login || pr.owner;
    const repoName = pr.base?.repo?.name || pr.repo?.name || pr.name;

    fixMutation.mutate({ owner: repoOwner, repo: repoName, number: pr.number, issues }, {
      onSuccess: () => {
        setLocation(`/app/pulls/${pr.number}/diff`);
      }
    });
  };

  if (!pr && !issues.length) {
    return <DashboardLayout><div className="flex justify-center py-20"><Loader2 className="animate-spin text-indigo-600" /></div></DashboardLayout>;
  }

  return (
    <DashboardLayout>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 pb-20">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => setLocation(`/app/pulls/${number}`)}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to PR
          </Button>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="bg-slate-50 text-slate-600 border-slate-200">
              {issues.length} Issues Found
            </Badge>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6">
          <div className="bg-white rounded-2xl p-8 border border-slate-200 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-5">
              <Zap className="w-32 h-32 text-indigo-600" />
            </div>
            <div className="relative z-10">
              <h2 className="text-2xl font-bold text-slate-900 mb-2">PR Review Results: PR #{number}</h2>
              <p className="text-slate-500 max-w-2xl">AI analysis identified the following security and performance improvements for this pull request.</p>
            </div>
          </div>

          <div className="space-y-4">
            {issues.length === 0 ? (
              <Card className="p-12 text-center bg-green-50 border-green-100">
                <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-green-900">PR Looks Good!</h3>
                <p className="text-green-700/70 max-w-md mx-auto mt-2">No critical issues detected in these changes.</p>
              </Card>
            ) : (
              issues.map((issue: any, idx: number) => (
                <Card key={idx} className="border-slate-200 hover:border-indigo-200 transition-colors shadow-sm overflow-hidden">
                  <CardHeader className="flex flex-row items-start justify-between py-5 bg-slate-50/50 border-b border-slate-100">
                    <div className="flex items-center gap-3">
                      <div className={`p-2.5 rounded-xl ${issue.severity === 'critical' ? 'bg-red-100 text-red-600' : 'bg-indigo-100 text-indigo-600'}`}>
                        <AlertCircle className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline" className="uppercase text-[9px] font-bold tracking-wider">{issue.type}</Badge>
                          {issue.severity && <Badge className={issue.severity === 'critical' ? 'bg-red-500' : 'bg-amber-500'}>{issue.severity}</Badge>}
                        </div>
                        <CardTitle className="text-base text-slate-800 font-bold flex items-center gap-2">
                          <Code2 className="w-4 h-4 text-slate-400" /> {issue.file || issue.path || "Source"}
                        </CardTitle>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-6">
                    <p className="text-slate-600 leading-relaxed mb-6 font-medium">{issue.description || issue.label}</p>
                    
                    {(issue.new_code || issue.fix?.new_code) && (
                      <div className="space-y-3">
                        <div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                          <Zap className="w-3 h-3 text-amber-500" /> Suggested Correction
                        </div>
                        <div className="bg-[#0d1117] rounded-xl p-4 font-mono text-xs overflow-x-auto border border-slate-800 shadow-inner">
                          {(issue.old_code || issue.fix?.old_code) && <div className="text-red-400 opacity-60 mb-2 line-through decoration-red-900/50 block whitespace-pre">{(issue.old_code || issue.fix?.old_code)}</div>}
                          <div className="text-green-400 block whitespace-pre">{(issue.new_code || issue.fix?.new_code)}</div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </div>

          <div className="pt-10 flex justify-center sticky bottom-8 z-30">
            <Button
              onClick={handleApplyFixes}
              disabled={issues.length === 0 || fixMutation.isPending}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-12 h-16 text-xl font-bold shadow-2xl shadow-indigo-200 group rounded-full border-4 border-white"
            >
              {fixMutation.isPending ? <Loader2 className="w-6 h-6 mr-3 animate-spin" /> : <Zap className="w-6 h-6 mr-3 fill-current" />}
              Correct PR with AI
              <ArrowRight className="w-6 h-6 ml-3 group-hover:translate-x-1 transition-transform" />
            </Button>
          </div>
        </div>
      </motion.div>
    </DashboardLayout>
  );
}
