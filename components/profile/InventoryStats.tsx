import React from 'react';
import { Coins, Package } from 'lucide-react';
import { CoinAmount } from '../CoinAmount';

interface InventoryStatsProps {
  totalItems: number;
  totalValue: number;
  availableToShip: number;
}

export const InventoryStats: React.FC<InventoryStatsProps> = ({ totalItems, totalValue }) => {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4">
      <div className="rounded-2xl border border-white/10 bg-[#101019]/90 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_18px_35px_rgba(0,0,0,0.22)] sm:p-5">
        <div className="flex items-center gap-3 sm:gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-purple-500/18 text-purple-300 shadow-[0_0_24px_rgba(139,92,246,0.2)] sm:h-16 sm:w-16">
            <Package className="h-6 w-6 sm:h-8 sm:w-8" />
          </span>
          <div className="min-w-0">
            <p className="text-2xl font-black leading-none text-white sm:text-3xl">{totalItems}</p>
            <p className="mt-1 text-xs font-black uppercase tracking-wide text-gray-400 sm:text-sm">Items</p>
          </div>
        </div>
      </div>
      <div className="rounded-2xl border border-white/10 bg-[#101019]/90 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_18px_35px_rgba(0,0,0,0.22)] sm:p-5">
        <div className="flex items-center gap-3 sm:gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-500/16 text-emerald-300 shadow-[0_0_24px_rgba(16,185,129,0.16)] sm:h-16 sm:w-16">
            <Coins className="h-6 w-6 sm:h-8 sm:w-8" />
          </span>
          <div className="min-w-0">
            <CoinAmount amount={totalValue} formatOptions={{ maximumFractionDigits: 0 }} className="text-xl font-black leading-none text-white sm:text-3xl" iconClassName="h-5 w-5 sm:h-7 sm:w-7" />
            <p className="mt-1 text-xs font-black uppercase tracking-wide text-gray-400 sm:text-sm">Total Value</p>
          </div>
        </div>
      </div>
    </div>
  );
};
