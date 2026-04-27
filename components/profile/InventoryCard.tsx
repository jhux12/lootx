import React from 'react';
import { MoreHorizontal } from 'lucide-react';
import { InventoryItem } from '../../types';
import { BlurImage } from '../../src/ui/images/BlurImage';
import { CoinAmount } from '../CoinAmount';
import { PRICE_UNIT_MODE, toCoins } from '../../utils/coins';

interface InventoryCardProps {
  item: InventoryItem;
  selected: boolean;
  selectable: boolean;
  onToggleSelect: () => void;
  actionLabel: string;
  actionDisabled: boolean;
  onAction: () => void;
}

export const InventoryCard: React.FC<InventoryCardProps> = ({ item, selected, selectable, onToggleSelect, actionLabel, actionDisabled, onAction }) => {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => selectable && onToggleSelect()}
      onKeyDown={(event) => {
        if ((event.key === 'Enter' || event.key === ' ') && selectable) {
          event.preventDefault();
          onToggleSelect();
        }
      }}
      className={`group rounded-2xl border bg-gradient-to-b from-[#141a2c] to-[#101626] p-3 transition ${
        selected ? 'border-purple-400 bg-purple-500/10' : 'border-white/10 hover:border-purple-300/40 hover:shadow-[0_0_20px_rgba(124,58,237,0.2)]'
      } ${selectable ? 'cursor-pointer' : 'cursor-default'}`}
    >
      <div className="mb-3 flex items-center justify-between">
        <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-semibold uppercase text-gray-200">{item.rarity}</span>
        <button type="button" className="rounded-md p-1 text-gray-400 hover:bg-white/5 hover:text-white" onClick={(e) => e.stopPropagation()}>
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </div>
      <div className="mb-3 aspect-square rounded-xl bg-[#0c111d] p-3">
        <BlurImage src={item.image} alt={item.name} className="h-full w-full object-contain" />
      </div>
      <p className="line-clamp-1 text-sm font-semibold text-white">{item.name}</p>
      <CoinAmount amount={toCoins(item.price, PRICE_UNIT_MODE)} formatOptions={{ maximumFractionDigits: 0 }} className="mt-1 text-sm font-bold text-gray-100" iconClassName="h-4 w-4" />
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onAction();
        }}
        disabled={actionDisabled}
        className={`mt-3 w-full rounded-xl px-2 py-2 text-xs font-bold ${
          actionDisabled
            ? 'cursor-not-allowed border border-white/10 bg-[#0b0f1a] text-gray-500'
            : 'border border-purple-400/40 bg-purple-500/15 text-purple-100 hover:bg-purple-500/25'
        }`}
      >
        {actionLabel}
      </button>
    </div>
  );
};
