import React, { useEffect, useState } from 'react';
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


const primaryActionButtonBase = 'group/action relative flex h-12 w-full items-center justify-center gap-2 overflow-hidden rounded-[10px] border px-3 text-sm font-black shadow-[0_14px_34px_rgba(0,0,0,0.22)] outline-none transition-all duration-200 focus-visible:ring-2 focus-visible:ring-white/75 focus-visible:ring-offset-2 focus-visible:ring-offset-[#10151c] active:scale-[0.99] sm:rounded-[11px]';
const primaryActionShineClass = 'pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_0%,rgba(255,255,255,0.28),transparent_32%)] opacity-75 transition-opacity group-hover/action:opacity-95';

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

  const statusLabel = item.status === 'shipped' ? 'Shipped' : item.status === 'shipping' || item.status === 'shipping_requested' || item.status === 'pending_shipment' ? 'Pending' : 'Vaulted';

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
        className={`group relative overflow-hidden rounded-[1.35rem] border border-white/8 bg-[#151d1b]/92 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_16px_38px_rgba(0,0,0,0.24)] transition ${selected ? 'border-purple-300/80 ring-4 ring-purple-400/35' : 'hover:border-emerald-300/20 hover:bg-[#17231f]'} ${selectable ? 'cursor-pointer' : 'cursor-default'}`}
      >
        <div className="flex min-w-0 items-center gap-3">
          <div className={`flex h-20 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border bg-[#090e16] p-1.5 sm:h-24 sm:w-20 ${rarityStyle.image}`}>
            <BlurImage src={item.image} alt={item.name} className="h-full w-full object-contain transition duration-300 group-hover:scale-[1.03]" width={160} height={190} showPlaceholder={false} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full border px-2 py-0.5 text-[10px] font-black uppercase tracking-wide ${rarityStyle.badge}`}>{item.rarity}</span>
              <span className="rounded-full border border-emerald-300/25 bg-emerald-400/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-emerald-200">{statusLabel}</span>
            </div>
            <p className="mt-2 line-clamp-2 text-sm font-black leading-tight text-white sm:text-base">{item.name}</p>
            <p className="mt-1 text-xs font-semibold text-gray-400">{item.size ? `Size ${item.size}` : 'Raw Card'}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={(event) => { event.stopPropagation(); onAction(); }}
                disabled={actionDisabled}
                className={`rounded-lg px-2.5 py-1.5 text-xs font-black transition ${actionDisabled ? 'cursor-not-allowed border border-white/10 bg-[#111720] text-gray-500' : 'bg-purple-500 text-white hover:bg-purple-400'}`}
              >
                {actionLabel}
              </button>
              {secondaryActionLabel && onSecondaryAction ? (
                <button type="button" onClick={(event) => { event.stopPropagation(); onSecondaryAction(); }} disabled={secondaryActionDisabled} className={`rounded-lg px-2.5 py-1.5 text-xs font-black transition ${secondaryActionDisabled ? 'cursor-not-allowed border border-white/10 bg-[#111720] text-gray-500' : 'bg-emerald-500 text-[#06130f] hover:bg-emerald-400'}`}>{secondaryActionLabel}</button>
              ) : null}
            </div>
          </div>
          <CoinAmount amount={toCoins(item.price, PRICE_UNIT_MODE)} formatOptions={{ maximumFractionDigits: 0 }} className="shrink-0 text-sm font-black text-emerald-300 sm:text-lg" iconClassName="h-4 w-4 sm:h-5 sm:w-5" />
        </div>
        {selected ? <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-purple-500 text-white"><Check className="h-3.5 w-3.5 stroke-[4]" /></span> : null}
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
        <button type="button" className="rounded-xl border border-white/10 bg-white/5 p-2 text-gray-200 transition hover:border-white/20 hover:bg-white/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-purple-300/70" onClick={openPreview} aria-label={`Zoom in on ${item.name}`}>
          <Search className="h-4 w-4" />
        </button>
      </div>

      <div className={`flex aspect-square items-center justify-center overflow-hidden rounded-2xl border bg-[#090e16] p-3 ${rarityStyle.image} ${isList ? 'mx-auto mb-3 w-full max-w-[9rem] sm:mb-0' : 'mb-3 w-full'}`}>
        <BlurImage src={item.image} alt={item.name} className="h-full w-full object-contain transition duration-300 group-hover:scale-[1.03]" width={220} height={220} showPlaceholder={false} />
      </div>

      <div className="min-w-0">
        <div className={`hidden items-center justify-between gap-3 ${isList ? 'sm:flex' : ''}`}>
          <span className={`rounded-md border px-2.5 py-1 text-[10px] font-black uppercase tracking-wide ${rarityStyle.badge}`}>{item.rarity}</span>
          <button type="button" className="rounded-xl border border-white/10 bg-white/5 p-2 text-gray-200 transition hover:border-white/20 hover:bg-white/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-purple-300/70" onClick={openPreview} aria-label={`Zoom in on ${item.name}`}>
            <Search className="h-4 w-4" />
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
          className={`${primaryActionButtonBase} ${
            actionDisabled
              ? 'cursor-not-allowed border-white/10 bg-[#111720] text-gray-500 shadow-none'
              : 'border-purple-300/45 bg-[linear-gradient(135deg,rgba(147,51,234,0.95)_0%,rgba(124,58,237,0.9)_100%)] text-white shadow-[0_14px_34px_rgba(147,51,234,0.24)] hover:scale-[1.01] hover:border-purple-200/65 hover:shadow-[0_18px_42px_rgba(147,51,234,0.30)]'
          }`}
        >
          {!actionDisabled ? <span aria-hidden="true" className={primaryActionShineClass} /> : null}
          <Package className="relative z-10 h-5 w-5" /> <span className="relative z-10 truncate">{actionLabel}</span>
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
            <ArrowLeftRight className="relative z-10 h-5 w-5" /> <span className="relative z-10 truncate">{secondaryActionLabel}</span>
          </button>
        )}
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
