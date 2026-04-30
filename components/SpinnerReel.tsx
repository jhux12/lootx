import React, { useEffect, useMemo, useRef, useState } from 'react';

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
const DEFAULT_CARD_WIDTH = 128;
const CARD_GAP = 12;
const DEFAULT_STEP = DEFAULT_CARD_WIDTH + CARD_GAP;

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
  if (value.includes('rare')) return 'rare';
  if (value.includes('uncommon')) return 'uncommon';
  return 'common';
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
  const [step, setStep] = useState(DEFAULT_STEP);
  const reelTrackRef = useRef<HTMLDivElement | null>(null);

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

  const cardWidth = step - CARD_GAP;
  const centerOffset = useMemo(() => `calc(50% - ${cardWidth / 2}px)`, [cardWidth]);
  const targetTranslateX = useMemo(() => -(STOP_INDEX * step), [step]);

  useEffect(() => {
    const measureStep = () => {
      const track = reelTrackRef.current;
      const firstCard = track?.querySelector<HTMLElement>('[data-reel-card="true"]');
      if (!firstCard) return;

      const computedStyle = window.getComputedStyle(track);
      const gap = Number.parseFloat(computedStyle.columnGap || computedStyle.gap || String(CARD_GAP)) || CARD_GAP;
      const measuredStep = Math.round(firstCard.getBoundingClientRect().width + gap);
      if (measuredStep > 0) {
        setStep(measuredStep);
      }
    };

    measureStep();
    window.addEventListener('resize', measureStep);
    return () => window.removeEventListener('resize', measureStep);
  }, [reelItems, state]);

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
      <div className="pointer-events-none absolute inset-y-0 left-1/2 z-10 w-[2px] -translate-x-1/2 bg-gradient-to-b from-transparent via-brand-purple to-transparent" />

      <div className="absolute left-0 top-1/2 -translate-y-1/2" style={{ transform: `translate(${centerOffset}, -50%)` }}>
        <div
          ref={reelTrackRef}
          className={`flex gap-3 ${state === 'IDLE' ? 'animate-reel-idle' : ''}`}
          style={{
            transform: state === 'IDLE' ? undefined : `translateX(${translateX}px)`,
            transition: transitionEnabled ? `transform ${durationMs}ms cubic-bezier(0.12, 0.84, 0.22, 1)` : 'none',
            willChange: 'transform',
            backfaceVisibility: 'hidden'
          }}
        >
          {reelItems.map((item, index) => {
            const rarity = normalizeRarity(item.rarity);
            const isWinner = !!winningItem && index === STOP_INDEX;

            return (
              <div
                key={itemKey(item, index)}
                data-reel-card="true"
                className={`w-28 sm:w-32 shrink-0 rounded-lg border p-2 sm:p-2.5 transition-colors ${isWinner && state === 'STOPPED' ? 'border-brand-purple bg-brand-purple/15 shadow-[0_0_24px_rgba(139,92,246,0.45)]' : 'border-gray-700 bg-[#111827]'} ${rarity === 'legendary' ? 'shadow-[0_0_18px_rgba(251,191,36,0.2)]' : ''}`}
              >
                <div className="h-12 sm:h-14 rounded-md bg-[#0b1020] overflow-hidden mb-1.5 flex items-center justify-center">
                  {item.imageUrl ? (
                    <img
                      src={item.imageUrl}
                      alt={item.itemName}
                      className="w-full h-full object-contain"
                      loading="eager"
                      decoding="async"
                      draggable={false}
                    />
                  ) : (
                    <div className="text-[10px] text-gray-500">No image</div>
                  )}
                </div>
                <div className="text-[10px] sm:text-xs text-gray-100 truncate">{item.itemName}</div>
                <div className="flex items-center justify-between mt-1">
                  <div className="text-[10px] text-green-300 font-semibold">{item.value.toLocaleString()}</div>
                  <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-black/35 text-gray-300">{rarity}</span>
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
