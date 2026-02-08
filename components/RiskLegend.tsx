import React from 'react';

const RISK_ITEMS = [
  { label: 'Safe', color: '#22c55e' },
  { label: 'Balanced', color: '#fbbf24' },
  { label: 'High Risk', color: '#f87171' }
];

type RiskLegendProps = {
  className?: string;
};

export const RiskLegend: React.FC<RiskLegendProps> = ({ className }) => (
  <div
    className={`flex flex-wrap items-center gap-3 text-[10px] font-semibold uppercase tracking-wide text-gray-400/80 sm:text-[11px] ${
      className ?? ''
    }`}
    aria-label="Risk legend"
  >
    {RISK_ITEMS.map((item) => (
      <div
        key={item.label}
        className="inline-flex items-center gap-1.5"
        style={{ ['--risk-accent' as string]: item.color }}
      >
        <span
          className="h-2 w-2 rounded-full bg-white/70 shadow-[0_0_6px_rgba(0,0,0,0.25)]"
          style={{ backgroundColor: 'var(--risk-accent, rgba(255,255,255,0.9))' }}
        />
        <span>{item.label}</span>
      </div>
    ))}
  </div>
);
