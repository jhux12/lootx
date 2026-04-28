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
// PackDraw-style: 195px items with 0 gap (items are absolutely positioned)
const CARD_SIZE = 195;
const VISIBLE_CARDS = 5; // number of visible cards in the viewport

const fallbackItem: ReelItem = {
    itemId: 'placeholder-item',
    itemName: 'Mystery Drop',
    value: 0,
    rarity: 'common',
    imageUrl: ''
};

/** Map rarity string -> glow color hex */
const rarityColor = (rarity?: string): string => {
    const r = (rarity ?? 'common').toLowerCase();
    if (r.includes('legend')) return '#E4AE33';
    if (r.includes('epic')) return '#8847FF';
    if (r.includes('rare')) return '#4B69FF';
    if (r.includes('uncommon')) return '#5E98D9';
    if (r.includes('special') || r.includes('covert')) return '#EB4B4B';
    if (r.includes('classified') || r.includes('mythical')) return '#D32CE6';
    return '#829DBB'; // common / base
};

const hashSeed = (input: string): number => {
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
          hash = (hash * 31 + input.charCodeAt(i)) | 0;
    }
    return Math.abs(hash);
};

const itemKey = (item: ReelItem, index: number) =>
    `${item.itemId ?? item.itemName}-${index}`;

const pickDeterministic = (pool: ReelItem[], seed: number, index: number): ReelItem =>
    pool[(seed + index * 7) % pool.length];

export const SpinnerReel: React.FC<SpinnerReelProps> = ({
    items,
    winningItem,
    spinKey,
    state,
    durationMs,
    onSpinComplete,
}) => {
    const [transitionEnabled, setTransitionEnabled] = useState(false);
    const [offsetX, setOffsetX] = useState(0);
    const containerRef = useRef<HTMLDivElement>(null);

    const pool = useMemo(() => (items.length ? items : [fallbackItem]), [items]);

    const reelItems = useMemo(() => {
          const seed = hashSeed(spinKey);
          const nextReel = Array.from({ length: REEL_LENGTH }, (_, index) =>
                  pickDeterministic(pool, seed, index)
                                          );
          if (winningItem) {
                  nextReel[STOP_INDEX] = winningItem;
          }
          return nextReel;
    }, [pool, spinKey, winningItem]);

    // Preload images
    useEffect(() => {
          const uniqueImageUrls = Array.from(new Set(reelItems.map((item) => item.imageUrl).filter(Boolean)));
          uniqueImageUrls.forEach((imageUrl) => {
                  const image = new Image();
                  image.src = imageUrl as string;
          });
    }, [reelItems]);

    // Target offset: stop at STOP_INDEX item centered in the viewport
    // Each item is CARD_SIZE wide. Center of viewport = 0 (items positioned relative to center).
    // Item at index i has its center at: (i - STOP_INDEX) * CARD_SIZE
    // We want that center at 0, so offsetX = -(STOP_INDEX * CARD_SIZE)
    const targetOffsetX = useMemo(() => -(STOP_INDEX * CARD_SIZE), []);

    useEffect(() => {
          if (state === 'IDLE') {
                  setTransitionEnabled(false);
                  setOffsetX(0);
                  return;
          }

                  if (state === 'STOPPED') {
                          setTransitionEnabled(false);
                          setOffsetX(targetOffsetX);
                          return;
                  }

                  // SPIN state
                  setTransitionEnabled(false);
          setOffsetX(0);

                  const frame = window.requestAnimationFrame(() => {
                          setTransitionEnabled(true);
                          setOffsetX(targetOffsetX);
                  });

                  const timer = window.setTimeout(() => {
                          onSpinComplete?.();
                  }, durationMs + 80);

                  return () => {
                          window.cancelAnimationFrame(frame);
                          window.clearTimeout(timer);
                  };
    }, [durationMs, onSpinComplete, state, spinKey, targetOffsetX]);

    const containerWidth = CARD_SIZE * VISIBLE_CARDS;

    return (
          <div
                  className="relative overflow-hidden rounded-xl border border-gray-700 bg-[#0b1020]"
                  style={{ width: '100%', height: `${CARD_SIZE}px` }}
                >
            {/* Center selector line - left */}
                <div
                          className="pointer-events-none absolute inset-y-0 z-10 w-[2px] bg-white/30"
                          style={{ left: '50%', transform: 'translateX(-50%) translateX(-97.5px)' }}
                        />
            {/* Center selector line - right */}
                <div
                          className="pointer-events-none absolute inset-y-0 z-10 w-[2px] bg-white/30"
                          style={{ left: '50%', transform: 'translateX(-50%) translateX(97.5px)' }}
                        />
          
            {/* Left fade gradient */}
                <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-24 bg-gradient-to-r from-[#0b1020] to-transparent" />
            {/* Right fade gradient */}
                <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-24 bg-gradient-to-l from-[#0b1020] to-transparent" />
          
            {/* Reel track */}
                <div
                          className="absolute top-0 left-1/2"
                          style={{ height: `${CARD_SIZE}px` }}
                        >
                  {reelItems.map((item, index) => {
                                    const color = rarityColor(item.rarity);
                                    const isCenter = index === STOP_INDEX;
                                    const itemOffsetX = (index - STOP_INDEX) * CARD_SIZE;
                                    const glowSize = isCenter && state !== 'IDLE' ? '80%' : '60%';
                          
                                    return (
                                                  <div
                                                                  key={itemKey(item, index)}
                                                                  className="absolute flex items-center justify-center"
                                                                  style={{
                                                                                    width: `${CARD_SIZE}px`,
                                                                                    height: `${CARD_SIZE}px`,
                                                                                    transform: transitionEnabled
                                                                                                        ? `translateX(calc(${itemOffsetX}px + ${offsetX}px)) translateY(-50%)`
                                                                                                        : `translateX(${itemOffsetX}px) translateY(-50%)`,
                                                                                    top: '50%',
                                                                                    transition: transitionEnabled
                                                                                                        ? `transform ${durationMs}ms cubic-bezier(0.15, 0, 0.25, 1)`
                                                                                                        : 'none',
                                                                  }}
                                                                >
                                                    {/* Rarity glow background */}
                                                                <div
                                                                                  className="absolute rounded-full"
                                                                                  style={{
                                                                                                      width: glowSize,
                                                                                                      height: glowSize,
                                                                                                      background: `radial-gradient(circle, ${color}55 0%, ${color}22 50%, transparent 70%)`,
                                                                                                      filter: `blur(12px)`,
                                                                                  }}
                                                                                />
                                                    {/* Item image */}
                                                    {item.imageUrl ? (
                                                                                  <img
                                                                                                      src={item.imageUrl}
                                                                                                      alt={item.itemName}
                                                                                                      className="relative z-10 w-[70%] h-[70%] object-contain drop-shadow-lg"
                                                                                                      draggable={false}
                                                                                                      decoding="async"
                                                                                                    />
                                                                                ) : (
                                                                                  <div className="relative z-10 text-[10px] text-gray-500">No image</div>
                                                                )}
                                                  </div>
                                                );
                        })}
                </div>
          </div>
        );
};
