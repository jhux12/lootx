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

    return mapped.length ? [...mapped, ...mapped, ...mapped] : [];
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
    <div ref={tickerRef} className="relative flex h-[88px] w-full items-center overflow-hidden rounded-xl border border-white/[0.07] bg-[#181c28] shadow-[0_8px_24px_rgba(0,0,0,0.18)] sm:h-[106px]">
      <div className="absolute inset-y-0 left-0 z-20 flex w-12 flex-col items-center justify-center gap-1 border-r border-white/[0.06] bg-[#181c28] sm:w-14">
        <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.8)]" aria-hidden="true" />
        <span className="text-[8px] font-black uppercase tracking-[0.14em] text-slate-400 sm:text-[9px]">Live</span>
      </div>
      {/* Gradient fade overlays */}
      <div className="pointer-events-none absolute bottom-0 left-12 top-0 z-10 w-12 bg-gradient-to-r from-[#181c28] to-transparent sm:left-14"></div>
      <div className="pointer-events-none absolute bottom-0 right-0 top-0 z-10 w-16 bg-gradient-to-l from-[#181c28] to-transparent"></div>

      <div className="ticker-animation flex gap-2 whitespace-nowrap pl-16 pr-4 sm:gap-2.5 sm:pl-[72px]" style={{ animationPlayState: isVisible ? 'running' : 'paused' }}>
        {drops.length === 0 ? (
          Array.from({ length: 6 }).map((_, idx) => (
            <div key={`recent-skeleton-${idx}`} className="h-[68px] w-[148px] sm:h-[86px] sm:w-[170px]">
              <SkeletonTile compact className="h-full" />
            </div>
          ))
        ) : drops.map((drop, idx) => (
          <div 
            key={`${drop.id}-${idx}`} 
            className={`
              group relative flex h-[68px] w-[148px] flex-shrink-0 cursor-pointer items-center gap-2 overflow-hidden rounded-[10px]
              border border-white/[0.06] bg-[#121620] p-2 transition-all hover:scale-[1.015] hover:border-white/15
              sm:h-[86px] sm:w-[170px] sm:gap-2.5 sm:p-2.5
              ${getRarityColor(drop.rarity)}
            `}
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_36%,rgba(255,255,255,0.06),transparent_45%)]" aria-hidden="true" />
            <div className="relative h-12 w-12 shrink-0 sm:h-16 sm:w-16"><BlurImage src={drop.itemImage} alt={drop.itemName} className="h-full w-full rounded object-contain drop-shadow-[0_10px_14px_rgba(0,0,0,0.45)]" /></div>
            <div className="flex flex-col overflow-hidden min-w-0">
              <span className="truncate text-[10px] font-bold text-gray-200 transition-colors group-hover:text-white sm:text-[11px]">{drop.itemName}</span>
              <span className="mt-0.5 truncate text-[8px] text-gray-500 transition-colors group-hover:text-gray-300 sm:text-[9px]">{drop.user.name}</span>
              <CoinAmount
                amount={drop.value}
                formatOptions={{ maximumFractionDigits: 0 }}
                className="mt-1 justify-start text-[9px] font-bold text-violet-200 sm:text-[10px]"
                iconClassName="h-3 w-3 flex-shrink-0"
                textClassName="truncate"
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
