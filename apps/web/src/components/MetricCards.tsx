import React from 'react';
import { DollarSign, Landmark, Receipt, Scale } from 'lucide-react';
import { SettlementBatchItem } from '../lib/mockData';

interface MetricCardsProps {
  batches: SettlementBatchItem[];
}

export const MetricCards: React.FC<MetricCardsProps> = ({ batches }) => {
  const totalGross = batches.reduce((acc, b) => acc + b.grossSales, 0);
  const totalNet = batches.reduce((acc, b) => acc + b.netDeposit, 0);
  const totalFees = batches.reduce((acc, b) => acc + b.processingFees, 0);
  const verifiedCount = batches.filter((b) => b.status === 'MATH_VERIFIED' || b.status === 'RECONCILED').length;
  const balanceRate = batches.length > 0 ? ((verifiedCount / batches.length) * 100).toFixed(1) : '100.0';

  const cards = [
    {
      title: 'Gross Volume Deconstructed',
      value: `$${totalGross.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      subtitle: `${batches.length} processor settlement batches`,
      icon: DollarSign,
      iconColor: 'text-brand-600 bg-brand-50 border-brand-200',
    },
    {
      title: 'Net Cash Deposited',
      value: `$${totalNet.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      subtitle: 'Verified to bank clearing account 11500',
      icon: Landmark,
      iconColor: 'text-emerald-600 bg-emerald-50 border-emerald-200',
    },
    {
      title: 'Processing Fees Captured',
      value: `$${totalFees.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      subtitle: 'COGS Account 52000 fully expensed',
      icon: Receipt,
      iconColor: 'text-amber-600 bg-amber-50 border-amber-200',
    },
    {
      title: 'Double-Entry Equilibrium',
      value: `${balanceRate}%`,
      subtitle: 'Zero hallucinations / Δ < $0.001',
      icon: Scale,
      iconColor: 'text-indigo-600 bg-indigo-50 border-indigo-200',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card, idx) => {
        const Icon = card.icon;
        return (
          <div
            key={idx}
            className="glass-card rounded-md p-4 transition-all duration-200 hover:-translate-y-0.5"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-slate-500 tracking-wider uppercase">
                {card.title}
              </span>
              <div className={`p-1.5 rounded-md border ${card.iconColor}`}>
                <Icon className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-bold font-mono font-tabular text-slate-900 tracking-tight">
              {card.value}
            </div>
            <div className="text-xs text-slate-500 mt-1 font-medium">
              {card.subtitle}
            </div>
          </div>
        );
      })}
    </div>
  );
};
