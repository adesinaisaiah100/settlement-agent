import React, { useState } from 'react';
import { Search, MoreVertical, ExternalLink, CheckCircle2, AlertTriangle, FileText, ArrowRight, ShieldAlert } from 'lucide-react';
import { SettlementBatchItem } from '../lib/mockData';

interface ReconciliationTableProps {
  batches: SettlementBatchItem[];
  onSelectBatch: (batch: SettlementBatchItem) => void;
  selectedBatchId?: string;
}

export const ReconciliationTable: React.FC<ReconciliationTableProps> = ({
  batches,
  onSelectBatch,
  selectedBatchId,
}) => {
  const [filter, setFilter] = useState<'ALL' | 'MATH_VERIFIED' | 'STAGED_XERO_DRAFT' | 'ESCALATED_HUMAN_REVIEW'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  const filteredBatches = batches.filter((b) => {
    const matchesFilter = filter === 'ALL' || b.status === filter;
    const matchesSearch =
      b.clientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.batchId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.storeUrl.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const getStatusBadge = (status: SettlementBatchItem['status']) => {
    // Strict Anti-Pill Law: Rectangular rounded-md badges, uppercase tracked text, NO rounded-full
    switch (status) {
      case 'MATH_VERIFIED':
      case 'RECONCILED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200/80 rounded-md text-[11px] font-bold uppercase tracking-wider">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            Math Verified
          </span>
        );
      case 'STAGED_XERO_DRAFT':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-sky-50 text-sky-800 border border-sky-200/80 rounded-md text-[11px] font-bold uppercase tracking-wider">
            <FileText className="w-3.5 h-3.5 text-sky-600" />
            Staged Xero Draft
          </span>
        );
      case 'ESCALATED_HUMAN_REVIEW':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-rose-50 text-rose-800 border border-rose-200/80 rounded-md text-[11px] font-bold uppercase tracking-wider">
            <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
            Escalated Review
          </span>
        );
    }
  };

  const getProcessorBadge = (processor: string) => {
    return (
      <span className="px-2 py-0.5 bg-slate-100 text-slate-700 text-[10px] font-bold uppercase tracking-wider border border-slate-200 rounded-md">
        {processor === 'SHOPIFY_PAYMENTS' ? 'Shopify Pay' : processor}
      </span>
    );
  };

  return (
    <div className="space-y-4">
      {/* Filter Tabs & Search Bar Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 glass-panel p-2.5 rounded-md">
        {/* Filter Tabs (Anti-pill: rounded-md buttons) */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto">
          {[
            { key: 'ALL', label: 'All Settlements', count: batches.length },
            { key: 'MATH_VERIFIED', label: 'Verified', count: batches.filter((b) => b.status === 'MATH_VERIFIED' || b.status === 'RECONCILED').length },
            { key: 'STAGED_XERO_DRAFT', label: 'Staged Draft', count: batches.filter((b) => b.status === 'STAGED_XERO_DRAFT').length },
            { key: 'ESCALATED_HUMAN_REVIEW', label: 'Needs Review', count: batches.filter((b) => b.status === 'ESCALATED_HUMAN_REVIEW').length },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key as any)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition flex items-center gap-2 whitespace-nowrap ${
                filter === tab.key
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-sm ${
                  filter === tab.key ? 'bg-slate-800 text-slate-200' : 'bg-slate-200 text-slate-700'
                }`}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search store, batch ID, URL..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3.5 py-1.5 text-xs bg-white border border-slate-200 rounded-md placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-brand-500 focus:border-brand-500 transition"
          />
        </div>
      </div>

      {/* Floating Batch List Items (space-y-3.5) */}
      <div className="space-y-3">
        {filteredBatches.map((batch) => {
          const isSelected = selectedBatchId === batch.batchId;

          return (
            <div
              key={batch.batchId}
              onClick={() => onSelectBatch(batch)}
              className={`glass-card rounded-md p-4 transition-all duration-150 cursor-pointer relative ${
                isSelected ? 'ring-2 ring-brand-500 border-transparent shadow-md' : 'hover:border-slate-300'
              }`}
            >
              <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
                
                {/* Store & Batch Info */}
                <div className="flex items-start gap-3 min-w-[240px]">
                  <div className="mt-0.5">
                    {getProcessorBadge(batch.processor)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-sm text-slate-900">{batch.clientName}</h4>
                      <span className="text-xs text-slate-400">·</span>
                      <span className="text-xs text-slate-500 flex items-center gap-1 font-mono">
                        {batch.storeUrl}
                        <ExternalLink className="w-3 h-3 text-slate-400" />
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-xs text-slate-500 font-mono">
                      <span className="font-semibold text-slate-700">{batch.batchId}</span>
                      <span>·</span>
                      <span>{new Date(batch.payoutDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                    </div>
                  </div>
                </div>

                {/* Financial Figures: Gross ➔ Fees ➔ Tax ➔ Net */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 w-full lg:w-auto text-left lg:text-right">
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Gross Sales</div>
                    <div className="font-mono font-tabular text-sm font-semibold text-slate-900">
                      ${batch.grossSales.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </div>
                  </div>

                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Gateway Fees</div>
                    <div className="font-mono font-tabular text-sm font-semibold text-amber-700">
                      -${batch.processingFees.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </div>
                  </div>

                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Sales Tax</div>
                    <div className="font-mono font-tabular text-sm font-semibold text-slate-700">
                      +${batch.taxCollected.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </div>
                  </div>

                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Net Deposit</div>
                    <div className="font-mono font-tabular text-sm font-bold text-emerald-700">
                      ${batch.netDeposit.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                </div>

                {/* Status & Actions */}
                <div className="flex items-center gap-3 w-full lg:w-auto justify-between lg:justify-end pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-100">
                  <div>
                    {getStatusBadge(batch.status)}
                  </div>

                  {/* Three-Dot Action Menu Button */}
                  <div className="relative">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveMenuId(activeMenuId === batch.batchId ? null : batch.batchId);
                      }}
                      className="p-1.5 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-md transition"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>

                    {/* Popover Menu */}
                    {activeMenuId === batch.batchId && (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="absolute right-0 mt-1.5 w-52 bg-white border border-slate-200 rounded-md shadow-xl py-1 z-50 text-xs"
                      >
                        <button
                          onClick={() => {
                            onSelectBatch(batch);
                            setActiveMenuId(null);
                          }}
                          className="w-full text-left px-3.5 py-2 hover:bg-slate-50 text-slate-700 flex items-center justify-between font-medium"
                        >
                          View Cash Waterfall
                          <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                        </button>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(JSON.stringify(batch.lines, null, 2));
                            setActiveMenuId(null);
                          }}
                          className="w-full text-left px-3.5 py-2 hover:bg-slate-50 text-slate-700 font-medium"
                        >
                          Copy Journal JSON
                        </button>
                        <div className="border-t border-slate-100 my-1" />
                        <button
                          onClick={() => {
                            alert(`Re-testing deterministic math gate for ${batch.batchId}... Result: Delta is $${batch.balanceDelta.toFixed(2)}`);
                            setActiveMenuId(null);
                          }}
                          className="w-full text-left px-3.5 py-2 hover:bg-slate-50 text-brand-600 font-semibold"
                        >
                          Re-test Math Gate
                        </button>
                      </div>
                    )}
                  </div>
                </div>

              </div>

              {/* Machine Audit Reason Banner (If Escalated) */}
              {batch.escalationReason && (
                <div className="mt-3 pt-2.5 border-t border-rose-100 text-xs text-rose-800 flex items-start gap-2 bg-rose-50/50 p-2 rounded-md">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>
                    <strong>Audit Trigger:</strong> {batch.escalationReason}
                  </span>
                </div>
              )}
            </div>
          );
        })}

        {filteredBatches.length === 0 && (
          <div className="glass-card rounded-md p-10 text-center text-slate-500">
            <p className="font-semibold text-sm">No settlement batches match your active filter.</p>
            <button
              onClick={() => {
                setFilter('ALL');
                setSearchQuery('');
              }}
              className="mt-2 text-xs text-brand-600 font-semibold hover:underline"
            >
              Clear filters and view all
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
