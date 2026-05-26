import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown, Search, ShieldCheck, Sparkles, Tag, SlidersHorizontal } from 'lucide-react';
import { useGame } from '../context/GameContext';
import { useSound } from '../context/SoundContext';
import { getBoxTags, normalizeBoxTag } from '../utils/boxTags';
import { PRICE_UNIT_MODE, toCoins } from '../utils/coins';
import { CoinAmount } from './CoinAmount';
import { SkeletonTile } from '../src/ui/skeleton/Skeleton';
import { BlurImage } from '../src/ui/images/BlurImage';
import type { MysteryBox } from '../types';

type BoxCatalogProps = {
  isChatCollapsed: boolean;
};

type SortOption = 'featured' | 'price-asc' | 'price-desc' | 'newest' | 'trending';

const SORT_OPTIONS: Array<{ id: SortOption; label: string }> = [
  { id: 'featured', label: 'Featured' },
  { id: 'trending', label: 'Trending' },
  { id: 'newest', label: 'Newest' },
  { id: 'price-asc', label: 'Price: Low to High' },
  { id: 'price-desc', label: 'Price: High to Low' }
];

const TAG_STYLES: Record<string, string> = {
  top: 'bg-violet-600/90 text-white',
  new: 'bg-sky-500/90 text-white',
  hot: 'bg-rose-500/90 text-white',
  limited: 'bg-amber-500/90 text-black',
  popular: 'bg-emerald-500/90 text-black'
};

const getBoxPrice = (box: MysteryBox) => toCoins(box.price, PRICE_UNIT_MODE);

const scoreTrending = (box: MysteryBox) => {
  const itemValue = [...box.items]
    .sort((a, b) => b.price - a.price)
    .slice(0, 3)
    .reduce((sum, item) => sum + item.price, 0);
  const freshness = box.createdAt ?? 0;
  const tagBonus = getBoxTags(box).includes('trending') ? 400_000 : 0;
  return itemValue + freshness / 1000 + tagBonus;
};

const scoreFeatured = (box: MysteryBox) => {
  const topItem = box.items.reduce((max, item) => Math.max(max, item.price), 0);
  const rarityDepth = box.items.filter((item) => item.rarity === 'legendary' || item.rarity === 'epic').length;
  const tagBonus = getBoxTags(box).includes('featured') ? 250_000 : 0;
  return topItem + rarityDepth * 5_000 + tagBonus;
};

const getSortedBoxes = (boxes: MysteryBox[], sortOption: SortOption) => {
  const sorted = [...boxes];

  sorted.sort((left, right) => {
    switch (sortOption) {
      case 'price-asc':
        return getBoxPrice(left) - getBoxPrice(right) || left.name.localeCompare(right.name);
      case 'price-desc':
        return getBoxPrice(right) - getBoxPrice(left) || left.name.localeCompare(right.name);
      case 'newest':
        return (right.createdAt ?? 0) - (left.createdAt ?? 0) || left.name.localeCompare(right.name);
      case 'trending':
        return scoreTrending(right) - scoreTrending(left) || left.name.localeCompare(right.name);
      case 'featured':
      default:
        return scoreFeatured(right) - scoreFeatured(left) || scoreTrending(right) - scoreTrending(left) || left.name.localeCompare(right.name);
    }
  });

  return sorted;
};

const toCategoryKey = (value: string) =>
  value
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '')
    .trim();

const toCategoryVariants = (value: string) => {
  const key = toCategoryKey(value);
  if (!key) return [];

  const variants = new Set<string>([key]);
  if (key.endsWith('s') && key.length > 1) variants.add(key.slice(0, -1));
  else variants.add(`${key}s`);

  return Array.from(variants);
};

const isCategoryIconUrl = (value: string) => {
  const normalized = value.trim().toLowerCase();
  return normalized.startsWith('http://') || normalized.startsWith('https://') || normalized.startsWith('data:image/');
};

