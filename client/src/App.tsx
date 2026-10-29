import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Landing from "@/pages/Landing";
import Auth from "@/pages/Auth";
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
import AuditEditPage from "@/pages/dashboard/audit/AuditEditPage";
import FixConfirmationPage from "@/pages/dashboard/audit/FixConfirmationPage";
import AuditSuccessPage from "@/pages/dashboard/audit/AuditSuccessPage";

// Pulls Flow
import PullDetailPage from "@/pages/dashboard/pulls/PullDetailPage";
import PullResultsPage from "@/pages/dashboard/pulls/PullResultsPage";
import PullDiffPage from "@/pages/dashboard/pulls/PullDiffPage";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Landing} />
      <Route path="/auth" component={Auth} />
      <Route path="/pricing" component={Pricing} />
      <Route path="/how-it-works" component={HowItWorks} />

      {/* Dashboard Routes */}
      <ProtectedRoute path="/app" component={ReposPage} />
      <ProtectedRoute path="/app/repos" component={ReposPage} />
      <ProtectedRoute path="/app/history" component={AuditHistoryPage} />
      <ProtectedRoute path="/app/pulls" component={PullsPage} />
      <ProtectedRoute path="/app/settings" component={SettingsPage} />

      {/* Audit Flow Routes */}
      <ProtectedRoute path="/app/audit/:owner/:repo/:branch" component={AuditProgressPage} />
      <ProtectedRoute path="/app/audit/:owner/:repo/results/:auditId" component={AuditResultsPage} />
      <ProtectedRoute path="/app/audit/:owner/:repo/edit/:auditId" component={AuditEditPage} />
      <ProtectedRoute path="/app/audit/:owner/:repo/fix/:auditId" component={FixConfirmationPage} />
      <ProtectedRoute path="/app/audit/:owner/:repo/success/:prNumber" component={AuditSuccessPage} />

      {/* Pull Requests Flow Routes */}
      <ProtectedRoute path="/app/pulls/:number" component={PullDetailPage} />
      <ProtectedRoute path="/app/pulls/:number/results" component={PullResultsPage} />
      <ProtectedRoute path="/app/pulls/:number/diff" component={PullDiffPage} />

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  // Authentication is now cookie-based (httpOnly JWT set by the login callback).
  // No token is captured from URLs and nothing auth-sensitive is stored locally.
  // The "authenticated" localStorage flag is only a UX hint owned by the
  // auth-status query.

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
