import React, { Suspense, lazy, memo, useCallback, useEffect, useMemo, useState } from 'react';
import { Box, ChevronLeft, ChevronRight, Flame, Home, Package, Search, SlidersHorizontal, Sparkles, Trophy, X } from 'lucide-react';
import { collection, doc, getDoc, limit, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '../firebase';
import { MysteryBox } from '../types';
import { CoinAmount } from './CoinAmount';
import { useGame } from '../context/GameContext';
import { BlurImage } from '../src/ui/images/BlurImage';
import { LiveCommunitySection } from './LiveCommunitySection';
import { HomeBanners } from './HomeBanners';
import { hasUserMadeDeposit } from '../utils/depositEligibility';
import { usePerformanceMode } from '../src/lib/performance';

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
  featured: boolean;
};

const TICKER_RARITY_MULTIPLIER: Record<HomeTickerWin['rarity'], number> = {
  common: 1,
  uncommon: 0.62,
  rare: 0.46,
  epic: 0.34,
  legendary: 0.055
};

const TICKER_RARITY_DOT_CLASS: Record<HomeTickerWin['rarity'], string> = {
  common: 'bg-gray-300',
  uncommon: 'bg-green-300',
  rare: 'bg-blue-300',
  epic: 'bg-purple-300',
  legendary: 'bg-amber-300'
};

const TICKER_RARITY_CARD_CLASS: Record<HomeTickerWin['rarity'], string> = {
  common: 'border-slate-400/55 shadow-slate-950/30',
  uncommon: 'border-emerald-400/75 shadow-emerald-950/30',
  rare: 'border-blue-400/75 shadow-blue-950/30',
  epic: 'border-purple-400/80 shadow-purple-950/35',
  legendary: 'border-emerald-300/85 shadow-emerald-950/35'
};

const TICKER_RARITY_PILL_CLASS: Record<HomeTickerWin['rarity'], string> = {
  common: 'bg-slate-300 text-slate-950',
  uncommon: 'bg-emerald-300 text-emerald-950',
  rare: 'bg-blue-300 text-blue-950',
  epic: 'bg-purple-400 text-white',
  legendary: 'bg-emerald-300 text-emerald-950'
};

const TICKER_RARITY_GLOW_CLASS: Record<HomeTickerWin['rarity'], string> = {
  common: 'from-slate-400/24 via-transparent to-slate-950/70',
  uncommon: 'from-emerald-400/28 via-transparent to-emerald-950/70',
  rare: 'from-blue-400/30 via-transparent to-blue-950/70',
  epic: 'from-purple-400/30 via-transparent to-purple-950/70',
  legendary: 'from-emerald-300/35 via-transparent to-emerald-950/75'
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
    .filter((box) => !box.isUserCreated && !box.isPullPassBox)
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

  const rareEpicPool = weightedPool.filter((entry) => entry.item.rarity === 'rare' || entry.item.rarity === 'epic');
  const winCount = Math.min(14, Math.max(10, weightedPool.length));
  const buildWin = (entry: (typeof weightedPool)[number], index: number): HomeTickerWin => {
    const minutesAgo = index < 2 ? 'now' : `${2 + Math.floor(Math.random() * 48)}m`;

    return {
      id: `${entry.boxId}-${entry.item.id}-${index}-${minutesAgo}`,
      boxId: entry.boxId,
      itemName: entry.item.name,
      itemImage: entry.item.image,
      itemPrice: entry.item.price,
      rarity: entry.item.rarity,
      boxName: entry.boxName,
      timeAgo: minutesAgo,
      featured: entry.item.price >= 10000 || ['legendary', 'epic'].includes(entry.item.rarity) || index === 0
    };
  };

  return Array.from({ length: winCount }, (_, index) => {
    const shouldSprinkleRareEpic = rareEpicPool.length > 0 && [2, 5, 8, 11].includes(index);
    const entry = shouldSprinkleRareEpic ? pickWeightedItem(rareEpicPool) : pickWeightedItem(weightedPool);
    return buildWin(entry, index);
  });
};

const runHomeWorkAfterIdleOrInteraction = (callback: () => void, timeout = 3200) => {
  if (typeof window === 'undefined') return () => undefined;
  let didRun = false;
  let idleId: number | null = null;
  let timeoutId: ReturnType<typeof globalThis.setTimeout> | null = null;
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
  else timeoutId = globalThis.setTimeout(run, timeout);
  return cleanup;
};

