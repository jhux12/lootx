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
      className={`group relative flex h-full cursor-pointer flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0b101a] text-center shadow-[0_0_0_1px_rgba(255,255,255,0.02)] transition-all duration-300 ${isCompact ? 'p-3 sm:p-5' : 'p-4 sm:p-6'} ${isDropping ? 'translate-y-2 scale-[0.98] shadow-[0_18px_40px_-28px_rgba(0,0,0,0.9)]' : 'hover:-translate-y-1 hover:border-white/20 hover:shadow-[0_18px_40px_-28px_rgba(0,0,0,0.8)]'}`}
      style={{ ['--risk-accent' as string]: box.accentColor }}
    >
      {/* Image Container with Glow */}
      <div className={`relative flex w-full flex-1 items-center justify-center ${isCompact ? 'mb-3 pt-2' : 'mb-4 pt-3'}`}>
          <img 
              src={box.image} 
              alt={box.name} 
              className={`relative z-10 object-contain drop-shadow-[0_18px_24px_rgba(0,0,0,0.45)] transition-transform duration-300 group-hover:scale-105 ${isCompact ? 'h-28 w-28 sm:h-36 sm:w-36' : 'h-36 w-36 sm:h-44 sm:w-44'}`} 
          />
      </div>

      {/* Info */}
      <div className="flex w-full flex-col items-center pb-2">
          <h4 className={`font-semibold text-gray-200 transition-colors duration-300 group-hover:text-white ${isCompact ? 'text-xs sm:text-base' : 'text-sm sm:text-base'}`}>{box.name}</h4>
          <CoinAmount
            amount={toCoins(box.price, PRICE_UNIT_MODE)}
            formatOptions={{ maximumFractionDigits: 0 }}
            className={`mt-1 justify-center font-bold text-white sm:text-lg ${isCompact ? 'text-sm' : 'text-base'}`}
            iconClassName="w-4 h-4"
          />
          <div className={`mt-3 w-full ${isCompact ? 'px-1' : 'px-2'}`}>
            <RiskSliderIndicator value={riskValue} size={isCompact ? 'sm' : 'md'} />
          </div>
      </div>
    </div>
  );
};
