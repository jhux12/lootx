import React from 'react';

type RiskSliderIndicatorProps = {
  value: number;
  size?: 'sm' | 'md';
};

const SIZE_STYLES = {
  sm: {
    track: 'h-1 w-16',
    fill: 'h-1',
    knob: 'h-2.5 w-2.5'
  },
  md: {
    track: 'h-1.5 w-24',
    fill: 'h-1.5',
    knob: 'h-3 w-3'
  }
};

const clampValue = (value: number) => Math.min(100, Math.max(0, value));

export const RiskSliderIndicator: React.FC<RiskSliderIndicatorProps> = ({ value, size = 'sm' }) => {
  const clamped = clampValue(value);
  const styles = SIZE_STYLES[size] ?? SIZE_STYLES.sm;

  return (
    <div className={`relative ${styles.track} rounded-full bg-white/10`} aria-hidden="true">
      <div
        className={`absolute left-0 top-0 ${styles.fill} rounded-full bg-white/40`}
        style={{ width: `${clamped}%` }}
      />
      <div
        className={`absolute top-1/2 ${styles.knob} -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/80 shadow-[0_0_8px_rgba(255,255,255,0.35)]`}
        style={{ left: `${clamped}%` }}
      />
    </div>
  );
};