const LiveWinCard = memo(({ win, onOpenBox }: { win: HomeTickerWin; onOpenBox: (boxId: string) => void }) => {
  const handleOpen = useCallback(() => onOpenBox(win.boxId), [onOpenBox, win.boxId]);

  return (
    <button
      type="button"
      onClick={handleOpen}
      className={`group relative flex h-[372px] w-[248px] shrink-0 flex-col overflow-hidden rounded-[1.55rem] border-2 bg-[#181a1b] text-left shadow-[0_18px_36px_rgba(0,0,0,0.36)] transition duration-200 hover:-translate-y-1 hover:brightness-110 active:scale-[0.98] sm:h-[404px] sm:w-[292px] lg:h-[430px] lg:w-[320px] ${TICKER_RARITY_CARD_CLASS[win.rarity]}`}
      title={`${win.itemName} won from ${win.boxName}`}
    >
      <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${TICKER_RARITY_GLOW_CLASS[win.rarity]}`} />
      <div className="relative flex h-[198px] shrink-0 items-center justify-center overflow-hidden bg-[#111313] p-4 sm:h-[228px] sm:p-5 lg:h-[252px]">
        {win.featured && <span className="absolute left-3 top-3 z-20 rounded-full bg-amber-300 px-2.5 py-1 text-[9px] font-black uppercase tracking-wide text-black shadow-lg">🔥 Big Win</span>}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-16 bg-gradient-to-t from-[#181a1b] to-transparent" />
        <img src={win.itemImage} alt={win.itemName} className="relative z-0 h-[88%] w-[88%] object-contain drop-shadow-[0_18px_26px_rgba(0,0,0,0.42)] transition-transform duration-300 group-hover:scale-105 sm:h-[86%] sm:w-[86%]" loading="lazy" decoding="async" width={260} height={260} />
      </div>
      <div className="relative z-10 flex min-h-0 flex-1 flex-col gap-3 bg-[#1c1d1e]/96 p-4 pb-5 sm:p-5 sm:pb-6">
        <div>
          <div className="flex items-start justify-between gap-3">
            <p className="min-w-0 flex-1 truncate text-2xl font-black uppercase leading-none tracking-tight text-white sm:text-3xl">{win.itemName}</p>
            <span className={`shrink-0 rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] ${TICKER_RARITY_PILL_CLASS[win.rarity]}`}>{win.rarity}</span>
          </div>
          <div className="mt-4 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
                <span className={`h-1.5 w-1.5 rounded-full ${TICKER_RARITY_DOT_CLASS[win.rarity]}`} />
                <span>{win.rarity}</span>
                <span className="text-slate-600">•</span>
                <span>{win.timeAgo}</span>
              </div>
              <p className="mt-1 truncate text-xs font-semibold text-slate-400">From {win.boxName}</p>
            </div>
            <div className="shrink-0 text-right">
              <CoinAmount amount={Math.round(win.itemPrice)} className="justify-end text-xl font-black text-lime-300 sm:text-2xl" iconClassName="h-4 w-4 sm:h-5 sm:w-5" animated={false} />
            </div>
          </div>
        </div>
        <p className="mt-auto min-h-5 truncate text-sm font-semibold leading-5 text-slate-400">Pulled from <span className="text-lime-300">{win.boxName}</span></p>
      </div>
    </button>
  );
});
LiveWinCard.displayName = 'LiveWinCard';

const LiveWinsSkeleton = memo(() => (
  <div className="flex min-h-[400px] items-center gap-4 px-4 py-4 sm:min-h-[434px] sm:gap-5" aria-hidden="true">
    {Array.from({ length: 4 }).map((_, index) => (
      <div key={index} className="h-[372px] w-[248px] shrink-0 rounded-[1.55rem] border-2 border-white/10 bg-white/[0.045] sm:h-[404px] sm:w-[292px] lg:h-[430px] lg:w-[320px]" />
    ))}
  </div>
));
LiveWinsSkeleton.displayName = 'LiveWinsSkeleton';

const HomeBelowFoldSkeleton = memo(() => (
  <div className="grid grid-cols-1 gap-7 lg:grid-cols-[1fr_260px]" aria-hidden="true">
    <div className="min-h-[520px] rounded-xl bg-[#22282c]/40" />
    <aside className="min-h-[760px] rounded-2xl bg-[#22282c]/40" />
  </div>
));
HomeBelowFoldSkeleton.displayName = 'HomeBelowFoldSkeleton';


type MobileLiveWin = {
  id: string;
  title: string;
  image: string;
  rarity: MysteryBox['items'][number]['rarity'];
  timeAgo: string;
  boxId: string;
};

const MOBILE_LIVE_WIN_ACCENT: Record<MobileLiveWin['rarity'], string> = {
  common: 'from-slate-400 to-slate-600',
  uncommon: 'from-emerald-300 to-emerald-700',
  rare: 'from-cyan-400 to-blue-700',
  epic: 'from-purple-400 to-fuchsia-800',
  legendary: 'from-amber-300 to-yellow-700'
};

const MobileLiveWinCard = ({ win, onOpenBox }: { win: MobileLiveWin; onOpenBox: (boxId: string) => void }) => (
  <button type="button" onClick={() => onOpenBox(win.boxId)} className={`relative h-[128px] min-w-[100px] overflow-hidden rounded-md bg-gradient-to-br ${MOBILE_LIVE_WIN_ACCENT[win.rarity]} p-2 text-left shadow-[0_14px_28px_rgba(0,0,0,0.26)] active:scale-[0.98]`} aria-label={`Open box for ${win.rarity} live win`}>
    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_12%,rgba(255,255,255,0.25),transparent_36%),linear-gradient(180deg,transparent_52%,rgba(0,0,0,0.24))]" />
    {win.image ? <img src={win.image} alt="" className="absolute inset-x-0 bottom-2 top-3 z-10 mx-auto h-[96px] w-[96px] object-contain drop-shadow-[0_13px_16px_rgba(0,0,0,0.42)]" loading="lazy" /> : null}
    <div className="absolute bottom-2 left-2 z-30 rounded bg-black/20 px-1.5 py-0.5 text-[6px] font-black uppercase text-white/85">{win.rarity}</div>
    <div className="absolute bottom-2 right-2 z-30 rounded bg-white/18 px-1.5 py-0.5 text-[6px] font-black uppercase text-white/85">{win.timeAgo}</div>
  </button>
);

const MobileHomePreview = ({ boxes, onOpenBox, onViewAllBoxes }: { boxes: MysteryBox[]; onOpenBox: (boxId: string) => void; onViewAllBoxes: () => void }) => {
  const { isAuthenticated, openAuthModal, setShowTopUpModal, setTopUpModalIntent, user } = useGame();
  const [activeHeroSlide, setActiveHeroSlide] = useState(0);
  const [activeLiveWinIndex, setActiveLiveWinIndex] = useState(0);
  const cards = boxes.slice(0, 6);
  const originals = cards.length ? cards.slice(0, 3) : [];
  const mysteryBoxCards = boxes.slice(0, 6);
  const mobileLiveWins = useMemo<MobileLiveWin[]>(() => {
    const itemPool = boxes
      .flatMap((box) => box.items.map((item) => ({ item, boxId: box.id })))
      .filter(({ item }) => item.image && item.name);

    if (!itemPool.length) return [];

    return [...itemPool]
      .sort(() => Math.random() - 0.5)
      .slice(0, 8)
      .map(({ item, boxId }, index) => ({
        id: `${boxId}-${item.id}-${index}`,
        title: item.name,
        image: item.image,
        rarity: item.rarity,
        timeAgo: index === 0 ? 'now' : `${index + 1}m`,
        boxId
      }));
  }, [boxes]);
  useEffect(() => {
    if (mobileLiveWins.length <= 1) return undefined;
    const rotateTimer = window.setInterval(() => {
      setActiveLiveWinIndex((current) => (current + 1) % mobileLiveWins.length);
    }, 2400);
    return () => window.clearInterval(rotateTimer);
  }, [mobileLiveWins.length]);

  const heroSlides = ['deposit-match', 'hot-picks'] as const;
  const showDepositSlide = activeHeroSlide === 0;

  const handleHeroAction = () => {
    if (showDepositSlide) {
      if (!isAuthenticated) {
        openAuthModal('login');
        return;
      }

      setTopUpModalIntent({
        reason: 'insufficient_balance',
        requiredCoins: 10000,
        currentBalance: Number(user.balance ?? 0),
        missingCoins: Math.max(0, 10000 - Number(user.balance ?? 0)),
        preferredPackageUsd: 50
      });
      setShowTopUpModal(true);
      return;
    }

    const firstBox = cards[0];
    if (firstBox) onOpenBox(firstBox.id);
  };

  return (
    <div className="lg:hidden">
      <section className="px-3 pt-3">
        <button type="button" onClick={handleHeroAction} className={`relative h-[122px] w-full overflow-hidden rounded-[1.28rem] p-4 text-left shadow-[0_18px_34px_rgba(0,0,0,0.24)] active:scale-[0.99] ${showDepositSlide ? 'bg-[#5df7b1]' : 'bg-[#55f4a7]'}`}>
          <div className={showDepositSlide ? 'absolute inset-0 bg-[radial-gradient(circle_at_82%_18%,rgba(124,58,237,0.32),transparent_32%),radial-gradient(circle_at_46%_118%,rgba(20,184,166,0.36),transparent_38%),linear-gradient(135deg,rgba(255,255,255,0.20),transparent_38%)]' : 'absolute inset-0 bg-[radial-gradient(circle_at_82%_24%,rgba(124,58,237,0.34),transparent_30%),radial-gradient(circle_at_48%_118%,rgba(20,184,166,0.35),transparent_36%)]'} />
          <div className="relative z-10 inline-flex items-center gap-1.5 rounded-full bg-[#172233] px-2.5 py-1 text-[8px] font-black uppercase tracking-wide text-[#64ffc4]"><Sparkles className="h-3 w-3" />{showDepositSlide ? 'Welcome bonus' : 'Announcement'}</div>
          <h1 className="relative z-10 mt-3 max-w-[170px] text-[20px] font-black uppercase leading-none tracking-tight text-[#172233]">{showDepositSlide ? '100% Match' : 'Hot Picks'}</h1>
          <p className="relative z-10 mt-1 max-w-[150px] text-[8px] font-black uppercase leading-tight text-[#172233]">{showDepositSlide ? 'First deposit match up to $50.' : "Open today's most popular mystery boxes."}</p>
          <div className="absolute -right-7 top-1 flex rotate-[12deg] gap-2">
            {showDepositSlide ? (
              <>
                <div className="grid h-[112px] w-[74px] place-items-center rounded-xl bg-[#172233] p-2 text-center shadow-xl"><span className="text-[26px] font-black leading-none text-[#5df7b1]">2X</span><span className="text-[8px] font-black uppercase text-white">Coins</span></div>
                <div className="grid h-[112px] w-[74px] place-items-center rounded-xl bg-gradient-to-b from-violet-400 to-blue-700 p-2 text-center shadow-xl"><span className="text-[22px] font-black leading-none text-white">+$50</span><span className="text-[8px] font-black uppercase text-white/90">Match</span></div>
              </>
            ) : (
              (cards.length ? cards.slice(0, 4) : [{ id: 'a', name: 'Starter Box', image: '' }, { id: 'b', name: 'Premium Box', image: '' }] as any).map((box: MysteryBox, index: number) => (
                <div key={box.id ?? index} className="grid h-[112px] w-[74px] place-items-center overflow-hidden rounded-xl bg-gradient-to-b from-emerald-300 to-emerald-600 p-1 shadow-xl">
                  {box.image ? <img src={box.image} alt="" className="h-full w-full object-contain" /> : <span className="text-center text-sm font-black uppercase text-white">{box.name}</span>}
                </div>
              ))
            )}
          </div>
        </button>
        <div className="mt-2 flex justify-center gap-1.5">
          {heroSlides.map((slide, index) => <button key={slide} type="button" aria-label={`Show ${slide === 'deposit-match' ? 'deposit match' : 'hot picks'} slide`} onClick={() => setActiveHeroSlide(index)} className={`h-1.5 w-1.5 rounded-full ${index === activeHeroSlide ? 'bg-[#52f7b0]' : 'bg-slate-600'}`} />)}
        </div>
      </section>

      <section className="mt-5 overflow-x-auto px-3 [scrollbar-width:none]">
        <div className="flex min-w-max gap-3">
          {[
            { label: 'Home', sublabel: '', icon: Home, active: true, tone: 'text-[#55f7c3]' },
            { label: 'Trending', sublabel: 'Hot Boxes', icon: Flame, active: false, tone: 'text-orange-400' },
            { label: 'Cases', sublabel: 'All Boxes', icon: Box, active: false, tone: 'text-purple-400' },
            { label: 'Winners', sublabel: 'Live Pulls', icon: Trophy, active: false, tone: 'text-yellow-300' }
          ].map(({ label, sublabel, icon: Icon, active, tone }) => (
            <button key={label} type="button" className={`flex h-[94px] w-[112px] flex-col items-center justify-center rounded-[1.25rem] border bg-[#101827] text-center shadow-[inset_0_0_22px_rgba(255,255,255,0.025),0_12px_24px_rgba(0,0,0,0.18)] ${active ? 'border-[#24e69e] shadow-[inset_0_0_26px_rgba(36,230,158,0.12),0_0_18px_rgba(36,230,158,0.20)]' : 'border-[#24314a]'}`}>
              <Icon className={`mb-2 h-9 w-9 ${tone}`} strokeWidth={1.9} />
              <span className={`text-[13px] font-black uppercase leading-none tracking-wide ${active ? 'text-[#55f7c3]' : 'text-white'}`}>{label}</span>
              {sublabel ? <span className="mt-1 text-[9px] font-black uppercase tracking-wide text-slate-500">{sublabel}</span> : null}
            </button>
          ))}
        </div>
      </section>

      <div className="mt-7 flex items-center gap-2 px-3">
        <button className="grid h-10 w-10 place-items-center rounded-full bg-[#252d42] text-slate-300"><Search className="h-5 w-5" /></button>
        <button className="flex h-10 items-center gap-2 rounded-full bg-[#252d42] px-4 text-slate-200"><SlidersHorizontal className="h-5 w-5" /><ChevronRight className="h-3 w-3 rotate-90" /></button>
        <button className="flex h-10 items-center gap-2 rounded-full bg-[#252d42] px-4 text-slate-200"><SlidersHorizontal className="h-5 w-5 rotate-90" /><ChevronRight className="h-3 w-3 rotate-90" /></button>
      </div>

      <section className="mt-7 px-3">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2"><Box className="h-4 w-4 text-slate-400" /><h2 className="text-[18px] font-black uppercase tracking-tight text-white">Mystery Boxes</h2></div>
          <button type="button" onClick={onViewAllBoxes} className="rounded-full bg-[#252d42] px-3 py-2 text-[10px] font-black uppercase text-slate-200 active:scale-[0.98]">See more</button>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {mysteryBoxCards.map((box) => <button key={box.id} onClick={() => onOpenBox(box.id)} className="relative h-[112px] overflow-hidden rounded-lg bg-[#252b3a] p-2 active:scale-[0.98]"><img src={box.image} alt="" className="h-full w-full object-contain" /><span className="absolute left-1.5 top-1.5 rounded bg-fuchsia-500 px-1.5 py-0.5 text-[5px] font-black uppercase text-white">Featured</span></button>)}
        </div>
      </section>

      <section className="mt-7 px-3">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-slate-400" /><h2 className="text-[18px] font-black uppercase tracking-tight text-white">Live Wins</h2></div>
          <div className="flex gap-2"><button className="grid h-8 w-8 place-items-center rounded-full bg-[#252d42] text-slate-500"><ChevronLeft className="h-4 w-4" /></button><button className="grid h-8 w-8 place-items-center rounded-full bg-[#252d42] text-slate-400"><ChevronRight className="h-4 w-4" /></button></div>
        </div>
        <div className="overflow-hidden">
          <div className="flex gap-2 transition-transform duration-700 ease-out" style={{ transform: `translate3d(-${activeLiveWinIndex * 108}px,0,0)` }}>
            {(mobileLiveWins.length ? mobileLiveWins : originals.map((box, index) => ({ id: box.id, title: box.name, image: box.image, rarity: (index === 0 ? 'rare' : index === 1 ? 'uncommon' : 'epic') as MobileLiveWin['rarity'], timeAgo: index === 0 ? 'now' : `${index + 1}m`, boxId: box.id }))).map((win) => <MobileLiveWinCard key={win.id} win={win} onOpenBox={onOpenBox} />)}
          </div>
        </div>
      </section>
    </div>
  );
};

