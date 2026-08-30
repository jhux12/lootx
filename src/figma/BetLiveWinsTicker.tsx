import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Crown, Package } from 'lucide-react';
import { useRecentPulls } from '../lib/pulls/useRecentPulls';
import { CASE_ITEMS } from '../../constants';

// A compact, theme-aware "recent pulls" ticker for the Betting Mobile
// homepage. Backed by useRecentPulls, a live Firestore subscription to the
// top-level `opens` collection that api/open-case.js writes on every real
// unboxing — so this reflects actual site-wide activity, not a per-session
// sample, and works for signed-out visitors too.
export const BetLiveWinsTicker: React.FC = () => {
  const { pulls, isLoading } = useRecentPulls();
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

  // Only fall back to sample case art before the first snapshot resolves,
  // or on a brand-new site with no opens logged yet. Once real pulls exist,
  // they're always what's shown.
  const drops = useMemo(() => {
    if (pulls.length) {
      return [...pulls, ...pulls];
    }
    if (isLoading) return [];

    const sample = CASE_ITEMS.slice(0, 20).map((item) => ({
      id: item.id,
      itemName: item.name,
      itemImage: item.image,
      rarity: item.rarity,
      value: item.price,
      boxName: 'Mystery Box',
      obtainedAt: 0,
    }));
    return [...sample, ...sample];
  }, [isLoading, pulls]);

  const showSkeleton = isLoading && !pulls.length;

  return (
    <div ref={tickerRef} className="bet-home-ticker" aria-label="Recently pulled items">
      <div className="bet-home-ticker-label">
        <span className="bet-home-ticker-live-dot" aria-hidden="true" />
        <span>Live Pullz</span>
      </div>
      <div className="bet-home-ticker-viewport">
        <div className="bet-home-ticker-fade bet-home-ticker-fade-right" aria-hidden="true" />
        <div
          className="bet-home-ticker-track ticker-animation live-wins-ticker"
          style={{ animationPlayState: isVisible ? 'running' : 'paused' }}
        >
          {showSkeleton
            ? Array.from({ length: 8 }).map((_, index) => (
                <div key={`ticker-skeleton-${index}`} className="bet-home-ticker-item is-loading" />
              ))
            : drops.map((drop, index) => (
                <div
                  key={`${drop.id}-${index}`}
                  className={`bet-home-ticker-item rarity-${drop.rarity}`}
                  title={`${drop.itemName} — ${drop.boxName}`}
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
