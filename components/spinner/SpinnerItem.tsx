import React from 'react';
import { CaseItem } from '../../types';
import { CoinAmount } from '../CoinAmount';
import { BlurImage } from '../../src/ui/images/BlurImage';
import { getSpinnerItemTranslate } from './positioning';

interface SpinnerItemProps {
  item: CaseItem;
  index: number;
  currentCenterIndex: number;
  animatedCenterIndex: number;
  isCenter: boolean;
  isMobileViewport: boolean;
  transitionMs: number;
  animationPhase: 'idle' | 'spinning' | 'settling';
  itemWidth: number;
  itemFullWidth: number;
}

const getRarityGlow = (item: CaseItem) => {
  const rarity = String(item.rarity ?? 'common').toLowerCase();
  if (rarity.includes('legend')) return { color: '#d97706', border: 'rgba(250,204,21,0.6)', subtitle: 'Legendary' };
  if (rarity.includes('epic')) return { color: '#9333ea', border: 'rgba(196,125,255,0.62)', subtitle: 'Epic' };
  if (rarity.includes('rare')) return { color: '#2563eb', border: 'rgba(96,165,250,0.62)', subtitle: 'Rare' };
  if (rarity.includes('uncommon')) return { color: '#16a34a', border: 'rgba(74,222,128,0.58)', subtitle: 'Uncommon' };
  return { color: '#475569', border: 'rgba(148,163,184,0.45)', subtitle: 'Common' };
};

export const SpinnerItem: React.FC<SpinnerItemProps> = ({
  item,
  index,
  currentCenterIndex,
  animatedCenterIndex,
  isCenter,
  isMobileViewport,
  transitionMs,
  animationPhase,
  itemWidth,
  itemFullWidth
}) => {
  const glow = getRarityGlow(item);
  const centerDistance = Math.abs(index - animatedCenterIndex);
  const proximity = Math.max(0, 1 - Math.min(1, centerDistance));
  const passThroughScale = 1 + (proximity * 0.2);

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
          opacity: isCenter ? 0.95 : 0.5
        }}
      />

      <div
        className="spinner-card relative z-10 flex flex-col items-center justify-center px-2 transition-transform duration-300"
        style={{
          width: `${itemWidth}px`,
          height: `${itemWidth}px`,
          transform: `scale(${isCenter ? 1.25 : 1})`,
          borderColor: isCenter ? 'rgba(216,180,254,0.95)' : glow.border,
          boxShadow: isCenter
            ? `0 0 26px ${glow.border}, inset 0 0 0 1px rgba(255,255,255,0.22)`
            : `0 0 16px ${glow.border}`,
          opacity: isCenter ? 1 : 0.86,
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
              height: `${Math.round(itemWidth * (isMobileViewport ? 0.6 : 0.64))}px`,
              transform: `scale(${isCenter ? 1.08 : passThroughScale})`,
              transition: 'transform 120ms linear'
            }}
          />
        </div>

        <div className="spinner-info">
          <div className="spinner-name transition-opacity duration-300">
            {item.name}
          </div>
          <div
            className="spinner-rarity transition-opacity duration-300"
            style={{ opacity: isCenter ? 1 : 0.72, color: isCenter ? '#c084fc' : '#93c5fd' }}
          >
            {glow.subtitle}
          </div>
          <div
            className="spinner-value relative z-10 inline-flex items-center justify-center text-sm font-extrabold leading-none text-white [text-shadow:0_2px_6px_rgba(0,0,0,0.7)] transition-opacity duration-300"
            style={{ opacity: animationPhase === 'spinning' ? 0.94 : 1 }}
          >
            <CoinAmount
              amount={item.price}
              formatOptions={{ maximumFractionDigits: 0 }}
              className="text-white"
              iconClassName={isCenter ? 'h-[16px] w-[16px]' : 'h-[13px] w-[13px]'}
              animated={false}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
