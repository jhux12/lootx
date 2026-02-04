import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, Search, SlidersHorizontal, Sparkles } from 'lucide-react';
import { useGame } from '../context/GameContext';
import { useSound } from '../context/SoundContext';
import { BoxCard } from './BoxCard';
import { getBoxTags, normalizeBoxTag } from '../utils/boxTags';
import { getRiskLabel } from '../utils/caseOdds';

type BoxCatalogProps = {
  isChatCollapsed: boolean;
};

export const BoxCatalog: React.FC<BoxCatalogProps> = ({ isChatCollapsed }) => {
  const { boxes, setView, isAuthenticated, setShowLoginModal } = useGame();
  const { playSound } = useSound();
  const [activeTab, setActiveTab] = useState<'official' | 'community' | 'category'>('official');
  const [searchTerm, setSearchTerm] = useState('');
  const [riskValue, setRiskValue] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [sortOption, setSortOption] = useState<'popular' | 'price-low' | 'price-high'>('popular');
  const [priceFilter, setPriceFilter] = useState<{ min?: number; max?: number }>({});

  const displayBoxes = useMemo(
    () => boxes.filter(box => !box.isDaily),
    [boxes]
  );

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tagsParam = params.get('tags');
    const minPriceParam = params.get('minPrice');
    const maxPriceParam = params.get('maxPrice');
    const tags = tagsParam
      ? tagsParam.split(',').map(normalizeBoxTag).filter(Boolean)
      : [];
    const minPrice = minPriceParam ? Number(minPriceParam) : undefined;
    const maxPrice = maxPriceParam ? Number(maxPriceParam) : undefined;

    const includesUserCreated = tags.includes('user created');
    if (includesUserCreated) {
      setActiveTab('community');
      setSelectedCategory('All');
    } else if (tags.length > 0) {
      setActiveTab('category');
      setSelectedCategory(tags[0]);
    } else {
      setActiveTab('official');
      setSelectedCategory('All');
    }

    setPriceFilter({
      min: Number.isFinite(minPrice) ? minPrice : undefined,
      max: Number.isFinite(maxPrice) ? maxPrice : undefined
    });

  }, []);

  const activeTags = useMemo(() => {
    if (activeTab === 'community') return ['User Created'];
    if (activeTab === 'category' && selectedCategory !== 'All') return [selectedCategory];
    return [];
  }, [activeTab, selectedCategory]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (activeTags.length > 0) {
      params.set('tags', activeTags.join(','));
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
  }, [activeTags, priceFilter.max, priceFilter.min]);

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
    const options = Array.from(tagStats.keys()).sort((a, b) => a.localeCompare(b));
    return options;
  }, [displayBoxes, tagStats]);

  const categoryOptions = useMemo(
    () => ['All', ...tagOptions.filter((tag) => tag !== 'User Created')],
    [tagOptions]
  );

  const filteredBoxes = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    const normalizedSelected = activeTags
      .filter(tag => tag !== 'User Created')
      .map(normalizeBoxTag);
    const includeUserCreated = activeTags.includes('User Created');

    return displayBoxes.filter((box) => {
      if (typeof priceFilter.min === 'number' && box.price < priceFilter.min) return false;
      if (typeof priceFilter.max === 'number' && box.price > priceFilter.max) return false;
      if (riskValue > 0 && (box.riskLevel ?? 50) < riskValue) return false;

      if (normalizedSearch) {
        const haystack = `${box.name} ${getBoxTags(box).join(' ')}`.toLowerCase();
        if (!haystack.includes(normalizedSearch)) return false;
      }

      if (activeTab === 'official') {
        return !box.isUserCreated;
      }
      if (activeTab === 'community') {
        return box.isUserCreated;
      }

      if (normalizedSelected.length === 0 && !includeUserCreated) {
        return !box.isUserCreated;
      }

      const matchesUserCreated = includeUserCreated && box.isUserCreated;
      const boxTags = getBoxTags(box);
      const matchesTag = normalizedSelected.length > 0
        && !box.isUserCreated
        && normalizedSelected.some(tag => boxTags.includes(tag));
      return matchesUserCreated || matchesTag;
    });
  }, [activeTab, activeTags, displayBoxes, priceFilter.max, priceFilter.min, riskValue, searchTerm]);

  const sortedBoxes = useMemo(() => {
    const sorted = [...filteredBoxes];
    if (sortOption === 'price-low') {
      sorted.sort((a, b) => a.price - b.price);
    } else if (sortOption === 'price-high') {
      sorted.sort((a, b) => b.price - a.price);
    }
    return sorted;
  }, [filteredBoxes, sortOption]);

  const riskLabel = riskValue === 0 ? 'Any' : getRiskLabel(riskValue);
  const gridClassName = isChatCollapsed
    ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5'
    : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4';

  const handleAuthAction = (action: () => void) => {
    playSound('click');
    if (!isAuthenticated) {
      setShowLoginModal(true);
      return;
    }
    action();
  };

  return (
    <section className="mx-auto flex w-full max-w-[1440px] flex-col gap-8 px-4 pb-16 pt-6 sm:px-6 lg:px-8 animate-in fade-in duration-300">
      <div className="flex flex-col gap-6">
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
              <h1 className="text-2xl font-bold text-white md:text-3xl">
                Open Online Mystery Boxes And Win Real-Life Items
              </h1>
              <p className="text-sm text-gray-400">Filter by tag to find the box you want.</p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {([
            { id: 'official', label: 'Our Mystery Boxes' },
            { id: 'community', label: 'Community Mystery Boxes' },
            { id: 'category', label: 'Browse by Category' }
          ] as const).map((tab) => (
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

        <div className="flex flex-col gap-5 rounded-2xl border border-white/10 bg-gradient-to-r from-[#111827]/90 via-[#0f172a]/80 to-[#0b1020]/90 p-5 shadow-[0_0_24px_rgba(124,58,237,0.12)] md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-4">
            <div className="rounded-xl border border-brand-purple/40 bg-brand-purple/10 p-3 text-brand-purple">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Create Your Own Custom Cases</h3>
              <p className="text-sm text-gray-400">
                Create cases with items and odds of your choice. Earn up to 70% when your community opens them.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => handleAuthAction(() => setView({ type: 'CUSTOM_CREATOR' }))}
              className="rounded-full bg-brand-purple px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white transition hover:bg-purple-500"
            >
              Create Custom Case
            </button>
            <button
              type="button"
              onClick={() => {
                playSound('click');
                setActiveTab('community');
              }}
              className="rounded-full border border-white/20 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-gray-200 transition hover:border-white/40 hover:text-white"
            >
              View Your Cases
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-[#0b0f1a]/80 p-4 shadow-[0_0_18px_rgba(15,23,42,0.6)] md:flex-row md:items-center">
          <div className="relative w-full md:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-gray-500" />
            <input
              type="text"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search boxes"
              className="w-full rounded-full border border-gray-700 bg-[#0b0e14] py-2 pl-9 pr-3 text-sm text-gray-200 focus:border-brand-purple focus:outline-none"
            />
          </div>
          <div className="flex flex-1 flex-wrap items-center gap-4">
            <div className="flex min-w-[180px] flex-1 flex-col gap-2">
              <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-gray-500">
                <span>Risk</span>
                <span className="text-gray-300">{riskLabel}</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={riskValue}
                onChange={(event) => setRiskValue(Number(event.target.value))}
                className="h-2 w-full cursor-pointer appearance-none rounded-full bg-gray-800 accent-brand-purple"
              />
            </div>
            <div className="min-w-[170px] flex-1">
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Category</label>
              <select
                value={selectedCategory}
                onChange={(event) => {
                  setSelectedCategory(event.target.value);
                  setActiveTab('category');
                }}
                className="w-full rounded-full border border-gray-700 bg-[#0b0e14] px-3 py-2 text-sm text-gray-200 focus:border-brand-purple focus:outline-none"
              >
                {categoryOptions.map((option) => (
                  <option key={option} value={option}>
                    {option === 'All' ? 'All Categories' : option}
                  </option>
                ))}
              </select>
            </div>
            <div className="min-w-[160px] flex-1">
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Sort</label>
              <select
                value={sortOption}
                onChange={(event) => setSortOption(event.target.value as typeof sortOption)}
                className="w-full rounded-full border border-gray-700 bg-[#0b0e14] px-3 py-2 text-sm text-gray-200 focus:border-brand-purple focus:outline-none"
              >
                <option value="popular">Popular</option>
                <option value="price-low">Price: Low to High</option>
                <option value="price-high">Price: High to Low</option>
              </select>
            </div>
            <button
              type="button"
              onClick={() => playSound('click')}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-[#0f141f] text-gray-400 transition hover:border-white/30 hover:text-white"
              aria-label="Open advanced filters"
            >
              <SlidersHorizontal className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {sortedBoxes.length > 0 ? (
        <div className={`grid gap-4 ${gridClassName}`}>
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
          No boxes match these filters yet.
        </div>
      )}
    </section>
  );
};
