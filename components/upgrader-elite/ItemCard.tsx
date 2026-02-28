import React from 'react';
import { RARITY_BG, RARITY_COLORS } from './constants';
import { Item } from './types';
import { CoinAmount } from '../CoinAmount';

interface ItemCardProps {
  item: Item;
  isSelected?: boolean;
  onClick?: () => void;
  disabled?: boolean;
}

export const ItemCard: React.FC<ItemCardProps> = ({ item, isSelected, onClick, disabled }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={`
      relative group flex flex-col items-center p-2 sm:p-3 rounded-xl border transition-all duration-300
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

    <div className="w-20 h-20 sm:w-24 sm:h-24 mb-2 relative overflow-hidden rounded-lg">
      <img
        src={item.image}
        alt={item.name}
        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
        referrerPolicy="no-referrer"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
    </div>

    <div className="text-center max-w-full">
      <p className="text-xs font-medium text-white truncate w-[82px] sm:w-24">{item.name}</p>
      <p className={`text-[9px] uppercase tracking-widest font-bold ${RARITY_COLORS[item.rarity]}`}>{item.rarity}</p>
    </div>
  </button>
);
