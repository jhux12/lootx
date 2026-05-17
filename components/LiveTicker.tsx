import React, { useMemo } from 'react';
import { useGame } from '../context/GameContext';
import { LiveDrop, User } from '../types';
import { CASE_ITEMS } from '../constants';
import { CoinAmount } from './CoinAmount';
import { PRICE_UNIT_MODE, toCoins } from '../utils/coins';
import { SkeletonTile } from '../src/ui/skeleton/Skeleton';
import { BlurImage } from '../src/ui/images/BlurImage';

export const LiveTicker: React.FC = () => {
  const { items, users } = useGame();
  const drops = useMemo(() => {
    const publicUsers = users.filter((user) => user.hiddenFromPublicDisplay !== true);
    const availableUsers: User[] = publicUsers.length ? publicUsers : [{
      id: 'guest',
      name: 'Player',
      avatar: 'https://picsum.photos/seed/guest/100/100',
      level: 1,
      xp: 0
    }];

    const liveWins = publicUsers.flatMap((user) => {
      const inventoryItems = user.inventory?.length ? user.inventory : user.topPulls ?? [];
      return inventoryItems.map((item) => ({
        item,
        user
      }));
    })
      .filter(({ item }) => ['legendary', 'epic'].includes(item.rarity))
      .sort((a, b) => (b.item.obtainedAt ?? 0) - (a.item.obtainedAt ?? 0))
      .slice(0, 12);

    const mapped = liveWins.length
      ? liveWins.map(({ item, user }) => ({
          id: item.instanceId ?? item.id,
          itemName: item.name,
          itemImage: item.image,
          value: toCoins(item.price, PRICE_UNIT_MODE),
          user,
          rarity: item.rarity
        }))
      : (items.length ? items : CASE_ITEMS)
          .filter(item => ['legendary', 'epic'].includes(item.rarity))
          .map((item, index) => ({
            id: item.id,
            itemName: item.name,
            itemImage: item.image,
            value: toCoins(item.price, PRICE_UNIT_MODE),
            user: availableUsers[index % availableUsers.length],
            rarity: item.rarity
          }));

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
    <div className="relative w-full h-16 sm:h-20 bg-[#0b0f17] overflow-hidden border border-white/5 rounded-2xl flex items-center">
      {/* Gradient fade overlays */}
      <div className="absolute left-0 top-0 bottom-0 w-16 bg-gradient-to-r from-[#0b0f17] to-transparent z-10 pointer-events-none"></div>
      <div className="absolute right-0 top-0 bottom-0 w-16 bg-gradient-to-l from-[#0b0f17] to-transparent z-10 pointer-events-none"></div>

      <div className="flex gap-4 px-4 ticker-animation whitespace-nowrap">
        {drops.length === 0 ? (
          Array.from({ length: 6 }).map((_, idx) => (
            <div key={`recent-skeleton-${idx}`} className="w-40 h-12">
              <SkeletonTile compact className="h-full" />
            </div>
          ))
        ) : drops.map((drop, idx) => (
          <div 
            key={`${drop.id}-${idx}`} 
            className={`
              group flex-shrink-0 w-40 h-12 rounded-xl flex items-center p-2 gap-3 min-w-0
              border border-white/5 bg-[#101521] transition-all hover:scale-[1.02] hover:border-white/15 cursor-pointer
              ${getRarityColor(drop.rarity)}
            `}
          >
            <div className="h-9 w-9 rounded bg-gray-900/60"><BlurImage src={drop.itemImage} alt={drop.itemName} className="w-9 h-9 object-contain rounded" /></div>
            <div className="flex flex-col overflow-hidden min-w-0">
              <span className="text-[11px] font-semibold text-gray-300 truncate group-hover:text-white transition-colors">{drop.itemName}</span>
              <span className="text-[10px] text-gray-500 truncate group-hover:text-gray-300 transition-colors">{drop.user.name}</span>
            </div>
            <CoinAmount
              amount={drop.value}
              formatOptions={{ maximumFractionDigits: 0 }}
              className="ml-auto text-[11px] font-medium text-emerald-300/80 max-w-[72px] justify-end group-hover:text-emerald-200"
              iconClassName="w-3.5 h-3.5 flex-shrink-0"
              textClassName="truncate"
            />
          </div>
        ))}
      </div>
    </div>
  );
};
