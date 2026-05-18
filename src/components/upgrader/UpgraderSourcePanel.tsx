import React, { useMemo, useState } from 'react';
import { InventoryItem } from './upgraderTypes';
import { Lock, Package, Search, X } from 'lucide-react';
import { CoinAmount } from '../../../components/CoinAmount';
import { motion } from 'motion/react';

interface UpgraderSourcePanelProps {
  items: InventoryItem[];
  selectedId: string | null;
  onSelect: (item: InventoryItem) => void;
  loading?: boolean;
}

export const UpgraderSourcePanel: React.FC<UpgraderSourcePanelProps> = ({
  items,
  selectedId,
  onSelect,
  loading = false,
}) => {
  const [search, setSearch] = useState('');
  const [infoItem, setInfoItem] = useState<InventoryItem | null>(null);

  const filteredItems = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return items;
    return items.filter((item) => item.name.toLowerCase().includes(needle));
  }, [items, search]);

  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="aspect-square bg-slate-800/50 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3 sm:space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base sm:text-lg font-semibold text-slate-200">Your Inventory</h3>
          <span className="text-[11px] text-slate-400 uppercase tracking-wider">{filteredItems.length} Available</span>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search inventory..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-900/60 border border-slate-800/70 rounded-lg py-2.5 pl-10 pr-4 text-sm text-slate-200 focus:outline-none focus:border-emerald-500 transition-colors"
          />
        </div>

        <div className="grid grid-cols-2 gap-3 sm:gap-4 max-h-[56vh] md:max-h-[500px] overflow-y-auto pr-1 sm:pr-2 custom-scrollbar">
          {filteredItems.map((item) => {
            const isSelected = selectedId === item.id;
            const isDisabled = item.locked || item.shipping;

            return (
              <motion.div
                key={item.id}
                whileHover={!isDisabled ? { scale: 1.02 } : {}}
                whileTap={!isDisabled ? { scale: 0.98 } : {}}
                onClick={() => !isDisabled && onSelect(item)}
                className={`
                  relative group cursor-pointer rounded-xl border p-2 transition-all duration-200
                  ${isSelected
                    ? 'bg-emerald-500/10 border-emerald-400 shadow-[0_0_14px_rgba(16,185,129,0.25)]'
                    : 'bg-slate-900/30 border-slate-800/60 hover:border-slate-700'}
                  ${isDisabled ? 'opacity-50 cursor-not-allowed grayscale' : ''}
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

                <div className="aspect-[1.15/1] sm:aspect-square rounded-lg bg-slate-800/45 overflow-hidden mb-2 relative">
                  <img
                    src={item.imageUrl}
                    alt={item.name}
                    className="w-full h-full object-cover"
                    loading="lazy"
                    decoding="async"
                    width={160}
                    height={160}
                    referrerPolicy="no-referrer"
                  />
                  {item.locked && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                      <Lock className="w-6 h-6 text-white" />
                    </div>
                  )}
                  {item.shipping && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                      <Package className="w-6 h-6 text-white" />
                    </div>
                  )}
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-1">
                    <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${getRarityColor(item.rarity)}`}>
                      {item.rarity}
                    </span>
                    <CoinAmount amount={Math.round(item.coinValue)} className="text-xs font-mono text-emerald-300" iconClassName="h-3.5 w-3.5" />
                  </div>
                  <p className="text-xs font-medium text-slate-300 truncate leading-tight">{item.name}</p>
                </div>

                {isSelected && (
                  <div className="absolute top-1.5 right-1.5 bg-emerald-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-md shadow-lg">
                    SOURCE
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>

      <div className={`fixed inset-0 z-[110] bg-black/80 backdrop-blur-sm transition-opacity duration-300 ${infoItem ? 'opacity-100' : 'pointer-events-none opacity-0'}`} onClick={() => setInfoItem(null)} />
      <div className={`fixed bottom-0 left-0 right-0 z-[120] transform transition-transform duration-300 ${infoItem ? 'translate-y-0' : 'translate-y-full'}`}>
        {infoItem && (
          <div role="dialog" aria-modal="true" aria-labelledby="source-item-details-title" className="mx-auto w-full max-w-lg overflow-hidden rounded-t-3xl border-x border-t border-white/10 bg-[#131722]/95 backdrop-blur-xl shadow-[0_-10px_50px_rgba(0,0,0,0.75)]">
            <div className="relative flex h-56 items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.45)_0%,transparent_72%)]">
              <button
                type="button"
                onClick={() => setInfoItem(null)}
                className="absolute right-4 top-4 z-20 flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-black/40 text-white"
                aria-label="Close item details"
              >
                <X className="h-4 w-4" />
              </button>
              <img src={infoItem.imageUrl} alt={infoItem.name} className="relative z-10 h-40 w-40 object-contain drop-shadow-2xl" loading="lazy" decoding="async" width={160} height={160} referrerPolicy="no-referrer" />
            </div>
            <div className="space-y-4 px-5 py-6 sm:px-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
              <div className="text-center">
                <h3 id="source-item-details-title" className="text-xl font-bold text-white">{infoItem.name}</h3>
                <div className="mt-2 inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase border-emerald-500/40 bg-emerald-500/10 text-emerald-300">
                  {infoItem.rarity}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-white/10 bg-black/30 p-3 text-center">
                  <span className="block text-[10px] font-bold uppercase tracking-wide text-gray-400">Value</span>
                  <div className="mt-1 text-lg font-bold text-white"><CoinAmount amount={Math.round(infoItem.coinValue)} iconClassName="h-4 w-4" /></div>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/30 p-3 text-center">
                  <span className="block text-[10px] font-bold uppercase tracking-wide text-gray-400">Status</span>
                  <div className="mt-1 text-sm font-bold text-white">{infoItem.locked ? 'Locked' : infoItem.shipping ? 'Shipping' : 'Available'}</div>
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
    case 'Rare': return 'bg-blue-500 text-white';
    case 'Epic': return 'bg-pink-500 text-white';
    case 'Legendary': return 'bg-orange-500 text-white';
    case 'Mythic': return 'bg-red-500 text-white';
    default: return 'bg-slate-500 text-white';
  }
}
