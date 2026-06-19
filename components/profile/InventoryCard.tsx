import React from 'react';
import { ArrowLeftRight, Check, MoreHorizontal, Package } from 'lucide-react';
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
  layoutMode?: 'grid' | 'list';
}

const RARITY_STYLES: Record<InventoryItem['rarity'], { card: string; badge: string; image: string }> = {
  common: {
    card: 'border-gray-400/35 bg-gradient-to-b from-gray-500/14 via-[#151a21] to-[#10151c]',
    badge: 'border-gray-300/45 bg-gray-500/15 text-gray-100',
    image: 'border-white/12'
  },
  uncommon: {
    card: 'border-emerald-400/45 bg-gradient-to-b from-emerald-500/16 via-[#0d211b] to-[#0b1714]',
    badge: 'border-emerald-300/55 bg-emerald-500/15 text-emerald-100',
    image: 'border-emerald-400/35 shadow-[0_0_24px_rgba(52,211,153,0.14)]'
  },
  rare: {
    card: 'border-blue-400/45 bg-gradient-to-b from-blue-500/16 via-[#101d2e] to-[#0b1421]',
    badge: 'border-blue-300/55 bg-blue-500/15 text-blue-100',
    image: 'border-blue-400/35 shadow-[0_0_24px_rgba(96,165,250,0.14)]'
  },
  epic: {
    card: 'border-purple-400/45 bg-gradient-to-b from-purple-500/16 via-[#201333] to-[#130d20]',
    badge: 'border-purple-300/55 bg-purple-500/15 text-purple-100',
    image: 'border-purple-400/45 shadow-[0_0_24px_rgba(168,85,247,0.22)]'
  },
  legendary: {
    card: 'border-yellow-400/55 bg-gradient-to-b from-yellow-400/18 via-[#34290e] to-[#171509]',
    badge: 'border-yellow-300/60 bg-yellow-500/15 text-yellow-100',
    image: 'border-yellow-400/45 shadow-[0_0_24px_rgba(234,179,8,0.18)]'
  }
};

export const InventoryCard: React.FC<InventoryCardProps> = ({ item, selected, selectable, onToggleSelect, actionLabel, actionDisabled, onAction, secondaryActionLabel, secondaryActionDisabled = false, onSecondaryAction, layoutMode = 'grid' }) => {
  const rarityStyle = RARITY_STYLES[item.rarity] ?? RARITY_STYLES.common;
  const isList = layoutMode === 'list';

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
      className={`group relative rounded-3xl border p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_18px_44px_rgba(0,0,0,0.22)] transition sm:p-4 ${isList ? 'sm:grid sm:grid-cols-[9rem_minmax(0,1fr)_12rem] sm:items-center sm:gap-4' : 'flex flex-col'} ${rarityStyle.card} ${
        selected ? 'border-purple-300/80 ring-4 ring-purple-400/45 shadow-[0_0_34px_rgba(168,85,247,0.42)]' : 'hover:shadow-[0_0_22px_rgba(255,255,255,0.08)]'
      } ${selectable ? 'cursor-pointer' : 'cursor-default'}`}
    >
      {selected ? (
        <span className="absolute right-3 top-3 z-20 flex h-7 w-7 items-center justify-center rounded-full bg-purple-500 text-white shadow-[0_0_18px_rgba(168,85,247,0.65)]">
          <Check className="h-4 w-4 stroke-[4]" />
        </span>
      ) : null}

      <div className={`${isList ? 'mb-3 sm:mb-0' : 'mb-3'} flex items-center justify-between gap-3 sm:col-span-full ${isList ? 'sm:hidden' : ''}`}>
        <span className={`rounded-md border px-2.5 py-1 text-[10px] font-black uppercase tracking-wide ${rarityStyle.badge}`}>{item.rarity}</span>
        <button type="button" className="rounded-lg p-1 text-gray-200 hover:bg-white/10 hover:text-white" onClick={(e) => e.stopPropagation()} aria-label={`More actions for ${item.name}`}>
          <MoreHorizontal className="h-5 w-5" />
        </button>
      </div>

      <div className={`flex aspect-square items-center justify-center overflow-hidden rounded-2xl border bg-[#090e16] p-3 ${rarityStyle.image} ${isList ? 'mx-auto mb-3 w-full max-w-[9rem] sm:mb-0' : 'mb-3 w-full'}`}>
        <BlurImage src={item.image} alt={item.name} className="h-full w-full object-contain transition duration-300 group-hover:scale-[1.03]" width={220} height={220} showPlaceholder={false} />
      </div>

      <div className="min-w-0">
        <div className={`hidden items-center justify-between gap-3 ${isList ? 'sm:flex' : ''}`}>
          <span className={`rounded-md border px-2.5 py-1 text-[10px] font-black uppercase tracking-wide ${rarityStyle.badge}`}>{item.rarity}</span>
          <button type="button" className="rounded-lg p-1 text-gray-200 hover:bg-white/10 hover:text-white" onClick={(e) => e.stopPropagation()} aria-label={`More actions for ${item.name}`}>
            <MoreHorizontal className="h-5 w-5" />
          </button>
        </div>
        <p className="mt-3 line-clamp-2 text-lg font-black leading-tight tracking-[-0.03em] text-white sm:text-xl">{item.name}</p>
        <CoinAmount amount={toCoins(item.price, PRICE_UNIT_MODE)} formatOptions={{ maximumFractionDigits: 0 }} className="mt-3 text-sm font-bold text-white" iconClassName="h-5 w-5" />
      </div>

      <div className={`mt-3 ${isList ? 'sm:mt-0' : 'mt-auto pt-1'}`}>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onAction();
          }}
          disabled={actionDisabled}
          className={`flex h-12 w-full items-center justify-center gap-2 rounded-2xl border text-sm font-black transition ${
            actionDisabled
              ? 'cursor-not-allowed border-white/10 bg-[#111720] text-gray-500'
              : 'border-purple-400/55 bg-purple-500/20 text-white shadow-[0_0_22px_rgba(168,85,247,0.18)] hover:bg-purple-500/30'
          }`}
        >
          <Package className="h-5 w-5" /> {actionLabel}
        </button>

        {secondaryActionLabel && onSecondaryAction && (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onSecondaryAction();
            }}
            disabled={secondaryActionDisabled}
            className={`mt-2 flex h-12 w-full items-center justify-center gap-2 rounded-2xl border text-sm font-black transition ${
              secondaryActionDisabled
                ? 'cursor-not-allowed border-white/10 bg-[#111720] text-gray-500'
                : 'border-emerald-400/35 bg-emerald-500/10 text-emerald-100 hover:bg-emerald-500/20'
            }`}
          >
            <ArrowLeftRight className="h-5 w-5" /> {secondaryActionLabel}
          </button>
        )}
      </div>
    </div>
  );
};
