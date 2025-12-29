import React, { useMemo } from 'react';
import { useGame } from '../context/GameContext';
import { LiveDrop, User } from '../types';
import { CASE_ITEMS } from '../constants';

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
    <div className="relative w-full h-20 bg-[#0f1219] overflow-hidden border-b border-gray-800 flex items-center">
      {/* Gradient fade overlays */}
      <div className="absolute left-0 top-0 bottom-0 w-20 bg-gradient-to-r from-brand-bg to-transparent z-10 pointer-events-none"></div>
      <div className="absolute right-0 top-0 bottom-0 w-20 bg-gradient-to-l from-brand-bg to-transparent z-10 pointer-events-none"></div>

      <div className="flex gap-4 px-4 ticker-animation whitespace-nowrap">
        {drops.map((drop, idx) => (
          <div 
            key={`${drop.id}-${idx}`} 
            className={`
              flex-shrink-0 w-40 h-14 bg-brand-card rounded flex items-center p-2 gap-3 
              border-b-2 transition-transform hover:scale-105 cursor-pointer
              ${getRarityColor(drop.rarity)}
            `}
          >
            <img src={drop.itemImage} alt={drop.itemName} className="w-10 h-10 object-contain rounded bg-gray-900" />
            <div className="flex flex-col overflow-hidden">
              <span className="text-xs font-bold text-gray-200 truncate">{drop.itemName}</span>
              <span className="text-[10px] text-gray-500 truncate">{drop.user.name}</span>
            </div>
            <div className="ml-auto text-xs font-medium text-green-400">
              ${drop.value.toLocaleString()}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
