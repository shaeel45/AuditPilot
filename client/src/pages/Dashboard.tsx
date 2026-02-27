import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Check, Github, ArrowRight, Shield, Zap, Eye, GitPullRequest, Code2, AlertCircle, CheckCircle2, Loader2, ArrowLeft } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { useAudits, useRepoAudit, useBranches, useApplyFix } from "@/hooks/use-audits";
import { useRepos, useAuthStatus } from "@/hooks/use-repos";
import { usePulls, usePRFiles, usePRAudit, usePRFix, usePRMerge } from "@/hooks/use-pulls";

// Types
type Step = 'repos' | 'audit' | 'results' | 'fix' | 'pr' | 'diff' | 'audits' | 'pulls' | 'pull_detail';

type Issue = {
  id: string;
  dbId?: string;
  type: 'security' | 'performance' | 'accessibility';
  severity: 'critical' | 'medium' | 'low';
  file: string;
  description: string;
  fixAvailable?: boolean;
  fix?: {
    old_code: string;
    new_code: string;
  };
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
  const [selectedPR, setSelectedPR] = useState<any>(null);
  const [realAuditIssues, setRealAuditIssues] = useState<any[]>([]);
  const [prIssues, setPrIssues] = useState<any[]>([]);
  const { data: audits, isLoading: isLoadingAudits } = useAudits();
  const { data: repos, isLoading: isLoadingRepos } = useRepos();
  const { data: authStatus, isLoading: isLoadingAuth } = useAuthStatus();
  const auditMutation = useRepoAudit();
  const [, setLocation] = useLocation();
  const local = localStorage.getItem("authenticated");
  useEffect(() => {
    if (!isLoadingAuth && authStatus && !authStatus.authenticated && !local) {
      setLocation("/");
    }
  }, [authStatus, isLoadingAuth, setLocation, local]);

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
          <NavItem active={step === 'audits'} icon={<Shield className="w-4 h-4" />} label="Audits" onClick={() => goToStep('audits')} />
          <NavItem active={step === 'pulls'} icon={<GitPullRequest className="w-4 h-4" />} label="Pull Requests" onClick={() => goToStep('pulls')} />

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
            {step === 'audits' && "Security Audits"}
            {step === 'pulls' && "Open Pull Requests"}
            {step === 'pull_detail' && `PR #${selectedPR?.number}: ${selectedPR?.title}`}
            {step === 'audit' && "Running Audit..."}
            {step === 'results' && "Audit Results"}
            {step === 'fix' && "Review Fixes"}
            {step === 'pr' && "Pull Request Created"}
            {step === 'diff' && "Review Changes"}
          </h1>
          {step !== 'repos' && step !== 'audits' && step !== 'pulls' && (
            <Button variant="ghost" size="sm" onClick={() => setStep('repos')} className="text-slate-500">
              Cancel
            </Button>
          )}
        </header>

        <div className="max-w-5xl mx-auto p-8">
          <AnimatePresence mode="wait">
            {step === 'repos' && (
              <RepoSelection
                key="repos"
                repos={repos || []}
                isLoading={isLoadingRepos}
                onSelect={(repo) => {
                  setSelectedRepo(repo);
                  goToStep('audit');
                  auditMutation.mutate({ owner: repo.owner.login, repo: repo.name }, {
                    onSuccess: (data) => {
                      setRealAuditIssues(data.issues);
                      goToStep('results');
                    },
                    onError: () => {
                      goToStep('repos');
                    }
                  });
                }}
              />
            )}
            {step === 'audit' && <AuditProgress key="audit" isComplete={auditMutation.isSuccess} onComplete={() => { }} />}
            {step === 'results' && <AuditResults key="results" issues={realAuditIssues.length > 0 ? realAuditIssues : ISSUES} onFix={() => goToStep('fix')} />}
            {step === 'fix' && <AutoFixConfirmation key="fix" issues={(realAuditIssues.length > 0 ? realAuditIssues : ISSUES).filter(i => i.fix || i.fixAvailable)} onConfirm={() => goToStep('pr')} onBack={() => goToStep('results')} onReviewDiff={() => goToStep('diff')} />}
            {step === 'diff' && <CodeDiffView key="diff" issues={(realAuditIssues.length > 0 ? realAuditIssues : ISSUES).filter(i => i.fix || i.fixAvailable)} onBack={() => goToStep('fix')} />}
            {step === 'pr' && <PRSuccess key="pr" repo={selectedRepo} issues={(realAuditIssues.length > 0 ? realAuditIssues : ISSUES).filter(i => i.fix || i.fixAvailable)} />}
            {step === 'audits' && <AuditsView key="audits" audits={audits || []} isLoading={isLoadingAudits} />}
            {step === 'pulls' && (
              <PullsView
                onSelect={(pr) => {
                  setSelectedPR(pr);
                  goToStep('pull_detail');
                }}
              />
            )}
            {step === 'pull_detail' && (
              <PullDetailView
                pr={selectedPR}
                onBack={() => goToStep('pulls')}
                onIssuesFound={(issues) => setPrIssues(issues)}
              />
            )}
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
function RepoSelection({ repos, isLoading, onSelect }: { repos: any[], isLoading: boolean, onSelect: (repo: any) => void }) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
      {repos.length === 0 ? (
        <Card className="p-12 text-center border-dashed">
          <Github className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-900">No Repositories Found</h3>
          <p className="text-slate-500 mb-6">Make sure you have repositories in your GitHub account.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {repos.map((repo) => (
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
                <Button size="sm" variant="ghost" className="text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 -mr-2">
                  Run Audit <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}

// ------------------------------------------------------------------
// STEP 2: AUDIT PROGRESS
// ------------------------------------------------------------------
function AuditProgress({ onComplete, isComplete }: { onComplete: () => void, isComplete: boolean }) {
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
        if (isComplete) {
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
  }, [isComplete]);

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
                className={`flex items-center gap-4 p-4 rounded-xl border transition-all duration-300 ${isCurrent
                  ? 'bg-white border-indigo-200 shadow-md shadow-indigo-500/5'
                  : isCompleted
                    ? 'bg-slate-50/50 border-transparent opacity-60'
                    : 'border-transparent opacity-30'
                  }`}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isCompleted ? 'bg-green-100 text-green-600' : isCurrent ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-400'
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
  const securityCount = issues.filter(i => i.type === 'security').length;
  const performanceCount = issues.filter(i => i.type === 'performance').length;
  const accessibilityCount = issues.filter(i => i.type === 'accessibility').length;

  // Calculate a simple score: 100 base, -15 for critical, -7 for medium, -3 for low
  const baseScore = 100;
  const criticalPenalty = issues.filter(i => i.severity === 'critical').length * 15;
  const mediumPenalty = issues.filter(i => i.severity === 'medium').length * 7;
  const lowPenalty = issues.filter(i => i.severity === 'low').length * 3;
  const score = Math.max(0, baseScore - criticalPenalty - mediumPenalty - lowPenalty);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      {/* Score Header */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="col-span-1 bg-white rounded-2xl border border-slate-200 p-6 flex flex-col items-center justify-center shadow-sm">
          <div className="relative w-32 h-32 flex items-center justify-center">
            <svg className="w-full h-full transform -rotate-90">
              <circle cx="64" cy="64" r="56" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-slate-100" />
              <circle cx="64" cy="64" r="56" stroke="currentColor" strokeWidth="8" fill="transparent" strokeDasharray={351} strokeDashoffset={351 - (351 * score) / 100} className="text-indigo-600 transition-all duration-1000 ease-out" />
            </svg>
            <div className="absolute flex flex-col items-center">
              <span className="text-4xl font-bold text-slate-900">{score}</span>
              <span className="text-xs uppercase tracking-wider text-slate-500 font-medium">Score</span>
            </div>
          </div>
        </div>

        <div className="col-span-3 grid grid-cols-3 gap-4">
          <SummaryCard title="Security" count={securityCount} color="text-red-600" bg="bg-red-50" icon={Shield} />
          <SummaryCard title="Performance" count={performanceCount} color="text-amber-600" bg="bg-amber-50" icon={Zap} />
          <SummaryCard title="Accessibility" count={accessibilityCount} color="text-emerald-600" bg="bg-emerald-50" icon={Eye} />
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
                  {(issue.fix || issue.fixAvailable) && (
                    <Badge variant="secondary" className="bg-indigo-50 text-indigo-700 border-indigo-100 text-[10px] px-2 h-5">Auto-fix</Badge>
                  )}
                </div>
                <div className="flex items-center gap-4 text-xs text-slate-500 font-mono">
                  <span>{issue.file}</span>
                  <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                  <span className="uppercase">{issue.type}</span>
                </div>
              </div>
              <Button size="sm" variant="ghost" disabled={!(issue.fix || issue.fixAvailable)} className={`${(issue.fix || issue.fixAvailable) ? 'text-indigo-600 hover:bg-indigo-50' : 'text-slate-300'}`}>
                {(issue.fix || issue.fixAvailable) ? 'View Fix' : 'Manual Fix'}
              </Button>
            </div>
          ))}
        </div>
        <div className="p-6 bg-slate-50/50 border-t border-slate-100 flex justify-end">
          <Button onClick={onFix} size="lg" className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-600/20">
            Fix All Issues ({issues.filter(i => i.fix || i.fixAvailable).length}) <ArrowRight className="ml-2 w-4 h-4" />
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
        {issues.map((issue, idx) => (
          <div key={idx} className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Code2 className="w-4 h-4 text-slate-500" />
                <span className="text-sm font-mono font-medium text-slate-700">{issue.file}</span>
              </div>
              <Badge variant="outline" className="text-[10px] uppercase">{issue.type}</Badge>
            </div>
            <div className="grid grid-cols-2 divide-x divide-slate-200 font-mono text-[11px]">
              {/* Left Side: Old Code */}
              <div className="bg-slate-50/50">
                <div className="px-3 py-1.5 bg-red-50/50 border-b border-red-100/50 text-red-600 text-[10px] font-bold uppercase tracking-wider">Original Code</div>
                <div className="p-4 overflow-x-auto whitespace-pre text-red-700 bg-red-50/20 h-full">
                  <span className="inline-block w-4 mr-2 text-red-300 select-none">-</span>
                  {(issue.fix ? issue.fix.old_code : (issue as any).oldCode) || '// No original code'}
                </div>
              </div>
              {/* Right Side: Fixed Code */}
              <div className="bg-slate-50/50">
                <div className="px-3 py-1.5 bg-green-50/50 border-b border-green-100/50 text-green-600 text-[10px] font-bold uppercase tracking-wider">Fixed Code</div>
                <div className="p-4 overflow-x-auto whitespace-pre text-green-700 bg-green-50/20 h-full">
                  <span className="inline-block w-4 mr-2 text-green-300 select-none">+</span>
                  {(issue.fix ? issue.fix.new_code : (issue as any).newCode) || '// No replacement code'}
                </div>
              </div>
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
function PRSuccess({ repo, issues }: { repo: any, issues: Issue[] }) {
  const { data: branches, isLoading: isLoadingBranches } = useBranches(repo?.owner?.login, repo?.name);
  const fixMutation = useApplyFix();
  const [targetBranch, setTargetBranch] = useState(repo?.default_branch || 'master');
  const [isMerged, setIsMerged] = useState(false);
  const [prUrl, setPrUrl] = useState<string | null>(null);

  useEffect(() => {
    if (branches && branches.length > 0 && !branches.includes(targetBranch)) {
      setTargetBranch(branches[0]);
    }
  }, [branches, targetBranch]);

  const handleCreatePR = () => {
    fixMutation.mutate({
      owner: repo.owner.login,
      repo: repo.name,
      issues,
      targetBranch
    }, {
      onSuccess: (data) => {
        setPrUrl(data.html_url);
        setIsMerged(true); // Treat "PR Created" as success for this flow
      }
    });
  };

  return (
    <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex flex-col items-center justify-center py-12">
      {!isMerged ? (
        <>
          <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center mb-8">
            <GitPullRequest className="w-10 h-10 text-indigo-600" />
          </div>

          <h2 className="text-3xl font-bold text-slate-900 mb-4 text-center">Finalize Fixes</h2>
          <p className="text-slate-600 text-center max-w-md mb-10">
            Select the destination branch to merge the identified security and performance fixes.
          </p>

          <Card className="w-full max-w-2xl bg-white border border-slate-200 shadow-xl overflow-hidden mb-10">
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Github className="w-5 h-5 text-slate-700" />
                <span className="text-slate-600 font-medium">{repo?.owner?.login || 'auditpilot'} / {repo?.name || 'repo'}</span>
              </div>
              <Badge variant="outline">New PR</Badge>
            </div>

            <div className="p-8">
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
                        disabled={isLoadingBranches}
                        value={targetBranch}
                        onChange={(e) => setTargetBranch(e.target.value)}
                        className="w-full h-10 px-3 rounded-md border border-slate-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        {isLoadingBranches ? (
                          <option>Loading branches...</option>
                        ) : branches?.map((b: string) => (
                          <option key={b} value={b}>{b}</option>
                        )) || <option value="master">master</option>}
                      </select>
                    </div>
                    <div className="pt-5">
                      <Button
                        onClick={handleCreatePR}
                        disabled={fixMutation.isPending || isLoadingBranches}
                        className="bg-[#2da44e] hover:bg-[#2c974b] text-white font-semibold h-10"
                      >
                        {fixMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <GitPullRequest className="w-4 h-4 mr-2" />}
                        Create Pull Request
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="space-y-3 text-slate-600 text-sm">
                  <p className="font-medium text-slate-900">PR Summary:</p>
                  <ul className="list-disc pl-5 space-y-1">
                    {issues.slice(0, 3).map((i, idx) => (
                      <li key={idx}>{i.description}</li>
                    ))}
                    {issues.length > 3 && <li>And {issues.length - 3} more fixes...</li>}
                  </ul>
                </div>
              </div>
            </div>
          </Card>
        </>
      ) : (
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-8 mx-auto animate-bounce">
            <CheckCircle2 className="w-10 h-10 text-green-600" />
          </div>
          <h2 className="text-3xl font-bold text-slate-900 mb-4">Pull Request Created!</h2>
          <p className="text-slate-600 mb-10 max-w-md">
            The fixes have been applied to a new branch and a Pull Request has been opened against <span className="font-semibold">{targetBranch}</span>.
          </p>
          <div className="flex gap-4 justify-center">
            {prUrl && (
              <Button asChild className="bg-black hover:bg-slate-800">
                <a href={prUrl} target="_blank" rel="noopener noreferrer">
                  <Github className="w-4 h-4 mr-2" />
                  View on GitHub
                </a>
              </Button>
            )}
            <Button variant="outline" onClick={() => window.location.reload()}>
              Back to Dashboard
            </Button>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}

// ------------------------------------------------------------------
// STEP 6: AUDITS VIEW
// ------------------------------------------------------------------
function AuditsView({ audits, isLoading }: { audits: any[], isLoading: boolean }) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      {audits.length === 0 ? (
        <Card className="p-12 text-center border-dashed">
          <Shield className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-900">No Audits Found</h3>
          <p className="text-slate-500 mb-6">Run your first security audit to see results here.</p>
          <Button onClick={() => window.location.reload()} className="bg-indigo-600">
            Select a Repository
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {audits.map((audit: any) => (
            <Card key={audit._id} className="p-6 hover:shadow-md transition-shadow cursor-pointer border-slate-200">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-xl ${audit.status === 'completed' ? 'bg-green-50 text-green-600' : 'bg-indigo-50 text-indigo-600'}`}>
                    <Shield className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900">{audit.title}</h3>
                    <p className="text-sm text-slate-500">{audit.description || 'No description'}</p>
                  </div>
                </div>
                <Badge variant={audit.status === 'completed' ? 'default' : 'secondary'} className="capitalize">
                  {audit.status}
                </Badge>
              </div>
              <div className="mt-6 flex items-center justify-between border-t pt-4 border-slate-100">
                <div className="flex gap-6 text-sm text-slate-500">
                  <span className="flex items-center gap-1.5"><Zap className="w-4 h-4" /> {audit.priority} Priority</span>
                  <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4" /> {audit.items?.length || 0} Items</span>
                </div>
                <div className="text-xs text-slate-400">
                  {new Date(audit.createdAt).toLocaleDateString()}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </motion.div>
  );
}

// ------------------------------------------------------------------
// STEP 7: PULL REQUESTS VIEW
// ------------------------------------------------------------------
function PullsView({ onSelect }: { onSelect: (pr: any) => void }) {
  const { data: pulls, isLoading } = usePulls();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      {(!pulls || pulls.length === 0) ? (
        <Card className="p-12 text-center border-dashed">
          <GitPullRequest className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-900">No Open Pull Requests</h3>
          <p className="text-slate-500 mb-6">Create a PR on GitHub to see it here.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {pulls.map((pr: any) => (
            <Card
              key={pr.id}
              onClick={() => onSelect(pr)}
              className="p-6 hover:shadow-md transition-shadow cursor-pointer border-slate-200 group"
            >
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center p-2 group-hover:bg-indigo-50 transition-colors">
                    <GitPullRequest className="w-5 h-5 text-indigo-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">{pr.title}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs font-semibold text-slate-600">{pr.repo.full_name}</span>
                      <Badge variant="outline" className="text-[10px] h-4">#{pr.number}</Badge>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-none capitalize">{pr.state}</Badge>
                  <div className="text-[10px] text-slate-400 mt-2">Opened {new Date(pr.created_at).toLocaleDateString()}</div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </motion.div>
  );
}

// ------------------------------------------------------------------
// STEP 8: PR DETAIL VIEW
// ------------------------------------------------------------------
function PullDetailView({ pr, onBack, onIssuesFound }: { pr: any, onBack: () => void, onIssuesFound: (issues: any[]) => void }) {
  const { data: files, isLoading: isLoadingFiles } = usePRFiles(pr.repo.owner, pr.repo.name, pr.number);
  const auditMutation = usePRAudit();
  const fixMutation = usePRFix();
  const mergeMutation = usePRMerge();
  const [issues, setIssues] = useState<any[]>([]);
  const [isAudited, setIsAudited] = useState(false);

  const handleAudit = () => {
    auditMutation.mutate({ owner: pr.repo.owner, repo: pr.repo.name, number: pr.number }, {
      onSuccess: (data) => {
        setIssues(data.issues || []);
        onIssuesFound(data.issues || []);
        setIsAudited(true);
      }
    });
  };

  const handleFix = () => {
    fixMutation.mutate({ owner: pr.repo.owner, repo: pr.repo.name, number: pr.number, issues });
  };

  const handleMerge = () => {
    mergeMutation.mutate({ owner: pr.repo.owner, repo: pr.repo.name, number: pr.number }, {
      onSuccess: () => onBack()
    });
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <Button variant="ghost" size="sm" onClick={onBack} className="mb-2">
        <ArrowLeft className="w-4 h-4 mr-2" /> Back to Pull Requests
      </Button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-slate-200">
            <CardHeader className="bg-slate-50/50 border-b border-slate-100">
              <CardTitle className="text-base">Changed Files</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {isLoadingFiles ? (
                <div className="p-8 text-center text-slate-400">Loading diffs...</div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {files?.map((file: any) => (
                    <div key={file.filename} className="p-4">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <Code2 className="w-4 h-4 text-slate-500" />
                          <span className="text-sm font-mono font-medium text-slate-700">{file.filename}</span>
                        </div>
                        <Badge variant="outline" className="text-[10px] text-green-600">+{file.additions} / -{file.deletions}</Badge>
                      </div>
                      <div className="bg-slate-900 rounded-lg p-4 overflow-x-auto">
                        <pre className="text-[11px] text-slate-300 font-mono leading-relaxed">
                          {file.patch || "// No changes or binary file"}
                        </pre>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="border-indigo-200 bg-indigo-50/30">
            <CardHeader>
              <CardTitle className="text-indigo-900 flex items-center gap-2">
                <Zap className="w-5 h-5" /> AI Review
              </CardTitle>
              <CardDescription className="text-indigo-700/70">Audit code changes for bugs and vulnerabilities before merging.</CardDescription>
            </CardHeader>
            <CardContent>
              {!isAudited ? (
                <Button
                  onClick={handleAudit}
                  disabled={auditMutation.isPending}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white"
                >
                  {auditMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Shield className="w-4 h-4 mr-2" />}
                  Review with AI
                </Button>
              ) : (
                <div className="space-y-4">
                  <div className={`p-4 rounded-xl border text-center ${issues.length > 0 ? 'bg-amber-50 border-amber-200' : 'bg-green-50 border-green-200'}`}>
                    <div className="text-2xl font-bold mb-1">{issues.length}</div>
                    <div className="text-xs font-medium uppercase tracking-wider text-slate-500">Issues Detected</div>
                  </div>

                  {issues.length > 0 && (
                    <Button
                      onClick={handleFix}
                      disabled={fixMutation.isPending}
                      className="w-full bg-indigo-600 hover:bg-indigo-700 text-white"
                    >
                      {fixMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Zap className="w-4 h-4 mr-2" />}
                      Correct PR with AI
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-slate-200">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-600" /> Actions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button
                onClick={handleMerge}
                disabled={mergeMutation.isPending}
                className="w-full bg-[#2da44e] hover:bg-[#2c974b] text-white"
              >
                {mergeMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <GitPullRequest className="w-4 h-4 mr-2" />}
                Merge Pull Request
              </Button>
              <Button variant="outline" className="w-full" asChild>
                <a href={pr.html_url} target="_blank" rel="noopener noreferrer">View on GitHub</a>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </motion.div>
  );
}

