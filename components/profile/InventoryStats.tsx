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
    <div className="grid grid-cols-1 gap-3 min-[520px]:grid-cols-3">
      <div className="rounded-2xl border border-purple-400/20 bg-[#111421]/90 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_18px_35px_rgba(0,0,0,0.22)]">
        <div className="flex items-center gap-4">
          <Package className="h-8 w-8 text-purple-400" />
          <div><p className="text-2xl font-black leading-none text-white">{totalItems}</p><p className="mt-1 text-sm font-medium text-gray-400">Total Items</p></div>
        </div>
      </div>
      <div className="rounded-2xl border border-sky-400/15 bg-[#101823]/90 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_18px_35px_rgba(0,0,0,0.22)]">
        <div className="flex items-center gap-4">
          <Clock className="h-8 w-8 text-sky-400" />
          <div><CoinAmount amount={totalValue} formatOptions={{ maximumFractionDigits: 0 }} className="text-2xl font-black leading-none text-white" iconClassName="hidden" /><p className="mt-1 text-sm font-medium text-gray-400">Total Value</p></div>
        </div>
      </div>
      <div className="rounded-2xl border border-amber-300/20 bg-[#171916]/90 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_18px_35px_rgba(0,0,0,0.22)]">
        <div className="flex items-center gap-4">
          <Truck className="h-8 w-8 text-amber-300" />
          <div><p className="text-2xl font-black leading-none text-white">{availableToShip}</p><p className="mt-1 text-sm font-medium text-gray-400">Available to Ship</p></div>
        </div>
      </div>
    </div>
  );
};
