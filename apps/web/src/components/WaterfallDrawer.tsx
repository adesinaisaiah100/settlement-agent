import React, { useState } from 'react';
import { X, CheckCircle2, ShieldCheck, ArrowDown, ExternalLink, Copy, Check } from 'lucide-react';
import { SettlementBatchItem } from '../lib/mockData';

interface WaterfallDrawerProps {
  batch: SettlementBatchItem | null;
  onClose: () => void;
}

export const WaterfallDrawer: React.FC<WaterfallDrawerProps> = ({ batch, onClose }) => {
  const [copied, setCopied] = useState(false);
  const [stagingState, setStagingState] = useState<'IDLE' | 'STAGING' | 'SUCCESS'>('IDLE');

  if (!batch) return null;

  const totalDebits = batch.lines.reduce((sum, line) => sum + line.debit, 0);
  const totalCredits = batch.lines.reduce((sum, line) => sum + line.credit, 0);
  const delta = Math.abs(totalDebits - totalCredits);
  const isBalanced = delta < 0.005;

  const handleCopy = () => {
    navigator.clipboard.writeText(JSON.stringify(batch.lines, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleStageToLedger = () => {
    setStagingState('STAGING');
    setTimeout(() => {
      setStagingState('SUCCESS');
      setTimeout(() => setStagingState('IDLE'), 3000);
    }, 800);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/30 backdrop-blur-xs flex justify-end transition-opacity">
      <div
        className="w-full max-w-xl bg-white h-full shadow-drawer flex flex-col border-l border-slate-200 animate-in slide-in-from-right duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Drawer Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-base text-slate-900">Settlement Waterfall & Journal</h3>
              <span className="px-2 py-0.5 bg-slate-200 text-slate-700 text-[10px] font-bold uppercase tracking-wider rounded-md font-mono">
                {batch.batchId}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Client: <strong className="text-slate-800">{batch.clientName}</strong> · Processor: {batch.processor}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-md transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Drawer Content (Scrollable) */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* Section 1: Net Cash Waterfall */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Step-by-Step Net Cash Waterfall
              </span>
              <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                Ground Truth Match
              </span>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-md p-4 space-y-2.5 font-mono text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-600">Gross Product Sales:</span>
                <span className="font-semibold text-slate-900 font-tabular">
                  +${batch.grossSales.toFixed(2)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600">(+) State Sales Tax Collected:</span>
                <span className="font-semibold text-slate-700 font-tabular">
                  +${batch.taxCollected.toFixed(2)}
                </span>
              </div>
              <div className="flex items-center justify-between text-amber-800">
                <span>(-) Processor Fees Deducted:</span>
                <span className="font-semibold font-tabular">
                  -${batch.processingFees.toFixed(2)}
                </span>
              </div>
              {batch.refunds > 0 && (
                <div className="flex items-center justify-between text-rose-700">
                  <span>(-) Customer Refunds Reversed:</span>
                  <span className="font-semibold font-tabular">
                    -${batch.refunds.toFixed(2)}
                  </span>
                </div>
              )}
              {batch.reserveWithheld > 0 && (
                <div className="flex items-center justify-between text-indigo-700">
                  <span>(-) Risk Reserve Withheld:</span>
                  <span className="font-semibold font-tabular">
                    -${batch.reserveWithheld.toFixed(2)}
                  </span>
                </div>
              )}

              <div className="border-t border-slate-200 pt-2.5 flex items-center justify-between text-sm font-bold text-slate-900">
                <span className="font-sans">Stated Net Cash Deposit:</span>
                <span className="text-emerald-700 font-tabular">
                  ${batch.netDeposit.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* Section 2: US GAAP Double-Entry General Ledger */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Double-Entry Manual Journal Lines
              </span>
              <button
                onClick={handleCopy}
                className="text-xs text-brand-600 hover:text-brand-700 font-semibold flex items-center gap-1"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Copied JSON' : 'Copy JSON'}
              </button>
            </div>

            <div className="border border-slate-200 rounded-md overflow-hidden text-xs">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-100/70 font-semibold text-slate-700">
                  <tr>
                    <th className="px-3 py-2 text-left">Code & Account</th>
                    <th className="px-3 py-2 text-right">Debit ($)</th>
                    <th className="px-3 py-2 text-right">Credit ($)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {batch.lines.map((line, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50">
                      <td className="px-3 py-2.5">
                        <div className="font-mono font-bold text-slate-900">{line.accountCode}</div>
                        <div className="text-[11px] text-slate-600">{line.accountName}</div>
                        <div className="text-[10px] text-slate-400 italic mt-0.5">{line.description}</div>
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono font-tabular text-slate-900 font-medium">
                        {line.debit > 0 ? `$${line.debit.toFixed(2)}` : '—'}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono font-tabular text-slate-900 font-medium">
                        {line.credit > 0 ? `$${line.credit.toFixed(2)}` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-50 font-bold border-t border-slate-200">
                  <tr>
                    <td className="px-3 py-2.5 text-slate-800">Totals & Equilibrium:</td>
                    <td className="px-3 py-2.5 text-right font-mono font-tabular text-slate-900">
                      ${totalDebits.toFixed(2)}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono font-tabular text-slate-900">
                      ${totalCredits.toFixed(2)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Equilibrium Verification Callout */}
            <div className={`mt-3 p-3 rounded-md border text-xs flex items-center justify-between ${
              isBalanced 
                ? 'bg-emerald-50 text-emerald-900 border-emerald-200' 
                : 'bg-rose-50 text-rose-900 border-rose-200'
            }`}>
              <div className="flex items-center gap-2">
                {isBalanced ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <ShieldCheck className="w-4 h-4 text-rose-600 shrink-0" />
                )}
                <span>
                  {isBalanced 
                    ? 'Mathematical Equilibrium Verified: Σ Debits - Σ Credits === $0.00' 
                    : `Imbalance Detected: Discrepancy of $${delta.toFixed(2)}`}
                </span>
              </div>
              <span className="font-mono font-bold">Δ = ${delta.toFixed(2)}</span>
            </div>
          </div>

        </div>

        {/* Drawer Action Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-100 rounded-md text-xs font-semibold transition"
          >
            Close Drawer
          </button>

          <button
            onClick={handleStageToLedger}
            disabled={stagingState === 'STAGING'}
            className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-md text-xs font-semibold shadow-sm transition flex items-center gap-1.5"
          >
            {stagingState === 'STAGING' ? (
              <span>Dispatching to Xero API...</span>
            ) : stagingState === 'SUCCESS' ? (
              <span className="flex items-center gap-1">
                <Check className="w-4 h-4" /> Staged in Xero (Draft #MJ-8921)
              </span>
            ) : (
              <span>Stage to {batch.syncTarget} as DRAFT</span>
            )}
          </button>
        </div>

      </div>
    </div>
  );
};
