import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { Box, Check, Package, ShieldCheck, Sparkles, Truck, X } from 'lucide-react';
import { collection, doc, getDoc, limit, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '../firebase';
import { MysteryBox } from '../types';
import { CoinAmount } from './CoinAmount';
import { useGame } from '../context/GameContext';
import { BlurImage } from '../src/ui/images/BlurImage';

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
      className={`group relative flex h-[288px] w-[216px] shrink-0 flex-col overflow-hidden rounded-[1.25rem] border bg-[#181a1b] text-left shadow-[0_18px_36px_rgba(0,0,0,0.36)] transition duration-200 hover:-translate-y-1 hover:brightness-110 active:scale-[0.98] sm:h-[318px] sm:w-[240px] ${TICKER_RARITY_CARD_CLASS[win.rarity]}`}
      title={`${win.itemName} won from ${win.boxName}`}
    >
      <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${TICKER_RARITY_GLOW_CLASS[win.rarity]}`} />
      <div className="relative flex h-[146px] shrink-0 items-center justify-center overflow-hidden bg-[#111313] p-4 sm:h-[164px] sm:p-5">
        {win.featured && <span className="absolute left-3 top-3 z-20 rounded-full bg-amber-300 px-2.5 py-1 text-[9px] font-black uppercase tracking-wide text-black shadow-lg">🔥 Big Win</span>}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-16 bg-gradient-to-t from-[#181a1b] to-transparent" />
        <img src={win.itemImage} alt={win.itemName} className="relative z-0 h-[88%] w-[88%] object-contain drop-shadow-[0_18px_26px_rgba(0,0,0,0.42)] transition-transform duration-300 group-hover:scale-105 sm:h-[86%] sm:w-[86%]" loading="lazy" decoding="async" width={260} height={260} />
      </div>
      <div className="relative z-10 flex min-h-0 flex-1 flex-col gap-3 bg-[#1c1d1e]/96 p-4 pb-5 sm:p-5 sm:pb-6">
        <div>
          <div className="flex items-start justify-between gap-3">
            <p className="min-w-0 flex-1 truncate text-base font-black leading-tight text-white sm:text-lg">{win.itemName}</p>
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
              <CoinAmount amount={Math.round(win.itemPrice)} className="justify-end text-base font-black text-lime-300" iconClassName="h-4 w-4 sm:h-5 sm:w-5" animated={false} />
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
      <div key={index} className="h-[372px] w-[248px] shrink-0 rounded-[1.55rem] border-2 border-white/10 bg-white/[0.045] sm:h-[318px] sm:w-[240px]" />
    ))}
  </div>
));
LiveWinsSkeleton.displayName = 'LiveWinsSkeleton';

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

const ONBOARDING_KEY = 'pullz_onboarding_complete';

const FirstTimeOnboardingModal = memo(({ onOpenFreeBox }: { onOpenFreeBox: () => void }) => {
  const [visible, setVisible] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const steps = [
    { title: 'Welcome To Pullz', text: 'Open digital boxes containing real collectible items.' },
    { title: 'Keep Or Sell', text: 'Keep your pull or instantly sell it for balance.' },
    { title: 'Ship To Your Door', text: "Ship your favorite items whenever you're ready." },
    { title: 'Open Your Free Box', text: "Let's get started." }
  ];

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.localStorage.getItem(ONBOARDING_KEY) === '1') return;
    const timer = window.setTimeout(() => setVisible(true), 700);
    return () => window.clearTimeout(timer);
  }, []);

  const complete = useCallback((openFreeBox = false) => {
    if (typeof window !== 'undefined') window.localStorage.setItem(ONBOARDING_KEY, '1');
    setVisible(false);
    if (openFreeBox) onOpenFreeBox();
  }, [onOpenFreeBox]);

  if (!visible) return null;
  const current = steps[stepIndex];
  const isLast = stepIndex === steps.length - 1;

  return (
    <div className="fixed inset-0 z-[140] flex items-end justify-center bg-black/65 px-0 backdrop-blur-sm sm:items-center sm:px-4" role="dialog" aria-modal="true" aria-labelledby="pullz-onboarding-title">
      <div className="w-full rounded-t-[2rem] border border-white/10 bg-[#121820] p-6 shadow-[0_-18px_60px_rgba(0,0,0,0.45)] transition-all duration-300 sm:max-w-md sm:rounded-[2rem] sm:p-7 sm:shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
        <div className="mx-auto mb-5 h-1.5 w-12 rounded-full bg-white/15 sm:hidden" />
        <div className="mb-6 flex justify-center gap-2" aria-label={`Step ${stepIndex + 1} of ${steps.length}`}>
          {steps.map((step, index) => <span key={step.title} className={`h-2.5 w-2.5 rounded-full transition-all duration-300 ${index === stepIndex ? 'w-6 bg-cyan-300' : 'bg-white/20'}`} />)}
        </div>
        <div className="min-h-[132px] transition-opacity duration-300">
          <p className="text-center text-[11px] font-black uppercase tracking-[0.22em] text-cyan-200/75">Getting started</p>
          <h2 id="pullz-onboarding-title" className="mt-3 text-center text-3xl font-black tracking-tight text-white">{current.title}</h2>
          <p className="mx-auto mt-3 max-w-sm text-center text-sm leading-6 text-slate-300">{current.text}</p>
        </div>
        <div className="mt-6 flex gap-3">
          <button type="button" onClick={() => complete(false)} className="min-h-11 flex-1 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-black text-slate-200 transition hover:bg-white/[0.08]">Don't show again</button>
          <button type="button" onClick={() => isLast ? complete(true) : setStepIndex((value) => Math.min(value + 1, steps.length - 1))} className="min-h-11 flex-1 rounded-full bg-gradient-to-r from-[#7C5CFF] via-[#205DD7] to-sky-400 px-4 py-2 text-sm font-black text-white shadow-[0_12px_28px_rgba(32,93,215,0.32)] transition hover:brightness-110 active:scale-[0.98]">{isLast ? 'Open Free Box' : 'Next'}</button>
        </div>
      </div>
    </div>
  );
});
FirstTimeOnboardingModal.displayName = 'FirstTimeOnboardingModal';

export const HomeReplica: React.FC<HomeReplicaProps> = ({ boxes, onOpenBox, onViewAllBoxes, onSignUp }) => {
  const { user, isAuthenticated, setShowTopUpModal, setTopUpModalIntent } = useGame();
  const performanceMode = usePerformanceMode();
  const [startTickerAnimation, setStartTickerAnimation] = useState(false);
  const [showSocialProof, setShowSocialProof] = useState(false);
  const [depositBannerDismissed, setDepositBannerDismissed] = useState(false);
  const featuredBoxes = useMemo(() => {
    const eligible = boxes.filter((box) => !box.isUserCreated && !box.isPullPassBox);
    const scored = eligible.map((box) => {
      const price = Number(box.price) || 0;
      const tagText = `${box.tag ?? ''} ${(box.tags ?? []).join(' ')} ${box.name}`.toLowerCase();
      let score = price;
      if (price <= 2500 || tagText.includes('beginner') || tagText.includes('starter')) score -= 100000;
      if (tagText.includes('popular') || tagText.includes('hot')) score -= 50000;
      if (price > 2500 && price <= 12000) score -= 25000;
      if (price > 12000) score -= 10000;
      return { box, score };
    });
    return scored.sort((a, b) => a.score - b.score).slice(0, 6).map((entry) => entry.box);
  }, [boxes]);
  const liveWinSourceBoxes = useMemo(() => boxes.slice(0, performanceMode.isMobile ? 10 : 18), [boxes, performanceMode.isMobile]);
  const liveWins = useMemo(() => buildLiveWins(liveWinSourceBoxes), [liveWinSourceBoxes]);
  const canShowConversionPrompts = !isAuthenticated || !hasUserMadeDeposit(user);
  const showFirstDepositBanner = isAuthenticated && !hasUserMadeDeposit(user) && !depositBannerDismissed;

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

  const trustItems = [
    'Real Physical Items',
    'Provably Fair',
    'Secure Checkout',
    'Fast Shipping'
  ];
  const paymentLogos = ['Stripe', 'Apple Pay', 'Google Pay', 'Visa', 'Mastercard', 'PriceCharting'];

  return (
    <div className="min-h-screen bg-[#1b2024] text-white">
      <main className="mx-auto max-w-[1250px] space-y-7 px-4 py-5 sm:space-y-8 sm:px-6 sm:py-6">
        <FirstTimeOnboardingModal onOpenFreeBox={onSignUp} />
        {canShowConversionPrompts && showSocialProof && <SocialProofNotifications />}
        {showFirstDepositBanner && (
          <FirstDepositBanner onClaim={handleClaimFirstDepositBonus} onDismiss={handleDismissFirstDepositBanner} />
        )}

        <section className="relative overflow-hidden rounded-[2rem] border border-white/[0.07] bg-[radial-gradient(circle_at_72%_18%,rgba(124,92,255,0.22),transparent_34%),linear-gradient(135deg,#20262b,#15191d)] p-5 shadow-[0_24px_70px_rgba(5,8,12,0.34)] sm:p-8 lg:p-10">
          <div className="grid items-center gap-8 lg:grid-cols-[1fr_420px]">
            <div className="max-w-3xl">
              <p className="text-[11px] font-black uppercase tracking-[0.22em] text-cyan-200/85">Pullz.gg Mystery Boxes</p>
              <h1 className="mt-3 text-4xl font-black leading-[0.95] tracking-tight text-white sm:text-6xl lg:text-7xl">Open boxes. Pull real collectibles.</h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">Pullz is a premium collectible box opening experience where every digital pull is backed by real physical items you can keep, sell back, or ship.</p>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <button type="button" onClick={onSignUp} className="min-h-12 rounded-full bg-gradient-to-r from-[#7C5CFF] via-[#205DD7] to-sky-400 px-7 py-3 text-sm font-black text-white shadow-[0_14px_34px_rgba(32,93,215,0.36)] transition hover:brightness-110 active:scale-[0.98]">Open Your Free Box</button>
                <button type="button" onClick={onViewAllBoxes} className="min-h-12 rounded-full border border-white/12 bg-white/[0.04] px-7 py-3 text-sm font-black text-white transition hover:border-sky-300/40 hover:bg-white/[0.08] active:scale-[0.98]">Browse Boxes</button>
              </div>
              <div className="mt-5 flex flex-wrap gap-x-4 gap-y-2 text-sm font-bold text-slate-200">
                {trustItems.map((item) => <span key={item} className="inline-flex items-center gap-1.5"><Check className="h-4 w-4 text-emerald-300" />{item}</span>)}
              </div>
            </div>
            <div className="relative mx-auto w-full max-w-[420px]">
              <div className="absolute inset-8 rounded-full bg-sky-400/20 blur-3xl" />
              <img src="/home-banners/homepage-preview.svg" alt="Pullz box opening preview" className="relative w-full rounded-[1.6rem] border border-white/10 bg-black/20 p-4 shadow-[0_24px_60px_rgba(0,0,0,0.35)]" loading="eager" />
            </div>
          </div>
        </section>

        <section id="how-it-works" className="scroll-mt-28">
          <div className="mb-4"><p className="text-[11px] font-black uppercase tracking-[0.2em] text-cyan-200/75">How it works</p><h2 className="mt-1 text-2xl font-black sm:text-3xl">Three simple steps</h2></div>
          <div className="-mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-2 md:mx-0 md:grid md:grid-cols-3 md:overflow-visible md:px-0">
            {[{icon:Box,title:'Open a Box',text:'Choose from Pokémon, slabs, sports cards, and collectibles.'},{icon:Sparkles,title:'Keep or Sell',text:'Keep your item or instantly sell it back for site balance.'},{icon:Truck,title:'Ship Real Items',text:'Ship your wins directly to your door.'}].map((step, index) => { const Icon = step.icon; return (
              <article key={step.title} className="min-w-[78vw] snap-center rounded-2xl border border-white/[0.07] bg-[#20262b]/72 p-5 shadow-[0_14px_36px_rgba(5,8,12,0.22)] transition duration-200 hover:-translate-y-1 hover:border-sky-300/25 md:min-w-0">
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-white/[0.06] text-cyan-200"><Icon className="h-5 w-5" /></div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Step {index + 1}</p>
                <h3 className="mt-2 text-xl font-black text-white">{step.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-400">{step.text}</p>
              </article>
            );})}
          </div>
        </section>

        <section aria-label="Featured boxes" className="rounded-[1.35rem] border border-white/[0.06] bg-[#20262b]/72 p-4 shadow-[0_18px_44px_rgba(5,8,12,0.22)] sm:p-5">
          <div className="mb-5 flex items-end justify-between gap-3"><div><p className="text-[11px] font-black uppercase tracking-[0.18em] text-cyan-200/80">Curated catalog</p><h2 className="mt-1 flex items-center gap-2 text-2xl font-black tracking-tight sm:text-3xl"><Package className="h-6 w-6 text-sky-300" />Featured Boxes</h2></div><button onClick={onViewAllBoxes} className="min-h-10 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-black uppercase tracking-wide text-white/90 transition hover:border-sky-300/40 hover:bg-white/[0.08] active:scale-[0.98]">View All</button></div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {featuredBoxes.map((box, index) => { const labels = ['⭐ Best Value','🔥 Popular','Beginner','Mid-tier','💎 Premium','High-tier']; return (
              <button key={box.id} onClick={() => onOpenBox(box.id)} className="group relative overflow-hidden rounded-2xl border border-white/[0.06] bg-[#1b2024]/80 p-3 text-center shadow-[0_10px_28px_rgba(5,8,12,0.20)] transition duration-200 hover:-translate-y-1 hover:border-sky-300/35 hover:bg-[#252c32] active:scale-[0.98]">
                <span className="absolute left-3 top-3 z-10 rounded-full bg-black/45 px-2.5 py-1 text-[9px] font-black uppercase tracking-wide text-white/90 backdrop-blur">{labels[index] ?? 'Featured'}</span>
                <div className="relative flex h-[136px] items-center justify-center p-2 sm:h-[160px]"><BlurImage src={box.image} alt={box.name} className="mx-auto max-h-full w-auto object-contain drop-shadow-[0_18px_30px_rgba(0,0,0,0.35)] transition-transform duration-200 group-hover:scale-105" loading={index < 2 ? 'eager' : 'lazy'} fetchPriority={index < 2 ? 'high' : 'low'} showPlaceholder={false} staticRender={performanceMode.isMobile || performanceMode.isLowPower} width={220} height={220} /></div>
                <div className="relative mt-2 rounded-xl border border-white/[0.06] bg-black/15 px-3 py-2"><p className="truncate text-left text-xs font-bold text-slate-200">{box.name}</p><CoinAmount amount={Math.round(box.price)} className="mt-1 text-sm font-black text-white" iconClassName="h-4 w-4" /></div>
              </button>
            );})}
          </div>
        </section>


        <section aria-label="Live recent wins" className="min-h-[360px] overflow-hidden rounded-[1.35rem] border border-white/5 bg-[#171918] shadow-[0_18px_44px_rgba(5,8,12,0.28)] sm:min-h-[392px]">
          <div className="flex items-center gap-2 border-b border-white/[0.06] px-4 py-4"><span className="relative flex h-2.5 w-2.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300 opacity-60" /><span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-300" /></span><div><h2 className="text-sm font-black uppercase tracking-[0.18em] text-slate-100">Live Wins</h2><p className="mt-0.5 text-xs text-slate-400">Recent pulls from real users</p></div></div>
          <div className="relative overflow-hidden py-5">{liveWins.length > 0 ? <><div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-12 bg-gradient-to-r from-[#171918] to-transparent" /><div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-12 bg-gradient-to-l from-[#171918] to-transparent" /><div className={`live-wins-ticker flex w-max items-center gap-4 px-4 ${startTickerAnimation ? 'ticker-animation [animation-duration:92s]' : ''}`} style={{ transform: 'translate3d(0,0,0)' }}>{[...liveWins, ...liveWins].map((win, index) => <LiveWinCard key={`${win.id}-${index}`} win={win} onOpenBox={onOpenBox} />)}</div></> : <LiveWinsSkeleton />}</div>
        </section>

        <section className="rounded-[1.35rem] border border-white/[0.07] bg-[#20262b]/72 p-4 text-center sm:p-5">
          <div className="flex flex-wrap items-center justify-center gap-3 text-sm font-black text-slate-200">{['Provably Fair','Secure Payments','Real Physical Items','Fast Shipping','Verified Pricing'].map((item) => <span key={item} className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-3 py-2"><Check className="h-4 w-4 text-emerald-300" />{item}</span>)}</div>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2">{paymentLogos.map((logo) => <span key={logo} className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-black uppercase tracking-wide text-slate-300 grayscale">{logo}</span>)}</div>
        </section>

        <section className="rounded-[2rem] border border-sky-300/10 bg-[linear-gradient(135deg,rgba(124,92,255,0.16),rgba(32,93,215,0.12),rgba(5,8,12,0.38))] p-6 text-center shadow-[0_24px_70px_rgba(5,8,12,0.32)] sm:p-10">
          <ShieldCheck className="mx-auto h-10 w-10 text-cyan-200" /><h2 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">Ready To Open Your First Pull?</h2><p className="mx-auto mt-3 max-w-xl text-slate-300">Join thousands of users opening real collectible items.</p><div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row"><button type="button" onClick={onSignUp} className="min-h-12 rounded-full bg-gradient-to-r from-[#7C5CFF] via-[#205DD7] to-sky-400 px-7 py-3 text-sm font-black text-white shadow-[0_14px_34px_rgba(32,93,215,0.36)] transition hover:brightness-110 active:scale-[0.98]">Open Free Box</button><button type="button" onClick={onSignUp} className="min-h-12 rounded-full border border-white/12 bg-white/[0.04] px-7 py-3 text-sm font-black text-white transition hover:bg-white/[0.08] active:scale-[0.98]">Create Account</button></div>
        </section>
      </main>
    </div>
  );
};
