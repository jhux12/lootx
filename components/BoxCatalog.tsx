import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown, Search, Sparkles } from 'lucide-react';
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
  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false);

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
    <div className="w-full bg-[#1a1f26] pb-20">

      <div className="sticky top-[var(--pullz-header-height,70px)] z-50 w-full border-b border-white/10 bg-[#1a1f26]/95 shadow-xl backdrop-blur">
        <div className="mx-auto max-w-[980px] px-3 py-3 sm:px-4">
          <div className="mb-3 flex items-center gap-2 overflow-x-auto scrollbar-hide">
            <button onClick={() => setActiveCategory('all')} className="flex items-center gap-2 whitespace-nowrap rounded-xl bg-white/10 px-4 py-2.5 text-sm font-bold text-white">
              <Sparkles className="h-4 w-4 text-blue-400" /> All
            </button>
            {categories.map((cat) => (
              <button key={cat.id} onClick={() => setActiveCategory(cat.id)} className="whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-bold text-neutral-400 hover:bg-white/5 hover:text-white">
                {cat.title}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div className="flex min-w-0 items-center gap-2 rounded-xl border border-white/10 bg-[#222833] px-3 py-3">
              <Search className="h-4 w-4 shrink-0 text-neutral-500" />
              <input type="text" placeholder="Search" className="w-full min-w-0 border-none bg-transparent text-sm text-white placeholder-neutral-600 outline-none" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
              <button
                type="button"
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-white/15 text-white sm:hidden"
                onClick={() => setIsMobileFiltersOpen((current) => !current)}
                aria-label="Toggle filters"
              >
                <i className="fa-solid fa-angles-down text-sm" />
              </button>
              <button type="button" className="text-[#4ea8ff] text-sm font-semibold" onClick={() => setSearchQuery('')}>Reset</button>
            </div>
            <label className={`relative ${isMobileFiltersOpen ? 'block' : 'hidden'} sm:block`}>
              <select value={sortOption} onChange={(event) => setSortOption(event.target.value as SortOption)} className="appearance-none w-full rounded-xl border border-white/10 bg-[#1d232e] px-4 py-3 pr-9 text-sm font-bold text-white outline-none">
                {SORT_OPTIONS.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400" />
            </label>
            <div className={`grid grid-cols-2 gap-2 ${isMobileFiltersOpen ? 'grid' : 'hidden'} sm:grid`}>
              <input inputMode="numeric" placeholder="Min" value={minPriceQuery} onChange={(event) => setMinPriceQuery(event.target.value.replace(/[^\d]/g, ''))} className="w-full rounded-xl border border-white/10 bg-[#1d232e] px-3 py-3 text-sm font-semibold text-white placeholder-neutral-500 outline-none" />
              <input inputMode="numeric" placeholder="Max" value={maxPriceQuery} onChange={(event) => setMaxPriceQuery(event.target.value.replace(/[^\d]/g, ''))} className="w-full rounded-xl border border-white/10 bg-[#1d232e] px-3 py-3 text-sm font-semibold text-white placeholder-neutral-500 outline-none" />
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
            <div className="grid justify-items-center grid-cols-2 gap-x-3 gap-y-8 sm:gap-x-4 sm:gap-y-10 lg:grid-cols-5">
              {groupedBoxes.map((box) => (
                <button key={box.id} type="button" onClick={() => openBox(box.id)} className="group w-full max-w-[220px] rounded-xl border border-transparent bg-transparent p-2 text-center transition-colors duration-300 ease-out">
                  <div className="relative mx-auto aspect-[0.72] w-[88%] sm:w-[86%]">
                    <BlurImage
                      src={box.image}
                      fallbackSrc="/preview.png"
                      alt={box.name}
                      loading="lazy"
                      decoding="async"
                      width={220}
                      height={306}
                      ratioClassName="h-full w-full"
                      className="mx-auto h-full w-full object-contain transition-all duration-300 ease-out group-hover:scale-110 group-hover:rotate-[-3deg]"
                    />
                  </div>
                  <div className="mt-3 line-clamp-2 min-h-[2.5rem] text-sm font-extrabold text-white sm:text-base">
                    {box.name}
                  </div>
                  <div className="mt-1 flex justify-center">
                    <CoinAmount
                      amount={Math.round(getBoxPrice(box))}
                      formatOptions={{ maximumFractionDigits: 0 }}
                      className="justify-center text-lg font-extrabold text-white"
                      iconClassName="h-4 w-4"
                    />
                  </div>
                </button>
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
