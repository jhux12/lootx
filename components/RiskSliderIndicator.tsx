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
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(90deg, rgba(34,197,94,0.32) 0%, rgba(34,197,94,0.12) 30%, rgba(56,189,248,0.34) 50%, rgba(249,115,22,0.14) 70%, rgba(249,115,22,0.34) 100%)'
          }}
        />
        <div
          className="absolute inset-y-0 left-1/3 w-px bg-white/25"
          aria-hidden="true"
        />
        <div
          className="absolute inset-y-0 left-2/3 w-px bg-white/25"
          aria-hidden="true"
        />
        <div
          className="absolute inset-y-0 left-0 rounded-full"
          style={{
            width: `${clamped}%`,
            background: 'linear-gradient(90deg, rgba(255,255,255,0.14), var(--risk-accent, rgba(255,255,255,0.7)))'
          }}
        />
      </div>

      <div
        className="absolute top-1/2 -translate-y-1/2"
        style={{ left: `calc(${clamped}% * 0.96 + 2%)` }}
        aria-hidden="true"
      >
        <span
          className={`block -translate-x-1/2 rounded-full border border-white/70 bg-white/95 ${knobClass}`}
          style={{
            boxShadow: '0 0 8px rgba(255,255,255,0.25)'
          }}
        />
      </div>
    </div>
  );
};
