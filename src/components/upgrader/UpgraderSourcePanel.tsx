import React from 'react';
import { InventoryItem } from './upgraderTypes';
import { Lock, Package } from 'lucide-react';
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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-200">Your Inventory</h3>
        <span className="text-xs text-slate-400 uppercase tracking-wider">{items.length} Items</span>
      </div>
      
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
        {items.map((item) => {
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
                  ? 'bg-emerald-500/10 border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.2)]' 
                  : 'bg-slate-900/40 border-slate-800 hover:border-slate-700'}
                ${isDisabled ? 'opacity-50 cursor-not-allowed grayscale' : ''}
              `}
            >
              <div className="aspect-square rounded-lg bg-slate-800/50 overflow-hidden mb-2 relative">
                <img 
                  src={item.imageUrl} 
                  alt={item.name}
                  className="w-full h-full object-cover"
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
                  <span className="text-xs font-mono text-emerald-400">${item.coinValue.toFixed(2)}</span>
                </div>
                <p className="text-xs font-medium text-slate-300 truncate leading-tight">{item.name}</p>
              </div>

              {isSelected && (
                <div className="absolute -top-2 -right-2 bg-emerald-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-lg">
                  SELECTED
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
