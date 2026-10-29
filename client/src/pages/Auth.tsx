import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Github, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuthStatus } from "@/hooks/use-repos";
import { API_BASE } from "@/lib/api-service";

export default function Auth() {
  const [isLoading, setIsLoading] = useState(false);
  const { data: authStatus, isLoading: isAuthLoading } = useAuthStatus();
  const [, setLocation] = useLocation();

  useEffect(() => {
    // Immediate redirect based on localStorage
    if (localStorage.getItem("authenticated") === "true") {
      setLocation("/app");
      return;
    }

    if (!isAuthLoading && authStatus?.authenticated) {
      setLocation("/app");
    }
  }, [authStatus, isAuthLoading, setLocation]);

  const handleLogin = () => {
    setIsLoading(true);
    // Top-level navigation to the API origin (single-origin or split deploy)
    window.location.href = `${API_BASE}/api/auth/github`;
  };

  return (
    <div className="min-h-screen bg-mesh-light flex items-center justify-center p-4">
      <Card className="w-full max-w-md border-0 shadow-2xl shadow-indigo-500/10 bg-white/80 backdrop-blur-xl">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto w-16 h-16 rounded-xl overflow-hidden mb-6 shadow-lg shadow-indigo-500/30 bg-white p-1">
            <img src="/logo.png" alt="AuditPilot Logo" className="w-full h-full object-contain" />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight">Welcome to AuditPilot</CardTitle>
          <CardDescription className="text-base text-slate-500 mt-2">
            Get started in under 60 seconds
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 pt-6">
          <Button
            variant="outline"
            size="lg"
            className="w-full h-14 text-base font-medium relative overflow-hidden group hover:border-indigo-200 hover:bg-indigo-50/50 transition-all"
            onClick={handleLogin}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="mr-2 h-5 w-5 animate-spin text-indigo-600" />
            ) : (
              <Github className="mr-2 h-5 w-5" />
            )}
            {isLoading ? "Connecting..." : "Continue with GitHub"}
          </Button>

          <div className="text-center text-xs text-slate-400">
            By clicking continue, you agree to our <a href="#" className="underline hover:text-indigo-600">Terms of Service</a> and <a href="#" className="underline hover:text-indigo-600">Privacy Policy</a>.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
