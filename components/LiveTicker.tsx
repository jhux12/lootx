import React, { useMemo } from 'react';
import { useGame } from '../context/GameContext';
import { LiveDrop, User } from '../types';
import { CASE_ITEMS } from '../constants';
import { CoinAmount } from './CoinAmount';

export const LiveTicker: React.FC = () => {
  const { items, users } = useGame();
  const drops = useMemo(() => {
    const availableUsers: User[] = users.length ? users : [{
      id: 'guest',
      name: 'Player',
      avatar: 'https://picsum.photos/seed/guest/100/100',
      level: 1,
      xp: 0
    }];

    const filteredItems = (items.length ? items : CASE_ITEMS)
      .filter(item => ['legendary', 'epic'].includes(item.rarity));

    const mapped = filteredItems.map((item, index) => ({
      id: item.id,
      itemName: item.name,
      itemImage: item.image,
      value: item.price,
      user: availableUsers[index % availableUsers.length],
      rarity: item.rarity
    }));

    // Duplicate for smooth ticker scrolling
    return mapped.length ? [...mapped, ...mapped, ...mapped] : [];
  }, [items, users]);

  const getRarityColor = (rarity: LiveDrop['rarity']) => {
    switch (rarity) {
      case 'legendary': return 'border-yellow-500 shadow-yellow-500/20';
      case 'epic': return 'border-purple-500 shadow-purple-500/20';
      case 'rare': return 'border-blue-500 shadow-blue-500/20';
      case 'uncommon': return 'border-green-500 shadow-green-500/20';
      default: return 'border-gray-600';
    }
  };

  return (
    <div className="group rounded-2xl border border-white/5 bg-[#0d121b] px-4 py-3">
      <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.3em] text-gray-500 transition-colors group-hover:text-gray-300">
        Live Wins
      </div>
      <div className="relative h-14 overflow-hidden">
        <div className="absolute left-0 top-0 bottom-0 w-16 bg-gradient-to-r from-[#0d121b] to-transparent z-10 pointer-events-none" />
        <div className="absolute right-0 top-0 bottom-0 w-16 bg-gradient-to-l from-[#0d121b] to-transparent z-10 pointer-events-none" />
        <div className="flex gap-4 ticker-animation whitespace-nowrap">
          {drops.map((drop, idx) => (
            <div 
              key={`${drop.id}-${idx}`} 
              className={`
                flex-shrink-0 w-40 h-12 bg-brand-card/70 rounded flex items-center p-2 gap-3 min-w-0
                border-b-2 transition-transform hover:scale-105 cursor-pointer
                ${getRarityColor(drop.rarity)}
              `}
            >
              <img
                src={drop.itemImage}
                alt={drop.itemName}
                className="w-9 h-9 object-contain rounded bg-gray-900"
                loading="lazy"
              />
              <div className="flex flex-col overflow-hidden min-w-0">
                <span className="text-xs font-bold text-gray-200 truncate">{drop.itemName}</span>
                <span className="text-[10px] text-gray-500 truncate">{drop.user.name}</span>
              </div>
              <CoinAmount
                amount={drop.value}
                formatOptions={{ maximumFractionDigits: 0 }}
                className="ml-auto text-xs font-medium text-green-400 max-w-[72px] justify-end"
                iconClassName="w-3.5 h-3.5 flex-shrink-0"
                textClassName="truncate"
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
