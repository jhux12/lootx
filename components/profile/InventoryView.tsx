import React from 'react';
import { InventoryItem } from '../../types';
import { ChevronRight, ShieldCheck, Truck } from 'lucide-react';
import { CoinAmount } from '../CoinAmount';
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
  availableToShip,
  selectedValue
}) => {
  return (
    <section className="mx-auto w-full max-w-5xl flex-1 space-y-4 pb-3">
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


      <div className="flex items-center justify-center gap-4 rounded-2xl border border-white/10 bg-[#101019] p-4 text-center shadow-[0_18px_45px_rgba(0,0,0,0.22)] sm:text-left">
        <Truck className="h-8 w-8 shrink-0 text-purple-400" />
        <div>
          <p className="text-sm font-bold text-white sm:text-base">Items shipped to you are yours to keep!</p>
          <p className="mt-1 text-sm font-semibold text-gray-400">Shipping costs are shown in coins at checkout</p>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="rounded-3xl border border-white/10 bg-[#111720] p-10 text-center text-gray-400">No items found.</div>
      ) : (
        <div className="grid grid-cols-2 gap-3 min-[520px]:grid-cols-3 sm:gap-4">
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

      <div className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-[#101019] p-4 shadow-[0_18px_45px_rgba(0,0,0,0.22)]">
        <div className="flex items-center gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-purple-500/18 text-purple-300 shadow-[0_0_24px_rgba(139,92,246,0.2)]"><ShieldCheck className="h-7 w-7" /></span>
          <div>
            <p className="text-base font-black text-white">Your security is our priority</p>
            <p className="mt-1 text-sm font-semibold text-gray-400">All shipments are fully insured</p>
          </div>
        </div>
        <ChevronRight className="h-7 w-7 shrink-0 text-gray-400" />
      </div>

      {selectedIds.length > 0 && (
        <div className="sticky bottom-16 z-30 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-purple-400/30 bg-[#111824]/95 p-3 backdrop-blur md:bottom-4">
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
