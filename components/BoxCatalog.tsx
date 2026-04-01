import React, { useEffect, useMemo, useState } from 'react';
import { Search, Filter, ChevronDown, SlidersHorizontal, Sparkles, X, Package2 } from 'lucide-react';
import { useGame } from '../context/GameContext';
import { useSound } from '../context/SoundContext';
import { getBoxTags, normalizeBoxTag } from '../utils/boxTags';
import { PRICE_UNIT_MODE, toCoins } from '../utils/coins';
import { CoinAmount } from './CoinAmount';
import { TopDropsSlider } from './TopDropsSlider';
import { SkeletonTile } from '../src/ui/skeleton/Skeleton';
import { BlurImage } from '../src/ui/images/BlurImage';
import { prefetchBox } from '../src/lib/prefetch/prefetchBox';
import type { MysteryBox } from '../types';

type BoxCatalogProps = {
  isChatCollapsed: boolean;
};

type SortOption = 'featured' | 'price-asc' | 'price-desc' | 'newest' | 'trending';

type EditorialGroup = {
  id: string;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  boxes: MysteryBox[];
};

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

const createHotPicksBackground = () => {
  const svg = `
    <svg width="1600" height="460" viewBox="0 0 1600 460" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="1600" height="460" fill="#050816"/>
      <circle cx="1260" cy="80" r="220" fill="#7C3AED" fill-opacity="0.32"/>
      <circle cx="320" cy="180" r="240" fill="#2563EB" fill-opacity="0.22"/>
      <circle cx="820" cy="420" r="260" fill="#4338CA" fill-opacity="0.18"/>
      <path d="M0 318C180 254 350 228 522 248C694 268 806 334 975 341C1143 348 1297 303 1600 180V460H0V318Z" fill="url(#paint0_linear)" fill-opacity="0.95"/>
      <path d="M0 214C123 170 248 152 390 164C575 180 694 274 897 288C1110 303 1279 232 1600 80" stroke="rgba(255,255,255,0.14)" stroke-width="2"/>
      <defs>
        <linearGradient id="paint0_linear" x1="800" y1="150" x2="800" y2="460" gradientUnits="userSpaceOnUse">
          <stop stop-color="#0F172A" stop-opacity="0"/>
          <stop offset="0.54" stop-color="#0F172A"/>
          <stop offset="1" stop-color="#020617"/>
        </linearGradient>
      </defs>
    </svg>`;

  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
};

const HOT_PICKS_BACKGROUND = createHotPicksBackground();


