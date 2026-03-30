import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Save, Zap, CheckCircle2, Loader2, Code2, AlertCircle, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useAudit, useUpdateAuditItem, useApplyFix } from "@/hooks/use-audits";
import { useLocation, useParams } from "wouter";
import DashboardLayout from "../DashboardLayout";
import { useToast } from "@/hooks/use-toast";

export default function AuditEditPage() {
  const { owner = "", repo = "", auditId = "" } = useParams<{ owner: string, repo: string, auditId: string }>();
  const [, setLocation] = useLocation();
  const { data: audit, isLoading } = useAudit(auditId);
  const updateItemMutation = useUpdateAuditItem(auditId);
  const applyFixMutation = useApplyFix();
  const { toast } = useToast();

  const [editedCodes, setEditedCodes] = useState<{ [itemId: string]: string }>({});
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (audit?.items) {
      const initialCodes: { [itemId: string]: string } = {};
      audit.items.forEach((item: any) => {
        if (item.new_code) {
          initialCodes[item._id] = item.new_code;
        }
      });
      setEditedCodes(initialCodes);
    }
  }, [audit]);

  const handleCodeChange = (itemId: string, code: string) => {
    setEditedCodes(prev => ({ ...prev, [itemId]: code }));
  };

  const saveAllChanges = async () => {
    setIsSaving(true);
    try {
      for (const itemId in editedCodes) {
        await updateItemMutation.mutateAsync({
          id: itemId,
          new_code: editedCodes[itemId]
        });
      }
      toast({ title: "Success", description: "All changes saved successfully!" });
    } catch (err: any) {
      toast({ title: "Error", description: "Failed to save some changes.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreatePR = () => {
    if (!audit?.items) return;

    // Create a list of issues with the LATEST edited codes
    const issuesToFix = audit.items
      .filter((item: any) => item.new_code || editedCodes[item._id])
      .map((item: any) => ({
        ...item,
        new_code: editedCodes[item._id] || item.new_code,
        file: item.value // Repo audit uses 'value' for file path
      }));

    if (issuesToFix.length === 0) {
      toast({ title: "No Changes", description: "There are no fixes to apply." });
      return;
    }

    applyFixMutation.mutate({
      owner,
      repo,
      issues: issuesToFix,
      targetBranch: audit?.branch || "main"
    }, {
      onSuccess: (data) => {
        setLocation(`/app/audit/${owner}/${repo}/success/${data.number || 'pr'}`);
      }
    });
  };

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
          <Button variant="ghost" size="sm" onClick={() => setLocation(`/app/audit/${owner}/${repo}/results/${auditId}`)}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to report
          </Button>
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="sm"
              onClick={saveAllChanges}
              disabled={isSaving}
              className="border-indigo-200 text-indigo-700 hover:bg-indigo-50"
            >
              {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Save Draft
            </Button>
          </div>
        </div>

        <div className="bg-slate-900 rounded-2xl p-8 text-white relative overflow-hidden shadow-xl">
          <div className="absolute top-0 right-0 p-8 opacity-10">
            <Code2 className="w-32 h-32" />
          </div>
          <div className="relative z-10">
            <h2 className="text-2xl font-bold mb-2">Refine Suggestions</h2>
            <p className="text-slate-400 max-w-2xl">Review and modify the AI-suggested code fixes. Once satisfied, click "Finalize & Create PR" to apply them to your repository.</p>
          </div>
        </div>

        <div className="space-y-6">
          {issues.map((issue: any, idx: number) => (
            <Card key={idx} className="border-slate-200 shadow-sm overflow-hidden bg-white">
              <CardHeader className="bg-slate-50/50 border-b border-slate-100 flex flex-row items-center justify-between py-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${issue.severity === 'critical' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'}`}>
                    <AlertCircle className="w-4 h-4" />
                  </div>
                  <div>
                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                      {issue.value}
                    </CardTitle>
                    <p className="text-xs text-slate-500 mt-0.5 truncate max-w-md">{issue.label}</p>
                  </div>
                </div>
                <Badge variant="outline" className="text-[10px]">{issue.severity}</Badge>
              </CardHeader>
              <CardContent className="p-0">
                <div className="grid grid-cols-1 lg:grid-cols-2">
                  <div className="p-6 bg-slate-50 border-r border-slate-100">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Current Violation</div>
                    <pre className="p-4 bg-white rounded-xl border border-slate-200 font-mono text-xs text-red-600 line-through opacity-70 whitespace-pre overflow-x-auto">
                      {issue.old_code || "// original code not captured"}
                    </pre>
                  </div>
                  <div className="p-6">
                    <div className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-3 flex justify-between items-center">
                      <span>Proposed Fix (Editable)</span>
                      <Badge className="bg-indigo-100 text-indigo-700 hover:bg-indigo-100 border-none text-[9px]">AI POWERED</Badge>
                    </div>
                    <Textarea
                      className="min-h-[200px] font-mono text-xs bg-slate-900 text-green-400 border-slate-800 focus:ring-indigo-500 p-4 leading-relaxed"
                      value={editedCodes[issue._id] || ""}
                      onChange={(e) => handleCodeChange(issue._id, e.target.value)}
                      placeholder="// Type fixed code here..."
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="pt-10 flex justify-center sticky bottom-8 z-30">
          <Button
            onClick={handleCreatePR}
            disabled={issues.length === 0 || applyFixMutation.isPending}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-16 h-16 text-xl font-bold shadow-2xl shadow-indigo-200 group rounded-full border-4 border-white transition-all transform hover:scale-105 active:scale-95"
          >
            {applyFixMutation.isPending ? (
              <>
                <Loader2 className="w-6 h-6 mr-3 animate-spin" />
                Creating Pull Request...
              </>
            ) : (
              <>
                <Zap className="w-6 h-6 mr-3 fill-current" />
                Finalize & Create PR
                <ArrowRight className="w-6 h-6 ml-3 group-hover:translate-x-1 transition-transform" />
              </>
            )}
          </Button>
        </div>
      </motion.div>
    </DashboardLayout>
  );
}
