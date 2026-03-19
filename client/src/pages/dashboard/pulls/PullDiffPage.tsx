import React from "react";
import { motion } from "framer-motion";
import { Github, ArrowRight, ExternalLink, GitPullRequest } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePulls } from "@/hooks/use-pulls";
import { useLocation, useParams } from "wouter";
import DashboardLayout from "../DashboardLayout";

export default function PullDiffPage() {
  const { number } = useParams<{ number: string }>();
  const [, setLocation] = useLocation();
  const { data: pulls } = usePulls();
  const pr = pulls?.find(p => p.number === parseInt(number));

  const repoOwner = pr?.base?.repo?.owner?.login || pr?.repo?.owner?.login || pr?.repo?.owner || pr?.owner?.login || pr?.owner;
  const repoName = pr?.base?.repo?.name || pr?.repo?.name || pr?.name;

  return (
    <DashboardLayout>
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-24 h-24 bg-indigo-100 rounded-full flex items-center justify-center mb-8 shadow-xl shadow-indigo-500/10 animate-bounce">
          <GitPullRequest className="w-12 h-12 text-indigo-600" />
        </div>
        
        <h2 className="text-4xl font-extrabold text-slate-900 mb-4 tracking-tight">Corrections Applied!</h2>
        <p className="text-slate-500 mb-12 max-w-md text-lg leading-relaxed">
          AI has pushed the suggested security and performance corrections to your Pull Request <span className="text-slate-900 font-mono font-bold">#{number}</span> branch.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center w-full max-w-sm">
          {pr?.html_url ? (
            <Button asChild size="lg" className="bg-black hover:bg-slate-800 text-white h-14 px-8 font-bold shadow-lg">
              <a href={pr.html_url} target="_blank" rel="noopener noreferrer">
                <Github className="w-5 h-5 mr-3" />
                View on GitHub
                <ExternalLink className="w-4 h-4 ml-2 opacity-50" />
              </a>
            </Button>
          ) : (
            <Button size="lg" className="bg-black hover:bg-slate-800 text-white h-14 px-8 font-bold">
               <a href={`https://github.com/${repoOwner}/${repoName}/pull/${number}`} target="_blank" rel="noopener noreferrer">
                  <Github className="w-5 h-5 mr-3" />
                  View PR on GitHub
               </a>
            </Button>
          )}
          
          <Button variant="outline" size="lg" onClick={() => setLocation('/app/pulls')} className="h-14 px-8 border-slate-200 text-slate-600 font-bold hover:bg-slate-50">
            Back to List
            <ArrowRight className="w-5 h-5 ml-2 opacity-50" />
          </Button>
        </div>

        <div className="mt-16 p-6 bg-slate-50 rounded-2xl border border-slate-100 max-w-lg w-full">
           <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mb-3">Next Steps</p>
           <ul className="text-left space-y-3 text-sm text-slate-600">
             <li className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-white flex items-center justify-center text-[10px] font-bold border border-slate-200 shrink-0 mt-0.5">1</div>
                <span>Verify that the AI changes didn't break any functionality.</span>
             </li>
             <li className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-white flex items-center justify-center text-[10px] font-bold border border-slate-200 shrink-0 mt-0.5">2</div>
                <span>Discuss the improvements with your team in the PR comments.</span>
             </li>
             <li className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-white flex items-center justify-center text-[10px] font-bold border border-slate-200 shrink-0 mt-0.5">3</div>
                <span>Merge the PR when you are satisfied with the results.</span>
             </li>
           </ul>
        </div>
      </motion.div>
    </DashboardLayout>
  );
}
