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
  itemFullWidth: number;
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
  itemFullWidth
}) => {
  const glow = getRarityGlow(item);

  return (
    <div
      className={`spinner-item ${isCenter ? 'active z-30' : 'z-10'}`}
      style={{
        transform: getSpinnerItemTranslate(index, currentCenterIndex, itemFullWidth),
        transitionProperty: 'transform',
        transitionDuration: `${transitionMs}ms`,
        transitionTimingFunction: 'cubic-bezier(0.1, 0.7, 0.1, 1)',
        willChange: 'transform'
      }}
    >
      <div
        className="spinner-glow"
        style={{
          background: `radial-gradient(circle, ${glow.color}, transparent 70%)`,
          filter: isMobileViewport ? 'blur(14px)' : 'blur(20px)',
          opacity: isCenter ? 1 : glow.opacity
        }}
      />

      <div
        className="spinner-card relative z-10 flex flex-col items-center justify-center px-2 transition-transform duration-300"
        style={{
          width: `${itemWidth}px`,
          height: `${itemWidth}px`,
          transform: `scale(${isCenter ? 1.25 : 1})`,
          transition: 'transform 260ms ease, opacity 260ms ease'
        }}
      >
        <div className="spinner-image-wrap relative min-h-0 self-stretch">
          <BlurImage
            src={item.image}
            alt={item.name}
            className="object-contain drop-shadow-[0_10px_20px_rgba(0,0,0,0.58)]"
            loading="eager"
            decoding="async"
            fallbackClassName="bg-slate-900/40"
            style={{
              width: `${Math.round(itemWidth * (isMobileViewport ? 0.6 : 0.64))}px`,
              height: `${Math.round(itemWidth * (isMobileViewport ? 0.6 : 0.64))}px`
            }}
          />
        </div>

        <div
          className="spinner-value relative z-10 inline-flex items-center justify-center text-sm font-extrabold leading-none text-white [text-shadow:0_2px_6px_rgba(0,0,0,0.7)] transition-opacity duration-300"
          style={{ opacity: animationPhase === 'spinning' ? 0.94 : 1 }}
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
          className="spinner-name transition-opacity duration-300"
          style={{ opacity: isCenter && animationPhase === 'idle' ? 1 : 0 }}
        >
          {item.name}
        </div>
      </div>
    </div>
  );
};