const withOpacity = (color: string, alphaHex: string) => {
  if (/^#([0-9a-fA-F]{6})$/.test(color)) return `${color}${alphaHex}`;
  if (/^#([0-9a-fA-F]{3})$/.test(color)) {
    const [, shortHex] = color.match(/^#([0-9a-fA-F]{3})$/) ?? [];
    if (shortHex) return `#${shortHex.split('').map((char) => char + char).join('')}${alphaHex}`;
  }

  return color;
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
  const [previewBoxId, setPreviewBoxId] = useState<string | null>(null);

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

  const groupedBoxes = useMemo<EditorialGroup[]>(() => {
    if (activeCategory !== 'all') {
      const selected = categories.find((category) => category.id === activeCategory);
      return [
        {
          id: activeCategory,
          title: selected?.title ?? 'Boxes',
          subtitle: searchQuery.trim()
            ? `Showing ${sortedFilteredBoxes.length} matches for “${searchQuery.trim()}”.`
            : `Curated ${selected?.title?.toLowerCase() ?? 'box'} picks ready to open.`,
          icon: selected?.iconClass ? <i aria-hidden="true" className={`${selected.iconClass} text-sm text-indigo-300`} /> : <Sparkles className="h-4 w-4 text-indigo-300" />,
          boxes: sortedFilteredBoxes
        }
      ];
    }

    if (searchQuery.trim()) {
      return [
        {
          id: 'search-results',
          title: 'Search results',
          subtitle: `Showing ${sortedFilteredBoxes.length} boxes matching “${searchQuery.trim()}”.`,
          icon: <Search className="h-4 w-4 text-indigo-300" />,
          boxes: sortedFilteredBoxes
        }
      ];
    }

    const featured = getSortedBoxes(sortedFilteredBoxes, 'featured').slice(0, 5);
    const trending = getSortedBoxes(sortedFilteredBoxes, 'trending').filter((box) => !featured.some((entry) => entry.id === box.id)).slice(0, 5);
    const newest = getSortedBoxes(sortedFilteredBoxes, 'newest').filter((box) => !featured.some((entry) => entry.id === box.id) && !trending.some((entry) => entry.id === box.id)).slice(0, 5);
    const accessible = getSortedBoxes(sortedFilteredBoxes.filter((box) => getBoxPrice(box) <= 500), 'price-asc')
      .filter((box) => !featured.some((entry) => entry.id === box.id) && !trending.some((entry) => entry.id === box.id) && !newest.some((entry) => entry.id === box.id))
      .slice(0, 5);

    const editorialRows: EditorialGroup[] = [
      {
        id: 'featured-spotlight',
        title: 'Featured spotlight',
        subtitle: 'A hand-picked opening lineup with the strongest headline pulls.',
        icon: <Sparkles className="h-4 w-4 text-indigo-300" />,
        boxes: featured
      },
      {
        id: 'trending-now',
        title: 'Trending now',
        subtitle: 'Momentum picks with strong value density and fresh activity.',
        icon: <SlidersHorizontal className="h-4 w-4 text-indigo-300" />,
        boxes: trending
      },
      {
        id: 'new-arrivals',
        title: 'New arrivals',
        subtitle: 'Recently added boxes so the catalog feels fresh every visit.',
        icon: <ChevronDown className="h-4 w-4 -rotate-90 text-indigo-300" />,
        boxes: newest
      },
      {
        id: 'easy-to-start',
        title: 'Easy to start',
        subtitle: 'Lower-entry boxes for quick taps on mobile without endless scrolling.',
        icon: <Filter className="h-4 w-4 text-indigo-300" />,
        boxes: accessible
      }
    ].filter((group) => group.boxes.length > 0);

    if (editorialRows.length > 0) return editorialRows;

    return categories
      .map((category) => ({
        id: category.id,
        title: category.title,
        subtitle: `${category.count} boxes in this collection.`,
        icon: category.iconClass ? <i aria-hidden="true" className={`${category.iconClass} text-sm text-indigo-300`} /> : <Sparkles className="h-4 w-4 text-indigo-300" />,
        boxes: getSortedBoxes(sortedFilteredBoxes.filter((box) => getBoxTags(box).includes(category.id)), sortOption)
      }))
      .filter((group) => group.boxes.length > 0);
  }, [activeCategory, categories, searchQuery, sortedFilteredBoxes, sortOption]);

  const hotPicks = useMemo(() => getSortedBoxes(displayBoxes.filter((box) => !box.isUserCreated), 'featured').slice(0, 6), [displayBoxes]);

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

  useEffect(() => {
    if (previewBoxId === null || typeof window === 'undefined') return undefined;
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return undefined;

    const timeoutId = window.setTimeout(() => {
      setPreviewBoxId((current) => (current === previewBoxId ? null : current));
    }, 1800);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [previewBoxId]);

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
    <div className="w-full pb-20">
      <div className="relative z-20 w-full">
        <TopDropsSlider boxes={displayBoxes} onOpenBox={openBox} className="py-0 md:py-6" />
      </div>

      <div
        className="relative w-full overflow-hidden border-y border-white/5 bg-[#050816]"
        style={{
          backgroundImage: `linear-gradient(to bottom, rgba(5, 8, 22, 0.05) 0%, rgba(5, 8, 22, 0.96) 78%), ${HOT_PICKS_BACKGROUND}`,
          backgroundSize: 'cover',
          backgroundPosition: 'center'
        }}
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(129,140,248,0.18),_transparent_32%),radial-gradient(circle_at_left,_rgba(59,130,246,0.18),_transparent_28%)]" />
        <div className="mx-auto flex max-w-[1675px] flex-col items-center px-4 pb-10 pt-8 md:pb-12">
          <h1 className="mb-3 text-center text-3xl font-black italic tracking-tighter text-white drop-shadow-lg md:text-5xl">
            Hot <span className="text-indigo-500">Picks</span>
          </h1>

          <div className="grid w-full grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6 lg:gap-4">
            {hotPicks.map((box) => (
              <button
                key={box.id}
                onClick={() => openBox(box.id)}
                className="group relative flex min-h-[220px] flex-col items-center rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-4 text-center transition-transform hover:-translate-y-1 hover:border-indigo-400/40"
                type="button"
              >
                <div className="mb-3 flex w-full items-center justify-center">
                  <div className="line-clamp-2 text-center text-sm font-bold text-white">{box.name}</div>
                </div>
                <div className="relative flex h-[132px] w-full items-center justify-center sm:h-[150px]">
                  <BlurImage
                    src={box.image}
                    alt={box.name}
                    className="h-full w-full object-contain drop-shadow-xl transition-transform duration-300 group-hover:scale-105"
                  />
                </div>
                <div className="mt-4 flex w-full flex-1 items-end justify-center">
                  <div className="inline-flex items-center justify-center gap-1.5 rounded-md border border-indigo-400/35 bg-indigo-900/70 px-3 py-1">
                    <CoinAmount
                      amount={getBoxPrice(box)}
                      formatOptions={{ maximumFractionDigits: 0 }}
                      className="text-sm font-bold text-white"
                      iconClassName="h-4 w-4"
                    />
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

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
                  Enough Credits to Buy
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
        <div className="flex flex-col gap-10 md:gap-12">
          {isLoadingBoxes && (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-5">
              {Array.from({ length: 10 }).map((_, idx) => <SkeletonTile key={`box-skeleton-${idx}`} />)}
            </div>
          )}

          {!isLoadingBoxes && groupedBoxes.map((group) => (
            <div key={group.id} className="flex flex-col gap-4">
              <div className="flex items-start justify-between gap-3 border-b border-white/5 pb-4">
                <div className="min-w-0">
                  <div className="mb-2 flex items-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/5">{group.icon}</div>
                    <h2 className="text-xl font-bold text-white">{group.title}</h2>
                  </div>
                </div>
                <div className="hidden rounded-full border border-white/10 px-3 py-1 text-xs font-semibold text-neutral-300 md:block">
                  {group.boxes.length} box{group.boxes.length === 1 ? '' : 'es'}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4 lg:grid-cols-5">
                {group.boxes.map((box) => {
                  const topItem = [...box.items].sort((left, right) => right.price - left.price)[0] ?? null;
                  const isVisible = previewBoxId === box.id;
                  const topPanelBackground = `linear-gradient(180deg, ${withOpacity(box.accentColor, '14')} 0%, ${withOpacity(box.accentColor, '8a')} 58%, ${withOpacity(box.accentColor, 'd9')} 100%)`;

                  return (
                    <button
                      key={box.id}
                      onClick={() => openBox(box.id)}
                      className="group flex flex-col overflow-hidden rounded-[1.75rem] border border-white/10 bg-[#151129] text-left shadow-[0_18px_40px_-28px_rgba(0,0,0,0.85)] transition-all duration-300 hover:-translate-y-1 hover:border-white/20 hover:shadow-[0_24px_60px_-32px_rgba(0,0,0,0.9)]"
                      type="button"
                      onMouseEnter={() => {
                        if (typeof window !== 'undefined' && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
                          void prefetchBox(box.id, async () => box, box.image);
                          setPreviewBoxId(box.id);
                        }
                      }}
                      onMouseLeave={() => setPreviewBoxId((current) => (current === box.id ? null : current))}
                      onTouchStart={() => {
                        void prefetchBox(box.id, async () => box, box.image);
                        setPreviewBoxId(box.id);
                      }}
                      onTouchEnd={() => {
                        window.setTimeout(() => {
                          setPreviewBoxId((current) => (current === box.id ? null : current));
                        }, 450);
                      }}
                      onTouchCancel={() => setPreviewBoxId((current) => (current === box.id ? null : current))}
                    >
                      <div
                        className="relative flex min-h-[224px] w-full items-end justify-center overflow-hidden px-3 pt-7 sm:min-h-[250px] sm:px-4 sm:pt-8"
                        style={{ background: topPanelBackground }}
                      >
                        <div className="pointer-events-none absolute inset-x-[10%] top-4 h-28 rounded-[2rem] bg-white/10 blur-2xl sm:top-6 sm:h-36" />
                        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/20 via-black/5 to-transparent" />
                        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center">
                          <div className="h-1.5 w-20 rounded-t-full bg-indigo-300/85 shadow-[0_0_20px_rgba(165,180,252,0.65)] sm:w-24" />
                        </div>
                        <div className="relative z-10 flex h-[160px] w-full -translate-y-3 items-center justify-center pb-6 sm:h-[190px] sm:translate-y-0 sm:pb-6">
                          {topItem ? (
                            <img
                              src={topItem.image}
                              alt=""
                              aria-hidden={!isVisible}
                              loading="lazy"
                              decoding="async"
                              className={`absolute z-10 h-full w-full object-contain object-center drop-shadow-[0_24px_28px_rgba(0,0,0,0.42)] transition-all duration-300 ease-out sm:-translate-y-3 ${isVisible ? 'translate-y-0 scale-100 opacity-100' : 'translate-y-4 scale-95 opacity-0'}`}
                            />
                          ) : null}
                          <img
                            src={box.image}
                            alt={box.name}
                            loading="lazy"
                            decoding="async"
                            className={`absolute inset-0 z-20 h-full w-full object-contain object-center drop-shadow-[0_24px_28px_rgba(0,0,0,0.42)] transition-all duration-300 ease-out sm:-translate-y-3 ${isVisible ? '-translate-y-10 scale-90 opacity-0' : 'translate-y-0 scale-100 opacity-100'} group-hover:translate-y-0 group-hover:scale-105`}
                          />
                        </div>
                      </div>

                      <div className="flex w-full flex-col gap-3 bg-[#151129] px-3 pb-3 pt-4 sm:px-4 sm:pb-4">
                        <div className="line-clamp-2 min-h-[2.75rem] text-sm font-extrabold text-white sm:text-[1.05rem]">
                          {box.name}
                        </div>
                        <div className="flex w-full items-center gap-1 overflow-hidden rounded-2xl bg-[#232454] p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
                          <div className="flex min-w-0 flex-1 items-center justify-center rounded-[0.9rem] bg-white/5 px-2 py-2 sm:px-3">
                            <CoinAmount
                              amount={Math.round(getBoxPrice(box))}
                              formatOptions={{ maximumFractionDigits: 0 }}
                              animated={false}
                              className="min-w-0 whitespace-nowrap text-xs font-extrabold tabular-nums text-white sm:text-sm"
                              iconClassName="h-3.5 w-3.5 sm:h-4 sm:w-4"
                            />
                          </div>
                          <div className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[0.9rem] bg-gradient-to-r from-[#8b5cf6] to-[#a855f7] text-white shadow-[0_10px_24px_-16px_rgba(168,85,247,0.95)] sm:h-11 sm:w-11">
                            <Package2 className="h-4 w-4 sm:h-5 sm:w-5" />
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {!isLoadingBoxes && groupedBoxes.length === 0 && (
            <div className="rounded-2xl border border-dashed border-white/10 bg-neutral-950/70 px-6 py-12 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/5">
                <Search className="h-6 w-6 text-indigo-300" />
              </div>
              <h2 className="mb-2 text-2xl font-bold text-white">No boxes match this view yet</h2>
              <p className="mx-auto mb-6 max-w-xl text-sm text-neutral-400 sm:text-base">
                Try clearing the current filters, switching to another sort, or jump back into the full catalog to keep browsing on mobile without extra clutter.
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
              Browse the full catalog and buy a mystery box online in seconds. Pick any box, and before you open, every item inside is visible along with its drop rate. After opening, choose to ship the item or trade it in for Credits and use them on any other box.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
