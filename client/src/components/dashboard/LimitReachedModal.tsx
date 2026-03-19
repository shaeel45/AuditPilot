import React from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Zap } from "lucide-react";

export function LimitReachedModal({ isOpen, onClose, type, onUpgrade }: { isOpen: boolean, onClose: () => void, type: 'audit' | 'pr', onUpgrade: () => void }) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md bg-white border-indigo-100">
        <DialogHeader className="pt-4 flex flex-col items-center text-center">
          <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center mb-4">
            <Zap className="w-8 h-8 text-amber-500 fill-current" />
          </div>
          <DialogTitle className="text-2xl font-bold text-slate-900">
            {type === 'audit' ? 'Audit Limit Reached' : 'PR Review Limit Reached'}
          </DialogTitle>
          <DialogDescription className="text-slate-500 mt-2">
            {type === 'audit'
              ? "You've used all the audits included in your current plan. Upgrade to a higher tier to continue scanning your repositories for vulnerabilities."
              : "You've reached your monthly limit for PR AI reviews. Upgrade to Pro for 100 reviews per month and unlock advanced features."}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3 py-6">
          <Button onClick={onUpgrade} className="w-full bg-indigo-600 hover:bg-indigo-700 h-12 text-white font-bold shadow-lg shadow-indigo-200">
            View Pricing & Upgrade
          </Button>
          <Button variant="ghost" onClick={onClose} className="text-slate-400">
            Maybe Later
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
