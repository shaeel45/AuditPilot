import React, { useEffect } from "react";
import { Route, useLocation } from "wouter";
import { useAuthStatus } from "@/hooks/use-repos";
import { Loader2 } from "lucide-react";

interface ProtectedRouteProps {
  path: string;
  component: React.ComponentType<any>;
}

export function ProtectedRoute({ path, component: Component }: ProtectedRouteProps) {
  const { data: authStatus, isLoading } = useAuthStatus();
  const [, setLocation] = useLocation();

  useEffect(() => {
    // If not loading and not authenticated, redirect to /auth
    if (!isLoading && authStatus && !authStatus.authenticated) {
       // Only redirect if not already on /auth
       if (window.location.pathname !== "/auth") {
          setLocation("/auth");
       }
    }
  }, [authStatus, isLoading, setLocation]);

  return (
    <Route path={path}>
      {(params) => {
        if (isLoading) {
          return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
              <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
            </div>
          );
        }

        if (authStatus?.authenticated) {
          return <Component params={params} />;
        }

        return null;
      }}
    </Route>
  );
}
