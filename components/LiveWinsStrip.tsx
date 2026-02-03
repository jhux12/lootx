import React from 'react';
import { LiveTicker } from './LiveTicker';

export const LiveWinsStrip: React.FC = () => {
  return (
    <section className="group mt-8">
      <div className="mb-2 flex items-center justify-between px-2 text-xs font-semibold uppercase tracking-[0.3em] text-gray-500/80 transition-colors group-hover:text-gray-300">
        <span>Live Wins</span>
      </div>
      <div className="overflow-hidden rounded-2xl border border-white/5 bg-[#0c111a]/80 shadow-[0_10px_40px_-32px_rgba(0,0,0,0.9)]">
        <LiveTicker />
      </div>
    </section>
  );
};
