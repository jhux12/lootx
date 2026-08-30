import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useGame } from '../../context/GameContext';
import { CASE_ITEMS } from '../../constants';
import { CoinAmount } from '../../components/CoinAmount';
import { PRICE_UNIT_MODE, toCoins } from '../../utils/coins';
import type { User } from '../../types';

// A compact, theme-aware "most recent pulls" ticker for the Betting Mobile
// homepage. Shares the same data derivation as components/LiveTicker.tsx
// (most recently obtained items across public users) but with its own
// styling so it matches the light/dark bet-home surfaces.
export const BetLiveWinsTicker: React.FC = () => {
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

    const recentPulls = publicUsers.flatMap((user) => {
      const inventoryItems = user.inventory?.length ? user.inventory : user.topPulls ?? [];
      return inventoryItems.map((item) => ({ item, user }));
    })
      .sort((a, b) => (b.item.obtainedAt ?? 0) - (a.item.obtainedAt ?? 0))
      .slice(0, 16);

    const mapped = recentPulls.length
      ? recentPulls.map(({ item, user }) => ({
          id: item.instanceId ?? item.id,
          itemName: item.name,
          itemImage: item.image,
          value: toCoins(item.price, PRICE_UNIT_MODE),
          userName: user.name,
          rarity: item.rarity
        }))
      : (items.length ? items : CASE_ITEMS)
          .slice(0, 16)
          .map((item, index) => ({
            id: item.id,
            itemName: item.name,
            itemImage: item.image,
            value: toCoins(item.price, PRICE_UNIT_MODE),
            userName: availableUsers[index % availableUsers.length].name,
            rarity: item.rarity
          }));

    return mapped.length ? [...mapped, ...mapped] : [];
  }, [items, users]);

  return (
    <div ref={tickerRef} className="bet-home-ticker" aria-label="Most recent pulls">
      <div className="bet-home-ticker-fade bet-home-ticker-fade-left" aria-hidden="true" />
      <div className="bet-home-ticker-fade bet-home-ticker-fade-right" aria-hidden="true" />
      <div
        className="bet-home-ticker-track ticker-animation live-wins-ticker"
        style={{ animationPlayState: isVisible ? 'running' : 'paused' }}
      >
        {drops.length === 0
          ? Array.from({ length: 6 }).map((_, index) => (
              <div key={`ticker-skeleton-${index}`} className="bet-home-ticker-item is-loading" />
            ))
          : drops.map((drop, index) => (
              <div key={`${drop.id}-${index}`} className="bet-home-ticker-item">
                <img src={drop.itemImage} alt="" loading="lazy" decoding="async" />
                <div className="bet-home-ticker-meta">
                  <strong>{drop.itemName}</strong>
                  <span>{drop.userName}</span>
                </div>
                <CoinAmount
                  amount={drop.value}
                  animated={false}
                  className="bet-home-ticker-value"
                  iconClassName="h-3.5 w-3.5"
                  formatOptions={{ maximumFractionDigits: 0 }}
                />
              </div>
            ))}
      </div>
    </div>
  );
};