const MobileGameRow = ({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) => (
  <section className="mt-7 px-3">
    <div className="mb-4 flex items-center justify-between">
      <div className="flex items-center gap-2">{icon}<h2 className="text-[18px] font-black uppercase tracking-tight text-white">{title}</h2></div>
      <div className="flex gap-2"><button className="grid h-8 w-8 place-items-center rounded-full bg-[#252d42] text-slate-500"><ChevronLeft className="h-4 w-4" /></button><button className="grid h-8 w-8 place-items-center rounded-full bg-[#252d42] text-slate-400"><ChevronRight className="h-4 w-4" /></button></div>
    </div>
    <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">{children}</div>
  </section>
);

const FirstDepositBanner = memo(({ onClaim, onDismiss }: { onClaim: () => void; onDismiss: () => void }) => (
  <section className="relative overflow-hidden rounded-2xl border border-amber-300/20 bg-[linear-gradient(135deg,rgba(247,183,51,0.16),rgba(124,92,255,0.14),rgba(32,93,215,0.12))] p-4 shadow-[0_16px_40px_rgba(5,8,12,0.28)] sm:p-5" aria-label="First deposit bonus">
    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_0%,rgba(247,183,51,0.22),transparent_32%),radial-gradient(circle_at_88%_100%,rgba(56,189,248,0.16),transparent_36%)]" />
    <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-300/15 text-xl shadow-inner" aria-hidden="true">🎁</span>
        <div className="min-w-0">
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-amber-100/90">First Deposit Bonus Available</p>
          <h2 className="mt-1 text-xl font-black tracking-tight text-white sm:text-2xl">Get 4,000 Coins for $20</h2>
          <p className="mt-1 text-sm leading-5 text-slate-300">Starter bonus unlocked for your first top up.</p>
        </div>
      </div>
      <div className="flex items-center gap-2 sm:shrink-0">
        <button type="button" onClick={onClaim} className="min-h-11 flex-1 rounded-xl bg-gradient-to-r from-[#7C5CFF] via-[#205DD7] to-sky-400 px-5 py-3 text-sm font-black text-white shadow-[0_10px_26px_rgba(32,93,215,0.36)] transition hover:brightness-110 active:scale-[0.98] sm:flex-none">Claim Bonus</button>
        <button type="button" onClick={onDismiss} aria-label="Dismiss first deposit bonus" className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-slate-300 transition hover:bg-white/[0.08] hover:text-white"><X className="h-4 w-4" /></button>
      </div>
    </div>
  </section>
));
FirstDepositBanner.displayName = 'FirstDepositBanner';

