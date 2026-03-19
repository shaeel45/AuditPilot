import React, { useState } from "react";
import { useLocation } from "wouter";
import { useAuthStatus } from "@/hooks/use-repos";
import { Button } from "@/components/ui/button";
import { Code2, Shield, GitPullRequest, Zap, Eye, Loader2 } from "lucide-react";
import { NavItem } from "@/components/dashboard/NavItem";
import { UsageCounter } from "@/components/dashboard/UsageCounter";
import { LimitReachedModal } from "@/components/dashboard/LimitReachedModal";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const { data: authStatus } = useAuthStatus();
  const [showLimitModal, setShowLimitModal] = useState<{ show: boolean, type: 'audit' | 'pr' }>({ show: false, type: 'audit' });

  const handleLogout = async () => {
    try {
      localStorage.removeItem("audit_token");
      await fetch("/api/auth/logout");
      window.location.href = "/";
    } catch (err) {
      console.error("Logout failed:", err);
      window.location.href = "/";
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200 hidden md:flex flex-col fixed inset-y-0">
        <div className="h-16 flex items-center px-6 border-b border-slate-100">
          <img src="/logo.png" alt="AuditPilot Logo" className="w-10 h-10 rounded-lg object-contain" />
          <span className="font-bold text-xl tracking-tight text-slate-900 transition-colors hover:text-indigo-600">AuditPilot</span>
        </div>

        <div className="p-4 space-y-1">
          <div className="px-3 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">Platform</div>
          <NavItem
            active={location === '/app/repos' || location === '/app'}
            icon={<Code2 className="w-4 h-4" />}
            label="Repositories"
            onClick={() => setLocation('/app/repos')}
          />
          <NavItem
            active={location === '/app/history'}
            icon={<Shield className="w-4 h-4" />}
            label="Audits"
            onClick={() => setLocation('/app/history')}
          />
          <NavItem
            active={location === '/app/pulls'}
            icon={<GitPullRequest className="w-4 h-4" />}
            label="Pull Requests"
            onClick={() => setLocation('/app/pulls')}
          />

          <div className="mt-8 px-3 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">Account</div>
          <NavItem
            active={false}
            icon={<Zap className="w-4 h-4" />}
            label="Billing"
            onClick={() => setLocation('/pricing')}
          />
          <NavItem
            active={location === '/app/settings'}
            icon={<Eye className="w-4 h-4" />}
            label="Settings"
            onClick={() => setLocation('/app/settings')}
          />

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
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-slate-900 truncate">{authStatus?.user?.displayName || "Loading..."}</div>
              <div className="text-xs text-slate-500 truncate">{authStatus?.user?.username || "Fetching..."}</div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleLogout}
              className="text-slate-400 hover:text-red-600 hover:bg-red-50"
            >
              <Eye className="w-4 h-4 rotate-180" />
            </Button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 md:ml-64 min-h-screen">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 sticky top-0 z-20">
          <div className="flex items-center gap-4">
            <h1 className="text-lg font-bold text-slate-800 capitalize">
              {location.split('/').pop()?.replace('-', ' ') || 'Dashboard'}
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <Button variant="outline" size="sm" className="hidden sm:flex border-slate-200 text-slate-600">
              Documentation
            </Button>
            <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-xs ring-2 ring-white">
              {authStatus?.user?.displayName?.[0] || "?"}
            </div>
          </div>
        </header>

        <div className="p-8 max-w-7xl mx-auto">
          {children}
        </div>
      </main>

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
  );
}
