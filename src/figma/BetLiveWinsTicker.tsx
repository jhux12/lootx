import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Crown, Package, Sparkles } from 'lucide-react';
import { useGame } from '../../context/GameContext';
import { CASE_ITEMS } from '../../constants';
import { PRICE_UNIT_MODE, toCoins } from '../../utils/coins';
import type { User } from '../../types';

// A compact, theme-aware "recent pulls" ticker for the Betting Mobile
// homepage. Shares the same data derivation as components/LiveTicker.tsx
// (most recently obtained items across public users) but renders each
// pull as a card-art tile with a rarity-colored border, matching the
// site's existing rarity language.
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
      .slice(0, 20);

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
          .slice(0, 20)
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

  const isLoading = drops.length === 0;

  return (
    <div ref={tickerRef} className="bet-home-ticker" aria-label="Recently pulled items">
      <div className="bet-home-ticker-label">
        <Sparkles aria-hidden="true" />
        <span>Recent Pulls</span>
      </div>
      <div className="bet-home-ticker-viewport">
        <div className="bet-home-ticker-fade bet-home-ticker-fade-right" aria-hidden="true" />
        <div
          className="bet-home-ticker-track ticker-animation live-wins-ticker"
          style={{ animationPlayState: isVisible ? 'running' : 'paused' }}
        >
          {isLoading
            ? Array.from({ length: 8 }).map((_, index) => (
                <div key={`ticker-skeleton-${index}`} className="bet-home-ticker-item is-loading" />
              ))
            : drops.map((drop, index) => (
                <div
                  key={`${drop.id}-${index}`}
                  className={`bet-home-ticker-item rarity-${drop.rarity}`}
                  title={`${drop.itemName} — ${drop.userName}`}
                >
                  <span className="bet-home-ticker-badge" aria-hidden="true">
                    {drop.rarity === 'legendary' ? <Crown /> : <Package />}
                  </span>
                  <img src={drop.itemImage} alt={drop.itemName} loading="lazy" decoding="async" />
                </div>
              ))}
        </div>
      </div>
    </div>
  );
};
