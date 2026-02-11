import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Check, Github, ArrowRight, Shield, Zap, Eye, GitPullRequest, Code2, AlertCircle, CheckCircle2, Loader2, ArrowLeft } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";

// Types
type Step = 'repos' | 'audit' | 'results' | 'fix' | 'pr' | 'diff';

type Issue = {
  id: string;
  type: 'security' | 'performance' | 'accessibility';
  severity: 'critical' | 'medium' | 'low';
  file: string;
  description: string;
  fixAvailable: boolean;
  oldCode?: string;
  newCode?: string;
};

// Mock Data
const REPOS = [
  { id: 1, name: "auditpilot-frontend", framework: "React", lang: "TypeScript", stars: 124, branches: ["master", "develop", "feature/auth"] },
  { id: 2, name: "auditpilot-api", framework: "Node.js", lang: "TypeScript", stars: 89, branches: ["master", "staging"] },
  { id: 3, name: "marketing-site", framework: "Next.js", lang: "TypeScript", stars: 12, branches: ["master"] },
  { id: 4, name: "design-system", framework: "Storybook", lang: "TypeScript", stars: 45, branches: ["master", "v2-dev"] },
];

const ISSUES: Issue[] = [
  { 
    id: "1", 
    type: "security", 
    severity: "critical", 
    file: "package.json", 
    description: "Vulnerable dependency: 'lodash' < 4.17.21", 
    fixAvailable: true,
    oldCode: '"lodash": "^4.17.15",',
    newCode: '"lodash": "^4.17.21",'
  },
  { 
    id: "2", 
    type: "performance", 
    severity: "medium", 
    file: "src/App.tsx", 
    description: "Large layout shift detected on initial render", 
    fixAvailable: true,
    oldCode: '<img src={hero} />',
    newCode: '<img src={hero} width={1200} height={600} loading="eager" />'
  },
  { 
    id: "3", 
    type: "accessibility", 
    severity: "medium", 
    file: "src/components/Button.tsx", 
    description: "Missing aria-label on icon-only button", 
    fixAvailable: true,
    oldCode: '<button><Icon /></button>',
    newCode: '<button aria-label="Close modal"><Icon /></button>'
  },
  { id: "4", type: "security", severity: "medium", file: "server/index.ts", description: "Missing rate limiting middleware", fixAvailable: false },
  { 
    id: "5", 
    type: "performance", 
    severity: "low", 
    file: "public/hero.png", 
    description: "Image not optimized (2.4MB)", 
    fixAvailable: true,
    oldCode: '// Original high-res image',
    newCode: '// Optimized WebP alternative'
  },
];

export default function Dashboard() {
  const [step, setStep] = useState<Step>('repos');
  const [selectedRepo, setSelectedRepo] = useState<any>(null);
  
  // Navigation handling
  const goToStep = (s: Step) => setStep(s);

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200 hidden md:flex flex-col">
        <div className="h-16 flex items-center px-6 border-b border-slate-100">
          <div className="w-6 h-6 rounded bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center text-white text-xs font-bold mr-2">A</div>
          <span className="font-bold text-slate-800">AuditPilot</span>
        </div>
        
        <div className="p-4 space-y-1">
          <div className="px-3 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">Platform</div>
          <NavItem active={step === 'repos'} icon={<Code2 className="w-4 h-4" />} label="Repositories" onClick={() => goToStep('repos')} />
          <NavItem active={false} icon={<GitPullRequest className="w-4 h-4" />} label="Pull Requests" />
          <NavItem active={false} icon={<Shield className="w-4 h-4" />} label="Security Policy" />
          
          <div className="mt-8 px-3 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">Account</div>
          <NavItem active={false} icon={<Zap className="w-4 h-4" />} label="Billing" />
          <NavItem active={false} icon={<Eye className="w-4 h-4" />} label="Settings" />
        </div>

        <div className="mt-auto p-4 border-t border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-slate-200"></div>
            <div>
              <div className="text-sm font-medium text-slate-900">Demo User</div>
              <div className="text-xs text-slate-500">Free Plan</div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto bg-mesh-light">
        <header className="h-16 bg-white/80 backdrop-blur-sm border-b border-slate-200/50 flex items-center justify-between px-8 sticky top-0 z-10">
          <h1 className="text-lg font-semibold text-slate-800">
            {step === 'repos' && "Select Repository"}
            {step === 'audit' && "Running Audit..."}
            {step === 'results' && "Audit Results"}
            {step === 'fix' && "Review Fixes"}
            {step === 'pr' && "Pull Request Created"}
            {step === 'diff' && "Review Changes"}
          </h1>
          {step !== 'repos' && (
            <Button variant="ghost" size="sm" onClick={() => setStep('repos')} className="text-slate-500">
              Cancel
            </Button>
          )}
        </header>

        <div className="max-w-5xl mx-auto p-8">
          <AnimatePresence mode="wait">
            {step === 'repos' && <RepoSelection key="repos" onSelect={(repo) => { setSelectedRepo(repo); goToStep('audit'); }} />}
            {step === 'audit' && <AuditProgress key="audit" onComplete={() => goToStep('results')} />}
            {step === 'results' && <AuditResults key="results" issues={ISSUES} onFix={() => goToStep('fix')} />}
            {step === 'fix' && <AutoFixConfirmation key="fix" issues={ISSUES.filter(i => i.fixAvailable)} onConfirm={() => goToStep('pr')} onBack={() => goToStep('results')} onReviewDiff={() => goToStep('diff')} />}
            {step === 'diff' && <CodeDiffView key="diff" issues={ISSUES.filter(i => i.fixAvailable)} onBack={() => goToStep('fix')} />}
            {step === 'pr' && <PRSuccess key="pr" repo={selectedRepo} />}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}

