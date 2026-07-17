import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeftRight, Check, Package, Search, X } from 'lucide-react';
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


const primaryActionButtonBase = 'group/action relative flex h-9 w-full items-center justify-center gap-1.5 overflow-hidden rounded-lg border px-2 text-[11px] font-black shadow-[0_10px_22px_rgba(0,0,0,0.20)] outline-none transition-all duration-200 focus-visible:ring-2 focus-visible:ring-white/75 focus-visible:ring-offset-2 focus-visible:ring-offset-[#10151c] active:scale-[0.99] sm:h-10 sm:rounded-[9px] sm:text-xs';
const primaryActionShineClass = 'pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_0%,rgba(255,255,255,0.28),transparent_32%)] opacity-75 transition-opacity group-hover/action:opacity-95';

const RARITY_STYLES: Record<InventoryItem['rarity'], { card: string; badge: string; image: string; accent: string }> = {
  common: {
    card: 'border-white/10 bg-gradient-to-br from-slate-700/95 via-slate-800/95 to-slate-950/95',
    badge: 'border-gray-300/45 bg-gray-500/15 text-gray-100',
    image: 'border-white/12',
    accent: '#94a3b8'
  },
  uncommon: {
    card: 'border-white/10 bg-gradient-to-br from-emerald-900/95 via-emerald-950/90 to-slate-950/95',
    badge: 'border-emerald-300/55 bg-emerald-500/15 text-emerald-100',
    image: 'border-emerald-400/35 shadow-[0_0_24px_rgba(52,211,153,0.14)]',
    accent: '#34d399'
  },
  rare: {
    card: 'border-white/10 bg-gradient-to-br from-sky-900/95 via-blue-950/90 to-slate-950/95',
    badge: 'border-blue-300/55 bg-blue-500/15 text-blue-100',
    image: 'border-blue-400/35 shadow-[0_0_24px_rgba(96,165,250,0.14)]',
    accent: '#38bdf8'
  },
  epic: {
    card: 'border-white/10 bg-gradient-to-br from-violet-900/95 via-purple-950/90 to-slate-950/95',
    badge: 'border-purple-300/55 bg-purple-500/15 text-purple-100',
    image: 'border-purple-400/45 shadow-[0_0_24px_rgba(168,85,247,0.22)]',
    accent: '#a855f7'
  },
  legendary: {
    card: 'border-white/10 bg-gradient-to-br from-yellow-400/90 via-amber-600/90 to-yellow-950/95',
    badge: 'border-yellow-200/70 bg-yellow-400/20 text-yellow-50',
    image: 'border-yellow-300/55 shadow-[0_0_26px_rgba(250,204,21,0.24)]',
    accent: '#fbbf24'
  }
};
export const InventoryCard: React.FC<InventoryCardProps> = ({ item, selected, selectable, onToggleSelect, actionLabel, actionDisabled, onAction, secondaryActionLabel, secondaryActionDisabled = false, onSecondaryAction, layoutMode = 'grid' }) => {
  const rarityStyle = RARITY_STYLES[item.rarity] ?? RARITY_STYLES.common;
  const isList = layoutMode === 'list';
  const isLegendary = item.rarity === 'legendary';
  const selectedCardClass = isLegendary
    ? 'border-yellow-200/85 ring-2 ring-yellow-300/55 shadow-[0_0_34px_rgba(250,204,21,0.38)]'
    : 'border-purple-300/80 ring-2 ring-purple-400/50 shadow-[0_0_30px_rgba(168,85,247,0.36)]';
  const selectedCheckClass = isLegendary
    ? 'bg-yellow-400 text-yellow-950 shadow-[0_0_18px_rgba(250,204,21,0.68)]'
    : 'bg-purple-500 text-white shadow-[0_0_18px_rgba(168,85,247,0.65)]';
  const cardBoxShadow = selected
    ? isLegendary
      ? `0 18px 34px rgba(0,0,0,0.32), 0 0 34px rgba(250,204,21,0.38), inset 0 0 0 1px ${rarityStyle.accent}55`
      : `0 18px 34px rgba(0,0,0,0.32), 0 0 30px rgba(168,85,247,0.36), inset 0 0 0 1px ${rarityStyle.accent}44`
    : `0 18px 34px rgba(0,0,0,0.32), inset 0 0 0 1px ${rarityStyle.accent}22`;
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
      className={`group relative overflow-hidden rounded-lg border p-0 text-left shadow-[0_18px_34px_rgba(0,0,0,0.32)] transition hover:-translate-y-0.5 hover:border-white/20 sm:rounded-xl ${isList ? 'sm:grid sm:grid-cols-[8.5rem_minmax(0,1fr)_10rem] sm:items-center sm:gap-4 sm:p-3' : 'flex min-h-[270px] flex-col sm:min-h-[320px]'} ${rarityStyle.card} ${
        selected ? selectedCardClass : 'hover:shadow-[0_20px_40px_rgba(0,0,0,0.38)]'
      } ${selectable ? 'cursor-pointer' : 'cursor-default'}`}
      style={{ boxShadow: cardBoxShadow }}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_15%,rgba(255,255,255,0.12),transparent_18%),radial-gradient(circle_at_88%_24%,rgba(255,255,255,0.16),transparent_14%),linear-gradient(180deg,rgba(255,255,255,0.06)_0%,transparent_46%,rgba(0,0,0,0.18)_100%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-45" style={{ backgroundImage: `radial-gradient(circle at 94% 28%, ${rarityStyle.accent} 0 1.5px, transparent 2px), radial-gradient(circle at 8% 42%, ${rarityStyle.accent} 0 1px, transparent 1.8px), radial-gradient(circle at 54% 92%, ${rarityStyle.accent} 0 1px, transparent 1.8px)`, backgroundSize: '48px 52px' }} />
      {selected ? (
        <span className={`absolute right-2 top-2 z-20 flex h-6 w-6 items-center justify-center rounded-full ${selectedCheckClass}`}>
          <Check className="h-3.5 w-3.5 stroke-[4]" />
        </span>
      ) : null}

      <button type="button" className="absolute left-2 top-2 z-20 rounded-lg border border-white/10 bg-black/25 p-1.5 text-gray-200 backdrop-blur transition hover:border-white/20 hover:bg-white/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-purple-300/70" onClick={openPreview} aria-label={`Zoom in on ${item.name}`}>
        <Search className="h-3.5 w-3.5" />
      </button>

      <div className={`relative flex items-center justify-center overflow-hidden ${isList ? 'mx-auto mb-3 aspect-square w-full max-w-[8.5rem] rounded-xl border bg-[#090e16]/35 p-2 sm:mb-0' : 'h-44 px-1.5 pb-1 pt-3 sm:h-[248px] sm:px-2 sm:pt-4'} ${isList ? rarityStyle.image : ''}`}>
        <BlurImage src={item.image} alt={item.name} className={`${isList ? 'h-full w-full' : 'h-full max-h-none w-[112%] max-w-none sm:w-[118%]'} object-contain drop-shadow-[0_12px_18px_rgba(0,0,0,0.48)] transition duration-300 group-hover:scale-[1.06]`} width={240} height={280} showPlaceholder={false} />
      </div>

      <div className={`${isList ? 'min-w-0' : 'relative mt-auto px-3 pb-3 sm:px-4 sm:pb-4'}`}>
        <div className={`hidden items-center gap-3 ${isList ? 'sm:flex' : ''}`}>
          <span className={`rounded-md border px-2.5 py-1 text-[10px] font-black uppercase tracking-wide ${rarityStyle.badge}`}>{item.rarity}</span>
        </div>
        <p className={`${isList ? 'mt-3 text-left text-base sm:text-lg' : 'truncate text-center text-[13px] sm:text-sm'} font-black leading-tight text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.65)]`} title={item.name}>{item.name}</p>
        <div className={`${isList ? 'mt-3' : 'mt-3 border-t border-white/10 pt-2.5'}`}>
          <CoinAmount amount={toCoins(item.price, PRICE_UNIT_MODE)} formatOptions={{ maximumFractionDigits: 0 }} className="text-sm font-black text-white sm:text-base" iconClassName="h-3.5 w-3.5 sm:h-4 sm:w-4" />
        </div>
      </div>

      <div className={`${isList ? 'mt-3 sm:mt-0' : 'relative px-3 pb-3 sm:px-4 sm:pb-4'}`}>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onAction();
          }}
          disabled={actionDisabled}
          className={`${primaryActionButtonBase} ${
            actionDisabled
              ? 'cursor-not-allowed border-white/10 bg-[#111720] text-gray-500 shadow-none'
              : 'border-purple-300/45 bg-[linear-gradient(135deg,rgba(147,51,234,0.95)_0%,rgba(124,58,237,0.9)_100%)] text-white shadow-[0_14px_34px_rgba(147,51,234,0.24)] hover:scale-[1.01] hover:border-purple-200/65 hover:shadow-[0_18px_42px_rgba(147,51,234,0.30)]'
          }`}
        >
          {!actionDisabled ? <span aria-hidden="true" className={primaryActionShineClass} /> : null}
          <Package className="relative z-10 h-4 w-4" /> <span className="relative z-10 truncate">{actionLabel}</span>
        </button>

        {secondaryActionLabel && onSecondaryAction && (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onSecondaryAction();
            }}
            disabled={secondaryActionDisabled}
            className={`mt-2 ${primaryActionButtonBase} ${
              secondaryActionDisabled
                ? 'cursor-not-allowed border-white/10 bg-[#111720] text-gray-500 shadow-none'
                : 'border-emerald-300/40 bg-[linear-gradient(135deg,rgba(16,185,129,0.82)_0%,rgba(5,150,105,0.78)_100%)] text-emerald-50 shadow-[0_14px_34px_rgba(16,185,129,0.20)] hover:scale-[1.01] hover:border-emerald-200/60 hover:shadow-[0_18px_42px_rgba(16,185,129,0.26)]'
            }`}
          >
            {!secondaryActionDisabled ? <span aria-hidden="true" className={primaryActionShineClass} /> : null}
            <ArrowLeftRight className="relative z-10 h-4 w-4" /> <span className="relative z-10 truncate">{secondaryActionLabel}</span>
          </button>
        )}
      </div>


      {isPreviewOpen && typeof document !== 'undefined' ? createPortal((
        <div
          className="fixed inset-0 z-[280] flex items-center justify-center bg-black/70 px-4 py-6 backdrop-blur-md motion-safe:animate-[inventory-fade-in_180ms_ease-out] sm:px-6"
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
      ), document.body) : null}

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
