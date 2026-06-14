import React from 'react';
import { InventoryItem } from '../../types';

import { InventoryFilters } from './InventoryFilters';
import { InventoryCard } from './InventoryCard';

interface InventoryViewProps {
  items: InventoryItem[];
  selectedIds: string[];
  onToggleSelect: (id: string) => void;
  onReviewShipping: () => void;
  search: string;
  setSearch: (value: string) => void;
  rarity: string;
  setRarity: (value: string) => void;
  type: string;
  setType: (value: string) => void;
  sort: string;
  setSort: (value: string) => void;
  getAction: (item: InventoryItem) => { label: string; disabled: boolean; onClick: () => void; secondaryLabel?: string; secondaryDisabled?: boolean; onSecondaryClick?: () => void };
  isSelectable: (item: InventoryItem) => boolean;
  totalValue: number;
  availableToShip: number;
  selectedValue: number;
}

export const InventoryView: React.FC<InventoryViewProps> = ({
  items,
  selectedIds,
  onToggleSelect,
  onReviewShipping,
  search,
  setSearch,
  rarity,
  setRarity,
  type,
  setType,
  sort,
  setSort,
  getAction,
  isSelectable,
  totalValue,
  availableToShip,
  selectedValue
}) => {
  return (
    <section className="flex-1 space-y-4">

      <div className="flex overflow-x-auto border-b border-white/10 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {[{ label: 'Inventory', value: 'all' }, { label: 'In Inventory', value: 'available' }, { label: 'In Transit', value: 'shipping' }, { label: 'Sold', value: 'sold' }].map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => setType(tab.value)}
            className={`shrink-0 px-6 py-3 text-sm font-bold sm:text-base ${type === tab.value ? 'border-b-2 border-[#8b5cf6] text-white' : 'text-slate-400'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <InventoryFilters
        search={search}
        onSearchChange={setSearch}
        rarity={rarity}
        onRarityChange={setRarity}
        type={type}
        onTypeChange={setType}
        sort={sort}
        onSortChange={setSort}
        selectedCount={selectedIds.length}
        onReviewShipping={onReviewShipping}
        reviewDisabled={selectedIds.length === 0}
      />

      {items.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-[#1f252c] p-10 text-center text-gray-400">No items found.</div>
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {items.map((item) => {
            const action = getAction(item);
            return (
              <InventoryCard
                key={item.instanceId}
                item={item}
                selected={selectedIds.includes(item.instanceId)}
                selectable={isSelectable(item)}
                onToggleSelect={() => onToggleSelect(item.instanceId)}
                actionLabel={action.label}
                actionDisabled={action.disabled}
                onAction={action.onClick}
                secondaryActionLabel={action.secondaryLabel}
                secondaryActionDisabled={action.secondaryDisabled}
                onSecondaryAction={action.onSecondaryClick}
              />
            );
          })}
        </div>
      )}

      {selectedIds.length > 0 && (
        <div className="sticky bottom-16 z-30 flex items-center justify-between rounded-2xl border border-blue-400/30 bg-[#1f252c]/95 p-3 backdrop-blur md:bottom-4">
          <p className="text-sm text-gray-200">{selectedIds.length} items selected</p>
          <div className="flex items-center gap-3">
            <CoinAmount amount={selectedValue} formatOptions={{ maximumFractionDigits: 0 }} className="text-sm font-bold text-white" iconClassName="h-4 w-4" />
            <button onClick={onReviewShipping} className="rounded-xl bg-gradient-to-r from-[#205DD7] to-sky-500 px-3 py-2 text-xs font-bold text-white">Review Shipping</button>
          </div>
        </div>
      )}
    </section>
  );
};