function NavItem({ active, icon, label, onClick }: { active: boolean, icon: any, label: string, onClick?: () => void }) {
  return (
    <div 
      onClick={onClick}
      className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium cursor-pointer transition-colors ${active ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
    >
      {icon}
      {label}
    </div>
  );
}

// ------------------------------------------------------------------
// STEP 1: REPO SELECTION
// ------------------------------------------------------------------
function RepoSelection({ onSelect }: { onSelect: (repo: any) => void }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {REPOS.map((repo) => (
          <div 
            key={repo.id}
            onClick={() => onSelect(repo)}
            className="group bg-white p-6 rounded-xl border border-slate-200 hover:border-indigo-300 hover:shadow-lg hover:shadow-indigo-500/10 cursor-pointer transition-all duration-200"
          >
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-slate-100 rounded-lg group-hover:bg-indigo-50 transition-colors">
                  <Github className="w-5 h-5 text-slate-700 group-hover:text-indigo-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900">{repo.name}</h3>
                  <div className="text-xs text-slate-500 flex items-center gap-2 mt-1">
                    <span>{repo.lang}</span>
                    <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                    <span>Last updated 2h ago</span>
                  </div>
                </div>
              </div>
              <Badge variant="secondary" className="bg-slate-100 text-slate-600 group-hover:bg-indigo-100 group-hover:text-indigo-700">{repo.framework}</Badge>
            </div>
            <div className="mt-4 flex items-center justify-between">
              <div className="text-xs text-slate-400">master branch</div>
              <Button size="sm" variant="ghost" className="text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 -mr-2">
                Run Audit <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

// ------------------------------------------------------------------
// STEP 2: AUDIT PROGRESS
// ------------------------------------------------------------------
function AuditProgress({ onComplete }: { onComplete: () => void }) {
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState(0);

  const stages = [
    { label: "Scanning security vulnerabilities...", icon: Shield },
    { label: "Analyzing performance metrics...", icon: Zap },
    { label: "Checking accessibility compliance...", icon: Eye },
    { label: "Generating fix recommendations...", icon: Code2 },
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress(p => {
        if (p >= 100) {
          clearInterval(interval);
          setTimeout(onComplete, 800);
          return 100;
        }
        return p + 2;
      });
    }, 50);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (progress > 25) setStage(1);
    if (progress > 50) setStage(2);
    if (progress > 85) setStage(3);
  }, [progress]);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center py-20">
      <div className="w-full max-w-md space-y-8">
        <div className="relative pt-10">
           <div className="flex justify-between mb-2">
              <span className="text-sm font-medium text-indigo-600 animate-pulse">Running Audit...</span>
              <span className="text-sm font-medium text-slate-500">{progress}%</span>
           </div>
           <Progress value={progress} className="h-2" />
        </div>

        <div className="space-y-4">
          {stages.map((s, idx) => {
            const Icon = s.icon;
            const isCompleted = idx < stage;
            const isCurrent = idx === stage;
            const isPending = idx > stage;

            return (
              <motion.div 
                key={idx}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.2 }}
                className={`flex items-center gap-4 p-4 rounded-xl border transition-all duration-300 ${
                  isCurrent 
                    ? 'bg-white border-indigo-200 shadow-md shadow-indigo-500/5' 
                    : isCompleted 
                      ? 'bg-slate-50/50 border-transparent opacity-60' 
                      : 'border-transparent opacity-30'
                }`}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  isCompleted ? 'bg-green-100 text-green-600' : isCurrent ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-400'
                }`}>
                  {isCompleted ? <Check className="w-5 h-5" /> : <Icon className="w-4 h-4" />}
                </div>
                <span className={`font-medium ${isCurrent ? 'text-slate-900' : 'text-slate-500'}`}>{s.label}</span>
                {isCurrent && <Loader2 className="w-4 h-4 text-indigo-400 animate-spin ml-auto" />}
              </motion.div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}

// ------------------------------------------------------------------
// STEP 3: AUDIT RESULTS
// ------------------------------------------------------------------
function AuditResults({ issues, onFix }: { issues: Issue[], onFix: () => void }) {
  const criticalCount = issues.filter(i => i.severity === 'critical').length;
  const score = 72;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      {/* Score Header */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="col-span-1 bg-white rounded-2xl border border-slate-200 p-6 flex flex-col items-center justify-center shadow-sm">
          <div className="relative w-32 h-32 flex items-center justify-center">
            <svg className="w-full h-full transform -rotate-90">
              <circle cx="64" cy="64" r="56" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-slate-100" />
              <circle cx="64" cy="64" r="56" stroke="currentColor" strokeWidth="8" fill="transparent" strokeDasharray={351} strokeDashoffset={351 - (351 * score) / 100} className="text-indigo-600" />
            </svg>
            <div className="absolute flex flex-col items-center">
              <span className="text-4xl font-bold text-slate-900">{score}</span>
              <span className="text-xs uppercase tracking-wider text-slate-500 font-medium">Score</span>
            </div>
          </div>
        </div>

        <div className="col-span-3 grid grid-cols-3 gap-4">
           <SummaryCard title="Security" count={2} color="text-red-600" bg="bg-red-50" icon={Shield} />
           <SummaryCard title="Performance" count={2} color="text-amber-600" bg="bg-amber-50" icon={Zap} />
           <SummaryCard title="Accessibility" count={1} color="text-emerald-600" bg="bg-emerald-50" icon={Eye} />
        </div>
      </div>

      {/* Issues List */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <h2 className="font-semibold text-slate-800">Detected Issues</h2>
          <Badge variant="outline" className="bg-white border-slate-200 text-slate-600">{issues.length} Issues Found</Badge>
        </div>
        <div className="divide-y divide-slate-100">
          {issues.map((issue) => (
            <div key={issue.id} className="p-6 hover:bg-slate-50 transition-colors flex items-start gap-4 group">
              <div className={`mt-1 w-2 h-2 rounded-full ${issue.severity === 'critical' ? 'bg-red-500' : issue.severity === 'medium' ? 'bg-amber-500' : 'bg-slate-400'}`}></div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-slate-900">{issue.description}</span>
                  {issue.fixAvailable && (
                    <Badge variant="secondary" className="bg-indigo-50 text-indigo-700 border-indigo-100 text-[10px] px-2 h-5">Auto-fix</Badge>
                  )}
                </div>
                <div className="flex items-center gap-4 text-xs text-slate-500 font-mono">
                  <span>{issue.file}</span>
                  <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                  <span className="uppercase">{issue.type}</span>
                </div>
              </div>
              <Button size="sm" variant="ghost" disabled={!issue.fixAvailable} className={`${issue.fixAvailable ? 'text-indigo-600 hover:bg-indigo-50' : 'text-slate-300'}`}>
                {issue.fixAvailable ? 'View Fix' : 'Manual Fix'}
              </Button>
            </div>
          ))}
        </div>
        <div className="p-6 bg-slate-50/50 border-t border-slate-100 flex justify-end">
          <Button onClick={onFix} size="lg" className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-600/20">
            Fix All Issues ({issues.filter(i => i.fixAvailable).length}) <ArrowRight className="ml-2 w-4 h-4" />
          </Button>
        </div>
      </div>
    </motion.div>
  );
}

function SummaryCard({ title, count, color, bg, icon: Icon }: any) {
  return (
    <div className={`rounded-xl p-6 border border-slate-100 flex flex-col justify-between ${bg} bg-opacity-30`}>
      <div className={`w-10 h-10 rounded-lg ${bg} flex items-center justify-center mb-4`}>
        <Icon className={`w-5 h-5 ${color}`} />
      </div>
      <div>
        <div className="text-2xl font-bold text-slate-900">{count}</div>
        <div className="text-sm text-slate-500">{title} Issues</div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------
// STEP 4: AUTO-FIX CONFIRMATION
// ------------------------------------------------------------------
function AutoFixConfirmation({ issues, onConfirm, onBack, onReviewDiff }: { issues: Issue[], onConfirm: () => void, onBack: () => void, onReviewDiff: () => void }) {
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-2xl mx-auto">
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <GitPullRequest className="w-8 h-8 text-indigo-600" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Ready to apply fixes?</h2>
        <p className="text-slate-600">AuditPilot will create a new branch and open a pull request with the following changes.</p>
      </div>

      <Card className="mb-8 border-indigo-100 shadow-xl shadow-indigo-500/5">
        <CardHeader className="bg-slate-50/50 border-b border-slate-100 pb-4 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-medium text-slate-500 uppercase tracking-wider">Changes to be applied</CardTitle>
          <Button variant="ghost" size="sm" onClick={onReviewDiff} className="text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 h-8">
            <Eye className="w-4 h-4 mr-2" />
            Review Changes
          </Button>
        </CardHeader>
        <div className="divide-y divide-slate-100">
          {issues.map(issue => (
             <div key={issue.id} className="p-4 flex items-center gap-4">
               <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
               <div className="flex-1">
                 <div className="text-sm font-medium text-slate-900">{issue.description}</div>
                 <div className="text-xs text-slate-500 font-mono mt-0.5">{issue.file}</div>
               </div>
             </div>
          ))}
        </div>
      </Card>

      <div className="flex gap-4 justify-center">
        <Button variant="outline" onClick={onBack} size="lg" className="h-12 px-8">Cancel</Button>
        <Button onClick={onConfirm} size="lg" className="h-12 px-8 bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-600/20">
          <Github className="mr-2 h-5 w-5" />
          Create Pull Request
        </Button>
      </div>
      
      <p className="text-center text-xs text-slate-400 mt-6">
        Changes are safe and reversible. You can review the code before merging.
      </p>
    </motion.div>
  );
}

// ------------------------------------------------------------------
// STEP 4.5: CODE DIFF VIEW
// ------------------------------------------------------------------
function CodeDiffView({ issues, onBack }: { issues: Issue[], onBack: () => void }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Summary
        </Button>
        <h2 className="text-xl font-bold text-slate-900">Review Code Changes</h2>
      </div>

      <div className="space-y-6">
        {issues.map(issue => (
          <div key={issue.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Code2 className="w-4 h-4 text-slate-500" />
                <span className="text-sm font-mono font-medium text-slate-700">{issue.file}</span>
              </div>
              <Badge variant="outline" className="text-[10px] uppercase">{issue.type}</Badge>
            </div>
            <div className="p-0 font-mono text-xs overflow-x-auto">
              <table className="w-full border-collapse">
                <tbody>
                  <tr className="bg-red-50 text-red-700">
                    <td className="w-8 text-center border-r border-red-100 py-1 select-none text-red-300">-</td>
                    <td className="px-4 py-1 whitespace-pre">{issue.oldCode}</td>
                  </tr>
                  <tr className="bg-green-50 text-green-700">
                    <td className="w-8 text-center border-r border-green-100 py-1 select-none text-green-300">+</td>
                    <td className="px-4 py-1 whitespace-pre">{issue.newCode}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 flex justify-end">
        <Button onClick={onBack} size="lg" className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-600/20">
          Done Reviewing
        </Button>
      </div>
    </motion.div>
  );
}

// ------------------------------------------------------------------
// STEP 5: PR SUCCESS
// ------------------------------------------------------------------
function PRSuccess({ repo }: { repo: any }) {
  const [targetBranch, setTargetBranch] = useState(repo?.branches?.[0] || 'master');
  const [isMerging, setIsMerging] = useState(false);
  const [isMerged, setIsMerged] = useState(false);

  const handleMerge = () => {
    setIsMerging(true);
    setTimeout(() => {
      setIsMerging(false);
      setIsMerged(true);
    }, 2000);
  };

  return (
    <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex flex-col items-center justify-center py-12">
      {!isMerged ? (
        <>
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-8 animate-bounce">
            <Check className="w-10 h-10 text-green-600" />
          </div>
          
          <h2 className="text-3xl font-bold text-slate-900 mb-4 text-center">Pull Request Created!</h2>
          <p className="text-slate-600 text-center max-w-md mb-10">
            We've generated a PR for <span className="font-semibold text-slate-900">{repo?.name || 'your-repo'}</span> with security and performance fixes.
          </p>

          <Card className="w-full max-w-2xl bg-white border border-slate-200 shadow-xl overflow-hidden mb-10">
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Github className="w-5 h-5 text-slate-700" />
                <span className="text-slate-600 font-medium">auditpilot / {repo?.name || 'frontend'}</span>
                <span className="text-slate-400 mx-2">/</span>
                <span className="text-slate-900 font-medium">Pull Request #42</span>
              </div>
              <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-none">Open</Badge>
            </div>
            
            <div className="p-8">
              <h3 className="text-xl font-bold text-slate-900 mb-6">Fix security vulnerabilities & optimize performance</h3>
              
              <div className="space-y-6">
                <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                  <h4 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
                    <GitPullRequest className="w-4 h-4" />
                    Merge Destination
                  </h4>
                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <label className="text-xs text-slate-500 mb-1 block uppercase tracking-wider font-semibold">Select Destination Branch</label>
                      <select 
                        value={targetBranch}
                        onChange={(e) => setTargetBranch(e.target.value)}
                        className="w-full h-10 px-3 rounded-md border border-slate-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        {repo?.branches?.map((b: string) => (
                          <option key={b} value={b}>{b}</option>
                        )) || <option value="master">master</option>}
                      </select>
                    </div>
                    <div className="pt-5">
                      <Button 
                        onClick={handleMerge}
                        disabled={isMerging}
                        className="bg-[#2da44e] hover:bg-[#2c974b] text-white font-semibold h-10"
                      >
                        {isMerging ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <GitPullRequest className="w-4 h-4 mr-2" />}
                        Merge to {targetBranch}
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="space-y-3 text-slate-600 text-sm">
                  <p className="font-medium text-slate-900">PR Summary:</p>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>Upgrades <code>lodash</code> to v4.17.21</li>
                    <li>Adds <code>width</code> and <code>height</code> to images</li>
                    <li>Adds missing <code>aria-label</code> to buttons</li>
                  </ul>
                </div>
              </div>
            </div>
            
            <div className="bg-slate-50 p-4 border-t border-slate-200 flex justify-between items-center">
               <span className="text-xs text-slate-500 italic">generated automatically by AuditPilot</span>
               <Button variant="outline" size="sm" className="text-slate-700">
                 View Original on GitHub
               </Button>
            </div>
          </Card>
        </>
      ) : (
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center">
          <div className="w-20 h-20 bg-indigo-100 rounded-full flex items-center justify-center mb-8 mx-auto">
            <CheckCircle2 className="w-10 h-10 text-indigo-600" />
          </div>
          <h2 className="text-3xl font-bold text-slate-900 mb-4">Successfully Merged!</h2>
          <p className="text-slate-600 mb-10 max-w-md">
            The changes have been merged into the <span className="font-semibold">{targetBranch}</span> branch of <span className="font-semibold">{repo?.name}</span>.
          </p>
          <Button variant="outline" onClick={() => window.location.reload()}>
            Back to Dashboard
          </Button>
        </motion.div>
      )}

      {!isMerged && (
        <Button variant="ghost" onClick={() => window.location.reload()} className="text-slate-400">
          Start New Audit
        </Button>
      )}
    </motion.div>
  );
}

