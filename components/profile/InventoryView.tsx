import React from 'react';
import { InventoryItem } from '../../types';
import { CoinAmount } from '../CoinAmount';
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
    <section className={`w-full space-y-4 bg-[#08080a] px-5 sm:px-7 ${selectedIds.length > 0 ? 'pb-36 md:pb-5' : 'pb-5'}`}>

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
        <div className="rounded-3xl border border-white/10 bg-[#111114] p-10 text-center text-gray-400">No items found.</div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((item) => {
            const action = getAction(item);
            return (
              <div key={item.instanceId} className="min-w-0">
              <InventoryCard
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
                layoutMode="grid"
              />
              </div>
            );
          })}
        </div>
      )}



      {selectedIds.length > 0 && (
        <div className="fixed inset-x-3 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-30 mx-auto flex max-w-[30rem] flex-wrap items-center justify-between gap-3 rounded-2xl border border-purple-400/30 bg-[#111824]/95 p-3 shadow-[0_18px_45px_rgba(0,0,0,0.55)] backdrop-blur md:sticky md:inset-auto md:bottom-4 md:max-w-none">
          <p className="text-sm text-gray-200">{selectedIds.length} items selected</p>
          <div className="flex min-w-0 flex-1 items-center justify-end gap-3 sm:flex-none">
            <CoinAmount amount={selectedValue} formatOptions={{ maximumFractionDigits: 0 }} className="text-sm font-bold text-white" iconClassName="h-4 w-4" />
            <button onClick={onReviewShipping} className="group/review relative inline-flex min-h-10 items-center justify-center overflow-hidden rounded-[10px] border border-purple-300/45 bg-[linear-gradient(135deg,rgba(147,51,234,0.95)_0%,rgba(124,58,237,0.9)_100%)] px-3 py-2 text-xs font-black text-white shadow-[0_14px_34px_rgba(147,51,234,0.24)] outline-none transition-all duration-200 hover:scale-[1.01] hover:border-purple-200/65 focus-visible:ring-2 focus-visible:ring-white/75 focus-visible:ring-offset-2 focus-visible:ring-offset-[#111824] active:scale-[0.99]"><span aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_0%,rgba(255,255,255,0.28),transparent_32%)] opacity-75 transition-opacity group-hover/review:opacity-95" /><span className="relative z-10 whitespace-nowrap">Review Shipping</span></button>
          </div>
        </div>
      )}
    </section>
  );
};
