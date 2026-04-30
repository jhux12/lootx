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
      className={`group relative flex w-full flex-col overflow-hidden rounded-xl border p-2.5 text-left transition duration-200 sm:p-3
        ${isSelected ? 'scale-[1.01] border-cyan-300/75 bg-[#141b37] shadow-[0_0_24px_rgba(56,189,248,0.24)]' : tone === 'source' ? 'border-violet-300/20 bg-gradient-to-b from-[#0e1329] to-[#090f1f] hover:border-violet-300/35' : 'border-indigo-200/20 bg-gradient-to-b from-[#111731] to-[#0a0f22] hover:border-cyan-200/40 hover:shadow-[0_0_16px_rgba(103,232,249,0.16)]'}
        ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:-translate-y-0.5 hover:scale-[1.02] active:scale-[0.99]'}
      `}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(139,92,246,0.16),transparent_55%)] opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
      <p className="relative truncate pr-8 text-[11px] font-semibold text-slate-100">{item.name}</p>
      <p className={`relative mt-0.5 text-[9px] font-bold uppercase tracking-[0.16em] ${RARITY_COLORS[item.rarity]}`}>{item.rarity}</p>

      <div className="relative mt-2 flex h-20 items-center justify-center rounded-lg border border-white/10 bg-transparent sm:h-24">
        <div className="pointer-events-none absolute inset-x-8 bottom-2 h-4 rounded-[999px] bg-white/10 blur-md" />
        {item.rarity === 'legendary' && (
          <div className="pointer-events-none absolute inset-2 rounded-lg bg-[radial-gradient(circle,rgba(251,191,36,0.22),transparent_68%)]" />
        )}
        <img
          src={item.image}
          alt={item.name}
          className="relative z-10 h-[72px] w-[72px] object-contain transition-transform duration-200 group-hover:scale-105 sm:h-[88px] sm:w-[88px]"
          referrerPolicy="no-referrer"
        />
      </div>

      <div className="mt-2 rounded-md border border-indigo-300/25 bg-[#0b132d] px-2 py-1">
        <CoinAmount amount={Math.round(item.price)} className="text-xs font-bold text-slate-100" iconClassName="h-3.5 w-3.5" />
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
