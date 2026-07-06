import React from 'react';
import { InventoryItem } from '../../types';
import { ChevronRight, ShieldCheck } from 'lucide-react';
import { InventoryStats } from './InventoryStats';
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
  availableToShip
}) => {
  return (
    <section className="mx-auto w-full max-w-5xl flex-1 space-y-5 pb-24 sm:space-y-6 md:pb-6">

      <InventoryStats totalItems={items.length} totalValue={totalValue} availableToShip={availableToShip} />

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
        <div className="rounded-3xl border border-white/10 bg-[#111720] p-10 text-center text-gray-400">No items found.</div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-5">
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
              />
              </div>
            );
          })}
        </div>
      )}

      <div className="rounded-[1.15rem] border border-white/10 bg-[#101019]/88 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.035),0_18px_38px_rgba(0,0,0,0.24)] sm:p-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-purple-500/18 text-purple-300 shadow-[0_0_28px_rgba(139,92,246,0.28)] sm:h-[4.25rem] sm:w-[4.25rem]"><ShieldCheck className="h-8 w-8" /></div>
            <div className="min-w-0"><p className="text-base font-black leading-tight text-white sm:text-2xl">Your security is our priority</p><p className="mt-1 text-sm font-semibold text-gray-400 sm:text-xl">All shipments are fully insured</p></div>
          </div>
          <ChevronRight className="h-7 w-7 shrink-0 text-gray-400 sm:h-9 sm:w-9" />
        </div>
      </div>

    </section>
  );
};
