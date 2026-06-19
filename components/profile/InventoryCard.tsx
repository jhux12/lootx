import React from 'react';
import { ArrowLeftRight, MoreHorizontal, Package } from 'lucide-react';
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
    card: 'border-gray-400/35 bg-gradient-to-b from-gray-500/20 via-[#151a21] to-[#10151c]',
    badge: 'border-gray-300/45 bg-gray-500/15 text-gray-100'
  },
  uncommon: {
    card: 'border-emerald-400/45 bg-gradient-to-b from-emerald-500/20 via-[#0d211b] to-[#0b1714]',
    badge: 'border-emerald-300/55 bg-emerald-500/15 text-emerald-100'
  },
  rare: {
    card: 'border-blue-400/45 bg-gradient-to-b from-blue-500/20 via-[#101d2e] to-[#0b1421]',
    badge: 'border-blue-300/55 bg-blue-500/15 text-blue-100'
  },
  epic: {
    card: 'border-purple-400/45 bg-gradient-to-b from-purple-500/20 via-[#201333] to-[#130d20]',
    badge: 'border-purple-300/55 bg-purple-500/15 text-purple-100'
  },
  legendary: {
    card: 'border-yellow-400/55 bg-gradient-to-b from-yellow-400/22 via-[#34290e] to-[#171509]',
    badge: 'border-yellow-300/60 bg-yellow-500/15 text-yellow-100'
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
      className={`group flex min-h-[30rem] flex-col rounded-3xl border p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_18px_44px_rgba(0,0,0,0.28)] transition sm:p-5 ${rarityStyle.card} ${
        selected ? 'ring-2 ring-purple-400/70 shadow-[0_0_24px_rgba(168,85,247,0.35)]' : 'hover:shadow-[0_0_22px_rgba(255,255,255,0.08)]'
      } ${selectable ? 'cursor-pointer' : 'cursor-default'}`}
    >
      <div className="flex items-center justify-between gap-3">
        <span className={`rounded-full border px-3 py-1 text-xs font-black uppercase tracking-wide ${rarityStyle.badge}`}>{item.rarity}</span>
        <button type="button" className="rounded-lg p-1 text-gray-200 hover:bg-white/10 hover:text-white" onClick={(e) => e.stopPropagation()} aria-label={`More actions for ${item.name}`}>
          <MoreHorizontal className="h-5 w-5" />
        </button>
      </div>

      <div className="flex min-h-[13rem] flex-1 items-center justify-center py-5 sm:min-h-[16rem]">
        <BlurImage src={item.image} alt={item.name} className="max-h-64 w-full object-contain drop-shadow-[0_18px_28px_rgba(0,0,0,0.35)]" width={320} height={320} showPlaceholder={false} />
      </div>

      <div className="mt-auto">
        <p className="line-clamp-2 min-h-[3.25rem] text-xl font-black leading-tight tracking-[-0.03em] text-white">{item.name}</p>
        <CoinAmount amount={toCoins(item.price, PRICE_UNIT_MODE)} formatOptions={{ maximumFractionDigits: 0 }} className="mt-4 text-2xl font-black text-white" iconClassName="h-6 w-6" />

        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onAction();
          }}
          disabled={actionDisabled}
          className={`mt-5 flex h-14 w-full items-center justify-center gap-3 rounded-2xl border text-base font-black transition ${
            actionDisabled
              ? 'cursor-not-allowed border-white/10 bg-[#111720] text-gray-500'
              : 'border-purple-400/55 bg-purple-500/20 text-white shadow-[0_0_22px_rgba(168,85,247,0.18)] hover:bg-purple-500/30'
          }`}
        >
          <Package className="h-6 w-6" /> {actionLabel}
        </button>

        {secondaryActionLabel && onSecondaryAction && (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onSecondaryAction();
            }}
            disabled={secondaryActionDisabled}
            className={`mt-3 flex h-14 w-full items-center justify-center gap-3 rounded-2xl border text-base font-black transition ${
              secondaryActionDisabled
                ? 'cursor-not-allowed border-white/10 bg-[#111720] text-gray-500'
                : 'border-emerald-400/35 bg-emerald-500/10 text-emerald-100 hover:bg-emerald-500/20'
            }`}
          >
            <ArrowLeftRight className="h-6 w-6" /> {secondaryActionLabel}
          </button>
        )}
      </div>
    </div>
  );
};
