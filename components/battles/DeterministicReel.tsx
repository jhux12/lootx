import React, { memo, useEffect, useMemo, useRef, useState } from 'react';

export interface DeterministicReelItem {
  id: string;
  name: string;
  imageUrl: string;
  value: number;
  rarity?: string;
}

interface DeterministicReelProps {
  spinKey: string;
  winningItem: DeterministicReelItem | null;
  fillerPool: DeterministicReelItem[];
  phase: 'IDLE' | 'SPIN' | 'STOPPED';
  durationMs?: number;
  onStopped?: () => void;
}

const CARD_W = 148;
const CARD_H = 94;
const GAP = 12;
const STEP = CARD_W + GAP;
const STOP_INDEX = 52;
const TOTAL_ITEMS = 90;
const START_OFFSET = 25;

const FALLBACK_ITEM: DeterministicReelItem = {
  id: 'fallback-item',
  name: 'Mystery Item',
  imageUrl: '',
  value: 0,
  rarity: 'common'
};

const hash = (value: string) => {
  let out = 0;
  for (let i = 0; i < value.length; i += 1) out = (out * 31 + value.charCodeAt(i)) | 0;
  return Math.abs(out);
};

const rarityTone = (rarity?: string) => {
  const key = String(rarity ?? '').toLowerCase();
  if (key.includes('legend')) return 'text-amber-300';
  if (key.includes('epic')) return 'text-fuchsia-300';
  if (key.includes('rare')) return 'text-sky-300';
  return 'text-gray-400';
};

const poolFill = (pool: DeterministicReelItem[]) => {
  if (!pool.length) return [FALLBACK_ITEM];
  return pool;
};

const buildReel = (spinKey: string, sourcePool: DeterministicReelItem[], winner: DeterministicReelItem | null) => {
  const seed = hash(spinKey);
  const pool = poolFill(sourcePool);
  const reel = Array.from({ length: TOTAL_ITEMS }, (_, index) => {
    const pick = pool[Math.abs((seed + index * 17) % pool.length)] || FALLBACK_ITEM;
    return { ...pick, _index: index };
  });

  if (winner) {
    reel[STOP_INDEX] = { ...winner, _index: STOP_INDEX };
  }

  return reel;
};

export const DeterministicReel: React.FC<DeterministicReelProps> = memo(({ spinKey, winningItem, fillerPool, phase, durationMs = 3600, onStopped }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const indicatorRef = useRef<HTMLDivElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const winnerRef = useRef<HTMLDivElement | null>(null);

  const [reelItems, setReelItems] = useState(() => buildReel(spinKey, fillerPool, winningItem));
  const [transformX, setTransformX] = useState(0);
  const [transition, setTransition] = useState('none');

  const startX = useMemo(() => {
    const containerW = containerRef.current?.clientWidth ?? 0;
    const indicatorCenterX = containerW / 2;
    const startCardIndex = Math.max(0, STOP_INDEX - START_OFFSET);
    const cardCenterX = startCardIndex * STEP + CARD_W / 2;
    return indicatorCenterX - cardCenterX;
  }, [spinKey]);

  const targetX = useMemo(() => {
    const containerW = containerRef.current?.clientWidth ?? 0;
    const indicatorCenterX = containerW / 2;
    const cardCenterX = STOP_INDEX * STEP + CARD_W / 2;
    return indicatorCenterX - cardCenterX;
  }, [spinKey]);

  useEffect(() => {
    setReelItems(buildReel(spinKey, fillerPool, winningItem));
  }, [spinKey, fillerPool, winningItem]);

  useEffect(() => {
    if (phase === 'IDLE') {
      setTransition('none');
      setTransformX(startX);
      return;
    }

    if (phase === 'STOPPED') {
      setTransition('none');
      setTransformX(targetX);
      return;
    }

    setTransition('none');
    setTransformX(startX);

    const raf = window.requestAnimationFrame(() => {
      setTransition(`transform ${durationMs}ms cubic-bezier(0.08, 0.84, 0.2, 1)`);
      setTransformX(targetX);
    });

    return () => window.cancelAnimationFrame(raf);
  }, [durationMs, phase, startX, targetX, spinKey]);

  useEffect(() => {
    if (phase !== 'SPIN') return;

    const node = trackRef.current;
    if (!node) return;

    const handleEnd = () => {
      const winnerRect = winnerRef.current?.getBoundingClientRect();
      const indicatorRect = indicatorRef.current?.getBoundingClientRect();
      if (!winnerRect || !indicatorRect) {
        onStopped?.();
        return;
      }

      const winnerCenter = winnerRect.left + winnerRect.width / 2;
      const indicatorCenter = indicatorRect.left + indicatorRect.width / 2;
      const diff = indicatorCenter - winnerCenter;

      if (Math.abs(diff) > 2) {
        setTransition('none');
        setTransformX((prev) => prev + diff);
      }
      onStopped?.();
    };

    node.addEventListener('transitionend', handleEnd, { once: true });
    return () => node.removeEventListener('transitionend', handleEnd);
  }, [onStopped, phase, spinKey]);

  return (
    <div ref={containerRef} className="relative h-[128px] overflow-hidden rounded-xl border border-white/10 bg-[#0a0f18]">
      <div
        ref={indicatorRef}
        className="pointer-events-none absolute inset-y-2 left-1/2 z-20 w-[2px] -translate-x-1/2 rounded bg-gradient-to-b from-transparent via-brand-purple to-transparent"
      />

      <div
        ref={trackRef}
        className={`absolute left-0 top-1/2 flex -translate-y-1/2 ${phase === 'IDLE' && !winningItem ? 'animate-[idleReel_14s_linear_infinite]' : ''}`}
        style={{
          gap: `${GAP}px`,
          transform: `translate3d(${transformX}px,0,0)`,
          transition,
          willChange: 'transform'
        }}
      >
        {reelItems.map((item, index) => {
          const isWinner = index === STOP_INDEX && !!winningItem;
          return (
            <div
              ref={isWinner ? winnerRef : null}
              key={`${item.id}-${index}`}
              className={`shrink-0 rounded-lg border p-2 ${isWinner && phase !== 'IDLE' ? 'border-brand-purple bg-brand-purple/15 shadow-[0_0_22px_rgba(139,92,246,0.45)]' : 'border-white/10 bg-[#101827]'}`}
              style={{ width: `${CARD_W}px`, minWidth: `${CARD_W}px`, height: `${CARD_H}px` }}
            >
              <div className="flex h-full items-center gap-2">
                <div className="h-12 w-12 shrink-0 overflow-hidden rounded bg-[#1a2333]">
                  {item.imageUrl ? (
                    <img src={item.imageUrl} alt={item.name} width={48} height={48} loading="eager" className="h-12 w-12 object-cover" />
                  ) : (
                    <div className="flex h-12 w-12 items-center justify-center text-[10px] text-gray-500">N/A</div>
                  )}
                </div>
                <div className="min-w-0">
                  <div className="truncate text-xs font-semibold text-gray-100">{item.name}</div>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="text-[11px] font-bold text-emerald-300">{item.value.toLocaleString()}</span>
                    <span className={`text-[10px] ${rarityTone(item.rarity)}`}>{item.rarity || 'common'}</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <style>{`@keyframes idleReel { 0% { transform: translate3d(${startX}px, 0, 0); } 100% { transform: translate3d(${startX - STEP * 10}px, 0, 0); } }`}</style>
    </div>
  );
});

DeterministicReel.displayName = 'DeterministicReel';