export const BoxCatalog: React.FC<BoxCatalogProps> = () => {
  const { boxes, setView, stripeSettings, balance } = useGame();
  const { playSound } = useSound();
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOption, setSortOption] = useState<SortOption>('featured');
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);
  const [showAffordableOnly, setShowAffordableOnly] = useState(false);
  const CATEGORY_ORDER = ['all', 'pokemon', 'tech', 'sneakers', 'streetwear', 'collectibles', 'gaming'];

  const hasActiveFilters =
    activeCategory !== 'all' ||
    searchQuery.trim().length > 0;

  const displayBoxes = useMemo(
    () => boxes.filter((box) => !box.isDaily && !(box.currencyType === 'XP' || Number(box.priceXP ?? 0) > 0)),
    [boxes]
  );

  const isLoadingBoxes = boxes.length === 0;

  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    displayBoxes
      .filter((box) => !box.isUserCreated)
      .forEach((box) => {
        getBoxTags(box).forEach((tag) => {
          counts.set(tag, (counts.get(tag) ?? 0) + 1);
        });
      });

    return Array.from(counts.entries())
      .map(([id, count]) => ({
        id,
        title: id
          .split(/[-_\s]+/)
          .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
          .join(' '),
        iconClass: stripeSettings.boxTagIcons[id] ?? '',
        count
      }))
      .sort((a, b) => b.count - a.count || a.title.localeCompare(b.title));
  }, [displayBoxes, stripeSettings.boxTagIcons]);

  const filteredBoxes = useMemo(() => {
    return displayBoxes.filter((box) => {
      if (box.isUserCreated) return false;
      const tags = getBoxTags(box);
      const matchesCategory = activeCategory === 'all' || tags.includes(normalizeBoxTag(activeCategory));
      const matchesSearch = box.name.toLowerCase().includes(searchQuery.toLowerCase().trim());
      const matchesAffordability = !showAffordableOnly || getBoxPrice(box) <= balance;
      return matchesCategory && matchesSearch && matchesAffordability;
    });
  }, [activeCategory, balance, displayBoxes, searchQuery, showAffordableOnly]);

  const sortedFilteredBoxes = useMemo(() => getSortedBoxes(filteredBoxes, sortOption), [filteredBoxes, sortOption]);

  const groupedBoxes = useMemo(() => sortedFilteredBoxes, [sortedFilteredBoxes]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const params = new URLSearchParams(window.location.search);
    const slug = params.get('category') ?? params.get('slug') ?? params.get('categorySlug');
    if (!slug) return;

    const normalizedSlug = normalizeBoxTag(slug);
    if (normalizedSlug === 'all') {
      setActiveCategory('all');
      return;
    }

    const requestedKeys = new Set(toCategoryVariants(normalizedSlug));
    const matchedCategory = categories.find((category) => {
      if (category.id === normalizedSlug) return true;

      const categoryKeys = [...toCategoryVariants(category.id), ...toCategoryVariants(category.title)];

      return categoryKeys.some((categoryKey) => requestedKeys.has(categoryKey));
    });

    if (matchedCategory) {
      setActiveCategory(matchedCategory.id);
    }
  }, [categories]);

  const clearFilters = () => {
    setActiveCategory('all');
    setSearchQuery('');
    setSortOption('featured');
  };

  const openBox = (boxId: string) => {
    playSound('click');
    setView({ type: 'CASE_OPENING', boxId });
  };

  return (
    <div className="w-full bg-[#131a24] pb-20 text-white">
      <div className="relative mx-auto max-w-[1320px] px-3 pb-5 pt-5 sm:px-5 sm:pt-8">
        <div className="grid items-center gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,470px)]">
          <div className="order-2 lg:order-1">
            <h1 className="text-4xl font-extrabold uppercase tracking-tight text-white sm:text-5xl">Boxes</h1>
            <p className="mt-2 max-w-xl text-base text-slate-300 sm:text-lg">
              Open premium mystery boxes and win <span className="text-[#5da0ff]">real items</span>.
            </p>
            <div className="mt-5 flex flex-wrap gap-2.5">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-200">
                <ShieldCheck className="h-3.5 w-3.5 text-[#67a6ff]" />
                Provably Fair
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-200">
                <Sparkles className="h-3.5 w-3.5 text-[#9a88ff]" />
                Real Items
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-200">
                <Tag className="h-3.5 w-3.5 text-[#67a6ff]" />
                Sell Back
              </span>
            </div>
          </div>
          <div className="order-1 flex justify-center lg:order-2 lg:justify-end">
            <div className="relative w-full max-w-[460px]">
              <div className="pointer-events-none absolute -left-6 -top-5 h-44 w-44 rounded-full bg-[#3f6dff]/35 blur-3xl" />
              <div className="pointer-events-none absolute -bottom-8 right-2 h-52 w-52 rounded-full bg-[#7a4dff]/25 blur-3xl" />
              {stripeSettings.boxCatalogHeroImageUrl ? (
                <img
                  src={stripeSettings.boxCatalogHeroImageUrl}
                  alt="Box catalog hero"
                  className="relative mx-auto h-44 w-full object-contain sm:h-56 lg:h-64"
                  loading="eager"
                  decoding="async"
                />
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <div className="sticky top-[var(--pullz-header-height,70px)] z-40 w-full border-y border-white/10 bg-[#131a24]/95 backdrop-blur">
        <div className="mx-auto max-w-[1320px] px-3 py-3 sm:px-5">
          <div className="mb-3 flex w-full items-center gap-2 sm:mb-2 sm:max-w-[680px]">
              <div className="flex items-center rounded-xl border border-white/10 bg-[#20262b] px-3 py-3">
                <Search className="h-4 w-4 shrink-0 text-[#5f6f95]" />
                <input type="text" placeholder="Search boxes..." className="w-full bg-transparent pl-2 text-sm text-white placeholder-slate-500 outline-none" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
              </div>
              <label className="relative hidden sm:block">
                <select value={sortOption} onChange={(event) => setSortOption(event.target.value as SortOption)} className="h-full w-full appearance-none rounded-xl border border-white/10 bg-[#20262b] px-4 py-3 pr-9 text-sm font-semibold text-white outline-none">
                  {SORT_OPTIONS.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#7a87a8]" />
              </label>
              <div className="relative sm:hidden">
                <button
                  type="button"
                  onClick={() => setIsMobileFilterOpen((prev) => !prev)}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-[#20262b] text-slate-200"
                  aria-label="Filter and sort options"
                >
                  <SlidersHorizontal className="h-4.5 w-4.5" />
                </button>
                {isMobileFilterOpen && (
                  <div className="absolute right-0 top-12 z-50 w-48 rounded-xl border border-white/10 bg-[#1b2432] p-2 shadow-xl">
                    <label className="relative block">
                      <select value={sortOption} onChange={(event) => { setSortOption(event.target.value as SortOption); setIsMobileFilterOpen(false); }} className="h-10 w-full appearance-none rounded-lg border border-white/10 bg-[#20262b] px-3 pr-8 text-sm font-semibold text-white outline-none">
                        {SORT_OPTIONS.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#7a87a8]" />
                    </label>
                  </div>
                )}
              </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto scrollbar-hide">
            {CATEGORY_ORDER.map((id) => {
              const cat = id === 'all' ? { id: 'all', title: 'All' } : categories.find((entry) => entry.id === id);
              if (!cat) return null;
              const isActive = activeCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={`flex items-center justify-center whitespace-nowrap rounded-full border px-3.5 py-2 text-xs font-semibold uppercase tracking-wide transition ${
                    isActive
                      ? 'border-transparent bg-gradient-to-r from-[#1f6cff] to-[#5d39ff] text-white'
                      : 'border-white/10 bg-white/5 text-slate-300 hover:border-white/20 hover:text-white'
                  }`}
                >
                  {cat.id !== 'all' && cat.iconClass && isCategoryIconUrl(cat.iconClass) ? (
                    <>
                      <img
                        src={cat.iconClass}
                        alt={cat.title}
                        className="h-4 w-4 shrink-0 object-contain"
                        loading="eager"
                        decoding="async"
                      />
                      <span>{cat.title}</span>
                    </>
                  ) : <span>{cat.title}</span>}
                </button>
              );
            })}
            </div>
            <label className="inline-flex h-9 shrink-0 items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 text-xs font-semibold text-slate-200">
              <input
                type="checkbox"
                checked={showAffordableOnly}
                onChange={(event) => setShowAffordableOnly(event.target.checked)}
                className="h-3.5 w-3.5 rounded border-white/30 bg-transparent text-[#3f7cff] focus:ring-[#3f7cff]"
              />
              Enough coins
            </label>
          </div>
        </div>
      </div>

      <div className="mx-auto min-h-[100dvh] w-full max-w-[1320px] px-3 py-4 sm:px-5 sm:py-5">
        <div className="flex flex-col gap-6">
          {isLoadingBoxes && (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-5">
              {Array.from({ length: 10 }).map((_, idx) => <SkeletonTile key={`box-skeleton-${idx}`} />)}
            </div>
          )}

          {!isLoadingBoxes && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {groupedBoxes.map((box, index) => (
                (() => {
                  const boxTags = getBoxTags(box);
                  const primaryTag = boxTags.find((tag) => TAG_STYLES[tag]) ?? null;
                  const tagClass = primaryTag ? (TAG_STYLES[primaryTag] ?? 'bg-slate-600 text-white') : '';
                  return (
                <button
                  key={box.id}
                  type="button"
                  onClick={() => openBox(box.id)}
                  className="group w-full overflow-hidden rounded-xl border border-white/10 bg-[#20262b] text-left shadow-[0_0_0_1px_rgba(53,76,129,0.12)] transition hover:border-slate-400/35"
                >
                  <div className="relative px-2 pb-2 pt-3">
                    {primaryTag && (
                      <span className={`absolute left-2 top-2 z-10 rounded-md px-2 py-0.5 text-[10px] uppercase tracking-wide ${tagClass}`}>{primaryTag}</span>
                    )}
                    <div className="mx-auto aspect-[1.35] w-full">
                      <BlurImage
                        src={box.image}
                        fallbackSrc="/preview.png"
                        alt={box.name}
                        loading="lazy"
                        decoding="async"
                        width={360}
                        height={230}
                        ratioClassName="h-full w-full"
                        className="h-full w-full object-contain transition duration-300 group-hover:scale-105"
                      />
                    </div>
                  </div>
                  <div className="border-t border-white/10 px-3 pb-3 pt-2">
                    <div className="line-clamp-1 text-[15px] font-medium text-slate-100 sm:text-base">{box.name}</div>
                    <CoinAmount amount={Math.round(getBoxPrice(box))} formatOptions={{ maximumFractionDigits: 0 }} className="mt-1 justify-start text-[15px] font-medium text-slate-200" iconClassName="h-4 w-4" />
                    <p className="mt-3 text-[10px] uppercase tracking-wide text-slate-400">Best items</p>
                    <div className="mt-1 grid grid-cols-3 gap-1.5">
                      {[...box.items].sort((a, b) => b.price - a.price).slice(0, 3).map((item) => (
                        <div key={`${box.id}-${item.id}`} className="flex h-11 items-center justify-center rounded-md border border-white/10 bg-[#1f2730] p-1">
                          <BlurImage src={item.image} fallbackSrc="/preview.png" alt={item.name} className="h-full w-full object-contain" loading="lazy" width={56} height={44} />
                        </div>
                      ))}
                    </div>
                  </div>
                </button>
                  );
                })()
              ))}
            </div>
          )}
          {!isLoadingBoxes && groupedBoxes.length === 0 && (
            <div className="rounded-2xl border border-dashed border-white/10 bg-neutral-950/70 px-6 py-12 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/5">
                <Search className="h-6 w-6 text-blue-300" />
              </div>
              <h2 className="mb-2 text-2xl font-bold text-white">No boxes match this view yet</h2>
              <p className="mx-auto mb-6 max-w-xl text-sm text-neutral-400 sm:text-base">
                Try clearing the current filters, switching to another sort, or jump back into the full catalog to keep browsing.
              </p>
              <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
                {hasActiveFilters && (
                  <button type="button" onClick={clearFilters} className="w-full rounded-xl bg-[#205DD7] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#1f6bea] sm:w-auto">
                    Clear filters
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setActiveCategory('all');
                    setSearchQuery('');
                  }}
                  className="w-full rounded-xl border border-white/10 px-5 py-3 text-sm font-bold text-white transition hover:border-white/20 hover:bg-white/5 sm:w-auto"
                >
                  Return to all boxes
                </button>
                <button type="button" onClick={() => setSortOption('featured')} className="w-full rounded-xl border border-white/10 px-5 py-3 text-sm font-bold text-white transition hover:border-white/20 hover:bg-white/5 sm:w-auto">
                  View featured sort
                </button>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
