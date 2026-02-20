import React from 'react';
import { CoinAmount } from '../CoinAmount';
import { PRICE_UNIT_MODE, toCoins } from '../../utils/coins';

interface TrayItem {
  id: string;
  itemName: string;
  value: number;
  imageUrl?: string;
}

interface BattleResultTrayProps {
  open: boolean;
  variant: 'WIN' | 'LOSE' | 'SPECTATE';
  totalValue: number;
  bestHit: TrayItem | null;
  items: TrayItem[];
  isReplay: boolean;
  onRecreate: () => void;
  onClose: () => void;
  onReplay: () => void;
}

const titleMap: Record<'WIN' | 'LOSE' | 'SPECTATE', string> = {
  WIN: 'YOU WON',
  LOSE: 'UNLUCKY',
  SPECTATE: 'BATTLE COMPLETE'
};

export const BattleResultTray: React.FC<BattleResultTrayProps> = ({ open, variant, totalValue, bestHit, items, isReplay, onRecreate, onClose, onReplay }) => {
  return (
    <>
      <div className={`fixed inset-0 z-[89] bg-black/50 transition-opacity duration-300 ${open ? 'opacity-100' : 'pointer-events-none opacity-0'}`} onClick={onClose} />
      <div className={`fixed inset-x-0 bottom-0 z-[90] transition-transform duration-300 ${open ? 'translate-y-0' : 'translate-y-full'}`}>
        <div className="mx-auto w-full max-w-4xl rounded-t-2xl border border-white/10 bg-[#0c1320] p-4 shadow-[0_-18px_50px_rgba(0,0,0,0.55)] sm:p-5">
          <div className="mb-3 flex items-center gap-2">
            <span className={`rounded px-2 py-1 text-xs font-black ${variant === 'WIN' ? 'bg-emerald-500/20 text-emerald-300' : variant === 'LOSE' ? 'bg-rose-500/20 text-rose-300' : 'bg-sky-500/20 text-sky-300'}`}>
              {titleMap[variant]}
            </span>
            <CoinAmount amount={toCoins(totalValue, PRICE_UNIT_MODE)} className="ml-auto text-lg font-black text-white" iconClassName="h-4 w-4" />
          </div>

          {bestHit && (
            <div className="mb-3 rounded-xl border border-brand-purple/40 bg-brand-purple/10 p-2.5">
              <div className="text-[11px] uppercase text-brand-purple">Best hit</div>
              <div className="mt-1 flex items-center gap-2">
                <img src={bestHit.imageUrl || ''} alt={bestHit.itemName} width={38} height={38} className="h-10 w-10 rounded bg-[#121d31] object-cover" />
                <div>
                  <div className="text-sm text-gray-100">{bestHit.itemName}</div>
                  <div className="text-xs text-emerald-300">{bestHit.value.toLocaleString()}</div>
                </div>
              </div>
            </div>
          )}

          <div className="mb-3 grid max-h-28 grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-4">
            {items.slice(0, 8).map((item) => (
              <div key={item.id} className="rounded-lg border border-white/10 bg-[#111b2c] p-2">
                <div className="truncate text-[11px] text-gray-100">{item.itemName}</div>
                <div className="text-[10px] text-emerald-300">{item.value.toLocaleString()}</div>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            <button onClick={onRecreate} className="rounded-lg bg-brand-purple px-3 py-2 text-xs font-bold text-white">Recreate Battle</button>
            {!isReplay && <button onClick={onReplay} className="rounded-lg border border-white/20 px-3 py-2 text-xs font-bold text-gray-200">View Replay</button>}
            <button onClick={onClose} className="ml-auto rounded-lg border border-white/20 px-3 py-2 text-xs font-bold text-gray-300">Close</button>
          </div>
        </div>
      </div>
    </>
  );
};
