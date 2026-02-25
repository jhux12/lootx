import React from 'react';
import { UpgraderTarget } from '../../utils/upgrader';

type SpinPhase = 'idle' | 'loading' | 'settling';

type Props = {
  chance: number;
  phase: SpinPhase;
  markerAngle: number;
  target?: UpgraderTarget;
};

export const UpgradeSpinWheel: React.FC<Props> = ({ chance, phase, markerAngle, target }) => {
  const chancePercent = Math.max(0, Math.min(100, chance * 100));
  const chanceDegrees = chancePercent * 3.6;

  return (
    <div className="rounded-2xl border border-white/10 bg-[#0d1426] p-4">
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-400">Upgrade Spinner</h3>
      <div className="relative mx-auto h-64 w-64 max-w-full sm:h-72 sm:w-72">
        <div
          className="absolute inset-0 rounded-full shadow-[0_0_0_3px_rgba(255,255,255,0.06)]"
          style={{
            background: `conic-gradient(from -90deg, #22c55e 0deg ${chanceDegrees}deg, #1f2937 ${chanceDegrees}deg 360deg)`
          }}
        />

        <div className="absolute inset-[10px] rounded-full bg-[#0b1020] shadow-inner shadow-black/50" />

        <div className="absolute inset-0 grid place-items-center px-8 text-center">
          {target?.imageUrl ? (
            <img src={target.imageUrl} alt={target.name} className="h-20 w-20 rounded-2xl object-cover sm:h-24 sm:w-24" />
          ) : (
            <div className="h-20 w-20 rounded-2xl bg-[#1f2937] sm:h-24 sm:w-24" />
          )}
          <div className="mt-2 line-clamp-1 text-sm font-bold text-white">{target?.name || 'Select target item'}</div>
          <div className="mt-1 rounded bg-black/40 px-2 py-1 text-lg font-black text-emerald-300">{chancePercent.toFixed(2)}%</div>
        </div>

        <div
          className={`pointer-events-none absolute inset-0 ${phase === 'loading' ? 'animate-[spin_700ms_linear_infinite]' : ''}`}
          style={phase === 'loading' ? undefined : { transform: `rotate(${markerAngle}deg)`, transition: phase === 'settling' ? 'transform 1400ms cubic-bezier(0.2,0.9,0.2,1)' : 'none' }}
        >
          <div className="absolute left-1/2 top-[6px] h-4 w-4 -translate-x-1/2 rounded-full border border-white/70 bg-cyan-300 shadow-[0_0_16px_rgba(34,211,238,0.8)]" />
        </div>

        <div className="pointer-events-none absolute left-1/2 top-0 h-0 w-0 -translate-x-1/2 border-l-[8px] border-r-[8px] border-t-[14px] border-l-transparent border-r-transparent border-t-white" />
      </div>
      <p className="mt-3 text-center text-xs text-gray-400">
        Marker lands on your provably-fair roll. Green segment ({chancePercent.toFixed(2)}%) is the win zone.
      </p>
    </div>
  );
};
