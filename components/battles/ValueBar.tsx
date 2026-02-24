import React from 'react';

export const ValueBar: React.FC<{ a: number; b: number; crazyMode?: boolean }> = ({ a, b, crazyMode }) => {
  const total = Math.max(1, a + b);
  const aPct = (a / total) * 100;
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-2">
      <div className="mb-1 flex justify-between text-xs text-gray-300"><span>Team A: {a.toLocaleString()}</span><span>{crazyMode ? 'Lowest wins' : 'Highest wins'}</span><span>Team B: {b.toLocaleString()}</span></div>
      <div className="h-2 overflow-hidden rounded bg-white/10"><div className="h-full bg-gradient-to-r from-violet-500 to-cyan-400" style={{ width: `${aPct}%` }} /></div>
    </div>
  );
};
