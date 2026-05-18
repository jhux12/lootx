import React, { useEffect, useMemo, useState } from 'react';

export interface ReelItem {
  itemId?: string;
  itemName: string;
  value: number;
  rarity?: string;
  imageUrl?: string;
}

interface SpinnerReelProps {
  items: ReelItem[];
  winningItem: ReelItem | null;
  spinKey: string;
  state: 'IDLE' | 'SPIN' | 'STOPPED';
  durationMs: number;
  onSpinComplete?: () => void;
}

const REEL_LENGTH = 40;
const STOP_INDEX = 32;
const CARD_WIDTH = 128;
const CARD_GAP = 12;
const STEP = CARD_WIDTH + CARD_GAP;

const fallbackItem: ReelItem = {
  itemId: 'placeholder-item',
  itemName: 'Mystery Drop',
  value: 0,
  rarity: 'common',
  imageUrl: ''
};

const normalizeRarity = (rarity?: string) => {
  const value = String(rarity ?? 'common').toLowerCase();
  if (value.includes('legend')) return 'legendary';
  if (value.includes('epic')) return 'epic';
  if (value.includes('uncommon')) return 'uncommon';
  if (value.includes('rare')) return 'rare';
  return 'common';
};


const RARITY_CARD_CLASS: Record<ReturnType<typeof normalizeRarity>, string> = {
  common: 'border-gray-500/45 shadow-[0_0_18px_rgba(156,163,175,0.12)]',
  uncommon: 'border-green-500/45 shadow-[0_0_18px_rgba(34,197,94,0.16)]',
  rare: 'border-blue-500/45 shadow-[0_0_18px_rgba(59,130,246,0.18)]',
  epic: 'border-purple-500/45 shadow-[0_0_18px_rgba(168,85,247,0.2)]',
  legendary: 'border-amber-400/55 shadow-[0_0_18px_rgba(251,191,36,0.22)]'
};

const RARITY_BADGE_CLASS: Record<ReturnType<typeof normalizeRarity>, string> = {
  common: 'bg-gray-500/15 text-gray-200',
  uncommon: 'bg-green-500/15 text-green-200',
  rare: 'bg-blue-500/15 text-blue-200',
  epic: 'bg-purple-500/15 text-purple-200',
  legendary: 'bg-amber-500/15 text-amber-200'
};

const itemKey = (item: ReelItem, index: number) => `${item.itemId ?? item.itemName}-${index}`;

const pickDeterministic = (pool: ReelItem[], seed: number, index: number) => {
  if (!pool.length) return fallbackItem;
  const position = Math.abs((seed + index * 13) % pool.length);
  return pool[position];
};

const hashSeed = (input: string) => {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
};

export const SpinnerReel: React.FC<SpinnerReelProps> = ({ items, winningItem, spinKey, state, durationMs, onSpinComplete }) => {
  const [transitionEnabled, setTransitionEnabled] = useState(false);
  const [translateX, setTranslateX] = useState(0);

  const pool = useMemo(() => (items.length ? items : [fallbackItem]), [items]);

  const reelItems = useMemo(() => {
    const seed = hashSeed(spinKey);
    const nextReel = Array.from({ length: REEL_LENGTH }, (_, index) => pickDeterministic(pool, seed, index));
    if (winningItem) {
      nextReel[STOP_INDEX] = winningItem;
    }
    return nextReel;
  }, [pool, spinKey, winningItem]);

  useEffect(() => {
    const uniqueImageUrls = Array.from(new Set(reelItems.map((item) => item.imageUrl).filter((imageUrl): imageUrl is string => !!imageUrl)));
    uniqueImageUrls.forEach((imageUrl) => {
      const image = new Image();
      image.src = imageUrl;
    });
  }, [reelItems]);

  const centerOffset = useMemo(() => `calc(50% - ${CARD_WIDTH / 2}px)`, []);
  const targetTranslateX = useMemo(() => -(STOP_INDEX * STEP), []);

  useEffect(() => {
    if (state === 'IDLE') {
      setTransitionEnabled(false);
      setTranslateX(0);
      return;
    }

    if (state === 'STOPPED') {
      setTransitionEnabled(false);
      setTranslateX(targetTranslateX);
      return;
    }

    setTransitionEnabled(false);
    setTranslateX(0);

    const frame = window.requestAnimationFrame(() => {
      setTransitionEnabled(true);
      setTranslateX(targetTranslateX);
    });

    const timer = window.setTimeout(() => {
      onSpinComplete?.();
    }, durationMs + 80);

    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, [durationMs, onSpinComplete, state, spinKey, targetTranslateX]);

  return (
    <div className="relative w-full overflow-hidden rounded-xl border border-gray-700/70 bg-[#0b0f18] h-[124px] sm:h-[132px]">
      <div className="pointer-events-none absolute inset-y-0 left-1/2 z-10 w-[2px] -translate-x-1/2 bg-gradient-to-b from-transparent via-[#205DD7] to-transparent" />

      <div className="absolute left-0 top-1/2 -translate-y-1/2" style={{ transform: `translate(${centerOffset}, -50%)` }}>
        <div
          className={`flex gap-3 ${state === 'IDLE' ? 'animate-reel-idle' : ''}`}
          style={{
            transform: state === 'IDLE' ? undefined : `translateX(${translateX}px)`,
            transition: transitionEnabled ? `transform ${durationMs}ms cubic-bezier(0.08, 0.78, 0.22, 1)` : 'none'
          }}
        >
          {reelItems.map((item, index) => {
            const rarity = normalizeRarity(item.rarity);
            const isWinner = !!winningItem && index === STOP_INDEX;

            return (
              <div
                key={itemKey(item, index)}
                className={`w-28 sm:w-32 shrink-0 rounded-lg border p-2 sm:p-2.5 transition-colors ${isWinner && state === 'STOPPED' ? 'border-brand-blue bg-brand-blue/15 shadow-[0_0_24px_rgba(32,93,215,0.45)]' : `bg-[#111827] ${RARITY_CARD_CLASS[rarity]}`}`}
              >
                <div className="h-12 sm:h-14 rounded-md bg-[#0b1020] overflow-hidden mb-1.5 flex items-center justify-center">
                  {item.imageUrl ? (
                    <img
                      src={item.imageUrl}
                      alt={item.itemName}
                      className="w-full h-full object-contain"
                      loading="eager"
                      decoding="sync"
                      draggable={false}
                    />
                  ) : (
                    <div className="text-[10px] text-gray-500">No image</div>
                  )}
                </div>
                <div className="text-[10px] sm:text-xs text-gray-100 truncate">{item.itemName}</div>
                <div className="flex items-center justify-between mt-1">
                  <div className="text-[10px] text-green-300 font-semibold">{item.value.toLocaleString()}</div>
                  <span className={`text-[9px] uppercase px-1.5 py-0.5 rounded ${RARITY_BADGE_CLASS[rarity]}`}>{rarity}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <style>{`@keyframes reelIdle { 0% { transform: translateX(0); } 100% { transform: translateX(-280px); } } .animate-reel-idle { animation: reelIdle 7s linear infinite; }`}</style>
    </div>
  );
};
