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
  secondaryActionLabel?: string;
  secondaryActionDisabled?: boolean;
  onSecondaryAction?: () => void;
}

const RARITY_STYLES: Record<InventoryItem['rarity'], { card: string; badge: string }> = {
  common: {
    card: 'border-slate-400/30 bg-gradient-to-b from-slate-500/20 to-slate-900/40',
    badge: 'border-slate-300/40 bg-slate-500/20 text-slate-100'
  },
  uncommon: {
    card: 'border-emerald-400/40 bg-gradient-to-b from-emerald-500/20 to-emerald-950/40',
    badge: 'border-emerald-300/50 bg-emerald-500/20 text-emerald-100'
  },
  rare: {
    card: 'border-blue-400/45 bg-gradient-to-b from-blue-500/20 to-blue-950/40',
    badge: 'border-blue-300/50 bg-blue-500/20 text-blue-100'
  },
  epic: {
    card: 'border-blue-400/45 bg-gradient-to-b from-[#205DD7]/20 to-blue-950/45',
    badge: 'border-blue-300/50 bg-blue-500/20 text-blue-100'
  },
  legendary: {
    card: 'border-amber-400/55 bg-gradient-to-b from-amber-400/25 to-amber-950/45',
    badge: 'border-amber-300/60 bg-amber-500/20 text-amber-100'
  }
};

export const InventoryCard: React.FC<InventoryCardProps> = ({ item, selected, selectable, onToggleSelect, actionLabel, actionDisabled, onAction, secondaryActionLabel, secondaryActionDisabled = false, onSecondaryAction }) => {
  const rarityStyle = RARITY_STYLES[item.rarity] ?? RARITY_STYLES.common;

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
      className={`group rounded-2xl border p-3 transition ${rarityStyle.card} ${
        selected ? 'ring-2 ring-blue-400/60 shadow-[0_0_18px_rgba(32,93,215,0.35)]' : 'hover:shadow-[0_0_18px_rgba(255,255,255,0.08)]'
      } ${selectable ? 'cursor-pointer' : 'cursor-default'}`}
    >
      <div className="mb-3 flex items-center justify-between">
        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${rarityStyle.badge}`}>{item.rarity}</span>
        <button type="button" className="rounded-md p-1 text-gray-300 hover:bg-white/10 hover:text-white" onClick={(e) => e.stopPropagation()}>
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </div>
      <div className="mb-3 aspect-square rounded-xl bg-[#2a323b] p-3">
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
            ? 'cursor-not-allowed border border-white/10 bg-[#2a323b] text-gray-500'
            : 'border border-blue-400/40 bg-blue-500/15 text-blue-100 hover:bg-blue-500/25'
        }`}
      >
        {actionLabel}
      </button>

      {secondaryActionLabel && onSecondaryAction && (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onSecondaryAction();
          }}
          disabled={secondaryActionDisabled}
          className={`mt-2 w-full rounded-xl px-2 py-2 text-xs font-bold ${
            secondaryActionDisabled
              ? 'cursor-not-allowed border border-white/10 bg-[#2a323b] text-gray-500'
              : 'border border-emerald-400/40 bg-emerald-500/10 text-emerald-100 hover:bg-emerald-500/20'
          }`}
        >
          {secondaryActionLabel}
        </button>
      )}

    </div>
  );
};
