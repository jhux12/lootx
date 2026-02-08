import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  addDoc,
  collection,
  DocumentData,
  getDocs,
  limit,
  orderBy,
  QueryDocumentSnapshot,
  query,
  startAfter,
  where
} from 'firebase/firestore';
import { Filter, Loader2, Search, Sparkles, Tag, X } from 'lucide-react';
import { useGame } from '../context/GameContext';
import { db } from '../firebase';
import { CaseItem, CommunityCase } from '../types';
import { CoinAmount } from '../components/CoinAmount';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';

const PAGE_SIZE = 12;

const SORT_OPTIONS = [
  { value: 'featured', label: 'Featured' },
  { value: 'newest', label: 'Newest' },
  { value: 'most-opened', label: 'Most Opened' },
  { value: 'price-low', label: 'Price: Low to High' },
  { value: 'price-high', label: 'Price: High to Low' }
];

const toMillis = (value: unknown) => {
  if (typeof value === 'number') return value;
  if (value && typeof value === 'object' && 'seconds' in value) {
    const seconds = (value as { seconds?: number }).seconds;
    if (typeof seconds === 'number') return seconds * 1000;
  }
  return 0;
};

const formatDate = (value?: number) => {
  if (!value) return 'Unknown';
  return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};

const normalizeCommunityCase = (docSnap: QueryDocumentSnapshot<DocumentData>): CommunityCase => {
  const data = docSnap.data();
  const createdAt = toMillis(data.createdAt) || Date.now();
  const updatedAt = toMillis(data.updatedAt);
  const itemsPreview = Array.isArray(data.itemsPreview)
    ? data.itemsPreview.map((item: any) => ({
        id: String(item.id ?? ''),
        name: String(item.name ?? 'Unknown'),
        value: Number(item.value ?? 0),
        image: String(item.image ?? '')
      }))
    : undefined;
  return {
    id: docSnap.id,
    name: String(data.name ?? 'Untitled Case'),
    coverImage: String(data.coverImage ?? ''),
    creatorUid: String(data.creatorUid ?? ''),
    creatorName: String(data.creatorName ?? 'Community Creator'),
    createdAt,
    updatedAt,
    status: 'published',
    isFeatured: Boolean(data.isFeatured),
    tags: Array.isArray(data.tags) ? data.tags.map((tag: any) => String(tag)) : [],
    category: data.category ? String(data.category) : undefined,
    priceCoins: Number.isFinite(Number(data.priceCoins)) ? Number(data.priceCoins) : undefined,
    ev: Number.isFinite(Number(data.ev)) ? Number(data.ev) : undefined,
    itemCount: Number.isFinite(Number(data.itemCount)) ? Number(data.itemCount) : itemsPreview?.length,
    itemsPreview,
    sourceBoxId: data.sourceBoxId ? String(data.sourceBoxId) : undefined
  };
};

const caseMatchesFilters = (
  entry: CommunityCase,
  searchQuery: string,
  category: string,
  activeTags: string[]
) => {
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const matchesSearch = !normalizedQuery
    ? true
    : [entry.name, entry.creatorName, ...(entry.tags ?? [])].some((value) =>
        value?.toLowerCase().includes(normalizedQuery)
      );
  const matchesCategory = category === 'All' ? true : entry.category?.toLowerCase() === category.toLowerCase();
  const matchesTags = activeTags.length === 0
    ? true
    : activeTags.every((tag) => (entry.tags?.map((value) => value.toLowerCase()) ?? []).includes(tag.toLowerCase()));
  return matchesSearch && matchesCategory && matchesTags;
};

const sortCases = (cases: CommunityCase[], sortBy: string) => {
  const next = [...cases];
  switch (sortBy) {
    case 'featured':
      return next.sort((a, b) => Number(Boolean(b.isFeatured)) - Number(Boolean(a.isFeatured)) || b.createdAt - a.createdAt);
    case 'price-low':
      return next.sort((a, b) => (a.priceCoins ?? 0) - (b.priceCoins ?? 0));
    case 'price-high':
      return next.sort((a, b) => (b.priceCoins ?? 0) - (a.priceCoins ?? 0));
    case 'most-opened':
      return next.sort((a, b) => b.createdAt - a.createdAt);
    case 'newest':
    default:
      return next.sort((a, b) => b.createdAt - a.createdAt);
  }
};

