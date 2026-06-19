import React, { useState } from 'react';
import { ChevronDown, Package, Search, SlidersHorizontal } from 'lucide-react';

interface InventoryFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  rarity: string;
  onRarityChange: (value: string) => void;
  type: string;
  onTypeChange: (value: string) => void;
  sort: string;
  onSortChange: (value: string) => void;
  selectedCount: number;
  onReviewShipping: () => void;
  reviewDisabled: boolean;
}

const selectClass = 'h-14 w-full appearance-none rounded-2xl border border-white/10 bg-[#111720] px-4 pr-10 text-sm font-bold text-white outline-none transition focus:border-purple-300/40 focus:ring-2 focus:ring-purple-500/20';

export const InventoryFilters: React.FC<InventoryFiltersProps> = ({
  search,
  onSearchChange,
  rarity,
  onRarityChange,
  sort,
  onSortChange,
  selectedCount,
  onReviewShipping,
  reviewDisabled
}) => {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filters = [
    { value: rarity, onChange: onRarityChange, label: 'All Categories', options: ['all', 'common', 'uncommon', 'rare', 'epic', 'legendary'] },
    { value: sort, onChange: onSortChange, label: 'Newest First', options: ['newest', 'valueDesc', 'valueAsc', 'nameAsc'] }
  ];

  const displayLabel = (option: string, fallback: string) => {
    if (option === 'all') return fallback;
    if (option === 'valueDesc') return 'Value High to Low';
    if (option === 'valueAsc') return 'Value Low to High';
    if (option === 'nameAsc') return 'Name A to Z';
    if (option === 'newest') return 'Newest First';
    return option.charAt(0).toUpperCase() + option.slice(1);
  };

  const activeFilterCount = (rarity !== 'all' ? 1 : 0) + (sort !== 'newest' ? 1 : 0);

  return (
    <div className="rounded-3xl border border-white/10 bg-[#0d131c]/80 p-3 shadow-[0_24px_70px_rgba(0,0,0,0.28)] sm:p-5">
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
        <label className="flex h-14 items-center gap-3 rounded-2xl border border-white/10 bg-[#111720] px-4 text-gray-400 focus-within:border-purple-300/40 focus-within:ring-2 focus-within:ring-purple-500/20">
          <Search className="h-5 w-5 shrink-0" />
          <input value={search} onChange={(event) => onSearchChange(event.target.value)} placeholder="Search your inventory..." className="w-full bg-transparent text-sm font-semibold text-white outline-none placeholder:text-gray-500 sm:text-base" />
        </label>
        <button type="button" onClick={() => setFiltersOpen((open) => !open)} className="flex h-14 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-[#111720] px-4 text-sm font-bold text-white transition hover:border-purple-300/40 hover:bg-purple-500/10" aria-expanded={filtersOpen}>
          <SlidersHorizontal className="h-4 w-4" /> Options
          {activeFilterCount > 0 ? <span className="flex h-6 w-6 items-center justify-center rounded-full bg-purple-500 text-xs text-white">{activeFilterCount}</span> : null}
          <ChevronDown className={`h-4 w-4 transition-transform ${filtersOpen ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {filtersOpen ? (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {filters.map((filter) => (
            <div key={filter.label} className="relative">
              <select value={filter.value} onChange={(event) => filter.onChange(event.target.value)} className={selectClass}>
                {filter.options.map((option) => <option key={option} value={option}>{displayLabel(option, filter.label)}</option>)}
              </select>
              <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-300" />
            </div>
          ))}
        </div>
      ) : null}

      <button type="button" onClick={onReviewShipping} disabled={reviewDisabled} className={`mt-3 flex h-14 w-full items-center justify-center gap-3 rounded-2xl border text-sm font-black transition sm:text-base ${reviewDisabled ? 'cursor-not-allowed border-white/10 bg-[#111720] text-gray-500' : 'border-purple-400/40 bg-purple-500/15 text-white shadow-[0_0_20px_rgba(168,85,247,0.18)] hover:bg-purple-500/25'}`}>
        <Package className="h-5 w-5" /> Review Shipping ({selectedCount}) <ChevronDown className="h-4 w-4 -rotate-90" />
      </button>
    </div>
  );
};
