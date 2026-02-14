import React from 'react';
import { RiskSliderIndicator } from './RiskSliderIndicator';

type RiskLegendProps = {
  className?: string;
};

const RISK_LEGEND_ITEMS = [
  { label: 'Safe', value: 18, color: '#22c55e' },
  { label: 'Balanced', value: 50, color: '#38bdf8' },
  { label: 'Risk', value: 82, color: '#f97316' }
];

export const RiskLegend: React.FC<RiskLegendProps> = ({ className = '' }) => {
  return (
    <div
      className={`flex flex-wrap items-center gap-x-3 gap-y-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-gray-400/85 sm:gap-x-4 ${className}`}
      aria-label="Risk level legend"
    >
      {RISK_LEGEND_ITEMS.map((item) => (
        <div key={item.label} className="flex items-center gap-2.5">
          <div className="w-14" style={{ ['--risk-accent' as string]: item.color }}>
            <RiskSliderIndicator value={item.value} size="sm" />
          </div>
          <span className="whitespace-nowrap">{item.label}</span>
        </div>
      ))}
    </div>
  );
};
