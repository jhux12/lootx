import React from 'react';
import { CheckCircle2, Plane } from 'lucide-react';
import { InventoryItem } from '../../types';
import { BlurImage } from '../../src/ui/images/BlurImage';
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

const gradeForItem = (item: InventoryItem) => {
  const text = `${item.name} ${item.rarity}`.toLowerCase();
  if (text.includes('psa 9')) return 'PSA 9';
  if (text.includes('psa') || text.includes('card') || text.includes('charizard') || text.includes('pikachu') || text.includes('lugia')) return 'PSA 10';
  return null;
};

export const InventoryCard: React.FC<InventoryCardProps> = ({ item, selected, selectable, onToggleSelect, actionLabel, actionDisabled, onAction, secondaryActionLabel, secondaryActionDisabled = false, onSecondaryAction }) => {
  const grade = gradeForItem(item);
  const isTransit = item.status === 'shipping' || item.status === 'shipping_requested';
  const subtitle = item.size ? `Size: ${item.size}` : item.rarity.charAt(0).toUpperCase() + item.rarity.slice(1);

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
      className={`group relative rounded-2xl border border-white/10 bg-[#080b15] p-3 transition ${selected ? 'ring-2 ring-purple-400/70 shadow-[0_0_18px_rgba(139,92,246,0.35)]' : 'hover:border-white/20'} ${selectable ? 'cursor-pointer' : 'cursor-default'}`}
    >
      {grade && <span className="absolute right-3 top-3 rounded-lg bg-purple-700/45 px-3 py-1.5 text-xs font-black text-white">{grade}</span>}
      <div className="mb-3 flex h-32 items-center justify-center rounded-xl bg-transparent p-2 sm:h-40">
        <BlurImage src={item.image} alt={item.name} className="h-full w-full object-contain drop-shadow-[0_12px_18px_rgba(0,0,0,0.4)]" width={220} height={220} />
      </div>
      <p className="line-clamp-1 text-base font-black text-white">{item.name}</p>
      <p className="mt-1 line-clamp-1 text-sm font-medium text-slate-400">{subtitle}</p>
      <p className="mt-1 text-lg font-black text-white">${toCoins(item.price, PRICE_UNIT_MODE).toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
      <div className="mt-2 border-t border-white/10 pt-2 text-sm font-bold">
        {isTransit ? <span className="inline-flex items-center gap-2 text-blue-300"><Plane className="h-4 w-4" />In Transit</span> : <span className="inline-flex items-center gap-2 text-lime-300"><CheckCircle2 className="h-4 w-4" />In Inventory</span>}
      </div>
    </div>
  );
};
