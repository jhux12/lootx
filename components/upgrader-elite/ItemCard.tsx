import React from 'react';
import { RARITY_BG, RARITY_COLORS } from './constants';
import { Item } from './types';
import { CoinAmount } from '../CoinAmount';

interface ItemCardProps {
  item: Item;
  isSelected?: boolean;
  onClick?: () => void;
  onInfoClick?: (item: Item) => void;
  disabled?: boolean;
}

export const ItemCard: React.FC<ItemCardProps> = ({ item, isSelected, onClick, onInfoClick, disabled }) => (
  <div className="relative">
    {onInfoClick && (
      <button
        type="button"
        aria-label={`View ${item.name} details`}
        onClick={(event) => {
          event.stopPropagation();
          onInfoClick(item);
        }}
        className="absolute left-2 top-2 z-20 flex h-6 w-6 items-center justify-center rounded-full border border-white/25 bg-black/65 text-[11px] font-black text-white shadow-lg transition hover:bg-black/80 active:scale-95"
      >
        i
      </button>
    )}

    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`
        relative group flex w-full flex-col items-center rounded-xl border p-2 transition-all duration-300 sm:p-3
        ${isSelected ? 'ring-2 ring-white border-transparent' : 'border-white/10 hover:border-white/30'}
        ${RARITY_BG[item.rarity]}
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer active:scale-95'}
      `}
    >
      <div className="absolute right-2 top-2 max-w-[72%] sm:max-w-none">
        <CoinAmount
          amount={Math.round(item.price)}
          className="max-w-full truncate text-[10px] font-mono opacity-70 sm:max-w-none"
          iconClassName="h-3 w-3 shrink-0"
        />
      </div>

      <div className="relative mb-2 h-20 w-20 overflow-hidden rounded-lg sm:h-24 sm:w-24">
        <img
          src={item.image}
          alt={item.name}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
      </div>

      <div className="max-w-full text-center">
        <p className="w-[82px] truncate text-xs font-medium text-white sm:w-24">{item.name}</p>
        <p className={`text-[9px] font-bold uppercase tracking-widest ${RARITY_COLORS[item.rarity]}`}>{item.rarity}</p>
      </div>
    </button>
  </div>
);