type SocialProofActivity = {
  id: string;
  uid: string;
  username: string;
  itemName: string;
};

const resolveOpenUsername = async (uid: string) => {
  if (!uid) return 'Someone';
  try {
    const userSnap = await getDoc(doc(db, 'users', uid));
    const userData = userSnap.data() as Record<string, unknown> | undefined;
    const displayName = userData?.displayName ?? userData?.username ?? userData?.name;
    return typeof displayName === 'string' && displayName.trim() ? displayName.trim() : 'Someone';
  } catch {
    return 'Someone';
  }
};

const buildSocialProofMessage = (activity: SocialProofActivity) => `${activity.username} Just unboxed ${activity.itemName}`;

const SocialProofNotifications = memo(() => {
  const [activities, setActivities] = useState<SocialProofActivity[]>([]);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'opens'), orderBy('createdAt', 'desc'), limit(18));
    return onSnapshot(q, (snap) => {
      void (async () => {
        const openRows = snap.docs.map((docSnap) => {
          const data = docSnap.data() as Record<string, any>;
          const uid = typeof data.uid === 'string' ? data.uid : '';
          const prize = data.prize && typeof data.prize === 'object' ? data.prize as Record<string, unknown> : {};
          const itemName = typeof prize.name === 'string' && prize.name.trim() ? prize.name.trim() : 'a mystery item';
          return { id: docSnap.id, uid, itemName };
        }).filter((activity) => activity.uid && activity.itemName);
        const usernamesByUid = new Map<string, string>();
        await Promise.all(Array.from(new Set(openRows.map((row) => row.uid))).map(async (uid) => {
          usernamesByUid.set(uid, await resolveOpenUsername(uid));
        }));
        setActivities(openRows.map((row) => ({
          ...row,
          username: usernamesByUid.get(row.uid) ?? 'Someone'
        })));
      })();
    }, () => setActivities([]));
  }, []);

  useEffect(() => {
    if (!activities.length) return;
    let hideTimer: ReturnType<typeof globalThis.setTimeout> | null = null;
    let showTimer: ReturnType<typeof globalThis.setTimeout> | null = null;
    let cancelled = false;

    const schedule = (delay: number) => {
      showTimer = globalThis.setTimeout(() => {
        if (cancelled || !activities.length) return;
        setActiveIndex((current) => (current === null ? 0 : (current + 1) % activities.length));
        setVisible(true);
        hideTimer = globalThis.setTimeout(() => {
          setVisible(false);
          schedule(60_000 + Math.floor(Math.random() * 30_000));
        }, 5_000);
      }, delay);
    };

    schedule(2_800);
    return () => {
      cancelled = true;
      if (hideTimer) globalThis.clearTimeout(hideTimer);
      if (showTimer) globalThis.clearTimeout(showTimer);
    };
  }, [activities]);

  const activeActivity = activeIndex === null ? null : activities[activeIndex];
  if (!activeActivity) return null;

  return (
    <div className="pointer-events-none fixed left-0 right-0 top-[72px] z-[120] flex justify-center px-4 sm:top-[82px]" aria-live="polite">
      <div className={`pointer-events-auto flex max-w-[min(92vw,420px)] items-center gap-3 rounded-2xl border border-white/10 bg-[#121820]/95 px-4 py-3 text-sm text-white shadow-[0_16px_40px_rgba(0,0,0,0.36)] backdrop-blur-xl transition-all duration-300 ${visible ? 'translate-y-0 opacity-100' : '-translate-y-5 opacity-0'}`}>
        <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-300 shadow-[0_0_16px_rgba(110,231,183,0.8)]" aria-hidden="true" />
        <span className="min-w-0 truncate font-semibold">{buildSocialProofMessage(activeActivity)}</span>
      </div>
    </div>
  );
});
SocialProofNotifications.displayName = 'SocialProofNotifications';

