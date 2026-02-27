import React, { useEffect, useMemo, useState } from 'react';
import { Item } from './upgraderTypes';

interface UpgraderSpinnerProps {
  chance: number;
  onFinish: (isWin: boolean) => void;
  spinRunId: number;
  forcedWin?: boolean;
  targetItem?: Item | null;
}

interface UpgraderSpinnerTile {
  id: string;
  name: string;
  rarity: string;
  imageUrl?: string;
  isMiss?: boolean;
}

const REEL_LENGTH = 40;
const STOP_INDEX = 32;
const CARD_WIDTH = 96;
const CARD_GAP = 10;
const STEP = CARD_WIDTH + CARD_GAP;
const SPIN_DURATION_MS = 4200;

const missTile: UpgraderSpinnerTile = {
  id: 'upgrader-miss',
  name: 'Miss',
  rarity: 'miss',
  isMiss: true
};

const buildTargetTile = (targetItem?: Item | null): UpgraderSpinnerTile => {
  if (!targetItem) return missTile;
  return {
    id: targetItem.id,
    name: targetItem.name,
    rarity: targetItem.rarity,
    imageUrl: targetItem.imageUrl,
    isMiss: false
  };
};

export const UpgraderSpinner: React.FC<UpgraderSpinnerProps> = ({
  chance,
  onFinish,
  spinRunId,
  forcedWin,
  targetItem
}) => {
  const [transitionEnabled, setTransitionEnabled] = useState(false);
  const [translateX, setTranslateX] = useState(0);
  const [runFinishedId, setRunFinishedId] = useState(0);

  const safeChance = Math.min(99.9999, Math.max(0.0001, chance));
  const centerOffset = useMemo(() => `calc(50% - ${CARD_WIDTH / 2}px)`, []);
  const targetTranslateX = useMemo(() => -(STOP_INDEX * STEP), []);

  const spinResult = useMemo(() => {
    if (forcedWin !== undefined) return forcedWin;
    return Math.random() * 100 <= safeChance;
  }, [forcedWin, safeChance, spinRunId]);

  const reelItems = useMemo(() => {
    const tiles: UpgraderSpinnerTile[] = Array.from({ length: REEL_LENGTH }, (_, index) => ({
      ...missTile,
      id: `miss-${spinRunId}-${index}`
    }));

    tiles[STOP_INDEX] = spinResult ? buildTargetTile(targetItem) : { ...missTile, id: `miss-stop-${spinRunId}` };
    return tiles;
  }, [spinResult, spinRunId, targetItem]);

  useEffect(() => {
    if (!spinRunId) {
      setTransitionEnabled(false);
      setTranslateX(0);
      setRunFinishedId(0);
      return;
    }

    setTransitionEnabled(false);
    setTranslateX(0);

    const frame = window.requestAnimationFrame(() => {
      setTransitionEnabled(true);
      setTranslateX(targetTranslateX);
    });

    const timer = window.setTimeout(() => {
      setTransitionEnabled(false);
      setRunFinishedId(spinRunId);
      onFinish(spinResult);
    }, SPIN_DURATION_MS + 80);

    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, [onFinish, spinResult, spinRunId, targetTranslateX]);

  const isStopped = spinRunId > 0 && runFinishedId === spinRunId;

  return (
    <div className="relative w-full overflow-hidden rounded-xl border border-slate-700/70 bg-[#0b0f18] h-[112px] sm:h-[124px]">
      <div className="pointer-events-none absolute inset-y-0 left-1/2 z-10 w-[2px] -translate-x-1/2 bg-gradient-to-b from-transparent via-indigo-400 to-transparent" />

      <div className="absolute left-0 top-1/2 -translate-y-1/2" style={{ transform: `translate(${centerOffset}, -50%)` }}>
        <div
          className={`flex gap-[10px] ${spinRunId === 0 ? 'animate-reel-idle' : ''}`}
          style={{
            transform: spinRunId === 0 ? undefined : `translateX(${translateX}px)`,
            transition: transitionEnabled ? `transform ${SPIN_DURATION_MS}ms cubic-bezier(0.08, 0.78, 0.22, 1)` : 'none'
          }}
        >
          {reelItems.map((item, index) => {
            const isWinner = index === STOP_INDEX;
            const showWinState = isWinner && isStopped;

            return (
              <div
                key={`${item.id}-${index}`}
                className={`w-24 shrink-0 rounded-lg border p-2 transition-colors ${showWinState ? 'border-indigo-400 bg-indigo-500/15 shadow-[0_0_24px_rgba(129,140,248,0.45)]' : 'border-slate-700 bg-[#111827]'}`}
              >
                <div className="h-12 rounded-md bg-[#0b1020] overflow-hidden mb-1.5 flex items-center justify-center">
                  {item.isMiss ? (
                    <span className="text-3xl font-black leading-none text-red-400">X</span>
                  ) : (
                    <img src={item.imageUrl} alt={item.name} className="w-full h-full object-contain" loading="lazy" />
                  )}
                </div>
                <div className={`text-xs text-center truncate ${item.isMiss ? 'text-red-300' : 'text-slate-100'}`}>{item.isMiss ? 'Miss' : item.name}</div>
              </div>
            );
          })}
        </div>
      </div>

      <style>{`@keyframes reelIdle { 0% { transform: translateX(0); } 100% { transform: translateX(-212px); } } .animate-reel-idle { animation: reelIdle 7s linear infinite; }`}</style>
    </div>
  );
};
