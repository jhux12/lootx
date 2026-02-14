import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MysteryBox, CaseItem } from '../types';
import { PRICE_UNIT_MODE, toCoins } from '../utils/coins';
import { CoinAmount } from './CoinAmount';
import { useGame } from '../context/GameContext';
import { useSound } from '../context/SoundContext';

type DemoSpinnerSectionProps = {
  box?: MysteryBox;
};

const CARD_WIDTH = 132;
const CARD_GAP = 8;
const ITEM_WIDTH = CARD_WIDTH + CARD_GAP;
const BUFFER_COUNT = 36;
const SPIN_DURATION_MS = 3600;
const SPIN_PAUSE_MS = 850;

const generateReel = (pool: CaseItem[], winner: CaseItem) => {
  const trailing = 6;
  const list: CaseItem[] = [];

  for (let index = 0; index < BUFFER_COUNT; index += 1) {
    list.push(pool[Math.floor(Math.random() * pool.length)]);
  }

  list.push(winner);

  for (let index = 0; index < trailing; index += 1) {
    list.push(pool[Math.floor(Math.random() * pool.length)]);
  }

  return list;
};

export const DemoSpinnerSection: React.FC<DemoSpinnerSectionProps> = ({ box }) => {
  const { setView } = useGame();
  const { playSound } = useSound();
  const reelRef = useRef<HTMLDivElement>(null);
  const autoSpinTimer = useRef<number | null>(null);
  const [reelItems, setReelItems] = useState<CaseItem[]>([]);
  const [isSpinning, setIsSpinning] = useState(false);

  const sourceItems = useMemo(() => box?.items ?? [], [box]);

  const clearAutoTimer = () => {
    if (autoSpinTimer.current) {
      window.clearTimeout(autoSpinTimer.current);
      autoSpinTimer.current = null;
    }
  };

  const spin = useCallback(() => {
    if (!reelRef.current || sourceItems.length === 0 || isSpinning) return;

    const winner = sourceItems[Math.floor(Math.random() * sourceItems.length)];
    const nextReel = generateReel(sourceItems, winner);

    setIsSpinning(true);
    setReelItems(nextReel);

    window.setTimeout(() => {
      if (!reelRef.current) return;

      reelRef.current.style.transition = 'none';
      reelRef.current.style.transform = 'translateX(0px)';

      const winnerLeft = BUFFER_COUNT * ITEM_WIDTH;
      const jitter = Math.floor(Math.random() * 110) - 55;
      const finalTranslate = -winnerLeft + jitter;

      window.setTimeout(() => {
        if (!reelRef.current) return;
        reelRef.current.style.transition = `transform ${SPIN_DURATION_MS / 1000}s cubic-bezier(0.15, 0.85, 0.35, 1)`;
        reelRef.current.style.transform = `translateX(${finalTranslate}px)`;
      }, 45);
    }, 0);

    window.setTimeout(() => {
      setIsSpinning(false);
    }, SPIN_DURATION_MS + 140);
  }, [isSpinning, sourceItems]);

  useEffect(() => {
    if (sourceItems.length === 0) {
      setReelItems([]);
      return;
    }

    setReelItems(generateReel(sourceItems, sourceItems[0]));
  }, [sourceItems]);

  useEffect(() => {
    if (sourceItems.length === 0) return;

    spin();

    const queueSpin = () => {
      clearAutoTimer();
      autoSpinTimer.current = window.setTimeout(() => {
        spin();
        queueSpin();
      }, SPIN_DURATION_MS + SPIN_PAUSE_MS);
    };

    queueSpin();

    return () => {
      clearAutoTimer();
    };
  }, [sourceItems, spin]);

  return (
    <section className="rounded-2xl border border-white/10 bg-[#090d15] p-3 sm:p-4">
      <div className="mb-2 text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gray-300">Best mystery boxes online</p>
      </div>

      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/40 py-3">
        <div className="pointer-events-none absolute left-1/2 top-0 z-20 h-0 w-0 -translate-x-1/2 border-l-[10px] border-r-[10px] border-t-[18px] border-l-transparent border-r-transparent border-t-orange-500" />
        <div className="pointer-events-none absolute bottom-0 left-1/2 top-0 z-10 w-[2px] -translate-x-1/2 bg-white/20" />

        {reelItems.length > 0 ? (
          <div ref={reelRef} className="flex gap-2 px-[48%] pb-1 pt-2 will-change-transform">
            {reelItems.map((item, index) => (
              <div
                key={`${item.id}-${index}`}
                className="flex h-[184px] min-w-[132px] flex-col items-center justify-between rounded-xl border border-black/30 bg-gradient-to-b from-[#0d7d3b] to-[#0a5228] px-2 py-3 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)]"
              >
                <img src={item.image} alt={item.name} className="h-20 w-20 object-contain" loading="lazy" />
                <CoinAmount
                  amount={toCoins(item.price, PRICE_UNIT_MODE)}
                  className="justify-center text-sm font-bold text-gray-100"
                  iconClassName="h-4 w-4"
                  formatOptions={{ maximumFractionDigits: 0 }}
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="flex h-[184px] items-center justify-center px-4 text-sm text-gray-400">No demo box selected yet. Pick one in admin.</div>
        )}

        {box && (
          <div className="pointer-events-none absolute bottom-1 right-1 z-20 flex items-end gap-2 rounded-lg bg-black/35 p-2 backdrop-blur-sm">
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-[0.15em] text-orange-300">Demo box</p>
              <p className="max-w-[130px] truncate text-xs font-semibold text-white">{box.name}</p>
            </div>
            <img src={box.image} alt={box.name} className="h-14 w-14 object-contain" loading="lazy" />
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={() => {
          playSound('click');
          setView({ type: 'BOXES' });
          window.history.replaceState({}, '', '/boxes');
        }}
        className="mt-4 w-full rounded-xl bg-[#ff5a00] py-3 text-base font-bold uppercase tracking-wide text-white transition hover:brightness-110"
      >
        View Boxes
      </button>

      <h2 className="mt-4 text-center text-3xl font-black uppercase text-white sm:text-4xl">
        Get a <span className="text-[#ff5a00]">free box</span> when signing up!
      </h2>

      {isSpinning && <p className="mt-2 text-center text-[11px] uppercase tracking-[0.15em] text-gray-500">Auto demo spinning</p>}
    </section>
  );
};
