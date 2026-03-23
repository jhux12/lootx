import React, { useMemo } from 'react';
import { ArrowUpRight, Gem } from 'lucide-react';
import { MysteryBox } from '../types';
import { CoinAmount } from './CoinAmount';
import { PRICE_UNIT_MODE, toCoins } from '../utils/coins';

type TopDropsSliderProps = {
  boxes: MysteryBox[];
  onOpenBox: (boxId: string) => void;
  className?: string;
};

type SliderDropItem = {
  sourceBoxId: string;
  sourceKey: string;
  sourceBoxName: string;
  image: string;
  name: string;
  value: number;
};

export const TopDropsSlider: React.FC<TopDropsSliderProps> = ({ boxes, onOpenBox, className = '' }) => {
  const topDropItems = useMemo<SliderDropItem[]>(
    () =>
      boxes
        .filter((box) => !box.isUserCreated)
        .flatMap((box) =>
          box.items.map((item) => ({
            sourceBoxId: box.id,
            sourceKey: `${box.id}-${item.id ?? item.name}`,
            sourceBoxName: box.name,
            image: item.image,
            name: item.name,
            value: item.price
          }))
        )
        .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name))
        .slice(0, 24),
    [boxes]
  );

  if (topDropItems.length === 0) return null;

  return (
    <section className={`relative overflow-hidden rounded-2xl border border-white/10 bg-neutral-950/85 ${className}`}>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(99,102,241,0.16),_transparent_30%),radial-gradient(circle_at_80%_20%,_rgba(56,189,248,0.1),_transparent_22%)]" />

      <div className="relative border-b border-white/5 px-4 py-3">
        <div className="inline-flex items-center gap-2 rounded-full border border-indigo-400/20 bg-indigo-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-indigo-200">
          <Gem className="h-3.5 w-3.5" /> Highest value items
        </div>
      </div>

      <div className="relative md:hidden">
        <div className="-mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 py-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {topDropItems.map((item) => (
            <button
              key={item.sourceKey}
              type="button"
              onClick={() => onOpenBox(item.sourceBoxId)}
              className="min-w-[168px] snap-start rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-left transition active:scale-[0.98]"
            >
              <div className="mb-3 flex h-24 items-center justify-center rounded-xl bg-black/20 p-3">
                <img src={item.image} alt={item.name} loading="lazy" className="h-full w-full object-contain drop-shadow-xl" />
              </div>
              <div className="line-clamp-2 min-h-[2.5rem] text-sm font-bold text-white">{item.name}</div>
              <div className="mt-1 line-clamp-1 text-xs text-neutral-400">{item.sourceBoxName}</div>
              <div className="mt-3 flex items-center justify-between gap-2">
                <div className="inline-flex items-center gap-1 rounded-md bg-indigo-600 px-2.5 py-1 text-xs font-bold text-white">
                  <CoinAmount amount={toCoins(item.value, PRICE_UNIT_MODE)} formatOptions={{ maximumFractionDigits: 0 }} className="text-xs font-bold text-white" iconClassName="h-3.5 w-3.5" />
                </div>
                <ArrowUpRight className="h-4 w-4 text-neutral-400" />
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="relative hidden overflow-hidden md:block">
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-neutral-950 to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-neutral-950 to-transparent" />
        <div className="ticker-animation flex items-center gap-3 px-4 py-4">
          {[...topDropItems, ...topDropItems].map((item, index) => (
            <button
              key={`${item.sourceKey}-${index}`}
              type="button"
              onClick={() => onOpenBox(item.sourceBoxId)}
              className="flex w-[220px] shrink-0 items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-left transition hover:-translate-y-1 hover:border-indigo-400/30"
              title={`${item.name} from ${item.sourceBoxName}`}
            >
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-black/20 p-2">
                <img src={item.image} alt={item.name} loading="lazy" className="h-full w-full object-contain" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="line-clamp-2 text-sm font-bold text-white">{item.name}</div>
                <div className="mt-1 line-clamp-1 text-xs text-neutral-400">{item.sourceBoxName}</div>
                <div className="mt-2 inline-flex items-center gap-1 rounded-md bg-indigo-600 px-2.5 py-1 text-xs font-bold text-white">
                  <CoinAmount amount={toCoins(item.value, PRICE_UNIT_MODE)} formatOptions={{ maximumFractionDigits: 0 }} className="text-xs font-bold text-white" iconClassName="h-3.5 w-3.5" />
                </div>
              </div>
              <ArrowUpRight className="h-4 w-4 shrink-0 text-neutral-500" />
            </button>
          ))}
        </div>
      </div>
    </section>
  );
};
