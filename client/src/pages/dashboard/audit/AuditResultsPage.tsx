import React from "react";
import { motion } from "framer-motion";
import { ArrowLeft, AlertCircle, ArrowRight, Shield, Zap, CheckCircle2, Loader2, Code2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAudit } from "@/hooks/use-audits";
import { useLocation, useParams } from "wouter";
import DashboardLayout from "../DashboardLayout";

export default function AuditResultsPage() {
  const { owner, repo, auditId } = useParams<{ owner: string, repo: string, auditId: string }>();
  const [, setLocation] = useLocation();
  const { data: audit, isLoading } = useAudit(auditId);

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  const issues = audit?.items || [];

  return (
    <DashboardLayout>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 pb-20">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => setLocation('/app/repos')}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to repos
          </Button>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="bg-slate-50 text-slate-600 border-slate-200">
              {issues.length} Issues Found
            </Badge>
            <Badge className={audit?.priority === 'critical' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}>
              {audit?.priority} Priority
            </Badge>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6">
          <div className="bg-white rounded-2xl p-8 border border-slate-200 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-5">
              <Shield className="w-32 h-32 text-indigo-600" />
            </div>
            <div className="relative z-10">
              <h2 className="text-2xl font-bold text-slate-900 mb-2">Audit Report: {repo}</h2>
              <p className="text-slate-500 max-w-2xl">{audit?.description}</p>
            </div>
          </div>

          <div className="space-y-4">
            {issues.length === 0 ? (
              <Card className="p-12 text-center bg-green-50 border-green-100">
                <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-green-900">No Issues Detected</h3>
                <p className="text-green-700/70 max-w-md mx-auto mt-2">Your repository follows security and performance best practices.</p>
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
                          <Badge className={issue.severity === 'critical' ? 'bg-red-500' : 'bg-amber-500'}>{issue.severity}</Badge>
                        </div>
                        <CardTitle className="text-base text-slate-800 font-bold flex items-center gap-2">
                          <Code2 className="w-4 h-4 text-slate-400" /> {issue.value}
                        </CardTitle>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-slate-400 border-slate-200 text-[10px]">ID: {issue._id.slice(-6)}</Badge>
                  </CardHeader>
                  <CardContent className="p-6">
                    <p className="text-slate-600 leading-relaxed mb-6 font-medium">{issue.label}</p>
                    
                    {issue.new_code && (
                      <div className="space-y-3">
                        <div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                          <Zap className="w-3 h-3 text-amber-500" /> AI Suggested Fix
                        </div>
                        <div className="bg-[#0d1117] rounded-xl p-4 font-mono text-xs overflow-x-auto border border-slate-800 shadow-inner">
                          {issue.old_code && <div className="text-red-400 opacity-60 mb-2 line-through decoration-red-900/50 block whitespace-pre">{issue.old_code}</div>}
                          <div className="text-green-400 block whitespace-pre">{issue.new_code}</div>
                        </div>
                      </div>
                    )}

                    {!issue.new_code && (
                      <div className="p-4 bg-amber-50 rounded-xl border border-amber-100 text-sm text-amber-700 flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-bold">Manual Review Required</p>
                          <p className="opacity-80">This issue requires a complex architectural change that should be reviewed by a developer.</p>
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
              onClick={() => setLocation(`/app/audit/${owner}/${repo}/fix/${auditId}`)}
              disabled={issues.length === 0}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-12 h-16 text-xl font-bold shadow-2xl shadow-indigo-200 group rounded-full border-4 border-white"
            >
              <Zap className="w-6 h-6 mr-3 fill-current" />
              Auto-Fix with AI
              <ArrowRight className="w-6 h-6 ml-3 group-hover:translate-x-1 transition-transform" />
            </Button>
          </div>
        </div>
      </motion.div>
    </DashboardLayout>
  );
}
