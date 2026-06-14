import React from 'react';
import { ChevronDown, Filter, Search } from 'lucide-react';

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
  type,
  onTypeChange,
  sort,
  onSortChange,
  selectedCount,
  onReviewShipping,
  reviewDisabled
}) => {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
      <label className="relative min-w-[180px] flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
        <input
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search items..."
          className="w-full rounded-xl border border-white/10 bg-[#080b15] py-3 pl-10 pr-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-purple-400/50"
        />
      </label>
      <div className="flex gap-2">
        <label className="relative min-w-[8.5rem] flex-1 sm:flex-none">
          <Filter className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-300" />
          <select value={type} onChange={(event) => onTypeChange(event.target.value)} className="w-full appearance-none rounded-xl border border-white/10 bg-[#080b15] py-3 pl-10 pr-9 text-sm font-bold text-white outline-none focus:border-purple-400/50">
            <option value="all">Filter</option><option value="available">In Inventory</option><option value="shipping">In Transit</option><option value="sold">Sold</option>
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-300" />
        </label>
        <select value={sort} onChange={(event) => onSortChange(event.target.value)} className="hidden rounded-xl border border-white/10 bg-[#080b15] px-3 py-3 text-sm text-gray-200 outline-none focus:border-purple-400/50 sm:block">
          <option value="newest">Newest</option><option value="valueDesc">Value high</option><option value="valueAsc">Value low</option><option value="nameAsc">Name</option>
        </select>
      </div>
    </div>
  );
};
