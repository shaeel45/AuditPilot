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
import { usePulls, usePRFiles, usePRAudit, usePRFix, usePRMerge, useUpdatePR } from "@/hooks/use-pulls";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

// Types
type Step = 'repos' | 'audit' | 'results' | 'fix' | 'pr' | 'diff' | 'audits' | 'pulls' | 'pull_detail' | 'pull_results' | 'pull_diff' | 'billing' | 'settings';

type Issue = {
  id: string;
  dbId?: string;
  type: 'security' | 'performance' | 'accessibility';
  severity: 'critical' | 'medium' | 'low';
  file_path: string;
  description: string;
  fix_available?: boolean;
  old_code?: string;
  new_code?: string;
  // Fallback for old code
  file?: string;
  fix?: {
    old_code: string;
    new_code: string;
  };
};


export default function Dashboard() {
  const [step, setStep] = useState<Step>('repos');
  const [selectedRepo, setSelectedRepo] = useState<any>(null);
  const [selectedPR, setSelectedPR] = useState<any>(null);
  const [realAuditIssues, setRealAuditIssues] = useState<any[]>([]);
  const [prIssues, setPrIssues] = useState<any[]>([]);
  const { data: audits, isLoading: isLoadingAudits } = useAudits();
  const { data: repos, isLoading: isLoadingRepos } = useRepos();
  const { data: authStatus, isLoading: isLoadingAuth } = useAuthStatus();
  const [showLimitModal, setShowLimitModal] = useState<{ show: boolean, type: 'audit' | 'pr' }>({ show: false, type: 'audit' });
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const { toast } = useToast();
  const auditMutation = useRepoAudit();
  const [, setLocation] = useLocation();
  const local = localStorage.getItem("authenticated");
  useEffect(() => {
    if (!isLoadingAuth && authStatus && !authStatus.authenticated) {
      setLocation("/");
    }
  }, [authStatus, isLoadingAuth, setLocation]);

  const handleLogout = async () => {
    try {
      localStorage.removeItem("audit_token");
      await fetch("/api/auth/logout");
      window.location.href = "/";
    } catch (err) {
      console.error("Logout failed:", err);
      // Fallback: still redirect
      window.location.href = "/";
    }
  };

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
          <NavItem active={step === 'billing'} icon={<Zap className="w-4 h-4" />} label="Billing" onClick={() => setLocation('/pricing')} />
          <NavItem active={step === 'settings'} icon={<Eye className="w-4 h-4" />} label="Settings" onClick={() => goToStep('settings')} />

          {authStatus?.user && (
            <div className="mt-8 p-3 bg-indigo-50/50 rounded-xl border border-indigo-100 mx-3">
              <div className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider mb-2">Plan: {authStatus.user.plan}</div>
              <UsageCounter
                label="Audits"
                used={authStatus.user.auditsUsed}
                limit={authStatus.user.plan === 'starter' ? 5 : (authStatus.user.plan === 'pro' ? 100 : Infinity)}
              />
              <UsageCounter
                label="PR Actions"
                used={authStatus.user.pullRequestsUsed}
                limit={authStatus.user.plan === 'starter' ? 2 : (authStatus.user.plan === 'pro' ? 100 : Infinity)}
                className="mt-3"
              />
            </div>
          )}
        </div>

        <div className="mt-auto p-4 border-t border-slate-100">
          <div className="flex items-center gap-3">
            {authStatus?.user?.avatarUrl ? (
              <img src={authStatus.user.avatarUrl} className="w-8 h-8 rounded-full" alt="User Avatar" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-slate-200"></div>
            )}
            <div>
              <div className="text-sm font-medium text-slate-900">{authStatus?.user?.displayName || "Loading..."}</div>
              <div className="text-xs text-slate-500">{authStatus?.user?.username || "Fetching..."}</div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="ml-auto text-slate-400 hover:text-red-500"
              onClick={handleLogout}
              title="Log Out"
            >
              <ArrowLeft className="w-4 h-4 rotate-180" />
            </Button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto bg-mesh-light">
        <header className="h-16 bg-white/80 backdrop-blur-sm border-b border-slate-200/50 flex items-center justify-between px-8 sticky top-0 z-10">
          <h1 className="text-lg font-semibold text-slate-800">
            {step === 'repos' && "Select Repository"}
            {step === 'audits' && "Security Audits"}
            {step === 'pull_detail' && `PR #${selectedPR?.number}: Details`}
            {step === 'pull_results' && `PR #${selectedPR?.number}: Audit Results`}
            {step === 'pull_diff' && `PR #${selectedPR?.number}: AI Corrections`}
            {step === 'audit' && "Running Audit..."}
            {step === 'results' && "Audit Results"}
            {step === 'fix' && "Review Fixes"}
            {step === 'pr' && "Pull Request Created"}
            {step === 'diff' && "Review Changes"}
            {step === 'billing' && "Subscription Plans"}
            {step === 'settings' && "Account Settings"}
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
                authStatus={authStatus}
                onSelect={(repo) => {
                  const plan = authStatus?.user?.plan || 'starter';
                  const limit = plan === 'starter' ? 5 : (plan === 'pro' ? 100 : Infinity);
                  const isLimitReached = (authStatus?.user?.auditsUsed || 0) >= limit;

                  if (isLimitReached) {
                    setShowLimitModal({ show: true, type: 'audit' });
                    return;
                  }
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
            {step === 'results' && <AuditResults key="results" issues={realAuditIssues.length > 0 ? realAuditIssues : []} onFix={() => goToStep('fix')} />}
            {step === 'fix' && <AutoFixConfirmation key="fix" issues={(realAuditIssues.length > 0 ? realAuditIssues : []).filter(i => i.fix_available || i.fix)} onConfirm={() => goToStep('pr')} onBack={() => goToStep('results')} onReviewDiff={() => goToStep('diff')} />}
            {step === 'diff' && <CodeDiffView key="diff" issues={(realAuditIssues.length > 0 ? realAuditIssues : []).filter(i => i.fix_available || i.fix)} onBack={() => goToStep('fix')} />}
            {step === 'pr' && <PRSuccess key="pr" repo={selectedRepo} issues={(realAuditIssues.length > 0 ? realAuditIssues : []).filter(i => i.fix_available || i.fix)} />}
            {step === 'audits' && <AuditsView key="audits" audits={audits || []} isLoading={isLoadingAudits} />}
            {step === 'pulls' && (
              <PullsView
                onSelect={(pr) => {
                  setSelectedPR(pr);
                  goToStep('pull_detail');
                }}
              />
            )}
            {step === 'pull_detail' && selectedPR && (
              <PullDetailView
                pr={selectedPR}
                onBack={() => setStep('pulls')}
                authStatus={authStatus}
                setShowLimitModal={setShowLimitModal}
                onReviewComplete={(issues) => {
                  setPrIssues(issues);
                  setStep('pull_results');
                }}
              />
            )}
            {step === 'pull_results' && (
              <PRAuditResultsView
                issues={prIssues}
                onBack={() => setStep('pull_detail')}
                onFixComplete={() => setStep('pull_diff')}
                pr={selectedPR}
                authStatus={authStatus}
              />
            )}
            {step === 'pull_diff' && (
              <PRDiffView
                pr={selectedPR}
                onBack={() => setStep('pull_results')}
                authStatus={authStatus}
              />
            )}
            {step === 'settings' && <SettingsView key="settings" user={authStatus?.user} />}
          </AnimatePresence>

          <LimitReachedModal
            isOpen={showLimitModal.show}
            onClose={() => setShowLimitModal({ ...showLimitModal, show: false })}
            type={showLimitModal.type}
            onUpgrade={() => {
              setShowLimitModal({ ...showLimitModal, show: false });
              setLocation('/pricing');
            }}
          />
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
function RepoSelection({ repos, isLoading, authStatus, onSelect }: { repos: any[], isLoading: boolean, authStatus: any, onSelect: (repo: any) => void }) {
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
  const [expandedIssueId, setExpandedIssueId] = useState<string | null>(null);
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
          {issues.map((issue, idx) => {
            const issueId = issue.id || issue.dbId || `issue-${idx}`;
            const isExpanded = expandedIssueId === issueId;
            const hasFix = !!(issue.fix_available || issue.fix || (issue as any).oldCode);
            const fileName = issue.file_path || issue.file;
            const oldCode = issue.fix?.old_code || issue.old_code || issue.oldCode;
            const newCode = issue.fix?.new_code || issue.new_code || issue.newCode;

            return (
              <div key={issueId} className="flex flex-col group">
                <div className="p-6 hover:bg-slate-50 transition-colors flex items-start gap-4">
                  <div className={`mt-1 w-2 h-2 rounded-full ${issue.severity === 'critical' ? 'bg-red-500' : issue.severity === 'medium' ? 'bg-amber-500' : 'bg-slate-400'}`}></div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-slate-900">{issue.description}</span>
                      {hasFix && (
                        <Badge variant="secondary" className="bg-indigo-50 text-indigo-700 border-indigo-100 text-[10px] px-2 h-5">Auto-fix</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-xs text-slate-500 font-mono">
                      <span>{fileName}</span>
                      <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                      <span className="uppercase">{issue.type}</span>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={!hasFix}
                    onClick={() => setExpandedIssueId(isExpanded ? null : issueId)}
                    className={`${hasFix ? (isExpanded ? 'bg-indigo-50 text-indigo-700' : 'text-indigo-600 hover:bg-indigo-50') : 'text-slate-300'}`}
                  >
                    {hasFix ? (isExpanded ? 'Hide Fix' : 'View Fix') : 'Manual Fix'}
                  </Button>
                </div>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden border-t border-slate-100 bg-slate-50/30"
                    >
                      <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4 font-mono text-[11px]">
                        <div className="space-y-2">
                          <div className="text-[10px] font-bold text-red-600 uppercase tracking-wider">Original Code</div>
                          <div className="p-3 bg-red-50/50 rounded-lg border border-red-100/50 text-red-700 overflow-x-auto whitespace-pre">
                            {oldCode || '// Original code not provided'}
                          </div>
                        </div>
                        <div className="space-y-2">
                          <div className="text-[10px] font-bold text-green-600 uppercase tracking-wider">Proposed Fix</div>
                          <div className="p-3 bg-green-50/50 rounded-lg border border-green-100/50 text-green-700 overflow-x-auto whitespace-pre">
                            {newCode || '// Fix not provided'}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
        <div className="p-6 bg-slate-50/50 border-t border-slate-100 flex justify-end">
          <Button onClick={onFix} size="lg" className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-600/20">
            Apply All Fixes ({issues.filter(i => !!(i.fix_available || i.fix || (i as any).oldCode)).length}) <ArrowRight className="ml-2 w-4 h-4" />
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
          {issues.map((issue, idx) => {
            const fileName = issue.file_path || issue.file;
            const issueId = issue.id || issue.dbId || `conf-${idx}`;
            return (
              <div key={issueId} className="p-4 flex items-center gap-4">
                <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
                <div className="flex-1">
                  <div className="text-sm font-medium text-slate-900">{issue.description}</div>
                  <div className="text-xs text-slate-500 font-mono mt-0.5">{fileName}</div>
                </div>
              </div>
            );
          })}
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
        {issues.map((issue, idx) => {
          const fileName = issue.file_path || issue.file;
          const oldCode = issue.old_code || (issue.fix ? issue.fix.old_code : (issue as any).oldCode);
          const newCode = issue.new_code || (issue.fix ? issue.fix.new_code : (issue as any).newCode);

          return (
            <div key={idx} className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
              <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Code2 className="w-4 h-4 text-slate-500" />
                  <span className="text-sm font-mono font-medium text-slate-700">{fileName}</span>
                </div>
                <Badge variant="outline" className="text-[10px] uppercase">{issue.type}</Badge>
              </div>
              <div className="grid grid-cols-2 divide-x divide-slate-200 font-mono text-[11px]">
                {/* Left Side: Old Code */}
                <div className="bg-slate-50/50">
                  <div className="px-3 py-1.5 bg-red-50/50 border-b border-red-100/50 text-red-600 text-[10px] font-bold uppercase tracking-wider">Original Code</div>
                  <div className="p-4 overflow-x-auto whitespace-pre text-red-700 bg-red-50/20 h-full">
                    <span className="inline-block w-4 mr-2 text-red-300 select-none">-</span>
                    {oldCode || '// No original code'}
                  </div>
                </div>
                {/* Right Side: Fixed Code */}
                <div className="bg-slate-50/50">
                  <div className="px-3 py-1.5 bg-green-50/50 border-b border-green-100/50 text-green-600 text-[10px] font-bold uppercase tracking-wider">Fixed Code</div>
                  <div className="p-4 overflow-x-auto whitespace-pre text-green-700 bg-green-50/20 h-full">
                    <span className="inline-block w-4 mr-2 text-green-300 select-none">+</span>
                    {newCode || '// No replacement code'}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
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
    const owner = repo?.owner?.login || repo?.owner;
    const name = repo?.name;

    if (!owner || !name) {
      console.error("Missing repo owner or name for PR creation", repo);
      return;
    }

    fixMutation.mutate({
      owner,
      repo: name,
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
function PullDetailView({ pr, onBack, onReviewComplete, authStatus, setShowLimitModal }: { pr: any, onBack: () => void, onReviewComplete: (issues: any[]) => void, authStatus: any, setShowLimitModal: any }) {
  const repoOwner = pr.repo?.owner?.login || pr.repo?.owner || pr.owner?.login || pr.owner;
  const repoName = pr.repo?.name || pr.name;

  const { data: files, isLoading: isLoadingFiles } = usePRFiles(repoOwner, repoName, pr.number);
  const { data: branches } = useBranches(repoOwner, repoName);
  const auditMutation = usePRAudit();
  const mergeMutation = usePRMerge();
  const updatePRMutation = useUpdatePR();
  const [targetBranch, setTargetBranch] = useState(pr.base?.ref || 'master');

  const handleAudit = () => {
    if (authStatus?.user?.plan === 'starter' && authStatus?.user?.pullRequestsUsed >= 2) {
      setShowLimitModal({ show: true, type: 'pr' });
      return;
    }
    if (authStatus?.user?.plan === 'pro' && authStatus?.user?.pullRequestsUsed >= 100) {
      setShowLimitModal({ show: true, type: 'pr' });
      return;
    }
    auditMutation.mutate({ owner: repoOwner, repo: repoName, number: pr.number }, {
      onSuccess: (data) => {
        onReviewComplete(data.issues || []);
      }
    });
  };

  const handleMerge = () => {
    if (authStatus?.user?.plan === 'starter' && authStatus?.user?.pullRequestsUsed >= 2) {
      setShowLimitModal({ show: true, type: 'pr' });
      return;
    }
    if (authStatus?.user?.plan === 'pro' && authStatus?.user?.pullRequestsUsed >= 100) {
      setShowLimitModal({ show: true, type: 'pr' });
      return;
    }
    mergeMutation.mutate({ owner: repoOwner, repo: repoName, number: pr.number }, {
      onSuccess: () => onBack()
    });
  };

  const handleBranchChange = (newBranch: string) => {
    setTargetBranch(newBranch);
    updatePRMutation.mutate({
      owner: repoOwner,
      repo: repoName,
      number: pr.number,
      data: { base: newBranch }
    });
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Pull Requests
        </Button>
        <div className="flex gap-2">
          <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-none capitalize">{pr.state}</Badge>
          <Badge variant="outline">#{pr.number}</Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-slate-200">
            <CardHeader className="bg-slate-50/50 border-b border-slate-100 py-4 px-6">
              <CardTitle className="text-base font-bold text-slate-800">PR Info: {pr.title}</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="flex items-start gap-4 mb-6">
                <img src={pr.user.avatar_url} className="w-10 h-10 rounded-full border border-slate-200" alt="" />
                <div>
                  <div className="font-semibold text-slate-900">{pr.user.login}</div>
                  <div className="text-xs text-slate-500">opened this pull request on {new Date(pr.created_at).toLocaleDateString()}</div>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-slate-700">Changed Files ({files?.length || 0})</h4>
                <div className="space-y-2">
                  {files?.map((file: any) => (
                    <div key={file.filename} className="flex items-center justify-between p-3 rounded-lg border border-slate-100 bg-slate-50/50">
                      <div className="flex items-center gap-3">
                        <Code2 className="w-4 h-4 text-slate-500" />
                        <span className="text-sm font-mono text-slate-700">{file.filename}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-green-600 font-bold">+{file.additions}</span>
                        <span className="text-[10px] text-red-600 font-bold">-{file.deletions}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="border-indigo-200 bg-indigo-50/30 overflow-hidden">
            <div className="h-1 bg-indigo-500" />
            <CardHeader>
              <CardTitle className="text-indigo-900 flex items-center gap-2">
                <Shield className="w-5 h-5 text-indigo-600" /> AI Review
              </CardTitle>
              <CardDescription className="text-indigo-700/80">
                Audit the specific code changes in this PR for vulnerabilities and performance issues.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={handleAudit}
                disabled={auditMutation.isPending || ((authStatus?.user?.plan === 'starter' && authStatus?.user?.pullRequestsUsed >= 2) || (authStatus?.user?.plan === 'pro' && authStatus?.user?.pullRequestsUsed >= 100))}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-200"
              >
                {auditMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Zap className="w-4 h-4 mr-2" />}
                {((authStatus?.user?.plan === 'starter' && authStatus?.user?.pullRequestsUsed >= 2) || (authStatus?.user?.plan === 'pro' && authStatus?.user?.pullRequestsUsed >= 100)) ? "Limit Reached" : "Review with AI"}
              </Button>
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-3 text-sm font-semibold text-slate-500 uppercase tracking-wider">GitHub Actions</CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-1">Merge Into Branch</label>
                <select
                  value={targetBranch}
                  onChange={(e) => handleBranchChange(e.target.value)}
                  disabled={updatePRMutation.isPending}
                  className="w-full h-9 rounded-md border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                >
                  {branches?.map((b: string) => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
                {updatePRMutation.isPending && <p className="text-[10px] text-indigo-600 px-1 animate-pulse">Updating PR target...</p>}
              </div>

              <div className="pt-2 space-y-3">
                <Button
                  onClick={handleMerge}
                  disabled={mergeMutation.isPending || updatePRMutation.isPending || ((authStatus?.user?.plan === 'starter' && authStatus?.user?.pullRequestsUsed >= 2) || (authStatus?.user?.plan === 'pro' && authStatus?.user?.pullRequestsUsed >= 100))}
                  className="w-full bg-[#2da44e] hover:bg-[#2c974b] text-white"
                >
                  <GitPullRequest className="w-4 h-4 mr-2" />
                  {((authStatus?.user?.plan === 'starter' && authStatus?.user?.pullRequestsUsed >= 2) || (authStatus?.user?.plan === 'pro' && authStatus?.user?.pullRequestsUsed >= 100)) ? "Limit Reached" : `Merge into ${targetBranch}`}
                </Button>
                <Button variant="outline" className="w-full border-slate-200 text-slate-600" asChild>
                  <a href={pr.html_url} target="_blank" rel="noopener noreferrer">
                    View on GitHub <Github className="w-3 h-3 ml-2" />
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </motion.div>
  );
}

// ------------------------------------------------------------------
// STEP 9: PR AUDIT RESULTS
// ------------------------------------------------------------------
function PRAuditResultsView({ issues, onBack, onFixComplete, pr, authStatus }: { issues: any[], onBack: () => void, onFixComplete: () => void, pr: any, authStatus: any }) {
  const fixMutation = usePRFix();

  const handleFix = () => {
    const owner = pr.repo?.owner?.login || pr.repo?.owner || pr.owner?.login || pr.owner;
    const repo = pr.repo?.name || pr.name;
    fixMutation.mutate({ owner, repo, number: pr.number, issues }, {
      onSuccess: () => onFixComplete()
    });
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to details
        </Button>
        <Badge className={issues.length > 0 ? "bg-amber-100 text-amber-700" : "bg-green-100 text-green-700"}>
          {issues.length} Issues Detected
        </Badge>
      </div>

      <div className="space-y-4">
        {issues.length === 0 ? (
          <Card className="p-12 text-center bg-green-50 border-green-100">
            <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-green-900">Code Looks Great!</h3>
            <p className="text-green-700/70 max-w-md mx-auto mt-2">The AI didn't find any issues with these changes. You're good to merge.</p>
          </Card>
        ) : (
          <>
            {issues.map((issue, idx) => (
              <Card key={idx} className="border-slate-200 hover:border-indigo-200 transition-colors">
                <CardHeader className="flex flex-row items-start justify-between py-4">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${issue.severity === 'critical' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'}`}>
                      <AlertCircle className="w-5 h-5" />
                    </div>
                    <div>
                      <Badge variant="outline" className="mb-1 uppercase text-[10px]">{issue.type}</Badge>
                      <CardTitle className="text-base text-slate-900">{issue.file}</CardTitle>
                    </div>
                  </div>
                  <Badge className={issue.severity === 'critical' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}>
                    {issue.severity}
                  </Badge>
                </CardHeader>
                <CardContent className="pb-4">
                  <p className="text-sm text-slate-600 leading-relaxed">{issue.description}</p>
                </CardContent>
              </Card>
            ))}

            <div className="pt-6 border-t border-slate-200 flex justify-center">
              <Button
                onClick={handleFix}
                disabled={fixMutation.isPending}
                className="w-full max-w-md bg-indigo-600 hover:bg-indigo-700 text-white h-12 text-lg shadow-xl shadow-indigo-100"
              >
                {fixMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Zap className="w-5 h-5 mr-2 fill-current" />}
                Correct PR with AI
              </Button>
            </div>
          </>
        )}
      </div>
    </motion.div>
  );
}

// ------------------------------------------------------------------
// STEP 10: PR DIFF VIEW (DARK THEME)
// ------------------------------------------------------------------
function PRDiffView({ pr, onBack, authStatus }: { pr: any, onBack: () => void, authStatus: any }) {
  const owner = pr.repo?.owner?.login || pr.repo?.owner || pr.owner?.login || pr.owner;
  const repo = pr.repo?.name || pr.name;
  const { data: files, isLoading } = usePRFiles(owner, repo, pr.number);
  const { data: branches } = useBranches(owner, repo);
  const mergeMutation = usePRMerge();
  const updatePRMutation = useUpdatePR();
  const [targetBranch, setTargetBranch] = useState(pr.base?.ref || 'master');

  const handleMerge = () => {
    mergeMutation.mutate({ owner, repo, number: pr.number }, {
      onSuccess: () => onBack()
    });
  };

  const handleBranchChange = (newBranch: string) => {
    setTargetBranch(newBranch);
    updatePRMutation.mutate({
      owner,
      repo,
      number: pr.number,
      data: { base: newBranch }
    });
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <CheckCircle2 className="w-6 h-6 text-green-500" /> Corrections Applied
        </h2>
        <div className="flex items-center gap-4">
          <select
            value={targetBranch}
            onChange={(e) => handleBranchChange(e.target.value)}
            disabled={updatePRMutation.isPending}
            className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          >
            {branches?.map((b: string) => (
              <option key={b} value={b}>Merge into: {b}</option>
            ))}
          </select>
          <Button
            onClick={handleMerge}
            disabled={mergeMutation.isPending || updatePRMutation.isPending}
            className="bg-[#2da44e] hover:bg-[#2c974b] text-white shadow-lg shadow-green-100"
          >
            Merge Pull Request
          </Button>
        </div>
      </div>

      <div className="space-y-8">
        {isLoading ? (
          <div className="py-20 text-center text-slate-400">Loading updated files...</div>
        ) : (
          files?.map((file: any) => (
            <div key={file.filename} className="bg-[#0d1117] rounded-xl overflow-hidden shadow-2xl border border-slate-800">
              <div className="bg-[#161b22] px-6 py-3 border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Code2 className="w-4 h-4 text-slate-400" />
                  <span className="text-sm font-mono text-slate-300">{file.filename}</span>
                </div>
                <Badge variant="outline" className="text-[#3fb950] border-[#3fb950]/30 font-mono text-[10px]">
                  MODIFIED
                </Badge>
              </div>
              <div className="overflow-x-auto">
                <div className="p-6 font-mono text-xs leading-relaxed space-y-0.5">
                  {file.patch ? file.patch.split('\n').map((line: string, i: number) => {
                    const isAdded = line.startsWith('+');
                    const isRemoved = line.startsWith('-');
                    const isInfo = line.startsWith('@@');

                    return (
                      <div
                        key={i}
                        className={`whitespace-pre px-2 -mx-2 ${isAdded ? 'bg-[#2ea04326] text-[#3fb950]' :
                          isRemoved ? 'bg-[#f8514926] text-[#f85149]' :
                            isInfo ? 'text-indigo-400 opacity-60' : 'text-slate-400'
                          }`}
                      >
                        {line}
                      </div>
                    );
                  }) : (
                    <div className="text-slate-500 italic">No text diff available (binary or empty)</div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="flex justify-center py-10">
        <Button variant="ghost" className="text-slate-500" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Return to results
        </Button>
      </div>
    </motion.div>
  );
}

function SettingsView({ user }: { user: any }) {
  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-8">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <aside className="lg:col-span-1 space-y-1">
          <Button variant="ghost" className="w-full justify-start bg-slate-100 text-slate-900 font-medium">General</Button>
          <Button variant="ghost" className="w-full justify-start text-slate-500 hover:text-slate-900">Notifications</Button>
          <Button variant="ghost" className="w-full justify-start text-slate-500 hover:text-slate-900">Security</Button>
          <Button variant="ghost" className="w-full justify-start text-slate-500 hover:text-slate-900">Advanced</Button>
        </aside>

        <div className="lg:col-span-3 space-y-8">
          <Card className="border-slate-200">
            <CardHeader className="border-b border-slate-100 py-4 px-6">
              <CardTitle className="text-base font-bold">Public Profile</CardTitle>
              <CardDescription>Your public information on AuditPilot.</CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="flex items-center gap-6">
                <img src={user?.avatarUrl} className="w-20 h-20 rounded-full border-2 border-slate-100 shadow-sm" alt="Profile" />
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline">Change Photo</Button>
                    <Button size="sm" variant="ghost" className="text-red-500 hover:bg-red-50 hover:text-red-600">Remove</Button>
                  </div>
                  <p className="text-xs text-slate-500">JPG, GIF or PNG. 1MB max.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase">Display Name</label>
                  <input
                    type="text"
                    defaultValue={user?.displayName}
                    className="w-full h-10 rounded-lg border border-slate-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase">GitHub Username</label>
                  <input
                    type="text"
                    defaultValue={user?.username}
                    disabled
                    className="w-full h-10 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-400"
                  />
                </div>
              </div>
            </CardContent>
            <CardFooter className="bg-slate-50/50 border-t border-slate-100 py-4 px-6 flex justify-end">
              <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700">Update Profile</Button>
            </CardFooter>
          </Card>

          <Card className="border-slate-200">
            <CardHeader className="border-b border-slate-100 py-4 px-6">
              <CardTitle className="text-base font-bold text-red-600">Danger Zone</CardTitle>
              <CardDescription>Permanent account actions.</CardDescription>
            </CardHeader>
            <CardContent className="p-6 flex items-center justify-between">
              <div>
                <h4 className="text-sm font-semibold text-slate-900">Delete Account</h4>
                <p className="text-xs text-slate-500 mt-1">Once you delete your account, there is no going back. Please be certain.</p>
              </div>
              <Button variant="outline" className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 hover:border-red-300">
                Delete My Account
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </motion.div>
  );
}

function LimitReachedModal({ isOpen, onClose, type, onUpgrade }: { isOpen: boolean, onClose: () => void, type: 'audit' | 'pr', onUpgrade: () => void }) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md bg-white border-indigo-100">
        <DialogHeader className="pt-4 flex flex-col items-center text-center">
          <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center mb-4">
            <Zap className="w-8 h-8 text-amber-500 fill-current" />
          </div>
          <DialogTitle className="text-2xl font-bold text-slate-900">
            {type === 'audit' ? 'Audit Limit Reached' : 'PR Review Limit Reached'}
          </DialogTitle>
          <DialogDescription className="text-slate-500 mt-2">
            {type === 'audit'
              ? "You've used all the audits included in your current plan. Upgrade to a higher tier to continue scanning your repositories for vulnerabilities."
              : "You've reached your monthly limit for PR AI reviews. Upgrade to Pro for 100 reviews per month and unlock advanced features."}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3 py-6">
          <Button onClick={onUpgrade} className="w-full bg-indigo-600 hover:bg-indigo-700 h-12 text-white font-bold shadow-lg shadow-indigo-200">
            View Pricing & Upgrade
          </Button>
          <Button variant="ghost" onClick={onClose} className="text-slate-400">
            Maybe Later
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function UsageCounter({ label, used, limit, className = "" }: { label: string, used: number, limit: number, className?: string }) {
  const percent = Math.min(100, (used / limit) * 100);
  return (
    <div className={className}>
      <div className="flex justify-between text-[10px] mb-1">
        <span className="text-slate-500 font-medium">{label}</span>
        <span className="text-slate-700 font-bold">{used}/{limit}</span>
      </div>
      <div className="h-1 w-full bg-slate-200 rounded-full overflow-hidden">
        <div
          className={`h-full transition-all duration-500 ${percent > 80 ? 'bg-amber-500' : 'bg-indigo-500'}`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

