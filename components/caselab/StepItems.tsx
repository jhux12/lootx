import React, { useMemo, useState } from 'react';
import { Search, Check, Tag } from 'lucide-react';
import { CaseItem } from '../../types';
import { Input } from '../ui/Input';
import { CoinAmount } from '../CoinAmount';
import { SelectedItemChips } from './SelectedItemChips';

type StepItemsProps = {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  tagOptions: Array<'All' | string>;
  activeTag: 'All' | string;
  onTagChange: (tag: 'All' | string) => void;
  filteredItems: CaseItem[];
  selectedItems: CaseItem[];
  onToggleItem: (item: CaseItem) => void;
  onRemoveItem: (id: string) => void;
};

const CHIP_PREVIEW_LIMIT = 6;

export const StepItems: React.FC<StepItemsProps> = ({
  searchQuery,
  onSearchChange,
  tagOptions,
  activeTag,
  onTagChange,
  filteredItems,
  selectedItems,
  onToggleItem,
  onRemoveItem
}) => {
  const [showAllSelected, setShowAllSelected] = useState(false);
  const hasOverflow = selectedItems.length > CHIP_PREVIEW_LIMIT;

  const visibleChips = useMemo(() => {
    if (showAllSelected || !hasOverflow) return selectedItems;
    return selectedItems.slice(0, CHIP_PREVIEW_LIMIT);
  }, [hasOverflow, selectedItems, showAllSelected]);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-white/10 bg-[#121826] p-5">
        <div className="text-xs uppercase tracking-[0.3em] text-gray-500">Step 2</div>
        <h2 className="mt-2 text-2xl font-bold text-white">Add your items</h2>
        <p className="mt-1 text-sm text-gray-400">Search, filter, and tap to add items instantly.</p>

        <div className="mt-5 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
            <Input
              type="text"
              placeholder="Search items..."
              value={searchQuery}
              onChange={(event) => onSearchChange(event.target.value)}
              className="pl-9 pr-4 py-2 text-sm"
            />
          </div>

          {selectedItems.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs uppercase tracking-[0.2em] text-gray-500">
                <span>Selected items</span>
                {hasOverflow && (
                  <button
                    type="button"
                    onClick={() => setShowAllSelected((prev) => !prev)}
                    className="text-[11px] font-semibold uppercase text-purple-200 transition hover:text-white"
                  >
                    {showAllSelected ? 'Collapse' : 'View all selected'}
                  </button>
                )}
              </div>
              <SelectedItemChips items={visibleChips} onRemove={onRemoveItem} />
              {hasOverflow && !showAllSelected && (
                <p className="text-xs text-gray-500">+{selectedItems.length - CHIP_PREVIEW_LIMIT} more</p>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-[#121826] p-5">
        <div className="mb-4 text-xs uppercase tracking-[0.3em] text-gray-500">Filter by tag</div>
        <div className="flex flex-wrap gap-2">
          {tagOptions.map((tag) => {
            const isSelected = activeTag === tag;
            return (
              <button
                key={tag}
                type="button"
                onClick={() => onTagChange(tag)}
                className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide transition ${
                  isSelected
                    ? 'border-brand-purple/70 bg-brand-purple/20 text-purple-200'
                    : 'border-white/10 bg-[#0b0f16] text-gray-400 hover:border-white/30'
                }`}
              >
                <Tag className="h-3 w-3" />
                {tag}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {filteredItems.map((item) => {
          const isSelected = selectedItems.some((selected) => selected.id === item.id);
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onToggleItem(item)}
              className={`group relative rounded-xl border p-3 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple/70 ${
                isSelected
                  ? 'border-brand-purple/70 bg-brand-purple/10'
                  : 'border-white/10 bg-[#0b0f16] hover:border-white/30'
              }`}
            >
              <div className="flex flex-col items-center gap-3 text-center">
                <div className="relative">
                  <img src={item.image} alt={item.name} className="h-14 w-14 object-contain" />
                  {isSelected && (
                    <span className="absolute -right-2 -top-2 rounded-full bg-brand-purple p-1 text-white">
                      <Check className="h-3 w-3" />
                    </span>
                  )}
                </div>
                <div className="w-full">
                  <div className="truncate text-xs font-semibold text-gray-200">{item.name}</div>
                  <CoinAmount
                    amount={item.price}
                    formatOptions={{ maximumFractionDigits: 0 }}
                    className="mt-1 text-xs text-emerald-300"
                    iconClassName="h-3 w-3"
                  />
                </div>
              </div>
              {isSelected && <div className="pointer-events-none absolute inset-0 rounded-xl ring-1 ring-brand-purple/50" />}
            </button>
          );
        })}
      </div>

      {filteredItems.length === 0 && (
        <div className="rounded-xl border border-white/10 bg-[#121826] p-6 text-center text-sm text-gray-400">
          No items match your search. Try another tag or keyword.
        </div>
      )}
    </div>
  );
};
