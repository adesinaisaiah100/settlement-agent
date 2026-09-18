import React from 'react';
import { ShieldCheck, Building2, ChevronDown, Cpu, RefreshCw } from 'lucide-react';

interface NavbarProps {
  currentFirm: string;
  onSelectFirm: (firm: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentFirm, onSelectFirm }) => {
  const firms = [
    'Basis 365 Accounting',
    'System Six Bookkeeping',
    'Upsourced Accounting',
    'Spark Accounting Solutions',
  ];

  return (
    <header className="sticky top-0 z-30 w-full glass-panel border-b border-slate-200/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        
        {/* Brand & Identity */}
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 bg-slate-900 text-white rounded-md flex items-center justify-center font-bold text-base shadow-sm border border-slate-800">
            SA
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-900 tracking-tight text-base">Settlement Agent</span>
              {/* Anti-Pill Law: Clean rectangular badge, rounded-md (6px), no rounded-full */}
              <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-bold uppercase tracking-wider border border-slate-200 rounded-md">
                v1.0 Edge
              </span>
            </div>
            <p className="text-xs text-slate-500 hidden sm:block">Multi-Stream Autonomous Payout Reconciliation</p>
          </div>
        </div>

        {/* Center: CAS Practice Switcher */}
        <div className="relative group">
          <button className="flex items-center gap-2.5 px-3.5 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-md text-sm font-medium text-slate-800 shadow-sm transition">
            <Building2 className="w-4 h-4 text-brand-600" />
            <span>{currentFirm}</span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>
          <div className="absolute right-0 mt-1.5 w-60 bg-white border border-slate-200 rounded-md shadow-lg py-1 hidden group-hover:block z-40">
            <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
              Active CAS Practice
            </div>
            {firms.map((firm) => (
              <button
                key={firm}
                onClick={() => onSelectFirm(firm)}
                className={`w-full text-left px-3.5 py-2 text-xs font-medium hover:bg-slate-50 flex items-center justify-between ${
                  firm === currentFirm ? 'text-brand-600 font-semibold bg-brand-50/40' : 'text-slate-700'
                }`}
              >
                {firm}
                {firm === currentFirm && <div className="w-1.5 h-1.5 bg-brand-600 rounded-sm" />}
              </button>
            ))}
          </div>
        </div>

        {/* Right Status & Actions */}
        <div className="flex items-center gap-3">
          {/* Anti-Pill Law: Math Gate Status Tag (sharp rectangular geometry, rounded-md, no pill) */}
          <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200/80 rounded-md text-xs font-semibold">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span className="tracking-wide">MATH GATE: ARMED</span>
          </div>

          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 text-slate-700 border border-slate-200 rounded-md text-xs font-medium">
            <Cpu className="w-3.5 h-3.5 text-slate-500" />
            <span>Workers 0ms</span>
          </div>

          <button
            onClick={() => window.location.reload()}
            title="Refresh Ingest Feed"
            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 border border-slate-200 rounded-md transition shadow-sm"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

      </div>
    </header>
  );
};
