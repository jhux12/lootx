import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useGame } from '../context/GameContext';
import { LiveDrop, User } from '../types';
import { CASE_ITEMS } from '../constants';
import { CoinAmount } from './CoinAmount';
import { PRICE_UNIT_MODE, toCoins } from '../utils/coins';
import { SkeletonTile } from '../src/ui/skeleton/Skeleton';
import { BlurImage } from '../src/ui/images/BlurImage';

export const LiveTicker: React.FC = () => {
  const { items, users } = useGame();
  const tickerRef = useRef<HTMLDivElement | null>(null);
  const [isVisible, setIsVisible] = useState(true);
  const lastDropsRef = useRef<LiveDrop[]>([]);

  useEffect(() => {
    const node = tickerRef.current;
    if (!node || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(([entry]) => {
      setIsVisible(entry.isIntersecting);
    }, { rootMargin: '80px' });

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

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
      .filter(({ item }) => ['legendary', 'epic', 'rare'].includes(item.rarity))
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
          .filter(item => ['legendary', 'epic', 'rare'].includes(item.rarity))
          .sort((a, b) => {
            const rarityRank = { epic: 0, rare: 1, legendary: 2, uncommon: 3, common: 4 } as const;
            return (rarityRank[a.rarity] ?? 5) - (rarityRank[b.rarity] ?? 5);
          })
          .map((item, index) => ({
            id: item.id,
            itemName: item.name,
            itemImage: item.image,
            value: toCoins(item.price, PRICE_UNIT_MODE),
            user: availableUsers[index % availableUsers.length],
            rarity: item.rarity
          }));

    if (mapped.length) {
      const repeated = [...mapped, ...mapped, ...mapped];
      lastDropsRef.current = repeated;
      return repeated;
    }
    // Mobile auth/network reconnects can briefly emit an empty snapshot.
    // Keep the last successful rail instead of flashing back to an empty state.
    return lastDropsRef.current;
  }, [items, users]);

  const getRarityColor = (rarity: LiveDrop['rarity']) => {
    switch (rarity) {
      case 'legendary': return 'border-amber-400 shadow-amber-500/20';
      case 'epic': return 'border-purple-500 shadow-purple-500/20';
      case 'rare': return 'border-blue-500 shadow-blue-500/20';
      case 'uncommon': return 'border-green-500 shadow-green-500/20';
      default: return 'border-gray-500 shadow-gray-500/10';
    }
  };

  return (
    <div ref={tickerRef} className="live-pulls-ticker relative w-full h-16 sm:h-20 overflow-hidden rounded-2xl flex items-center" aria-live="off">
      {/* Gradient fade overlays */}
      <div className="live-pulls-fade live-pulls-fade-left" />
      <div className="live-pulls-fade live-pulls-fade-right" />

      <div className="flex gap-4 px-4 ticker-animation whitespace-nowrap" style={{ animationPlayState: isVisible ? 'running' : 'paused' }}>
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
              live-pulls-card transition-all hover:scale-[1.02] cursor-pointer
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
