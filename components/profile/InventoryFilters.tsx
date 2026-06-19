import React from 'react';
import { Search } from 'lucide-react';

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
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-white/10 bg-[#1f252c] p-3">
      <label className="relative min-w-[180px] flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
        <input
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search inventory"
          className="w-full rounded-xl border border-white/10 bg-[#2a323b] py-2 pl-9 pr-3 text-sm text-white outline-none focus:border-blue-400/40"
        />
      </label>
      {[
        { value: rarity, onChange: onRarityChange, options: ['all', 'common', 'uncommon', 'rare', 'epic', 'legendary'] },
        { value: type, onChange: onTypeChange, options: ['all', 'available', 'shipping', 'shipped'] },
        { value: sort, onChange: onSortChange, options: ['newest', 'valueDesc', 'valueAsc', 'nameAsc'] }
      ].map((filter, index) => (
        <select
          key={index}
          value={filter.value}
          onChange={(event) => filter.onChange(event.target.value)}
          className="rounded-xl border border-white/10 bg-[#2a323b] px-3 py-2 text-sm text-gray-200 outline-none focus:border-blue-400/40"
        >
          {filter.options.map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
      ))}
      <button
        type="button"
        onClick={onReviewShipping}
        disabled={reviewDisabled}
        className={`ml-auto rounded-xl px-4 py-2 text-sm font-bold ${
          reviewDisabled
            ? 'cursor-not-allowed border border-white/10 bg-[#2a323b] text-gray-500'
            : 'bg-gradient-to-r from-[#205DD7] to-sky-500 text-white shadow-[0_8px_20px_rgba(32,93,215,0.35)]'
        }`}
      >
        Review Shipping ({selectedCount})
      </button>
    </div>
  );
};
