import React from 'react';
import { DollarSign, Package } from 'lucide-react';
import { CoinAmount } from '../CoinAmount';

interface InventoryStatsProps {
  totalItems: number;
  totalValue: number;
  availableToShip: number;
}

export const InventoryStats: React.FC<InventoryStatsProps> = ({ totalItems, totalValue }) => {
  const cards = [
    {
      label: 'Items',
      value: <span className="text-[1.65rem] font-black leading-none tracking-[-0.04em] text-white sm:text-3xl">{totalItems}</span>,
      icon: <Package className="h-7 w-7 text-purple-300 sm:h-8 sm:w-8" />,
      iconClass: 'bg-purple-500/18 shadow-[0_0_28px_rgba(139,92,246,0.28)]'
    },
    {
      label: 'Total Value',
      value: <CoinAmount amount={totalValue} formatOptions={{ minimumFractionDigits: 2, maximumFractionDigits: 2 }} className="text-[1.65rem] font-black leading-none tracking-[-0.04em] text-white sm:text-3xl" iconClassName="hidden" />,
      icon: <DollarSign className="h-7 w-7 text-emerald-300 sm:h-8 sm:w-8" />,
      iconClass: 'bg-emerald-500/18 shadow-[0_0_28px_rgba(34,197,94,0.22)]'
    }
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-5">
      {cards.map((card) => (
        <div key={card.label} className="rounded-[1.15rem] border border-white/10 bg-[#101019]/88 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.035),0_18px_38px_rgba(0,0,0,0.24)] sm:rounded-2xl sm:p-6">
          <div className="flex items-center gap-3 sm:gap-5">
            <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full sm:h-[4.25rem] sm:w-[4.25rem] ${card.iconClass}`}>{card.icon}</div>
            <div className="min-w-0">
              {card.value}
              <p className="mt-2 text-xs font-bold uppercase tracking-wide text-gray-400 sm:text-base">{card.label}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
