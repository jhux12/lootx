import React from 'react';

type RiskLegendItem = {
  label: string;
  color: string;
};

const RISK_LEGEND_ITEMS: RiskLegendItem[] = [
  { label: 'Safe', color: '#22c55e' },
  { label: 'Balanced', color: '#f59e0b' },
  { label: 'High Risk', color: '#ef4444' }
];

type RiskLegendProps = {
  className?: string;
};

export const RiskLegend: React.FC<RiskLegendProps> = ({ className = '' }) => {
  return (
    <div
      className={`flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[11px] font-medium text-gray-400/80 ${className}`}
      aria-label="Risk level legend"
    >
      {RISK_LEGEND_ITEMS.map((item) => (
        <div
          key={item.label}
          className="flex items-center gap-1.5"
          style={{ ['--risk-accent' as string]: item.color }}
        >
          <span
            className="h-2 w-2 rounded-full border border-white/20"
            style={{ backgroundColor: 'var(--risk-accent, rgba(255,255,255,0.6))' }}
          />
          <span className="whitespace-nowrap">{item.label}</span>
        </div>
      ))}
    </div>
  );
};
