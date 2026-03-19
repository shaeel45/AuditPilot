import React from "react";
import { motion } from "framer-motion";
import { 
  Github, 
  Shield, 
  Zap, 
  GitPullRequest, 
  CheckCircle2, 
  ArrowRight, 
  Code2, 
  Search, 
  MousePointer2,
  Lock
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import Navbar from "@/components/layout/Navbar";
import Head from "@/components/seo/Head";

export default function HowItWorks() {
  const steps = [
    {
      icon: <Github className="w-8 h-8 text-indigo-600" />,
      title: "Connect GitHub",
      description: "Securely authorize AuditPilot to access your repositories via GitHub OAuth. We only request the permissions needed to scan and create PRs.",
      details: ["One-click integration", "Secure OAuth 2.0", "Repository selection control"]
    },
    {
      icon: <Search className="w-8 h-8 text-indigo-600" />,
      title: "Run AI Audit",
      description: "Our advanced AI engine scans your codebase for security vulnerabilities, performance bottlenecks, and accessibility issues.",
      details: ["Comprehensive security scan", "Core Web Vitals check", "Accessibility audit (WCAG 2.1)"]
    },
    {
      icon: <Zap className="w-8 h-8 text-indigo-600" />,
      title: "Review AI Fixes",
      description: "AuditPilot doesn't just find problems—it generates precise code fixes. Review the 'before' and 'after' code snippets in seconds.",
      details: ["Intelligent code generation", "Side-by-side diff view", "Context-aware corrections"]
    },
    {
      icon: <GitPullRequest className="w-8 h-8 text-indigo-600" />,
      title: "Push Auto-Fixes",
      description: "Satisfied with the suggestions? Push them directly to your repository as a new Pull Request with one click.",
      details: ["Automatic branch creation", "Detailed PR descriptions", "Clean commits"]
    },
    {
      icon: <CheckCircle2 className="w-8 h-8 text-indigo-600" />,
      title: "Merge & Improve",
      description: "Review the PR on GitHub, run your tests, and merge. Your code is now more secure, faster, and more accessible.",
      details: ["Permanent code health boost", "Automatic branch cleanup", "CI/CD compatibility"]
    }
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-foreground bg-mesh-light selection:bg-indigo-100 selection:text-indigo-900">
      <Head 
        title="How it Works - AuditPilot" 
        description="Stop writing security reports and start shipping fixes. Learn how AuditPilot automates the entire code health journey." 
      />
      <Navbar />

      <main className="pt-32 pb-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-20">
            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-4xl md:text-5xl font-extrabold text-slate-900 mb-6 tracking-tight"
            >
              How it <span className="text-gradient">Works</span>
            </motion.h1>
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-xl text-slate-600 max-w-2xl mx-auto"
            >
              Stop writing security reports and start shipping fixes. AuditPilot automates the entire code health journey.
            </motion.p>
          </div>

          <div className="relative space-y-24">
            {/* The Connecting Line (Vertical on mobile, Hidden behind cards) */}
            <div className="absolute left-[50%] top-0 bottom-0 w-px bg-slate-200 hidden lg:block" />

            {steps.map((step, idx) => (
              <motion.div 
                key={idx}
                initial={{ opacity: 0, x: idx % 2 === 0 ? -50 : 50 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ duration: 0.6, ease: "easeOut" }}
                className={`flex flex-col ${idx % 2 === 0 ? 'lg:flex-row' : 'lg:flex-row-reverse'} items-center gap-12 lg:gap-24`}
              >
                <div className="flex-1 w-full lg:w-auto">
                  <div className={`p-8 bg-white rounded-3xl border border-slate-200 shadow-xl shadow-slate-200/50 hover:shadow-indigo-500/5 transition-all group relative overflow-hidden h-full`}>
                    <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:scale-110 transition-transform duration-500">
                      {step.icon}
                    </div>
                    
                    <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center mb-8 ring-4 ring-indigo-50/50">
                      {step.icon}
                    </div>
                    
                    <h3 className="text-2xl font-bold text-slate-900 mb-4 flex items-center gap-3">
                      <span className="text-indigo-600 opacity-20 text-4xl">0{idx + 1}.</span>
                      {step.title}
                    </h3>
                    
                    <p className="text-slate-600 mb-8 leading-relaxed text-lg">
                      {step.description}
                    </p>

                    <ul className="space-y-3 pt-6 border-t border-slate-100">
                      {step.details.map((detail, dIdx) => (
                        <li key={dIdx} className="flex items-center gap-3 text-sm text-slate-500 font-medium">
                          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                          {detail}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="flex-1 w-full lg:w-auto flex justify-center">
                   <div className="w-full max-w-md aspect-square bg-slate-200/20 rounded-3xl border-2 border-dashed border-slate-200 flex items-center justify-center group overflow-hidden relative">
                      {/* Abstract Visual Representing the Step */}
                      {idx === 0 && <Github className="w-32 h-32 text-slate-300 animate-pulse group-hover:text-indigo-200 transition-colors" />}
                      {idx === 1 && <Search className="w-32 h-32 text-slate-300 animate-bounce group-hover:text-indigo-200 transition-colors" />}
                      {idx === 2 && <Code2 className="w-32 h-32 text-slate-300 group-hover:text-indigo-200 transition-colors" />}
                      {idx === 3 && <GitPullRequest className="w-32 h-32 text-slate-300 group-hover:text-indigo-200 transition-colors" />}
                      {idx === 4 && <CheckCircle2 className="w-32 h-32 text-slate-300 group-hover:text-emerald-200 transition-colors" />}
                   </div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Bottom CTA */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="mt-32 p-12 bg-slate-900 rounded-[3rem] text-center text-white relative overflow-hidden shadow-2xl shadow-indigo-500/20"
          >
            <div className="absolute top-0 right-0 p-12 opacity-10">
              <Zap className="w-48 h-48 text-indigo-400" />
            </div>
            
            <h2 className="text-3xl md:text-4xl font-bold mb-6 relative z-10">Ready to secure your codebase?</h2>
            <p className="text-indigo-100/70 text-lg mb-10 max-w-xl mx-auto relative z-10">
              Join hundreds of developers using AuditPilot to automate their security and performance maintenance.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center relative z-10">
               <Link href="/auth">
                 <Button size="lg" className="h-14 px-10 text-lg rounded-full bg-white text-slate-900 hover:bg-slate-100 font-bold shadow-xl">
                   <Github className="mr-3 h-6 w-6" />
                   Start Your First Audit
                 </Button>
               </Link>
               <Link href="/pricing" className="text-white hover:text-indigo-200 font-semibold flex items-center gap-2 h-14 px-6 border border-white/20 rounded-full backdrop-blur-sm hover:bg-white/5 transition-all">
                  See Pricing
                  <ArrowRight className="w-4 h-4" />
               </Link>
            </div>

            <div className="mt-8 flex items-center justify-center gap-8 text-xs text-white/40 uppercase tracking-widest font-bold">
               <span className="flex items-center gap-2"><Lock className="w-3 h-3" /> Secure OAuth</span>
               <span className="flex items-center gap-2"><Shield className="w-3 h-3" /> Private Repo Support</span>
            </div>
          </motion.div>
        </div>
      </main>

      <footer className="py-12 border-t border-slate-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-8 text-slate-500 text-sm font-medium">
          <div className="flex items-center gap-3">
             <img src="/logo.png" alt="AuditPilot Logo" className="w-8 h-8 rounded object-contain" />
             <span>© 2024 AuditPilot Inc.</span>
          </div>
          <div className="flex gap-8">
            <Link href="/" className="hover:text-indigo-600 transition-colors">Home</Link>
            <Link href="/pricing" className="hover:text-indigo-600 transition-colors">Pricing</Link>
            <a href="#" className="hover:text-indigo-600 transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-indigo-600 transition-colors">Terms of Service</a>
          </div>
          <div className="flex gap-4">
             <Button variant="ghost" size="icon" className="rounded-full hover:bg-slate-100"><Github className="w-5 h-5" /></Button>
          </div>
        </div>
      </footer>
    </div>
  );
}
