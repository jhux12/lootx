import React, { useEffect, useState } from 'react';
import { Check, Search, X } from 'lucide-react';
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

export const InventoryCard: React.FC<InventoryCardProps> = ({ item, selected, selectable, onToggleSelect }) => {
  const rarityStyle = RARITY_STYLES[item.rarity] ?? RARITY_STYLES.common;
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  useEffect(() => {
    if (!isPreviewOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsPreviewOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [isPreviewOpen]);

  const openPreview = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    setIsPreviewOpen(true);
  };

  const closePreview = (event?: React.MouseEvent) => {
    event?.stopPropagation();
    setIsPreviewOpen(false);
  };

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
      className={`group relative flex h-full flex-col rounded-[1.15rem] border border-white/10 bg-[#101019]/92 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.035),0_18px_38px_rgba(0,0,0,0.24)] transition sm:rounded-2xl sm:p-5 ${selected ? 'border-purple-300/80 ring-4 ring-purple-400/35 shadow-[0_0_34px_rgba(168,85,247,0.35)]' : 'hover:border-white/20'} ${selectable ? 'cursor-pointer' : 'cursor-default'}`}
    >
      <span className={`absolute left-3 top-3 z-20 flex h-8 w-8 items-center justify-center rounded-lg border-2 ${selected ? 'border-purple-300 bg-purple-500 text-white' : 'border-gray-300/80 bg-black/20 text-transparent'} sm:left-5 sm:top-5 sm:h-10 sm:w-10`}>
        <Check className="h-5 w-5 stroke-[4]" />
      </span>

      <span className={`absolute right-3 top-3 z-20 rounded-lg border px-2 py-1 text-xs font-black uppercase leading-none sm:right-5 sm:top-5 sm:text-lg ${item.rarity === 'legendary' || item.rarity === 'epic' ? 'border-amber-400/60 bg-amber-500/10 text-amber-300' : rarityStyle.badge}`}>
        {item.rarity === 'legendary' || item.rarity === 'epic' ? 'NM' : item.rarity}
      </span>

      <button type="button" className="absolute right-3 bottom-3 z-20 hidden rounded-xl border border-white/10 bg-black/35 p-2 text-gray-200 transition hover:border-white/20 hover:bg-white/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-purple-300/70 sm:flex" onClick={openPreview} aria-label={`Zoom in on ${item.name}`}>
        <Search className="h-4 w-4" />
      </button>

      <div className="mx-auto mb-4 mt-3 flex aspect-[0.72] w-[72%] max-w-[12rem] items-center justify-center overflow-hidden rounded-lg bg-transparent sm:mt-2 sm:w-[68%]">
        <BlurImage src={item.image} alt={item.name} className="h-full w-full object-contain transition duration-300 group-hover:scale-[1.03]" width={220} height={300} showPlaceholder={false} />
      </div>

      <div className="mt-auto min-w-0">
        <p className="line-clamp-2 text-base font-black leading-tight tracking-[-0.03em] text-white sm:text-2xl">{item.name}</p>
        <p className="mt-1 truncate text-sm font-semibold text-gray-400 sm:text-xl">{item.brand || item.category || item.source || 'Collectible'}</p>
        <span className={`mt-3 inline-flex rounded-md px-2.5 py-1 text-xs font-black capitalize sm:text-lg ${rarityStyle.badge}`}>{item.rarity}</span>
        <CoinAmount amount={toCoins(item.price, PRICE_UNIT_MODE)} formatOptions={{ minimumFractionDigits: 2, maximumFractionDigits: 2 }} className="mt-4 text-lg font-black leading-none text-white sm:text-2xl" iconClassName="hidden" />
      </div>



      {isPreviewOpen ? (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 px-4 py-6 backdrop-blur-md motion-safe:animate-[inventory-fade-in_180ms_ease-out] sm:px-6"
          onClick={closePreview}
          role="dialog"
          aria-modal="true"
          aria-label={`${item.name} enlarged preview`}
        >
          <div
            className="relative flex max-h-[88vh] w-full max-w-md flex-col overflow-hidden rounded-[2rem] border border-white/12 bg-[#0d121b]/95 p-4 shadow-[0_28px_90px_rgba(0,0,0,0.55)] motion-safe:animate-[inventory-zoom-in_220ms_cubic-bezier(0.22,1,0.36,1)] sm:max-w-lg sm:p-5"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={closePreview}
              className="absolute right-3 top-3 z-10 flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-black/35 text-gray-200 backdrop-blur transition hover:bg-white/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-purple-300/70"
              aria-label="Close item preview"
            >
              <X className="h-5 w-5" />
            </button>

            <div className={`flex min-h-0 aspect-square w-full items-center justify-center overflow-hidden rounded-[1.5rem] border bg-[#080d14] p-5 sm:p-7 ${rarityStyle.image}`}>
              <BlurImage src={item.image} alt={item.name} className="h-full w-full object-contain motion-safe:animate-[inventory-image-pop_320ms_cubic-bezier(0.22,1,0.36,1)]" width={520} height={520} showPlaceholder={false} />
            </div>

            <div className="pt-4 text-center">
              <span className={`inline-flex rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] ${rarityStyle.badge}`}>{item.rarity}</span>
              <h4 className="mt-3 break-words text-2xl font-black leading-tight tracking-[-0.04em] text-white sm:text-3xl">{item.name}</h4>
            </div>
          </div>
        </div>
      ) : null}

      <style>{`
        @keyframes inventory-fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes inventory-zoom-in {
          from { opacity: 0; transform: translateY(10px) scale(0.94); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }

        @keyframes inventory-image-pop {
          from { transform: scale(0.9); }
          to { transform: scale(1); }
        }
      `}</style>
    </div>
  );
};
