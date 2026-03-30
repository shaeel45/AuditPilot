import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Code2, Shield, Eye, Zap, Loader2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { useRepoAudit } from "@/hooks/use-audits";
import { useLocation, useParams } from "wouter";
import DashboardLayout from "../DashboardLayout";

export default function AuditProgressPage() {
  const { owner = "", repo = "", branch = "" } = useParams<{ owner: string, repo: string, branch: string }>();
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState(0);
  const [, setLocation] = useLocation();
  const auditMutation = useRepoAudit();

  const stages = [
    { label: "Scanning File Tree", icon: Code2 },
    { label: "Fetching Security Configs", icon: Shield },
    { label: "Running AI Analysis", icon: Eye },
    { label: "Finalizing Results", icon: Zap },
  ];

  useEffect(() => {
    if (owner && repo && branch) {
      auditMutation.mutate({ owner, repo, branch }, {
        onSuccess: (data) => {
          // data.audit contains the new audit ID
          setLocation(`/app/audit/${owner}/${repo}/results/${data.audit._id}`);
        }
      });
    }
  }, [owner, repo, branch]);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((p) => {
        if (auditMutation.isSuccess) {
          if (p >= 100) {
            clearInterval(interval);
            return 100;
          }
          return Math.min(100, p + 5);
        }

        if (p >= 95) return 95;
        return p + 1;
      });
    }, 100);

    return () => clearInterval(interval);
  }, [auditMutation.isSuccess]);

  useEffect(() => {
    if (progress > 25) setStage(1);
    if (progress > 50) setStage(2);
    if (progress > 85) setStage(3);
  }, [progress]);

  return (
    <DashboardLayout>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center py-20">
        <div className="w-full max-w-md space-y-8">
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
        </div>
      </motion.div>
    </DashboardLayout>
  );
}
