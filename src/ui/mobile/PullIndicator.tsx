import React from 'react';
import { Loader2 } from 'lucide-react';

type PullIndicatorProps = {
  visible: boolean;
  isReady: boolean;
  isRefreshing: boolean;
  pullDistance: number;
};

export const PullIndicator: React.FC<PullIndicatorProps> = ({ visible, isReady, isRefreshing, pullDistance }) => {
  if (!visible && !isRefreshing) return null;

  const label = isRefreshing ? 'Refreshing…' : isReady ? 'Release to refresh' : 'Pull to refresh';
  const opacity = isRefreshing ? 1 : Math.min(1, pullDistance / 56);

  return (
    <div
      className="pointer-events-none fixed left-0 right-0 top-[var(--pullz-header-height,72px)] z-[70] flex h-14 items-center justify-center"
      style={{ opacity }}
      aria-live="polite"
    >
      <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/25 bg-[#0c1320]/85 px-4 py-2 text-xs font-semibold text-cyan-100 shadow-[0_0_20px_rgba(34,211,238,0.15)] backdrop-blur-md">
        {isRefreshing && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
        <span>{label}</span>
      </div>
    </div>
  );
};
