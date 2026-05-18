import React from 'react';
import { UpgraderTarget } from '../../utils/upgrader';

type Props = {
  targets: UpgraderTarget[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  filters: {
    category: 'all' | 'tech' | 'collectible' | 'apparel';
    min: number;
    max: number;
  };
  onFilterChange: (next: Props['filters']) => void;
};

export const TargetPicker: React.FC<Props> = ({ targets, selectedId, onSelect, filters, onFilterChange }) => {
  const filtered = targets
    .filter((target) => target.enabled === true)
    .filter((target) => filters.category === 'all' || target.category === filters.category)
    .filter((target) => target.coinValue >= filters.min && (filters.max <= 0 || target.coinValue <= filters.max))
    .sort((a, b) => {
      if ((a.featured === true) !== (b.featured === true)) return a.featured ? -1 : 1;
      const aSort = a.upgraderSort == null ? Number.POSITIVE_INFINITY : Number(a.upgraderSort);
      const bSort = b.upgraderSort == null ? Number.POSITIVE_INFINITY : Number(b.upgraderSort);
      if (aSort !== bSort) return aSort - bSort;
      return a.coinValue - b.coinValue;
    });

  const categories: Array<{ key: Props['filters']['category']; label: string }> = [
    { key: 'all', label: 'All' },
    { key: 'tech', label: 'Tech' },
    { key: 'collectible', label: 'Collectibles' },
    { key: 'apparel', label: 'Apparel' }
  ];

  return (
    <div className="rounded-2xl border border-white/10 bg-[#0b1120] p-3 sm:p-4">
      <h2 className="mb-3 text-lg font-bold text-white">2) Select Target Item</h2>
      <div className="mb-3 rounded-xl border border-cyan-500/20 bg-[#091021] p-1">
        <div className="grid grid-cols-2 gap-1 sm:grid-cols-4">
          {categories.map((entry) => {
            const active = filters.category === entry.key;
            return (
              <button
                key={entry.key}
                type="button"
                onClick={() => onFilterChange({ ...filters, category: entry.key })}
                className={`rounded-lg px-2 py-2 text-xs font-semibold transition ${active ? 'bg-cyan-500/25 text-cyan-100 ring-1 ring-cyan-400/50' : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'}`}
              >
                {entry.label}
              </button>
            );
          })}
        </div>
      </div>
      <div className="mb-3 grid grid-cols-2 gap-2 text-xs">
        <input type="number" placeholder="Min" value={filters.min || ''} onChange={(e) => onFilterChange({ ...filters, min: Number(e.target.value || 0) })} className="rounded-lg border border-white/10 bg-black/20 px-2 py-1.5 text-white" />
        <input type="number" placeholder="Max" value={filters.max || ''} onChange={(e) => onFilterChange({ ...filters, max: Number(e.target.value || 0) })} className="rounded-lg border border-white/10 bg-black/20 px-2 py-1.5 text-white" />
      </div>
      <div className="grid max-h-[460px] grid-cols-1 gap-2 overflow-y-auto pr-1 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((target) => {
          const active = target.id === selectedId;
          return (
            <button key={target.id} onClick={() => onSelect(target.id)} className={`rounded-xl border p-2 text-left transition ${active ? 'border-cyan-400 bg-cyan-500/20 shadow-[0_0_0_1px_rgba(34,211,238,0.25)]' : 'border-white/10 bg-[#111827] hover:border-white/20'}`}>
              <div className="flex items-center gap-2">
                <img src={target.imageUrl} alt={target.name} className="h-14 w-14 rounded-lg object-cover" loading="lazy" decoding="async" width={56} height={56} />
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-white">{target.name}</div>
                  <div className="text-xs text-gray-400">{target.rarity}</div>
                  <div className="text-xs font-bold text-cyan-300">{target.coinValue.toLocaleString()} coins</div>
                  {target.featured && <div className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-sky-300">Featured</div>}
                </div>
              </div>
            </button>
          );
        })}
        {filtered.length === 0 && <div className="col-span-full rounded-xl border border-white/10 bg-[#111827] p-3 text-xs text-gray-400">No eligible targets in this filter. Try "All" or adjust value range.</div>}
      </div>
    </div>
  );
};
