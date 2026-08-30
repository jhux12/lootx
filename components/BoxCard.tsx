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
      onFocus={prefetchHandlers.onFocus}
      onKeyDown={handleKeyDown}
      className={`pullz-stable-card group relative mx-auto flex h-full w-full max-w-[18rem] cursor-pointer flex-col overflow-hidden rounded-[14px] border border-white/[0.07] bg-[#181c28] text-center shadow-[0_10px_26px_rgba(0,0,0,0.20)] transition-all duration-300 ${isCompact ? 'min-h-[14.5rem] p-3 sm:min-h-[16rem] sm:p-4' : 'min-h-[19rem] p-4 sm:min-h-[21rem] sm:p-5'} ${isDropping ? 'translate-y-2 scale-[0.98]' : 'hover:-translate-y-1 hover:border-violet-300/30 hover:bg-[#1b2030] hover:shadow-[0_18px_38px_rgba(0,0,0,0.30)]'}`}
      tabIndex={0}
      role="button"
    >
      <span aria-hidden="true" className="pointer-events-none absolute inset-x-5 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(167,139,250,0.65),transparent)] opacity-0 transition-opacity group-hover:opacity-100" />
      <div className={`relative flex w-full flex-1 items-center justify-center overflow-hidden rounded-[11px] bg-[radial-gradient(circle_at_50%_38%,rgba(139,92,246,0.13),transparent_54%)] ${isCompact ? 'mb-3 min-h-[9rem]' : 'mb-4 min-h-[11rem] sm:min-h-[13rem]'}`}>
        <BlurImage
          src={box.image}
          alt={box.name}
          ratioClassName={`shrink-0 ${isCompact ? 'h-32 w-32 sm:h-36 sm:w-36' : 'h-40 w-40 sm:h-48 sm:w-48'}`}
          className="relative z-10 mx-auto object-contain drop-shadow-[0_18px_24px_rgba(0,0,0,0.48)] transition-transform duration-300 group-hover:scale-[1.06]"
          width={176}
          height={176}
        />
      </div>

      <div className="flex w-full flex-col items-center gap-2 pb-0.5">
        <h4 className={`line-clamp-2 min-h-[2.25rem] overflow-hidden font-bold leading-tight text-gray-100 transition-colors duration-300 group-hover:text-white ${isCompact ? 'text-xs sm:text-sm' : 'text-sm sm:text-base'}`}>{box.name}</h4>
        {box.currencyType === 'XP' ? (
          <div className={`flex items-center justify-center gap-1 rounded-lg border border-violet-300/20 bg-violet-400/[0.08] px-2.5 py-1 font-bold text-white ${isCompact ? 'text-xs sm:text-sm' : 'text-sm sm:text-base'}`}>
            <img src={XP_ICON} alt="XP" loading="lazy" decoding="async" width={16} height={16} className="h-4 w-4 object-contain" />
            <span>{Math.max(0, Math.floor(Number(box.priceXP ?? 0))).toLocaleString()}</span>
          </div>
        ) : (
          <CoinAmount
            amount={toCoins(box.price, PRICE_UNIT_MODE)}
            formatOptions={{ maximumFractionDigits: 0 }}
            className={`justify-center rounded-lg border border-violet-300/20 bg-violet-400/[0.08] px-2.5 py-1 font-bold text-white ${isCompact ? 'text-xs sm:text-sm' : 'text-sm sm:text-base'}`}
            iconClassName="w-4 h-4"
          />
        )}
      </div>
    </div>
  );
};

export const BoxCard = memo(BoxCardComponent);
