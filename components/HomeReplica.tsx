import React, { Suspense, lazy, memo, useCallback, useEffect, useMemo, useState } from 'react';
import { Package } from 'lucide-react';
import { MysteryBox } from '../types';
import { CoinAmount } from './CoinAmount';
import { useGame } from '../context/GameContext';
import { BlurImage } from '../src/ui/images/BlurImage';
import { LiveCommunitySection } from './LiveCommunitySection';

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

const TICKER_RARITY_CARD_CLASS: Record<HomeTickerWin['rarity'], string> = {
  common: 'border-[#646c7a] bg-gradient-to-b from-[#2b3340] to-[#1c2330]',
  uncommon: 'border-[#31b46e] bg-gradient-to-b from-[#224735] to-[#152c22]',
  rare: 'border-[#2d89ff] bg-gradient-to-b from-[#1f3f72] to-[#182845]',
  epic: 'border-[#9137ff] bg-gradient-to-b from-[#4a2579] to-[#2f184d]',
  legendary: 'border-[#f3bb3f] bg-gradient-to-b from-[#75531f] to-[#4a3412]'
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

  return Array.from({ length: Math.min(12, Math.max(8, weightedPool.length)) }, (_, index) => {
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

const runHomeWorkAfterIdleOrInteraction = (callback: () => void, timeout = 3200) => {
  if (typeof window === 'undefined') return () => undefined;
  let didRun = false;
  let idleId: number | null = null;
  let timeoutId: ReturnType<typeof window.setTimeout> | null = null;
  let run: () => void;
  const cleanup = () => {
    window.removeEventListener('pointerdown', run);
    window.removeEventListener('keydown', run);
    window.removeEventListener('touchstart', run);
    if (idleId !== null && 'cancelIdleCallback' in window) window.cancelIdleCallback(idleId);
    if (timeoutId !== null) window.clearTimeout(timeoutId);
  };
  run = () => {
    if (didRun) return;
    didRun = true;
    cleanup();
    callback();
  };
  window.addEventListener('pointerdown', run, { once: true, passive: true });
  window.addEventListener('keydown', run, { once: true });
  window.addEventListener('touchstart', run, { once: true, passive: true });
  if ('requestIdleCallback' in window) idleId = window.requestIdleCallback(run, { timeout }) as unknown as number;
  else timeoutId = window.setTimeout(run, timeout);
  return cleanup;
};

const LiveWinCard = memo(({ win, onOpenBox }: { win: HomeTickerWin; onOpenBox: (boxId: string) => void }) => {
  const handleOpen = useCallback(() => onOpenBox(win.boxId), [onOpenBox, win.boxId]);

  return (
    <button
      type="button"
      onClick={handleOpen}
      className={`group flex h-[84px] w-[108px] shrink-0 items-center justify-center overflow-hidden rounded-sm border p-1.5 transition hover:-translate-y-0.5 active:scale-[0.99] sm:h-[92px] sm:w-[116px] ${TICKER_RARITY_CARD_CLASS[win.rarity]}`}
      title={`${win.itemName} won from ${win.boxName}`}
    >
      <div className="flex h-full w-full items-center justify-center rounded-[2px] bg-black/20 p-1.5">
        <img src={win.itemImage} alt={win.itemName} className="h-full w-full object-contain drop-shadow-[0_3px_8px_rgba(0,0,0,0.55)] transition-transform duration-200 group-hover:scale-105" loading="lazy" decoding="async" width={72} height={72} />
      </div>
    </button>
  );
});
LiveWinCard.displayName = 'LiveWinCard';

const LiveWinsSkeleton = memo(() => (
  <div className="flex min-h-[92px] items-center gap-2 px-2 py-2 sm:min-h-[100px]" aria-hidden="true">
    {Array.from({ length: 8 }).map((_, index) => (
      <div key={index} className="h-[84px] w-[108px] shrink-0 rounded-sm border border-white/10 bg-white/[0.045] sm:h-[92px] sm:w-[116px]" />
    ))}
  </div>
));
LiveWinsSkeleton.displayName = 'LiveWinsSkeleton';

const HomeBelowFoldSkeleton = memo(() => (
  <>
    <div className="min-h-[520px] rounded-xl bg-[#22282c]/40 lg:col-start-1" aria-hidden="true" />
    <aside className="min-h-[760px] rounded-2xl bg-[#22282c]/40 lg:col-start-2 lg:row-start-1" aria-hidden="true" />
  </>
));
HomeBelowFoldSkeleton.displayName = 'HomeBelowFoldSkeleton';

export const HomeReplica: React.FC<HomeReplicaProps> = ({ boxes, onOpenBox, onViewAllBoxes, onSignUp }) => {
  const { setView, user } = useGame();
  const [showBelowFold, setShowBelowFold] = useState(false);
  const [startTickerAnimation, setStartTickerAnimation] = useState(false);
  const featuredBoxes = boxes.slice(0, 6);
  const liveWins = useMemo(() => buildLiveWins(boxes), [boxes]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      setShowBelowFold(true);
      return;
    }
    return runHomeWorkAfterIdleOrInteraction(() => setShowBelowFold(true), 3600);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    return runHomeWorkAfterIdleOrInteraction(() => setStartTickerAnimation(true), 1800);
  }, []);

  return (
    <div className="min-h-screen bg-[#1b2024] text-white">
      <main className="mx-auto grid max-w-[1250px] grid-cols-1 gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[1fr_240px]">
        <section className="min-w-0 space-y-8">
          <LiveCommunitySection />

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
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_78%_70%,rgba(34,211,238,0.30),transparent_56%),radial-gradient(circle_at_25%_15%,rgba(32,93,215,0.20),transparent_46%),radial-gradient(circle_at_50%_120%,rgba(255,255,255,0.14),transparent_42%)]" />
                <p className="relative z-10 max-w-[140px] text-sm font-black uppercase leading-5 text-slate-100">{tile.title}</p>
                <div className="pointer-events-none absolute -right-3 -bottom-7 z-10 h-[154px] w-[154px] shrink-0 sm:-right-2 sm:-bottom-6 sm:h-[148px] sm:w-[148px] md:h-[160px] md:w-[160px] lg:h-[172px] lg:w-[172px]">
                  <img
                    src={tile.image}
                    alt={`${tile.title} artwork`}
                    className="h-full w-full -rotate-12 object-contain opacity-100 transition-transform duration-300 ease-out group-hover:scale-105 group-hover:-rotate-[15deg]"
                    loading="lazy"
                    fetchPriority="low"
                    decoding="async"
                    width={500}
                    height={500}
                  />
                </div>
              </button>
            ))}
          </div>


          <section aria-label="Live recent wins" className="overflow-hidden rounded-md border border-[#1d2228] bg-[#090b10] shadow-[0_10px_28px_rgba(0,0,0,0.4)]">
            <div className="flex min-h-[96px] items-stretch">
              <div className="flex w-[72px] shrink-0 flex-col items-center justify-center gap-1 border-r border-[#f59e0b]/70 bg-[#0c1016] px-2 text-center">
                <span className="text-base leading-none">🔥</span>
                <h2 className="text-[11px] font-black uppercase leading-3 tracking-[0.08em] text-white">User Pullz</h2>
              </div>
              <div className="relative min-w-0 flex-1 overflow-hidden">
              {liveWins.length > 0 ? (
                <>
                  <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-6 bg-gradient-to-r from-[#090b10] to-transparent sm:w-10" />
                  <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-6 bg-gradient-to-l from-[#090b10] to-transparent sm:w-10" />
                  <div
                    className={`live-wins-ticker flex w-max items-center gap-2 px-2 py-1.5 sm:gap-2.5 ${startTickerAnimation ? 'ticker-animation [animation-duration:65s]' : ''}`}
                    style={{ transform: 'translate3d(0,0,0)' }}
                  >
                    {[...liveWins, ...liveWins].map((win, index) => (
                      <LiveWinCard key={`${win.id}-${index}`} win={win} onOpenBox={onOpenBox} />
                    ))}
                  </div>
                </>
              ) : (
                <LiveWinsSkeleton />
              )}
              </div>
            </div>
          </section>

          <section>
            <div className="mb-5 flex items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 text-xl font-black"><Package className="h-5 w-5 text-slate-400" aria-hidden="true" />Available Boxes</h2>
              <button onClick={onViewAllBoxes} className="px-1 py-2 text-xs font-bold text-white/90 hover:text-white">View All</button>
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 sm:gap-x-4 sm:gap-y-6 lg:grid-cols-5">
              {featuredBoxes.map((box) => (
                <button key={box.id} onClick={() => onOpenBox(box.id)} className="group rounded-xl border border-transparent bg-transparent p-2 text-center transition-colors duration-300 ease-out">
                  <div className="flex h-[145px] items-center justify-center p-2 sm:h-[170px]">
                    <BlurImage src={box.image} alt={box.name} className="mx-auto max-h-full w-auto object-contain transition-transform duration-200 ease-out group-hover:scale-105" loading="lazy" showPlaceholder={false} width={220} height={220} />
                  </div>
                  <div className="mt-2 flex justify-center">
                    <CoinAmount amount={Math.round(box.price)} className="text-sm font-semibold text-slate-200" iconClassName="h-4 w-4" />
                  </div>
                </button>
              ))}
            </div>
          </section>

          <section aria-label="Follow us on Instagram" className="mt-2">
            <a
              href="https://www.instagram.com/pullz.gg/"
              target="_blank"
              rel="noopener noreferrer"
              className="group relative block overflow-hidden rounded-2xl p-[2px]"
            >
              <div className="pointer-events-none absolute -inset-[120%] animate-[spin_4.6s_linear_infinite] bg-[conic-gradient(from_90deg,rgba(56,189,248,0)_0deg,rgba(56,189,248,0.95)_95deg,rgba(124,58,237,0.95)_210deg,rgba(56,189,248,0)_360deg)]" />
              <div className="relative rounded-[14px] border border-white/10 bg-[#1f2730] px-4 py-3.5 sm:px-5 sm:py-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="inline-flex h-5 w-5 items-center justify-center rounded-md bg-white/10 text-white" aria-hidden="true">
                        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="3" y="3" width="18" height="18" rx="5" ry="5" />
                          <circle cx="12" cy="12" r="4" />
                          <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
                        </svg>
                      </span>
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-200/90">Community</p>
                    </div>
                    <h3 className="mt-1 text-sm font-black uppercase text-white sm:text-base">Follow us on Instagram</h3>
                  </div>
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-sky-400 to-violet-500 text-white shadow-[0_4px_16px_rgba(56,189,248,0.35)] sm:h-9 sm:w-9">
                    ↗
                  </span>
                </div>
              </div>
            </a>
          </section>

        </section>

        {showBelowFold ? (
            <Suspense fallback={<HomeBelowFoldSkeleton />}>
              <HomeReplicaBelowFold boxes={boxes} showSignupCta={!user} onSignUp={onSignUp} />
            </Suspense>
          ) : (
            <HomeBelowFoldSkeleton />
          )}

      </main>
    </div>
  );
};
