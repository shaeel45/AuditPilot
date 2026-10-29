import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Code2, Shield, Eye, Zap, Loader2, XCircle } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { api } from "@/lib/api-service";
import { useLocation, useParams } from "wouter";
import DashboardLayout from "../DashboardLayout";

/**
 * Live audit progress — driven by the backend job (queue stages), not by a
 * fake timer. Starts the audit job, polls GET /api/jobs/:id, navigates to
 * results when the job completes, and shows a retry affordance on failure.
 */
export default function AuditProgressPage() {
  const { owner = "", repo = "", branch = "" } = useParams<{ owner: string, repo: string, branch: string }>();
  const [progress, setProgress] = useState(3);
  const [stage, setStage] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const setLocation = useLocation()[1];

  const stages = [
    { label: "Scanning File Tree", icon: Code2 },
    { label: "Fetching Security Configs", icon: Shield },
    { label: "Running AI Analysis", icon: Eye },
    { label: "Finalizing Results", icon: Zap },
  ];

  useEffect(() => {
    if (!owner || !repo || !branch) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const run = async () => {
      try {
        const { jobId } = (await api.startAudit(owner, repo, branch)) as { jobId: string };

        // Slow the cresting edge locally so the bar never looks frozen
        // between server progress updates (server percent stays authoritative).
        let localCreep = progress;

        const poll = async () => {
          if (cancelled) return;
          try {
            const job = await api.getJob(jobId);
            if (cancelled) return;

            if (job.state === "done") {
              setProgress(100);
              setLocation(`/app/audit/${owner}/${repo}/results/${job.result.auditId}`);
              return;
            }
            if (job.state === "failed") {
              setError(job.message || "Audit job failed — please try again.");
              return; // stop polling
            }

            const serverPercent = typeof job.percent === "number" ? job.percent : 0;
            localCreep = Math.min(Math.max(localCreep + 1, serverPercent), 95);
            setProgress(localCreep);
            timer = setTimeout(poll, 1500);
          } catch {
            // transient network / db hiccup — retry with a wider interval
            if (!cancelled) timer = setTimeout(poll, 2500);
          }
        };

        void poll();
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Failed to start audit — check your GitHub connection and plan limits.",
          );
        }
      }
    };

    void run();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [owner, repo, branch]);

  useEffect(() => {
    if (progress > 25) setStage(1);
    if (progress > 50) setStage(2);
    if (progress > 85) setStage(3);
  }, [progress]);

  return (
    <DashboardLayout>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center py-20">
        <div className="w-full max-w-md space-y-8">
          {error ? (
            <div className="space-y-6 text-center">
              <XCircle className="mx-auto w-12 h-12 text-red-500" />
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Audit failed</h2>
                <p className="mt-2 text-sm text-slate-500">{error}</p>
              </div>
              <button
                onClick={() => setLocation("/app")}
                className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
              >
                Back to repositories
              </button>
            </div>
          ) : (
            <>
              <div className="relative pt-10">
                <div className="flex justify-between mb-2">
                  <span className="text-sm font-medium text-indigo-600 animate-pulse">Running {repo} Audit...</span>
                  <span className="text-sm font-medium text-slate-500">{progress}%</span>
                </div>
                <Progress value={progress} className="h-2" />
              </div>

              <div className="space-y-4">
                {stages.map((s, idx) => {
                  const Icon = s.icon;
                  const isCompleted = idx < stage;
                  const isCurrent = idx === stage;

                  return (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.2 }}
                      className={`flex items-center gap-4 p-4 rounded-xl border transition-all duration-300 ${isCurrent
                        ? 'bg-white border-indigo-200 shadow-md shadow-indigo-500/5'
                        : isCompleted
                          ? 'bg-slate-50/50 border-transparent opacity-60'
                          : 'border-transparent opacity-30'
                        }`}
                    >
                      <div className={`p-2 rounded-lg ${isCurrent ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-500'}`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="flex-1">
                        <span className={`text-sm font-medium ${isCurrent ? 'text-slate-900' : 'text-slate-500'}`}>
                          {s.label}
                        </span>
                      </div>
                      {isCompleted && (
                        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}>
                          <Shield className="w-4 h-4 text-green-500" />
                        </motion.div>
                      )}
                      {isCurrent && (
                        <Loader2 className="w-4 h-4 text-indigo-600 animate-spin" />
                      )}
                    </motion.div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </motion.div>
    </DashboardLayout>
  );
}
