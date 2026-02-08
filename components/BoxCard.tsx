import React, { useEffect, useRef, useState } from 'react';
import { CoinAmount } from './CoinAmount';
import { MysteryBox } from '../types';
import { RiskSliderIndicator } from './RiskSliderIndicator';
import { resolveRiskValue } from '../utils/riskIndicator';
import { PRICE_UNIT_MODE, toCoins } from '../utils/coins';

type BoxCardProps = {
  box: MysteryBox;
  onSelect: (boxId: string) => void;
  onHover?: () => void;
  size?: 'default' | 'compact';
};

export const BoxCard: React.FC<BoxCardProps> = ({ box, onSelect, onHover, size = 'default' }) => {
  const [isDropping, setIsDropping] = useState(false);
  const clickTimeoutRef = useRef<number | null>(null);
  const isCompact = size === 'compact';
  const riskValue = resolveRiskValue(box.riskLevel ?? null);

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

  return (
    <div
      onClick={handleSelect}
      onMouseEnter={onHover}
      className={`group relative flex h-full cursor-pointer flex-col overflow-hidden rounded-2xl border border-white/5 bg-gradient-to-b from-white/5 via-[#111826] to-[#0b101a] text-center shadow-[0_0_0_1px_rgba(255,255,255,0.02)] transition-all duration-300 ${isCompact ? 'p-2.5 sm:p-5' : 'p-4 sm:p-5'} ${isDropping ? 'translate-y-2 scale-[0.98] shadow-[0_18px_40px_-28px_rgba(0,0,0,0.9)]' : 'hover:-translate-y-1 hover:border-white/15 hover:shadow-[0_18px_40px_-28px_rgba(0,0,0,0.8)]'}`}
      style={{ ['--risk-accent' as string]: box.accentColor }}
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: `linear-gradient(160deg, ${box.accentColor}26, transparent 55%)` }}
      />
      <div
        className={`pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-200 ${isDropping ? 'opacity-100' : ''}`}
        style={{ boxShadow: `inset 0 0 28px ${box.accentColor}33, 0 10px 28px -20px ${box.accentColor}66` }}
      />
      {/* Image Container with Glow */}
      <div className={`relative flex w-full flex-1 items-center justify-center pt-2 ${isCompact ? 'mb-2.5' : 'mb-4'}`}>
          <div 
              className="absolute inset-6 rounded-full blur-3xl opacity-30 transition-opacity duration-300 group-hover:opacity-50"
              style={{ backgroundColor: box.accentColor }}
          ></div>
          <img 
              src={box.image} 
              alt={box.name} 
              className={`relative z-10 object-contain drop-shadow-[0_18px_24px_rgba(0,0,0,0.45)] transition-transform duration-300 group-hover:scale-110 ${isCompact ? 'h-20 w-20 sm:h-32 sm:w-32' : 'h-32 w-32 sm:h-36 sm:w-36'}`} 
          />
      </div>

      {/* Info */}
      <div className="flex w-full flex-col items-center pb-1">
          <h4 className={`font-semibold text-gray-200 transition-colors duration-300 group-hover:text-white ${isCompact ? 'text-[11px] sm:text-base' : 'text-sm sm:text-base'}`}>{box.name}</h4>
          <CoinAmount
            amount={toCoins(box.price, PRICE_UNIT_MODE)}
            formatOptions={{ maximumFractionDigits: 0 }}
            className={`mt-1 justify-center font-bold text-white sm:text-lg ${isCompact ? 'text-xs' : 'text-base'}`}
            iconClassName="w-4 h-4"
          />
          <div className={`mt-3 w-full ${isCompact ? 'px-1' : 'px-2'}`}>
            <RiskSliderIndicator value={riskValue} size={isCompact ? 'sm' : 'md'} />
          </div>
      </div>

      {/* Bottom Color Bar */}
      <div 
          className="absolute bottom-0 left-6 right-6 h-0.5 rounded-t-full opacity-60 transition-opacity duration-300 group-hover:opacity-100"
          style={{ backgroundColor: box.accentColor, boxShadow: `0 0 12px ${box.accentColor}` }}
      />
    </div>
  );
};
