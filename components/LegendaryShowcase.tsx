import React, { useMemo } from 'react';
import { useGame } from '../context/GameContext';
import { useSound } from '../context/SoundContext';
import { CoinAmount } from './CoinAmount';
import { PRICE_UNIT_MODE, toCoins } from '../utils/coins';
import type { CaseItem, MysteryBox } from '../types';

type LegendaryDrop = {
  item: CaseItem;
  box: MysteryBox;
};

const MAX_DROPS = 10;

const shuffleDrops = (drops: LegendaryDrop[]) => {
  const shuffled = [...drops];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const swapIndex = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[i]];
  }
  return shuffled;
};

export const LegendaryShowcase: React.FC = () => {
  const { boxes, setView } = useGame();
  const { playSound } = useSound();
  const isLoading = boxes.length === 0;

  const legendaryDrops = useMemo(() => {
    if (!boxes.length) return [];
    const eligibleBoxes = boxes.filter((box) => !box.isDaily);
    const legendaryItems = eligibleBoxes
      .flatMap((box) => box.items.map((item) => ({ item, box })))
      .filter(({ item }) => item.rarity === 'legendary');
    if (!legendaryItems.length) return [];
    return shuffleDrops(legendaryItems).slice(0, MAX_DROPS);
  }, [boxes]);

  if (!isLoading && legendaryDrops.length === 0) {
    return null;
  }

  const skeletons = Array.from({ length: 6 }, (_, index) => ({
    id: `legendary-skeleton-${index}`
  }));

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h2 className="text-lg font-medium text-white sm:text-xl">Legendary Drops</h2>
          <p className="text-xs text-gray-400">Pulled from across the platform</p>
        </div>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:grid sm:grid-cols-4 sm:gap-4 sm:overflow-visible sm:px-0 lg:grid-cols-6">
        {isLoading
          ? skeletons.map((skeleton) => (
            <div
              key={skeleton.id}
              className="min-w-[180px] rounded-2xl border border-white/10 bg-white/5 px-3 py-4 sm:min-w-0"
            >
              <div className="flex flex-col gap-3">
                <div className="h-20 w-full rounded-xl bg-white/10" />
                <div className="h-3 w-2/3 rounded bg-white/10" />
                <div className="h-3 w-1/2 rounded bg-white/10" />
                <div className="h-3 w-3/4 rounded bg-white/10" />
              </div>
            </div>
          ))
          : legendaryDrops.map(({ item, box }) => (
            <button
              key={`${box.id}-${item.id}`}
              type="button"
              onClick={() => {
                playSound('click');
                setView({ type: 'CASE_OPENING', boxId: box.id });
              }}
              className="group relative flex min-w-[180px] flex-col gap-3 overflow-hidden rounded-2xl border border-yellow-500/20 bg-gradient-to-br from-yellow-500/10 via-purple-500/10 to-cyan-500/10 px-3 py-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-[0_0_24px_rgba(250,204,21,0.25)] sm:min-w-0"
            >
              <div className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full bg-yellow-400/20 blur-2xl" />
              <div className="pointer-events-none absolute -bottom-8 -left-8 h-24 w-24 rounded-full bg-purple-500/20 blur-2xl" />
              <div className="relative flex items-center justify-center rounded-xl border border-yellow-500/30 bg-black/20 p-3">
                <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-yellow-400/20 via-transparent to-purple-400/20" />
                <img
                  src={item.image}
                  alt={item.name}
                  className="relative z-10 h-16 w-16 object-contain"
                  loading="lazy"
                />
              </div>
              <div className="space-y-2">
                <p className="text-[10px] uppercase tracking-[0.3em] text-yellow-200/80">
                  Legendary Drop
                </p>
                <div className="space-y-1">
                  <p className="min-h-[2.5rem] text-sm font-normal text-white/90 line-clamp-2">
                    {item.name}
                  </p>
                  <CoinAmount
                    amount={toCoins(item.price, PRICE_UNIT_MODE)}
                    className="text-xs text-yellow-100/80"
                    iconClassName="h-3 w-3"
                    textClassName="text-yellow-100/80"
                  />
                  <p className="text-xs text-purple-100/70">From: {box.name}</p>
                </div>
              </div>
            </button>
          ))}
      </div>
    </section>
  );
};
