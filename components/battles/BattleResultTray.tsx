import React from 'react';
import { CoinAmount } from '../CoinAmount';
import { PRICE_UNIT_MODE, toCoins } from '../../utils/coins';

interface BattleResultTrayProps {
  open: boolean;
  variant: 'WIN' | 'LOSE' | 'SPECTATE';
  totalCoins: number;
  bestHit?: { itemName: string; value: number; imageUrl?: string } | null;
  recapItems: Array<{ id: string; itemName: string; value: number; imageUrl?: string }>;
  onRecreate: () => void;
  onReplay: () => void;
  onClose: () => void;
  isReplay: boolean;
}

const labels = {
  WIN: 'YOU WON',
  LOSE: 'UNLUCKY',
  SPECTATE: 'BATTLE COMPLETE'
};

export const BattleResultTray: React.FC<BattleResultTrayProps> = ({ open, variant, totalCoins, bestHit, recapItems, onRecreate, onReplay, onClose, isReplay }) => {
  return (
    <div className={`fixed inset-x-0 bottom-0 z-[85] transition-transform duration-400 ${open ? 'translate-y-0' : 'translate-y-full'}`}>
      <div className="mx-auto w-full max-w-4xl rounded-t-2xl border border-gray-700 bg-[#0d121f] p-4 sm:p-5 shadow-[0_-20px_60px_rgba(0,0,0,0.55)]">
        <div className="mb-3 flex items-center gap-2">
          <div className={`rounded px-2 py-1 text-xs font-black ${variant === 'WIN' ? 'bg-emerald-500/20 text-emerald-300' : variant === 'LOSE' ? 'bg-rose-500/20 text-rose-300' : 'bg-gray-700 text-gray-200'}`}>{labels[variant]}</div>
          <CoinAmount amount={toCoins(totalCoins, PRICE_UNIT_MODE)} className="ml-auto text-lg font-black text-white" iconClassName="w-4 h-4" />
        </div>

        {bestHit && (
          <div className="mb-3 rounded-xl border border-brand-purple/40 bg-brand-purple/10 p-2">
            <div className="text-[11px] uppercase text-brand-purple">Best hit</div>
            <div className="mt-1 flex items-center gap-2">
              <img src={bestHit.imageUrl || ''} width={36} height={36} className="h-9 w-9 rounded bg-[#131a2a] object-contain" />
              <div>
                <div className="text-sm text-white">{bestHit.itemName}</div>
                <div className="text-xs text-emerald-300">{bestHit.value.toLocaleString()}</div>
              </div>
            </div>
          </div>
        )}

        <div className="mb-3 grid max-h-28 grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-4">
          {recapItems.slice(0, 8).map((item) => (
            <div key={item.id} className="rounded-lg border border-gray-700 bg-[#101726] p-2">
              <div className="truncate text-[11px] text-gray-200">{item.itemName}</div>
              <div className="text-[10px] text-emerald-300">{item.value.toLocaleString()}</div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          <button onClick={onRecreate} className="rounded-lg bg-brand-purple px-3 py-2 text-xs font-bold text-white">Recreate Battle</button>
          {!isReplay && <button onClick={onReplay} className="rounded-lg border border-gray-600 px-3 py-2 text-xs font-bold text-gray-200">View Replay</button>}
          <button onClick={onClose} className="ml-auto rounded-lg border border-gray-600 px-3 py-2 text-xs font-bold text-gray-300">Close</button>
        </div>
      </div>
    </div>
  );
};
