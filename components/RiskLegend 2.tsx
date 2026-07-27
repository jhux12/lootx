import React from 'react';
import { RiskSliderIndicator } from './RiskSliderIndicator';

type RiskLegendProps = {
  className?: string;
};

const RISK_LEGEND_ITEMS = [
  { label: 'Safe', value: 20, color: '#22c55e' },
  { label: 'Balanced', value: 50, color: '#38bdf8' },
  { label: 'High Risk', value: 80, color: '#f97316' }
];

export const RiskLegend: React.FC<RiskLegendProps> = ({ className = '' }) => {
  return (
    <div
      className={`flex flex-wrap items-center gap-3 text-[10px] font-semibold uppercase tracking-wide text-gray-400/80 ${className}`}
      aria-label="Risk level legend"
    >
      {RISK_LEGEND_ITEMS.map((item) => (
        <div key={item.label} className="flex items-center gap-2">
          <div className="w-12" style={{ ['--risk-accent' as string]: item.color }}>
            <RiskSliderIndicator value={item.value} size="sm" />
          </div>
          <span className="whitespace-nowrap">{item.label}</span>
        </div>
      ))}
    </div>
  );
};
