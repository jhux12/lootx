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

type BoxCardProps = {
  box: MysteryBox;
  onSelect: (boxId: string) => void;
  onHover?: () => void;
  size?: 'default' | 'compact';
};

const BoxCardComponent: React.FC<BoxCardProps> = ({ box, onSelect, onHover, size = 'default' }) => {
  const { boxes } = useGame();
  const [isDropping, setIsDropping] = useState(false);
  const [isPreviewVisible, setIsPreviewVisible] = useState(false);
  const clickTimeoutRef = useRef<number | null>(null);
  const isCompact = size === 'compact';
  const riskValue = resolveRiskValue(box.riskLevel ?? null);
  const boxMap = useMemo(() => new Map(boxes.map((entry) => [entry.id, entry])), [boxes]);
  const prefetchHandlers = useIntentPrefetch(box.id, async () => boxMap.get(box.id) ?? null, box.image);
  const topItems = useMemo(
    () => [...box.items].sort((left, right) => right.price - left.price).slice(0, 2),
    [box.items]
  );

  useEffect(() => {
    return () => {
      if (clickTimeoutRef.current) {
        window.clearTimeout(clickTimeoutRef.current);
      }
    };
  }, []);

  const handleSelect = () => {
    if (isDropping) return;
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

  const renderPreviewItem = (item: MysteryBox['items'][number], side: 'left' | 'right') => {
    const hiddenOffset = side === 'left' ? '-translate-x-3' : 'translate-x-3';

    return (
      <div
        className={`pointer-events-none absolute top-1/2 z-20 flex w-[4.75rem] -translate-y-1/2 flex-col items-center gap-1 rounded-2xl border border-white/10 bg-[#08101b]/92 p-2 text-center shadow-[0_16px_28px_-20px_rgba(0,0,0,0.8)] backdrop-blur-sm transition-all duration-300 ease-out sm:w-[5.75rem] ${side === 'left' ? 'left-0 sm:left-1' : 'right-0 sm:right-1'} ${isPreviewVisible ? 'translate-x-0 opacity-100' : `${hiddenOffset} opacity-0`}`}
      >
        <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl bg-white/5 sm:h-12 sm:w-12">
          <img src={item.image} alt={item.name} loading="lazy" decoding="async" className="h-full w-full object-contain" />
        </div>
        <span className="line-clamp-2 text-[10px] font-semibold leading-tight text-white/90 sm:text-[11px]">{item.name}</span>
        <CoinAmount
          amount={toCoins(item.price, PRICE_UNIT_MODE)}
          formatOptions={{ maximumFractionDigits: 0 }}
          className="justify-center text-[10px] font-semibold text-emerald-300 sm:text-[11px]"
          iconClassName="h-3 w-3"
        />
      </div>
    );
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
      onTouchStart={prefetchHandlers.onTouchStart}
      onTouchEnd={() => setIsPreviewVisible(false)}
      onTouchCancel={() => setIsPreviewVisible(false)}
      onFocus={() => setIsPreviewVisible(true)}
      onBlur={() => setIsPreviewVisible(false)}
      onKeyDown={handleKeyDown}
      className={`group relative flex h-full cursor-pointer flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0b101a] text-center shadow-[0_12px_32px_-28px_rgba(0,0,0,0.75)] transition-all duration-300 ${isCompact ? 'p-3 sm:p-5' : 'p-4 sm:p-6'} ${isDropping ? 'translate-y-2 scale-[0.98]' : 'hover:-translate-y-1 hover:border-white/20'}`}
      style={{ ['--risk-accent' as string]: box.accentColor }}
      tabIndex={0}
      role="button"
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{ background: `linear-gradient(180deg, ${box.accentColor}1a, transparent 60%)` }}
      />
      <div className={`relative flex w-full flex-1 items-center justify-center ${isCompact ? 'mb-3 min-h-[8rem]' : 'mb-4 min-h-[10rem] sm:min-h-[11rem]'}`}>
        <div
          className="absolute inset-4 rounded-full opacity-25"
          style={{
            background: `radial-gradient(circle, ${box.accentColor}66 0%, ${box.accentColor}00 68%)`
          }}
        />
        {topItems[0] ? renderPreviewItem(topItems[0], 'left') : null}
        <BlurImage
          src={box.image}
          alt={box.name}
          className={`relative z-10 object-contain drop-shadow-[0_18px_24px_rgba(0,0,0,0.45)] transition-transform duration-300 group-hover:scale-105 ${isCompact ? 'h-28 w-28 sm:h-36 sm:w-36' : 'h-40 w-40 sm:h-44 sm:w-44'}`}
        />
        {topItems[1] ? renderPreviewItem(topItems[1], 'right') : null}
      </div>

      <div className="flex w-full flex-col items-center gap-2 pb-1">
        <h4 className={`font-semibold text-gray-100 transition-colors duration-300 group-hover:text-white ${isCompact ? 'text-xs sm:text-base' : 'text-sm sm:text-base'}`}>{box.name}</h4>
        {box.currencyType === 'XP' ? (
          <div className={`flex items-center justify-center gap-1 font-semibold text-white sm:text-lg ${isCompact ? 'text-sm' : 'text-base'}`}>
            <img src={XP_ICON} alt="XP" loading="lazy" decoding="async" className="h-4 w-4 object-contain" />
            <span>{Math.max(0, Math.floor(Number(box.priceXP ?? 0))).toLocaleString()}</span>
          </div>
        ) : (
          <CoinAmount
            amount={toCoins(box.price, PRICE_UNIT_MODE)}
            formatOptions={{ maximumFractionDigits: 0 }}
            className={`justify-center font-semibold text-white sm:text-lg ${isCompact ? 'text-sm' : 'text-base'}`}
            iconClassName="w-4 h-4"
          />
        )}
        <div className={`w-full ${isCompact ? 'px-2' : 'px-3'}`}>
          <RiskSliderIndicator value={riskValue} size={isCompact ? 'sm' : 'md'} />
        </div>
      </div>
    </div>
  );
};

export const BoxCard = memo(BoxCardComponent);
