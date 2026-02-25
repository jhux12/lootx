import React, { useState, useMemo } from 'react';
import { Item, Rarity } from './upgraderTypes';
import { Search, Filter, ArrowUpDown } from 'lucide-react';
import { motion } from 'motion/react';

interface UpgraderTargetPanelProps {
  items: Item[];
  selectedId: string | null;
  onSelect: (item: Item) => void;
  loading?: boolean;
}

export const UpgraderTargetPanel: React.FC<UpgraderTargetPanelProps> = ({
  items,
  selectedId,
  onSelect,
  loading = false,
}) => {
  const [search, setSearch] = useState('');
  const [rarityFilter, setRarityFilter] = useState<Rarity | 'All'>('All');
  const [categoryFilter, setCategoryFilter] = useState<string>('All');
  const [minVal, setMinVal] = useState<string>('');
  const [maxVal, setMaxVal] = useState<string>('');
  const [sortBy, setSortBy] = useState<'value-asc' | 'value-desc' | 'rarity'>('value-asc');

  const categories = useMemo(() => ['All', ...new Set(items.map(i => i.category))], [items]);
  const rarities: (Rarity | 'All')[] = ['All', 'Common', 'Uncommon', 'Rare', 'Epic', 'Legendary', 'Mythic'];

  const filteredItems = useMemo(() => {
    return items
      .filter(item => {
        const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase());
        const matchesRarity = rarityFilter === 'All' || item.rarity === rarityFilter;
        const matchesCategory = categoryFilter === 'All' || item.category === categoryFilter;
        const matchesMin = minVal === '' || item.coinValue >= parseFloat(minVal);
        const matchesMax = maxVal === '' || item.coinValue <= parseFloat(maxVal);
        return matchesSearch && matchesRarity && matchesCategory && matchesMin && matchesMax;
      })
      .sort((a, b) => {
        if (sortBy === 'value-asc') return a.coinValue - b.coinValue;
        if (sortBy === 'value-desc') return b.coinValue - a.coinValue;
        return 0; // Rarity sort could be more complex, skipping for now
      });
  }, [items, search, rarityFilter, categoryFilter, minVal, maxVal, sortBy]);

  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {[...Array(9)].map((_, i) => (
          <div key={i} className="aspect-square bg-slate-800/50 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-200">Target Item</h3>
          <span className="text-xs text-slate-400 uppercase tracking-wider">{filteredItems.length} Available</span>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="Search items..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-900/60 border border-slate-800 rounded-lg py-2 pl-10 pr-4 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>

          <div className="flex gap-2">
            <select
              value={rarityFilter}
              onChange={(e) => setRarityFilter(e.target.value as any)}
              className="flex-1 bg-slate-900/60 border border-slate-800 rounded-lg py-2 px-3 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
            >
              {rarities.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="flex-1 bg-slate-900/60 border border-slate-800 rounded-lg py-2 px-3 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
            >
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div className="flex gap-2">
            <div className="flex-1 flex gap-1">
              <input
                type="number"
                placeholder="Min"
                value={minVal}
                onChange={(e) => setMinVal(e.target.value)}
                className="w-full bg-slate-900/60 border border-slate-800 rounded-lg py-2 px-3 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
              />
              <input
                type="number"
                placeholder="Max"
                value={maxVal}
                onChange={(e) => setMaxVal(e.target.value)}
                className="w-full bg-slate-900/60 border border-slate-800 rounded-lg py-2 px-3 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-slate-900/60 border border-slate-800 rounded-lg py-2 px-3 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
            >
              <option value="value-asc">Price Low</option>
              <option value="value-desc">Price High</option>
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
        {filteredItems.map((item) => {
          const isSelected = selectedId === item.id;

          return (
            <motion.div
              key={item.id}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onSelect(item)}
              className={`
                relative group cursor-pointer rounded-xl border p-2 transition-all duration-200
                ${isSelected 
                  ? 'bg-indigo-500/10 border-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.2)]' 
                  : 'bg-slate-900/40 border-slate-800 hover:border-slate-700'}
              `}
            >
              <div className="aspect-square rounded-lg bg-slate-800/50 overflow-hidden mb-2">
                <img 
                  src={item.imageUrl} 
                  alt={item.name}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between gap-1">
                  <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${getRarityColor(item.rarity)}`}>
                    {item.rarity}
                  </span>
                  <span className="text-xs font-mono text-indigo-400">${item.coinValue.toFixed(2)}</span>
                </div>
                <p className="text-xs font-medium text-slate-300 truncate leading-tight">{item.name}</p>
              </div>

              {isSelected && (
                <div className="absolute -top-2 -right-2 bg-indigo-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-lg">
                  TARGET
                </div>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

function getRarityColor(rarity: string) {
  switch (rarity) {
    case 'Common': return 'bg-slate-500 text-white';
    case 'Uncommon': return 'bg-blue-500 text-white';
    case 'Rare': return 'bg-purple-500 text-white';
    case 'Epic': return 'bg-pink-500 text-white';
    case 'Legendary': return 'bg-orange-500 text-white';
    case 'Mythic': return 'bg-red-500 text-white';
    default: return 'bg-slate-500 text-white';
  }
}
