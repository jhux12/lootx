import React from 'react';
import { UpgraderTarget } from '../../utils/upgrader';

type Props = {
  targets: UpgraderTarget[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  filters: {
    rarity: string;
    category: string;
    min: number;
    max: number;
    sort: 'asc' | 'desc';
  };
  onFilterChange: (next: Props['filters']) => void;
};

export const TargetPicker: React.FC<Props> = ({ targets, selectedId, onSelect, filters, onFilterChange }) => {
  const filtered = targets
    .filter((target) => !filters.rarity || target.rarity === filters.rarity)
    .filter((target) => !filters.category || target.category === filters.category)
    .filter((target) => target.coinValue >= filters.min && (filters.max <= 0 || target.coinValue <= filters.max))
    .sort((a, b) => (filters.sort === 'asc' ? a.coinValue - b.coinValue : b.coinValue - a.coinValue));

  return (
    <div className="rounded-2xl border border-white/10 bg-[#0b1120] p-3 sm:p-4">
      <h2 className="mb-3 text-lg font-bold text-white">2) Select Target Item</h2>
      <div className="mb-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
        <input placeholder="Rarity" value={filters.rarity} onChange={(e) => onFilterChange({ ...filters, rarity: e.target.value })} className="rounded-lg border border-white/10 bg-black/20 px-2 py-1.5 text-white" />
        <input placeholder="Category" value={filters.category} onChange={(e) => onFilterChange({ ...filters, category: e.target.value })} className="rounded-lg border border-white/10 bg-black/20 px-2 py-1.5 text-white" />
        <input type="number" placeholder="Min" value={filters.min || ''} onChange={(e) => onFilterChange({ ...filters, min: Number(e.target.value || 0) })} className="rounded-lg border border-white/10 bg-black/20 px-2 py-1.5 text-white" />
        <select value={filters.sort} onChange={(e) => onFilterChange({ ...filters, sort: e.target.value as 'asc' | 'desc' })} className="rounded-lg border border-white/10 bg-black/20 px-2 py-1.5 text-white">
          <option value="asc">Value ↑</option>
          <option value="desc">Value ↓</option>
        </select>
      </div>
      <div className="grid max-h-[420px] grid-cols-1 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
        {filtered.map((target) => {
          const active = target.id === selectedId;
          return (
            <button key={target.id} onClick={() => onSelect(target.id)} className={`rounded-xl border p-2 text-left transition ${active ? 'border-cyan-400 bg-cyan-500/20' : 'border-white/10 bg-[#111827] hover:border-white/20'}`}>
              <div className="flex items-center gap-2">
                <img src={target.imageUrl} alt={target.name} className="h-12 w-12 rounded-lg object-cover" />
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-white">{target.name}</div>
                  <div className="text-xs text-gray-400">{target.rarity} · {target.category}</div>
                  <div className="text-xs font-bold text-cyan-300">{target.coinValue.toLocaleString()} coins</div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
