import React, { useState } from 'react';
import { Package, Search, SlidersHorizontal } from 'lucide-react';

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
  const activeFilterCount = (rarity !== 'all' ? 1 : 0) + (sort !== 'newest' ? 1 : 0);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3">
        <label className="flex h-14 items-center gap-3 rounded-[1.05rem] border border-white/10 bg-black/18 px-4 text-gray-400 shadow-[inset_0_1px_0_rgba(255,255,255,0.025)] focus-within:border-purple-300/45 focus-within:ring-2 focus-within:ring-purple-500/20 sm:h-[4.25rem] sm:px-6">
          <Search className="h-6 w-6 shrink-0 sm:h-7 sm:w-7" />
          <input value={search} onChange={(event) => onSearchChange(event.target.value)} placeholder="Search items..." className="w-full bg-transparent text-base font-semibold text-white outline-none placeholder:text-gray-500 sm:text-2xl" />
        </label>
        <button type="button" onClick={() => setFiltersOpen((open) => !open)} className="flex h-14 items-center justify-center gap-2 rounded-[1.05rem] border border-white/10 bg-black/18 px-4 text-base font-bold text-gray-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.025)] transition hover:border-purple-300/40 hover:bg-purple-500/10 sm:h-[4.25rem] sm:px-7 sm:text-2xl" aria-expanded={filtersOpen}>
          <SlidersHorizontal className="h-5 w-5 sm:h-7 sm:w-7" /> <span className="hidden min-[390px]:inline">Filter</span>
          <span className="flex h-8 min-w-8 items-center justify-center rounded-xl bg-[#27283a] px-2 text-sm text-white sm:h-10 sm:min-w-10 sm:text-xl">{activeFilterCount}</span>
        </button>
      </div>


      <button type="button" onClick={() => setFiltersOpen((open) => !open)} className="fixed right-0 top-[58vh] z-40 flex h-16 w-16 translate-x-2 items-center justify-center rounded-full border border-white/20 bg-[#11141c]/95 text-white shadow-[0_10px_28px_rgba(0,0,0,0.45)] backdrop-blur md:hidden" aria-label="Toggle inventory filters">
        <SlidersHorizontal className="h-7 w-7" />
        {activeFilterCount > 0 ? <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-purple-400" /> : null}
      </button>

      {filtersOpen ? (
        <div className="grid gap-3 rounded-[1.05rem] border border-white/10 bg-[#101019] p-3 sm:grid-cols-2">
          <select value={rarity} onChange={(event) => onRarityChange(event.target.value)} className="h-12 rounded-xl border border-white/10 bg-[#080a10] px-3 font-bold text-white outline-none">
            {['all', 'common', 'uncommon', 'rare', 'epic', 'legendary'].map((option) => <option key={option} value={option}>{option === 'all' ? 'All Categories' : option.charAt(0).toUpperCase() + option.slice(1)}</option>)}
          </select>
          <select value={sort} onChange={(event) => onSortChange(event.target.value)} className="h-12 rounded-xl border border-white/10 bg-[#080a10] px-3 font-bold text-white outline-none">
            <option value="newest">Newest First</option><option value="valueDesc">Value High to Low</option><option value="valueAsc">Value Low to High</option><option value="nameAsc">Name A to Z</option>
          </select>
        </div>
      ) : null}

      <button type="button" onClick={onReviewShipping} disabled={reviewDisabled} className={`relative flex min-h-16 w-full items-center justify-between gap-3 rounded-[1.05rem] border border-white/10 bg-black/18 p-2 pl-4 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.025)] sm:min-h-[4.75rem] sm:pl-6 ${reviewDisabled ? 'text-gray-400' : 'text-white'}`}>
        <span className="flex min-w-0 items-center gap-3"><span className="h-8 w-8 shrink-0 rounded-lg border border-white/10 bg-black/15 sm:h-10 sm:w-10" /><span className="truncate text-base font-semibold sm:text-xl"><span className="hidden sm:inline">Select Items to </span>Ship ({selectedCount})</span></span>
        <span className="flex h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-purple-400 to-violet-600 px-4 text-sm font-black uppercase tracking-wide text-white shadow-[0_12px_32px_rgba(139,92,246,0.32)] sm:h-14 sm:px-9 sm:text-xl"><Package className="h-5 w-5 sm:h-6 sm:w-6" /> <span className="hidden min-[360px]:inline">Ship Selected</span><span className="min-[360px]:hidden">Ship</span></span>
      </button>
    </div>
  );
};
