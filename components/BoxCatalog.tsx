import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, Search, Tag, X } from 'lucide-react';
import { useGame } from '../context/GameContext';
import { useSound } from '../context/SoundContext';
import { usePreview } from '../context/PreviewContext';
import { BoxCard } from './BoxCard';
import { getBoxTags, normalizeBoxTag } from '../utils/boxTags';
import { Input } from './ui/Input';
import { Select } from './ui/Select';
import {
  BoxesPageConfig,
  BoxesPageCuratedRow,
  BoxesPageTabId,
  getDefaultBoxesPageConfig,
  normalizeBoxesPageConfig,
  subscribeBoxesPageConfig
} from '../utils/boxesPageConfig';

const DEFAULT_SORT_OPTIONS = ['Price High', 'Price Low', 'Newest', 'Popular'];

const sortLabelToKey = (label?: string) => {
  const normalized = label?.trim().toLowerCase() ?? '';
  if (normalized.includes('price') && normalized.includes('low')) return 'price-low';
  if (normalized.includes('price') && normalized.includes('high')) return 'price-high';
  if (normalized.includes('new')) return 'newest';
  return 'price-high';
};

const clampGrid = (value: number | undefined, fallback: number) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.min(6, Math.max(1, Math.round(value)));
};

const gridCols = {
  1: 'grid-cols-1',
  2: 'grid-cols-2',
  3: 'grid-cols-3',
  4: 'grid-cols-4',
  5: 'grid-cols-5',
  6: 'grid-cols-6'
} as const;

const smGridCols = {
  1: 'sm:grid-cols-1',
  2: 'sm:grid-cols-2',
  3: 'sm:grid-cols-3',
  4: 'sm:grid-cols-4',
  5: 'sm:grid-cols-5',
  6: 'sm:grid-cols-6'
} as const;

const lgGridCols = {
  1: 'lg:grid-cols-1',
  2: 'lg:grid-cols-2',
  3: 'lg:grid-cols-3',
  4: 'lg:grid-cols-4',
  5: 'lg:grid-cols-5',
  6: 'lg:grid-cols-6'
} as const;

type BoxCatalogProps = {
  isChatCollapsed: boolean;
};

type BoxFilterOptions = {
  tabId?: BoxesPageTabId;
  searchTerm?: string;
  tags?: string[];
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  sortKey?: string;
};

const applyBoxFilters = (boxes: ReturnType<typeof useGame>['boxes'], options: BoxFilterOptions) => {
  let filtered = boxes;
  const hasSearch = Boolean(options.searchTerm?.trim());

  if (options.tabId === 'official') {
    filtered = filtered.filter((box) => !box.isUserCreated);
  }
  if (options.tabId === 'community') {
    filtered = filtered.filter((box) => box.isUserCreated);
  }

  if (options.tabId !== 'community') {
    if (options.category && options.category !== 'All') {
      const category = normalizeBoxTag(options.category);
      filtered = filtered.filter((box) => getBoxTags(box).includes(category));
    }

    if (options.tags && options.tags.length > 0 && !hasSearch) {
      const normalizedTags = options.tags.map(normalizeBoxTag).filter(Boolean);
      filtered = filtered.filter((box) => {
        const tags = getBoxTags(box);
        return normalizedTags.some((tag) => tags.includes(tag));
      });
    }
  }

  if (typeof options.minPrice === 'number') {
    filtered = filtered.filter((box) => box.price >= options.minPrice!);
  }
  if (typeof options.maxPrice === 'number') {
    filtered = filtered.filter((box) => box.price <= options.maxPrice!);
  }

  if (hasSearch) {
    const search = options.searchTerm!.toLowerCase();
    filtered = filtered.filter((box) => {
      const haystack = `${box.name} ${getBoxTags(box).join(' ')}`.toLowerCase();
      return haystack.includes(search);
    });
  }

  const sortKey = options.sortKey ?? 'price-high';
  if (sortKey === 'price-low') {
    filtered = [...filtered].sort((a, b) => a.price - b.price);
  } else if (sortKey === 'price-high') {
    filtered = [...filtered].sort((a, b) => b.price - a.price);
  } else if (sortKey === 'newest') {
    filtered = [...filtered].sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
  }

  return filtered;
};

