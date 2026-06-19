import React from 'react';
import { Package } from 'lucide-react';
import { COIN_ICON } from '../../constants';
import { CoinAmount } from '../CoinAmount';

interface InventoryStatsProps {
  totalItems: number;
  totalValue: number;
  availableToShip: number;
}

export const InventoryStats: React.FC<InventoryStatsProps> = ({ totalItems, totalValue, availableToShip }) => {
  return (
    <div className="grid grid-cols-1 gap-3 min-[560px]:grid-cols-3">
      <div className="rounded-3xl border border-purple-400/20 bg-[#111722]/90 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_18px_35px_rgba(0,0,0,0.22)]">
        <div className="flex items-center gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-purple-500/10 text-purple-400 shadow-[0_0_24px_rgba(168,85,247,0.16)]"><Package className="h-8 w-8" /></span>
          <div><p className="text-sm font-black uppercase tracking-wide text-gray-400">Total Items</p><p className="mt-1 text-2xl font-black text-white">{totalItems}</p></div>
        </div>
      </div>
      <div className="rounded-3xl border border-blue-400/20 bg-[#111722]/90 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_18px_35px_rgba(0,0,0,0.22)]">
        <div className="flex items-center gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-500/10 shadow-[0_0_24px_rgba(59,130,246,0.14)]"><img src={COIN_ICON} alt="Coin" className="h-8 w-8" loading="lazy" decoding="async" /></span>
          <div><p className="text-sm font-black uppercase tracking-wide text-gray-400">Total Value</p><CoinAmount amount={totalValue} formatOptions={{ maximumFractionDigits: 0 }} className="mt-1 text-2xl font-black text-white" iconClassName="hidden" /></div>
        </div>
      </div>
      <div className="rounded-3xl border border-emerald-400/20 bg-[#101a17]/90 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_18px_35px_rgba(0,0,0,0.22)]">
        <div className="flex items-center gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400 shadow-[0_0_24px_rgba(52,211,153,0.14)]"><Package className="h-8 w-8" /></span>
          <div><p className="text-sm font-black uppercase tracking-wide text-gray-400">Available to Ship</p><p className="mt-1 text-2xl font-black text-white">{availableToShip}</p></div>
        </div>
      </div>
    </div>
  );
};
