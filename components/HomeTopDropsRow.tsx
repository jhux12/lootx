import React, { useMemo } from 'react';
import { Crown } from 'lucide-react';
import type { CaseItem, MysteryBox } from '../types';
import { CoinAmount } from './CoinAmount';

type TopDropEntry = {
  item: CaseItem;
  box: MysteryBox;
};

type HomeTopDropsRowProps = {
  boxes: MysteryBox[];
  onSelectBox: (boxId: string) => void;
  limit?: number;
};

export const HomeTopDropsRow: React.FC<HomeTopDropsRowProps> = ({ boxes, onSelectBox, limit = 12 }) => {
  const topDrops = useMemo<TopDropEntry[]>(() => {
    const entries = boxes
      .filter((box) => !box.isDaily && !box.isUserCreated)
      .flatMap((box) => box.items.map((item) => ({ item, box })))
      .sort((a, b) => b.item.price - a.item.price);

    const seen = new Set<string>();
    return entries.filter((entry) => {
      const key = `${entry.item.id}:${entry.box.id}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, limit);
  }, [boxes, limit]);

  if (!topDrops.length) return null;

  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-3 sm:p-4">
      <div className="flex items-stretch gap-3 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex min-w-[130px] shrink-0 items-center gap-2 rounded-2xl border border-white/10 bg-gradient-to-br from-violet-500/20 via-blue-500/10 to-transparent px-4 py-3">
          <Crown className="h-4 w-4 text-violet-200" />
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-violet-200/80">Live list</p>
            <p className="text-sm font-semibold text-white">Top Drops</p>
          </div>
        </div>

        {topDrops.map(({ item, box }) => (
          <button
            key={`${box.id}-${item.id}`}
            type="button"
            onClick={() => onSelectBox(box.id)}
            className="group relative flex min-w-[110px] shrink-0 flex-col justify-between rounded-2xl border border-white/10 bg-white/[0.04] p-2.5 text-left transition-transform duration-200 hover:-translate-y-1 hover:border-violet-300/40"
          >
            <img src={item.image} alt={item.name} className="h-16 w-full object-contain sm:h-20" loading="lazy" />
            <p className="line-clamp-1 text-xs text-gray-200">{item.name}</p>
            <CoinAmount amount={item.price} className="text-[11px] text-violet-200" iconClassName="h-3 w-3" />
          </button>
        ))}
      </div>
    </section>
  );
};
