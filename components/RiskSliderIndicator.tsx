import React from 'react';

export type RiskSliderIndicatorProps = {
  value: number;
  size?: 'sm' | 'md';
};

export const RiskSliderIndicator: React.FC<RiskSliderIndicatorProps> = ({ value, size = 'sm' }) => {
  const clamped = Math.min(100, Math.max(0, value));
  const trackClass = size === 'md' ? 'h-1.5' : 'h-1';
  const knobClass = size === 'md' ? 'h-2.5 w-2.5' : 'h-2 w-2';

  return (
    <div className="relative w-full">
      <div className={`relative w-full overflow-hidden rounded-full bg-white/10 ${trackClass}`}>
        <div
          className="h-full rounded-full"
          style={{ width: `${clamped}%`, backgroundColor: 'var(--risk-accent, rgba(255,255,255,0.45))' }}
        />
      </div>
      <div
        className="absolute top-1/2 -translate-y-1/2"
        style={{ left: `${clamped}%` }}
        aria-hidden="true"
      >
        <span
          className={`block -translate-x-1/2 rounded-full border border-white/30 bg-white shadow-[0_0_10px_rgba(0,0,0,0.35)] ${knobClass}`}
          style={{ backgroundColor: 'var(--risk-accent, rgba(255,255,255,0.9))' }}
        />
      </div>
    </div>
  );
};
