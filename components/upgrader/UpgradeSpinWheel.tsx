import React from 'react';
import { UpgraderTarget } from '../../utils/upgrader';

type SpinPhase = 'idle' | 'settling';

type Props = {
  chance: number;
  phase: SpinPhase;
  rotationDeg: number;
  target?: UpgraderTarget;
  canRotateWinZone?: boolean;
  onManualRotate?: (nextRotation: number) => void;
};

export const UpgradeSpinWheel: React.FC<Props> = ({ chance, phase, rotationDeg, target, canRotateWinZone = false, onManualRotate }) => {
  const chancePercent = Math.max(0, Math.min(100, chance * 100));
  const chanceDegrees = chancePercent * 3.6;
  const targetName = (target?.name || 'Select target').toUpperCase();
  const targetPrice = Number(target?.coinValue ?? 0);
  const normalizedRotation = ((rotationDeg % 360) + 360) % 360;

  const nudgeRotation = (delta: number) => {
    if (!canRotateWinZone || !onManualRotate) return;
    onManualRotate(normalizedRotation + delta);
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-[#0d1426] p-4 sm:p-5">
      <h3 className="mb-3 text-center text-sm font-semibold uppercase tracking-wide text-gray-400">Upgrade Spinner</h3>
      <div className="relative mx-auto h-[270px] w-[270px] max-w-full sm:h-[340px] sm:w-[340px]">
        <div className="absolute inset-0 rounded-full bg-white/95 shadow-[0_8px_40px_rgba(0,0,0,0.38)]" />

        <div
          className="absolute inset-[8px] rounded-full"
          style={{
            background: `conic-gradient(from -90deg, #2ea43f 0deg ${chanceDegrees}deg, #e5e7eb ${chanceDegrees}deg 360deg)`,
            transform: `rotate(${rotationDeg}deg)`,
            transition: phase === 'settling' ? 'transform 1700ms cubic-bezier(0.18,0.9,0.2,1)' : 'none'
          }}
        />

        <div className="absolute inset-[22px] rounded-full border-2 border-white/75 bg-gradient-to-b from-[#bdd8c3] via-[#c7d7cb] to-[#c8ccdc]" />

        <div className="absolute inset-[34px] flex flex-col items-center justify-center text-center">
          <div className="max-w-[84%] text-[18px] font-black leading-tight text-[#0a0a0a] sm:text-[30px]">{targetName}</div>
          {target?.imageUrl ? (
            <img src={target.imageUrl} alt={target.name} className="my-3 h-24 w-24 rounded-xl object-cover sm:h-32 sm:w-32" />
          ) : (
            <div className="my-3 h-24 w-24 rounded-xl bg-white/40 sm:h-32 sm:w-32" />
          )}
          <div className="rounded-sm bg-white px-3 py-1 text-xl font-black text-black sm:text-3xl">${targetPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
        </div>
      </div>
      <p className="mt-3 text-center text-xs text-gray-400">Chance: {chancePercent.toFixed(2)}% · Green segment is the win zone.</p>
      <div className="mt-3 rounded-xl border border-white/10 bg-[#121a31] p-3">
        <p className="text-center text-xs font-semibold uppercase tracking-wide text-gray-400">Winning zone rotation</p>
        <div className="mt-2 flex items-center justify-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={() => nudgeRotation(-15)}
            disabled={!canRotateWinZone}
            className="min-h-10 rounded-lg border border-white/20 px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            -15°
          </button>
          <button
            type="button"
            onClick={() => nudgeRotation(15)}
            disabled={!canRotateWinZone}
            className="min-h-10 rounded-lg border border-white/20 px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            +15°
          </button>
        </div>
        <input
          type="range"
          min={0}
          max={359}
          value={Math.round(normalizedRotation)}
          onChange={(event) => onManualRotate?.(Number(event.target.value))}
          disabled={!canRotateWinZone}
          className="mt-3 h-8 w-full accent-emerald-400 disabled:cursor-not-allowed"
          aria-label="Rotate winning zone"
        />
        <p className="mt-1 text-center text-xs text-gray-400">
          {canRotateWinZone ? `Current angle: ${Math.round(normalizedRotation)}°` : 'Select inventory and target items to rotate the winning zone.'}
        </p>
      </div>
    </div>
  );
};
