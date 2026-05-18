import React from 'react';
import { Item } from './types';
import { CoinAmount } from '../CoinAmount';

interface ItemCardProps {
  item: Item;
  isSelected?: boolean;
  onClick?: () => void;
  onInfoClick?: (item: Item) => void;
  disabled?: boolean;
  quantityBadge?: number;
  hintLabel?: string;
  tone?: 'source' | 'target';
}

export const ItemCard: React.FC<ItemCardProps> = ({ item, isSelected, onClick, onInfoClick, disabled, quantityBadge, hintLabel }) => (
  <div className="relative">
    {quantityBadge && quantityBadge > 1 && (
      <span className="absolute left-2 top-2 z-20 rounded-full border border-blue-200/30 bg-[#1a2449] px-2 py-0.5 text-[10px] font-bold text-blue-100">
        x{quantityBadge}
      </span>
    )}
    {onInfoClick && (
      <button
        type="button"
        aria-label={`View ${item.name} details`}
        onClick={(event) => {
          event.stopPropagation();
          onInfoClick(item);
        }}
        className="absolute right-2 top-2 z-20 flex h-6 w-6 items-center justify-center rounded-full border border-blue-300/25 bg-[#070c1a]/90 text-[10px] font-bold text-slate-200 transition hover:bg-[#0d1530]"
      >
        i
      </button>
    )}

    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`group relative flex w-full flex-col items-center justify-start overflow-visible bg-transparent p-1.5 text-center transition duration-200 sm:p-2 ${isSelected ? 'scale-[1.01]' : ''} ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:-translate-y-0.5 hover:scale-[1.02] active:scale-[0.99]'}`}
    >
      <div className="relative mt-1 flex h-20 items-center justify-center sm:h-24">
        <img src={item.image} alt={item.name} className="relative z-10 h-[72px] w-[72px] object-contain transition-transform duration-200 group-hover:scale-105 sm:h-[88px] sm:w-[88px]" referrerPolicy="no-referrer" />
      </div>
      <p className="mt-2 w-full truncate text-[11px] font-semibold text-slate-100">{item.name}</p>
      <CoinAmount amount={Math.round(item.price)} className="mt-1 justify-center text-xs font-bold text-slate-200" iconClassName="h-3.5 w-3.5" />
      {hintLabel && (
        <div className="mt-1">
          <span className="rounded-full border border-white/20 bg-white/5 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-slate-300">
            {hintLabel}
          </span>
        </div>
      )}
    </button>
  </div>
);
