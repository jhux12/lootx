import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatedNumber } from '../src/ui/numbers/AnimatedNumber';
import {
  Facebook,
  ChevronDown,
  HelpCircle,
  Instagram,
  LifeBuoy,
  LogOut,
  Package,
  PenTool,
  Plus,
  RefreshCw,
  Sparkles,
  BarChart3,
  Clock3,
  Shield,
  ShieldCheck,
  Trophy,
  Twitter,
  User as UserIcon,
  Users,
  Youtube
} from 'lucide-react';
import { useGame } from '../context/GameContext';
import { useSound } from '../context/SoundContext';
import { authedFetch } from '../utils/authedFetch';
import { CoinAmount } from './CoinAmount';
import { BrandLockup } from './BrandLockup';
import { XP_ICON } from '../constants';
import { useBalanceFeedback } from '../src/ui/feedback/useBalanceFeedback';
import { ActivityDrawer } from '../src/ui/activity/ActivityDrawer';
import { useActivity } from '../src/lib/activity/useActivity';
import { ProvablyFairBadge } from '../src/ui/provably/ProvablyFairBadge';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { getClaimReadyQuestCount, normalizeQuestRules } from '../src/lib/quests';

type HeaderProps = {
  onOpenInbox: () => void;
  unreadChatCount?: number;
  isSticky?: boolean;
};

const UpgraderIcon: React.FC<{ className?: string }> = ({ className }) => (
  <i className={`fa-brands fa-superpowers ${className ?? ''}`.trim()} aria-hidden="true" />
);

const drawerCardClass =
  'flex items-center gap-3 rounded-xl border border-white/5 bg-[#18181b] p-3 text-left transition-colors hover:bg-[#202023]';

