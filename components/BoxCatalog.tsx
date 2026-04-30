import React, { useEffect, useMemo, useState } from 'react';
import { Search, Sparkles, X } from 'lucide-react';
import { useGame } from '../context/GameContext';
import { useSound } from '../context/SoundContext';
import { getBoxTags, normalizeBoxTag } from '../utils/boxTags';
import { PRICE_UNIT_MODE, toCoins } from '../utils/coins';
import { SkeletonTile } from '../src/ui/skeleton/Skeleton';
import { BoxCard } from './BoxCard';
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

export const BoxCatalog: React.FC<BoxCatalogProps> = () => {
  const { boxes, setView, stripeSettings, balance } = useGame();
  const { playSound } = useSound();
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOption, setSortOption] = useState<SortOption>('featured');
  const [minPriceQuery, setMinPriceQuery] = useState('');
  const [maxPriceQuery, setMaxPriceQuery] = useState('');
  const [onlyAffordable, setOnlyAffordable] = useState(false);

  const minPrice = minPriceQuery.trim() ? Number(minPriceQuery) : null;
  const maxPrice = maxPriceQuery.trim() ? Number(maxPriceQuery) : null;

  const hasActiveFilters =
    activeCategory !== 'all' ||
    searchQuery.trim().length > 0 ||
    Boolean(minPriceQuery.trim()) ||
    Boolean(maxPriceQuery.trim()) ||
    onlyAffordable;

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
      const boxPrice = getBoxPrice(box);
      const matchesMin = minPrice == null || Number.isNaN(minPrice) || boxPrice >= minPrice;
      const matchesMax = maxPrice == null || Number.isNaN(maxPrice) || boxPrice <= maxPrice;
      const matchesAffordable = !onlyAffordable || boxPrice <= balance;
      return matchesCategory && matchesSearch && matchesMin && matchesMax && matchesAffordable;
    });
  }, [activeCategory, balance, displayBoxes, maxPrice, minPrice, onlyAffordable, searchQuery]);

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
    setMinPriceQuery('');
    setMaxPriceQuery('');
    setOnlyAffordable(false);
    setSortOption('featured');
  };

  const openBox = (boxId: string) => {
    playSound('click');
    setView({ type: 'CASE_OPENING', boxId });
  };

  return (
    <div className="w-full bg-[#0b0d11] pb-20">

      <div className="sticky top-0 z-40 w-full border-b border-white/10 bg-[#090a0f]/95 shadow-xl backdrop-blur">
        <div className="mx-auto max-w-[1370px] px-3 py-4 sm:px-4">
          <div className="-mx-1 mb-3 flex items-center gap-2 overflow-x-auto border-b border-white/10 px-1 pb-3 scrollbar-hide [scrollbar-gutter:stable] [-webkit-overflow-scrolling:touch]">
            <button
              onClick={() => setActiveCategory('all')}
              className={`flex items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-bold transition-all ${activeCategory === 'all' ? 'bg-white/10 text-white' : 'text-neutral-500 hover:bg-white/5 hover:text-neutral-300'}`}
            >
              <Sparkles className="h-4 w-4 text-indigo-400" />
              All
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`flex items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-bold transition-all ${activeCategory === cat.id ? 'bg-white/10 text-white' : 'text-neutral-500 hover:bg-white/5 hover:text-neutral-300'}`}
              >
                {cat.iconClass ? <i aria-hidden="true" className={`${cat.iconClass} text-sm`} /> : <div className="h-4 w-4 rounded-full bg-indigo-500" />}
                <span>{cat.title}</span>
              </button>
            ))}
          </div>

          <div className="rounded-2xl border border-white/10 bg-[#121318] p-2.5 sm:p-3">
            <div className="flex flex-col gap-2 xl:flex-row xl:items-center">
              <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-white/5 bg-black/45 px-3 py-2.5 md:w-auto">
                <Search className="h-4 w-4 shrink-0 text-neutral-500" />
                <input
                  type="text"
                  placeholder="Search boxes"
                  className="w-full min-w-0 border-none bg-transparent text-sm text-white placeholder-neutral-600 outline-none"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                  <button type="button" className="text-neutral-500 transition hover:text-white" onClick={() => setSearchQuery('')} aria-label="Clear search">
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:flex xl:items-center xl:gap-3">
                <div className="flex items-center gap-2">
                  <div className="flex min-w-[120px] items-center gap-1.5 rounded-xl border border-white/5 bg-black/45 px-3 py-2.5">
                    <Sparkles className="h-4 w-4 text-indigo-400" />
                    <input
                      inputMode="numeric"
                      placeholder="Min"
                      value={minPriceQuery}
                      onChange={(event) => setMinPriceQuery(event.target.value.replace(/[^\d]/g, ''))}
                      className="w-full border-none bg-transparent text-sm font-semibold text-white placeholder-neutral-500 outline-none"
                    />
                  </div>
                  <span className="text-neutral-500">–</span>
                  <div className="flex min-w-[120px] items-center gap-1.5 rounded-xl border border-white/5 bg-black/45 px-3 py-2.5">
                    <Sparkles className="h-4 w-4 text-indigo-400" />
                    <input
                      inputMode="numeric"
                      placeholder="Max"
                      value={maxPriceQuery}
                      onChange={(event) => setMaxPriceQuery(event.target.value.replace(/[^\d]/g, ''))}
                      className="w-full border-none bg-transparent text-sm font-semibold text-white placeholder-neutral-500 outline-none"
                    />
                  </div>
                </div>
                <label className="relative">
                  <span className="sr-only">Sort boxes</span>
                  <select
                    value={sortOption}
                    onChange={(event) => setSortOption(event.target.value as SortOption)}
                    className="appearance-none rounded-lg border border-white/5 bg-neutral-800 px-4 py-2.5 pr-9 text-xs font-bold text-white outline-none transition-colors hover:bg-neutral-700"
                  >
                    {SORT_OPTIONS.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-3 w-3 -translate-y-1/2 text-neutral-400" />
                </label>
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-white/5 px-3 py-2.5 text-sm font-semibold text-neutral-200">
                  <input
                    type="checkbox"
                    checked={onlyAffordable}
                    onChange={(event) => setOnlyAffordable(event.target.checked)}
                    className="h-4 w-4 rounded border-white/20 bg-black/40"
                  />
                  Enough Coins to Buy
                </label>
                <button
                  type="button"
                  onClick={clearFilters}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 px-3 py-2.5 text-sm font-semibold text-neutral-200 transition hover:border-white/20 hover:text-white"
                >
                  <X className="h-4 w-4" />
                  Clear Filters
                </button>
              </div>
            </div>

            <div className="mt-2 flex items-center justify-between gap-2 xl:hidden">
              <div className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap text-xs text-neutral-300 scrollbar-hide">
                <span className="rounded-full bg-white/5 px-3 py-1.5 inline-flex items-center gap-2">
                  <span className="font-semibold text-white">{activeCategory === 'all' ? 'All boxes' : categories.find((cat) => cat.id === activeCategory)?.title ?? 'Filtered'}</span>
                  {searchQuery.trim() ? <span className="truncate text-neutral-400">• “{searchQuery.trim()}”</span> : null}
                </span>
              </div>
              {hasActiveFilters && (
                <button type="button" onClick={clearFilters} className="shrink-0 rounded-full border border-white/10 px-3 py-1.5 text-xs font-semibold text-neutral-200 transition hover:border-white/20 hover:text-white">
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto min-h-[100dvh] w-full max-w-6xl px-4 py-8">
        <div className="flex flex-col gap-8">
          {isLoadingBoxes && (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-5">
              {Array.from({ length: 10 }).map((_, idx) => <SkeletonTile key={`box-skeleton-${idx}`} />)}
            </div>
          )}

          {!isLoadingBoxes && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {groupedBoxes.map((box) => (
                <BoxCard key={box.id} box={box} onSelect={openBox} />
              ))}
            </div>
          )}

          {!isLoadingBoxes && groupedBoxes.length === 0 && (
            <div className="rounded-2xl border border-dashed border-white/10 bg-neutral-950/70 px-6 py-12 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/5">
                <Search className="h-6 w-6 text-indigo-300" />
              </div>
              <h2 className="mb-2 text-2xl font-bold text-white">No boxes match this view yet</h2>
              <p className="mx-auto mb-6 max-w-xl text-sm text-neutral-400 sm:text-base">
                Try clearing the current filters, switching to another sort, or jump back into the full catalog to keep browsing.
              </p>
              <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
                {hasActiveFilters && (
                  <button type="button" onClick={clearFilters} className="w-full rounded-xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-indigo-500 sm:w-auto">
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

        <div className="mt-20 border-t border-white/5 pt-8">
          <div className="prose prose-invert prose-sm max-w-none text-neutral-400">
            <h2 className="mb-4 text-xl font-bold text-white">Browse by Category</h2>
            <p className="mb-4">
              Pullz mystery boxes are split into category groups. Each box lists every possible item and the exact drop rates before you open.
            </p>
            <h2 className="mb-4 text-xl font-bold text-white">How Box Opening Works</h2>
            <p>
              Browse the full catalog and buy a mystery box online in seconds. Pick any box, and before you open, every item inside is visible along with its drop rate. After opening, choose to ship the item or trade it in for Coins and use them on any other box.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
