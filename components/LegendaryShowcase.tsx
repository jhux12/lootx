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
    const legendaryItems = boxes
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
              className="group flex min-w-[180px] flex-col gap-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-4 text-left transition-shadow hover:shadow-[0_0_18px_rgba(94,234,212,0.18)] sm:min-w-0"
            >
              <div className="flex items-center justify-center rounded-xl border border-white/5 bg-white/5 p-3">
                <img
                  src={item.image}
                  alt={item.name}
                  className="h-16 w-16 object-contain"
                  loading="lazy"
                />
              </div>
              <div className="space-y-2">
                <span className="inline-flex w-fit items-center rounded-full border border-purple-300/30 px-2 py-0.5 text-[10px] uppercase tracking-[0.2em] text-purple-200/70">
                  Legendary
                </span>
                <div className="space-y-1">
                  <p className="text-sm font-normal text-gray-300">{item.name}</p>
                  <CoinAmount
                    amount={toCoins(item.price, PRICE_UNIT_MODE)}
                    className="text-xs text-gray-300"
                    iconClassName="h-3 w-3"
                    textClassName="text-gray-300"
                  />
                  <p className="text-xs text-gray-500">From: {box.name}</p>
                </div>
              </div>
            </button>
          ))}
      </div>
    </section>
  );
};
