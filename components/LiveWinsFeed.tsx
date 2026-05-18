import React, { useMemo } from 'react';
import type { CaseItem, MysteryBox } from '../types';

type LiveWin = {
  id: string;
  avatar: string;
  username: string;
  boxName: string;
  itemName: string;
  itemValue: number;
  rarity: CaseItem['rarity'];
};

type LiveWinsFeedProps = {
  boxes: MysteryBox[];
};

const feedUsers = [
  { username: 'Jaydan', avatar: 'J' },
  { username: 'Mika', avatar: 'M' },
  { username: 'Nova', avatar: 'N' },
  { username: 'Aria', avatar: 'A' },
  { username: 'Dex', avatar: 'D' },
  { username: 'Kai', avatar: 'K' },
  { username: 'Luna', avatar: 'L' },
  { username: 'Zane', avatar: 'Z' }
];

const fallbackWins: LiveWin[] = [
  { id: 'fallback-umbreon', avatar: 'J', username: 'Jaydan', boxName: 'Eeveelution Box', itemName: 'PSA 10 Umbreon', itemValue: 480, rarity: 'legendary' },
  { id: 'fallback-charizard', avatar: 'M', username: 'Mika', boxName: 'Pokemon Grails', itemName: 'Charizard VMAX', itemValue: 220, rarity: 'epic' },
  { id: 'fallback-switch', avatar: 'N', username: 'Nova', boxName: 'Tech Beast', itemName: 'Nintendo Switch OLED', itemValue: 349, rarity: 'rare' },
  { id: 'fallback-jordan', avatar: 'A', username: 'Aria', boxName: 'Sneakerhead', itemName: 'Jordan 1 High', itemValue: 180, rarity: 'rare' },
  { id: 'fallback-headset', avatar: 'D', username: 'Dex', boxName: 'Gamer Box', itemName: 'Wireless Headset', itemValue: 95, rarity: 'uncommon' }
];

const rarityGlowClass: Record<CaseItem['rarity'], string> = {
  legendary: 'shadow-[0_0_22px_rgba(251,191,36,0.22)] before:bg-amber-300/25',
  epic: 'shadow-[0_0_20px_rgba(217,70,239,0.20)] before:bg-fuchsia-400/22',
  rare: 'shadow-[0_0_18px_rgba(56,189,248,0.18)] before:bg-cyan-300/20',
  uncommon: 'shadow-[0_0_16px_rgba(52,211,153,0.15)] before:bg-emerald-300/18',
  common: 'shadow-[0_0_14px_rgba(148,163,184,0.12)] before:bg-slate-300/14'
};

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0
});

const getItemValue = (item: CaseItem) => item.valueUsd ?? item.marketPricing?.approvedValueUsd ?? item.price;

export const LiveWinsFeed: React.FC<LiveWinsFeedProps> = ({ boxes }) => {
  const wins = useMemo(() => {
    const boxWins = boxes
      .flatMap((box) =>
        box.items.map((item) => ({
          box,
          item,
          value: getItemValue(item)
        }))
      )
      .filter(({ value }) => value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 8)
      .map(({ box, item, value }, index): LiveWin => {
        const user = feedUsers[index % feedUsers.length];
        return {
          id: `${box.id}-${item.id}-${index}`,
          avatar: user.avatar,
          username: user.username,
          boxName: box.name,
          itemName: item.name,
          itemValue: value,
          rarity: item.rarity
        };
      });

    const feed = boxWins.length >= 4 ? boxWins : fallbackWins;
    return [...feed, ...feed];
  }, [boxes]);

  return (
    <section className="overflow-hidden rounded-2xl bg-[#22282c] p-4 sm:p-5" aria-label="Live wins feed">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-500">Live wins</p>
          <h2 className="mt-1 text-lg font-black text-white sm:text-xl">Recent Pullz</h2>
        </div>
        <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
          <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.75)]" />
          Live
        </div>
      </div>

      <div className="relative h-[260px] overflow-hidden sm:h-[292px]">
        <div className="pointer-events-none absolute inset-x-0 top-0 z-20 h-12 bg-gradient-to-b from-[#22282c] to-transparent backdrop-blur-[2px]" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-14 bg-gradient-to-t from-[#22282c] to-transparent backdrop-blur-[2px]" />
        <div className="live-wins-scroll space-y-3 pr-1">
          {wins.map((win, index) => (
            <article
              key={`${win.id}-${index}`}
              className={`relative flex min-w-0 items-center gap-3 overflow-hidden rounded-2xl bg-[#1d2328] px-3 py-3 before:pointer-events-none before:absolute before:inset-y-3 before:left-0 before:w-1 before:rounded-r-full sm:px-4 ${rarityGlowClass[win.rarity]}`}
            >
              <div className="grid h-10 w-10 flex-none place-items-center rounded-full bg-[#2b3339] text-sm font-black text-slate-100 shadow-inner shadow-white/5 sm:h-11 sm:w-11">
                {win.avatar}
              </div>
              <p className="min-w-0 flex-1 text-sm leading-5 text-slate-300 sm:text-[15px]">
                <span className="font-black text-white">{win.username}</span>
                <span> opened </span>
                <span className="font-semibold text-slate-100">{win.boxName}</span>
                <span> and won </span>
                <span className="font-semibold text-white">{win.itemName}</span>
              </p>
              <span className="flex-none rounded-full bg-[#2a3137] px-3 py-1 text-xs font-black text-slate-100 sm:text-sm">
                {currencyFormatter.format(win.itemValue)}
              </span>
            </article>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes liveWinsVerticalScroll {
          from { transform: translate3d(0, 0, 0); }
          to { transform: translate3d(0, -50%, 0); }
        }

        .live-wins-scroll {
          animation: liveWinsVerticalScroll 24s linear infinite;
          will-change: transform;
        }

        @media (prefers-reduced-motion: reduce) {
          .live-wins-scroll {
            animation: none;
          }
        }
      `}</style>
    </section>
  );
};