export const HomeReplica: React.FC<HomeReplicaProps> = ({ boxes, onOpenBox, onViewAllBoxes, onSignUp }) => {
  const { user, isAuthenticated, setShowTopUpModal, setTopUpModalIntent } = useGame();
  const performanceMode = usePerformanceMode();
  const [showBelowFold, setShowBelowFold] = useState(false);
  const [startTickerAnimation, setStartTickerAnimation] = useState(false);
  const [showSocialProof, setShowSocialProof] = useState(false);
  const [depositBannerDismissed, setDepositBannerDismissed] = useState(false);
  const featuredBoxes = useMemo(() => boxes.slice(0, 8), [boxes]);
  const liveWinSourceBoxes = useMemo(() => boxes.slice(0, performanceMode.isMobile ? 10 : 18), [boxes, performanceMode.isMobile]);
  const liveWins = useMemo(() => buildLiveWins(liveWinSourceBoxes), [liveWinSourceBoxes]);
  const canShowConversionPrompts = !isAuthenticated || !hasUserMadeDeposit(user);
  const showFirstDepositBanner = isAuthenticated && !hasUserMadeDeposit(user) && !depositBannerDismissed;

  useEffect(() => {
    if (typeof window === 'undefined') {
      setShowBelowFold(true);
      return;
    }
    return runHomeWorkAfterIdleOrInteraction(() => setShowBelowFold(true), 3600);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    return runHomeWorkAfterIdleOrInteraction(() => setStartTickerAnimation(true), performanceMode.isMobile ? 2400 : 1800);
  }, [performanceMode.isMobile]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!canShowConversionPrompts) return;
    return runHomeWorkAfterIdleOrInteraction(() => setShowSocialProof(true), performanceMode.isMobile ? 5200 : 3600);
  }, [canShowConversionPrompts, performanceMode.isMobile]);

  useEffect(() => {
    if (typeof window === 'undefined' || !isAuthenticated) return;
    setDepositBannerDismissed(window.localStorage.getItem(`pullz:firstDepositBannerDismissed:${user.id}`) === '1');
  }, [isAuthenticated, user.id]);

  const handleClaimFirstDepositBonus = useCallback(() => {
    setTopUpModalIntent({
      reason: 'insufficient_balance',
      requiredCoins: 4000,
      currentBalance: Number(user.balance ?? 0),
      missingCoins: Math.max(0, 4000 - Number(user.balance ?? 0)),
      preferredPackageUsd: 20
    });
    setShowTopUpModal(true);
  }, [setShowTopUpModal, setTopUpModalIntent, user.balance]);

  const handleDismissFirstDepositBanner = useCallback(() => {
    setDepositBannerDismissed(true);
    if (typeof window !== 'undefined') window.localStorage.setItem(`pullz:firstDepositBannerDismissed:${user.id}`, '1');
  }, [user.id]);

  return (
    <div className="min-h-screen bg-[#1b2024] text-white">
      <main className="mx-auto max-w-[1250px] space-y-7 px-0 py-0 pb-24 sm:space-y-8 sm:px-6 sm:py-6 lg:px-4 lg:pb-5">
        <MobileHomePreview boxes={boxes} onOpenBox={onOpenBox} onViewAllBoxes={onViewAllBoxes} />
        <div className="hidden lg:block lg:space-y-7">
        {canShowConversionPrompts && showSocialProof && <SocialProofNotifications />}
        {showFirstDepositBanner && (
          <FirstDepositBanner onClaim={handleClaimFirstDepositBonus} onDismiss={handleDismissFirstDepositBanner} />
        )}

        <LiveCommunitySection />

        <HomeBanners />

        <section aria-label="Available boxes" className="rounded-[1.35rem] border border-white/[0.06] bg-[#20262b]/72 p-4 shadow-[0_18px_44px_rgba(5,8,12,0.22)] sm:p-5">
          <div className="mb-5 flex items-end justify-between gap-3">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-cyan-200/80">Start opening</p>
              <h2 className="mt-1 flex items-center gap-2 text-2xl font-black tracking-tight sm:text-3xl"><Package className="h-6 w-6 text-sky-300" aria-hidden="true" />Available Boxes</h2>
            </div>
            <button onClick={onViewAllBoxes} className="min-h-10 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-black uppercase tracking-wide text-white/90 transition hover:border-sky-300/40 hover:bg-white/[0.08] hover:text-white active:scale-[0.98]">View All</button>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4 xl:grid-cols-4">
            {featuredBoxes.map((box, index) => (
              <button key={box.id} onClick={() => onOpenBox(box.id)} className="group relative overflow-hidden rounded-2xl border border-white/[0.06] bg-[#1b2024]/80 p-3 text-center shadow-[0_10px_28px_rgba(5,8,12,0.20)] transition duration-200 hover:-translate-y-1 hover:border-sky-300/35 hover:bg-[#252c32] hover:shadow-[0_18px_38px_rgba(5,8,12,0.34)] active:scale-[0.98] sm:p-4">
                {index < 2 && <span className="absolute left-3 top-3 z-10 rounded-full bg-gradient-to-r from-[#7C5CFF] to-sky-400 px-2.5 py-1 text-[9px] font-black uppercase tracking-wide text-white shadow-lg">Most Popular</span>}
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_22%,rgba(124,92,255,0.16),transparent_42%),radial-gradient(circle_at_50%_100%,rgba(56,189,248,0.10),transparent_34%)] opacity-80" />
                <div className="relative flex h-[168px] items-center justify-center p-2 sm:h-[205px] lg:h-[220px]">
                  <BlurImage src={box.image} alt={box.name} className="mx-auto max-h-full w-auto object-contain drop-shadow-[0_18px_30px_rgba(0,0,0,0.35)] transition-transform duration-200 ease-out group-hover:scale-110 group-active:scale-105" loading={index < 2 ? 'eager' : 'lazy'} fetchPriority={index < 2 ? 'high' : 'low'} showPlaceholder={false} staticRender={performanceMode.isMobile || performanceMode.isLowPower} width={260} height={260} />
                </div>
                <div className="relative mt-2 flex items-center justify-between gap-2 rounded-xl border border-white/[0.06] bg-black/15 px-3 py-2">
                  <p className="min-w-0 truncate text-left text-xs font-bold text-slate-200 sm:text-sm">{box.name}</p>
                  <CoinAmount amount={Math.round(box.price)} className="shrink-0 text-sm font-black text-white" iconClassName="h-4 w-4" />
                </div>
              </button>
            ))}
          </div>
        </section>

        <section aria-label="Live recent wins" className="min-h-[470px] overflow-hidden rounded-[1.35rem] border border-white/5 bg-[#171918] shadow-[0_18px_44px_rgba(5,8,12,0.28)] sm:min-h-[514px]">
          <div className="flex flex-col gap-1 border-b border-white/[0.06] bg-[#171918] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300 opacity-60" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-300" />
              </span>
              <div>
                <h2 className="text-sm font-black uppercase tracking-[0.18em] text-slate-100">Live Wins</h2>
                <p className="mt-0.5 text-xs text-slate-400">Featured pulls from active boxes</p>
              </div>
            </div>
          </div>

          <div className="relative overflow-hidden py-5 sm:py-6">
            {liveWins.length > 0 ? (
              <>
                <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-12 bg-gradient-to-r from-[#171918] to-transparent sm:w-20" />
                <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-12 bg-gradient-to-l from-[#171918] to-transparent sm:w-20" />
                <div
                  className={`live-wins-ticker flex w-max items-center gap-4 px-4 sm:gap-5 ${startTickerAnimation ? 'ticker-animation [animation-duration:92s]' : ''}`}
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
        </section>

        {showBelowFold ? (
          <Suspense fallback={<HomeBelowFoldSkeleton />}>
            <HomeReplicaBelowFold boxes={boxes} showSignupCta={!isAuthenticated} onSignUp={onSignUp} />
          </Suspense>
        ) : (
          <HomeBelowFoldSkeleton />
        )}
        </div>
      </main>
    </div>
  );
};
