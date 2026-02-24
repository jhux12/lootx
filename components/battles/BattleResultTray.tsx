import React from 'react';

export const BattleResultTray: React.FC<{
  open: boolean;
  variant: 'WIN' | 'LOSE' | 'SPECTATE';
  headline: string;
  bestHit: any;
  items: any[];
  totals: { A: number; B: number };
  onRecreate: () => void;
  onClose: () => void;
}> = ({ open, variant, headline, bestHit, items, totals, onRecreate, onClose }) => (
  <>
    <div onClick={onClose} className={`fixed inset-0 z-[88] bg-black/60 transition ${open ? 'opacity-100' : 'pointer-events-none opacity-0'}`} />
    <div className={`fixed inset-x-0 bottom-0 z-[89] transition-transform duration-300 ${open ? 'translate-y-0' : 'translate-y-full'}`}>
      <div className="mx-auto max-w-4xl rounded-t-2xl border border-white/10 bg-[#0c1421] p-4">
        <div className="mb-2 text-xs text-gray-400">{variant}</div>
        <h3 className="text-xl font-bold text-white">{headline}</h3>
        {bestHit && <div className="mt-2 text-sm text-emerald-300">Best hit: {bestHit.name} • {bestHit.value?.toLocaleString?.() ?? 0}</div>}
        <div className="mt-2 text-sm text-gray-200">Totals • A: {totals.A.toLocaleString()} • B: {totals.B.toLocaleString()}</div>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">{items.slice(0, 8).map((it, i) => <div key={`${it.id ?? it.name}-${i}`} className="truncate rounded border border-white/10 bg-white/5 p-2 text-xs text-gray-200">{it.name || it.itemName}</div>)}</div>
        <div className="mt-3 flex gap-2">
          <button onClick={onRecreate} className="rounded-lg bg-brand-purple px-3 py-2 text-xs font-semibold text-white">Recreate Battle</button>
          <button onClick={onClose} className="ml-auto rounded-lg border border-white/20 px-3 py-2 text-xs text-gray-200">Close</button>
        </div>
      </div>
    </div>
  </>
);
