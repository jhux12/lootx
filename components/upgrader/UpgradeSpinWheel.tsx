import React from 'react';
import { UpgraderTarget } from '../../utils/upgrader';

type Props = {
  chance: number;
  spinning: boolean;
  target?: UpgraderTarget;
};

export const UpgradeSpinWheel: React.FC<Props> = ({ chance, spinning, target }) => {
  const chancePercent = Math.max(0, Math.min(100, chance * 100));
  const wheelStyle = {
    background: `conic-gradient(#22c55e 0deg ${chancePercent * 3.6}deg, #1f2937 ${chancePercent * 3.6}deg 360deg)`
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-[#0d1426] p-4">
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-400">Upgrade Spinner</h3>
      <div className="relative mx-auto h-64 w-64 max-w-full sm:h-72 sm:w-72">
        <div className={`absolute inset-0 rounded-full p-2 ${spinning ? 'animate-[spin_1.2s_linear_infinite]' : ''}`} style={wheelStyle}>
          <div className="flex h-full w-full items-center justify-center rounded-full bg-[#0b1020]">
            <div className="text-center">
              {target?.imageUrl ? <img src={target.imageUrl} alt={target.name} className="mx-auto h-24 w-24 rounded-2xl object-cover sm:h-28 sm:w-28" /> : <div className="mx-auto h-24 w-24 rounded-2xl bg-[#1f2937]" />}
              <div className="mt-2 text-sm font-bold text-white">{target?.name || 'Pick target'}</div>
              <div className="mt-1 inline-block rounded bg-black/40 px-2 py-1 text-lg font-black text-emerald-300">{chancePercent.toFixed(2)}%</div>
            </div>
          </div>
        </div>
        <div className="pointer-events-none absolute left-1/2 top-0 h-0 w-0 -translate-x-1/2 border-l-[10px] border-r-[10px] border-t-[18px] border-l-transparent border-r-transparent border-t-cyan-300" />
      </div>
      <p className="mt-3 text-center text-xs text-gray-400">Green arc is win zone. The wheel spins during the server-side provably fair roll.</p>
    </div>
  );
};
