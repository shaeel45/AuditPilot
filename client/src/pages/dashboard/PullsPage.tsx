import React from "react";
import { motion } from "framer-motion";
import { GitPullRequest, Loader2, Github, ArrowRight, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { usePulls } from "@/hooks/use-pulls";
import { useLocation } from "wouter";
import DashboardLayout from "./DashboardLayout";

export default function PullsPage() {
  const { data: pulls, isLoading } = usePulls();
  const [, setLocation] = useLocation();

  const handleSelect = (pr: any) => {
    setLocation(`/app/pulls/${pr.number}`);
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
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        {!pulls || pulls.length === 0 ? (
          <Card className="p-12 text-center border-dashed">
            <GitPullRequest className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-900">No Open Pull Requests</h3>
            <p className="text-slate-500 mb-6">Open a PR on GitHub to see it analyzed here.</p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {pulls.map((pr: any) => (
              <Card
                key={pr.id}
                onClick={() => handleSelect(pr)}
                className="p-6 bg-white border border-slate-200 hover:border-indigo-300 hover:shadow-lg transition-all cursor-pointer group"
              >
                <div className="flex justify-between items-start">
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-slate-100 rounded-xl group-hover:bg-indigo-50 transition-colors">
                      <GitPullRequest className="w-6 h-6 text-slate-600 group-hover:text-indigo-600" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 text-lg group-hover:text-indigo-700 transition-colors">{pr.title}</h3>
                      <div className="flex items-center gap-3 mt-2 text-sm text-slate-500">
                        <span className="flex items-center gap-1.5"><Github className="w-3.5 h-3.5" /> {pr.base?.repo?.full_name}</span>
                        <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                        <span className="flex items-center gap-1.5 font-mono">#{pr.number}</span>
                        <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                        <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> {new Date(pr.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2 text-right">
                    <Badge variant={pr.state === 'open' ? 'default' : 'secondary'} className="bg-green-100 text-green-700 capitalize border-none px-3">
                      {pr.state}
                    </Badge>
                  </div>
                </div>
                <div className="mt-6 flex items-center justify-between border-t pt-4 border-slate-50">
                  <div className="flex items-center gap-2">
                    <img src={pr.user?.avatar_url} className="w-5 h-5 rounded-full" alt="" />
                    <span className="text-xs text-slate-500">{pr.user?.login}</span>
                  </div>
                  <Button variant="ghost" size="sm" className="text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50">
                    Audit Changes <ArrowRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </motion.div>
    </DashboardLayout>
  );
}
