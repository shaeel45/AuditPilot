import React from "react";
import { motion } from "framer-motion";
import { Github, Loader2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useRepos, useAuthStatus } from "@/hooks/use-repos";
import { useLocation } from "wouter";
import DashboardLayout from "./DashboardLayout";

export default function ReposPage() {
  const { data: repos, isLoading: isLoadingRepos } = useRepos();
  const { data: authStatus } = useAuthStatus();
  const [, setLocation] = useLocation();

  const handleSelect = (repo: any) => {
    setLocation(`/app/audit/${repo.owner.login}/${repo.name}`);
  };

  if (isLoadingRepos) {
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
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        {!repos || repos.length === 0 ? (
          <Card className="p-12 text-center border-dashed">
            <Github className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-900">No Repositories Found</h3>
            <p className="text-slate-500 mb-6">Make sure you have repositories in your GitHub account.</p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {repos.map((repo: any) => (
              <div
                key={repo.id}
                onClick={() => handleSelect(repo)}
                className="group bg-white p-6 rounded-xl border border-slate-200 hover:border-indigo-300 hover:shadow-lg hover:shadow-indigo-500/10 cursor-pointer transition-all duration-200"
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-slate-100 rounded-lg group-hover:bg-indigo-50 transition-colors">
                      <Github className="w-5 h-5 text-slate-700 group-hover:text-indigo-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900 truncate max-w-[180px]">{repo.name}</h3>
                      <div className="text-xs text-slate-500 flex items-center gap-2 mt-1">
                        <span>{repo.language || "Unknown"}</span>
                        <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                        <span>Updated {new Date(repo.updated_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                  <Badge variant="secondary" className="bg-slate-100 text-slate-600 group-hover:bg-indigo-100 group-hover:text-indigo-700">{repo.stargazers_count} ★</Badge>
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <div className="text-xs text-slate-400">{repo.default_branch} branch</div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 -mr-2"
                  >
                    Run Audit <ArrowRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </motion.div>
    </DashboardLayout>
  );
}
