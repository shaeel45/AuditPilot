import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Landing from "@/pages/Landing";
import Auth from "@/pages/Auth";
import { useEffect } from "react";
import Pricing from "@/pages/Pricing";
import HowItWorks from "@/pages/HowItWorks";

// Dashboard Pages
import ReposPage from "@/pages/dashboard/ReposPage";
import AuditHistoryPage from "@/pages/dashboard/AuditHistoryPage";
import PullsPage from "@/pages/dashboard/PullsPage";
import SettingsPage from "@/pages/dashboard/SettingsPage";

// Audit Flow
import AuditProgressPage from "@/pages/dashboard/audit/AuditProgressPage";
import AuditResultsPage from "@/pages/dashboard/audit/AuditResultsPage";
import FixConfirmationPage from "@/pages/dashboard/audit/FixConfirmationPage";
import AuditSuccessPage from "@/pages/dashboard/audit/AuditSuccessPage";

// Pulls Flow
import PullDetailPage from "@/pages/dashboard/pulls/PullDetailPage";
import PullResultsPage from "@/pages/dashboard/pulls/PullResultsPage";
import PullDiffPage from "@/pages/dashboard/pulls/PullDiffPage";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Landing} />
      <Route path="/auth" component={Auth} />
      <Route path="/pricing" component={Pricing} />
      <Route path="/how-it-works" component={HowItWorks} />

      {/* Dashboard Routes */}
      <Route path="/app" component={ReposPage} />
      <Route path="/app/repos" component={ReposPage} />
      <Route path="/app/history" component={AuditHistoryPage} />
      <Route path="/app/pulls" component={PullsPage} />
      <Route path="/app/settings" component={SettingsPage} />

      {/* Audit Flow Routes */}
      <Route path="/app/audit/:owner/:repo" component={AuditProgressPage} />
      <Route path="/app/audit/:owner/:repo/results/:auditId" component={AuditResultsPage} />
      <Route path="/app/audit/:owner/:repo/fix/:auditId" component={FixConfirmationPage} />
      <Route path="/app/audit/:owner/:repo/success/:prNumber" component={AuditSuccessPage} />

      {/* Pull Requests Flow Routes */}
      <Route path="/app/pulls/:number" component={PullDetailPage} />
      <Route path="/app/pulls/:number/results" component={PullResultsPage} />
      <Route path="/app/pulls/:number/diff" component={PullDiffPage} />

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  // Capture token immediately on load
  const params = new URLSearchParams(window.location.search);
  const token = params.get("token");
  if (token) {
    localStorage.setItem("audit_token", token);
  }

  useEffect(() => {
    // Only clean URL in useEffect
    if (token) {
      const newUrl = window.location.pathname;
      window.history.replaceState({}, document.title, newUrl);
    }
  }, [token]);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
