import React, { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { MysteryBox } from '../types';
import { CoinAmount } from './CoinAmount';
import { useGame } from '../context/GameContext';
import { BlurImage } from '../src/ui/images/BlurImage';
import { LiveWinsFeed } from './LiveWinsFeed';

type HomeReplicaProps = {
  boxes: MysteryBox[];
  demoBoxId?: string | null;
  isChatCollapsed: boolean;
  onOpenBox: (boxId: string) => void;
  onViewAllBoxes: () => void;
  onSignUp: () => void;
};

const HomeReplicaBelowFold = lazy(() => import('./HomeReplicaBelowFold').then((module) => ({ default: module.HomeReplicaBelowFold })));


type HomeTickerWin = {
  id: string;
  boxId: string;
  itemName: string;
  itemImage: string;
  itemPrice: number;
  rarity: MysteryBox['items'][number]['rarity'];
  boxName: string;
  timeAgo: string;
};

const TICKER_RARITY_MULTIPLIER: Record<HomeTickerWin['rarity'], number> = {
  common: 1,
  uncommon: 0.62,
  rare: 0.28,
  epic: 0.18,
  legendary: 0.055
};

const TICKER_RARITY_DOT_CLASS: Record<HomeTickerWin['rarity'], string> = {
  common: 'bg-slate-300',
  uncommon: 'bg-emerald-300',
  rare: 'bg-blue-300',
  epic: 'bg-purple-300',
  legendary: 'bg-amber-300'
};

const TICKER_RARITY_CARD_CLASS: Record<HomeTickerWin['rarity'], string> = {
  common: 'border-slate-400/55 hover:border-slate-300/80 shadow-slate-950/20',
  uncommon: 'border-emerald-400/55 hover:border-emerald-300/80 shadow-emerald-950/20',
  rare: 'border-blue-400/60 hover:border-blue-300/85 shadow-blue-950/20',
  epic: 'border-purple-400/65 hover:border-purple-300/90 shadow-purple-950/25',
  legendary: 'border-amber-300/75 hover:border-amber-200 shadow-amber-950/30'
};

const pickWeightedItem = <T extends { weight: number }>(pool: T[]) => {
  const totalWeight = pool.reduce((sum, item) => sum + item.weight, 0);
  let cursor = Math.random() * totalWeight;

  for (const item of pool) {
    cursor -= item.weight;
    if (cursor <= 0) return item;
  }

  return pool[pool.length - 1];
};

const buildLiveWins = (boxes: MysteryBox[]): HomeTickerWin[] => {
  const weightedPool = boxes
    .filter((box) => !box.isUserCreated)
    .flatMap((box) =>
      box.items
        .filter((item) => item.image && item.name)
        .map((item) => ({
          boxId: box.id,
          boxName: box.name,
          item,
          weight: Math.max(item.chance || 1, 0.25) * TICKER_RARITY_MULTIPLIER[item.rarity]
        }))
    )
    .filter((entry) => entry.weight > 0);

  if (!weightedPool.length) return [];

  return Array.from({ length: Math.min(24, Math.max(12, weightedPool.length)) }, (_, index) => {
    const entry = pickWeightedItem(weightedPool);
    const minutesAgo = index < 2 ? 'now' : `${2 + Math.floor(Math.random() * 48)}m`;

    return {
      id: `${entry.boxId}-${entry.item.id}-${index}-${minutesAgo}`,
      boxId: entry.boxId,
      itemName: entry.item.name,
      itemImage: entry.item.image,
      itemPrice: entry.item.price,
      rarity: entry.item.rarity,
      boxName: entry.boxName,
      timeAgo: minutesAgo
    };
  });
};

const HOME_SECTION_IMAGES = [
  {
    title: 'Open mystery boxes',
    image: 'https://firebasestorage.googleapis.com/v0/b/hyperdrop-6476c.firebasestorage.app/o/open.png?alt=media&token=34515af9-0309-412b-95fe-fb22837fd060'
  },
  {
    title: 'Upgrade your items',
    image: 'https://firebasestorage.googleapis.com/v0/b/hyperdrop-6476c.firebasestorage.app/o/upgrade.png?alt=media&token=41935126-5d8f-4430-ae63-e6e47713e793'
  },
  {
    title: 'Climb Leaderboards',
    image: 'https://firebasestorage.googleapis.com/v0/b/hyperdrop-6476c.firebasestorage.app/o/leader.png?alt=media&token=d1904a5a-5b16-4b67-b23d-4b307dc72136'
  }
];

export const HomeReplica: React.FC<HomeReplicaProps> = ({ boxes, onOpenBox, onViewAllBoxes, onSignUp }) => {
  const { setView, user } = useGame();
  const [showBelowFold, setShowBelowFold] = useState(false);
  const featuredBoxes = boxes.slice(0, 5);
  const liveWins = useMemo(() => buildLiveWins(boxes), [boxes]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      setShowBelowFold(true);
      return;
    }
    const loadBelowFold = () => setShowBelowFold(true);
    const idleId = 'requestIdleCallback' in window
      ? window.requestIdleCallback(loadBelowFold, { timeout: 1800 })
      : window.setTimeout(loadBelowFold, 900);
    return () => {
      if ('cancelIdleCallback' in window && typeof idleId === 'number') window.cancelIdleCallback(idleId);
      else window.clearTimeout(idleId as number);
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#1b2024] text-white">
      <main className="mx-auto grid max-w-[1250px] grid-cols-1 gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[1fr_240px]">
        <section className="min-w-0 space-y-10">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {HOME_SECTION_IMAGES.map((tile, index) => (
              <button
                key={`${tile.title}-${index}`}
                type="button"
                onClick={() => {
                  if (index === 0) onViewAllBoxes();
                  if (index === 1) setView({ type: 'PLINKO' });
                  if (index === 2) setView({ type: 'LEADERBOARD' });
                }}
                className="group relative min-h-[132px] overflow-hidden rounded-xl border border-white/5 bg-[#21282c] p-4 text-left transition-all duration-300 ease-out hover:-translate-y-1 hover:border-slate-400/35 hover:shadow-[0_12px_28px_rgba(5,8,12,0.45)] focus-visible:-translate-y-1 focus-visible:border-slate-400/35"
              >
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_78%_70%,rgba(34,211,238,0.30),transparent_56%),radial-gradient(circle_at_25%_15%,rgba(168,85,247,0.20),transparent_46%),radial-gradient(circle_at_50%_120%,rgba(255,255,255,0.14),transparent_42%)]" />
                <p className="relative z-10 max-w-[140px] text-sm font-black uppercase leading-5 text-slate-100">{tile.title}</p>
                <img
                  src={tile.image}
                  alt={`${tile.title} artwork`}
                  className="pointer-events-none absolute -right-3 -bottom-7 z-10 h-[154px] w-[154px] shrink-0 -rotate-12 object-contain opacity-100 transition-transform duration-300 ease-out group-hover:scale-105 group-hover:-rotate-[15deg] sm:-right-2 sm:-bottom-6 sm:h-[148px] sm:w-[148px] md:h-[160px] md:w-[160px] lg:h-[172px] lg:w-[172px]"
                  loading={index === 0 ? 'eager' : 'lazy'}
                  fetchPriority={index === 0 ? 'high' : 'auto'}
                  decoding="async"
                  width={500}
                  height={500}
                />
              </button>
            ))}
          </div>


          {liveWins.length > 0 && (
            <section aria-label="Live recent wins" className="overflow-hidden rounded-2xl border border-white/5 bg-[#20262b] shadow-[0_14px_38px_rgba(5,8,12,0.22)]">
              <div className="flex flex-col gap-1 border-b border-white/[0.06] px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300 opacity-60" />
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-300" />
                  </span>
                  <h2 className="text-sm font-black uppercase tracking-[0.18em] text-slate-100">Live Wins</h2>
                </div>
              </div>

              <div className="relative overflow-hidden py-3">
                <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-10 bg-gradient-to-r from-[#20262b] to-transparent sm:w-16" />
                <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-10 bg-gradient-to-l from-[#20262b] to-transparent sm:w-16" />
                <div className="ticker-animation flex w-max items-center gap-2 px-4 [animation-duration:60s] sm:gap-3">
                  {[...liveWins, ...liveWins].map((win, index) => (
                    <button
                      key={`${win.id}-${index}`}
                      type="button"
                      onClick={() => onOpenBox(win.boxId)}
                      className={`group flex w-[214px] shrink-0 items-center gap-3 rounded-xl border-2 bg-[#1b2024]/80 p-2.5 text-left shadow-lg transition hover:-translate-y-0.5 hover:bg-[#252c32] active:scale-[0.99] sm:w-[252px] ${TICKER_RARITY_CARD_CLASS[win.rarity]}`}
                      title={`${win.itemName} won from ${win.boxName}`}
                    >
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-black/20 p-1.5 sm:h-14 sm:w-14">
                        <img src={win.itemImage} alt={win.itemName} className="h-full w-full object-contain drop-shadow-md" loading="lazy" decoding="async" width={56} height={56} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">
                          <span className={`h-1.5 w-1.5 rounded-full ${TICKER_RARITY_DOT_CLASS[win.rarity]}`} />
                          <span>{win.rarity}</span>
                          <span className="text-slate-600">•</span>
                          <span>{win.timeAgo}</span>
                        </div>
                        <p className="mt-1 truncate text-xs font-bold text-slate-100 sm:text-sm">{win.itemName}</p>
                        <div className="mt-1 flex items-center justify-between gap-2">
                          <p className="truncate text-[11px] text-slate-500">{win.boxName}</p>
                          <CoinAmount amount={Math.round(win.itemPrice)} className="shrink-0 text-[11px] font-black text-emerald-200" iconClassName="h-3.5 w-3.5" animated={false} />
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </section>
          )}

          <section>
            <div className="mb-5 flex items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 text-xl font-black"><span className="text-slate-400">▣</span>Available Boxes</h2>
              <button onClick={onViewAllBoxes} className="px-1 py-2 text-xs font-bold text-white/90 hover:text-white">View All</button>
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 sm:gap-x-4 sm:gap-y-6 lg:grid-cols-5">
              {featuredBoxes.map((box) => (
                <button key={box.id} onClick={() => onOpenBox(box.id)} className="group rounded-xl border border-transparent bg-transparent p-2 text-center transition-colors duration-300 ease-out">
                  <div className="flex h-[145px] items-center justify-center p-2 sm:h-[170px]">
                    <BlurImage src={box.image} alt={box.name} className="mx-auto max-h-full w-auto object-contain transition-transform duration-200 ease-out group-hover:scale-105" loading="lazy" width={220} height={220} />
                  </div>
                  <div className="mt-2 flex justify-center">
                    <CoinAmount amount={Math.round(box.price)} className="text-sm font-semibold text-slate-200" iconClassName="h-4 w-4" />
                  </div>
                </button>
              ))}
            </div>
          </section>

          <LiveWinsFeed boxes={boxes} />
        </section>

        {showBelowFold ? (
            <Suspense fallback={<div className="min-h-[760px] rounded-xl bg-[#22282c]/40" aria-hidden="true" />}>
              <HomeReplicaBelowFold boxes={boxes} showSignupCta={!user} onSignUp={onSignUp} />
            </Suspense>
          ) : (
            <div className="min-h-[760px] rounded-xl bg-[#22282c]/40" aria-hidden="true" />
          )}

      </main>
    </div>
  );
};
