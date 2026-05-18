import React from 'react';
import { InventoryItem } from '../../types';
import { getItemCoinValue } from '../../utils/upgrader';

type Props = {
  items: InventoryItem[];
  selectedId: string | null;
  onSelect: (instanceId: string) => void;
};

export const SourceInventoryPicker: React.FC<Props> = ({ items, selectedId, onSelect }) => (
  <div className="rounded-2xl border border-white/10 bg-[#0b1120] p-3 sm:p-4">
    <h2 className="mb-3 text-lg font-bold text-white">1) Select Source Item</h2>
    <div className="grid max-h-[420px] grid-cols-1 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
      {items.map((item) => {
        const active = selectedId === item.instanceId;
        return (
          <button key={item.instanceId} onClick={() => onSelect(item.instanceId)} className={`rounded-xl border p-2 text-left transition ${active ? 'border-blue-400 bg-blue-500/20' : 'border-white/10 bg-[#111827] hover:border-white/20'}`}>
            <div className="flex items-center gap-2">
              <img src={item.image} alt={item.name} className="h-12 w-12 rounded-lg object-cover" loading="lazy" decoding="async" width={48} height={48} />
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-white">{item.name}</div>
                <div className="text-xs text-gray-400">{item.rarity} · {item.category || 'misc'}</div>
                <div className="text-xs font-bold text-emerald-300">{getItemCoinValue(item).toLocaleString()} coins</div>
              </div>
            </div>
          </button>
        );
      })}
      {items.length === 0 && <div className="text-sm text-gray-400">No upgrade-eligible items in inventory.</div>}
    </div>
  </div>
);
