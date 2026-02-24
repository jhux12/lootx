import React from 'react';

export const RoundDots: React.FC<{ count: number; current: number; animatedRounds: Set<number> }> = ({ count, current, animatedRounds }) => (
  <div className="flex items-center justify-center gap-1.5">
    {Array.from({ length: count }).map((_, i) => (
      <span key={i} className={`h-2.5 w-2.5 rounded-full ${animatedRounds.has(i) ? 'bg-emerald-400' : i === current ? 'bg-brand-purple' : 'bg-white/20'}`} />
    ))}
  </div>
);
