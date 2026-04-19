import React from 'react';
import { RARITY_COLORS } from './constants';
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

export const ItemCard: React.FC<ItemCardProps> = ({ item, isSelected, onClick, onInfoClick, disabled, quantityBadge, hintLabel, tone = 'target' }) => (
  <div className="relative">
    {quantityBadge && quantityBadge > 1 && (
      <span className="absolute left-2 top-2 z-20 rounded-full border border-indigo-200/30 bg-[#1a2449] px-2 py-0.5 text-[10px] font-bold text-indigo-100">
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
        className="absolute right-2 top-2 z-20 flex h-6 w-6 items-center justify-center rounded-full border border-indigo-300/25 bg-[#070c1a]/90 text-[10px] font-bold text-slate-200 transition hover:bg-[#0d1530]"
      >
        i
      </button>
    )}

    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`group relative flex w-full flex-col overflow-hidden rounded-xl border p-2.5 text-left transition duration-300 sm:p-3
        ${isSelected ? 'scale-[1.015] border-cyan-300/80 bg-[#151f46] ring-2 ring-cyan-300/40 shadow-[0_0_20px_rgba(34,211,238,0.22)]' : tone === 'source' ? 'border-indigo-300/15 bg-gradient-to-b from-[#0e152f] to-[#0a1024] hover:scale-[1.006] hover:border-indigo-300/30' : 'border-indigo-200/30 bg-gradient-to-b from-[#131d3f] to-[#0d1530] hover:scale-[1.012] hover:border-cyan-200/55 hover:shadow-[0_0_20px_rgba(34,211,238,0.15)]'}
        ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer active:scale-[0.99]'}
      `}
    >
      <p className="truncate pr-8 text-[11px] font-semibold text-slate-100">{item.name}</p>
      <p className={`mt-0.5 text-[9px] font-bold uppercase tracking-[0.16em] ${RARITY_COLORS[item.rarity]}`}>{item.rarity}</p>

      <div className="relative mt-2 flex h-20 items-center justify-center rounded-lg border border-indigo-300/15 bg-[#050914] sm:h-24">
        <div className="pointer-events-none absolute inset-x-8 bottom-2 h-4 rounded-[999px] bg-indigo-400/20 blur-md" />
        <img
          src={item.image}
          alt={item.name}
          className="relative z-10 h-16 w-16 object-contain transition-transform duration-300 group-hover:scale-105 sm:h-20 sm:w-20"
          referrerPolicy="no-referrer"
        />
      </div>

      <div className="mt-2 rounded-md border border-indigo-300/20 bg-[#0b132d] px-2 py-1">
        <CoinAmount amount={Math.round(item.price)} className="text-[11px] font-semibold text-slate-100" iconClassName="h-3 w-3" />
      </div>
      {hintLabel && (
        <div className="mt-1.5">
          <span className="rounded-full border border-cyan-300/35 bg-cyan-400/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-cyan-200">
            {hintLabel}
          </span>
        </div>
      )}
    </button>
  </div>
);
