import React, { memo, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
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
  const [isLaunching, setIsLaunching] = useState(false);
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
    if (isDropping || isLaunching) return;

    setIsDropping(true);
    setIsLaunching(true);
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    clickTimeoutRef.current = window.setTimeout(() => {
      onSelect(box.id);
    }, reducedMotion ? 120 : 720);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    handleSelect();
  };

  return (
    <>
    {isLaunching && typeof document !== 'undefined' ? createPortal(
      <div className="fixed inset-0 z-[300] grid place-items-center overflow-hidden bg-[#04050b]/85 px-5 backdrop-blur-md" aria-hidden="true">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(82,74,255,.32),transparent_46%)]" />
        <div className="box-card-burst absolute h-64 w-64 rounded-full border border-violet-300/35 sm:h-[420px] sm:w-[420px]" />
        <div className="box-card-burst absolute h-44 w-44 rounded-full border-2 border-sky-400/25 [animation-delay:100ms] sm:h-72 sm:w-72" />
        <div className="box-card-launch relative">
          <div className="absolute inset-0 scale-125 rounded-full bg-violet-500/25 blur-3xl" />
          <img src={box.image} alt="" className="relative h-52 w-52 object-contain drop-shadow-[0_28px_45px_rgba(75,64,255,.65)] sm:h-80 sm:w-80" />
        </div>
        <style>{`@keyframes boxCardLaunch{0%{opacity:0;transform:translateY(30vh) scale(.42) rotate(-7deg)}58%{opacity:1;transform:translateY(0) scale(1.1) rotate(2deg)}100%{transform:scale(1) rotate(0)}}@keyframes boxCardBurst{0%{opacity:0;transform:scale(.25)}65%{opacity:1}100%{opacity:0;transform:scale(1.35)}}.box-card-launch{animation:boxCardLaunch .66s cubic-bezier(.16,1,.3,1) both}.box-card-burst{animation:boxCardBurst .72s ease-out both}@media(prefers-reduced-motion:reduce){.box-card-launch,.box-card-burst{animation:none}}`}</style>
      </div>, document.body
    ) : null}
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
      className={`pullz-stable-card group relative mx-auto flex h-full min-h-[19rem] w-full max-w-[18rem] sm:min-h-[22rem] cursor-pointer flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#11141a] text-center shadow-[0_12px_32px_-28px_rgba(0,0,0,0.75)] transition-all duration-300 ${isCompact ? 'p-3 sm:p-5' : 'p-4 sm:p-6'} ${isDropping ? 'translate-y-2 scale-[0.98]' : 'hover:-translate-y-1 hover:border-white/20'}`}
      tabIndex={0}
      role="button"
    >
      <div className={`relative flex w-full flex-1 items-center justify-center ${isCompact ? 'mb-3 min-h-[8rem]' : 'mb-4 min-h-[10rem] sm:min-h-[11rem]'}`}>
        <BlurImage
          src={box.image}
          alt={box.name}
          ratioClassName={`shrink-0 ${isCompact ? 'h-28 w-28 sm:h-36 sm:w-36' : 'h-40 w-40 sm:h-44 sm:w-44'}`}
          className="relative z-10 mx-auto object-contain drop-shadow-[0_18px_24px_rgba(0,0,0,0.45)] transition-transform duration-300 group-hover:scale-105"
          width={176}
          height={176}
        />
      </div>

      <div className="flex w-full flex-col items-center gap-2 pb-1">
        <h4 className={`min-h-[2.5rem] overflow-hidden font-semibold text-gray-100 transition-colors duration-300 group-hover:text-white ${isCompact ? 'text-xs sm:text-base' : 'text-sm sm:text-base'}`}>{box.name}</h4>
        {box.currencyType === 'XP' ? (
          <div className={`flex items-center justify-center gap-1 font-semibold text-white sm:text-lg ${isCompact ? 'text-sm' : 'text-base'}`}>
            <img src={XP_ICON} alt="XP" loading="lazy" decoding="async" width={16} height={16} className="h-4 w-4 object-contain" />
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
    </>
  );
};

export const BoxCard = memo(BoxCardComponent);
