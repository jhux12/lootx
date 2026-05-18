import React, { useEffect, useMemo, useState } from 'react';
import { InventoryItem, Item } from './upgraderTypes';
import { AlertCircle, Zap } from 'lucide-react';
import { motion } from 'motion/react';
import { UpgraderSettings } from '../../utils/upgrader';

interface UpgraderPreviewBarProps {
  source: InventoryItem | null;
  target: Item | null;
  onUpgrade: () => void;
  disabled?: boolean;
  chanceOverride?: number;
  settings?: UpgraderSettings | null;
}

const toPercent = (value: number, fallback: number) => {
  if (!Number.isFinite(value)) return fallback;
  return value <= 1 ? value * 100 : value;
};

const formatChancePercent = (value: number) => {
  const safeValue = Math.max(0, value);
  if (safeValue >= 1) return `${safeValue.toFixed(2)}%`;
  if (safeValue >= 0.01) return `${safeValue.toFixed(3)}%`;
  return `${safeValue.toFixed(4)}%`;
};

export const UpgraderPreviewBar: React.FC<UpgraderPreviewBarProps> = ({
  source,
  target,
  onUpgrade,
  disabled = false,
  chanceOverride,
  settings,
}) => {
  const [isScrolling, setIsScrolling] = useState(false);

  useEffect(() => {
    let timeoutId: number | undefined;
    const onScroll = () => {
      const nearBottom = window.innerHeight + window.scrollY >= document.body.scrollHeight - 120;
      if (nearBottom) {
        setIsScrolling(false);
        return;
      }
      setIsScrolling(true);
      window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(() => setIsScrolling(false), 250);
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.clearTimeout(timeoutId);
    };
  }, []);

  const chanceText = useMemo(() => {
    if (!source || !target) return '—';

    if (typeof chanceOverride === 'number') {
      return formatChancePercent(chanceOverride);
    }

    const edgeRaw = settings?.edgeMultiplier ?? 0.95;
    const edge = edgeRaw > 1 ? edgeRaw / 100 : edgeRaw;
    const minChance = toPercent(settings?.minChance ?? 0.0001, 0.0001);
    const maxChance = toPercent(settings?.maxChance ?? 80, 80);
    const rawChance = ((source.coinValue / target.coinValue) * edge) * 100;
    const chance = Math.min(maxChance, Math.max(minChance, rawChance));

    return formatChancePercent(chance);
  }, [chanceOverride, settings, source, target]);

  const isValid = Boolean(source && target && source.coinValue < target.coinValue);
  const warning = source && target && source.coinValue >= target.coinValue ? 'Target must be higher value' : null;
  const sourceLabel = source ? `${source.name} (${Math.round(source.coinValue).toLocaleString()})` : 'Select source';
  const targetLabel = target ? `${target.name} (${Math.round(target.coinValue).toLocaleString()})` : 'Select target';

  return (
    <div
      className="fixed left-0 right-0 z-40 px-2 sm:px-4"
      style={{ bottom: 'calc(var(--bottom-nav-height, 64px) + env(safe-area-inset-bottom))' }}
    >
      <div className="max-w-7xl mx-auto rounded-xl border border-slate-800/70 bg-slate-950/90 backdrop-blur-xl shadow-lg">
        <div className={`flex items-center gap-2 sm:gap-3 px-3 sm:px-4 transition-all duration-200 ${isScrolling ? 'py-2' : 'py-2.5 sm:py-3'}`}>
          <div className="min-w-[76px] sm:min-w-[88px]">
            <p className="text-[9px] uppercase tracking-wider text-slate-500 font-bold">Chance</p>
            <p className="text-base sm:text-lg font-black text-white leading-none">{chanceText}</p>
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-[11px] sm:text-xs text-slate-300 truncate font-medium">
              {sourceLabel} <span className="text-slate-500">→</span> {targetLabel}
            </p>
            {!isScrolling && warning && (
              <div className="mt-0.5 inline-flex items-center gap-1 text-amber-400">
                <AlertCircle className="w-3.5 h-3.5" />
                <span className="text-[10px] sm:text-xs font-medium truncate">{warning}</span>
              </div>
            )}
          </div>

          <motion.button
            whileHover={!disabled && isValid ? { scale: 1.02, boxShadow: '0 0 20px rgba(32,93,215,0.28)' } : {}}
            whileTap={!disabled && isValid ? { scale: 0.98 } : {}}
            disabled={disabled || !isValid}
            onClick={onUpgrade}
            className={`
              relative overflow-hidden group rounded-lg font-black uppercase tracking-wide transition-all duration-200 shrink-0
              ${isScrolling ? 'px-4 py-2 text-xs' : 'px-5 sm:px-6 py-2.5 text-xs sm:text-sm'}
              ${!isValid || disabled
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                : 'bg-[#205DD7] text-white hover:bg-[#1f6bea]'}
            `}
          >
            <div className="relative z-10 flex items-center gap-1.5">
              <Zap className={`w-4 h-4 ${isValid ? 'fill-current' : ''}`} />
              Upgrade
            </div>
          </motion.button>
        </div>
      </div>
    </div>
  );
};
