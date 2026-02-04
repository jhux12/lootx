import React, { useEffect, useMemo, useState } from 'react';
import { Tag, ChevronLeft, Search, X } from 'lucide-react';
import { useGame } from '../context/GameContext';
import { useSound } from '../context/SoundContext';
import { BoxCard } from './BoxCard';
import { getBoxTags, normalizeBoxTag } from '../utils/boxTags';

export const BoxCatalog: React.FC = () => {
  const { boxes, setView } = useGame();
  const { playSound } = useSound();
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [tagSearch, setTagSearch] = useState('');
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
    setSelectedTags(tags);
    setPriceFilter({
      min: Number.isFinite(minPrice) ? minPrice : undefined,
      max: Number.isFinite(maxPrice) ? maxPrice : undefined
    });
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
    const options = Array.from(tagStats.keys()).sort((a, b) => a.localeCompare(b));
    if (displayBoxes.some(box => box.isUserCreated)) {
      options.unshift('User Created');
    }
    return options;
  }, [displayBoxes, tagStats]);

  const filteredBoxes = useMemo(() => {
    const normalizedSelected = selectedTags
      .filter(tag => tag !== 'User Created')
      .map(normalizeBoxTag);
    const includeUserCreated = selectedTags.includes('User Created');

    return displayBoxes.filter((box) => {
      if (typeof priceFilter.min === 'number' && box.price < priceFilter.min) return false;
      if (typeof priceFilter.max === 'number' && box.price > priceFilter.max) return false;

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
  }, [displayBoxes, priceFilter.max, priceFilter.min, selectedTags]);

  const filteredTagOptions = useMemo(() => {
    const search = tagSearch.trim().toLowerCase();
    if (!search) return tagOptions;
    return tagOptions.filter(tag => tag.toLowerCase().includes(search));
  }, [tagOptions, tagSearch]);

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) => (
      prev.includes(tag)
        ? prev.filter(existing => existing !== tag)
        : [...prev, tag]
    ));
  };

  return (
    <section className="max-w-[1400px] mx-auto p-4 md:p-6 lg:p-8 animate-in fade-in duration-300">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              playSound('click');
              setView({ type: 'HOME' });
            }}
            className="flex items-center gap-2 px-3 py-1.5 bg-[#131825] rounded text-gray-400 hover:text-white text-sm font-medium transition-colors"
          >
            <ChevronLeft className="w-4 h-4" /> Back
          </button>
          <div>
            <h2 className="text-2xl font-bold text-white">All Mystery Boxes</h2>
            <p className="text-sm text-gray-400">Filter by tag to find the box you want.</p>
          </div>
        </div>
      </div>

      <div className="space-y-4 mb-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="relative w-full sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-gray-500" />
            <input
              type="text"
              value={tagSearch}
              onChange={(event) => setTagSearch(event.target.value)}
              placeholder="Search tags"
              className="w-full rounded-full border border-gray-700 bg-[#0b0e14] py-2 pl-9 pr-3 text-sm text-gray-200 focus:border-brand-purple focus:outline-none"
            />
          </div>
          {selectedTags.length > 0 && (
            <button
              type="button"
              onClick={() => {
                playSound('click');
                setSelectedTags([]);
              }}
              className="inline-flex items-center gap-2 rounded-full border border-gray-700 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400 transition hover:border-gray-500"
            >
              <X className="h-3 w-3" /> Clear filters
            </button>
          )}
        </div>

        {popularTags.length > 0 && (
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
                    className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full border text-xs font-semibold uppercase tracking-wide transition ${isSelected ? 'bg-blue-600/20 border-blue-500 text-blue-200' : 'bg-[#0b0e14] border-gray-700 text-gray-400 hover:border-gray-500'}`}
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

        <div className="flex flex-wrap gap-2">
          {filteredTagOptions.map(tag => {
            const isSelected = selectedTags.includes(tag);
            const tagCount = tag === 'User Created'
              ? displayBoxes.filter(box => box.isUserCreated).length
              : tagStats.get(tag) ?? 0;
            return (
              <button
                key={tag}
                type="button"
                onClick={() => {
                  playSound('click');
                  toggleTag(tag);
                }}
                className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full border text-xs font-semibold uppercase tracking-wide transition ${isSelected ? 'bg-blue-600/20 border-blue-500 text-blue-200' : 'bg-[#0b0e14] border-gray-700 text-gray-400 hover:border-gray-500'}`}
              >
                <Tag className="w-3 h-3" />
                {tag}
                <span className="text-[10px] text-gray-500 font-semibold">
                  ({tagCount})
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {filteredBoxes.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
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
        <div className="rounded-xl border border-dashed border-gray-800 bg-[#0b0e14] p-6 text-sm text-gray-500">
          No boxes found for this tag yet.
        </div>
      )}
    </section>
  );
};
