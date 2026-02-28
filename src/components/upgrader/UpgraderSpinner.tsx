import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Item } from './upgraderTypes';

interface UpgraderSpinnerProps {
  chance: number;
  onFinish: (isWin: boolean) => void;
  spinRunId: number;
  shouldStop?: boolean;
  forcedWin?: boolean;
  targetItem?: Item | null;
}

interface UpgraderSpinnerTile {
  id: string;
  name: string;
  imageUrl?: string;
  isMiss?: boolean;
}

const CARD_WIDTH = 96;
const CARD_GAP = 10;
const STEP = CARD_WIDTH + CARD_GAP;
const STOP_INDEX = 16;
const CYCLE_LENGTH = 28;
const REEL_LENGTH = CYCLE_LENGTH * 3;
const SPIN_SPEED_PX_PER_MS = 0.22;
const STOP_DURATION_MS = 2500;

const missTile: UpgraderSpinnerTile = {
  id: 'upgrader-miss',
  name: 'Miss',
  isMiss: true
};

const buildTargetTile = (targetItem?: Item | null): UpgraderSpinnerTile => {
  if (!targetItem) return missTile;
  return {
    id: targetItem.id,
    name: targetItem.name,
    imageUrl: targetItem.imageUrl,
    isMiss: false
  };
};

const countSpacing = (chance: number) => {
  if (chance >= 65) return 2;
  if (chance >= 40) return 3;
  if (chance >= 20) return 4;
  if (chance >= 10) return 6;
  return 8;
};

export const UpgraderSpinner: React.FC<UpgraderSpinnerProps> = ({
  chance,
  onFinish,
  spinRunId,
  shouldStop = false,
  forcedWin,
  targetItem
}) => {
  const [translateX, setTranslateX] = useState(0);
  const [isStopping, setIsStopping] = useState(false);
  const [isStopped, setIsStopped] = useState(false);
  const [spinResult, setSpinResult] = useState(false);
  const [spinStateToken, setSpinStateToken] = useState(0);

  const translateRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  const safeChance = Math.min(99.9999, Math.max(0.0001, chance));
  const centerOffset = useMemo(() => `calc(50% - ${CARD_WIDTH / 2}px)`, []);

  const cycleTiles = useMemo(() => {
    const target = buildTargetTile(targetItem);
    const spacing = countSpacing(safeChance);

    return Array.from({ length: CYCLE_LENGTH }, (_, idx) => {
      if (!target.isMiss && idx % spacing === 0) {
        return { ...target, id: `${target.id}-seed-${idx}` };
      }
      return { ...missTile, id: `miss-seed-${idx}` };
    });
  }, [safeChance, targetItem]);

  const reelItems = useMemo(() => {
    const target = buildTargetTile(targetItem);
    const items = [...cycleTiles, ...cycleTiles, ...cycleTiles].map((tile, idx) => ({
      ...tile,
      id: `${tile.id}-${idx}`
    }));

    const stopAbsoluteIndex = CYCLE_LENGTH * 2 + STOP_INDEX;
    items[stopAbsoluteIndex] = spinResult ? { ...target, id: `${target.id}-stop-${spinStateToken}` } : { ...missTile, id: `miss-stop-${spinStateToken}` };

    return items;
  }, [cycleTiles, spinResult, spinStateToken, targetItem]);

  useEffect(() => {
    if (!spinRunId) {
      setIsStopping(false);
      setIsStopped(false);
      setTranslateX(0);
      translateRef.current = 0;
      return;
    }

    const result = forcedWin ?? Math.random() * 100 <= safeChance;
    setSpinResult(result);
    setSpinStateToken(spinRunId);
    setIsStopping(false);
    setIsStopped(false);
    setTranslateX(0);
    translateRef.current = 0;
  }, [forcedWin, safeChance, spinRunId]);

  useEffect(() => {
    if (!spinRunId || shouldStop || isStopping || isStopped) {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      return;
    }

    let lastTs: number | null = null;
    const loopWidth = CYCLE_LENGTH * STEP;

    const tick = (ts: number) => {
      if (lastTs === null) {
        lastTs = ts;
      }

      const delta = ts - lastTs;
      lastTs = ts;

      let next = translateRef.current - delta * SPIN_SPEED_PX_PER_MS;
      if (next <= -loopWidth) next += loopWidth;
      translateRef.current = next;
      setTranslateX(next);

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [isStopped, isStopping, shouldStop, spinRunId]);

  useEffect(() => {
    if (!spinRunId || !shouldStop || isStopping || isStopped) return;

    setIsStopping(true);

    const stopAbsoluteIndex = CYCLE_LENGTH * 2 + STOP_INDEX;
    let finalTranslateX = -(stopAbsoluteIndex * STEP);

    while (finalTranslateX >= translateRef.current - STEP * 6) {
      finalTranslateX -= CYCLE_LENGTH * STEP;
    }

    finalTranslateX -= CYCLE_LENGTH * STEP;

    const frame = requestAnimationFrame(() => {
      setTranslateX(finalTranslateX);
    });

    const timer = window.setTimeout(() => {
      setIsStopping(false);
      setIsStopped(true);
      onFinish(spinResult);
    }, STOP_DURATION_MS + 120);

    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, [isStopped, isStopping, onFinish, shouldStop, spinResult, spinRunId]);

  const showPreviewFx = spinRunId === 0;

  return (
    <div className="relative w-full overflow-hidden rounded-xl border border-slate-700/70 bg-[#0b0f18] h-[112px] sm:h-[124px]">
      <div className="pointer-events-none absolute inset-y-0 left-1/2 z-20 w-[2px] -translate-x-1/2 bg-gradient-to-b from-transparent via-indigo-400 to-transparent" />
      {showPreviewFx && <div className="pointer-events-none absolute inset-0 z-10 animate-pulse bg-[radial-gradient(circle_at_center,rgba(129,140,248,0.2)_0%,transparent_65%)]" />}

      <div className="absolute left-0 top-1/2 -translate-y-1/2" style={{ transform: `translate(${centerOffset}, -50%)` }}>
        <div
          className={`flex gap-[10px] ${showPreviewFx ? 'animate-reel-idle' : ''}`}
          style={{
            transform: showPreviewFx ? undefined : `translateX(${translateX}px)`,
            transition: isStopping ? `transform ${STOP_DURATION_MS}ms cubic-bezier(0.08, 0.78, 0.22, 1)` : 'none'
          }}
        >
          {reelItems.map((item, index) => {
            const stopAbsoluteIndex = CYCLE_LENGTH * 2 + STOP_INDEX;
            const showWinState = index === stopAbsoluteIndex && isStopped;

            return (
              <div
                key={item.id}
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

      {showPreviewFx && (
        <div className="pointer-events-none absolute inset-x-0 bottom-1 z-20 text-center text-[10px] font-semibold uppercase tracking-[0.22em] text-indigo-300/80">
          Charged & Ready
        </div>
      )}

      <style>{`@keyframes reelIdle { 0% { transform: translateX(0); } 100% { transform: translateX(-212px); } } .animate-reel-idle { animation: reelIdle 3.8s linear infinite; }`}</style>
    </div>
  );
};
