import React, { useState } from 'react';
import { InventoryItem } from '../../types';
import { Grid2X2, List, ShieldCheck } from 'lucide-react';
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
  const [layoutMode, setLayoutMode] = useState<'grid' | 'list'>('grid');

  return (
    <section className="mx-auto w-full max-w-5xl flex-1 space-y-4 pb-3">
      <header>
        <h2 className="text-[1.7rem] font-extrabold leading-tight tracking-[-0.04em] text-white sm:text-3xl">Inventory</h2>
        <p className="mt-1 text-sm font-medium text-gray-400 sm:text-base">Manage your items and view their values.</p>
      </header>

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

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-lg font-bold sm:text-xl text-white">Your Items ({items.length})</h3>
        <div className="flex rounded-2xl border border-white/10 bg-[#111720] p-1">
          <button type="button" onClick={() => setLayoutMode('grid')} className={`flex h-12 w-14 items-center justify-center rounded-xl transition ${layoutMode === 'grid' ? 'border border-purple-400/50 bg-purple-500/15 text-purple-300 shadow-[0_0_18px_rgba(168,85,247,0.2)]' : 'text-gray-500 hover:text-white'}`} aria-label="Grid view"><Grid2X2 className="h-6 w-6" /></button>
          <button type="button" onClick={() => setLayoutMode('list')} className={`flex h-12 w-14 items-center justify-center rounded-xl transition ${layoutMode === 'list' ? 'border border-purple-400/50 bg-purple-500/15 text-purple-300 shadow-[0_0_18px_rgba(168,85,247,0.2)]' : 'text-gray-500 hover:text-white'}`} aria-label="List view"><List className="h-6 w-6" /></button>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="rounded-3xl border border-white/10 bg-[#111720] p-10 text-center text-gray-400">No items found.</div>
      ) : (
        <div className={`${layoutMode === 'grid' ? 'flex flex-wrap gap-3' : 'grid grid-cols-1 gap-4'}`}>
          {items.map((item) => {
            const action = getAction(item);
            return (
              <div key={item.instanceId} className={layoutMode === 'grid' ? 'w-[calc(50%-0.375rem)] min-w-0' : 'w-full'}>
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
                layoutMode={layoutMode}
              />
              </div>
            );
          })}
        </div>
      )}

      <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-[#111824] p-4 shadow-[0_18px_45px_rgba(0,0,0,0.22)] sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <ShieldCheck className="h-9 w-9 shrink-0 text-purple-400" />
          <p className="max-w-2xl text-sm font-semibold leading-snug text-white">Items available to ship will be sent to your address on file.</p>
        </div>
        <button type="button" className="inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-bold text-purple-300 hover:bg-purple-500/10">Learn More <span aria-hidden="true">›</span></button>
      </div>

      {selectedIds.length > 0 && (
        <div className="sticky bottom-16 z-30 flex items-center justify-between rounded-2xl border border-purple-400/30 bg-[#111824]/95 p-3 backdrop-blur md:bottom-4">
          <p className="text-sm text-gray-200">{selectedIds.length} items selected</p>
          <div className="flex items-center gap-3">
            <CoinAmount amount={selectedValue} formatOptions={{ maximumFractionDigits: 0 }} className="text-sm font-bold text-white" iconClassName="h-4 w-4" />
            <button onClick={onReviewShipping} className="rounded-xl bg-gradient-to-r from-purple-600 to-violet-500 px-3 py-2 text-xs font-bold text-white">Review Shipping</button>
          </div>
        </div>
      )}
    </section>
  );
};
