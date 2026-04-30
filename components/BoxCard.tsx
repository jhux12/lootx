import React, { memo, useEffect, useMemo, useRef, useState } from 'react';
import { CoinAmount } from './CoinAmount';
import { MysteryBox } from '../types';
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
  const clickTimeoutRef = useRef<number | null>(null);
  const isCompact = size === 'compact';
  const boxMap = useMemo(() => new Map(boxes.map((entry) => [entry.id, entry])), [boxes]);
  const prefetchHandlers = useIntentPrefetch(box.id, async () => boxMap.get(box.id) ?? null, box.image);

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

  return (
    <div
      onClick={handleSelect}
      onMouseEnter={() => {
        prefetchHandlers.onMouseEnter();
        onHover?.();
      }}
      onTouchStart={() => {
        prefetchHandlers.onTouchStart();
      }}
      onKeyDown={handleKeyDown}
      className={`group relative mx-auto flex h-full w-full max-w-[18rem] cursor-pointer flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#11141a] text-center shadow-[0_12px_32px_-28px_rgba(0,0,0,0.75)] transition-all duration-300 ${isCompact ? 'p-3 sm:p-5' : 'p-4 sm:p-6'} ${isDropping ? 'translate-y-2 scale-[0.98]' : 'hover:-translate-y-1 hover:border-white/20'}`}
      tabIndex={0}
      role="button"
    >
      <div className={`relative flex w-full flex-1 items-center justify-center ${isCompact ? 'mb-3 min-h-[8rem]' : 'mb-4 min-h-[10rem] sm:min-h-[11rem]'}`}>
        <BlurImage
          src={box.image}
          alt={box.name}
          className={`relative z-10 object-contain drop-shadow-[0_18px_24px_rgba(0,0,0,0.45)] transition-transform duration-300 group-hover:scale-105 ${isCompact ? 'h-28 w-28 sm:h-36 sm:w-36' : 'h-40 w-40 sm:h-44 sm:w-44'}`}
        />
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
      </div>
    </div>
  );
};

export const BoxCard = memo(BoxCardComponent);
