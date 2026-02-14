import React, { useEffect, useMemo, useState } from 'react';
import { MysteryBox } from '../types';
import { PRICE_UNIT_MODE, toCoins } from '../utils/coins';
import { CoinAmount } from './CoinAmount';
import { useGame } from '../context/GameContext';
import { useSound } from '../context/SoundContext';

type DemoSpinnerSectionProps = {
  box?: MysteryBox;
};

const AUTO_SPIN_MS = 1900;

export const DemoSpinnerSection: React.FC<DemoSpinnerSectionProps> = ({ box }) => {
  const { setView } = useGame();
  const { playSound } = useSound();
  const [spinSeed, setSpinSeed] = useState(0);

  const items = useMemo(() => {
    if (!box || box.items.length === 0) return [];
    return Array.from({ length: 18 }, (_, index) => box.items[index % box.items.length]);
  }, [box]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setSpinSeed((value) => value + 1);
    }, AUTO_SPIN_MS);
    return () => window.clearInterval(intervalId);
  }, []);

  const translateDistance = 96 + ((spinSeed * 132) % 1300);

  return (
    <section className="rounded-2xl border border-white/10 bg-[#090d15] p-3 sm:p-4">
      <div className="mb-3 text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gray-300">Best mystery boxes online</p>
      </div>
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/40 py-3">
        <div className="pointer-events-none absolute left-1/2 top-0 z-20 h-0 w-0 -translate-x-1/2 border-l-[10px] border-r-[10px] border-t-[18px] border-l-transparent border-r-transparent border-t-orange-500" />
        {items.length > 0 ? (
          <div
            className="flex gap-2 pl-3 will-change-transform"
            style={{
              transform: `translateX(-${translateDistance}px)`,
              transition: 'transform 1.35s cubic-bezier(0.19, 1, 0.22, 1)'
            }}
          >
            {items.map((item, index) => (
              <div
                key={`${item.id}-${index}`}
                className="flex h-[188px] min-w-[132px] flex-col items-center justify-between rounded-xl border border-white/10 bg-gradient-to-b from-[#0e7b39] to-[#0a4d25] px-2 py-3"
              >
                <img src={item.image} alt={item.name} className="h-24 w-24 object-contain" loading="lazy" />
                <CoinAmount
                  amount={toCoins(item.price, PRICE_UNIT_MODE)}
                  className="justify-center text-sm font-semibold text-gray-100"
                  iconClassName="h-4 w-4"
                  formatOptions={{ maximumFractionDigits: 0 }}
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="flex h-[188px] items-center justify-center px-4 text-sm text-gray-400">No demo box selected yet. Pick one in admin.</div>
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
    </section>
  );
};
