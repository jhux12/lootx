import React from 'react';
import { CoinAmount } from '../CoinAmount';
import { PRICE_UNIT_MODE, toCoins } from '../../utils/coins';

interface RoundRecapOverlayProps {
  visible: boolean;
  roundNumber: number;
  winningTeam: 'A' | 'B' | 'TIE';
  deltaCoins: number;
  items: Array<{ uid: string; playerName: string; itemName: string; value: number; imageUrl?: string }>;
}

export const RoundRecapOverlay: React.FC<RoundRecapOverlayProps> = ({ visible, roundNumber, winningTeam, deltaCoins, items }) => {
  return (
    <div className={`pointer-events-none fixed left-1/2 top-[88px] z-[70] w-[min(94vw,760px)] -translate-x-1/2 transition-all duration-300 ${visible ? 'translate-y-0 opacity-100' : '-translate-y-3 opacity-0'}`}>
      <div className="rounded-xl border border-white/10 bg-[#0e1320]/95 p-3 shadow-2xl backdrop-blur">
        <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm">
          <span className="rounded bg-brand-purple/20 px-2 py-1 font-semibold text-brand-purple">Round {roundNumber}</span>
          <span className="text-gray-200">Winner: {winningTeam === 'TIE' ? 'Tie' : `Team ${winningTeam}`}</span>
          <CoinAmount amount={toCoins(deltaCoins, PRICE_UNIT_MODE)} className="ml-auto text-emerald-300 font-black" iconClassName="w-3 h-3" />
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {items.map((item) => (
            <div key={`${item.uid}-${item.itemName}`} className="rounded-lg border border-gray-700 bg-[#0b0f18] p-2">
              <div className="mb-1 text-[10px] text-gray-500 truncate">{item.playerName}</div>
              <div className="flex items-center gap-2">
                <img src={item.imageUrl || ''} width={24} height={24} className="h-6 w-6 rounded object-contain bg-[#101726]" />
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
