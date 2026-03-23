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
  const remainingItemsCount = Math.max(0, box.items.length - previewItems.length);
  const boxTags = useMemo(() => getBoxTags(box), [box]);
  const tagIconClass = useMemo(
    () => boxTags.map((tag) => stripeSettings.boxTagIcons[tag] ?? '').find(Boolean) ?? '',
    [boxTags, stripeSettings.boxTagIcons]
  );
  const tagIconLabel = tagIconClass ? getTagIconLabelFromClass(tagIconClass) : '';

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
      className={`group relative flex h-full cursor-pointer flex-col overflow-hidden rounded-[22px] border border-white/10 bg-[#0b101a] text-left shadow-[0_20px_50px_-34px_rgba(0,0,0,0.92)] transition-all duration-300 ${isCompact ? 'p-3 sm:p-4' : 'p-3.5 sm:p-5'} ${isDropping ? 'translate-y-2 scale-[0.985]' : 'hover:-translate-y-1 hover:border-white/20 hover:shadow-[0_28px_60px_-36px_rgba(0,0,0,0.98)] active:scale-[0.985]'}`}
      style={{ ['--risk-accent' as string]: box.accentColor }}
      tabIndex={0}
      role="button"
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-80"
        style={{ background: `linear-gradient(180deg, ${box.accentColor}18 0%, transparent 34%, rgba(6,10,18,0.92) 100%)` }}
      />
      <div className="pointer-events-none absolute inset-x-3 top-3 h-24 rounded-full opacity-40 blur-3xl sm:inset-x-6 sm:h-28" style={{ background: `${box.accentColor}33` }} />

      <div className={`relative flex flex-1 flex-col ${isCompact ? 'gap-3' : 'gap-3.5'}`}>
        <div className={`relative overflow-hidden rounded-[20px] border border-white/8 bg-[linear-gradient(180deg,rgba(15,23,38,0.98),rgba(7,11,18,0.98))] ${isCompact ? 'min-h-[9.25rem] px-3 py-4 sm:min-h-[10rem]' : 'min-h-[11rem] px-3 py-4 sm:min-h-[12.5rem] sm:px-4 sm:py-5'}`}>
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_32%,rgba(255,255,255,0.08),transparent_42%),radial-gradient(circle_at_50%_100%,rgba(255,255,255,0.04),transparent_56%)] opacity-80" />
          <div className="pointer-events-none absolute inset-x-6 top-5 h-16 rounded-full opacity-70 blur-2xl transition-all duration-300 group-hover:opacity-90 group-hover:scale-105" style={{ background: `${box.accentColor}40` }} />

          <div className="relative flex h-full flex-col">
            <div className="flex items-start justify-between gap-3">
              {tagIconClass ? (
                <div className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/12 bg-black/25 text-white/85 shadow-[0_12px_28px_-20px_rgba(0,0,0,0.9)] backdrop-blur-md">
                  <i className={`${tagIconClass} text-sm`} aria-hidden="true" />
                  <span className="sr-only">{tagIconLabel || 'Tag icon'}</span>
                </div>
              ) : (
                <div />
              )}

              <div className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/45">
                {box.items.length} items
              </div>
            </div>

            <div className="relative flex flex-1 items-center justify-center px-3 pb-7 pt-2 sm:px-4 sm:pb-8 sm:pt-1">
              <BlurImage
                src={box.image}
                alt={box.name}
                className={`relative z-10 object-contain drop-shadow-[0_22px_32px_rgba(0,0,0,0.5)] transition-transform duration-300 group-hover:-translate-y-1 group-hover:scale-[1.04] ${isCompact ? 'h-28 w-28 sm:h-32 sm:w-32' : 'h-36 w-36 sm:h-40 sm:w-40'}`}
              />

              <div className={`pointer-events-none absolute inset-x-0 top-0 flex h-full items-center justify-center bg-[linear-gradient(180deg,rgba(5,8,14,0)_0%,rgba(5,8,14,0.12)_50%,rgba(5,8,14,0.58)_100%)] transition-all duration-300 ${isPreviewVisible ? 'opacity-100' : 'opacity-0 md:opacity-0'}`}>
                <div className={`flex flex-col items-center gap-2 rounded-2xl border border-white/12 bg-black/35 px-4 py-3 text-center shadow-[0_16px_40px_-24px_rgba(0,0,0,0.95)] backdrop-blur-md transition-all duration-300 ${isPreviewVisible ? 'translate-y-0 scale-100' : 'translate-y-2 scale-[0.98]'}`}>
                  <span className="text-[10px] font-semibold uppercase tracking-[0.24em] text-white/55">Ready to roll</span>
                  <span className="text-sm font-semibold text-white sm:text-[15px]">Open Case</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className={`flex flex-col ${isCompact ? 'gap-2.5' : 'gap-3'}`}>
          <div className="space-y-1.5">
            <h4 className={`line-clamp-2 font-semibold text-gray-100 transition-colors duration-300 group-hover:text-white ${isCompact ? 'text-sm sm:text-[15px]' : 'text-sm sm:text-base'}`}>{box.name}</h4>
            <p className="text-[10px] uppercase tracking-[0.22em] text-white/38">Possible items</p>
          </div>

          <div className="flex items-center justify-between gap-2.5">
            <div className="flex min-w-0 items-center">
              {previewItems.length > 0 ? (
                <div className="flex min-w-0 items-center">
                  {previewItems.map((item, index) => (
                    <div
                      key={item.id}
                      className={`relative ${index === 0 ? '' : '-ml-2.5 sm:-ml-3'} transition-transform duration-300 ${isPreviewVisible ? 'translate-y-0' : 'translate-y-[1px]'} group-hover:-translate-y-0.5`}
                      style={{ zIndex: previewItems.length - index }}
                      title={item.name}
                    >
                      <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-white/12 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.03))] shadow-[0_10px_24px_-18px_rgba(0,0,0,0.95)] backdrop-blur-sm sm:h-11 sm:w-11">
                        {item.image ? (
                          <img src={item.image} alt={item.name} loading="lazy" decoding="async" className="h-full w-full object-cover" />
                        ) : (
                          <div className="h-full w-full bg-white/5" aria-hidden="true" />
                        )}
                      </div>
                    </div>
                  ))}

                  {remainingItemsCount > 0 ? (
                    <div className="-ml-2.5 flex h-10 min-w-10 items-center justify-center rounded-full border border-dashed border-white/14 bg-white/[0.03] px-2 text-[10px] font-semibold text-white/65 backdrop-blur-sm sm:-ml-3 sm:h-11 sm:min-w-11">
                      +{remainingItemsCount}
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="rounded-full border border-dashed border-white/12 bg-white/[0.03] px-3 py-2 text-[11px] text-white/45">
                  Rewards reveal on open
                </div>
              )}
            </div>

            <div className="shrink-0 text-right text-[10px] text-white/38">
              <div className="font-medium uppercase tracking-[0.18em]">Top drop</div>
              <div className="mt-0.5 max-w-[6rem] truncate text-[11px] font-semibold text-white/72 sm:max-w-[7rem]">{previewItems[0]?.name ?? 'Mystery reward'}</div>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-0.5">
            <div
              className={`inline-flex min-h-[2.75rem] items-center justify-center rounded-2xl border border-white/12 bg-[linear-gradient(135deg,rgba(245,158,11,0.22),rgba(99,102,241,0.28)_55%,rgba(15,23,42,0.92))] px-4 py-2 shadow-[0_16px_32px_-20px_rgba(79,70,229,0.65),inset_0_1px_0_rgba(255,255,255,0.12)] transition-all duration-300 group-hover:border-white/20 group-hover:shadow-[0_18px_36px_-20px_rgba(79,70,229,0.78)] active:scale-[0.98] ${box.currencyType === 'XP' ? 'min-w-[6rem]' : 'min-w-[6.5rem]'}`}
            >
              {box.currencyType === 'XP' ? (
                <div className={`flex items-center justify-center gap-1.5 font-semibold text-white ${isCompact ? 'text-sm' : 'text-[15px] sm:text-base'}`}>
                  <img src={XP_ICON} alt="XP" loading="lazy" decoding="async" className="h-4 w-4 object-contain" />
                  <span>{Math.max(0, Math.floor(Number(box.priceXP ?? 0))).toLocaleString()}</span>
                </div>
              ) : (
                <CoinAmount
                  amount={toCoins(box.price, PRICE_UNIT_MODE)}
                  formatOptions={{ maximumFractionDigits: 0 }}
                  className={`justify-center font-semibold text-white ${isCompact ? 'text-sm' : 'text-[15px] sm:text-base'}`}
                  iconClassName="h-4 w-4"
                />
              )}
            </div>

            <div className="min-w-0 flex-1">
              <RiskSliderIndicator value={riskValue} size={isCompact ? 'sm' : 'md'} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export const BoxCard = memo(BoxCardComponent);
