import React from 'react';
import { Clock, Package, Truck } from 'lucide-react';
import { CoinAmount } from '../CoinAmount';

interface InventoryStatsProps {
  totalItems: number;
  totalValue: number;
  availableToShip: number;
}

export const InventoryStats: React.FC<InventoryStatsProps> = ({ totalItems, totalValue, availableToShip }) => {
  return (
    <div className="grid grid-cols-3 gap-2">
      <div className="rounded-xl border border-purple-400/20 bg-[#111421]/90 p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_10px_22px_rgba(0,0,0,0.18)]">
        <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
          <Package className="h-4 w-4 shrink-0 text-purple-400 sm:h-5 sm:w-5" />
          <div><p className="text-base font-black leading-none text-white sm:text-lg">{totalItems}</p><p className="mt-0.5 truncate text-[10px] font-semibold leading-tight text-gray-400 sm:text-xs">Total Items</p></div>
        </div>
      </div>
      <div className="rounded-xl border border-sky-400/15 bg-[#101823]/90 p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_10px_22px_rgba(0,0,0,0.18)]">
        <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
          <Clock className="h-4 w-4 shrink-0 text-sky-400 sm:h-5 sm:w-5" />
          <div><CoinAmount amount={totalValue} formatOptions={{ maximumFractionDigits: 0 }} className="text-base font-black leading-none text-white sm:text-lg" iconClassName="hidden" /><p className="mt-0.5 truncate text-[10px] font-semibold leading-tight text-gray-400 sm:text-xs">Total Value</p></div>
        </div>
      </div>
      <div className="rounded-xl border border-amber-300/20 bg-[#171916]/90 p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_10px_22px_rgba(0,0,0,0.18)]">
        <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
          <Truck className="h-4 w-4 shrink-0 text-amber-300 sm:h-5 sm:w-5" />
          <div><p className="text-base font-black leading-none text-white sm:text-lg">{availableToShip}</p><p className="mt-0.5 truncate text-[10px] font-semibold leading-tight text-gray-400 sm:text-xs">Available to Ship</p></div>
        </div>
      </div>
    </div>
  );
};
