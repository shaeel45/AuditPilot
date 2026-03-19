import { Button } from "@/components/ui/button";
import { Check, Loader2 } from "lucide-react";
import { Link } from "wouter";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

export default function Pricing() {
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const { toast } = useToast();

  const handleUpgrade = async (plan: string) => {
    setLoadingPlan(plan);
    try {
      const response = await fetch("/api/billing/create-checkout-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("audit_token")}`
        },
        body: JSON.stringify({ plan: plan.toLowerCase() })
      });

      if (!response.ok) {
        throw new Error("Failed to create checkout session");
      }

      const { url } = await response.json();
      window.location.href = url;
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Failed to start checkout. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoadingPlan(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-foreground bg-mesh-light selection:bg-indigo-100 selection:text-indigo-900">
      {/* Navigation - Duplicated from Landing for now, normally would be a component */}
      <nav className="fixed w-full z-50 glass-panel border-b border-slate-200/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <Link href="/">
              <div className="flex-shrink-0 flex items-center gap-2 cursor-pointer">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center text-white font-bold">
                  A
                </div>
                <span className="font-bold text-xl tracking-tight">AuditPilot</span>
              </div>
            </Link>
            <div className="hidden md:flex items-center space-x-8">
               <Link href="/" className="text-sm font-medium text-slate-600 hover:text-indigo-600 transition-colors">Home</Link>
            </div>
            <div className="flex items-center gap-4">
              <Link href="/auth">
                <Button className="bg-slate-900 hover:bg-slate-800 text-white rounded-full px-6 shadow-lg shadow-indigo-500/20 transition-all hover:shadow-indigo-500/40">
                  Connect GitHub
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <div className="pt-32 pb-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-slate-900 mb-6">Simple, transparent pricing</h1>
          <p className="text-xl text-slate-600 mb-16 max-w-2xl mx-auto">
            Choose the plan that's right for your team. All plans include our core security and performance auditing features.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {/* Starter Plan */}
            <PricingCard 
              name="Starter"
              price="Free"
              description="Perfect for solo developers and side projects."
              features={[
                "2 PR reviews only",
                "5 run audits only",
                "Basic AI Audit",
                "Community support",
                "Weekly automated audits",
              ]}
              buttonText="Current Plan"
              onClick={() => {}}
              disabled={true}
            />
            
            {/* Pro Plan */}
            <PricingCard 
              name="Pro"
              price="$149"
              featured={true}
              description="For growing startups and serious teams."
              features={[
                "100 PR reviews",
                "100 run audits",
                "Unlimited Repositories",
                "Advanced AI Insights",
                "Priority Support",
                "Real-time PR Audits",
                "Custom Fix Suggestions"
              ]}
              buttonText="Upgrade to Pro"
              loading={loadingPlan === 'Pro'}
              onClick={() => handleUpgrade('pro')}
            />

            {/* Agency Plan */}
            <PricingCard 
              name="Agency"
              price="Custom"
              description="For agencies managing multiple client projects."
              features={[
                "Unlimited PR reviews",
                "Unlimited run audits",
                "White-label reports",
                "Dedicated success manager",
                "Custom rules engine",
                "Enterprise Security"
              ]}
              buttonText="Contact Sales"
              loading={loadingPlan === 'Agency'}
              onClick={() => handleUpgrade('agency')}
            />
          </div>

          <div className="mt-16 text-center">
             <p className="text-slate-500 text-sm mb-4">No credit card required for initial audit</p>
             <Link href="/auth">
               <Button variant="link" className="text-indigo-600 text-lg">Start your free audit now &rarr;</Button>
             </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function PricingCard({ name, price, description, features, featured = false, buttonText, onClick, loading, disabled }: any) {
  return (
    <div className={`relative p-8 rounded-2xl border ${featured ? 'border-indigo-600 shadow-2xl shadow-indigo-500/20 bg-white transform scale-105 z-10' : 'border-slate-200 bg-white/50 hover:border-indigo-200 hover:shadow-xl transition-all'}`}>
      {featured && (
        <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-indigo-600 text-white px-4 py-1 rounded-full text-xs font-bold tracking-wide uppercase">
          Most Popular
        </div>
      )}
      <div className="mb-8">
        <h3 className="text-lg font-semibold text-slate-900 mb-2">{name}</h3>
        <div className="flex items-baseline gap-1">
          <span className="text-4xl font-bold text-slate-900">{price}</span>
          {price !== 'Custom' && price !== 'Free' && <span className="text-slate-500">/month</span>}
        </div>
        <p className="text-slate-500 mt-4 text-sm leading-relaxed">{description}</p>
      </div>
      <ul className="space-y-4 mb-8 text-left">
        {features.map((feature: string, i: number) => (
          <li key={i} className="flex items-center gap-3 text-sm text-slate-700">
            <Check className="w-5 h-5 text-indigo-600 flex-shrink-0" />
            {feature}
          </li>
        ))}
      </ul>
      <Button 
        onClick={onClick}
        disabled={disabled || loading}
        className={`w-full h-12 rounded-lg font-semibold ${featured ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-600/20' : 'bg-slate-900 hover:bg-slate-800 text-white'}`}
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : buttonText || 'Get Started'}
      </Button>
    </div>
  );
}
