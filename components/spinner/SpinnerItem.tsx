import React from 'react';
import { CaseItem } from '../../types';
import { CoinAmount } from '../CoinAmount';
import { BlurImage } from '../../src/ui/images/BlurImage';
import { getSpinnerItemTranslate } from './positioning';

interface SpinnerItemProps {
  item: CaseItem;
  index: number;
  currentCenterIndex: number;
  isCenter: boolean;
  isMobileViewport: boolean;
  transitionMs: number;
  animationPhase: 'idle' | 'spinning' | 'settling';
  itemWidth: number;
  gap: number;
}

const getRarityGlow = (item: CaseItem) => {
  const rarity = String(item.rarity ?? 'common').toLowerCase();
  if (rarity.includes('legend')) return { color: 'rgba(255,191,71,0.65)', opacity: 0.9 };
  if (rarity.includes('epic')) return { color: 'rgba(196,125,255,0.58)', opacity: 0.75 };
  if (rarity.includes('rare')) return { color: 'rgba(96,165,250,0.52)', opacity: 0.68 };
  if (rarity.includes('uncommon')) return { color: 'rgba(74,222,128,0.46)', opacity: 0.58 };
  return { color: 'rgba(100,116,139,0.4)', opacity: 0.45 };
};

export const SpinnerItem: React.FC<SpinnerItemProps> = ({
  item,
  index,
  currentCenterIndex,
  isCenter,
  isMobileViewport,
  transitionMs,
  animationPhase,
  itemWidth,
  gap
}) => {
  const glow = getRarityGlow(item);

  return (
    <div
      className={`spinner-item absolute left-1/2 top-1/2 flex items-center justify-center rounded-2xl border border-white/10 bg-[radial-gradient(circle_at_50%_35%,rgba(33,52,94,0.34),rgba(8,14,30,0.96)_62%)] ${isCenter ? 'active z-30' : 'z-10'}`}
      style={{
        width: `${itemWidth}px`,
        height: `${itemWidth}px`,
        transform: getSpinnerItemTranslate(index, currentCenterIndex, itemWidth, gap),
        transitionProperty: 'transform',
        transitionDuration: `${transitionMs}ms`,
        transitionTimingFunction: 'cubic-bezier(0.1, 0.7, 0.1, 1)',
        willChange: 'transform'
      }}
    >
      <div
        className="glow absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          width: '60%',
          height: '60%',
          background: `radial-gradient(circle, ${glow.color}, transparent 70%)`,
          filter: isMobileViewport ? 'blur(14px)' : 'blur(20px)',
          opacity: isCenter ? 1 : glow.opacity
        }}
      />

      <div
        className="relative z-10 flex h-full w-full flex-col items-center justify-between px-2 pb-2 pt-2"
        style={{
          transform: `scale(${isCenter ? 1.25 : 1})`,
          transition: 'transform 260ms ease, opacity 260ms ease'
        }}
      >
        <div className="relative flex min-h-0 flex-1 items-center justify-center self-stretch pt-2">
          <BlurImage
            src={item.image}
            alt={item.name}
            className={`object-contain drop-shadow-[0_10px_20px_rgba(0,0,0,0.58)] ${isMobileViewport ? 'h-[90px] w-[90px]' : 'h-[112px] w-[112px]'}`}
            loading="eager"
            decoding="async"
            fallbackClassName="bg-slate-900/40"
            style={{ width: isMobileViewport ? 90 : 112, height: isMobileViewport ? 90 : 112 }}
          />
        </div>

        <div
          className="relative z-10 inline-flex items-center justify-center text-sm font-extrabold leading-none text-white [text-shadow:0_2px_6px_rgba(0,0,0,0.7)] transition-opacity duration-300"
          style={{ opacity: isCenter && animationPhase === 'idle' ? 1 : 0 }}
        >
          <CoinAmount
            amount={item.price}
            formatOptions={{ maximumFractionDigits: 0 }}
            className="text-white"
            iconClassName="h-[11px] w-[11px]"
            animated={false}
          />
        </div>

        <div
          className="absolute bottom-0 left-3 right-3 h-px opacity-70"
          style={{ backgroundColor: item.color }}
        />

        <div
          className="absolute -bottom-8 left-1/2 w-max max-w-[195px] -translate-x-1/2 text-center transition-opacity duration-300"
          style={{ opacity: isCenter && animationPhase === 'idle' ? 1 : 0 }}
        >
          <div className="truncate text-xs font-semibold text-white">{item.name}</div>
        </div>
      </div>
    </div>
  );
};
