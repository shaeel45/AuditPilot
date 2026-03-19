import React from "react";

export function UsageCounter({ label, used, limit, className = "" }: { label: string, used: number, limit: number, className?: string }) {
  const percent = Math.min(100, (used / limit) * 100);
  return (
    <div className={className}>
      <div className="flex justify-between text-[10px] mb-1">
        <span className="text-slate-500 font-medium">{label}</span>
        <span className="text-slate-700 font-bold">{used}/{limit}</span>
      </div>
      <div className="h-1 w-full bg-slate-200 rounded-full overflow-hidden">
        <div
          className={`h-full transition-all duration-500 ${percent > 80 ? 'bg-amber-500' : 'bg-indigo-500'}`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
