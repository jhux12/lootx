import React from 'react';

type Props = {
  chance: number;
  sourceName?: string;
  targetName?: string;
};

export const ChancePreview: React.FC<Props> = ({ chance, sourceName, targetName }) => (
  <div className="rounded-2xl border border-white/10 bg-[#10192e] p-4">
    <div className="text-xs uppercase tracking-wide text-gray-400">3) Success Chance</div>
    <div className="mt-1 text-3xl font-black text-emerald-300">{(chance * 100).toFixed(2)}%</div>
    <div className="mt-2 text-sm text-gray-300">You risk: <span className="font-semibold text-white">{sourceName || '—'}</span></div>
    <div className="text-sm text-gray-300">You could win: <span className="font-semibold text-white">{targetName || '—'}</span></div>
    <p className="mt-3 rounded-lg border border-rose-500/30 bg-rose-500/10 p-2 text-xs text-rose-200">If you lose, your source item is consumed.</p>
  </div>
);
