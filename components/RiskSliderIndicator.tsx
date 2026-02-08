import React from 'react';

type RiskSliderIndicatorProps = {
  value: number;
  size?: 'sm' | 'md';
};

const clampValue = (value: number) => Math.min(100, Math.max(0, value));

export const RiskSliderIndicator: React.FC<RiskSliderIndicatorProps> = ({ value, size = 'sm' }) => {
  const clampedValue = clampValue(value);
  const trackHeight = size === 'md' ? 'h-1.5' : 'h-1';
  const knobSize = size === 'md' ? 'h-3 w-3' : 'h-2.5 w-2.5';

  return (
    <div className="relative w-full">
      <div className={`w-full rounded-full bg-white/10 ${trackHeight}`} />
      <div
        className={`absolute left-0 top-0 rounded-full bg-white/40 ${trackHeight}`}
        style={{ width: `${clampedValue}%` }}
      />
      <div
        className={`absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/40 bg-white/70 shadow-[0_0_8px_rgba(255,255,255,0.35)] ${knobSize}`}
        style={{ left: `${clampedValue}%` }}
      />
    </div>
  );
};
