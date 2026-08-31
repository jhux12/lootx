import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useGame } from '../context/GameContext';
import { LiveDrop } from '../types';
import { PRICE_UNIT_MODE, toCoins } from '../utils/coins';
import { SkeletonTile } from '../src/ui/skeleton/Skeleton';
import { BlurImage } from '../src/ui/images/BlurImage';

export const LiveTicker: React.FC = () => {
  const { users } = useGame();
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

    const mapped = liveWins.map(({ item, user }) => ({
          id: item.instanceId ?? item.id,
          itemName: item.name,
          itemImage: item.image,
          value: toCoins(item.price, PRICE_UNIT_MODE),
          user,
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
  }, [users]);

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
    <div ref={tickerRef} className="live-pulls-ticker relative w-full h-20 overflow-hidden rounded-2xl flex items-center" aria-label="Live pulls from Pullz users" aria-live="off">
      {/* Gradient fade overlays */}
      <div className="live-pulls-fade live-pulls-fade-left" />
      <div className="live-pulls-fade live-pulls-fade-right" />

      <div className="live-pulls-label"><i /><strong>LIVE<br />PULLZ</strong></div>
      <div className="live-pulls-track flex gap-2 px-3 ticker-animation whitespace-nowrap" style={{ animationPlayState: isVisible ? 'running' : 'paused' }}>
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
              group flex-shrink-0 w-16 h-16 rounded-lg flex items-center justify-center p-1 min-w-0
              live-pulls-card transition-all hover:scale-[1.02]
              ${getRarityColor(drop.rarity)}
            `}
          >
            <BlurImage src={drop.itemImage} alt={`${drop.itemName}, pulled by ${drop.user.name}`} className="h-full w-full object-contain rounded" />
          </div>
        ))}
      </div>
    </div>
  );
};
