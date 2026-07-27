import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { Check, ListFilter, Search, X } from 'lucide-react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { useAuth, useBoxes, useUI, useWallet } from '../context/GameContext';
import { getBoxSummaryPage } from '../utils/boxRepository';
import type { QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';
import { useSound } from '../context/SoundContext';
import { getBoxTags, normalizeBoxTag, sanitizeFontAwesomeClass } from '../utils/boxTags';
import { PRICE_UNIT_MODE, toCoins } from '../utils/coins';
import { CoinAmount } from './CoinAmount';
import { SkeletonTile } from '../src/ui/skeleton/Skeleton';
import { BlurImage } from '../src/ui/images/BlurImage';
import { usePerformanceMode } from '../src/lib/performance';
import { useIntentPrefetch } from '../src/lib/prefetch/useIntentPrefetch';
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

const getBoxPrice = (box: MysteryBox) => toCoins(box.price, PRICE_UNIT_MODE);

const normalizeSearchText = (value: string) => value
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

type CatalogItemPreview = Pick<CaseItem, 'id' | 'name' | 'image'>;

type CatalogBoxModel = {
  box: MysteryBox;
  id: string;
  name: string;
  searchTerms: string;
  priceCoins: number;
  createdAt?: number;
  tags: string[];
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
  const scores = getCatalogScores(box, tags);

  return {
    box,
    id: box.id,
    name: box.name,
    // Search the information a visitor can use to identify a box, not just its
    // title. This makes queries such as a card name, set, or category useful.
    searchTerms: normalizeSearchText([box.name, ...tags, ...box.items.map((item) => item.name)].join(' ')),
    priceCoins: getBoxPrice(box),
    createdAt: box.createdAt,
    tags,
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
  const { box } = model;
  const isPriority = index < 4;
  const prefetchHandlers = useIntentPrefetch(box.id, async () => box, box.image);

  return (
    <button
      type="button"
      onClick={() => onOpen(box.id)}
      onMouseEnter={prefetchHandlers.onMouseEnter}
      onTouchStart={prefetchHandlers.onTouchStart}
      onFocus={prefetchHandlers.onFocus}
      className="group relative w-full overflow-hidden rounded-[22px] border border-white/10 bg-[#121318] text-left shadow-[0_14px_30px_rgba(0,0,0,0.3)] transition hover:-translate-y-1 hover:border-violet-300/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 [content-visibility:auto] [contain-intrinsic-size:260px]"
    >
      <div className="relative h-[164px] overflow-hidden bg-[radial-gradient(circle_at_50%_20%,rgba(139,92,246,0.18),transparent_48%),#090a0e] px-3 pt-4 sm:h-[180px]">
        <div className="absolute inset-0 bg-[linear-gradient(135deg,transparent_35%,rgba(255,255,255,0.06),transparent_62%)]" />
        <div className="absolute inset-0 flex flex-col items-center justify-center px-3">
          <BlurImage
            src={box.image}
            fallbackSrc="/assets/favicon/android-chrome-512.png"
            alt={box.name}
            loading={isPriority ? 'eager' : 'lazy'}
            fetchPriority={isPriority ? 'high' : 'low'}
            decoding="async"
            width={360}
            height={230}
            ratioClassName="h-[132px] w-full sm:h-[148px]"
            className="h-full w-full object-contain drop-shadow-[0_16px_20px_rgba(0,0,0,0.55)] transition duration-300 group-hover:scale-105"
            staticRender={staticImages}
            retryOnError={!staticImages}
          />
        </div>
      </div>
      <div className="border-t border-white/10 px-3 pb-3 pt-2.5">
        <div className="line-clamp-1 text-[13px] font-black uppercase tracking-tight text-white sm:text-sm">{box.name}</div>
        <CoinAmount amount={Math.round(model.priceCoins)} formatOptions={{ maximumFractionDigits: 0 }} className="mt-1 justify-start text-[13px] font-black text-[#c4b5fd]" iconClassName="h-3.5 w-3.5" />
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
  const { setView } = useUI();
  const { stripeSettings } = useBoxes();
  const { user, isAuthenticated } = useAuth();
  const { balance } = useWallet();
  const [boxes, setBoxes] = useState<MysteryBox[]>([]);
  const [catalogCursor, setCatalogCursor] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [catalogEnd, setCatalogEnd] = useState(false);
  const catalogRequestRef = React.useRef(0);
  const { playSound } = useSound();
  const performanceMode = usePerformanceMode();
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOption, setSortOption] = useState<SortOption>('featured');
  const [isSortOpen, setIsSortOpen] = useState(false);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [showAffordableOnly, setShowAffordableOnly] = useState(false);
  const [showHowItWorksModal, setShowHowItWorksModal] = useState(false);
  const [isHowItWorksAnimatingIn, setIsHowItWorksAnimatingIn] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const [visibleBoxCount, setVisibleBoxCount] = useState(() => (typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches ? 12 : 30));
  useEffect(() => {
    let active = true; const requestId = ++catalogRequestRef.current;
    setCatalogLoading(true); setCatalogError(null); setCatalogEnd(false); setCatalogCursor(null);
    void getBoxSummaryPage(performanceMode.isMobile ? 12 : 24).then((page) => {
      if (!active || requestId !== catalogRequestRef.current) return;
      setBoxes(page.boxes); setCatalogCursor(page.cursor); setCatalogEnd(!page.hasMore);
    }).catch(() => { if (active) setCatalogError('Unable to load boxes. Please retry.'); }).finally(() => { if (active) setCatalogLoading(false); });
    return () => { active = false; };
  }, [performanceMode.isMobile]);
  const loadMoreCatalog = () => {
    if (catalogLoading || catalogEnd || !catalogCursor) return;
    setCatalogLoading(true); setCatalogError(null);
    void getBoxSummaryPage(performanceMode.isMobile ? 12 : 24, catalogCursor).then((page) => {
      setBoxes((current) => Array.from(new Map([...current, ...page.boxes].map((box) => [box.id, box])).values()));
      setCatalogCursor(page.cursor); setCatalogEnd(!page.hasMore);
    }).catch(() => setCatalogError('Unable to load more boxes. Please retry.')).finally(() => setCatalogLoading(false));
  };
  const CATEGORY_ORDER = ['all', 'pokemon', 'tech', 'sneakers', 'streetwear', 'collectibles', 'gaming'];
  const HOW_IT_WORKS_LOCAL_KEY = 'pullz:boxCatalogHowItWorksDismissed';
  const HOW_IT_WORKS_SESSION_KEY = 'pullz:boxCatalogHowItWorksShownThisSession';

  const hasActiveFilters =
    activeCategory !== 'all' ||
    searchQuery.trim().length > 0 ||
    showAffordableOnly;

  const catalogModels = useMemo(
    () => boxes
      .filter((box) => !box.isDaily && !box.isUserCreated && !box.isPullPassBox && !(box.currencyType === 'XP' || Number(box.priceXP ?? 0) > 0))
      .map(createCatalogModel),
    [boxes]
  );

  const isLoadingBoxes = catalogLoading && boxes.length === 0;

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
        title: stripeSettings.boxTagLabels[id] || id
          .split(/[-_\s]+/)
          .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
          .join(' '),
        iconClass: stripeSettings.boxTagIcons[id] ?? '',
        count
      }))
      .sort((a, b) => b.count - a.count || a.title.localeCompare(b.title));
  }, [catalogModels, stripeSettings.boxTagIcons, stripeSettings.boxTagLabels]);

  // Filter from the controlled input value directly. Deferring this value made
  // the visible catalog lag behind what a visitor had typed.
  const normalizedSearchQuery = normalizeSearchText(searchQuery);

  const filteredBoxes = useMemo(() => {
    return catalogModels.filter((model) => {
      const matchesCategory = activeCategory === 'all' || model.tags.includes(normalizeBoxTag(activeCategory));
      const matchesSearch = !normalizedSearchQuery || model.searchTerms.includes(normalizedSearchQuery);
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

  useEffect(() => {
    if (!isSortOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsSortOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isSortOpen]);

  // The bottom nav competes with the mobile keyboard and sort sheet. Suppress
  // it for the duration of either interaction and always restore it on exit.
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const filtersAreBeingSelected = isSearchFocused || isSortOpen;
    window.dispatchEvent(new CustomEvent('pullz:mobile-bottom-nav-visibility', {
      detail: { hidden: filtersAreBeingSelected }
    }));

    return () => {
      window.dispatchEvent(new CustomEvent('pullz:mobile-bottom-nav-visibility', {
        detail: { hidden: false }
      }));
    };
  }, [isSearchFocused, isSortOpen]);

  const clearFilters = useCallback(() => {
    setActiveCategory('all');
    setSearchQuery('');
    setSortOption('featured');
    setShowAffordableOnly(false);
  }, []);

  const openBox = useCallback((boxId: string) => {
    playSound('click');
    setView({ type: 'CASE_OPENING', boxId });
  }, [playSound, setView]);

  return (
    <div className="w-full bg-[radial-gradient(circle_at_68%_10%,rgba(92,50,255,0.20),transparent_24rem),radial-gradient(circle_at_28%_35%,rgba(28,119,255,0.10),transparent_30rem),#05060a] pb-20 text-white">
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
      <div className="pullz-boxes-hero-shell mx-auto max-w-[1880px] px-3 pb-5 pt-4 sm:px-5 sm:pt-7 lg:px-8">
        <section className="pullz-boxes-hero" aria-labelledby="boxes-hero-title">
          <div className="pullz-boxes-hero-copy">
            <h1 id="boxes-hero-title">Open. Pull.<br /><span>Collect.</span></h1>
          </div>

          <div className="pullz-boxes-hero-art" aria-label="Featured graded collectible cards">
            <div className="pullz-boxes-hero-orbit" />
            <img className="pullz-boxes-slab pullz-boxes-slab-left" src="https://firebasestorage.googleapis.com/v0/b/hyperdrop-6476c.firebasestorage.app/o/heroimg%2FUntitled%20design.svg?alt=media&token=9d00502f-9317-4880-87aa-7da6fe392b45" alt="" aria-hidden="true" loading="eager" decoding="async" />
            <img className="pullz-boxes-slab pullz-boxes-slab-center" src="https://firebasestorage.googleapis.com/v0/b/hyperdrop-6476c.firebasestorage.app/o/heroimg%2FUntitled%20design%20(2).svg?alt=media&token=0bc8a362-65f2-4fc0-84da-2ccefabb8294" alt="Featured graded collectible card" loading="eager" fetchPriority="high" decoding="async" />
            <img className="pullz-boxes-slab pullz-boxes-slab-right" src="https://firebasestorage.googleapis.com/v0/b/hyperdrop-6476c.firebasestorage.app/o/heroimg%2FUntitled%20design%20(1).svg?alt=media&token=6fcb9e37-025c-4ac8-a20d-ec3cf2fad353" alt="" aria-hidden="true" loading="eager" decoding="async" />
            <div className="pullz-boxes-hero-platform" />
            <span className="pullz-boxes-particle pullz-boxes-particle-1" />
            <span className="pullz-boxes-particle pullz-boxes-particle-2" />
            <span className="pullz-boxes-particle pullz-boxes-particle-3" />
            <span className="pullz-boxes-particle pullz-boxes-particle-4" />
          </div>
        </section>
      </div>

      <div className="sticky top-[var(--pullz-header-height,70px)] z-40 w-full border-y border-[#24242c] bg-[#0a0a0d]/95 backdrop-blur">
        <div className="mx-auto max-w-[1320px] px-4 py-4 sm:px-5">
          <div className="relative mb-3">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-[#7a7a88]" />
            <input
              type="search"
              placeholder="Search Charizard, Base Set, ETB..."
              className="h-[50px] w-full rounded-[14px] border border-[#24242c] bg-[#131318] py-3 pl-11 pr-11 text-base text-[#f2f2f5] placeholder:text-[#7a7a88] outline-none transition focus:border-[#5b6bf5] focus:ring-1 focus:ring-[#5b6bf5]"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => setIsSearchFocused(false)}
              aria-label="Search boxes"
            />
            {searchQuery && <button type="button" onClick={() => setSearchQuery('')} className="absolute right-2 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-[#7a7a88] transition hover:bg-white/5 hover:text-[#f2f2f5]" aria-label="Clear search"><X className="h-[18px] w-[18px]" /></button>}
          </div>
          <div className="scrollbar-hide flex items-center gap-2 overflow-x-auto pb-0.5">
            <button type="button" onClick={() => setIsSortOpen(true)} className="flex aspect-square w-[72px] shrink-0 flex-col items-center justify-center gap-1.5 rounded-md border border-[#24242c] bg-[#131318] p-1.5 text-center text-[#c8c8d2] transition hover:border-[#3a3a44] hover:text-[#f2f2f5] sm:w-[84px] sm:p-2" aria-label="Sort boxes" aria-haspopup="dialog" aria-expanded={isSortOpen}>
              <ListFilter className="h-6 w-6 text-[#9a9aa8] sm:h-7 sm:w-7" aria-hidden="true" />
              <span className="w-full truncate text-[10px] font-semibold leading-tight sm:text-[11px]">
                {SORT_OPTIONS.find((option) => option.id === sortOption)?.label ?? 'Featured'}
              </span>
            </button>
            <span className="h-[22px] w-px shrink-0 bg-[#24242c]" aria-hidden="true" />
            <div className="flex shrink-0 items-start gap-2">
            {[...CATEGORY_ORDER, ...categories.map((category) => category.id).filter((id) => !CATEGORY_ORDER.includes(id))].map((id) => {
              const cat = id === 'all' ? { id: 'all', title: 'All' } : categories.find((entry) => entry.id === id);
              if (!cat) return null;
              const isActive = activeCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={`flex aspect-square w-[72px] shrink-0 flex-col items-center justify-center gap-1.5 rounded-md border p-1.5 text-center transition sm:w-[84px] sm:p-2 ${
                    isActive
                      ? 'border-[#5b6bf5] bg-[#5b6bf5] text-[#f5f6ff]'
                      : 'border-[#24242c] bg-[#131318] text-[#c8c8d2] hover:border-[#3a3a44] hover:text-[#f2f2f5]'
                  }`}
                >
                  {cat.id !== 'all' && cat.iconClass && isCategoryIconUrl(cat.iconClass) ? (
                    <>
                      <img
                        src={cat.iconClass}
                        alt={cat.title}
                        className="h-9 w-9 shrink-0 object-contain sm:h-11 sm:w-11"
                        loading="lazy"
                        decoding="async"
                      />
                      <span className="w-full truncate text-[10px] font-semibold leading-tight sm:text-[11px]">{cat.title}</span>
                    </>
                  ) : cat.id !== 'all' && cat.iconClass ? (
                    <>
                      <i aria-hidden="true" className={`${sanitizeFontAwesomeClass(cat.iconClass)} text-2xl sm:text-3xl`} />
                      <span className="w-full truncate text-[10px] font-semibold leading-tight sm:text-[11px]">{cat.title}</span>
                    </>
                  ) : <span className="w-full truncate text-[10px] font-semibold leading-tight sm:text-[11px]">{cat.title}</span>}
                </button>
              );
            })}
            </div>
            <span className="h-[22px] w-px shrink-0 bg-[#24242c]" aria-hidden="true" />
            <button type="button" onClick={() => setShowAffordableOnly((value) => !value)} aria-pressed={showAffordableOnly} className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-4 py-2.5 text-[13.5px] font-bold transition ${showAffordableOnly ? 'border-[#5b6bf5] bg-[#5b6bf5]/15 text-[#f2f2f5]' : 'border-[#24242c] bg-[#131318] text-[#c8c8d2] hover:border-[#3a3a44]'}`}>
              <span className={`flex h-4 w-4 items-center justify-center rounded-[5px] border-[1.5px] ${showAffordableOnly ? 'border-[#5b6bf5] bg-[#5b6bf5]' : 'border-[#3a3a44]'}`}>{showAffordableOnly && <Check className="h-3 w-3 stroke-[3] text-[#0a0a0d]" />}</span>
              Enough coins
            </button>
          </div>
        </div>
      </div>

      {isSortOpen && (
        <div className="fixed inset-0 z-[110] flex items-end bg-black/55" role="presentation" onMouseDown={() => setIsSortOpen(false)}>
          <section role="dialog" aria-modal="true" aria-labelledby="sort-options-title" className="w-full rounded-t-[20px] border border-[#24242c] bg-[#131318] px-2 pb-6 pt-2 shadow-2xl sm:mx-auto sm:max-w-[480px]" onMouseDown={(event) => event.stopPropagation()}>
            <div className="mx-auto mb-3 h-1 w-9 rounded-full bg-[#2c2c34]" />
            <h2 id="sort-options-title" className="px-3 pb-3 text-[15px] font-bold text-[#f2f2f5]">Sort by</h2>
            {SORT_OPTIONS.map((option) => {
              const active = option.id === sortOption;
              return <button key={option.id} type="button" onClick={() => { setSortOption(option.id); setIsSortOpen(false); }} className={`flex w-full items-center justify-between rounded-xl px-3 py-3.5 text-left text-[15px] ${active ? 'bg-white/[0.06] font-bold text-[#5b6bf5]' : 'font-medium text-[#c8c8d2] hover:bg-white/[0.04]'}`}>
                {option.label}
                {active && <Check className="h-4 w-4 stroke-[3]" />}
              </button>;
            })}
          </section>
        </div>
      )}

      <div className="mx-auto min-h-[100dvh] w-full max-w-[1320px] px-3 py-4 sm:px-5 sm:py-5">
        <div className="flex flex-col gap-6">
          {isLoadingBoxes && (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-5">
              {Array.from({ length: 10 }).map((_, idx) => <SkeletonTile key={`box-skeleton-${idx}`} />)}
            </div>
          )}

          {!isLoadingBoxes && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
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
          {!isLoadingBoxes && !catalogEnd && groupedBoxes.length > 0 && (
            <div className="flex justify-center pt-1">
              <button
                type="button"
                onClick={loadMoreCatalog}
                disabled={catalogLoading}
                className="min-h-11 rounded-xl border border-white/10 bg-white/[0.04] px-5 py-2.5 text-sm font-bold text-white transition hover:border-white/20 hover:bg-white/[0.08] active:scale-[0.98]"
              >
                {catalogLoading ? 'Loading boxes…' : 'Load more boxes'}
              </button>
            </div>
          )}
          {catalogError && boxes.length > 0 && <div className="text-center text-sm text-red-300">{catalogError} <button type="button" onClick={loadMoreCatalog} className="underline">Retry</button></div>}
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
