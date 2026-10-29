import React, { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Save, Zap, Loader2, Code2, AlertCircle, ArrowRight, Link2, Link2Off, FileCode2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { useAudit, useUpdateAuditItem, useApplyFix, useFixPreview } from "@/hooks/use-audits";
import { useLocation, useParams } from "wouter";
import DashboardLayout from "../DashboardLayout";
import { useToast } from "@/hooks/use-toast";

interface MatchInfo {
  line: number;
  exact: boolean;
}

interface FixPreview {
  auditId: string;
  branch: string;
  files: Record<string, { content: string; truncated: boolean; totalLines: number }>;
  items: Array<{
    itemId: string;
    label?: string;
    type?: string;
    severity?: string;
    file: string | null;
    oldCode: string | null;
    newCode: string | null;
    match: MatchInfo | null;
  }>;
}

/** Renders a file with 1-based line numbers; the anchored range is highlighted. */
function LiveCodePane({
  content,
  highlightFrom,
  highlightTo,
  truncated,
  totalLines,
}: {
  content: string;
  highlightFrom?: number;
  highlightTo?: number;
  truncated: boolean;
  totalLines: number;
}) {
  const lines = content.split("\n");
  return (
    <div className="max-h-[420px] overflow-auto rounded-xl border border-slate-200 bg-white">
      {lines.map((line, i) => {
        const n = i + 1;
        const inRange = highlightFrom != null && highlightTo != null && n >= highlightFrom && n <= highlightTo;
        return (
          <div key={i} className={`flex ${inRange ? "bg-rose-50" : n % 2 === 0 ? "bg-slate-50/40" : ""}`}>
            <span className="w-11 shrink-0 select-none text-right pr-2 pt-1 text-[10px] text-slate-300 font-mono">
              {n}
            </span>
            <pre className="flex-1 py-0.5 font-mono text-xs whitespace-pre-wrap break-words text-slate-700">
              {line || " "}
            </pre>
          </div>
        );
      })}
      {truncated && (
        <div className="px-4 py-2 text-[10px] text-slate-400 border-t border-slate-100">
          Showing first {lines.length} of {totalLines} lines
        </div>
      )}
    </div>
  );
}

function MatchBadge({ match }: { match: MatchInfo | null }) {
  if (!match) {
    return (
      <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-200 bg-amber-50">
        <Link2Off className="w-3 h-3 mr-1" /> Not anchored — edit the fix
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-[10px] text-green-700 border-green-200 bg-green-50">
      <Link2 className="w-3 h-3 mr-1" /> Linked to file (line {match.line}{match.exact ? "" : ", fuzzy"})
    </Badge>
  );
}

export default function AuditEditPage() {
  const { owner = "", repo = "", auditId = "" } = useParams<{ owner: string, repo: string, auditId: string }>();
  const [, setLocation] = useLocation();
  const { data: audit, isLoading } = useAudit(auditId);
  const { data: preview, isLoading: isPreviewLoading } = useFixPreview(auditId || undefined, owner || undefined, repo || undefined);
  const updateItemMutation = useUpdateAuditItem(auditId);
  const applyFixMutation = useApplyFix();
  const { toast } = useToast();

  const [editedCodes, setEditedCodes] = useState<{ [itemId: string]: string }>({});
  const [excluded, setExcluded] = useState<{ [itemId: string]: boolean }>({});
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

  const issues = audit?.items || [];

  /** Per-item preview context (REAL current file content + match info). */
  const itemContext = useMemo(() => {
    const map: { [itemId: string]: { file: string | null; match: MatchInfo | null } } = {};
    (preview?.items || []).forEach((p: FixPreview["items"][number]) => {
      map[p.itemId] = { file: p.file, match: p.match };
    });
    return map;
  }, [preview]);

  const handleCodeChange = (itemId: string, code: string) => {
    setEditedCodes(prev => ({ ...prev, [itemId]: code }));
  };

  const toggleIncluded = (itemId: string, included: boolean) => {
    setExcluded(prev => ({ ...prev, [itemId]: !included }));
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

  const eligibleIssues = issues.filter((issue: any) => issue.new_code || editedCodes[issue._id]);
  const includedIssues = eligibleIssues.filter((issue: any) => !excluded[issue._id]);

  const handleCreatePR = () => {
    if (!audit?.items) return;

    // Only INCLUDED issues, each carrying the LATEST edited code
    const issuesToFix = includedIssues.map((issue: any) => ({
      ...issue,
      new_code: editedCodes[issue._id] || issue.new_code,
      file: issue.value, // Repo audits store the file path in `value`
      description: issue.label, // improves the PR body (server reads `description`)
    }));

    if (issuesToFix.length === 0) {
      toast({ title: "No Changes", description: "Select at least one fix to include in the PR." });
      return;
    }

    applyFixMutation.mutate({
      owner,
      repo,
      issues: issuesToFix,
      targetBranch: audit?.branch || "main"
    }, {
      onSuccess: (data: any) => {
        const prNumber = data.prNumber ?? data.number ?? "pr";
        const url = data.prUrl ? `?url=${encodeURIComponent(data.prUrl)}` : "";
        setLocation(`/app/audit/${owner}/${repo}/success/${prNumber}${url}`);
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
            <h2 className="text-2xl font-bold mb-2">Review &amp; Refine Fixes</h2>
            <p className="text-slate-400 max-w-2xl">
              The left pane is the <span className="text-white font-semibold">live file content</span> from your
              repository (anchored lines highlighted) — the right pane is the proposed fix, which you can edit
              freely. Deselect anything you don't want, then create the PR.
            </p>
          </div>
        </div>

        <div className="space-y-6">
          {issues.map((issue: any, idx: number) => {
            const filePath = issue.value || itemContext[issue._id]?.file || null;
            const match = itemContext[issue._id]?.match ?? null;
            const fileData = filePath && preview ? preview.files[filePath] : undefined;
            const proposed = editedCodes[issue._id] || issue.new_code || "";
            const included = eligibleIssues.some((i: any) => i._id === issue._id) && !excluded[issue._id];
            const oldLines = (issue.old_code || "").split("\n").length;

            return (
              <Card key={idx} className={`border-slate-200 shadow-sm overflow-hidden bg-white ${included ? "" : "opacity-60"}`}>
                <CardHeader className="bg-slate-50/50 border-b border-slate-100 flex flex-row items-center justify-between py-4">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${issue.severity === 'critical' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'}`}>
                      <AlertCircle className="w-4 h-4" />
                    </div>
                    <div>
                      <CardTitle className="text-sm font-bold flex items-center gap-2">
                        {issue.label || "Issue"}
                      </CardTitle>
                      <p className="text-xs text-slate-500 mt-0.5 truncate max-w-md flex items-center gap-1">
                        <FileCode2 className="w-3 h-3" /> {filePath || "no file attached"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {preview ? <MatchBadge match={match} /> : null}
                    <Badge variant="outline" className="text-[10px]">{issue.severity}</Badge>
                    {eligibleIssues.some((i: any) => i._id === issue._id) && (
                      <label className="flex items-center gap-2 text-xs text-slate-500 cursor-pointer select-none">
                        <Checkbox checked={included} onCheckedChange={(v) => toggleIncluded(issue._id, !!v)} />
                        In PR
                      </label>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="grid grid-cols-1 lg:grid-cols-2">
                    <div className="p-6 bg-slate-50 border-r border-slate-100">
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center justify-between">
                        <span>Current Code (live)</span>
                        {isPreviewLoading && <Loader2 className="w-3 h-3 animate-spin text-slate-300" />}
                      </div>
                      {fileData ? (
                        <LiveCodePane
                          content={fileData.content}
                          highlightFrom={match?.line}
                          highlightTo={match ? match.line + Math.max(oldLines - 1, 0) : undefined}
                          truncated={fileData.truncated}
                          totalLines={fileData.totalLines}
                        />
                      ) : (
                        <>
                          {preview && (
                            <p className="mb-2 text-[11px] text-amber-600 flex items-center gap-1">
                              <Link2Off className="w-3 h-3" /> Live content unavailable — showing the AI's quote
                            </p>
                          )}
                          <pre className="p-4 bg-white rounded-xl border border-slate-200 font-mono text-xs text-red-600 opacity-70 whitespace-pre overflow-x-auto max-h-[420px]">
                            {issue.old_code || "// original code not captured"}
                          </pre>
                        </>
                      )}
                    </div>
                    <div className="p-6">
                      <div className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-3 flex justify-between items-center">
                        <span>Proposed Fix (Editable)</span>
                        <Badge className="bg-indigo-100 text-indigo-700 hover:bg-indigo-100 border-none text-[9px]">AI POWERED</Badge>
                      </div>
                      <Textarea
                        className="min-h-[200px] font-mono text-xs bg-slate-900 text-green-400 border-slate-800 focus:ring-indigo-500 p-4 leading-relaxed"
                        value={proposed}
                        onChange={(e) => handleCodeChange(issue._id, e.target.value)}
                        placeholder="// Type fixed code here..."
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="pt-10 flex flex-col items-center gap-3 sticky bottom-8 z-30">
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
                Finalize &amp; Create PR
                <ArrowRight className="w-6 h-6 ml-3 group-hover:translate-x-1 transition-transform" />
              </>
            )}
          </Button>
          <p className="text-xs text-slate-500 bg-white/90 px-3 py-1 rounded-full border border-slate-100 shadow-sm">
            {includedIssues.length} of {eligibleIssues.length} fixes included
          </p>
        </div>
      </motion.div>
    </DashboardLayout>
  );
}
