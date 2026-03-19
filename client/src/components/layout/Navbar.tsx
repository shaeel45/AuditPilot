import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Github } from "lucide-react";

export default function Navbar() {
  return (
    <nav className="fixed w-full z-50 glass-panel border-b border-slate-200/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <Link href="/">
            <div className="flex-shrink-0 flex items-center gap-2 cursor-pointer">
              <img src="/logo.png" alt="AuditPilot Logo" className="w-10 h-10 rounded-lg object-contain" />
              <span className="font-bold text-xl tracking-tight text-slate-900 transition-colors hover:text-indigo-600">AuditPilot</span>
            </div>
          </Link>
          
          <div className="hidden md:flex items-center space-x-8">
            <Link href="/" className="text-sm font-medium text-slate-600 hover:text-indigo-600 transition-colors">
              Home
            </Link>
            <Link href="/how-it-works" className="text-sm font-medium text-slate-600 hover:text-indigo-600 transition-colors">
              How it Works
            </Link>
            <Link href="/pricing" className="text-sm font-medium text-slate-600 hover:text-indigo-600 transition-colors">
              Pricing
            </Link>
          </div>

          <div className="flex items-center gap-4">
            <Link href="/auth">
              <span className="hidden md:block text-sm font-medium text-slate-600 hover:text-indigo-600 cursor-pointer transition-colors">
                Log in
              </span>
            </Link>
            <Link href="/auth">
              <Button className="bg-slate-900 hover:bg-slate-800 text-white rounded-full px-6 shadow-lg shadow-indigo-500/20 transition-all hover:shadow-indigo-500/40 transform hover:-translate-y-0.5 active:translate-y-0">
                <Github className="w-4 h-4 mr-2" />
                Connect GitHub
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}