export const Header: React.FC<HeaderProps> = ({ onOpenInbox: _onOpenInbox, unreadChatCount: _unreadChatCount, isSticky = true }) => {
  const {
    user,
    balance,
    setView,
    isAuthenticated,
    openAuthModal,
    setShowTopUpModal,
    logout
  } = useGame();
  const { playSound } = useSound();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isGamesMenuOpen, setIsGamesMenuOpen] = useState(false);
  const [isRewardsMenuOpen, setIsRewardsMenuOpen] = useState(false);
  const [questReadyCount, setQuestReadyCount] = useState(0);
  const [claimedTodayCount, setClaimedTodayCount] = useState(0);
  const [locallyClaimedQuestIds, setLocallyClaimedQuestIds] = useState<Record<string, string>>({});
  const [showActivity, setShowActivity] = useState(false);
  const [provablyData, setProvablyData] = useState<{ serverSeedHash?: string; clientSeed?: string; nonce?: number }>({});
  const headerRef = useRef<HTMLElement | null>(null);
  const targetXp = Math.floor(user.xpBalance ?? user.xp ?? 0);
  const balanceTone = useBalanceFeedback(balance, isAuthenticated);
  const { unreadCount } = useActivity();
  const lastDailyClaim = Number.isFinite(user.lastDailyClaim ?? NaN) ? Number(user.lastDailyClaim) : 0;
  const dailyCooldownMs = 24 * 60 * 60 * 1000;
  const isDailySpinReady = !lastDailyClaim || (lastDailyClaim + dailyCooldownMs) <= Date.now();
  const showDailySpinReady = isAuthenticated && isDailySpinReady;

  useEffect(() => {
    if (!isAuthenticated) return;
    authedFetch<{ serverSeedHash: string; clientSeed: string; nonce: number }>('/api/provably-fair')
      .then((data) => setProvablyData(data))
      .catch(() => undefined);
  }, [isAuthenticated]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const openMobileMenu = () => {
      setIsMobileMenuOpen(true);
    };

    const toggleMobileMenu = () => {
      setIsMobileMenuOpen((prev) => !prev);
    };

    window.addEventListener('pullz:open-mobile-menu', openMobileMenu);
    window.addEventListener('pullz:toggle-mobile-menu', toggleMobileMenu);
    return () => {
      window.removeEventListener('pullz:open-mobile-menu', openMobileMenu);
      window.removeEventListener('pullz:toggle-mobile-menu', toggleMobileMenu);
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    window.dispatchEvent(new CustomEvent('pullz:mobile-menu-state', { detail: { isOpen: isMobileMenuOpen } }));
    document.body.style.overflow = isMobileMenuOpen ? 'hidden' : '';

    return () => {
      document.body.style.overflow = '';
    };
  }, [isMobileMenuOpen]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const syncHeaderHeight = () => {
      const headerHeight = headerRef.current?.offsetHeight ?? 72;
      document.documentElement.style.setProperty('--pullz-header-height', `${headerHeight}px`);
    };

    syncHeaderHeight();

    const resizeObserver = typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(syncHeaderHeight);

    if (headerRef.current && resizeObserver) {
      resizeObserver.observe(headerRef.current);
    }

    window.addEventListener('resize', syncHeaderHeight);

    return () => {
      window.removeEventListener('resize', syncHeaderHeight);
      resizeObserver?.disconnect();
      document.documentElement.style.removeProperty('--pullz-header-height');
    };
  }, []);

  useEffect(() => {
    const pathLabel = 'settings/rewards';
    console.log('READING FIRESTORE PATH', pathLabel);
    const unsub = onSnapshot(doc(db, 'settings', 'rewards'), (snap) => {
      console.log('SNAPSHOT OK', {
        path: pathLabel,
        size: 'size' in snap ? snap.size : undefined
      });
      const data = snap.data() as Record<string, unknown> | undefined;
      const today = new Date().toISOString().slice(0, 10);
      const claims = { ...(user.questClaims ?? {}), ...locallyClaimedQuestIds };
      const stats = user.challengeStatsDay === today ? (user.challengeStats ?? {}) : {};
      const count = getClaimReadyQuestCount(normalizeQuestRules(data?.questRules), stats, claims, today);
      const rules = normalizeQuestRules(data?.questRules).filter((rule) => rule.enabled !== false);
      const claimedCount = rules.filter((rule) => claims?.[rule.id] === today).length;
      setQuestReadyCount(count);
      setClaimedTodayCount(claimedCount);
    }, (error) => {
      console.error('SNAPSHOT FAILED', {
        path: pathLabel,
        code: error?.code,
        message: error?.message,
        error
      });
    });
    return () => unsub();
  }, [locallyClaimedQuestIds, user.challengeStats, user.questClaims]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const handleQuestClaimed = (event: Event) => {
      const customEvent = event as CustomEvent<{ questId?: string; day?: string }>;
      const questId = customEvent.detail?.questId;
      const day = customEvent.detail?.day;
      if (!questId || !day) return;
      setLocallyClaimedQuestIds((prev) => ({ ...prev, [questId]: day }));
    };

    window.addEventListener('pullz:quest-claimed', handleQuestClaimed as EventListener);
    return () => {
      window.removeEventListener('pullz:quest-claimed', handleQuestClaimed as EventListener);
    };
  }, []);

  const navigate = (type: 'HOME' | 'BOXES' | 'PLINKO' | 'BONUSES' | 'LEADERBOARD' | 'QUESTS' | 'POLLS' | 'REFERRALS' | 'PROVABLY_FAIR' | 'CONTACT' | 'TERMS' | 'PRIVACY' | 'PROFILE' | 'ADMIN' | 'INVENTORY') => {
    playSound('click');
    const requiresAuth = type === 'BONUSES' || type === 'QUESTS' || type === 'POLLS' || type === 'REFERRALS' || type === 'INVENTORY' || type === 'PROFILE';
    if (requiresAuth && !isAuthenticated) {
      openAuthModal('login');
      return;
    }
    setView({ type } as any);
    setIsMobileMenuOpen(false);
    setIsGamesMenuOpen(false);
    setIsRewardsMenuOpen(false);
  };

  const authButtons = useMemo(() => (
    <>
      <button
        onClick={() => {
          playSound('click');
          openAuthModal('login');
        }}
        className="rounded-xl border border-white/10 bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-neutral-800 sm:px-5"
      >
        Sign in
      </button>
      <div className="flex flex-col items-center">
        <button
          onClick={() => {
            playSound('click');
            openAuthModal('register');
          }}
          className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-500 sm:px-5"
        >
          Sign up
        </button>
        <button
          type="button"
          onClick={() => {
            playSound('click');
            openAuthModal('register');
          }}
          className="mt-2 inline-flex items-center gap-2 rounded-xl border border-indigo-500/20 bg-[#131722] px-3 py-2 text-left text-[11px] font-semibold text-white shadow-[0_10px_30px_rgba(15,23,42,0.28)] transition-colors hover:border-indigo-400/40 hover:bg-[#171c29] sm:px-3.5"
          aria-label="Claim free box"
        >
          <span aria-hidden="true" className="flex h-6 w-6 items-center justify-center rounded-lg bg-indigo-500/15 text-indigo-200">
            <Sparkles className="h-3.5 w-3.5" />
          </span>
          <span className="flex flex-col leading-tight">
            <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-indigo-300/80">Free box</span>
            <span className="whitespace-nowrap text-[11px] font-semibold text-white">Claim free box</span>
          </span>
        </button>
      </div>
    </>
  ), [openAuthModal, playSound]);

  const dailySpinDesktopClass = `flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold text-white transition-all ${
    showDailySpinReady
      ? 'border border-blue-400/60 bg-blue-500/10 shadow-[0_0_18px_rgba(59,130,246,0.35)] motion-safe:animate-pulse hover:bg-blue-500/20'
      : 'hover:bg-white/5'
  }`;

  const dailySpinMobileClass = `${drawerCardClass} transition-all ${
    showDailySpinReady
      ? 'border-blue-400/60 bg-blue-500/10 shadow-[0_0_18px_rgba(59,130,246,0.35)] motion-safe:animate-pulse hover:bg-blue-500/20'
      : ''
  }`;

  return (
    <>
    <div className="relative z-50">
      <header
        ref={headerRef}
        className={`${isSticky ? 'fixed inset-x-0 top-0' : 'relative'} z-[120] border-b border-white/5 bg-neutral-950 md:bg-neutral-950/90 md:backdrop-blur-md`}
      >
        <div className="pt-[env(safe-area-inset-top,0px)]">
          <nav className="mx-auto flex min-h-[88px] max-w-7xl items-center justify-between px-4 py-4 sm:min-h-[96px] lg:px-8">
            <div className="flex items-center gap-3 lg:gap-x-10">
            <button
              type="button"
              onClick={() => navigate('HOME')}
              className="inline-flex items-center"
              aria-label="Go home"
            >
              <BrandLockup showText={false} logoClassName="h-12 w-12 sm:h-22 sm:w-22" />
            </button>

            <div className="hidden lg:flex lg:gap-x-3">
              <div
                className="relative"
                onMouseEnter={() => setIsGamesMenuOpen(true)}
                onMouseLeave={() => setIsGamesMenuOpen(false)}
              >
                <button
                  type="button"
                  onClick={() => setIsGamesMenuOpen((prev) => !prev)}
                  className="flex items-center gap-2 rounded-xl border border-transparent bg-zinc-900/50 px-4 py-2.5 text-sm font-semibold text-emerald-300 transition-colors hover:border-white/5 hover:bg-neutral-800 hover:text-white"
                  aria-expanded={isGamesMenuOpen}
                  aria-haspopup="menu"
                >
                  <UpgraderIcon className="h-4 w-4 text-emerald-300" />
                  Games
                  <ChevronDown className={`h-4 w-4 transition-transform ${isGamesMenuOpen ? 'rotate-180' : ''}`} />
                </button>
                <div
                  className={`absolute left-0 top-full mt-2 w-44 rounded-xl border border-white/10 bg-[#101216] p-1.5 shadow-2xl transition-all ${
                    isGamesMenuOpen ? 'visible opacity-100 translate-y-0' : 'invisible opacity-0 -translate-y-1'
                  }`}
                >
                  <button type="button" onClick={() => navigate('BOXES')} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold text-white hover:bg-white/5">
                    <Package className="h-4 w-4 text-orange-400" />
                    Boxes
                  </button>
                  <button type="button" onClick={() => navigate('PLINKO')} className="mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold text-white hover:bg-white/5">
                    <UpgraderIcon className="h-4 w-4 text-emerald-300" />
                    Upgrader
                  </button>
                </div>
              </div>
              <div className="relative">
                <button type="button" onClick={() => setIsRewardsMenuOpen((prev) => !prev)} className="relative flex items-center gap-2 rounded-xl border border-transparent bg-zinc-900/50 px-4 py-2.5 text-sm font-semibold text-purple-400 transition-colors hover:border-white/5 hover:bg-neutral-800" aria-expanded={isRewardsMenuOpen}>
                  <Sparkles className="h-4 w-4" />
                  Rewards
                  <ChevronDown className={`h-4 w-4 transition-transform ${isRewardsMenuOpen ? 'rotate-180' : ''}`} />
                  {questReadyCount > 0 ? <span className="absolute -right-1 -top-1 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-emerald-500 px-1 text-[10px] font-extrabold text-white">{questReadyCount}</span> : null}
                </button>
                <div className={`absolute left-0 top-full mt-2 w-48 rounded-xl border border-white/10 bg-[#101216] p-1.5 shadow-2xl transition-all ${isRewardsMenuOpen ? 'visible opacity-100 translate-y-0' : 'invisible opacity-0 -translate-y-1'}`}>
                  <button type="button" onClick={() => navigate('BONUSES')} className={dailySpinDesktopClass}>
                    <RefreshCw className={`h-4 w-4 text-blue-500 ${showDailySpinReady ? 'motion-safe:animate-spin' : ''}`} />
                    Daily Spin
                    {showDailySpinReady ? <span className="ml-auto rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-extrabold text-white">Ready</span> : null}
                  </button>
                  <button type="button" onClick={() => navigate('POLLS')} className="mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold text-white hover:bg-white/5"><BarChart3 className="h-4 w-4 text-cyan-300" />Polls</button>
                  <button type="button" onClick={() => navigate('REFERRALS')} className="mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold text-white hover:bg-white/5"><Users className="h-4 w-4 text-indigo-300" />Referrals</button>
                  <button type="button" onClick={() => navigate('LEADERBOARD')} className="mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold text-white hover:bg-white/5"><Trophy className="h-4 w-4 text-yellow-500" />Leaderboard</button>
                  <button type="button" onClick={() => navigate('QUESTS')} className="mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold text-white hover:bg-white/5"><Sparkles className="h-4 w-4 text-violet-300" />Quests {questReadyCount > 0 ? <span className="ml-auto rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-extrabold text-white">Ready</span> : claimedTodayCount > 0 ? <span className="ml-auto rounded-full bg-cyan-500/90 px-2 py-0.5 text-[10px] font-extrabold text-white">Claimed</span> : null}</button>
                </div>
              </div>
              <button onClick={() => navigate('LEADERBOARD')} className="flex items-center gap-2 rounded-xl border border-transparent bg-zinc-900/50 px-4 py-2.5 text-sm font-semibold text-neutral-400 transition-colors hover:border-white/5 hover:bg-neutral-800 hover:text-white">
                <Trophy className="h-4 w-4" />
                Leaderboard
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {isAuthenticated ? (
              <>
                <div className="hidden items-center gap-2 lg:flex">
                  <div className="flex items-center gap-1.5 rounded-lg border border-amber-500/20 bg-[#18181b] px-2.5 py-1.5">
                    <img src={XP_ICON} alt="XP" className="h-5 w-5 object-contain" />
                    <span className="text-xs font-bold text-white"><AnimatedNumber value={targetXp} /></span>
                  </div>
                  <div className={`relative overflow-hidden rounded-lg p-[1px] ${balanceTone === 'up' ? 'shadow-[0_0_20px_rgba(34,197,94,0.35)]' : balanceTone === 'down' ? 'shadow-[0_0_20px_rgba(239,68,68,0.35)]' : ''}`}>
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-0 rounded-lg bg-[conic-gradient(from_0deg,_#3b82f6,_#6366f1,_#8b5cf6,_#6366f1,_#3b82f6)] animate-[spin_10s_linear_infinite]"
                    />
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-[1px] rounded-[7px] bg-[#18181b]"
                    />
                    <div className="relative z-10 flex items-center gap-2 rounded-lg border border-indigo-500/20 bg-[#18181b] pl-3 pr-1.5 py-1.5">
                      <CoinAmount amount={balance} className="text-white text-sm font-bold" iconClassName="h-4 w-4" formatOptions={{ maximumFractionDigits: 0 }} />
                      <button
                        onClick={() => {
                          playSound('click');
                          setShowTopUpModal(true);
                        }}
                        className="flex h-7 w-7 items-center justify-center rounded-md bg-indigo-600 text-white transition-colors hover:bg-indigo-500"
                        aria-label="Top up"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="hidden items-center gap-2 lg:flex">
                  <ProvablyFairBadge data={provablyData} />
                  <button
                    type="button"
                    onClick={() => setShowActivity(true)}
                    className="relative rounded-lg border border-white/10 bg-zinc-900 p-2 text-gray-200 hover:text-white"
                    aria-label="Open activity"
                  >
                    <Clock3 className="h-4 w-4" />
                    {unreadCount > 0 ? <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-cyan-300" /> : null}
                  </button>
                </div>

                <div className="hidden items-center gap-2 border-l border-white/10 pl-2 lg:flex">
                  {user.isAdmin && (
                    <button onClick={() => navigate('ADMIN')} className="hidden items-center gap-2 rounded-lg border border-indigo-500/20 bg-indigo-600/10 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-indigo-400 transition-colors hover:bg-indigo-600 hover:text-white xl:flex">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      Admin
                    </button>
                  )}
                  <button onClick={() => navigate('PROFILE')} className="text-right">
                    <span className="block text-sm font-bold text-white hover:text-indigo-400">{user.name}</span>
                  </button>
                  <button type="button" onClick={() => navigate('PROFILE')}>
                    <img src={user.avatar} alt={user.name} className="h-9 w-9 rounded-lg border border-white/10 object-cover" />
                  </button>
                  <button
                    onClick={() => {
                      playSound('click');
                      logout();
                    }}
                    className="rounded-lg border border-white/10 bg-zinc-900 p-2 text-gray-300 hover:bg-zinc-800 hover:text-white"
                    aria-label="Log out"
                  >
                    <LogOut className="h-4 w-4" />
                  </button>
                </div>
              </>
            ) : (
              <div className="hidden items-center gap-3 lg:flex">{authButtons}</div>
            )}

            {!isAuthenticated && <div className="flex items-center gap-2 lg:hidden">{authButtons}</div>}

            {isAuthenticated && (
              <div className="flex items-center gap-2 lg:hidden">
                <div className="flex items-center gap-1.5 rounded-md border border-amber-500/20 bg-[#18181b] px-2.5 py-1.5 sm:px-3">
                  <img src={XP_ICON} alt="XP" className="h-4 w-4 object-contain" />
                  <span className="text-xs font-bold text-white sm:text-sm"><AnimatedNumber value={targetXp} /></span>
                </div>
                <div className="relative overflow-hidden rounded-md p-[1px]">
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 rounded-md bg-[conic-gradient(from_0deg,_#3b82f6,_#6366f1,_#8b5cf6,_#6366f1,_#3b82f6)] animate-[spin_10s_linear_infinite]"
                  />
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-[1px] rounded-[5px] bg-[#18181b]"
                  />
                  <button
                    onClick={() => {
                      playSound('click');
                      setShowTopUpModal(true);
                    }}
                    className="relative z-10 flex items-center gap-1.5 rounded-md border border-indigo-500/20 bg-[#18181b] pl-2.5 pr-1.5 py-1.5 sm:pl-3"
                  >
                    <CoinAmount amount={balance} className="text-xs font-bold text-white sm:text-sm" iconClassName="h-4 w-4" formatOptions={{ maximumFractionDigits: 0 }} />
                    <span className="rounded bg-indigo-600 p-1"><Plus className="h-3.5 w-3.5" /></span>
                  </button>
                </div>
              </div>
            )}

            </div>
          </nav>
        </div>
      </header>

      <button
        type="button"
        onClick={() => setIsMobileMenuOpen(false)}
        className={`fixed inset-x-0 bottom-0 z-40 bg-black/80 transition-opacity duration-300 ease-out lg:hidden ${
          isSticky ? 'top-[var(--pullz-header-height)]' : 'top-0'
        } ${isMobileMenuOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'}`}
        aria-label="Close menu overlay"
      />

      <div
        className={`fixed inset-x-0 bottom-0 z-50 w-full overflow-y-auto bg-[#09090b] px-4 py-4 transition-all duration-300 ease-out lg:hidden ${
          isSticky ? 'top-[var(--pullz-header-height)]' : 'top-0'
        } ${
          isMobileMenuOpen ? 'translate-x-0 opacity-100' : 'pointer-events-none translate-x-full opacity-0'
        }`}
      >
        <div className="flex flex-col gap-6 pb-20">
          {isAuthenticated ? (
            <div className="grid grid-cols-2 gap-3">
              <>
                <button onClick={() => navigate('PROFILE')} className="flex items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3.5 font-bold text-white"><UserIcon className="h-5 w-5" />Account</button>
                <button onClick={() => { playSound('click'); setIsMobileMenuOpen(false); logout(); }} className="flex items-center justify-center gap-2 rounded-xl border border-white/5 bg-[#18181b] py-3.5 font-bold text-white"><LogOut className="h-5 w-5 text-neutral-400" />Log out</button>
              </>
            </div>
          ) : null}

          {user.isAdmin && (
            <button onClick={() => navigate('ADMIN')} className="flex w-full items-center justify-center gap-2 rounded-xl border border-indigo-500/30 bg-indigo-900/40 py-3 font-bold text-indigo-400">
              <ShieldCheck className="h-5 w-5" />
              Access Admin Panel
            </button>
          )}

          <section className="space-y-3">
            <h3 className="ml-1 text-xs font-bold uppercase tracking-wider text-neutral-500">Games</h3>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => navigate('BOXES')} className={drawerCardClass}><Package className="h-5 w-5 text-orange-500" /><span className="text-sm font-bold text-white">Boxes</span></button>
              <button onClick={() => navigate('PLINKO')} className={drawerCardClass}><UpgraderIcon className="h-5 w-5 text-emerald-400" /><span className="text-sm font-bold text-white">Upgrader</span></button>
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="ml-1 text-xs font-bold uppercase tracking-wider text-neutral-500">Rewards</h3>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => navigate('BONUSES')} className={dailySpinMobileClass}>
                <RefreshCw className={`h-5 w-5 text-blue-500 ${showDailySpinReady ? 'motion-safe:animate-spin' : ''}`} />
                <span className="text-sm font-bold text-white">Daily Spin</span>
                {showDailySpinReady ? <span className="ml-auto rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-extrabold text-white">Ready</span> : null}
              </button>
              <button onClick={() => navigate('POLLS')} className={drawerCardClass}><BarChart3 className="h-5 w-5 text-cyan-300" /><span className="text-sm font-bold text-white">Polls</span></button>
              <button onClick={() => navigate('REFERRALS')} className={drawerCardClass}><Users className="h-5 w-5 text-indigo-300" /><span className="text-sm font-bold text-white">Referrals</span></button>
              <button onClick={() => navigate('LEADERBOARD')} className={drawerCardClass}><Trophy className="h-5 w-5 text-yellow-500" /><span className="text-sm font-bold text-white">Leaderboard</span></button>
              <button onClick={() => navigate('QUESTS')} className={`${drawerCardClass} relative`}><Sparkles className="h-5 w-5 text-violet-300" /><span className="text-sm font-bold text-white">Quests</span>{questReadyCount > 0 ? <span className="absolute right-2 top-2 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-emerald-500 px-1 text-[10px] font-extrabold text-white">{questReadyCount}</span> : claimedTodayCount > 0 ? <span className="absolute right-2 top-2 inline-flex items-center justify-center rounded-full bg-cyan-500/90 px-2 py-0.5 text-[10px] font-extrabold text-white">Claimed</span> : null}</button>
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="ml-1 text-xs font-bold uppercase tracking-wider text-neutral-500">Learn</h3>
            <div className="grid grid-cols-2 gap-3">
              <button disabled className={`${drawerCardClass} cursor-not-allowed opacity-70`}><PenTool className="h-5 w-5 text-neutral-400" /><span className="text-sm font-bold text-white">Blog</span></button>
              <button disabled className={`${drawerCardClass} cursor-not-allowed opacity-70`}><HelpCircle className="h-5 w-5 text-neutral-400" /><span className="text-sm font-bold text-white">FAQ</span></button>
            </div>
            <button onClick={() => navigate('PROVABLY_FAIR')} className={`${drawerCardClass} w-full`}><Shield className="h-5 w-5 text-green-500" /><span className="text-sm font-bold text-white">Fairness</span></button>
          </section>

          <section className="space-y-3">
            <h3 className="ml-1 text-xs font-bold uppercase tracking-wider text-neutral-500">Info and Support</h3>
            {isAuthenticated && (
              <button
                onClick={() => {
                  playSound('click');
                  setIsMobileMenuOpen(false);
                  setShowActivity(true);
                }}
                className={`${drawerCardClass} w-full`}
              >
                <div className="relative">
                  <Clock3 className="h-5 w-5 text-cyan-300" />
                  {unreadCount > 0 ? <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-cyan-300" /> : null}
                </div>
                <div className="flex min-w-0 flex-col items-start">
                  <span className="text-sm font-bold text-white">History</span>
                  <span className="text-xs text-neutral-400">Recent opens, sells, and shipping</span>
                </div>
              </button>
            )}
            <button onClick={() => navigate('CONTACT')} className={`${drawerCardClass} w-full`}><LifeBuoy className="h-5 w-5 text-white" /><span className="text-sm font-bold text-white">Support</span></button>
          </section>

          <section className="mt-2 flex flex-col items-center gap-6">
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500">Social Media</h3>
            <div className="flex items-center gap-6 text-white">
              <a href="#" aria-label="Facebook"><Facebook className="h-6 w-6" /></a>
              <a href="#" aria-label="Instagram"><Instagram className="h-6 w-6" /></a>
              <a href="#" aria-label="Youtube"><Youtube className="h-6 w-6" /></a>
              <a href="#" aria-label="Twitter"><Twitter className="h-6 w-6" /></a>
            </div>
            <div className="flex flex-col items-center gap-3 text-xs font-bold text-neutral-500">
              <div className="flex items-center gap-4">
                <button onClick={() => navigate('TERMS')} className="hover:text-white">Terms of Service</button>
                <span>|</span>
                <button onClick={() => navigate('PRIVACY')} className="hover:text-white">Privacy Policy</button>
              </div>
              <button disabled className="cursor-not-allowed opacity-70">AML &amp; KYC Policy</button>
            </div>
          </section>
        </div>
      </div>
    </div>
    <ActivityDrawer open={showActivity} onClose={() => setShowActivity(false)} />
    <style>{`@media (prefers-reduced-motion: reduce){.ambient-pulse{animation:none!important;}}`}</style>
    </>
  );
};
