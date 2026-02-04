import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, FlaskConical, Search, SlidersHorizontal } from 'lucide-react';
import { useGame } from '../context/GameContext';
import { useSound } from '../context/SoundContext';
import { BoxCard } from './BoxCard';
import { getBoxTags, normalizeBoxTag } from '../utils/boxTags';

type BoxCatalogProps = {
  isChatCollapsed: boolean;
};

const TAB_OPTIONS = [
  { id: 'official', label: 'Our Mystery Boxes' },
  { id: 'community', label: 'Community' },
  { id: 'category', label: 'Browse by Category' }
] as const;

type TabOption = typeof TAB_OPTIONS[number]['id'];

const SORT_OPTIONS = ['Popular', 'Price: Low to High', 'Price: High to Low', 'Newest'] as const;
type SortOption = typeof SORT_OPTIONS[number];

export const BoxCatalog: React.FC<BoxCatalogProps> = ({ isChatCollapsed }) => {
  const { boxes, setView } = useGame();
  const { playSound } = useSound();
  const [activeTab, setActiveTab] = useState<TabOption>('official');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOption, setSortOption] = useState<SortOption>('Popular');
  const [riskValue, setRiskValue] = useState(100);
  const [initialMaxPrice, setInitialMaxPrice] = useState<number | undefined>(undefined);

  const displayBoxes = useMemo(
    () => boxes.filter(box => !box.isDaily),
    [boxes]
  );

  const maxBoxPrice = useMemo(
    () => displayBoxes.reduce((max, box) => Math.max(max, box.price), 0),
    [displayBoxes]
  );

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tagsParam = params.get('tags');
    const maxPriceParam = params.get('maxPrice');
    const tags = tagsParam
      ? tagsParam.split(',').map(normalizeBoxTag).filter(Boolean)
      : [];
    const maxPrice = maxPriceParam ? Number(maxPriceParam) : undefined;
    const initialCategory = tags[0] ?? 'All';
    setSelectedCategory(initialCategory === '' ? 'All' : initialCategory);
    setInitialMaxPrice(Number.isFinite(maxPrice) ? maxPrice : undefined);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (selectedCategory !== 'All') {
      params.set('tags', selectedCategory);
    } else {
      params.delete('tags');
    }
    if (maxBoxPrice > 0 && riskValue < 100) {
      const maxPriceParam = Math.max(1, Math.round(maxBoxPrice * (riskValue / 100)));
      params.set('maxPrice', String(maxPriceParam));
    } else {
      params.delete('maxPrice');
    }
    const search = params.toString();
    window.history.replaceState({}, '', `/boxes${search ? `?${search}` : ''}`);
  }, [maxBoxPrice, riskValue, selectedCategory]);

  const tagStats = useMemo(() => {
    const counts = new Map<string, number>();
    displayBoxes.filter(box => !box.isUserCreated).forEach(box => {
      getBoxTags(box).forEach(tag => {
        counts.set(tag, (counts.get(tag) ?? 0) + 1);
      });
    });
    return counts;
  }, [displayBoxes]);

  const tagOptions = useMemo(() => {
    return Array.from(tagStats.keys()).sort((a, b) => a.localeCompare(b));
  }, [displayBoxes, tagStats]);

  const filteredBoxes = useMemo(() => {
    const normalizedCategory = normalizeBoxTag(selectedCategory);
    const normalizedSearch = searchQuery.trim().toLowerCase();
    const effectiveMaxPrice = maxBoxPrice > 0 && riskValue < 100
      ? Math.max(1, Math.round(maxBoxPrice * (riskValue / 100)))
      : undefined;

    return displayBoxes.filter((box) => {
      if (activeTab === 'official' && box.isUserCreated) return false;
      if (activeTab === 'community' && !box.isUserCreated) return false;
      if (activeTab === 'category' && box.isUserCreated) return false;

      if (effectiveMaxPrice && box.price > effectiveMaxPrice) return false;

      if (normalizedSearch) {
        const matchesName = box.name.toLowerCase().includes(normalizedSearch);
        if (!matchesName) return false;
      }

      if (normalizedCategory && normalizedCategory !== 'all' && !box.isUserCreated) {
        const boxTags = getBoxTags(box);
        if (!boxTags.includes(normalizedCategory)) return false;
      }

      return true;
    });
  }, [activeTab, displayBoxes, maxBoxPrice, riskValue, searchQuery, selectedCategory]);

  const sortedBoxes = useMemo(() => {
    const sorted = [...filteredBoxes];
    switch (sortOption) {
      case 'Price: Low to High':
        sorted.sort((a, b) => a.price - b.price);
        break;
      case 'Price: High to Low':
        sorted.sort((a, b) => b.price - a.price);
        break;
      case 'Newest':
        sorted.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
        break;
      default:
        break;
    }
    return sorted;
  }, [filteredBoxes, sortOption]);

  useEffect(() => {
    if (!initialMaxPrice || maxBoxPrice <= 0) return;
    const computedRisk = Math.round((initialMaxPrice / maxBoxPrice) * 100);
    setRiskValue(Math.min(100, Math.max(10, computedRisk)));
    setInitialMaxPrice(undefined);
  }, [initialMaxPrice, maxBoxPrice]);

  const gridClasses = isChatCollapsed
    ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5'
    : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4';

  return (
    <section className="max-w-[1440px] mx-auto p-4 md:p-6 lg:p-8 animate-in fade-in duration-300">
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={() => {
                playSound('click');
                setView({ type: 'HOME' });
              }}
              className="inline-flex items-center gap-2 self-start rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-gray-300 transition hover:border-white/30 hover:text-white"
            >
              <ChevronLeft className="w-4 h-4" /> Back
            </button>
            <div>
              <h1 className="text-3xl font-bold text-white sm:text-4xl">
                Open Online Mystery Boxes And Win Real-Life Items
              </h1>
              <p className="mt-2 text-sm text-gray-400">Filter by tag to find the box you want.</p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {TAB_OPTIONS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                playSound('click');
                setActiveTab(tab.id);
              }}
              className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-wide transition ${
                activeTab === tab.id
                  ? 'bg-gradient-to-r from-brand-purple/80 to-blue-600/80 text-white shadow-[0_0_12px_rgba(124,58,237,0.35)]'
                  : 'border border-white/10 bg-white/5 text-gray-400 hover:border-white/30 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-4 rounded-3xl border border-white/10 bg-gradient-to-r from-[#0d111b] via-[#121826] to-[#0c0f1b] p-5 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-4">
            <div className="rounded-2xl border border-purple-500/30 bg-purple-500/10 p-3 text-purple-300">
              <FlaskConical className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Create Your Own Custom Cases</h3>
              <p className="mt-1 text-sm text-gray-400">
                Create cases with items and odds of your choice. Earn up to 92% sell-back on wins.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => {
                playSound('click');
                setView({ type: 'CUSTOM_CREATOR' });
              }}
              className="rounded-full bg-brand-purple px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white transition hover:bg-purple-500"
            >
              Create Custom Case
            </button>
            <button
              type="button"
              onClick={() => {
                playSound('click');
                setView({ type: 'PROFILE' });
              }}
              className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-gray-300 transition hover:border-white/30 hover:text-white"
            >
              View Your Cases
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-[#0c111b]/90 p-4 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-1 flex-col gap-3 md:flex-row md:items-center">
            <div className="relative w-full md:max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-gray-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search boxes"
                className="w-full rounded-full border border-gray-700 bg-[#0b0e14] py-2.5 pl-9 pr-3 text-sm text-gray-200 focus:border-brand-purple focus:outline-none"
              />
            </div>
            <div className="flex w-full flex-col gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 md:max-w-[240px]">
              <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-gray-400">
                <span>Risk</span>
                <span className="text-gray-200">{riskValue}%</span>
              </div>
              <input
                type="range"
                min={10}
                max={100}
                value={riskValue}
                onChange={(event) => setRiskValue(Number(event.target.value))}
                className="w-full accent-brand-purple"
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3 md:justify-end">
            <select
              value={selectedCategory}
              onChange={(event) => {
                playSound('click');
                setSelectedCategory(event.target.value);
                if (activeTab === 'community') {
                  setActiveTab('category');
                }
              }}
              className="rounded-full border border-gray-700 bg-[#0b0e14] px-4 py-2.5 text-sm text-gray-200 focus:border-brand-purple focus:outline-none"
            >
              <option value="All">All Categories</option>
              {tagOptions.map((tag) => (
                <option key={tag} value={tag}>
                  {tag}
                </option>
              ))}
            </select>
            <select
              value={sortOption}
              onChange={(event) => setSortOption(event.target.value as SortOption)}
              className="rounded-full border border-gray-700 bg-[#0b0e14] px-4 py-2.5 text-sm text-gray-200 focus:border-brand-purple focus:outline-none"
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-gray-400 transition hover:border-white/30 hover:text-white"
              aria-label="Open advanced filters"
            >
              <SlidersHorizontal className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="mt-8">
        {sortedBoxes.length > 0 ? (
          <div className={`grid gap-4 ${gridClasses}`}>
            {sortedBoxes.map(box => (
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
          <div className="rounded-xl border border-dashed border-gray-800 bg-[#0b0e14] p-6 text-sm text-gray-500">
            No boxes found for this filter yet.
          </div>
        )}
      </div>
    </section>
  );
};