export const CaseLab: React.FC = () => {
  const { boxes, items, isAuthenticated, openAuthModal, setView, user } = useGame();
  const [featuredCases, setFeaturedCases] = useState<CommunityCase[]>([]);
  const [newestCases, setNewestCases] = useState<CommunityCase[]>([]);
  const [newestCursor, setNewestCursor] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [loadingFeatured, setLoadingFeatured] = useState(true);
  const [loadingNewest, setLoadingNewest] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [selectedCase, setSelectedCase] = useState<CommunityCase | null>(null);
  const [isCloning, setIsCloning] = useState(false);

  const fetchFeatured = useCallback(async () => {
    setLoadingFeatured(true);
    try {
      const featuredQuery = query(
        collection(db, 'communityCases'),
        where('status', '==', 'published'),
        where('isFeatured', '==', true),
        orderBy('createdAt', 'desc'),
        limit(8)
      );
      const snapshot = await getDocs(featuredQuery);
      setFeaturedCases(snapshot.docs.map(normalizeCommunityCase));
    } catch (error) {
      console.error('Failed to load featured community cases', error);
      setFeaturedCases([]);
    } finally {
      setLoadingFeatured(false);
    }
  }, []);

  const fetchNewest = useCallback(async () => {
    setLoadingNewest(true);
    try {
      const newestQuery = query(
        collection(db, 'communityCases'),
        where('status', '==', 'published'),
        orderBy('createdAt', 'desc'),
        limit(PAGE_SIZE)
      );
      const snapshot = await getDocs(newestQuery);
      setNewestCases(snapshot.docs.map(normalizeCommunityCase));
      setNewestCursor(snapshot.docs[snapshot.docs.length - 1] ?? null);
    } catch (error) {
      console.error('Failed to load community cases', error);
      setNewestCases([]);
      setNewestCursor(null);
    } finally {
      setLoadingNewest(false);
    }
  }, []);

  const loadMoreNewest = useCallback(async () => {
    if (!newestCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const newestQuery = query(
        collection(db, 'communityCases'),
        where('status', '==', 'published'),
        orderBy('createdAt', 'desc'),
        startAfter(newestCursor),
        limit(PAGE_SIZE)
      );
      const snapshot = await getDocs(newestQuery);
      const nextCases = snapshot.docs.map(normalizeCommunityCase);
      setNewestCases((prev) => [...prev, ...nextCases]);
      setNewestCursor(snapshot.docs[snapshot.docs.length - 1] ?? null);
    } catch (error) {
      console.error('Failed to load more community cases', error);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, newestCursor]);

  useEffect(() => {
    fetchFeatured();
    fetchNewest();
  }, [fetchFeatured, fetchNewest]);

  const availableCategories = useMemo(() => {
    const categories = new Set<string>();
    [...featuredCases, ...newestCases].forEach((entry) => {
      if (entry.category) categories.add(entry.category);
    });
    return ['All', ...Array.from(categories)];
  }, [featuredCases, newestCases]);

  const availableTags = useMemo(() => {
    const tags = new Set<string>();
    [...featuredCases, ...newestCases].forEach((entry) => {
      entry.tags?.forEach((tag) => tags.add(tag));
    });
    return Array.from(tags);
  }, [featuredCases, newestCases]);

  const filteredFeatured = useMemo(() => {
    const filtered = featuredCases.filter((entry) => caseMatchesFilters(entry, searchQuery, categoryFilter, activeTags));
    return sortCases(filtered, sortBy);
  }, [featuredCases, searchQuery, categoryFilter, activeTags, sortBy]);

  const filteredNewest = useMemo(() => {
    const filtered = newestCases.filter((entry) => caseMatchesFilters(entry, searchQuery, categoryFilter, activeTags));
    return sortCases(filtered, sortBy);
  }, [newestCases, searchQuery, categoryFilter, activeTags, sortBy]);

  const toggleTag = (tag: string) => {
    setActiveTags((prev) =>
      prev.includes(tag) ? prev.filter((value) => value !== tag) : [...prev, tag]
    );
  };

  const resolveDraftItems = (entry: CommunityCase) => {
    const fallbackItems: CaseItem[] = [];
    let selectedItems: CaseItem[] = [];
    let selectedItemIds: string[] = [];
    let priceCoins = entry.priceCoins ?? 0;

    if (entry.sourceBoxId) {
      const sourceBox = boxes.find((box) => box.id === entry.sourceBoxId);
      if (sourceBox) {
        selectedItems = sourceBox.items;
        selectedItemIds = sourceBox.items.map((item) => item.id);
        if (!priceCoins) priceCoins = sourceBox.price;
      }
    }

    if (!selectedItems.length && entry.itemsPreview?.length) {
      selectedItemIds = entry.itemsPreview.map((item) => item.id);
      selectedItems = entry.itemsPreview
        .map((item) => items.find((inventoryItem) => inventoryItem.id === item.id))
        .filter(Boolean) as CaseItem[];
    }

    return {
      selectedItems: selectedItems.length ? selectedItems : fallbackItems,
      selectedItemIds,
      priceCoins
    };
  };

  const handleClone = async (entry: CommunityCase) => {
    if (!isAuthenticated) {
      openAuthModal('login');
      return;
    }

    setIsCloning(true);
    try {
      const { selectedItems, selectedItemIds, priceCoins } = resolveDraftItems(entry);
      const draftPayload = {
        ownerUid: user.uid,
        sourceCommunityCaseId: entry.id,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        name: entry.name,
        coverImage: entry.coverImage,
        selectedItemIds,
        selectedItems,
        priceCoins,
        status: 'draft'
      };
      const draftRef = await addDoc(collection(db, 'userCaseDrafts'), draftPayload);
      setSelectedCase(null);
      setView({ type: 'CASE_LAB_CREATE', draftId: draftRef.id });
    } catch (error) {
      console.error('Failed to clone community case', error);
      alert('Unable to clone this case right now. Please try again.');
    } finally {
      setIsCloning(false);
    }
  };

  const handleOpenCase = (entry: CommunityCase) => {
    if (!entry.sourceBoxId) return;
    setSelectedCase(null);
    setView({ type: 'CASE_OPENING', boxId: entry.sourceBoxId });
  };

  const filterControls = (
    <>
      <div className="relative w-full">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
        <Input
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Search cases, creators, tags..."
          className="w-full pl-9 text-sm"
        />
      </div>
      <Select
        value={sortBy}
        onChange={(event) => setSortBy(event.target.value)}
        className="w-full"
        wrapperClassName="w-full"
        buttonClassName="w-full bg-[#0b0e14] border border-gray-800 text-sm"
      >
        {SORT_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>
      <Select
        value={categoryFilter}
        onChange={(event) => setCategoryFilter(event.target.value)}
        className="w-full"
        wrapperClassName="w-full"
        buttonClassName="w-full bg-[#0b0e14] border border-gray-800 text-sm"
      >
        {availableCategories.map((category) => (
          <option key={category} value={category}>
            {category}
          </option>
        ))}
      </Select>
    </>
  );

  const caseCard = (entry: CommunityCase) => (
    <button
      key={entry.id}
      onClick={() => setSelectedCase(entry)}
      className="group flex h-full flex-col overflow-hidden rounded-2xl border border-gray-800 bg-[#0f131b] text-left transition hover:border-brand-purple/60 hover:shadow-[0_0_25px_rgba(124,58,237,0.18)]"
    >
      <div className="relative h-40 w-full overflow-hidden bg-black/30">
        {entry.coverImage ? (
          <img
            src={entry.coverImage}
            alt={entry.name}
            className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-gray-500">No cover</div>
        )}
        {entry.isFeatured && (
          <div className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full border border-brand-purple/50 bg-brand-purple/20 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-brand-purple">
            <Sparkles className="h-3 w-3" /> Featured
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div>
          <div className="text-base font-bold text-white line-clamp-1">{entry.name}</div>
          <div className="text-xs text-gray-400">by {entry.creatorName}</div>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-gray-400">
          <span>{entry.itemCount ?? entry.itemsPreview?.length ?? 0} items</span>
          <span className="h-1 w-1 rounded-full bg-gray-700" />
          <span>{formatDate(entry.createdAt)}</span>
        </div>
        <div className="mt-auto flex flex-wrap items-center justify-between gap-3 text-sm">
          <div className="flex items-center gap-2 text-gray-300">
            <span className="text-xs uppercase tracking-wide text-gray-500">Price</span>
            <CoinAmount amount={entry.priceCoins ?? 0} className="text-white" iconClassName="h-4 w-4" />
          </div>
          <div className="text-xs text-emerald-300">
            {Number.isFinite(entry.ev) ? `EV ${(entry.ev ?? 0).toFixed(2)}` : 'EV --'}
          </div>
        </div>
      </div>
    </button>
  );

  const caseGrid = (entries: CommunityCase[], loading: boolean) => (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {loading
        ? Array.from({ length: 6 }).map((_, index) => (
            <div
              key={`skeleton-${index}`}
              className="h-[280px] animate-pulse rounded-2xl border border-gray-800 bg-[#0f131b]"
            >
              <div className="h-36 w-full rounded-t-2xl bg-[#141925]" />
              <div className="space-y-3 p-4">
                <div className="h-4 w-2/3 rounded bg-[#1b2230]" />
                <div className="h-3 w-1/3 rounded bg-[#1b2230]" />
                <div className="h-3 w-1/2 rounded bg-[#1b2230]" />
                <div className="h-6 w-full rounded bg-[#1b2230]" />
              </div>
            </div>
          ))
        : entries.map(caseCard)}
    </div>
  );

  return (
    <section className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 pb-16 pt-6 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-purple-300/80">Case Lab</p>
            <h1 className="text-3xl font-black text-white">Browse community cases</h1>
            <p className="mt-2 text-sm text-gray-400">Browse community cases or clone one to remix.</p>
          </div>
          <button
            type="button"
            onClick={() => setView({ type: 'CASE_LAB_CREATE' })}
            className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-gray-200 transition hover:border-brand-purple/60 hover:text-white"
          >
            Create New
          </button>
        </div>

        <div className="flex flex-col gap-3 rounded-2xl border border-gray-800 bg-[#0b0f18] p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3 sm:hidden">
            <div className="text-sm font-semibold text-white">Filters</div>
            <button
              type="button"
              onClick={() => setShowMobileFilters(true)}
              className="inline-flex items-center gap-2 rounded-full border border-gray-700 bg-[#0f131b] px-4 py-2 text-xs font-semibold uppercase tracking-wide text-gray-200"
            >
              <Filter className="h-4 w-4" />
              Open Filters
            </button>
          </div>
          <div className="hidden grid-cols-1 gap-3 sm:grid sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
            {filterControls}
          </div>
          {availableTags.length > 0 && (
            <div className="hidden flex-wrap gap-2 sm:flex">
              {availableTags.map((tag) => {
                const isActive = activeTags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleTag(tag)}
                    className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-wide transition ${
                      isActive
                        ? 'border-brand-purple/70 bg-brand-purple/20 text-brand-purple'
                        : 'border-gray-700 bg-[#0f131b] text-gray-400 hover:border-gray-500'
                    }`}
                  >
                    <Tag className="h-3 w-3" />
                    {tag}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </header>

      {featuredCases.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white">Featured Community Cases</h2>
            <span className="text-xs text-gray-500">{filteredFeatured.length} featured</span>
          </div>
          {caseGrid(filteredFeatured, loadingFeatured)}
        </div>
      )}

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">Newest Community Cases</h2>
          <span className="text-xs text-gray-500">{filteredNewest.length} cases</span>
        </div>
        {caseGrid(filteredNewest, loadingNewest)}
        <div className="flex justify-center">
          <button
            type="button"
            onClick={loadMoreNewest}
            disabled={!newestCursor || loadingMore}
            className="inline-flex items-center gap-2 rounded-full border border-gray-700 bg-[#0f131b] px-5 py-2 text-xs font-semibold uppercase tracking-wide text-gray-200 transition hover:border-brand-purple/60 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loadingMore ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {loadingMore ? 'Loading...' : newestCursor ? 'Load more' : 'No more cases'}
          </button>
        </div>
      </div>

      {showMobileFilters && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:hidden">
          <div className="w-full rounded-2xl border border-gray-800 bg-[#0f131b] p-4">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-white">Filters</div>
              <button
                type="button"
                onClick={() => setShowMobileFilters(false)}
                className="rounded-full border border-gray-700 p-2 text-gray-300"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-4 grid gap-3">
              {filterControls}
              {availableTags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {availableTags.map((tag) => {
                    const isActive = activeTags.includes(tag);
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => toggleTag(tag)}
                        className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-wide transition ${
                          isActive
                            ? 'border-brand-purple/70 bg-brand-purple/20 text-brand-purple'
                            : 'border-gray-700 bg-[#0f131b] text-gray-400 hover:border-gray-500'
                        }`}
                      >
                        <Tag className="h-3 w-3" />
                        {tag}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {selectedCase && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <button
            type="button"
            onClick={() => setSelectedCase(null)}
            className="absolute inset-0"
            aria-label="Close case details"
          />
          <div className="relative w-full max-w-2xl overflow-hidden rounded-2xl border border-gray-800 bg-[#0f131b] shadow-2xl">
            <div className="grid gap-4 p-5 sm:grid-cols-[220px_1fr]">
              <div className="overflow-hidden rounded-xl border border-gray-800 bg-black/40">
                {selectedCase.coverImage ? (
                  <img
                    src={selectedCase.coverImage}
                    alt={selectedCase.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full min-h-[180px] items-center justify-center text-xs text-gray-500">No cover</div>
                )}
              </div>
              <div className="flex flex-col gap-3">
                <div>
                  <h3 className="text-xl font-bold text-white">{selectedCase.name}</h3>
                  <p className="text-sm text-gray-400">by {selectedCase.creatorName}</p>
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs text-gray-400">
                  <div>
                    <div className="text-[10px] uppercase tracking-wide text-gray-500">Price</div>
                    <CoinAmount amount={selectedCase.priceCoins ?? 0} className="text-white" iconClassName="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wide text-gray-500">EV</div>
                    <div className="text-white">{Number.isFinite(selectedCase.ev) ? (selectedCase.ev ?? 0).toFixed(2) : '--'}</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wide text-gray-500">Items</div>
                    <div className="text-white">{selectedCase.itemCount ?? selectedCase.itemsPreview?.length ?? 0}</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wide text-gray-500">Created</div>
                    <div className="text-white">{formatDate(selectedCase.createdAt)}</div>
                  </div>
                </div>
                {selectedCase.tags && selectedCase.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {selectedCase.tags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-gray-300"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
            {selectedCase.itemsPreview && selectedCase.itemsPreview.length > 0 && (
              <div className="border-t border-gray-800 px-5 py-4">
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">Item preview</div>
                <div className="mt-3 grid max-h-48 grid-cols-1 gap-3 overflow-y-auto pr-2 sm:grid-cols-2">
                  {selectedCase.itemsPreview.map((item) => (
                    <div key={item.id} className="flex items-center gap-3 rounded-xl border border-gray-800 bg-[#0b0f18] p-2">
                      <img src={item.image} alt={item.name} className="h-10 w-10 rounded-lg object-cover" />
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-white truncate">{item.name}</div>
                        <div className="text-xs text-gray-400">Value {item.value}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="flex flex-col gap-2 border-t border-gray-800 p-4 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="button"
                onClick={() => handleClone(selectedCase)}
                disabled={isCloning}
                className="inline-flex items-center justify-center rounded-full bg-brand-purple px-4 py-2 text-sm font-semibold text-white transition hover:bg-purple-500 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isCloning ? 'Cloning...' : 'Clone & Edit'}
              </button>
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                {selectedCase.sourceBoxId && (
                  <button
                    type="button"
                    onClick={() => handleOpenCase(selectedCase)}
                    className="inline-flex items-center justify-center rounded-full border border-brand-purple/50 bg-brand-purple/10 px-4 py-2 text-sm font-semibold text-brand-purple transition hover:bg-brand-purple/20"
                  >
                    Open Case
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setSelectedCase(null)}
                  className="inline-flex items-center justify-center rounded-full border border-gray-700 px-4 py-2 text-sm font-semibold text-gray-300 transition hover:border-gray-500"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
