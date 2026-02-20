import React, { memo, useEffect, useMemo, useRef, useState } from 'react';

export interface ReelItem {
  itemId?: string;
  itemName: string;
  value: number;
  rarity?: string;
  imageUrl?: string;
}

interface DeterministicReelProps {
  winningItem: ReelItem | null;
  fillerPool: ReelItem[];
  spinKey: string;
  phase: 'IDLE' | 'SPIN' | 'STOPPED';
  durationMs?: number;
}

const CARD_WIDTH = 140;
const CARD_GAP = 12;
const STEP = CARD_WIDTH + CARD_GAP;
const REEL_LENGTH = 56;
const STOP_INDEX = 32;

const fallbackItem: ReelItem = {
  itemId: 'fallback-item',
  itemName: 'Mystery Drop',
  value: 0,
  rarity: 'common',
  imageUrl: ''
};

const hashSeed = (input: string) => {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
};

const rarityClass = (rarity?: string) => {
  const value = String(rarity ?? '').toLowerCase();
  if (value.includes('legend')) return 'text-amber-300';
  if (value.includes('epic')) return 'text-fuchsia-300';
  if (value.includes('rare')) return 'text-sky-300';
  return 'text-gray-400';
};

const pickDeterministic = (pool: ReelItem[], seed: number, index: number) => {
  const position = Math.abs((seed + index * 17) % pool.length);
  return pool[position] ?? fallbackItem;
};

export const DeterministicReel: React.FC<DeterministicReelProps> = memo(({ winningItem, fillerPool, spinKey, phase, durationMs = 3200 }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const winnerRef = useRef<HTMLDivElement | null>(null);
  const [translateX, setTranslateX] = useState(0);
  const [transitionOn, setTransitionOn] = useState(false);

  const pool = useMemo(() => (fillerPool.length ? fillerPool : [fallbackItem]), [fillerPool]);

  const reelItems = useMemo(() => {
    const seed = hashSeed(spinKey);
    const generated = Array.from({ length: REEL_LENGTH }, (_, index) => ({
      ...pickDeterministic(pool, seed, index),
      _stableKey: `${spinKey}-${index}`
    }));

    if (winningItem) {
      generated[STOP_INDEX] = {
        ...winningItem,
        _stableKey: `winner-${spinKey}-${winningItem.itemId ?? winningItem.itemName}`
      };
    }

    return generated;
  }, [pool, spinKey, winningItem]);

  const targetX = useMemo(() => {
    const centerX = (containerRef.current?.clientWidth ?? 0) / 2;
    return centerX - (STOP_INDEX * STEP + CARD_WIDTH / 2);
  }, [spinKey]);

  useEffect(() => {
    if (phase === 'IDLE') {
      setTransitionOn(false);
      setTranslateX(0);
      return;
    }

    if (phase === 'STOPPED') {
      setTransitionOn(false);
      setTranslateX(targetX);
      return;
    }

    setTransitionOn(false);
    setTranslateX(0);

    const frame = window.requestAnimationFrame(() => {
      setTransitionOn(true);
      setTranslateX(targetX);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [phase, spinKey, targetX]);

  useEffect(() => {
    if (phase !== 'SPIN') return;

    const handleTransitionEnd = () => {
      const containerRect = containerRef.current?.getBoundingClientRect();
      const winnerRect = winnerRef.current?.getBoundingClientRect();
      if (!containerRect || !winnerRect) return;

      const indicatorCenter = containerRect.left + containerRect.width / 2;
      const winnerCenter = winnerRect.left + winnerRect.width / 2;
      const delta = indicatorCenter - winnerCenter;

      if (Math.abs(delta) > 2) {
        setTransitionOn(false);
        setTranslateX((prev) => prev + delta);
      }
    };

    const node = trackRef.current;
    node?.addEventListener('transitionend', handleTransitionEnd, { once: true });

    return () => node?.removeEventListener('transitionend', handleTransitionEnd);
  }, [phase, spinKey]);

  return (
    <div ref={containerRef} className="relative h-[136px] overflow-hidden rounded-xl border border-gray-700/70 bg-[#0b0f18]">
      <div className="pointer-events-none absolute inset-y-0 left-1/2 z-20 w-[2px] -translate-x-1/2 bg-gradient-to-b from-transparent via-brand-purple to-transparent" />
      <div
        ref={trackRef}
        className="absolute left-0 top-1/2 flex -translate-y-1/2"
        style={{
          gap: `${CARD_GAP}px`,
          transform: `translate3d(${translateX}px,0,0)`,
          transition: transitionOn ? `transform ${durationMs}ms cubic-bezier(0.08, 0.82, 0.2, 1)` : 'none',
          willChange: 'transform'
        }}
      >
        {reelItems.map((item, index) => {
          const isWinner = !!winningItem && index === STOP_INDEX;
          return (
            <div
              ref={isWinner ? winnerRef : null}
              key={(item as any)._stableKey}
              className={`shrink-0 rounded-lg border p-2 ${isWinner && phase !== 'IDLE' ? 'border-brand-purple bg-brand-purple/15 shadow-[0_0_22px_rgba(139,92,246,0.45)]' : 'border-gray-700 bg-[#111827]'}`}
              style={{ width: `${CARD_WIDTH}px`, height: '112px' }}
            >
              <div className="h-[64px] w-full rounded-md bg-[#0b1020] mb-2 flex items-center justify-center overflow-hidden">
                {item.imageUrl ? (
                  <img src={item.imageUrl} alt={item.itemName} width={60} height={60} loading="eager" className="h-[60px] w-[60px] object-contain" />
                ) : (
                  <span className="text-[10px] text-gray-500">No image</span>
                )}
              </div>
              <div className="truncate text-[11px] text-gray-100">{item.itemName}</div>
              <div className="mt-1 flex items-center justify-between text-[10px]">
                <span className="font-semibold text-emerald-300">{item.value.toLocaleString()}</span>
                <span className={rarityClass(item.rarity)}>{item.rarity || 'common'}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});

DeterministicReel.displayName = 'DeterministicReel';
