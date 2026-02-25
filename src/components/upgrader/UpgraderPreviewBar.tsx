import React from 'react';
import { InventoryItem, Item } from './upgraderTypes';
import { AlertCircle, Zap } from 'lucide-react';
import { motion } from 'motion/react';

interface UpgraderPreviewBarProps {
  source: InventoryItem | null;
  target: Item | null;
  onUpgrade: () => void;
  disabled?: boolean;
  chanceOverride?: number;
}

export const UpgraderPreviewBar: React.FC<UpgraderPreviewBarProps> = ({
  source,
  target,
  onUpgrade,
  disabled = false,
  chanceOverride,
}) => {
  const calculateChance = () => {
    if (!source || !target) return 0;
    // Mock chance calculation: (source / target) * 0.95 (edge)
    const rawChance = (source.coinValue / target.coinValue) * 0.95 * 100;
    return Math.min(Math.max(rawChance, 0.01), 80).toFixed(2);
  };

  const chance = typeof chanceOverride === 'number' ? chanceOverride.toFixed(2) : calculateChance();
  const isValid = source && target && source.coinValue < target.coinValue;
  
  const warnings = [];
  if (source && target && source.coinValue >= target.coinValue) {
    warnings.push("Target must be higher value than source.");
  }
  if (!source) warnings.push("Select a source item.");
  if (!target) warnings.push("Select a target item.");

  return (
    <div className="fixed bottom-[70px] sm:bottom-0 left-0 right-0 bg-slate-950/80 backdrop-blur-xl border-t border-slate-800 p-4 z-40">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-6">
          <div className="hidden sm:flex flex-col">
            <span className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">Upgrade Chance</span>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-black text-white">{chance}%</span>
              <span className="text-xs text-slate-400 font-medium">ESTIMATED</span>
            </div>
          </div>

          <div className="h-10 w-[1px] bg-slate-800 hidden md:block" />

          <div className="flex flex-col gap-1">
            {warnings.length > 0 ? (
              <div className="flex items-center gap-2 text-amber-500">
                <AlertCircle className="w-4 h-4" />
                <span className="text-xs font-medium">{warnings[0]}</span>
              </div>
            ) : (
              <div className="flex items-center gap-4">
                <div className="flex flex-col">
                  <span className="text-[10px] text-slate-500 uppercase font-bold">From</span>
                  <span className="text-sm font-semibold text-slate-200 truncate max-w-[120px]">{source?.name}</span>
                </div>
                <div className="text-slate-600">→</div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-slate-500 uppercase font-bold">To</span>
                  <span className="text-sm font-semibold text-slate-200 truncate max-w-[120px]">{target?.name}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        <motion.button
          whileHover={!disabled && isValid ? { scale: 1.02, boxShadow: '0 0 20px rgba(99,102,241,0.4)' } : {}}
          whileTap={!disabled && isValid ? { scale: 0.98 } : {}}
          disabled={disabled || !isValid}
          onClick={onUpgrade}
          className={`
            relative overflow-hidden group px-12 py-4 rounded-xl font-black text-lg uppercase tracking-wider transition-all duration-200
            ${!isValid || disabled 
              ? 'bg-slate-800 text-slate-500 cursor-not-allowed' 
              : 'bg-indigo-600 text-white hover:bg-indigo-500'}
          `}
        >
          <div className="relative z-10 flex items-center gap-2">
            <Zap className={`w-5 h-5 ${isValid ? 'fill-current' : ''}`} />
            Upgrade Now
          </div>
          {isValid && !disabled && (
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:animate-[shimmer_2s_infinite]" />
          )}
        </motion.button>
      </div>
    </div>
  );
};
