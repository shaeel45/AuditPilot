import React, { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Save,
  Loader2,
  GitPullRequest,
  Code2,
  AlertCircle,
  CheckCircle,
  XCircle,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { useLocation, useParams } from "wouter";
import DashboardLayout from "../DashboardLayout";
import { useToast } from "@/hooks/use-toast";
import { usePulls, usePRFiles, useUpdatePR } from "@/hooks/use-pulls";
import { api } from "@/lib/api-service";

interface FileChange {
  filename: string;
  additions: number;
  deletions: number;
  status: "added" | "modified" | "deleted";
}

interface Issue {
  id: string;
  label: string;
  file: string;
  old_code: string;
  new_code: string;
  severity?: "critical" | "high" | "medium" | "low";
}

/** Renders a code pane with line numbers. */
function CodePane({
  content,
  highlightFrom,
  highlightTo,
}: {
  content: string;
  highlightFrom?: number;
  highlightTo?: number;
}) {
  const lines = content.split("\n");
  return (
    <div className="max-h-[400px] overflow-auto rounded-xl border border-slate-200 bg-white">
      {lines.map((line, i) => {
        const n = i + 1;
        const inRange =
          highlightFrom != null && highlightTo != null && n >= highlightFrom && n <= highlightTo;
        return (
          <div key={i} className={`flex ${inRange ? "bg-indigo-50" : n % 2 === 0 ? "bg-slate-50/30" : ""}`}>
            <span className="w-10 shrink-0 select-none text-right pr-2 pt-1 text-[10px] text-slate-300 font-mono">
              {n}
            </span>
            <pre className="flex-1 py-0.5 font-mono text-xs whitespace-pre-wrap break-words text-slate-700">
              {line || " "}
            </pre>
          </div>
        );
      })}
      {content.trim() === "" && (
        <div className="p-4 text-slate-500 italic">(empty file)</div>
      )}
    </div>
  );
}

/** Main PR Edit page */
export default function PREditPage() {
  const { owner = "", repo = "", prNumber = "0" } = useParams<
    { owner: string; repo: string; prNumber: string }
  >();
  const [, setLocation] = useLocation();
  const { data: pulls, isLoading: isLoadingPulls } = usePulls();
  const pr = pulls?.find((p) => p.number === parseInt(prNumber)) || null;

  const repoOwner = pr?.base?.repo?.owner?.login || pr?.repo?.owner?.login || pr?.repo?.owner || "";
  const repoName = pr?.base?.repo?.name || pr?.repo?.name || "";

  const { data: files, isLoading: isLoadingFiles } = usePRFiles(repoOwner, repoName, parseInt(prNumber));

  const updatePRMutation = useUpdatePR();
  const { toast } = useToast();

  // State for edited code per file
  const [editedCodes, setEditedCodes] = useState<Record<string, string>>({});

  // State for saving
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (files) {
      const initial: Record<string, string> = {};
      files.forEach((f: any) => {
        initial[f.filename] = f.content || "";
      });
      setEditedCodes(initial);
    }
  }, [files]);

  const handleCodeChange = (filePath: string, code: string) => {
    setEditedCodes((prev) => ({ ...prev, [filePath]: code }));
  };

  if (isLoadingPulls || !pr) {
    return (
      <DashboardLayout>
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  if (isLoadingFiles) {
    return (
      <DashboardLayout>
        <div className="flex justify-center py-4"><Loader2 className="w-4 h-4 text-indigo-600 animate-spin" /></div>
      </DashboardLayout>
    );
  }

  // Group files by status for better UI organization
  const modifiedFiles = files?.filter(
    (f: any) => f.status === "modified" || f.status === "added"
  ) || [];
  const deletedFiles = files?.filter((f: any) => f.status === "deleted") || [];

  /** Handle save and create PR */
  const handleSaveAndCreatePR = async () => {
    // Collect all edited file changes
    const fileChanges: Record<string, string> = {};
    modifiedFiles.forEach((f: any) => {
      fileChanges[f.filename] = editedCodes[f.filename] || "";
    });

    if (Object.keys(fileChanges).length === 0) {
      toast({
        title: "No Changes",
        description: "Please edit at least one file before creating the PR.",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      const result = await updatePRMutation.mutateAsync({
        owner: repoOwner,
        repo: repoName,
        number: pr.number,
        data: {
          // Pass the edited codes as PR update data
          body: `AI-assisted corrections applied to PR #${pr.number}\n\n${Object.keys(fileChanges)
            .map((file) => `## ${file}\n\`\`\`\n${fileChanges[file]}\n\`\`\``)
            .join("\n")}`,
          // Additional PR data...
        },
      });

      toast({ title: "Success", description: "PR created successfully with your edits!" });
      setLocation(`/app/pulls/${pr.number}`);
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Failed to create PR.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <DashboardLayout>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6 pb-20"
      >
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => setLocation(`/app/pulls/${prNumber}`)}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to PR
          </Button>
          <div className="flex items-center gap-2">
            <Badge className="bg-indigo-100 text-indigo-800 hover:bg-indigo-100 border-none px-3">
              PR #{pr.number}
            </Badge>
            <Badge variant="outline" className="text-slate-500">
              {pr.state}
            </Badge>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: File list summary */}
          <div className="lg:col-span-1 space-y-6">
            <Card className="border-slate-200 shadow-sm overflow-hidden">
              <CardHeader className="bg-slate-50/50 border-b border-slate-100 py-4 px-6">
                <CardTitle className="text-lg font-bold text-slate-800">
                  {modifiedFiles.length} {modifiedFiles.length !== 1 ? "Files Changed" : "File Changed"}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-3 text-sm text-slate-600">
                  {modifiedFiles.map((f: any) => (
                    <div key={f.filename} className="flex items-center justify-between p-2 rounded-lg bg-slate-50">
                      <span className="truncate max-w-xs">
                        {f.filename}
                      </span>
                      <span className="text-[11px] font-bold">
                        +{f.additions} -{f.deletions}
                      </span>
                    </div>
                  ))}
                  {deletedFiles.length > 0 && (
                    <div>
                      {deletedFiles.map((f: any) => (
                        <div key={f.filename} className="flex items-center justify-between p-2 rounded-lg bg-slate-100 text-slate-500">
                          <span className="line-through text-slate-400 truncate max-w-xs">
                            {f.filename}
                          </span>
                          <span className="text-[11px] font-bold text-slate-400">
                            +0 -{f.deletions}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Summary stats */}
            <Card className="border-slate-200 shadow-sm overflow-hidden">
              <CardHeader className="bg-slate-50/50 border-b border-slate-100 py-4 px-6">
                <CardTitle className="text-lg font-bold text-slate-800">Summary</CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <p className="text-slate-600 mb-4">
                  <strong>Additions:</strong> {files?.reduce((sum: any, f: any) => sum + (f.additions || 0), 0)}
                </p>
                <p className="text-slate-600 mb-4">
                  <strong>Deletions:</strong> {files?.reduce((sum: any, f: any) => sum + (f.deletions || 0), 0)}
                </p>
                <p className="text-slate-600">
                  <strong>Modified:</strong> {modifiedFiles.length} files
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Center: File editors */}
          <div className="lg:col-span-2 space-y-6">
            {modifiedFiles.map((file: any, idx: number) => {
              const originalContent = files?.find((f: any) => f.filename === file.filename)?.content || "";
              const editedContent = editedCodes[file.filename] || originalContent;
              const isEdited = editedContent !== originalContent;

              return (
                <Card
                  key={idx}
                  className={`border-slate-200 shadow-sm overflow-hidden ${isEdited ? "border-indigo-500/30 bg-indigo-50/10" : ""}`}
                >
                  <CardHeader className="bg-slate-50/50 border-b border-slate-100 py-4 px-6 flex flex-row items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${isEdited ? "bg-indigo-100 text-indigo-600" : "bg-white text-slate-300"}`}>
                        <Code2 className="w-4 h-4" /> {file.filename}
                      </div>
                      <span className="text-[11px] text-slate-500">
                        {isEdited ? "✓ Edited" : "View only"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className="text-[10px] text-indigo-600"
                        style={{ background: isEdited ? "indigo-100" : "transparent" }}
                      >
                        {isEdited ? "Modified" : "Original"}
                      </Badge>
                      <span className="text-[10px] text-slate-400">
                        +{file.additions} -{file.deletions}
                      </span>
                    </div>
                  </CardHeader>

                  <CardContent className="p-0">
                    <div className="grid grid-cols-1 lg:grid-cols-2 h-full">
                      {/* Left: Current Code */}
                      <div className="p-6 bg-slate-50 border-r border-slate-100">
        <div className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-3 flex items-center justify-between">
          <span>Current Code</span>
        </div>
        <CodePane content={editedContent} />
      </div>

                      {/* Right: Proposed/Edited Code */}
                      <div className="p-6">
        <div className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-3 flex justify-between items-center">
          <span>Proposed Fix (Editable)</span>
          <Badge
            className="bg-indigo-100 text-indigo-700 hover:bg-indigo-100 border-none text-[9px]"
            style={{ background: isEdited ? "indigo-100" : "indigo-100" }}
          >
            {isEdited ? "Modified" : "Default"}
          </Badge>
        </div>
        <Textarea
          className="min-h-[250px] font-mono text-xs bg-slate-900 text-indigo-300 border-indigo-500 focus:ring-indigo-500 p-4 leading-relaxed"
          value={editedContent}
          onChange={(e) => handleCodeChange(file.filename, e.target.value)}
          placeholder="// Edit the code here to modify the proposed changes..."
        />
      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
            {modifiedFiles.length === 0 && (
              <div className="p-12 text-center text-slate-500">
                <Code2 className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p>No modified files in this PR</p>
              </div>
            )}
          </div>
        </div>

        {/* Save & Create PR section at bottom */}
        <div className="pt-10 flex flex-col items-center gap-3 sticky bottom-8 z-30">
          <div className="flex items-center gap-2 text-sm text-slate-500 bg-white/90 px-3 py-1 rounded-full border border-slate-100 shadow-sm">
            {modifiedFiles.length} of {modifiedFiles.length + deletedFiles.length} files {modifiedFiles.length > 0 ? "ready" : "no changes"}
          </div>

          <Button
            onClick={handleSaveAndCreatePR}
            disabled={updatePRMutation.isPending || modifiedFiles.length === 0}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-16 h-16 text-xl font-bold shadow-2xl shadow-indigo-200 group rounded-full border-4 border-white transition-all transform hover:scale-105 active:scale-95"
          >
            {updatePRMutation.isPending ? (
              <>
                <Loader2 className="w-6 h-6 mr-3 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <GitPullRequest className="w-6 h-6 mr-3 fill-current" />
                Create Pull Request
                <ArrowRight className="w-6 h-6 ml-3 group-hover:translate-x-1 transition-transform" />
              </>
            )}
          </Button>

          <p className="text-xs text-slate-500">
            {modifiedFiles.length} files edited and ready for PR
          </p>
        </div>
      </motion.div>
    </DashboardLayout>
  );
}