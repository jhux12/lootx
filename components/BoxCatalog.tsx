import React, { useEffect, useMemo, useState } from 'react';
import { Tag, ChevronLeft, Search, X, SlidersHorizontal, Sparkles, ArrowRight } from 'lucide-react';
import { useGame } from '../context/GameContext';
import { useSound } from '../context/SoundContext';
import { BoxCard } from './BoxCard';
import { getBoxTags, normalizeBoxTag } from '../utils/boxTags';

type BoxCatalogProps = {
  isChatCollapsed: boolean;
};

export const BoxCatalog: React.FC<BoxCatalogProps> = ({ isChatCollapsed }) => {
  const { boxes, setView } = useGame();
  const { playSound } = useSound();
  const [activeTab, setActiveTab] = useState<'official' | 'community' | 'category'>('official');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [priceFilter, setPriceFilter] = useState<{ min?: number; max?: number }>({});
  const [sortOption, setSortOption] = useState<'popular' | 'price-asc' | 'price-desc' | 'newest'>('popular');
  const [riskValue, setRiskValue] = useState(100);

  const displayBoxes = useMemo(
    () => boxes.filter(box => !box.isDaily),
    [boxes]
  );

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tagsParam = params.get('tags');
    const minPriceParam = params.get('minPrice');
    const maxPriceParam = params.get('maxPrice');
    const rawTags = tagsParam
      ? tagsParam.split(',').map(normalizeBoxTag).filter(Boolean)
      : [];
    const tags = rawTags.filter((tag) => tag !== 'user created');
    const minPrice = minPriceParam ? Number(minPriceParam) : undefined;
    const maxPrice = maxPriceParam ? Number(maxPriceParam) : undefined;
    setSelectedTags(tags);
    setPriceFilter({
      min: Number.isFinite(minPrice) ? minPrice : undefined,
      max: Number.isFinite(maxPrice) ? maxPrice : undefined
    });
    if (rawTags.includes('user created')) {
      setActiveTab('community');
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (selectedTags.length > 0) {
      params.set('tags', selectedTags.join(','));
    } else {
      params.delete('tags');
    }
    if (typeof priceFilter.min === 'number') {
      params.set('minPrice', String(priceFilter.min));
    } else {
      params.delete('minPrice');
    }
    if (typeof priceFilter.max === 'number') {
      params.set('maxPrice', String(priceFilter.max));
    } else {
      params.delete('maxPrice');
    }
    const search = params.toString();
    window.history.replaceState({}, '', `/boxes${search ? `?${search}` : ''}`);
  }, [priceFilter.max, priceFilter.min, selectedTags]);

  const tagStats = useMemo(() => {
    const counts = new Map<string, number>();
    displayBoxes.filter(box => !box.isUserCreated).forEach(box => {
      getBoxTags(box).forEach(tag => {
        counts.set(tag, (counts.get(tag) ?? 0) + 1);
      });
    });
    return counts;
  }, [displayBoxes]);

  const popularTags = useMemo(
    () =>
      Array.from(tagStats.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([tag]) => tag),
    [tagStats]
  );

  const tagOptions = useMemo(() => {
    return Array.from(tagStats.keys()).sort((a, b) => a.localeCompare(b));
  }, [displayBoxes, tagStats]);

  const priceRange = useMemo(() => {
    if (displayBoxes.length === 0) {
      return { min: 0, max: 0, range: 0 };
    }
    const prices = displayBoxes.map((box) => box.price);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    return {
      min,
      max,
      range: Math.max(0, max - min)
    };
  }, [displayBoxes]);

  useEffect(() => {
    if (typeof priceFilter.max !== 'number' || priceRange.range === 0) {
      setRiskValue(100);
      return;
    }
    const nextRisk = Math.min(
      100,
      Math.max(0, Math.round(((priceFilter.max - priceRange.min) / priceRange.range) * 100))
    );
    setRiskValue((prev) => (prev === nextRisk ? prev : nextRisk));
  }, [priceFilter.max, priceRange.min, priceRange.range]);

  useEffect(() => {
    if (priceRange.range === 0) return;
    if (riskValue >= 100) {
      setPriceFilter((prev) => (prev.max === undefined ? prev : { ...prev, max: undefined }));
      return;
    }
    const nextMax = Math.round(priceRange.min + (priceRange.range * riskValue) / 100);
    setPriceFilter((prev) => (prev.max === nextMax ? prev : { ...prev, max: nextMax }));
  }, [priceRange.min, priceRange.range, riskValue]);

  const filteredBoxes = useMemo(() => {
    const normalizedSelected = selectedTags.map(normalizeBoxTag).filter(Boolean);
    let filtered = displayBoxes;

    if (activeTab === 'community') {
      filtered = filtered.filter((box) => box.isUserCreated);
    } else {
      filtered = filtered.filter((box) => !box.isUserCreated);
    }

    if (typeof priceFilter.min === 'number') {
      filtered = filtered.filter((box) => box.price >= priceFilter.min!);
    }
    if (typeof priceFilter.max === 'number') {
      filtered = filtered.filter((box) => box.price <= priceFilter.max!);
    }

    if (activeTab !== 'community' && normalizedSelected.length > 0) {
      filtered = filtered.filter((box) => {
        const boxTags = getBoxTags(box);
        return normalizedSelected.some((tag) => boxTags.includes(tag));
      });
    }

    if (searchQuery.trim()) {
      const query = searchQuery.trim().toLowerCase();
      filtered = filtered.filter((box) => box.name.toLowerCase().includes(query));
    }

    if (sortOption === 'price-asc') {
      filtered = [...filtered].sort((a, b) => a.price - b.price);
    } else if (sortOption === 'price-desc') {
      filtered = [...filtered].sort((a, b) => b.price - a.price);
    } else if (sortOption === 'newest') {
      filtered = [...filtered].sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
    }

    return filtered;
  }, [activeTab, displayBoxes, priceFilter.max, priceFilter.min, searchQuery, selectedTags, sortOption]);

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) => (
      prev.includes(tag)
        ? prev.filter(existing => existing !== tag)
        : [...prev, tag]
    ));
  };

  const categorySelectValue = selectedTags.length === 1 ? selectedTags[0] : selectedTags.length === 0 ? 'all' : 'multiple';
  const riskLabel = priceFilter.max ?? priceRange.max;

  return (
    <section className="max-w-[1400px] mx-auto px-4 pb-10 pt-8 sm:px-6 lg:px-8 animate-in fade-in duration-300">
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => {
              playSound('click');
              setView({ type: 'HOME' });
            }}
            className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400 transition hover:border-white/20 hover:text-white"
          >
            <ChevronLeft className="w-4 h-4" /> Back
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <h1 className="text-3xl font-bold text-white sm:text-4xl">
              Open Online Mystery Boxes And Win Real-Life Items
            </h1>
            <p className="text-sm text-gray-400 sm:text-base">Filter by tag to find the box you want.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              { id: 'official', label: 'Our Mystery Boxes' },
              { id: 'community', label: 'Community Mystery Boxes' },
              { id: 'category', label: 'Browse by Category' }
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  playSound('click');
                  setActiveTab(tab.id as typeof activeTab);
                  if (tab.id === 'community') {
                    setSelectedTags([]);
                  }
                }}
                className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-wide transition ${
                  activeTab === tab.id
                    ? 'bg-brand-purple/20 text-white border border-brand-purple/50 shadow-[0_0_18px_rgba(139,92,246,0.3)]'
                    : 'border border-white/10 bg-white/5 text-gray-400 hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-gradient-to-r from-[#101525] via-[#0b0f1c] to-[#0b0e14] p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-brand-purple/20 p-2 text-brand-purple">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Create Your Own Custom Cases</h2>
              <p className="text-xs text-gray-400 sm:text-sm">
                Create cases with items and odds of your choice. Earn up to 10% when others open them.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                playSound('click');
                setView({ type: 'CUSTOM_CREATOR' });
              }}
              className="inline-flex items-center gap-2 rounded-full bg-brand-purple px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white transition hover:bg-purple-500"
            >
              Create Custom Case <ArrowRight className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => {
                playSound('click');
                setView({ type: 'PROFILE' });
              }}
              className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-gray-300 transition hover:border-white/30 hover:text-white"
            >
              View Your Cases
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#0b0e14] p-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
            <div className="relative w-full lg:max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-gray-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search boxes"
                className="w-full rounded-full border border-gray-700 bg-[#0b0e14] py-2.5 pl-9 pr-3 text-sm text-gray-200 focus:border-brand-purple focus:outline-none"
              />
            </div>

            <div className="flex flex-1 flex-col gap-2">
              <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-gray-500">
                <span>Risk</span>
                <span className="text-gray-300">Up to {Math.round(riskLabel).toLocaleString()} coins</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={riskValue}
                onChange={(event) => setRiskValue(Number(event.target.value))}
                className="h-2 w-full cursor-pointer appearance-none rounded-full bg-gradient-to-r from-green-500/60 via-purple-500/60 to-red-500/60"
              />
            </div>

            <div className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto">
              <select
                value={categorySelectValue}
                onChange={(event) => {
                  const value = event.target.value;
                  if (activeTab === 'community') {
                    setActiveTab('category');
                  }
                  if (value === 'all') {
                    setSelectedTags([]);
                  } else if (value !== 'multiple') {
                    setSelectedTags([normalizeBoxTag(value)]);
                  }
                }}
                className="w-full rounded-full border border-gray-700 bg-[#0b0e14] px-4 py-2 text-sm text-gray-200 focus:border-brand-purple focus:outline-none sm:w-48"
              >
                <option value="all">All Categories</option>
                {selectedTags.length > 1 && (
                  <option value="multiple" disabled>
                    Multiple categories
                  </option>
                )}
                {tagOptions.map((tag) => (
                  <option key={tag} value={tag}>
                    {tag}
                  </option>
                ))}
              </select>

              <select
                value={sortOption}
                onChange={(event) => setSortOption(event.target.value as typeof sortOption)}
                className="w-full rounded-full border border-gray-700 bg-[#0b0e14] px-4 py-2 text-sm text-gray-200 focus:border-brand-purple focus:outline-none sm:w-44"
              >
                <option value="popular">Popular</option>
                <option value="newest">Newest</option>
                <option value="price-asc">Price: Low to High</option>
                <option value="price-desc">Price: High to Low</option>
              </select>
            </div>

            <button
              type="button"
              className="inline-flex items-center justify-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-gray-300 transition hover:border-white/30 hover:text-white"
            >
              <SlidersHorizontal className="h-4 w-4" />
              <span className="hidden sm:inline">Filters</span>
            </button>
          </div>

          {(selectedTags.length > 0 || searchQuery.trim()) && (
            <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-gray-400">
              {searchQuery.trim() && (
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
                  Search: {searchQuery.trim()}
                </span>
              )}
              {selectedTags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => {
                    playSound('click');
                    toggleTag(tag);
                  }}
                  className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 uppercase tracking-wide transition hover:border-white/30"
                >
                  <Tag className="h-3 w-3" /> {tag}
                  <X className="h-3 w-3" />
                </button>
              ))}
              <button
                type="button"
                onClick={() => {
                  playSound('click');
                  setSelectedTags([]);
                  setSearchQuery('');
                }}
                className="inline-flex items-center gap-1 rounded-full border border-white/10 px-3 py-1.5 uppercase tracking-wide text-gray-400 transition hover:border-white/30 hover:text-white"
              >
                <X className="h-3 w-3" /> Clear
              </button>
            </div>
          )}
        </div>

        {popularTags.length > 0 && activeTab !== 'community' && (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">Popular tags</p>
            <div className="flex flex-wrap gap-2">
              {popularTags.map((tag) => {
                const isSelected = selectedTags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => {
                      playSound('click');
                      toggleTag(tag);
                    }}
                    className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition ${
                      isSelected
                        ? 'bg-blue-600/20 border-blue-500 text-blue-200'
                        : 'bg-[#0b0e14] border-gray-700 text-gray-400 hover:border-gray-500'
                    }`}
                  >
                    <Tag className="w-3 h-3" />
                    {tag}
                    <span className="text-[10px] text-gray-500 font-semibold">
                      ({tagStats.get(tag) ?? 0})
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {filteredBoxes.length > 0 ? (
        <div className={`mt-6 grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 ${isChatCollapsed ? 'xl:grid-cols-5' : 'xl:grid-cols-4'}`}>
          {filteredBoxes.map(box => (
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
      ) : (
        <div className="mt-6 rounded-xl border border-dashed border-gray-800 bg-[#0b0e14] p-6 text-sm text-gray-500">
          No boxes found for these filters yet.
        </div>
      )}
    </section>
  );
};
