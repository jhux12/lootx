import React from 'react';
import { CoinAmount } from '../CoinAmount';

interface InventoryStatsProps {
  totalItems: number;
  totalValue: number;
  availableToShip: number;
}

export const InventoryStats: React.FC<InventoryStatsProps> = ({ totalItems, totalValue, availableToShip }) => {
  return (
    <div className="grid grid-cols-3 gap-2 sm:gap-3">
      <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-white/10 to-white/[0.03] p-3">
        <p className="text-[11px] uppercase tracking-wide text-gray-400">Total Items</p>
        <p className="mt-1 text-lg font-bold text-white">{totalItems}</p>
      </div>
      <div className="rounded-2xl border border-blue-400/25 bg-gradient-to-b from-[#205DD7]/15 to-white/[0.02] p-3">
        <p className="text-[11px] uppercase tracking-wide text-gray-300">Total Value</p>
        <CoinAmount amount={totalValue} formatOptions={{ maximumFractionDigits: 0 }} className="mt-1 text-lg font-bold text-white" iconClassName="h-4 w-4" />
      </div>
      <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-white/10 to-white/[0.03] p-3">
        <p className="text-[11px] uppercase tracking-wide text-gray-400">Available to Ship</p>
        <p className="mt-1 text-lg font-bold text-white">{availableToShip}</p>
      </div>
    </div>
  );
};
