import React, { useState, useMemo } from 'react';
import { Item, Rarity } from './upgraderTypes';
import { Search, SlidersHorizontal, ArrowUpDown, X, Coins } from 'lucide-react';
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
  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false);
  const [infoItem, setInfoItem] = useState<Item | null>(null);

  const [draftRarity, setDraftRarity] = useState<Rarity | 'All'>('All');
  const [draftCategory, setDraftCategory] = useState<string>('All');
  const [draftMin, setDraftMin] = useState<string>('');
  const [draftMax, setDraftMax] = useState<string>('');
  const [draftSortBy, setDraftSortBy] = useState<'value-asc' | 'value-desc' | 'rarity'>('value-asc');

  const categories = useMemo(() => ['All', ...new Set(items.map((i) => i.category))], [items]);
  const rarities: (Rarity | 'All')[] = ['All', 'Common', 'Uncommon', 'Rare', 'Epic', 'Legendary', 'Mythic'];

  const filteredItems = useMemo(() => {
    return items
      .filter((item) => {
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
        return 0;
      });
  }, [items, search, rarityFilter, categoryFilter, minVal, maxVal, sortBy]);

  const openMobileFilters = () => {
    setDraftRarity(rarityFilter);
    setDraftCategory(categoryFilter);
    setDraftMin(minVal);
    setDraftMax(maxVal);
    setDraftSortBy(sortBy);
    setIsMobileFiltersOpen(true);
  };

  const applyMobileFilters = () => {
    setRarityFilter(draftRarity);
    setCategoryFilter(draftCategory);
    setMinVal(draftMin);
    setMaxVal(draftMax);
    setSortBy(draftSortBy);
    setIsMobileFiltersOpen(false);
  };

  const clearMobileFilters = () => {
    setDraftRarity('All');
    setDraftCategory('All');
    setDraftMin('');
    setDraftMax('');
    setDraftSortBy('value-asc');
    setRarityFilter('All');
    setCategoryFilter('All');
    setMinVal('');
    setMaxVal('');
    setSortBy('value-asc');
    setIsMobileFiltersOpen(false);
  };

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
    <>
      <div className="space-y-3 sm:space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base sm:text-lg font-semibold text-slate-200">Target Item</h3>
          <span className="text-[11px] text-slate-400 uppercase tracking-wider">{filteredItems.length} Available</span>
        </div>

        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="Search items..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-900/60 border border-slate-800/70 rounded-lg py-2.5 pl-10 pr-4 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>

          <div className="md:hidden">
            <button
              type="button"
              onClick={openMobileFilters}
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-slate-700 bg-slate-900/60 py-2.5 text-sm font-medium text-slate-200"
            >
              <SlidersHorizontal className="w-4 h-4" />
              Filters
            </button>
          </div>

          <div className="hidden md:grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div className="flex gap-2">
              <select
                value={rarityFilter}
                onChange={(e) => setRarityFilter(e.target.value as Rarity | 'All')}
                className="flex-1 bg-slate-900/60 border border-slate-800 rounded-lg py-2 px-3 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
              >
                {rarities.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="flex-1 bg-slate-900/60 border border-slate-800 rounded-lg py-2 px-3 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
              >
                {categories.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div className="flex gap-2">
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

            <div className="relative">
              <ArrowUpDown className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'value-asc' | 'value-desc' | 'rarity')}
                className="w-full bg-slate-900/60 border border-slate-800 rounded-lg py-2 pl-10 pr-3 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
              >
                <option value="value-asc">Value Low</option>
                <option value="value-desc">Value High</option>
              </select>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:gap-4 max-h-[56vh] md:max-h-[500px] overflow-y-auto pr-1 sm:pr-2 custom-scrollbar">
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
                    ? 'bg-indigo-500/10 border-indigo-400 shadow-[0_0_14px_rgba(99,102,241,0.25)]'
                    : 'bg-slate-900/30 border-slate-800/60 hover:border-slate-700'}
                `}
              >
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setInfoItem(item);
                  }}
                  className="absolute left-1.5 top-1.5 z-10 inline-flex h-5 w-5 items-center justify-center rounded-full border border-white/20 bg-black/45 text-[10px] font-black text-white"
                  aria-label={`View info for ${item.name}`}
                >
                  i
                </button>

                <div className="aspect-[1.15/1] sm:aspect-square rounded-lg bg-slate-800/45 overflow-hidden mb-2">
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
                    <span className="inline-flex items-center gap-1 text-xs font-mono text-indigo-300"><Coins className="h-3.5 w-3.5" />{Math.round(item.coinValue).toLocaleString()}</span>
                  </div>
                  <p className="text-xs font-medium text-slate-300 truncate leading-tight">{item.name}</p>
                </div>

                {isSelected && (
                  <div className="absolute top-1.5 right-1.5 bg-indigo-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-md shadow-lg">
                    TARGET
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>

        {isMobileFiltersOpen && (
          <div className="md:hidden fixed inset-0 z-[80]">
            <button type="button" className="absolute inset-0 bg-black/65" onClick={() => setIsMobileFiltersOpen(false)} aria-label="Close filters" />
            <div className="absolute bottom-0 left-0 right-0 rounded-t-2xl border-t border-slate-700 bg-slate-950 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-white">Filters</h4>
                <button type="button" onClick={() => setIsMobileFiltersOpen(false)} className="text-slate-300">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <select
                  value={draftRarity}
                  onChange={(e) => setDraftRarity(e.target.value as Rarity | 'All')}
                  className="bg-slate-900/80 border border-slate-700 rounded-lg py-2 px-3 text-sm text-slate-200"
                >
                  {rarities.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
                <select
                  value={draftCategory}
                  onChange={(e) => setDraftCategory(e.target.value)}
                  className="bg-slate-900/80 border border-slate-700 rounded-lg py-2 px-3 text-sm text-slate-200"
                >
                  {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <input
                  type="number"
                  placeholder="Min"
                  value={draftMin}
                  onChange={(e) => setDraftMin(e.target.value)}
                  className="bg-slate-900/80 border border-slate-700 rounded-lg py-2 px-3 text-sm text-slate-200"
                />
                <input
                  type="number"
                  placeholder="Max"
                  value={draftMax}
                  onChange={(e) => setDraftMax(e.target.value)}
                  className="bg-slate-900/80 border border-slate-700 rounded-lg py-2 px-3 text-sm text-slate-200"
                />
                <div className="col-span-2 relative">
                  <ArrowUpDown className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <select
                    value={draftSortBy}
                    onChange={(e) => setDraftSortBy(e.target.value as 'value-asc' | 'value-desc' | 'rarity')}
                    className="w-full bg-slate-900/80 border border-slate-700 rounded-lg py-2 pl-10 pr-3 text-sm text-slate-200"
                  >
                    <option value="value-asc">Value Low</option>
                    <option value="value-desc">Value High</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <button type="button" onClick={clearMobileFilters} className="rounded-lg border border-slate-700 py-2 text-sm font-semibold text-slate-200">
                  Clear
                </button>
                <button type="button" onClick={applyMobileFilters} className="rounded-lg bg-indigo-600 py-2 text-sm font-semibold text-white">
                  Apply
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className={`fixed inset-0 z-[110] bg-black/80 backdrop-blur-sm transition-opacity duration-300 ${infoItem ? 'opacity-100' : 'pointer-events-none opacity-0'}`} onClick={() => setInfoItem(null)} />
      <div className={`fixed bottom-0 left-0 right-0 z-[120] transform transition-transform duration-300 ${infoItem ? 'translate-y-0' : 'translate-y-full'}`}>
        {infoItem && (
          <div role="dialog" aria-modal="true" aria-labelledby="target-item-details-title" className="mx-auto w-full max-w-lg overflow-hidden rounded-t-3xl border-x border-t border-white/10 bg-[#131722]/95 backdrop-blur-xl shadow-[0_-10px_50px_rgba(0,0,0,0.75)]">
            <div className="relative flex h-56 items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_top,rgba(99,102,241,0.42)_0%,transparent_72%)]">
              <button
                type="button"
                onClick={() => setInfoItem(null)}
                className="absolute right-4 top-4 z-20 flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-black/40 text-white"
                aria-label="Close item details"
              >
                <X className="h-4 w-4" />
              </button>
              <img src={infoItem.imageUrl} alt={infoItem.name} className="relative z-10 h-40 w-40 object-contain drop-shadow-2xl" referrerPolicy="no-referrer" />
            </div>
            <div className="space-y-4 px-5 py-6 sm:px-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
              <div className="text-center">
                <h3 id="target-item-details-title" className="text-xl font-bold text-white">{infoItem.name}</h3>
                <div className="mt-2 inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase" style={{ borderColor: 'rgba(99,102,241,0.55)', backgroundColor: 'rgba(99,102,241,0.15)', color: '#c7d2fe' }}>
                  {infoItem.rarity}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-white/10 bg-black/30 p-3 text-center">
                  <span className="block text-[10px] font-bold uppercase tracking-wide text-gray-400">Value</span>
                  <div className="mt-1 text-lg font-bold text-white"><span className="inline-flex items-center gap-1"><Coins className="h-4 w-4 text-amber-300" />{Math.round(infoItem.coinValue).toLocaleString()}</span></div>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/30 p-3 text-center">
                  <span className="block text-[10px] font-bold uppercase tracking-wide text-gray-400">Category</span>
                  <div className="mt-1 text-sm font-bold text-white">{infoItem.category || 'General'}</div>
                </div>
              </div>

              <button type="button" onClick={() => setInfoItem(null)} className="h-11 w-full rounded-xl bg-white text-sm font-bold text-black transition hover:bg-gray-200">
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </>
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
