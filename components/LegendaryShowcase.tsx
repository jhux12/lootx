import React, { useMemo } from 'react';
import { useGame } from '../context/GameContext';
import { useSound } from '../context/SoundContext';
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

  const skeletons = Array.from({ length: 5 }, (_, index) => ({
    id: `legendary-skeleton-${index}`
  }));

  return (
    <section className="space-y-2">
      <div className="flex items-stretch overflow-x-auto rounded-xl border border-white/10 bg-[#150b20]">
        <div className="flex min-w-[96px] flex-col items-center justify-center border-r border-white/10 bg-[#1f132c] px-3 py-2 text-center">
          <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-orange-300">Top</span>
          <span className="text-[22px] font-black uppercase leading-none text-white">Drops</span>
        </div>
        <div className="flex min-w-0 flex-1">
          {(isLoading ? skeletons : legendaryDrops).map((entry, index) => (
            <button
              key={isLoading ? entry.id : `${entry.box.id}-${entry.item.id}-${index}`}
              type="button"
              onClick={() => {
                if (isLoading) return;
                playSound('click');
                setView({ type: 'CASE_OPENING', boxId: entry.box.id });
              }}
              className="flex h-[112px] min-w-[94px] items-center justify-center border-r border-black/30 bg-[#5f2391] p-2 last:border-r-0"
            >
              {isLoading ? (
                <div className="h-16 w-14 animate-pulse rounded bg-white/20" />
              ) : (
                <img src={entry.item.image} alt={entry.item.name} className="h-full w-full object-contain" loading="lazy" />
              )}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
};