const getDefaultTab = (tabs: BoxesPageConfig['tabs']) => {
  const enabledTabs = tabs.items.filter((tab) => tab.enabled);
  const defaultConfig = getDefaultBoxesPageConfig();
  const fallback = enabledTabs[0]?.id ?? defaultConfig.tabs.defaultTabId;
  if (!tabs.enabled) return defaultConfig.tabs.defaultTabId;
  if (enabledTabs.some((tab) => tab.id === tabs.defaultTabId)) {
    return tabs.defaultTabId;
  }
  return fallback;
};

export const BoxCatalog: React.FC<BoxCatalogProps> = ({ isChatCollapsed }) => {
  const { boxes, setView } = useGame();
  const { playSound } = useSound();
  const { previewAsUser } = usePreview();
  const [config, setConfig] = useState<BoxesPageConfig>(getDefaultBoxesPageConfig());
  const [activeTab, setActiveTab] = useState<BoxesPageTabId>(getDefaultBoxesPageConfig().tabs.defaultTabId);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [hasCategorySelection, setHasCategorySelection] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [sortOption, setSortOption] = useState('');
  const [isTagsOpen, setIsTagsOpen] = useState(false);
  const [categoryQueryParam, setCategoryQueryParam] = useState<string | null>(null);
  const hasInitializedRef = useRef(false);
  const hasQueryAppliedRef = useRef(false);
  const curatedRowRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const displayBoxes = useMemo(
    () => boxes.filter((box) => !box.isDaily),
    [boxes]
  );

  const officialBoxes = useMemo(
    () => displayBoxes.filter((box) => !box.isUserCreated),
    [displayBoxes]
  );

  useEffect(() => {
    const unsubscribe = subscribeBoxesPageConfig((nextConfig) => {
      const normalized = normalizeBoxesPageConfig(nextConfig);
      setConfig(normalized);
      if (!hasInitializedRef.current) {
        const categoryTabEnabled = normalized.tabs.items.some(
          (tab) => tab.id === 'category' && tab.enabled
        );
        const defaultTab = normalized.tabs.enabled
          ? (categoryTabEnabled ? 'category' : getDefaultTab(normalized.tabs))
          : 'category';
        setActiveTab(defaultTab);
        setSelectedCategory(normalized.filters.category.default ?? 'All');
        setSortOption(normalized.filters.sort.default ?? 'Price High');
        setSearchTerm('');
        setSelectedTags([]);
        setHasCategorySelection(false);
        setCategoryQueryParam(null);
        hasInitializedRef.current = true;
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (isTagsOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
    return undefined;
  }, [isTagsOpen]);

  const formatDropdownLabel = (label: string) => {
    if (!label) return label;
    return label.charAt(0).toUpperCase() + label.slice(1);
  };

  const tagStats = useMemo(() => {
    const counts = new Map<string, number>();
    displayBoxes.filter((box) => !box.isUserCreated).forEach((box) => {
      getBoxTags(box).forEach((tag) => {
        counts.set(tag, (counts.get(tag) ?? 0) + 1);
      });
    });
    return counts;
  }, [displayBoxes]);

  const tagOptions = useMemo(
    () => Array.from(tagStats.keys()).sort((a, b) => a.localeCompare(b)),
    [tagStats]
  );

  const popularTags = useMemo(() => {
    if (config.filters.tagChips.popularTags && config.filters.tagChips.popularTags.length > 0) {
      return config.filters.tagChips.popularTags;
    }
    return Array.from(tagStats.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([tag]) => tag);
  }, [config.filters.tagChips.popularTags, tagStats]);

  const categoryCards = useMemo(() => config.filters.category.cards ?? [], [config.filters.category.cards]);

  const categoryOptions = useMemo(() => {
    const cardOptions = categoryCards
      .filter((card) => card.categorySlug.trim())
      .map((card) => ({
        value: card.categorySlug,
        label: card.label?.trim() || card.categorySlug
      }));
    if (cardOptions.length > 0) {
      return [{ value: 'All', label: 'All Categories' }, ...cardOptions];
    }
    const configOptions = config.filters.category.options;
    if (configOptions && configOptions.length > 0) {
      return [
        { value: 'All', label: 'All Categories' },
        ...configOptions.map((option) => ({ value: option, label: option }))
      ];
    }
    return [
      { value: 'All', label: 'All Categories' },
      ...tagOptions.map((option) => ({ value: option, label: option }))
    ];
  }, [categoryCards, config.filters.category.options, tagOptions]);

  const sortOptions = useMemo(() => {
    const configOptions = config.filters.sort.options;
    if (configOptions && configOptions.length > 0) {
      return configOptions;
    }
    return DEFAULT_SORT_OPTIONS;
  }, [config.filters.sort.options]);

  useEffect(() => {
    if (!sortOption && sortOptions.length > 0) {
      setSortOption(config.filters.sort.default ?? sortOptions[0] ?? 'Price High');
    }
  }, [config.filters.sort.default, sortOption, sortOptions]);

  useEffect(() => {
    if (!selectedCategory) {
      setSelectedCategory(config.filters.category.default ?? 'All');
    }
  }, [config.filters.category.default, selectedCategory]);

  const enabledTabs = useMemo(
    () => config.tabs.items.filter((tab) => tab.enabled),
    [config.tabs.items]
  );

  useEffect(() => {
    if (hasQueryAppliedRef.current) return;
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const categoryParam = params.get('category');
    if (!categoryParam) return;
    const normalizedParam = normalizeBoxTag(categoryParam);
    if (!normalizedParam) return;
    const matchedOption =
      categoryOptions.find(
        (option) =>
          normalizeBoxTag(option.value) === normalizedParam ||
          normalizeBoxTag(option.label) === normalizedParam
      ) ?? null;
    const selectedValue = matchedOption?.value ?? categoryParam;
    const isAll = normalizeBoxTag(selectedValue) === 'all' || selectedValue === 'All';
    const preferredTab = enabledTabs.some((tab) => tab.id === 'official')
      ? 'official'
      : getDefaultTab(config.tabs);
    setActiveTab(preferredTab);
    setSelectedCategory(isAll ? 'All' : selectedValue);
    setHasCategorySelection(!isAll);
    setCategoryQueryParam(isAll ? null : normalizedParam);
    hasQueryAppliedRef.current = true;
  }, [categoryOptions, config.tabs, enabledTabs]);

  useEffect(() => {
    if (!config.tabs.enabled) return;
    if (!enabledTabs.some((tab) => tab.id === activeTab)) {
      const categoryTabEnabled = enabledTabs.some((tab) => tab.id === 'category');
      setActiveTab(categoryTabEnabled ? 'category' : getDefaultTab(config.tabs));
    }
  }, [activeTab, config.tabs, enabledTabs]);

  useEffect(() => {
    if (activeTab !== 'community') return;
    setSelectedCategory('All');
    setHasCategorySelection(false);
    setSelectedTags([]);
  }, [activeTab]);

  const activeTags = useMemo(() => {
    if (activeTab === 'community') return [];
    return selectedTags;
  }, [activeTab, selectedTags]);

  const handleCategorySelection = (nextValue: string) => {
    setSelectedCategory(nextValue);
    const isAll = normalizeBoxTag(nextValue) === 'all' || nextValue === 'All';
    setHasCategorySelection(!isAll);
    setCategoryQueryParam(null);
    setActiveTab('category');
  };

  const handleCategoryCardClick = (categorySlug: string) => {
    playSound('click');
    handleCategorySelection(categorySlug);
    const normalizedSlug = normalizeBoxTag(categorySlug);
    window.setTimeout(() => {
      const target = curatedRowRefs.current[normalizedSlug];
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 120);
  };

  const mainSortKey = sortLabelToKey(sortOption);

  const filteredBoxes = useMemo(
    () =>
      applyBoxFilters(displayBoxes, {
        tabId: activeTab,
        searchTerm: config.filters.search.enabled ? searchTerm : undefined,
        tags: config.filters.tagChips.enabled ? activeTags : [],
        category:
          config.filters.category.enabled || categoryQueryParam
            ? categoryQueryParam ?? selectedCategory
            : undefined,
        sortKey: config.filters.sort.enabled ? mainSortKey : undefined
      }),
    [
      activeTab,
      activeTags,
      config.filters.category.enabled,
      config.filters.sort.enabled,
      config.filters.tagChips.enabled,
      categoryQueryParam,
      displayBoxes,
      mainSortKey,
      searchTerm,
      selectedCategory
    ]
  );

  const curatedRows = useMemo(
    () => (config.curatedRows ?? []).filter((row) => row.enabled),
    [config.curatedRows]
  );
  const hasActiveSearch = Boolean(searchTerm.trim());
  const showCuratedRows = activeTab === 'official'
    && !hasActiveSearch
    && !hasCategorySelection
    && curatedRows.length > 0;

  const gridClassName = isChatCollapsed
    ? 'grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5'
    : 'grid-cols-2 sm:grid-cols-2 lg:grid-cols-4';

  const renderCuratedRow = (row: BoxesPageCuratedRow) => {
    const maxMobile = clampGrid(row.maxMobile, 2);
    const maxDesktop = clampGrid(row.maxDesktop, 4);
    const gridClass = `grid ${gridCols[1]} gap-4 ${smGridCols[maxMobile]} ${lgGridCols[maxDesktop]}`;
    const rowCategorySlug = row.filter?.category ? normalizeBoxTag(row.filter.category) : null;

    const rowBoxes = row.mode === 'byIds'
      ? (row.boxIds ?? [])
          .map((id) => officialBoxes.find((box) => box.id === id))
          .filter((box): box is typeof officialBoxes[number] => Boolean(box))
      : applyBoxFilters(officialBoxes, {
          tags: row.filter?.tag ? [row.filter.tag] : [],
          category: row.filter?.category,
          minPrice: row.filter?.minPrice,
          maxPrice: row.filter?.maxPrice,
          sortKey: sortLabelToKey(row.filter?.sort)
        });

    if (rowBoxes.length === 0) return null;

    return (
      <section
        key={row.id}
        ref={(element) => {
          if (!rowCategorySlug) return;
          curatedRowRefs.current[rowCategorySlug] = element;
        }}
        data-category={rowCategorySlug ?? undefined}
        className="space-y-4"
      >
        <div>
          <h3 className="text-lg font-semibold text-white">{row.title}</h3>
          {row.subtitle && <p className="text-sm text-gray-400">{row.subtitle}</p>}
        </div>
        {row.layout === 'carousel' ? (
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 z-10 hidden w-10 bg-gradient-to-r from-[#050811] via-[#050811]/80 to-transparent sm:block" />
            <div className="pointer-events-none absolute inset-y-0 right-0 z-10 hidden w-10 bg-gradient-to-l from-[#050811] via-[#050811]/80 to-transparent sm:block" />
            <div className="flex gap-4 overflow-x-auto pb-2 pt-1 snap-x snap-mandatory sm:overflow-visible">
              {rowBoxes.map((box) => (
                <div key={box.id} className="min-w-[220px] snap-start sm:min-w-0">
                  <BoxCard
                    box={box}
                    onSelect={(boxId) => {
                      playSound('click');
                      setView({ type: 'CASE_OPENING', boxId });
                    }}
                    onHover={() => playSound('hover')}
                  />
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className={gridClass}>
            {rowBoxes.map((box) => (
              <BoxCard
                key={box.id}
                box={box}
                onSelect={(boxId) => {
                  playSound('click');
                  setView({ type: 'CASE_OPENING', boxId });
                }}
                onHover={() => playSound('hover')}
              />
            ))}
          </div>
        )}
      </section>
    );
  };

  const mobileConfig = config.filters.mobile;
  const showTagChipsInline = config.filters.tagChips.enabled && !mobileConfig.collapseTagChips;
  const categoryVisibilityClass = mobileConfig.minimalTopRow ? 'hidden md:block' : 'block';
  const sortVisibilityClass = mobileConfig.minimalTopRow ? 'hidden md:block' : 'block';

  return (
    <section className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 px-4 pb-16 pt-4 sm:px-6 lg:px-8 animate-in fade-in duration-300 md:gap-8 md:pt-6">
      <div className="md:hidden sticky top-0 z-20 -mx-4 bg-[#050811]/95 px-4 pb-4 pt-2 backdrop-blur border-b border-white/10">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              playSound('click');
              setView({ type: 'HOME' });
            }}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-[#0f141f] text-gray-300"
            aria-label="Back"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="truncate text-lg font-semibold text-white">Mystery Boxes</h1>
            {!mobileConfig.compactTop && (
              <p className="text-xs text-gray-400">Filter by tag to find the box you want.</p>
            )}
          </div>
        </div>

        {config.tabs.enabled && enabledTabs.length > 0 && (
          <div className="mt-3 flex rounded-full border border-white/10 bg-[#0b0f1a] p-1">
            {enabledTabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  playSound('click');
                  setActiveTab(tab.id);
                }}
                className={`flex-1 truncate rounded-full px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide transition ${
                  activeTab === tab.id
                    ? 'bg-brand-purple/30 text-white shadow-[0_0_12px_rgba(124,58,237,0.35)]'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}

        {config.filters.search.enabled && (
          <div className="relative mt-3">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-gray-500" />
            <Input
              type="text"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder={config.filters.search.placeholder ?? 'Search boxes'}
              className="pl-9 pr-3 py-2 text-sm"
            />
          </div>
        )}

        <div className="mt-3 flex justify-end gap-2">
          {config.filters.tagChips.enabled && (
            <button
              type="button"
              onClick={() => setIsTagsOpen(true)}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-[#0f141f] px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-gray-300"
            >
              <Tag className="h-3 w-3" /> Tags
            </button>
          )}
        </div>
      </div>

      {config.filters.category.enabled && categoryCards.length > 0 && (
        <div className="md:hidden -mx-4 px-4">
          <div className="rounded-2xl border border-white/10 bg-[#0b0f1a]/80 p-3 shadow-[0_0_12px_rgba(15,23,42,0.45)]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gray-500">Categories</p>
            <div className="relative mt-2">
              <div className="pointer-events-none absolute inset-y-0 left-0 w-4 bg-gradient-to-r from-[#0b0f1a] to-transparent" />
              <div className="pointer-events-none absolute inset-y-0 right-0 w-4 bg-gradient-to-l from-[#0b0f1a] to-transparent" />
              <div className="flex gap-2 overflow-x-auto pb-1 pt-1">
                {categoryCards.map((card) => {
                  const isSelected = normalizeBoxTag(selectedCategory) === normalizeBoxTag(card.categorySlug);
                  return (
                    <div
                      key={card.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => handleCategoryCardClick(card.categorySlug)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          handleCategoryCardClick(card.categorySlug);
                        }
                      }}
                      className={`group relative min-w-[120px] overflow-hidden rounded-lg border bg-[#0b0e14] text-left transition ${
                        isSelected
                          ? 'border-brand-purple/70 shadow-[0_0_10px_rgba(124,58,237,0.35)]'
                          : 'border-white/10'
                      }`}
                    >
                      <img
                        src={card.imageUrl}
                        alt={card.label || card.categorySlug}
                        loading="lazy"
                        className="h-12 w-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-[#050811] via-[#050811]/40 to-transparent" />
                      <span className="absolute bottom-1.5 left-2 text-[10px] font-semibold text-white drop-shadow">
                        {card.label || card.categorySlug}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="hidden md:flex md:flex-col md:gap-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                playSound('click');
                setView({ type: 'HOME' });
              }}
              className="flex items-center gap-2 rounded-lg border border-white/10 bg-[#0f141f] px-3 py-1.5 text-sm font-medium text-gray-300 transition hover:text-white"
            >
              <ChevronLeft className="w-4 h-4" /> Back
            </button>
            <div>
              <h1 className="text-3xl font-bold text-white">
                Open Online Mystery Boxes And Win Real-Life Items
              </h1>
              <p className="text-sm text-gray-400">Filter by tag to find the box you want.</p>
            </div>
          </div>
        </div>

        {config.tabs.enabled && enabledTabs.length > 0 && (
          <div className="flex flex-wrap items-center gap-3">
            {enabledTabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  playSound('click');
                  setActiveTab(tab.id);
                }}
                className={`rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-wide transition ${
                  activeTab === tab.id
                    ? 'border-brand-purple/60 bg-brand-purple/20 text-white shadow-[0_0_12px_rgba(124,58,237,0.35)]'
                    : 'border-white/10 bg-[#0b0f1a] text-gray-400 hover:border-white/30 hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="hidden md:flex flex-col gap-4 rounded-2xl border border-white/10 bg-[#0b0f1a]/80 p-4 shadow-[0_0_18px_rgba(15,23,42,0.6)]">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          {config.filters.search.enabled && (
            <div className="relative w-full md:max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-gray-500" />
              <Input
                type="text"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder={config.filters.search.placeholder ?? 'Search boxes'}
                className="pl-9 pr-3 py-2 text-sm"
              />
            </div>
          )}

          <div className="flex w-full items-center justify-between gap-2 md:w-auto md:flex-1">
            {config.filters.category.enabled && (
              <div className={`${categoryVisibilityClass} min-w-[170px] flex-1`}>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Category</label>
                <Select
                  value={selectedCategory}
                  onChange={(event) => {
                    handleCategorySelection(event.target.value);
                  }}
                >
                  {categoryOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label === 'All Categories' ? option.label : formatDropdownLabel(option.label)}
                    </option>
                  ))}
                </Select>
              </div>
            )}

            {config.filters.sort.enabled && (
              <div className={`${sortVisibilityClass} min-w-[160px] flex-1`}>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Sort</label>
                <Select
                  value={sortOption}
                  onChange={(event) => setSortOption(event.target.value)}
                >
                  {sortOptions.map((option) => (
                    <option key={option} value={option}>
                      {formatDropdownLabel(option)}
                    </option>
                  ))}
                </Select>
              </div>
            )}

          </div>
        </div>

        {config.filters.category.enabled && categoryCards.length > 0 && (
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gray-500">Categories</p>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 w-4 bg-gradient-to-r from-[#0b0f1a] to-transparent" />
              <div className="pointer-events-none absolute inset-y-0 right-0 w-4 bg-gradient-to-l from-[#0b0f1a] to-transparent" />
              <div className="flex gap-2 overflow-x-auto pb-2 pt-1">
                {categoryCards.map((card) => {
                  const isSelected = normalizeBoxTag(selectedCategory) === normalizeBoxTag(card.categorySlug);
                  return (
                    <div
                      key={card.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => handleCategoryCardClick(card.categorySlug)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          handleCategoryCardClick(card.categorySlug);
                        }
                      }}
                      className={`group relative min-w-[140px] overflow-hidden rounded-xl border bg-[#0b0e14] text-left transition ${
                        isSelected
                          ? 'border-brand-purple/70 shadow-[0_0_12px_rgba(124,58,237,0.35)]'
                          : 'border-white/10 hover:border-white/30'
                      }`}
                    >
                      <img
                        src={card.imageUrl}
                        alt={card.label || card.categorySlug}
                        loading="lazy"
                        className="h-16 w-full object-cover transition-transform duration-300 group-hover:scale-105 sm:h-20"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-[#050811] via-[#050811]/40 to-transparent" />
                      <span className="absolute bottom-2 left-2 text-[11px] font-semibold text-white drop-shadow">
                        {card.label || card.categorySlug}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {config.filters.tagChips.enabled && showTagChipsInline && popularTags.length > 0 && (
          <div className="space-y-2 hidden md:block">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">
              {config.filters.tagChips.label ?? 'Popular tags'}
            </p>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 w-6 bg-gradient-to-r from-[#0b0f1a] to-transparent" />
              <div className="pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-[#0b0f1a] to-transparent" />
              <div className="flex gap-2 overflow-x-auto pb-1">
                {popularTags.map((tag) => {
                  const isSelected = selectedTags.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => {
                        playSound('click');
                        setSelectedTags((prev) =>
                          prev.includes(tag) ? prev.filter((existing) => existing !== tag) : [...prev, tag]
                        );
                      }}
                      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition ${
                        isSelected
                          ? 'bg-blue-600/20 border-blue-500 text-blue-200'
                          : 'bg-[#0b0e14] border-gray-700 text-gray-400 hover:border-gray-500'
                      }`}
                    >
                      <Tag className="h-3 w-3" />
                      {tag}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {showCuratedRows && (
        <div className="space-y-10">
          {curatedRows.map((row) => renderCuratedRow(row))}
        </div>
      )}

      {filteredBoxes.length > 0 && (
        <div className={`grid gap-4 ${gridClassName}`}>
          {filteredBoxes.map((box) => (
            <BoxCard
              key={box.id}
              box={box}
              onSelect={(boxId) => {
                playSound('click');
                setView({ type: 'CASE_OPENING', boxId });
              }}
              onHover={() => playSound('hover')}
            />
          ))}
        </div>
      )}

      {isTagsOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 md:hidden">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0b0f1a] p-4 pb-10 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-sm font-semibold text-white">Tags</h3>
              <button
                type="button"
                onClick={() => setIsTagsOpen(false)}
                className="text-gray-400 transition hover:text-white"
                aria-label="Close tags"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-4 pt-4">
              {config.filters.tagChips.enabled && popularTags.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {popularTags.map((tag) => {
                    const isSelected = selectedTags.includes(tag);
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => {
                          playSound('click');
                          setSelectedTags((prev) =>
                            prev.includes(tag) ? prev.filter((existing) => existing !== tag) : [...prev, tag]
                          );
                        }}
                        className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition ${
                          isSelected
                            ? 'bg-blue-600/20 border-blue-500 text-blue-200'
                            : 'bg-[#0b0e14] border-gray-700 text-gray-400 hover:border-gray-500'
                        }`}
                      >
                        <Tag className="h-3 w-3" />
                        {tag}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-gray-500">No tags configured.</p>
              )}
            </div>
            <div className="mt-6 flex items-center justify-between pb-4">
              <button
                type="button"
                onClick={() => {
                  playSound('click');
                  setSelectedTags([]);
                }}
                className="text-xs font-semibold uppercase tracking-wide text-gray-400 transition hover:text-white"
              >
                Clear tags
              </button>
              <button
                type="button"
                onClick={() => setIsTagsOpen(false)}
                className="rounded-full bg-brand-purple px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white transition hover:bg-purple-500"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {previewAsUser && (
        <div className="sr-only" aria-hidden="true">
          Preview mode enabled
        </div>
      )}
    </section>
  );
};
