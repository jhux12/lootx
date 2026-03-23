import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Crown, Flame, Gamepad2, Sparkles } from 'lucide-react';
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
  sourceBoxPrice: number;
  image: string;
  name: string;
  value: number;
  chance: number;
};

export const TopDropsSlider: React.FC<TopDropsSliderProps> = ({ boxes, onOpenBox, className = '' }) => {
  const topDropItems = useMemo<SliderDropItem[]>(
    () =>
      boxes
        .filter((box) => !box.isUserCreated)
        .flatMap((box) =>
          box.items
            .filter((item) => item.rarity === 'legendary' || item.rarity === 'epic')
            .map((item) => ({
              sourceBoxId: box.id,
              sourceKey: `${box.id}-${item.id ?? item.name}`,
              sourceBoxName: box.name,
              sourceBoxPrice: box.price,
              image: item.image,
              name: item.name,
              value: item.price,
              chance: item.chance
            }))
        )
        .sort((a, b) => b.value - a.value || a.chance - b.chance)
        .slice(0, 24),
    [boxes]
  );

  const [activeDropKey, setActiveDropKey] = useState<string | null>(topDropItems[0]?.sourceKey ?? null);

  useEffect(() => {
    if (topDropItems.length === 0) {
      setActiveDropKey(null);
      return;
    }

    setActiveDropKey((current) => {
      if (current && topDropItems.some((item) => item.sourceKey === current)) return current;
      return topDropItems[0].sourceKey;
    });
  }, [topDropItems]);

  const featuredDrop = useMemo(
    () => topDropItems.find((item) => item.sourceKey === activeDropKey) ?? topDropItems[0] ?? null,
    [activeDropKey, topDropItems]
  );

  const totalLegendaryBoxes = useMemo(() => new Set(topDropItems.map((item) => item.sourceBoxId)).size, [topDropItems]);

  if (!featuredDrop) return null;

  return (
    <section className={`relative overflow-hidden rounded-3xl border border-white/10 bg-[linear-gradient(135deg,rgba(19,19,21,0.96),rgba(11,15,25,0.92))] shadow-[0_25px_80px_rgba(15,23,42,0.35)] ${className}`}>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(99,102,241,0.22),_transparent_32%),radial-gradient(circle_at_70%_20%,_rgba(251,191,36,0.12),_transparent_22%)]" />
      <div className="relative grid gap-3 p-3 md:grid-cols-[minmax(280px,360px)_1fr] md:gap-4 md:p-4">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 md:p-5">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-indigo-400/20 bg-indigo-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-indigo-200">
                <Gamepad2 className="h-3.5 w-3.5" /> Top drops
              </div>
              <h2 className="text-xl font-black tracking-tight text-white md:text-2xl">Chase the biggest pulls first</h2>
              <p className="mt-2 text-sm text-neutral-400">Swipe on mobile, hover on desktop, and jump straight into the source box when something catches your eye.</p>
            </div>
            <div className="hidden rounded-2xl border border-amber-300/20 bg-amber-400/10 p-3 text-amber-200 md:block">
              <Crown className="h-5 w-5" />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 md:grid-cols-1 md:gap-2">
            <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
              <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-400">Top value</div>
              <CoinAmount amount={toCoins(featuredDrop.value, PRICE_UNIT_MODE)} formatOptions={{ maximumFractionDigits: 0 }} className="text-lg font-black text-white" iconClassName="h-4 w-4" />
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
              <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-400">Source box</div>
              <div className="line-clamp-2 text-sm font-bold text-white">{featuredDrop.sourceBoxName}</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
              <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-400">Featured pool</div>
              <div className="text-sm font-bold text-white">{totalLegendaryBoxes} boxes</div>
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-amber-200">
              <Sparkles className="h-3.5 w-3.5" /> Live spotlight
            </div>
            <div className="flex items-center gap-4">
              <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] p-3 sm:h-24 sm:w-24">
                <img src={featuredDrop.image} alt={featuredDrop.name} loading="lazy" className="h-full w-full object-contain drop-shadow-xl" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="mb-1 inline-flex items-center gap-1 rounded-full border border-amber-300/20 bg-amber-400/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-amber-100">
                  <Flame className="h-3 w-3" /> Featured drop
                </div>
                <h3 className="line-clamp-2 text-base font-black text-white sm:text-lg">{featuredDrop.name}</h3>
                <p className="mt-1 text-sm text-neutral-400">
                  From <span className="font-semibold text-neutral-200">{featuredDrop.sourceBoxName}</span>
                  {featuredDrop.chance > 0 ? ` • ${featuredDrop.chance.toFixed(featuredDrop.chance < 1 ? 2 : 1)}% chance` : ''}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <div className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-bold text-white">
                    <CoinAmount amount={toCoins(featuredDrop.value, PRICE_UNIT_MODE)} formatOptions={{ maximumFractionDigits: 0 }} className="text-sm font-bold text-white" iconClassName="h-4 w-4" />
                  </div>
                  <div className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-neutral-300">
                    Box price: {toCoins(featuredDrop.sourceBoxPrice, PRICE_UNIT_MODE).toLocaleString()}
                  </div>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => onOpenBox(featuredDrop.sourceBoxId)}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-indigo-500"
            >
              Open {featuredDrop.sourceBoxName}
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 md:p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-neutral-300">High-value lineup</h3>
              <p className="mt-1 text-xs text-neutral-500">Compact mobile cards with direct open actions and a denser desktop ticker.</p>
            </div>
            <div className="rounded-full border border-white/10 px-3 py-1 text-[11px] font-semibold text-neutral-400">
              {topDropItems.length} drops
            </div>
          </div>

          <div className="md:hidden">
            <div className="-mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {topDropItems.map((item) => (
                <button
                  key={item.sourceKey}
                  type="button"
                  onClick={() => onOpenBox(item.sourceBoxId)}
                  onFocus={() => setActiveDropKey(item.sourceKey)}
                  onPointerEnter={() => setActiveDropKey(item.sourceKey)}
                  className={`min-w-[156px] snap-start rounded-2xl border p-3 text-left transition ${item.sourceKey === featuredDrop.sourceKey ? 'border-indigo-400/50 bg-indigo-500/10' : 'border-white/10 bg-black/20'}`}
                >
                  <div className="mb-3 flex h-20 items-center justify-center rounded-xl bg-white/[0.03] p-2">
                    <img src={item.image} alt={item.name} loading="lazy" className="h-full w-full object-contain" />
                  </div>
                  <div className="line-clamp-2 text-sm font-bold text-white">{item.name}</div>
                  <div className="mt-1 line-clamp-1 text-xs text-neutral-400">{item.sourceBoxName}</div>
                  <div className="mt-3 inline-flex items-center gap-1 rounded-md bg-indigo-600 px-2.5 py-1 text-xs font-bold text-white">
                    <CoinAmount amount={toCoins(item.value, PRICE_UNIT_MODE)} formatOptions={{ maximumFractionDigits: 0 }} className="text-xs font-bold text-white" iconClassName="h-3.5 w-3.5" />
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="relative hidden h-[272px] overflow-hidden rounded-2xl border border-white/5 bg-neutral-950/40 md:block">
            <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-[#0b0f19] to-transparent" />
            <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-[#0b0f19] to-transparent" />
            <div className="ticker-animation absolute inset-y-0 flex items-center gap-3 px-4">
              {[...topDropItems, ...topDropItems].map((item, i) => (
                <button
                  key={`${item.sourceKey}-${i}`}
                  className={`flex w-[180px] shrink-0 items-center gap-3 rounded-2xl border p-3 text-left transition hover:-translate-y-1 ${item.sourceKey === featuredDrop.sourceKey ? 'border-indigo-400/40 bg-indigo-500/10' : 'border-white/10 bg-black/20 hover:border-amber-300/30'}`}
                  onClick={() => onOpenBox(item.sourceBoxId)}
                  onFocus={() => setActiveDropKey(item.sourceKey)}
                  onMouseEnter={() => setActiveDropKey(item.sourceKey)}
                  type="button"
                  title={`${item.name} from ${item.sourceBoxName}`}
                >
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-white/[0.03] p-2">
                    <img src={item.image} className="h-full w-full object-contain" alt={item.name} loading="lazy" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="line-clamp-2 text-sm font-bold text-white">{item.name}</div>
                    <div className="mt-1 line-clamp-1 text-xs text-neutral-400">{item.sourceBoxName}</div>
                    <div className="mt-2 inline-flex items-center gap-1 rounded-md border border-amber-300/20 bg-amber-400/10 px-2 py-1 text-xs font-bold text-amber-100">
                      <CoinAmount amount={toCoins(item.value, PRICE_UNIT_MODE)} formatOptions={{ maximumFractionDigits: 0 }} className="text-xs font-bold text-amber-100" iconClassName="h-3.5 w-3.5" />
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
