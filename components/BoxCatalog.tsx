import React, { memo, useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react';
import { ChevronDown, Search, ShieldCheck, Sparkles, Truck, SlidersHorizontal, X } from 'lucide-react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { useGame } from '../context/GameContext';
import { useSound } from '../context/SoundContext';
import { getBoxTags, normalizeBoxTag } from '../utils/boxTags';
import { PRICE_UNIT_MODE, toCoins } from '../utils/coins';
import { CoinAmount } from './CoinAmount';
import { SkeletonTile } from '../src/ui/skeleton/Skeleton';
import { BlurImage } from '../src/ui/images/BlurImage';
import { usePerformanceMode } from '../src/lib/performance';
import type { CaseItem, MysteryBox } from '../types';

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

type CatalogItemPreview = Pick<CaseItem, 'id' | 'name' | 'image'>;

type CatalogBoxModel = {
  box: MysteryBox;
  id: string;
  name: string;
  searchName: string;
  priceCoins: number;
  createdAt?: number;
  tags: string[];
  primaryTag: string | null;
  tagClass: string;
  featuredScore: number;
  trendingScore: number;
  topItemPreviews: CatalogItemPreview[];
};

const getTopItemPreviews = (items: CaseItem[]): CatalogItemPreview[] =>
  [...items]
    .sort((a, b) => b.price - a.price)
    .slice(0, 3)
    .map((item) => ({ id: item.id, name: item.name, image: item.image }));

const getCatalogScores = (box: MysteryBox, tags: string[]) => {
  const topPrices = [...box.items].sort((a, b) => b.price - a.price).slice(0, 3);
  const itemValue = topPrices.reduce((sum, item) => sum + item.price, 0);
  const topItem = topPrices[0]?.price ?? 0;
  const rarityDepth = box.items.filter((item) => item.rarity === 'legendary' || item.rarity === 'epic').length;
  const freshness = box.createdAt ?? 0;
  const tagBonusTrending = tags.includes('trending') ? 400_000 : 0;
  const tagBonusFeatured = tags.includes('featured') ? 250_000 : 0;

  return {
    trendingScore: itemValue + freshness / 1000 + tagBonusTrending,
    featuredScore: topItem + rarityDepth * 5_000 + tagBonusFeatured
  };
};

const createCatalogModel = (box: MysteryBox): CatalogBoxModel => {
  const tags = getBoxTags(box);
  const primaryTag = tags.find((tag) => TAG_STYLES[tag]) ?? null;
  const scores = getCatalogScores(box, tags);

  return {
    box,
    id: box.id,
    name: box.name,
    searchName: box.name.toLowerCase(),
    priceCoins: getBoxPrice(box),
    createdAt: box.createdAt,
    tags,
    primaryTag,
    tagClass: primaryTag ? (TAG_STYLES[primaryTag] ?? 'bg-slate-600 text-white') : '',
    topItemPreviews: getTopItemPreviews(box.items),
    ...scores
  };
};

const CatalogBoxCard = memo(({ model, index, staticImages, onOpen }: {
  model: CatalogBoxModel;
  index: number;
  staticImages: boolean;
  onOpen: (boxId: string) => void;
}) => {
  const { box, primaryTag, tagClass } = model;
  const isPriority = index < 4;

  return (
    <button
      type="button"
      onClick={() => onOpen(box.id)}
      className="group flex w-full flex-col overflow-hidden rounded-xl border border-white/10 bg-[#20262b] p-2 text-left shadow-[0_18px_42px_-32px_rgba(0,0,0,0.85)] transition hover:-translate-y-0.5 hover:border-slate-300/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300/60 [content-visibility:auto] [contain-intrinsic-size:240px] sm:rounded-2xl sm:p-3"
    >
      <div className="relative">
        {primaryTag && (
          <span className={`absolute left-0 top-0 z-10 rounded-md px-2 py-1 text-[10px] font-extrabold uppercase leading-none tracking-wide shadow-lg ${tagClass}`}>{primaryTag}</span>
        )}
        <div className="mx-auto aspect-[1.35] w-full">
          <BlurImage
            src={box.image}
            fallbackSrc="/android-chrome-512x512.png"
            alt={box.name}
            loading={isPriority ? 'eager' : 'lazy'}
            fetchPriority={isPriority ? 'high' : 'low'}
            decoding="async"
            width={360}
            height={230}
            ratioClassName="h-full w-full"
            className="h-full w-full object-contain drop-shadow-[0_18px_20px_rgba(0,0,0,0.45)] transition duration-300 group-hover:scale-105"
            staticRender={staticImages}
            retryOnError={!staticImages}
          />
        </div>
      </div>
      <div className="flex flex-1 flex-col px-0.5 pb-0.5 pt-1.5 sm:px-1">
        <div className="line-clamp-1 text-[15px] font-bold leading-tight text-slate-100 sm:text-base">{box.name}</div>
        <span className="mt-2.5 inline-flex min-h-9 w-full items-center justify-center rounded-md bg-gradient-to-r from-[#7c3cff] to-[#5f2eea] px-3 py-2 text-sm font-extrabold text-white shadow-[0_10px_24px_-14px_rgba(124,72,255,0.95)] transition group-hover:brightness-110 sm:mt-3">
          <CoinAmount amount={Math.round(model.priceCoins)} formatOptions={{ maximumFractionDigits: 0 }} className="justify-center text-sm font-extrabold text-white" iconClassName="h-4 w-4" />
        </span>
      </div>
    </button>
  );
});
CatalogBoxCard.displayName = 'CatalogBoxCard';

const getSortedBoxes = (boxes: CatalogBoxModel[], sortOption: SortOption) => {
  const sorted = [...boxes];

  sorted.sort((left, right) => {
    switch (sortOption) {
      case 'price-asc':
        return left.priceCoins - right.priceCoins || left.name.localeCompare(right.name);
      case 'price-desc':
        return right.priceCoins - left.priceCoins || left.name.localeCompare(right.name);
      case 'newest':
        return (right.createdAt ?? 0) - (left.createdAt ?? 0) || left.name.localeCompare(right.name);
      case 'trending':
        return right.trendingScore - left.trendingScore || left.name.localeCompare(right.name);
      case 'featured':
      default:
        return right.featuredScore - left.featuredScore || right.trendingScore - left.trendingScore || left.name.localeCompare(right.name);
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
  const { boxes, setView, stripeSettings, balance, user, isAuthenticated } = useGame();
  const { playSound } = useSound();
  const performanceMode = usePerformanceMode();
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOption, setSortOption] = useState<SortOption>('featured');
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);
  const [showAffordableOnly, setShowAffordableOnly] = useState(false);
  const [showHowItWorksModal, setShowHowItWorksModal] = useState(false);
  const [isHowItWorksAnimatingIn, setIsHowItWorksAnimatingIn] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const [visibleBoxCount, setVisibleBoxCount] = useState(() => (typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches ? 12 : 30));
  const CATEGORY_ORDER = ['all', 'pokemon', 'tech', 'sneakers', 'streetwear', 'collectibles', 'gaming'];
  const HOW_IT_WORKS_LOCAL_KEY = 'pullz:boxCatalogHowItWorksDismissed';
  const HOW_IT_WORKS_SESSION_KEY = 'pullz:boxCatalogHowItWorksShownThisSession';

  const hasActiveFilters =
    activeCategory !== 'all' ||
    searchQuery.trim().length > 0;

  const catalogModels = useMemo(
    () => boxes
      .filter((box) => !box.isDaily && !box.isUserCreated && !box.isPullPassBox && !(box.currencyType === 'XP' || Number(box.priceXP ?? 0) > 0))
      .map(createCatalogModel),
    [boxes]
  );

  const isLoadingBoxes = boxes.length === 0;

  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    catalogModels.forEach((model) => {
      model.tags.forEach((tag) => {
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
  }, [catalogModels, stripeSettings.boxTagIcons]);

  const deferredSearchQuery = useDeferredValue(searchQuery);
  const normalizedSearchQuery = deferredSearchQuery.toLowerCase().trim();

  const filteredBoxes = useMemo(() => {
    return catalogModels.filter((model) => {
      const matchesCategory = activeCategory === 'all' || model.tags.includes(normalizeBoxTag(activeCategory));
      const matchesSearch = model.searchName.includes(normalizedSearchQuery);
      const matchesAffordability = !showAffordableOnly || model.priceCoins <= balance;
      return matchesCategory && matchesSearch && matchesAffordability;
    });
  }, [activeCategory, balance, catalogModels, normalizedSearchQuery, showAffordableOnly]);

  const sortedFilteredBoxes = useMemo(() => getSortedBoxes(filteredBoxes, sortOption), [filteredBoxes, sortOption]);

  const groupedBoxes = useMemo(() => sortedFilteredBoxes, [sortedFilteredBoxes]);
  const visibleBoxes = useMemo(() => groupedBoxes.slice(0, visibleBoxCount), [groupedBoxes, visibleBoxCount]);
  const hasMoreBoxes = visibleBoxCount < groupedBoxes.length;
  const staticCatalogImages = performanceMode.isMobile || performanceMode.isLowPower;

  useEffect(() => {
    setVisibleBoxCount(performanceMode.isMobile ? 12 : 30);
  }, [activeCategory, normalizedSearchQuery, performanceMode.isMobile, showAffordableOnly, sortOption]);

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
    if (typeof window === 'undefined') return;
    if (!isAuthenticated) return;

    const localDismissed = window.localStorage.getItem(HOW_IT_WORKS_LOCAL_KEY) === '1';
    const sessionShown = window.sessionStorage.getItem(HOW_IT_WORKS_SESSION_KEY) === '1';
    if (localDismissed || sessionShown) return;

    const resolvedUserId =
      ((user as { id?: string; uid?: string } | null | undefined)?.id ?? (user as { id?: string; uid?: string } | null | undefined)?.uid ?? auth.currentUser?.uid)?.trim?.() ?? '';

    if (!resolvedUserId) return;

    let cancelled = false;
    let idleId: number | null = null;
    let timeoutId: ReturnType<typeof globalThis.setTimeout> | null = null;
    const loadPreference = async () => {
      try {
        const userSnap = await getDoc(doc(db, 'users', resolvedUserId));
        const dismissed = userSnap.data()?.dismissedBoxCatalogHowItWorks === true;
        if (dismissed) {
          window.localStorage.setItem(HOW_IT_WORKS_LOCAL_KEY, '1');
          return;
        }
      } catch (error) {
        console.warn('Failed to load BoxCatalog How Pullz Works preference.', error);
      }

      if (!cancelled) {
        window.sessionStorage.setItem(HOW_IT_WORKS_SESSION_KEY, '1');
        setShowHowItWorksModal(true);
      }
    };

    const start = () => { void loadPreference(); };
    if ('requestIdleCallback' in window) idleId = window.requestIdleCallback(start, { timeout: 2800 }) as unknown as number;
    else timeoutId = globalThis.setTimeout(start, 1600);

    return () => {
      cancelled = true;
      if (idleId !== null && 'cancelIdleCallback' in window) window.cancelIdleCallback(idleId);
      if (timeoutId !== null) globalThis.clearTimeout(timeoutId);
    };
  }, [isAuthenticated, user]);

  const closeHowItWorksModal = async () => {
    const resolvedUserId =
      ((user as { id?: string; uid?: string } | null | undefined)?.id ?? (user as { id?: string; uid?: string } | null | undefined)?.uid ?? auth.currentUser?.uid)?.trim?.() ?? '';

    if (dontShowAgain) {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(HOW_IT_WORKS_LOCAL_KEY, '1');
      }
      if (resolvedUserId) {
        try {
          await setDoc(doc(db, 'users', resolvedUserId), { dismissedBoxCatalogHowItWorks: true }, { merge: true });
        } catch (error) {
          console.warn('Failed to save BoxCatalog How Pullz Works preference.', error);
        }
      }
    }
    setIsHowItWorksAnimatingIn(false);
    setShowHowItWorksModal(false);
  };

  useEffect(() => {
    if (!showHowItWorksModal) {
      setIsHowItWorksAnimatingIn(false);
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      setIsHowItWorksAnimatingIn(true);
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [showHowItWorksModal]);

  const clearFilters = useCallback(() => {
    setActiveCategory('all');
    setSearchQuery('');
    setSortOption('featured');
  }, []);

  const openBox = useCallback((boxId: string) => {
    playSound('click');
    setView({ type: 'CASE_OPENING', boxId });
  }, [playSound, setView]);

  return (
    <div className="w-full bg-[#1b2024] pb-20 text-white">
      {showHowItWorksModal && (
        <div
          className={`fixed inset-0 z-[120] flex items-end justify-center px-3 pb-3 pt-8 transition-colors duration-300 sm:items-center sm:px-5 sm:pb-5 ${
            isHowItWorksAnimatingIn ? 'bg-black/65' : 'bg-black/0'
          }`}
        >
          <div
            className={`w-full max-w-2xl rounded-2xl border border-white/15 bg-gradient-to-b from-[#111821] to-[#0b1118] p-4 shadow-2xl transition-all duration-300 sm:rounded-3xl sm:p-6 ${
              isHowItWorksAnimatingIn
                ? 'translate-y-0 opacity-100'
                : 'translate-y-10 opacity-0 sm:translate-y-14'
            }`}
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#7d8faf]">Welcome</p>
                <h2 className="mt-1 text-xl font-bold text-white sm:text-2xl">How Pullz Works</h2>
              </div>
              <button
                type="button"
                onClick={() => void closeHowItWorksModal()}
                aria-label="Close how it works modal"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/5 text-slate-300 transition hover:bg-white/10 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-sm text-slate-300 sm:text-base">
              Open boxes. Win real items. Keep them or sell back instantly.
            </p>
            <div className="mt-5 space-y-3">
              {[
                ['1', 'Pick a box', 'Browse boxes by category and choose one that fits your budget.'],
                ['2', 'Open with coins', 'Use coins to open. Every result is generated fairly.'],
                ['3', 'Keep or sell back', 'Keep your item for shipping, or sell it back for instant coins.']
              ].map(([step, title, description]) => (
                <div key={step} className="rounded-xl border border-white/10 bg-white/[0.03] p-3 sm:p-3.5">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#2b7bff] to-[#6f4bff] text-xs font-bold text-white">
                      {step}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">{title}</p>
                      <p className="mt-0.5 text-xs text-slate-300 sm:text-sm">{description}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-5 text-center text-xs font-medium text-slate-300 sm:text-sm">
              Provably fair • Real items • Secure checkout
            </p>
            <label className="mt-4 inline-flex items-center gap-2 text-xs font-medium text-slate-300 sm:text-sm">
              <input
                type="checkbox"
                checked={dontShowAgain}
                onChange={(event) => setDontShowAgain(event.target.checked)}
                className="h-4 w-4 rounded border-white/30 bg-transparent text-[#4e86ff] focus:ring-[#4e86ff]"
              />
              Don&apos;t show this again
            </label>
            <div className="mt-5 flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => void closeHowItWorksModal()}
                className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-semibold text-slate-100 transition hover:bg-white/10 sm:w-auto"
              >
                Learn more
              </button>
              <button
                type="button"
                onClick={() => void closeHowItWorksModal()}
                className="w-full rounded-xl bg-gradient-to-r from-[#2d73ff] to-[#5f42ff] px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-110 sm:w-auto"
              >
                Start browsing
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="relative mx-auto max-w-[1320px] px-4 pb-4 pt-5 sm:px-5 sm:pt-8">
        <div className="relative min-h-[230px] overflow-hidden rounded-2xl border border-violet-300/20 bg-[#160b3d] px-4 py-5 shadow-[0_24px_70px_-42px_rgba(95,47,255,0.95)] sm:min-h-[280px] sm:rounded-3xl sm:px-6 sm:py-7 lg:px-8">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_16%_10%,rgba(255,255,255,0.16),transparent_18%),radial-gradient(circle_at_78%_20%,rgba(250,204,21,0.22),transparent_16%),linear-gradient(105deg,rgba(48,16,119,0.98)_0%,rgba(66,24,143,0.92)_42%,rgba(16,10,35,0.88)_100%)]" />
          <div className="pointer-events-none absolute inset-0 opacity-35 [background-image:linear-gradient(rgba(255,255,255,0.07)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.07)_1px,transparent_1px)] [background-size:34px_34px]" />
          <div className="pointer-events-none absolute -left-10 -top-10 h-36 w-36 rounded-full border border-white/10 bg-white/5 blur-[1px] sm:h-44 sm:w-44" />
          <div className="pointer-events-none absolute right-[6%] top-5 h-14 w-14 rounded-full border border-yellow-300/30 bg-yellow-300/10 shadow-[0_0_40px_rgba(250,204,21,0.22)] sm:h-20 sm:w-20" />
          <div className="pointer-events-none absolute bottom-5 right-[34%] hidden h-10 w-10 rotate-12 rounded-lg border border-white/10 bg-white/5 sm:block" />
          {stripeSettings.boxCatalogHeroImageUrl ? (
            <img
              src={stripeSettings.boxCatalogHeroImageUrl}
              alt="Box catalog hero"
              className="pointer-events-none absolute bottom-0 right-[-44px] z-0 h-[150px] w-[250px] object-contain opacity-55 drop-shadow-[0_24px_34px_rgba(0,0,0,0.55)] sm:right-2 sm:h-[255px] sm:w-[420px] sm:opacity-95 lg:right-10 lg:h-[290px] lg:w-[500px]"
              loading="eager"
              fetchPriority="high"
              decoding="async"
              width={500}
              height={290}
            />
          ) : null}
          <div className="relative z-10 max-w-[21rem] sm:max-w-xl">
            <p className="mb-2 text-[10px] font-extrabold uppercase tracking-[0.26em] text-yellow-300/90 sm:text-xs">Pullz catalog</p>
            <h1 className="text-[2.35rem] font-black leading-[0.92] tracking-tight text-white sm:text-6xl lg:text-7xl">
              Where Big Pulls Turn Into <span className="text-yellow-300">Bigger Wins</span>
            </h1>
            <p className="mt-3 max-w-md text-xs font-medium leading-5 text-violet-100/85 sm:mt-4 sm:text-base sm:leading-7">
              Open premium mystery boxes and chase real collectibles, tech, sneakers, slabs, and more.
            </p>
            <div className="mt-4 flex flex-wrap gap-2 sm:mt-5 sm:gap-2.5">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-black/25 px-3 py-1.5 text-[11px] font-bold text-white backdrop-blur">
                <ShieldCheck className="h-3.5 w-3.5 text-yellow-300" />
                Provably Fair
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-black/25 px-3 py-1.5 text-[11px] font-bold text-white backdrop-blur">
                <Sparkles className="h-3.5 w-3.5 text-yellow-300" />
                Real Items
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-black/25 px-3 py-1.5 text-[11px] font-bold text-white backdrop-blur">
                <Truck className="h-3.5 w-3.5 text-yellow-300" />
                Fast Shipping
              </span>
            </div>
          </div>
        </div>
      </div>

      <div id="box-catalog-controls" className="relative z-30 w-full bg-[#1b2024]">
        <div className="mx-auto max-w-[1320px] px-4 py-3 sm:px-5">
          <div className="mb-3 flex w-full items-center gap-3 sm:mb-2 sm:max-w-[920px]">
              <div className="flex min-w-0 flex-1 items-center rounded-2xl border border-white/10 bg-[#151d26] px-3 py-3.5 shadow-inner shadow-black/20">
                <Search className="h-4 w-4 shrink-0 text-[#5f6f95]" />
                <input type="text" placeholder="Search boxes..." className="w-full bg-transparent pl-2 text-sm text-white placeholder-slate-500 outline-none" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
              </div>
              <div className="relative sm:hidden">
                <button
                  type="button"
                  onClick={() => setIsMobileFilterOpen((prev) => !prev)}
                  className="inline-flex h-[52px] w-[52px] items-center justify-center rounded-2xl border border-white/10 bg-[#151d26] text-slate-200"
                  aria-label="Filter and sort options"
                >
                  <SlidersHorizontal className="h-[18px] w-[18px]" />
                </button>
                {isMobileFilterOpen && (
                  <div className="absolute right-0 top-12 z-50 w-48 rounded-xl border border-white/10 bg-[#1b2432] p-2 shadow-xl">
                    <label className="relative block">
                      <select value={sortOption} onChange={(event) => { setSortOption(event.target.value as SortOption); setIsMobileFilterOpen(false); }} className="h-10 w-full appearance-none rounded-lg border border-white/10 bg-[#20262b] px-3 pr-8 text-sm font-semibold text-white outline-none">
                        {SORT_OPTIONS.map((option) => <option key={option.id} value={option.id}>{`Sort: ${option.label}`}</option>)}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#7a87a8]" />
                    </label>
                  </div>
                )}
              </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-[#20262b] p-2 sm:flex sm:items-center sm:gap-2">
            <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto scrollbar-hide pb-2 sm:pb-0">
            {CATEGORY_ORDER.map((id) => {
              const cat = id === 'all' ? { id: 'all', title: 'All' } : categories.find((entry) => entry.id === id);
              if (!cat) return null;
              const isActive = activeCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={`flex items-center justify-center whitespace-nowrap rounded-full border px-4 py-2.5 text-xs font-bold transition ${
                    isActive
                      ? 'border-slate-400/20 bg-slate-500/25 text-white'
                      : 'border-white/10 bg-[#151b21] text-slate-300 hover:border-white/20 hover:text-white'
                  }`}
                >
                  {cat.id !== 'all' && cat.iconClass && isCategoryIconUrl(cat.iconClass) ? (
                    <>
                      <img
                        src={cat.iconClass}
                        alt={cat.title}
                        className="h-4 w-4 shrink-0 object-contain"
                        loading="lazy"
                        decoding="async"
                      />
                      <span>{cat.title}</span>
                    </>
                  ) : <span>{cat.title}</span>}
                </button>
              );
            })}
            </div>
            <label className="inline-flex h-9 w-full shrink-0 items-center justify-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 text-xs font-semibold text-slate-200 sm:w-auto sm:justify-start">
              <span className={`relative inline-flex h-6 w-10 items-center rounded-full border transition ${showAffordableOnly ? 'border-slate-300/50 bg-slate-400/30' : 'border-white/15 bg-white/10'}`}>
                <input
                  type="checkbox"
                  checked={showAffordableOnly}
                  onChange={(event) => setShowAffordableOnly(event.target.checked)}
                  className="peer sr-only"
                />
                <span className={`absolute h-[18px] w-[18px] rounded-full bg-white transition ${showAffordableOnly ? 'translate-x-[18px]' : 'translate-x-1'}`} />
              </span>
              Enough coins
            </label>
            <label className="relative mt-2 block sm:mt-0 sm:ml-auto sm:min-w-[190px]">
              <select value={sortOption} onChange={(event) => setSortOption(event.target.value as SortOption)} className="h-11 w-full appearance-none rounded-xl border border-white/10 bg-[#151d26] px-3 pr-9 text-sm font-bold text-white outline-none">
                {SORT_OPTIONS.map((option) => <option key={option.id} value={option.id}>{`Sort: ${option.label}`}</option>)}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#7a87a8]" />
            </label>
          </div>
        </div>
      </div>

      <div className="mx-auto min-h-[100dvh] w-full max-w-[1320px] px-4 py-2 sm:px-5 sm:py-5">
        <div className="flex flex-col gap-6">
          {isLoadingBoxes && (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-5">
              {Array.from({ length: 10 }).map((_, idx) => <SkeletonTile key={`box-skeleton-${idx}`} />)}
            </div>
          )}

          {!isLoadingBoxes && (
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4 xl:grid-cols-5">
              {visibleBoxes.map((model, index) => (
                <CatalogBoxCard
                  key={model.id}
                  model={model}
                  index={index}
                  staticImages={staticCatalogImages}
                  onOpen={openBox}
                />
              ))}
            </div>
          )}
          {!isLoadingBoxes && hasMoreBoxes && groupedBoxes.length > 0 && (
            <div className="flex justify-center pt-1">
              <button
                type="button"
                onClick={() => setVisibleBoxCount((count) => count + (performanceMode.isMobile ? 10 : 20))}
                className="min-h-11 rounded-xl border border-white/10 bg-white/[0.04] px-5 py-2.5 text-sm font-bold text-white transition hover:border-white/20 hover:bg-white/[0.08] active:scale-[0.98]"
              >
                Load more boxes
              </button>
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
