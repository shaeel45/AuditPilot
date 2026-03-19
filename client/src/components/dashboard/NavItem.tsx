import React from "react";

export function NavItem({ active, icon, label, onClick }: { active: boolean, icon: any, label: string, onClick?: () => void }) {
  return (
    <div
      onClick={onClick}
      className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium cursor-pointer transition-colors ${active ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
    >
      {icon}
      {label}
    </div>
  );
}
