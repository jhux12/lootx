import React from 'react';
import { LiveTicker } from './LiveTicker';

export const LiveWinsStrip: React.FC = () => {
  return (
    <section className="mt-8">
      <div className="group">
        <div className="mb-3 flex items-center justify-between px-1">
          <span className="text-xs font-semibold uppercase tracking-[0.3em] text-gray-500 transition-colors group-hover:text-gray-300">
            Live Wins
          </span>
        </div>
        <LiveTicker />
      </div>
    </section>
  );
};
