import React, { memo, useEffect, useMemo, useRef, useState } from 'react';

export interface DeterministicReelItem { id: string; name: string; imageUrl: string; value: number; rarity?: string; }

export const CARD_W = 148;
const CARD_H = 96;
export const GAP = 12;
const STEP = CARD_W + GAP;
export const STOP_INDEX = 52;
export const TOTAL_ITEMS = 90;

const fallback: DeterministicReelItem = { id: 'fallback', name: 'Mystery Item', imageUrl: '', value: 0 };

const hash = (v: string) => [...v].reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 7);

export const DeterministicReel: React.FC<{
  spinKey: string;
  winningItem: DeterministicReelItem | null;
  fillerPool: DeterministicReelItem[];
  phase: 'IDLE' | 'SPIN' | 'STOPPED';
  durationMs?: number;
}> = memo(({ spinKey, winningItem, fillerPool, phase, durationMs = 3600 }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const indicatorRef = useRef<HTMLDivElement | null>(null);
  const winnerRef = useRef<HTMLDivElement | null>(null);
  const [x, setX] = useState(0);
  const [transition, setTransition] = useState('none');

  const reelItems = useMemo(() => {
    const pool = fillerPool.length ? fillerPool : [fallback];
    const seed = Math.abs(hash(spinKey));
    const arr = Array.from({ length: TOTAL_ITEMS }, (_, i) => ({ ...pool[(seed + i * 17) % pool.length] }));
    arr[STOP_INDEX] = winningItem ?? fallback;
    return arr;
  }, [spinKey, winningItem?.id]);

  const computeTarget = () => {
    const containerWidth = containerRef.current?.clientWidth ?? 0;
    const indicatorCenter = containerWidth / 2;
    const cardCenter = STOP_INDEX * STEP + CARD_W / 2;
    return indicatorCenter - cardCenter;
  };

  useEffect(() => {
    const targetX = computeTarget();
    const startX = targetX + STEP * 14;

    if (phase === 'IDLE') {
      setTransition('none');
      setX(startX);
      return;
    }
    if (phase === 'STOPPED') {
      setTransition('none');
      setX(targetX);
      return;
    }

    setTransition('none');
    setX(startX);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setTransition(`transform ${durationMs}ms cubic-bezier(0.08,0.82,0.22,1)`);
        setX(targetX);
      });
    });

    const timer = window.setTimeout(() => {
      const w = winnerRef.current?.getBoundingClientRect();
      const i = indicatorRef.current?.getBoundingClientRect();
      if (!w || !i) return;
      const diff = (i.left + i.width / 2) - (w.left + w.width / 2);
      if (Math.abs(diff) > 2) {
        setTransition('none');
        setX((prev) => prev + diff);
      }
    }, durationMs + 30);

    return () => window.clearTimeout(timer);
  }, [phase, spinKey, durationMs]);

  return (
    <div ref={containerRef} className="relative h-[128px] overflow-hidden rounded-lg border border-white/10 bg-[#0a0f17]">
      <div ref={indicatorRef} className="absolute inset-y-0 left-1/2 z-20 w-[2px] -translate-x-1/2 bg-cyan-300/80" />
      <div className="absolute inset-0 flex items-center">
        <div className={phase === 'IDLE' ? 'animate-[battleIdle_10s_linear_infinite]' : ''} style={{ display: 'flex', gap: GAP, transform: `translate3d(${x}px,0,0)`, transition, willChange: 'transform' }}>
          {reelItems.map((it, idx) => (
            <div ref={idx === STOP_INDEX ? winnerRef : null} key={`${it.id}-${idx}`} className="shrink-0 rounded-md border border-white/10 bg-[#141b26] p-1" style={{ width: CARD_W, minWidth: CARD_W, height: CARD_H }}>
              <div className="flex h-full items-center gap-2">
                <img src={it.imageUrl || 'https://placehold.co/48x48'} className="h-10 w-10 rounded object-cover" />
                <div className="min-w-0"><div className="truncate text-[11px] text-white">{it.name}</div><div className="text-[10px] text-emerald-300">{it.value.toLocaleString()}</div></div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <style>{`@keyframes battleIdle {0%{transform:translate3d(${x}px,0,0)}100%{transform:translate3d(${x - STEP * 6}px,0,0)}}`}</style>
    </div>
  );
});

DeterministicReel.displayName = 'DeterministicReel';
