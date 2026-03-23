import React, { memo, useEffect, useMemo, useRef, useState } from 'react';
import { CoinAmount } from './CoinAmount';
import { MysteryBox } from '../types';
import { RiskSliderIndicator } from './RiskSliderIndicator';
import { resolveRiskValue } from '../utils/riskIndicator';
import { PRICE_UNIT_MODE, toCoins } from '../utils/coins';
import { XP_ICON } from '../constants';
import { BlurImage } from '../src/ui/images/BlurImage';
import { useIntentPrefetch } from '../src/lib/prefetch/useIntentPrefetch';
import { useGame } from '../context/GameContext';
import { getBoxTags, getTagIconLabelFromClass } from '../utils/boxTags';

type BoxCardProps = {
  box: MysteryBox;
  onSelect: (boxId: string) => void;
  onHover?: () => void;
  size?: 'default' | 'compact';
};

const BoxCardComponent: React.FC<BoxCardProps> = ({ box, onSelect, onHover, size = 'default' }) => {
  const { boxes, stripeSettings } = useGame();
  const [isDropping, setIsDropping] = useState(false);
  const [isPreviewVisible, setIsPreviewVisible] = useState(false);
  const clickTimeoutRef = useRef<number | null>(null);
  const previewTimeoutRef = useRef<number | null>(null);
  const isCompact = size === 'compact';
  const riskValue = resolveRiskValue(box.riskLevel ?? null);
  const boxMap = useMemo(() => new Map(boxes.map((entry) => [entry.id, entry])), [boxes]);
  const prefetchHandlers = useIntentPrefetch(box.id, async () => boxMap.get(box.id) ?? null, box.image);
  const previewItems = useMemo(
    () => [...box.items].sort((left, right) => right.price - left.price).slice(0, isCompact ? 3 : 4),
    [box.items, isCompact]
  );
  const visiblePreviewPills = previewItems.slice(0, isCompact ? 2 : 3);
  const remainingItemsCount = Math.max(0, box.items.length - visiblePreviewPills.length);
  const boxTags = useMemo(() => getBoxTags(box), [box]);
  const tagIconClass = useMemo(
    () => boxTags.map((tag) => stripeSettings.boxTagIcons[tag] ?? '').find(Boolean) ?? '',
    [boxTags, stripeSettings.boxTagIcons]
  );
  const tagIconLabel = tagIconClass ? getTagIconLabelFromClass(tagIconClass) : '';
  const fallbackTagLabel = useMemo(
    () => (box.tag ?? box.tags?.[0] ?? '').trim(),
    [box.tag, box.tags]
  );

  useEffect(() => {
    return () => {
      if (clickTimeoutRef.current) {
        window.clearTimeout(clickTimeoutRef.current);
      }
      if (previewTimeoutRef.current) {
        window.clearTimeout(previewTimeoutRef.current);
      }
    };
  }, []);

  const handleSelect = () => {
    if (isDropping) return;

    if (typeof window !== 'undefined' && window.matchMedia('(hover: none)').matches && !isPreviewVisible) {
      setIsPreviewVisible(true);
      if (previewTimeoutRef.current) {
        window.clearTimeout(previewTimeoutRef.current);
      }
      previewTimeoutRef.current = window.setTimeout(() => {
        setIsPreviewVisible(false);
      }, 1800);
      return;
    }

    setIsDropping(true);
    clickTimeoutRef.current = window.setTimeout(() => {
      onSelect(box.id);
    }, 180);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    handleSelect();
  };

  return (
    <div
      onClick={handleSelect}
      onMouseEnter={() => {
        prefetchHandlers.onMouseEnter();
        onHover?.();
        setIsPreviewVisible(true);
      }}
      onMouseLeave={() => setIsPreviewVisible(false)}
      onTouchStart={() => {
        prefetchHandlers.onTouchStart();
        setIsPreviewVisible(true);
      }}
      onTouchEnd={() => {
        if (previewTimeoutRef.current) {
          window.clearTimeout(previewTimeoutRef.current);
        }
        previewTimeoutRef.current = window.setTimeout(() => {
          setIsPreviewVisible(false);
        }, 1800);
      }}
      onTouchCancel={() => setIsPreviewVisible(false)}
      onFocus={() => setIsPreviewVisible(true)}
      onBlur={() => setIsPreviewVisible(false)}
      onKeyDown={handleKeyDown}
      className={`group relative flex h-full cursor-pointer flex-col overflow-hidden rounded-[24px] border border-white/8 bg-[linear-gradient(180deg,#181922_0%,#171923_58%,#251c37_100%)] text-left shadow-[0_26px_60px_-38px_rgba(0,0,0,0.95)] transition-all duration-300 ${isCompact ? 'p-3' : 'p-4'} ${isDropping ? 'translate-y-2 scale-[0.985]' : 'hover:-translate-y-1 hover:border-white/14 hover:shadow-[0_30px_70px_-38px_rgba(0,0,0,1)] active:scale-[0.985]'}`}
      style={{ ['--risk-accent' as string]: box.accentColor }}
      tabIndex={0}
      role="button"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(255,255,255,0.06),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.03),transparent_22%)] opacity-80" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-[linear-gradient(180deg,rgba(109,68,255,0),rgba(109,68,255,0.14))]" />

      <div className={`relative flex h-full flex-col ${isCompact ? 'gap-3' : 'gap-3.5'}`}>
        <div className={`relative overflow-hidden rounded-[20px] ${isCompact ? 'min-h-[10rem]' : 'min-h-[11.75rem] sm:min-h-[12.5rem]'}`}>
          <div className="absolute left-0 top-0 z-20">
            {tagIconClass ? (
              <div className="inline-flex h-10 min-w-10 items-center justify-center rounded-xl border border-orange-300/35 bg-[linear-gradient(180deg,#ff7547_0%,#ff4d32_100%)] px-3 text-white shadow-[0_14px_24px_-16px_rgba(255,96,60,0.85)]">
                <i className={`${tagIconClass} text-sm`} aria-hidden="true" />
                <span className="sr-only">{tagIconLabel || 'Tag icon'}</span>
              </div>
            ) : fallbackTagLabel ? (
              <div className="inline-flex min-h-10 items-center justify-center rounded-xl border border-orange-300/35 bg-[linear-gradient(180deg,#ff7547_0%,#ff4d32_100%)] px-3 py-2 text-sm font-semibold text-white shadow-[0_14px_24px_-16px_rgba(255,96,60,0.85)]">
                {fallbackTagLabel}
              </div>
            ) : null}
          </div>

          <div className="relative flex h-full items-center justify-center px-3 pb-2 pt-10 sm:px-4 sm:pt-11">
            <div className="pointer-events-none absolute inset-x-8 top-[32%] h-20 rounded-full opacity-70 blur-3xl transition-all duration-300 group-hover:scale-105" style={{ background: `${box.accentColor}55` }} />
            <div className="pointer-events-none absolute inset-x-4 bottom-4 h-24 rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.06),transparent_70%)] opacity-70" />

            <BlurImage
              src={box.image}
              alt={box.name}
              className={`relative z-10 object-contain drop-shadow-[0_24px_34px_rgba(0,0,0,0.5)] transition-transform duration-300 group-hover:-translate-y-1 group-hover:scale-[1.035] ${isCompact ? 'h-28 w-28 sm:h-32 sm:w-32' : 'h-36 w-36 sm:h-40 sm:w-40'}`}
            />

            <div className={`pointer-events-none absolute inset-0 flex items-center justify-center rounded-[20px] bg-[linear-gradient(180deg,rgba(10,11,18,0.02),rgba(10,11,18,0.62))] transition-all duration-300 ${isPreviewVisible ? 'opacity-100' : 'opacity-0'}`}>
              <div className={`rounded-2xl border border-white/12 bg-black/40 px-5 py-3 text-center shadow-[0_18px_40px_-24px_rgba(0,0,0,0.95)] backdrop-blur-md transition-all duration-300 ${isPreviewVisible ? 'translate-y-0 scale-100' : 'translate-y-2 scale-[0.98]'}`}>
                <span className="text-sm font-semibold tracking-[0.01em] text-white">Open Case</span>
              </div>
            </div>
          </div>
        </div>

        <div className={`flex flex-1 flex-col ${isCompact ? 'gap-2.5' : 'gap-3'}`}>
          <div className="space-y-2">
            <h4 className={`line-clamp-2 font-semibold leading-tight text-white ${isCompact ? 'text-[1.3rem]' : 'text-[1.4rem] sm:text-[1.55rem]'}`}>{box.name}</h4>

            <div className="flex flex-wrap gap-2">
              {visiblePreviewPills.length > 0 ? (
                <>
                  {visiblePreviewPills.map((item) => (
                    <div
                      key={item.id}
                      className="inline-flex max-w-full items-center gap-2 rounded-xl border border-white/8 bg-white/[0.06] px-2.5 py-1.5 text-xs text-white/78 backdrop-blur-sm transition-colors duration-300 group-hover:bg-white/[0.08]"
                      title={item.name}
                    >
                      <div className="flex h-5 w-5 items-center justify-center overflow-hidden rounded-md bg-white/8">
                        {item.image ? (
                          <img src={item.image} alt={item.name} loading="lazy" decoding="async" className="h-full w-full object-cover" />
                        ) : (
                          <div className="h-full w-full bg-white/5" aria-hidden="true" />
                        )}
                      </div>
                      <span className="max-w-[5.5rem] truncate sm:max-w-[6.5rem]">{item.name}</span>
                    </div>
                  ))}
                  {remainingItemsCount > 0 ? (
                    <div className="inline-flex items-center rounded-xl border border-white/8 bg-white/[0.05] px-2.5 py-1.5 text-xs font-medium text-white/62">
                      +{remainingItemsCount}
                    </div>
                  ) : null}
                </>
              ) : (
                <div className="inline-flex items-center rounded-xl border border-white/8 bg-white/[0.05] px-2.5 py-1.5 text-xs text-white/55">
                  Rewards reveal on open
                </div>
              )}
            </div>
          </div>

          <div className="pt-0.5">
            {box.currencyType === 'XP' ? (
              <div className={`flex items-center gap-2 font-semibold text-white ${isCompact ? 'text-2xl' : 'text-[1.9rem]'}`}>
                <img src={XP_ICON} alt="XP" loading="lazy" decoding="async" className="h-5 w-5 object-contain" />
                <span>{Math.max(0, Math.floor(Number(box.priceXP ?? 0))).toLocaleString()}</span>
              </div>
            ) : (
              <CoinAmount
                amount={toCoins(box.price, PRICE_UNIT_MODE)}
                formatOptions={{ maximumFractionDigits: 0 }}
                className={`justify-start font-semibold text-white ${isCompact ? 'text-2xl' : 'text-[1.9rem]'}`}
                iconClassName="mt-0.5 h-5 w-5"
              />
            )}
          </div>

          <div className="mt-auto space-y-2.5 pt-1">
            <div className="flex items-center gap-2">
              <div className="flex-1 rounded-xl bg-[linear-gradient(180deg,#6f52ff_0%,#5d44ef_100%)] px-4 py-3 text-center text-sm font-semibold text-white shadow-[0_18px_30px_-20px_rgba(98,74,255,0.95)] transition-all duration-300 group-hover:brightness-110 group-active:scale-[0.99]">
                Open Box
              </div>
              <div className="inline-flex min-w-[4.9rem] items-center justify-center rounded-xl border border-white/8 bg-white/[0.08] px-3 py-3 text-sm font-medium text-white/78 backdrop-blur-sm transition-colors duration-300 group-hover:bg-white/[0.11]">
                {previewItems[0] ? 'Top Drop' : 'Info'}
              </div>
            </div>

            <div className="rounded-full border border-white/6 bg-black/10 px-2.5 py-2">
              <RiskSliderIndicator value={riskValue} size={isCompact ? 'sm' : 'md'} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export const BoxCard = memo(BoxCardComponent);
