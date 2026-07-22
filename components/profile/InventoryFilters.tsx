import React, { useState } from 'react';
import { ChevronDown, Search, SlidersHorizontal } from 'lucide-react';

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

const selectClass = 'h-10 w-full appearance-none rounded-lg border border-white/10 bg-[#19191d] px-3 pr-8 text-xs font-bold text-white outline-none focus:border-white/30';

export const InventoryFilters: React.FC<InventoryFiltersProps> = ({ search, onSearchChange, rarity, onRarityChange, sort, onSortChange }) => {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const activeFilterCount = (rarity !== 'all' ? 1 : 0) + (sort !== 'newest' ? 1 : 0);
  const label = rarity === 'all' ? 'All Items' : rarity.charAt(0).toUpperCase() + rarity.slice(1);

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <button type="button" onClick={() => setFiltersOpen((open) => !open)} className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-[#1a1a1e] px-3 py-2 text-xs font-bold text-[#b8b8be] transition hover:bg-[#242429]" aria-expanded={filtersOpen}>
          <SlidersHorizontal className="h-3.5 w-3.5" /> {label}{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''} <ChevronDown className={`h-3.5 w-3.5 transition ${filtersOpen ? 'rotate-180' : ''}`} />
        </button>
        <label className="flex h-9 w-9 items-center justify-center rounded-full text-[#77777e] transition hover:bg-white/5 hover:text-white focus-within:bg-white/5">
          <Search className="h-4 w-4" />
          <input value={search} onChange={(event) => onSearchChange(event.target.value)} placeholder="Search inventory" aria-label="Search inventory" className="sr-only" />
        </label>
      </div>
      {filtersOpen ? (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <label className="relative"><span className="sr-only">Rarity</span><select value={rarity} onChange={(event) => onRarityChange(event.target.value)} className={selectClass}>{['all', 'common', 'uncommon', 'rare', 'epic', 'legendary'].map((value) => <option key={value} value={value}>{value === 'all' ? 'All Items' : value}</option>)}</select><ChevronDown className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-gray-400" /></label>
          <label className="relative"><span className="sr-only">Sort inventory</span><select value={sort} onChange={(event) => onSortChange(event.target.value)} className={selectClass}><option value="newest">Newest First</option><option value="valueDesc">Value High to Low</option><option value="valueAsc">Value Low to High</option><option value="nameAsc">Name A to Z</option></select><ChevronDown className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-gray-400" /></label>
          <label className="sm:col-span-2"><span className="mb-1 block text-xs font-bold text-gray-500">Search</span><input value={search} onChange={(event) => onSearchChange(event.target.value)} placeholder="Search inventory" className={selectClass} /></label>
        </div>
      ) : null}
    </div>
  );
};
