import React, { useState } from 'react';
import { Navbar } from './components/Navbar';
import { MetricCards } from './components/MetricCards';
import { ReconciliationTable } from './components/ReconciliationTable';
import { WaterfallDrawer } from './components/WaterfallDrawer';
import { MOCK_SETTLEMENT_BATCHES, SettlementBatchItem } from './lib/mockData';
import { ShieldCheck, ArrowRight } from 'lucide-react';

export function App() {
  const [currentFirm, setCurrentFirm] = useState('Basis 365 Accounting');
  const [batches, setBatches] = useState<SettlementBatchItem[]>(MOCK_SETTLEMENT_BATCHES);
  const [selectedBatch, setSelectedBatch] = useState<SettlementBatchItem | null>(null);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top Navbar */}
      <Navbar currentFirm={currentFirm} onSelectFirm={setCurrentFirm} />

      {/* Main Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        
        {/* Sub-Header Banner */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              Settlement Ingestion & Journal Staging
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Automated deconstruction of processor net deposits into gross revenue, sales taxes, and merchant fees.
            </p>
          </div>

          {/* Quick Info Badge (Anti-Pill: rounded-md) */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-brand-50/60 border border-brand-200/80 rounded-md text-xs text-brand-900 font-medium">
            <ShieldCheck className="w-4 h-4 text-brand-600" />
            <span>Dual-Gate Anti-Hallucination Barrier Active</span>
          </div>
        </div>

        {/* 4 Metric Cards */}
        <MetricCards batches={batches} />

        {/* Floating Reconciliation Table & Toolbar */}
        <ReconciliationTable
          batches={batches}
          onSelectBatch={(batch) => setSelectedBatch(batch)}
          selectedBatchId={selectedBatch?.batchId}
        />

      </main>

      {/* Interactive Sliding Waterfall Drawer */}
      {selectedBatch && (
        <WaterfallDrawer
          batch={selectedBatch}
          onClose={() => setSelectedBatch(null)}
        />
      )}

      {/* Footer */}
      <footer className="w-full border-t border-slate-200 bg-white py-4 mt-12 text-center text-xs text-slate-400">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>Settlement Agent © 2026 · Built for Basis 365 Accounting & High-Growth CAS Practices</span>
          <span className="font-mono text-[11px] text-slate-500">Strict Double-Entry Math Equilibrium: Σ Debits ≡ Σ Credits</span>
        </div>
      </footer>
    </div>
  );
}

export default App;
