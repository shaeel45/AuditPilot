import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { CheckCircle2, Github, ArrowRight, Shield, Zap, Eye, Terminal } from "lucide-react";

export default function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground bg-mesh-light selection:bg-indigo-100 selection:text-indigo-900">
      {/* Navigation */}
      <nav className="fixed w-full z-50 glass-panel border-b border-slate-200/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex-shrink-0 flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center text-white font-bold">
                A
              </div>
              <span className="font-bold text-xl tracking-tight">AuditPilot</span>
            </div>
            <div className="hidden md:flex items-center space-x-8">
              <a href="#features" className="text-sm font-medium text-slate-600 hover:text-indigo-600 transition-colors">Features</a>
              <a href="#how-it-works" className="text-sm font-medium text-slate-600 hover:text-indigo-600 transition-colors">How it Works</a>
              <Link href="/pricing" className="text-sm font-medium text-slate-600 hover:text-indigo-600 transition-colors">Pricing</Link>
            </div>
            <div className="flex items-center gap-4">
              <Link href="/auth">
                <span className="hidden md:block text-sm font-medium text-slate-600 hover:text-indigo-600 cursor-pointer transition-colors">Log in</span>
              </Link>
              <Link href="/auth">
                <Button className="bg-slate-900 hover:bg-slate-800 text-white rounded-full px-6 shadow-lg shadow-indigo-500/20 transition-all hover:shadow-indigo-500/40">
                  Connect GitHub
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          
          <div className="text-center max-w-4xl mx-auto z-10 relative">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-semibold mb-8 border border-indigo-100"
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
              </span>
              v2.0 Now Available
            </motion.div>

            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="text-5xl md:text-7xl font-bold tracking-tight text-slate-900 mb-6 leading-[1.1]"
            >
              Audit and fix your web app <span className="text-gradient">automatically.</span>
            </motion.h1>

            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="text-xl text-slate-600 mb-10 max-w-2xl mx-auto leading-relaxed"
            >
              Security, performance & accessibility — fixed via GitHub pull requests. 
              Stop writing reports, start shipping fixes.
            </motion.p>

            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="flex flex-col sm:flex-row gap-4 justify-center items-center"
            >
              <Link href="/auth">
                <Button size="lg" className="h-12 px-8 text-lg rounded-full bg-indigo-600 hover:bg-indigo-700 text-white shadow-xl shadow-indigo-600/20 hover:shadow-indigo-600/40 transition-all transform hover:-translate-y-1">
                  <Github className="mr-2 h-5 w-5" />
                  Connect GitHub
                </Button>
              </Link>
              <p className="text-sm text-slate-500 mt-4 sm:mt-0 sm:ml-4">
                Free audit for early users
              </p>
            </motion.div>
          </div>

          {/* Abstract UI Mockup Background Element */}
          <motion.div 
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.5, ease: "easeOut" }}
            className="mt-20 relative mx-auto max-w-5xl"
          >
            <div className="rounded-xl bg-slate-900/5 p-4 backdrop-blur-sm border border-slate-200/50 shadow-2xl">
              <div className="rounded-lg overflow-hidden bg-white shadow-inner border border-slate-100">
                <div className="h-12 bg-slate-50 border-b border-slate-100 flex items-center px-4 gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-400"></div>
                  <div className="w-3 h-3 rounded-full bg-amber-400"></div>
                  <div className="w-3 h-3 rounded-full bg-emerald-400"></div>
                  <div className="flex-1 text-center text-xs text-slate-400 font-mono">auditpilot-dashboard</div>
                </div>
                <div className="p-8 grid grid-cols-1 md:grid-cols-3 gap-8">
                  {/* Fake UI Content */}
                  <div className="col-span-2 space-y-4">
                    <div className="h-8 w-1/3 bg-slate-100 rounded-md animate-pulse"></div>
                    <div className="h-4 w-3/4 bg-slate-50 rounded-md"></div>
                    <div className="h-4 w-1/2 bg-slate-50 rounded-md"></div>
                    <div className="space-y-2 mt-8">
                       <div className="flex items-center gap-3 p-3 bg-red-50 border border-red-100 rounded-lg">
                          <div className="w-2 h-2 rounded-full bg-red-500"></div>
                          <div className="h-2 w-24 bg-red-200 rounded"></div>
                          <div className="ml-auto h-6 w-16 bg-white rounded border border-red-100"></div>
                       </div>
                       <div className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-100 rounded-lg">
                          <div className="w-2 h-2 rounded-full bg-amber-500"></div>
                          <div className="h-2 w-32 bg-amber-200 rounded"></div>
                          <div className="ml-auto h-6 w-16 bg-white rounded border border-amber-100"></div>
                       </div>
                    </div>
                  </div>
                  <div className="space-y-4">
                     <div className="h-32 rounded-lg bg-gradient-to-br from-indigo-50 to-violet-50 border border-indigo-100 flex items-center justify-center">
                        <div className="text-center">
                          <div className="text-3xl font-bold text-indigo-600">72</div>
                          <div className="text-xs text-indigo-400 uppercase tracking-wider mt-1">Health Score</div>
                        </div>
                     </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

        </div>
      </div>

      {/* Features Grid */}
      <div id="features" className="py-24 bg-white/50 backdrop-blur-sm border-t border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            <FeatureCard 
              icon={<Shield className="h-6 w-6 text-indigo-600" />}
              title="Security Audits"
              description="Automatically detect and fix common vulnerabilities like XSS, CSRF, and outdated dependencies."
            />
            <FeatureCard 
              icon={<Zap className="h-6 w-6 text-indigo-600" />}
              title="Performance Tuning"
              description="Optimize Core Web Vitals, image loading, and bundle sizes with one-click PRs."
            />
            <FeatureCard 
              icon={<Eye className="h-6 w-6 text-indigo-600" />}
              title="Accessibility"
              description="Ensure your app meets WCAG 2.1 standards with automated ARIA and semantic fixes."
            />
          </div>
        </div>
      </div>
      
      {/* Footer */}
      <footer className="py-12 border-t border-slate-100 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-between items-center text-slate-500 text-sm">
          <p>© 2024 AuditPilot Inc.</p>
          <div className="flex gap-6">
            <a href="#" className="hover:text-indigo-600">Privacy</a>
            <a href="#" className="hover:text-indigo-600">Terms</a>
            <a href="#" className="hover:text-indigo-600">Twitter</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: any, title: string, description: string }) {
  return (
    <div className="group p-8 rounded-2xl bg-white border border-slate-100 hover:border-indigo-100 shadow-sm hover:shadow-xl hover:shadow-indigo-500/10 transition-all duration-300">
      <div className="w-12 h-12 rounded-lg bg-indigo-50 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
        {icon}
      </div>
      <h3 className="text-xl font-bold text-slate-900 mb-3">{title}</h3>
      <p className="text-slate-600 leading-relaxed">{description}</p>
    </div>
  );
}
