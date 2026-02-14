import React, { memo, useEffect, useRef, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { CoinAmount } from './CoinAmount';
import { MysteryBox } from '../types';
import { RiskSliderIndicator } from './RiskSliderIndicator';
import { resolveRiskValue } from '../utils/riskIndicator';
import { PRICE_UNIT_MODE, toCoins } from '../utils/coins';
import { XP_ICON } from '../constants';

type BoxCardProps = {
  box: MysteryBox;
  onSelect: (boxId: string) => void;
  onHover?: () => void;
  size?: 'default' | 'compact';
};

const getRiskBadgeLabel = (riskValue: number): 'Safe' | 'Balanced' | 'Risk' => {
  if (riskValue <= 33) return 'Safe';
  if (riskValue <= 66) return 'Balanced';
  return 'Risk';
};

const BoxCardComponent: React.FC<BoxCardProps> = ({ box, onSelect, onHover, size = 'default' }) => {
  const [isDropping, setIsDropping] = useState(false);
  const clickTimeoutRef = useRef<number | null>(null);
  const isCompact = size === 'compact';
  const riskValue = resolveRiskValue(box.riskLevel ?? null);
  const badgeLabel = getRiskBadgeLabel(riskValue);

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
      className={`group relative flex h-full cursor-pointer flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0b101a] text-left shadow-[0_12px_32px_-28px_rgba(0,0,0,0.75)] transition-all duration-300 ${isCompact ? 'p-3 sm:p-4' : 'p-4 sm:p-5'} ${isDropping ? 'translate-y-2 scale-[0.98]' : 'hover:-translate-y-1 hover:border-white/20'}`}
      style={{ ['--risk-accent' as string]: box.accentColor }}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{ background: `linear-gradient(180deg, ${box.accentColor}1a, transparent 60%)` }}
      />

      <div className={`relative flex w-full flex-1 items-center justify-center ${isCompact ? 'mb-2.5 min-h-[130px]' : 'mb-3 min-h-[150px]'}`}>
        <span
          className="absolute right-1 top-1 z-20 rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-wide"
          style={{
            color: box.accentColor,
            borderColor: `${box.accentColor}88`,
            backgroundColor: `${box.accentColor}22`
          }}
          aria-label={`Risk level: ${badgeLabel}`}
        >
          {badgeLabel}
        </span>
        <div
          className="absolute inset-4 rounded-full opacity-25"
          style={{
            background: `radial-gradient(circle, ${box.accentColor}66 0%, ${box.accentColor}00 68%)`
          }}
        />
        <img
          src={box.image}
          alt={box.name}
          loading="lazy"
          decoding="async"
          className={`relative z-10 object-contain drop-shadow-[0_18px_24px_rgba(0,0,0,0.45)] transition-transform duration-300 group-hover:scale-105 ${isCompact ? 'h-28 w-28 sm:h-32 sm:w-32' : 'h-32 w-32 sm:h-40 sm:w-40'}`}
        />
      </div>

      <div className="relative flex w-full flex-col gap-2">
        <h4 className="truncate text-sm font-semibold text-gray-100 transition-colors duration-300 group-hover:text-white sm:text-sm">
          {box.name}
        </h4>

        <div className="w-full">
          <RiskSliderIndicator value={riskValue} size={isCompact ? 'sm' : 'md'} />
        </div>

        <div className="flex w-full min-w-0 items-center justify-between gap-2 whitespace-nowrap">
          {box.currencyType === 'XP' ? (
            <div className="flex min-w-0 items-center gap-1.5 text-sm font-semibold text-white sm:text-base">
              <img src={XP_ICON} alt="XP" loading="lazy" decoding="async" className="h-4 w-4 shrink-0 object-contain" />
              <span className="truncate">{Math.max(0, Math.floor(Number(box.priceXP ?? 0))).toLocaleString()}</span>
            </div>
          ) : (
            <CoinAmount
              amount={toCoins(box.price, PRICE_UNIT_MODE)}
              formatOptions={{ maximumFractionDigits: 0 }}
              className="min-w-0 justify-start text-sm font-semibold text-white sm:text-base"
              iconClassName="h-4 w-4 shrink-0"
            />
          )}

          <span className="inline-flex shrink-0 items-center gap-0.5 text-[11px] font-semibold uppercase tracking-wide text-white/70 transition-colors group-hover:text-white">
            Open
            <ChevronRight className="h-3.5 w-3.5" />
          </span>
        </div>
      </div>
    </div>
  );
};

export const BoxCard = memo(BoxCardComponent);
