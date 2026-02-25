import React, { memo, useCallback, useEffect, useRef, useState } from 'react';

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

const CARD_W = 168;
const CARD_H = 110;
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

const rarityColor = (rarity?: string) => {
  const key = String(rarity ?? '').toLowerCase();
  if (key.includes('legend')) return '#f59e0b';
  if (key.includes('epic')) return '#d946ef';
  if (key.includes('rare')) return '#38bdf8';
  if (key.includes('uncommon')) return '#22c55e';
  return '#94a3b8';
};

const normalizePool = (pool: DeterministicReelItem[]) => (pool.length ? pool : [FALLBACK_ITEM]);

const buildReel = (spinKey: string, poolInput: DeterministicReelItem[], winner: DeterministicReelItem | null) => {
  const seed = hash(spinKey);
  const pool = normalizePool(poolInput);

  const reel = Array.from({ length: TOTAL_ITEMS }, (_, index) => {
    const item = pool[Math.abs((seed + index * 17) % pool.length)] || FALLBACK_ITEM;
    return { ...item, _index: index };
  });

  if (winner) reel[STOP_INDEX] = { ...winner, _index: STOP_INDEX };
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
  const stopGuardRef = useRef<string | null>(null);

  const measureOffsets = useCallback(() => {
    const containerWidth = containerRef.current?.clientWidth ?? 0;
    const indicatorCenter = containerWidth / 2;
    const startIndex = Math.max(0, STOP_INDEX - START_OFFSET);
    const startCardCenter = startIndex * STEP + CARD_W / 2;
    const stopCardCenter = STOP_INDEX * STEP + CARD_W / 2;
    return {
      startX: indicatorCenter - startCardCenter,
      targetX: indicatorCenter - stopCardCenter
    };
  }, []);

  useEffect(() => {
    setReelItems(buildReel(spinKey, fillerPool, winningItem));
  }, [spinKey, fillerPool, winningItem]);

  useEffect(() => {
    const applyForPhase = () => {
      const { startX, targetX } = measureOffsets();

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

      requestAnimationFrame(() => {
        setTransition(`transform ${durationMs}ms cubic-bezier(0.08, 0.82, 0.22, 1)`);
        setTransformX(targetX);
      });
    };

    applyForPhase();
    const onResize = () => applyForPhase();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [durationMs, measureOffsets, phase, spinKey]);

  useEffect(() => {
    if (phase !== 'SPIN') return;
    const node = trackRef.current;
    if (!node) return;

    stopGuardRef.current = null;

    const safeStop = () => {
      if (stopGuardRef.current === spinKey) return;
      stopGuardRef.current = spinKey;

      const winnerRect = winnerRef.current?.getBoundingClientRect();
      const indicatorRect = indicatorRef.current?.getBoundingClientRect();

      if (winnerRect && indicatorRect) {
        const winnerCenter = winnerRect.left + winnerRect.width / 2;
        const indicatorCenter = indicatorRect.left + indicatorRect.width / 2;
        const diff = indicatorCenter - winnerCenter;
        if (Math.abs(diff) > 2) {
          setTransition('none');
          setTransformX((prev) => prev + diff);
        }
      }

      onStopped?.();
    };

    const onTransitionEnd = (event: TransitionEvent) => {
      if (event.target !== node || event.propertyName !== 'transform') return;
      window.clearTimeout(fallbackTimer);
      safeStop();
    };

    const fallbackTimer = window.setTimeout(() => {
      safeStop();
    }, durationMs + 200);

    node.addEventListener('transitionend', onTransitionEnd);
    return () => {
      window.clearTimeout(fallbackTimer);
      node.removeEventListener('transitionend', onTransitionEnd);
    };
  }, [durationMs, onStopped, phase, spinKey]);

  const idleClass = phase === 'IDLE' && !winningItem ? 'animate-[battleIdleRail_12s_linear_infinite]' : '';

  return (
    <div ref={containerRef} className="relative h-[168px] overflow-hidden rounded-xl border border-white/10 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] bg-[#0b111c]">
      <div ref={indicatorRef} className="pointer-events-none absolute inset-y-2 left-1/2 z-30 w-[2px] -translate-x-1/2 bg-gradient-to-b from-transparent via-cyan-300/90 to-transparent" />
      <div className="pointer-events-none absolute left-0 top-0 z-10 h-full w-16 bg-gradient-to-r from-[#0b111c] to-transparent" />
      <div className="pointer-events-none absolute right-0 top-0 z-10 h-full w-16 bg-gradient-to-l from-[#0b111c] to-transparent" />

      <div className="absolute inset-0 flex items-center">
        <div
          ref={trackRef}
          className={`relative z-20 flex ${idleClass}`}
          style={{
            gap: `${GAP}px`,
            transform: `translate3d(${transformX}px,0,0)`,
            transition,
            willChange: 'transform'
          }}
        >
          {reelItems.map((item, index) => {
            const isWinner = !!winningItem && index === STOP_INDEX;
            const accent = rarityColor(item.rarity);
            return (
              <div
                ref={isWinner ? winnerRef : null}
                key={`${item.id}-${index}`}
                className={`relative shrink-0 overflow-hidden rounded-xl border bg-[#151a23] p-2 ${isWinner && phase !== 'IDLE' ? 'border-brand-purple shadow-[0_0_20px_rgba(139,92,246,0.6)]' : 'border-white/10'}`}
                style={{ width: `${CARD_W}px`, minWidth: `${CARD_W}px`, height: `${CARD_H}px` }}
              >
                <div className="pointer-events-none absolute inset-2 rounded-full opacity-65" style={{ background: `radial-gradient(circle, ${accent}66 0%, ${accent}24 45%, transparent 80%)` }} />
                <div className="relative z-10 flex h-full items-center gap-2">
                  <div className="h-14 w-14 shrink-0 overflow-hidden rounded bg-[#101726]">
                    {item.imageUrl ? <img src={item.imageUrl} alt={item.name} width={56} height={56} loading="eager" className="h-14 w-14 object-contain" /> : <div className="flex h-14 w-14 items-center justify-center text-[10px] text-gray-500">N/A</div>}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-[12px] font-semibold text-gray-100">{item.name}</div>
                    <div className="mt-1 text-[12px] font-bold text-emerald-300">{item.value.toLocaleString()}</div>
                  </div>
                </div>
                <div className="absolute bottom-0 left-0 right-0 h-1.5 opacity-80" style={{ backgroundColor: accent }} />
              </div>
            );
          })}
        </div>
      </div>

      <style>{`@keyframes battleIdleRail { 0% { transform: translate3d(${transformX}px,0,0); } 100% { transform: translate3d(${transformX - STEP * 10}px,0,0); } }`}</style>
    </div>
  );
});

DeterministicReel.displayName = 'DeterministicReel';
