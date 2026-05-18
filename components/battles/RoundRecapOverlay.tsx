import React from 'react';
import { CoinAmount } from '../CoinAmount';
import { PRICE_UNIT_MODE, toCoins } from '../../utils/coins';

interface RecapItem {
  uid: string;
  playerName: string;
  itemName: string;
  value: number;
  imageUrl?: string;
}

interface RoundRecapOverlayProps {
  open: boolean;
  roundIndex: number;
  winnerTeam: 'A' | 'B' | 'TIE';
  deltaValue: number;
  items: RecapItem[];
}

export const RoundRecapOverlay: React.FC<RoundRecapOverlayProps> = ({ open, roundIndex, winnerTeam, deltaValue, items }) => {
  return (
    <div className={`pointer-events-none absolute left-1/2 top-2 z-30 w-[min(96%,760px)] -translate-x-1/2 transition-all duration-300 ${open ? 'translate-y-0 opacity-100' : '-translate-y-2 opacity-0'}`}>
      <div className="rounded-xl border border-white/10 bg-[#0d1422]/95 p-3 shadow-xl backdrop-blur-sm">
        <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm">
          <span className="rounded bg-brand-blue/20 px-2 py-1 font-semibold text-brand-blue">Round {roundIndex + 1}</span>
          <span className="text-gray-200">Winner: {winnerTeam === 'TIE' ? 'Tie' : `Team ${winnerTeam}`}</span>
          <CoinAmount amount={toCoins(deltaValue, PRICE_UNIT_MODE)} className="ml-auto text-sm font-black text-emerald-300" iconClassName="h-3 w-3" />
        </div>

        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {items.map((item) => (
            <div key={`${item.uid}-${item.itemName}`} className="rounded-lg border border-white/10 bg-[#101a2b] p-2">
              <div className="mb-1 truncate text-[10px] text-gray-400">{item.playerName}</div>
              <div className="flex items-center gap-2">
                <img src={item.imageUrl || ''} alt={item.itemName} width={26} height={26} className="h-6 w-6 rounded bg-[#172338] object-cover" />
                <div className="min-w-0">
                  <div className="truncate text-[11px] text-gray-200">{item.itemName}</div>
                  <div className="text-[10px] text-emerald-300">{item.value.toLocaleString()}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
