import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Github, Loader2 } from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";

export default function Auth() {
  const [isLoading, setIsLoading] = useState(false);
  const [, setLocation] = useLocation();

  const handleLogin = () => {
    setIsLoading(true);
    // Simulate auth delay
    setTimeout(() => {
      setIsLoading(false);
      setLocation("/app");
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-mesh-light flex items-center justify-center p-4">
      <Card className="w-full max-w-md border-0 shadow-2xl shadow-indigo-500/10 bg-white/80 backdrop-blur-xl">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center text-white font-bold text-2xl mb-6 shadow-lg shadow-indigo-500/30">
            A
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
