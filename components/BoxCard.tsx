import React, { useEffect, useRef, useState } from 'react';
import { CoinAmount } from './CoinAmount';
import { getRiskLabel } from '../utils/caseOdds';
import { MysteryBox } from '../types';

type BoxCardProps = {
  box: MysteryBox;
  onSelect: (boxId: string) => void;
  onHover?: () => void;
};

export const BoxCard: React.FC<BoxCardProps> = ({ box, onSelect, onHover }) => {
  const badgeTag = box.tag ?? box.tags?.[0];
  const [isDropping, setIsDropping] = useState(false);
  const clickTimeoutRef = useRef<number | null>(null);

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
      className={`group relative bg-[#131720] border border-gray-800 rounded-xl p-4 flex flex-col items-center cursor-pointer transition-all duration-200 ${isDropping ? 'translate-y-3 scale-[0.98] shadow-inner shadow-black/40' : 'hover:border-gray-600 hover:-translate-y-1'}`}
    >
      <div
        className={`pointer-events-none absolute inset-0 rounded-xl opacity-0 transition-opacity duration-200 ${isDropping ? 'opacity-100' : ''}`}
        style={{ boxShadow: `inset 0 0 25px ${box.accentColor}33, 0 12px 25px -12px ${box.accentColor}66` }}
      />
      {/* Tag */}
      {badgeTag && (
          <span className="absolute top-3 left-3 px-2 py-0.5 text-[10px] font-bold text-white bg-red-500 rounded uppercase tracking-wide z-10">
              {badgeTag}
          </span>
      )}
      
      {/* Image Container with Glow */}
      <div className="relative w-full aspect-square mb-4 flex items-center justify-center">
          <div 
              className="absolute inset-4 rounded-full blur-2xl opacity-20 group-hover:opacity-40 transition-opacity"
              style={{ backgroundColor: box.accentColor }}
          ></div>
          <img 
              src={box.image} 
              alt={box.name} 
              className="relative z-10 w-3/4 h-3/4 object-contain drop-shadow-xl transform group-hover:scale-110 transition-transform duration-300" 
          />
      </div>

      {/* Info */}
      <div className="text-center w-full">
          <h4 className="text-gray-400 text-sm font-medium mb-1 group-hover:text-white">{box.name}</h4>
          <CoinAmount
            amount={box.price}
            formatOptions={{ maximumFractionDigits: 0 }}
            className="text-white font-bold text-lg justify-center"
            iconClassName="w-4 h-4"
          />
          <div className="mt-2 text-[10px] uppercase tracking-wide text-gray-500">
            {getRiskLabel(box.riskLevel ?? 50)}
          </div>
      </div>

      {/* Bottom Color Bar */}
      <div 
          className="absolute bottom-0 left-4 right-4 h-0.5 rounded-t-full opacity-50 group-hover:opacity-100 transition-opacity"
          style={{ backgroundColor: box.accentColor, boxShadow: `0 0 10px ${box.accentColor}` }}
      />
    </div>
  );
};
