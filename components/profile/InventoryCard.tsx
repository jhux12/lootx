import React from 'react';
import { Check } from 'lucide-react';
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

const RARITY_STYLES: Record<InventoryItem['rarity'], { badge: string; image: string }> = {
  common: {
    badge: 'border-gray-300/35 bg-gray-500/12 text-gray-100',
    image: 'border-white/12'
  },
  uncommon: {
    badge: 'border-emerald-300/35 bg-emerald-500/15 text-emerald-200',
    image: 'border-emerald-400/35 shadow-[0_0_24px_rgba(52,211,153,0.14)]'
  },
  rare: {
    badge: 'border-blue-300/35 bg-blue-500/15 text-blue-200',
    image: 'border-blue-400/35 shadow-[0_0_24px_rgba(96,165,250,0.14)]'
  },
  epic: {
    badge: 'border-purple-300/35 bg-purple-500/15 text-purple-200',
    image: 'border-purple-400/45 shadow-[0_0_24px_rgba(168,85,247,0.22)]'
  },
  legendary: {
    badge: 'border-yellow-300/40 bg-yellow-500/15 text-yellow-100',
    image: 'border-yellow-400/45 shadow-[0_0_24px_rgba(234,179,8,0.18)]'
  }
};

export const InventoryCard: React.FC<InventoryCardProps> = ({ item, selected, selectable, onToggleSelect, actionLabel, actionDisabled, onAction, secondaryActionLabel, secondaryActionDisabled = false, onSecondaryAction, layoutMode = 'grid' }) => {
  const rarityStyle = RARITY_STYLES[item.rarity] ?? RARITY_STYLES.common;
  const isList = layoutMode === 'list';
  const statusLabel = item.status === 'shipped' ? 'Shipped' : item.status === 'shipping' || item.status === 'shipping_requested' || item.status === 'pending_shipment' ? 'Pending' : 'Vaulted';
  const subtitle = item.brand || item.category || 'Collectible Card';

  if (isList) {
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
        className={`group relative overflow-hidden rounded-2xl border border-white/10 bg-[#101019] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_16px_38px_rgba(0,0,0,0.24)] transition ${selected ? 'border-purple-300/80 ring-4 ring-purple-400/35' : 'hover:border-purple-300/25 hover:bg-[#12121d]'} ${selectable ? 'cursor-pointer' : 'cursor-default'}`}
      >
        <div className="flex min-w-0 items-center gap-3">
          <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border-2 bg-[#0c0d14]/90 ${selected ? 'border-purple-300 text-purple-200' : 'border-gray-400/80 text-transparent'}`}>
            <Check className="h-4 w-4 stroke-[4]" />
          </span>
          <div className={`flex h-20 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border bg-[#090e16] p-1.5 sm:h-24 sm:w-20 ${rarityStyle.image}`}>
            <BlurImage src={item.image} alt={item.name} className="h-full w-full object-contain transition duration-300 group-hover:scale-[1.03]" width={160} height={190} showPlaceholder={false} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-lg border px-2 py-0.5 text-[10px] font-black capitalize ${rarityStyle.badge}`}>{item.rarity}</span>
              <span className="rounded-lg border border-purple-300/25 bg-purple-400/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-purple-200">{statusLabel}</span>
            </div>
            <p className="mt-2 line-clamp-2 text-sm font-black leading-tight text-white sm:text-base">{item.name}</p>
            <p className="mt-1 line-clamp-1 text-xs font-semibold text-gray-400">{subtitle}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={(event) => { event.stopPropagation(); onAction(); }}
                disabled={actionDisabled}
                className={`rounded-lg px-2.5 py-1.5 text-xs font-black transition ${actionDisabled ? 'cursor-not-allowed border border-white/10 bg-[#171923] text-gray-500' : 'bg-purple-500 text-white hover:bg-purple-400'}`}
              >
                {actionLabel}
              </button>
              {secondaryActionLabel && onSecondaryAction ? (
                <button type="button" onClick={(event) => { event.stopPropagation(); onSecondaryAction(); }} disabled={secondaryActionDisabled} className={`rounded-lg px-2.5 py-1.5 text-xs font-black transition ${secondaryActionDisabled ? 'cursor-not-allowed border border-white/10 bg-[#171923] text-gray-500' : 'bg-emerald-500 text-[#06130f] hover:bg-emerald-400'}`}>{secondaryActionLabel}</button>
              ) : null}
            </div>
          </div>
          <CoinAmount amount={toCoins(item.price, PRICE_UNIT_MODE)} formatOptions={{ maximumFractionDigits: 0 }} className="shrink-0 text-sm font-black text-white sm:text-lg" iconClassName="h-4 w-4 sm:h-5 sm:w-5" />
        </div>
      </div>
    );
  }

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
      className={`group relative min-h-full overflow-hidden rounded-2xl border border-white/10 bg-[#101019] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_18px_40px_rgba(0,0,0,0.26)] transition sm:p-4 ${selected ? 'border-purple-300/80 ring-4 ring-purple-400/35' : 'hover:border-purple-300/25 hover:bg-[#12121d]'} ${selectable ? 'cursor-pointer' : 'cursor-default'}`}
    >
      <span className={`absolute left-3 top-3 z-20 flex h-7 w-7 items-center justify-center rounded-lg border-2 bg-[#0c0d14]/90 sm:h-8 sm:w-8 ${selected ? 'border-purple-300 text-purple-200' : 'border-gray-400/80 text-transparent'}`}>
        <Check className="h-4 w-4 stroke-[4]" />
      </span>

      <div className={`mx-auto flex aspect-[0.74] w-full max-w-[9rem] items-center justify-center overflow-hidden rounded-xl border bg-[#090e16] p-2 sm:max-w-[11rem] ${rarityStyle.image}`}>
        <BlurImage src={item.image} alt={item.name} className="h-full w-full object-contain transition duration-300 group-hover:scale-[1.03]" width={220} height={300} showPlaceholder={false} />
      </div>

      <div className="mt-3 min-w-0">
        <p className="line-clamp-2 text-base font-black leading-tight text-white sm:text-lg">{item.name}</p>
        <p className="mt-1 line-clamp-1 text-sm font-semibold text-gray-400">{subtitle}</p>
        <span className={`mt-3 inline-flex rounded-lg border px-2.5 py-1 text-xs font-black capitalize ${rarityStyle.badge}`}>{item.rarity}</span>
        <CoinAmount amount={toCoins(item.price, PRICE_UNIT_MODE)} formatOptions={{ maximumFractionDigits: 0 }} className="mt-4 text-lg font-black text-white sm:text-xl" iconClassName="h-5 w-5 sm:h-6 sm:w-6" />
      </div>
    </div>
  );
};
