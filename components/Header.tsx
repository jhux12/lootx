import React, { Suspense, lazy, memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatedNumber } from '../src/ui/numbers/AnimatedNumber';
import {
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
  ShieldCheck,
  Trophy,
  User as UserIcon,
  Users,
  X
} from 'lucide-react';
import { useGame } from '../context/GameContext';
import { useSound } from '../context/SoundContext';
import { CoinAmount } from './CoinAmount';
import { BrandLockup } from './BrandLockup';
import { XP_ICON } from '../constants';
import { useBalanceFeedback } from '../src/ui/feedback/useBalanceFeedback';
import { useUnreadActivityCount } from '../src/lib/activity/useActivity';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { getClaimReadyQuestCount, normalizeQuestRules } from '../src/lib/quests';
import { UserAvatar } from './UserAvatar';
import { resolveUserDisplayName } from '../utils/userIdentity';

const ActivityDrawer = lazy(() => import('../src/ui/activity/ActivityDrawer').then((module) => ({ default: module.ActivityDrawer })));

type HeaderProps = {
  onOpenInbox: () => void;
  unreadChatCount?: number;
  isSticky?: boolean;
};

const UpgraderIcon: React.FC<{ className?: string }> = ({ className }) => (
  <i className={`fa-brands fa-superpowers ${className ?? ''}`.trim()} aria-hidden="true" />
);
const GamesIcon: React.FC<{ className?: string }> = ({ className }) => (
  <i className={`fa-solid fa-box-open ${className ?? ''}`.trim()} aria-hidden="true" />
);
const RewardsIcon: React.FC<{ className?: string }> = ({ className }) => (
  <i className={`fa-solid fa-gem ${className ?? ''}`.trim()} aria-hidden="true" />
);

const drawerCardClass =
  'flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.055] p-3 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition-all duration-200 hover:-translate-y-0.5 hover:border-cyan-300/20 hover:bg-white/[0.085]';

type RewardsSettingsData = Record<string, unknown> | undefined;

const HeaderSkeleton: React.FC = memo(() => (
  <div className="flex min-h-[44px] items-center gap-2" aria-hidden="true">
    <div className="hidden h-8 w-[68px] rounded-full border border-white/10 bg-white/[0.045] lg:block" />
    <div className="h-9 w-[112px] rounded-full bg-white/[0.06] sm:w-[126px] lg:h-10 lg:w-[140px]" />
    <div className="hidden h-9 w-[156px] rounded-full bg-white/[0.045] lg:block" />
    <div className="h-10 w-10 rounded-2xl bg-white/[0.06] lg:hidden" />
  </div>
));
HeaderSkeleton.displayName = 'HeaderSkeleton';

const HeaderComponent: React.FC<HeaderProps> = ({ onOpenInbox: _onOpenInbox, unreadChatCount: _unreadChatCount, isSticky = true }) => {
  const {
    user,
    authInitialized,
    balance,
    setView,
    isAuthenticated,
    openAuthModal,
    setShowTopUpModal,
    logout,
    boxes
  } = useGame();
  const { playSound } = useSound();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isGamesMenuOpen, setIsGamesMenuOpen] = useState(false);
  const [isRewardsMenuOpen, setIsRewardsMenuOpen] = useState(false);
  const [questReadyCount, setQuestReadyCount] = useState(0);
  const [claimedTodayCount, setClaimedTodayCount] = useState(0);
  const [locallyClaimedQuestIds, setLocallyClaimedQuestIds] = useState<Record<string, string>>({});
  const [showActivity, setShowActivity] = useState(false);
  const [isFreeBoxTooltipDismissed, setIsFreeBoxTooltipDismissed] = useState(false);
  const [openMobileSections, setOpenMobileSections] = useState({
    games: true,
    rewards: false,
    learn: false,
    support: false,
    social: false
  });
  const headerRef = useRef<HTMLElement | null>(null);
  const gamesMenuRef = useRef<HTMLDivElement | null>(null);
  const rewardsMenuRef = useRef<HTMLDivElement | null>(null);
  const targetXp = useMemo(() => Math.floor(user.xpBalance ?? user.xp ?? 0), [user.xp, user.xpBalance]);
  const resolvedDisplayName = useMemo(() => (authInitialized ? resolveUserDisplayName(user) : ''), [authInitialized, user]);
  const balanceTone = useBalanceFeedback(balance, isAuthenticated);
  const unreadCount = useUnreadActivityCount();
  const lastDailyClaim = useMemo(() => Number.isFinite(user.lastDailyClaim ?? NaN) ? Number(user.lastDailyClaim) : 0, [user.lastDailyClaim]);
  const isDailySpinReady = useMemo(() => {
    const dailyCooldownMs = 24 * 60 * 60 * 1000;
    return !lastDailyClaim || (lastDailyClaim + dailyCooldownMs) <= Date.now();
  }, [lastDailyClaim]);
  const showDailySpinReady = isAuthenticated && isDailySpinReady;
  const hasDailyBox = useMemo(() => boxes.some((box) => box.isDaily), [boxes]);
  const hasFreeSignupBox = isAuthenticated && hasDailyBox && !user.lastFreeBoxClaim;
  const showFreeBoxTooltip = hasFreeSignupBox && !isFreeBoxTooltipDismissed;
  const [rewardsSettings, setRewardsSettings] = useState<RewardsSettingsData>();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setIsFreeBoxTooltipDismissed(window.sessionStorage.getItem('pullz:free-box-tooltip-dismissed') === '1');
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const handleDocumentClick = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (!target) return;

      if (isGamesMenuOpen && gamesMenuRef.current && !gamesMenuRef.current.contains(target)) {
        setIsGamesMenuOpen(false);
      }
      if (isRewardsMenuOpen && rewardsMenuRef.current && !rewardsMenuRef.current.contains(target)) {
        setIsRewardsMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleDocumentClick);
    document.addEventListener('touchstart', handleDocumentClick);
    return () => {
      document.removeEventListener('mousedown', handleDocumentClick);
      document.removeEventListener('touchstart', handleDocumentClick);
    };
  }, [isGamesMenuOpen, isRewardsMenuOpen]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const openMobileMenu = () => {
      setIsMobileMenuOpen(true);
    };

    const closeMobileMenu = () => {
      setIsMobileMenuOpen(false);
    };

    const toggleMobileMenu = () => {
      setIsMobileMenuOpen((prev) => !prev);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsMobileMenuOpen(false);
      }
    };

    window.addEventListener('pullz:open-mobile-menu', openMobileMenu);
    window.addEventListener('pullz:close-mobile-menu', closeMobileMenu);
    window.addEventListener('pullz:toggle-mobile-menu', toggleMobileMenu);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('pullz:open-mobile-menu', openMobileMenu);
      window.removeEventListener('pullz:close-mobile-menu', closeMobileMenu);
      window.removeEventListener('pullz:toggle-mobile-menu', toggleMobileMenu);
      window.removeEventListener('keydown', handleKeyDown);
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
    if (!isAuthenticated) {
      setRewardsSettings(undefined);
      return;
    }
    const unsub = onSnapshot(doc(db, 'settings', 'rewards'), (snap) => {
      setRewardsSettings(snap.data() as RewardsSettingsData);
    }, (error) => {
      console.error('Rewards settings snapshot failed', error);
    });
    return () => unsub();
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) {
      setQuestReadyCount((current) => (current === 0 ? current : 0));
      setClaimedTodayCount((current) => (current === 0 ? current : 0));
      return;
    }

    const today = new Date().toISOString().slice(0, 10);
    const claims = { ...(user.questClaims ?? {}), ...locallyClaimedQuestIds };
    const stats = user.challengeStatsDay === today ? (user.challengeStats ?? {}) : {};
    const rules = normalizeQuestRules(rewardsSettings?.questRules);
    const count = getClaimReadyQuestCount(rules, stats, claims, today);
    const claimedCount = rules.filter((rule) => rule.enabled !== false && claims?.[rule.id] === today).length;

    setQuestReadyCount((current) => (current === count ? current : count));
    setClaimedTodayCount((current) => (current === claimedCount ? current : claimedCount));
  }, [isAuthenticated, locallyClaimedQuestIds, rewardsSettings, user.challengeStats, user.challengeStatsDay, user.questClaims]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const handleQuestClaimed = (event: Event) => {
      const customEvent = event as CustomEvent<{ questId?: string; day?: string }>;
      const questId = customEvent.detail?.questId;
      const day = customEvent.detail?.day;
      if (!questId || !day) return;
      setLocallyClaimedQuestIds((prev) => (prev[questId] === day ? prev : { ...prev, [questId]: day }));
    };

    window.addEventListener('pullz:quest-claimed', handleQuestClaimed as EventListener);
    return () => {
      window.removeEventListener('pullz:quest-claimed', handleQuestClaimed as EventListener);
    };
  }, []);

  const navigate = useCallback((type: 'HOME' | 'BOXES' | 'PLINKO' | 'BONUSES' | 'LEADERBOARD' | 'QUESTS' | 'POLLS' | 'REFERRALS' | 'PROVABLY_FAIR' | 'CONTACT' | 'TERMS' | 'PRIVACY' | 'PROFILE' | 'ADMIN' | 'INVENTORY') => {
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
  }, [isAuthenticated, openAuthModal, playSound, setView]);

  const openTopUp = useCallback(() => {
    playSound('click');
    setShowTopUpModal(true);
  }, [playSound, setShowTopUpModal]);

  const openActivity = useCallback(() => setShowActivity(true), []);

  const handleLogout = useCallback(() => {
    playSound('click');
    logout();
  }, [logout, playSound]);

  const startPullingButton = useMemo(() => (
    <button
      type="button"
      onClick={() => {
        playSound('click');
        openAuthModal('register');
      }}
      className="group relative inline-flex shrink-0 overflow-hidden rounded-full border border-white/10 bg-white/[0.03] p-px shadow-[0_12px_30px_rgba(0,0,0,0.32)] outline-none transition-all duration-200 hover:-translate-y-0.5 hover:border-cyan-300/30 focus-visible:ring-2 focus-visible:ring-cyan-200/80 focus-visible:ring-offset-2 focus-visible:ring-offset-black active:translate-y-0"
      aria-label="Start Pulling"
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-[-120%] bg-[conic-gradient(from_120deg,_rgba(255,56,92,0.55),_rgba(59,130,246,0.38),_rgba(45,212,191,0.42),_rgba(255,56,92,0.55))] opacity-70 motion-safe:animate-[spin_6s_linear_infinite]"
      />
      <span className="relative z-10 inline-flex items-center justify-center rounded-full bg-[#05080c] px-4 py-2 text-sm font-extrabold leading-none tracking-tight text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] sm:px-5 sm:py-2.5 sm:text-base lg:px-4 lg:py-2.5 lg:text-sm xl:text-sm">
        <span className="whitespace-nowrap">Start Pulling</span>
      </span>
    </button>
  ), [openAuthModal, playSound]);

  const dailySpinDesktopClass = `group relative flex w-full items-center gap-2 overflow-hidden rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-white transition-all duration-200 ${
    showDailySpinReady
      ? 'border border-blue-400/50 bg-blue-500/10 shadow-[0_0_16px_rgba(59,130,246,0.25)] hover:bg-blue-500/20'
      : 'hover:bg-white/[0.07] hover:text-cyan-100'
  }`;

  const dailySpinMobileClass = `${drawerCardClass} group relative overflow-hidden transition-all ${
    showDailySpinReady
      ? 'border-blue-400/50 bg-blue-500/10 shadow-[0_0_16px_rgba(59,130,246,0.25)] hover:bg-blue-500/20'
      : ''
  }`;
  const rewardsDesktopTabClass = `group relative flex h-10 items-center gap-2 overflow-hidden rounded-full border px-3.5 text-sm font-semibold transition-all duration-200 ${
    showDailySpinReady
      ? 'border-blue-300/45 bg-blue-500/10 text-blue-100 shadow-[0_0_18px_rgba(59,130,246,0.24)] hover:bg-blue-500/20'
      : 'border-transparent text-slate-200 hover:border-white/10 hover:bg-white/[0.07] hover:text-white'
  }`;
  const rewardsMobileTabClass = `group relative flex w-full items-center justify-between overflow-hidden rounded-xl border px-3 py-3 text-left transition-all ${
    showDailySpinReady
      ? 'border-blue-300/45 bg-blue-500/10 shadow-[0_0_18px_rgba(59,130,246,0.22)] hover:bg-blue-500/20'
      : 'border-white/10 bg-white/[0.045] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] hover:bg-white/[0.075]'
  }`;

  const navButtonClass = 'flex h-10 items-center gap-2 rounded-full border border-transparent px-3.5 text-sm font-semibold text-slate-200 transition-all duration-200 hover:border-white/10 hover:bg-white/[0.07] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#070b10]';
  const dropdownPanelClass = 'absolute left-0 top-full mt-3 w-52 rounded-2xl border border-white/10 bg-[#0d141c]/95 p-2 shadow-[0_24px_70px_rgba(0,0,0,0.5)] ring-1 ring-cyan-200/5 backdrop-blur-xl transition-all duration-200';
  const dropdownItemClass = 'mt-1 flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-slate-100 transition-all duration-200 hover:bg-white/[0.07] hover:text-white';
  const metricPillClass = 'inline-flex h-10 items-center rounded-full border border-white/10 bg-white/[0.045] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_10px_26px_rgba(0,0,0,0.22)] backdrop-blur';
  const iconButtonClass = 'relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.045] text-slate-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] transition-all duration-200 hover:-translate-y-0.5 hover:border-cyan-300/25 hover:bg-white/[0.08] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#070b10]';

  const toggleMobileSection = useCallback((section: keyof typeof openMobileSections) => {
    setOpenMobileSections((prev) => ({ ...prev, [section]: !prev[section] }));
  }, []);

  const dismissFreeBoxTooltip = useCallback(() => {
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem('pullz:free-box-tooltip-dismissed', '1');
    }
    setIsFreeBoxTooltipDismissed(true);
  }, []);

  return (
    <>
    <div className="relative z-[140]">
      <header
        ref={headerRef}
        className={`${isSticky ? 'fixed inset-x-0 top-0' : 'relative'} z-[120] border-b border-white/10 bg-[#05080d]/72 shadow-[0_18px_60px_rgba(0,0,0,0.22)] backdrop-blur-2xl supports-[backdrop-filter]:bg-[#05080d]/58`}
      >
        <div className="pt-[env(safe-area-inset-top,0px)]">
          <nav className="mx-auto flex h-[66px] max-w-7xl items-center justify-between px-3 sm:h-[70px] sm:px-4 lg:px-8">
            <div className="flex min-w-0 items-center gap-2.5 lg:gap-x-7">
            <button
              type="button"
              onClick={() => navigate('HOME')}
              className="inline-flex shrink-0 items-center rounded-2xl transition-transform duration-200 hover:scale-[1.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200/60"
              aria-label="Go home"
            >
              <BrandLockup showText={false} logoClassName="h-10 w-10 sm:h-11 sm:w-11" />
            </button>

            <div className="hidden items-center rounded-full border border-white/10 bg-white/[0.035] p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur lg:flex lg:gap-x-1">
              <div
                ref={gamesMenuRef}
                className="relative"
              >
                <button
                  type="button"
                  onClick={() => {
                    setIsGamesMenuOpen((prev) => !prev);
                    setIsRewardsMenuOpen(false);
                  }}
                  className={navButtonClass}
                  aria-expanded={isGamesMenuOpen}
                  aria-haspopup="menu"
                >
                  <GamesIcon className="h-4 w-4 text-white" />
                  Games
                  <ChevronDown className={`h-4 w-4 transition-transform ${isGamesMenuOpen ? 'rotate-180' : ''}`} />
                </button>
                <div
                  className={`${dropdownPanelClass} ${
                    isGamesMenuOpen ? 'visible translate-y-0 opacity-100' : 'invisible -translate-y-1 opacity-0'
                  }`}
                >
                  <button type="button" onClick={() => navigate('BOXES')} className={`${dropdownItemClass} mt-0`}>
                    <Package className="h-4 w-4 text-orange-400" />
                    Boxes
                  </button>
                  <button type="button" onClick={() => navigate('PLINKO')} className={dropdownItemClass}>
                    <UpgraderIcon className="h-4 w-4 text-emerald-300" />
                    Upgrader
                  </button>
                </div>
              </div>
              <div ref={rewardsMenuRef} className="relative">
                <button type="button" onClick={() => {
                  setIsRewardsMenuOpen((prev) => !prev);
                  setIsGamesMenuOpen(false);
                }} className={rewardsDesktopTabClass} aria-expanded={isRewardsMenuOpen}>
                  {showDailySpinReady ? <span aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[linear-gradient(110deg,transparent_18%,rgba(96,165,250,0.25)_50%,transparent_82%)] motion-safe:animate-[pulse_2.2s_ease-in-out_infinite]" /> : null}
                  <RewardsIcon className={`relative z-10 h-4 w-4 ${showDailySpinReady ? 'motion-safe:animate-pulse text-blue-200' : 'text-white'}`} />
                  Rewards
                  <ChevronDown className={`h-4 w-4 transition-transform ${isRewardsMenuOpen ? 'rotate-180' : ''}`} />
                  {questReadyCount > 0 ? <span className="absolute -right-1 -top-1 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-emerald-500 px-1 text-[10px] font-extrabold text-white">{questReadyCount}</span> : null}
                </button>
                <div className={`${dropdownPanelClass} ${isRewardsMenuOpen ? 'visible translate-y-0 opacity-100' : 'invisible -translate-y-1 opacity-0'}`}>
                  <button type="button" onClick={() => navigate('BONUSES')} className={dailySpinDesktopClass}>
                    <RefreshCw className="h-4 w-4 text-blue-500" />
                    Daily Spin
                    {showDailySpinReady ? <span className="ml-auto rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-extrabold text-white">Ready</span> : null}
                  </button>
                  <button type="button" onClick={() => navigate('POLLS')} className={dropdownItemClass}><BarChart3 className="h-4 w-4 text-cyan-300" />Polls</button>
                  <button type="button" onClick={() => navigate('REFERRALS')} className={dropdownItemClass}><Users className="h-4 w-4 text-blue-300" />Referrals</button>
                  <button type="button" onClick={() => navigate('LEADERBOARD')} className={dropdownItemClass}><Trophy className="h-4 w-4 text-white" />Leaderboard</button>
                  <button type="button" onClick={() => navigate('QUESTS')} className={dropdownItemClass}><Sparkles className="h-4 w-4 text-blue-300" />Quests {questReadyCount > 0 ? <span className="ml-auto rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-extrabold text-white">Ready</span> : claimedTodayCount > 0 ? <span className="ml-auto rounded-full bg-cyan-500/90 px-2 py-0.5 text-[10px] font-extrabold text-white">Claimed</span> : null}</button>
                </div>
              </div>
              <button onClick={() => navigate('LEADERBOARD')} className={navButtonClass}>
                <Trophy className="h-4 w-4 text-white" />
                Leaderboard
              </button>
            </div>
          </div>

          <div className="flex min-h-[44px] min-w-0 items-center gap-1.5 sm:gap-2.5">
            {!authInitialized ? (
              <HeaderSkeleton />
            ) : isAuthenticated ? (
              <>
                <div className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/[0.025] p-1 lg:flex">
                  <div className={`${metricPillClass} gap-1.5 px-3`}>
                    <img src={XP_ICON} alt="XP" className="h-5 w-5 object-contain" width={20} height={20} />
                    <span className="min-w-[32px] text-xs font-bold tabular-nums text-white"><AnimatedNumber value={targetXp} /></span>
                  </div>
                  <div className={`relative min-w-[132px] shrink-0 overflow-hidden rounded-full border border-white/10 bg-white/[0.04] p-px shadow-[0_10px_28px_rgba(0,0,0,0.25)] ${balanceTone === 'up' ? 'border-emerald-300/35 shadow-[0_0_18px_rgba(34,197,94,0.22)]' : balanceTone === 'down' ? 'border-rose-300/35 shadow-[0_0_18px_rgba(239,68,68,0.22)]' : ''}`}>
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-[-120%] bg-[conic-gradient(from_120deg,_rgba(255,56,92,0.5),_rgba(59,130,246,0.34),_rgba(45,212,191,0.38),_rgba(255,56,92,0.5))] opacity-70 motion-safe:animate-[spin_6s_linear_infinite]"
                    />
                    <div className="relative z-10 flex items-center justify-between gap-2 rounded-full bg-[#06090e] py-1 pl-3 pr-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
                      <CoinAmount amount={balance} className="min-w-[84px] text-sm font-extrabold leading-none tracking-tight text-white" iconClassName="h-4 w-4" textClassName="min-w-[56px] text-right tabular-nums" formatOptions={{ maximumFractionDigits: 0 }} />
                      <button
                        type="button"
                        onClick={openTopUp}
                        className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-black shadow-sm transition-all duration-200 hover:scale-105 hover:bg-cyan-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:ring-offset-2 focus-visible:ring-offset-black active:scale-95"
                        aria-label="Top up"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="hidden items-center gap-2 lg:flex">
                  <button
                    type="button"
                    onClick={openActivity}
                    className={iconButtonClass}
                    aria-label="Open activity"
                  >
                    <Clock3 className="h-4 w-4" />
                    {unreadCount > 0 ? <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-cyan-300" /> : null}
                  </button>
                </div>

                <div className="hidden items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.035] p-1 lg:flex">
                  {user.isAdmin && (
                    <button onClick={() => navigate('ADMIN')} className="hidden h-9 items-center gap-2 rounded-full border border-blue-300/25 bg-blue-500/10 px-3 text-xs font-bold uppercase tracking-wide text-blue-200 transition-all duration-200 hover:border-blue-200/45 hover:bg-blue-500/20 hover:text-white xl:flex">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      Admin
                    </button>
                  )}
                  <button onClick={() => navigate('PROFILE')} className="hidden max-w-[132px] px-2 text-right lg:block xl:min-w-[112px]">
                    <span className="block truncate text-sm font-bold text-white transition-colors hover:text-cyan-200">{resolvedDisplayName}</span>
                  </button>
                  <div className="relative flex items-center">
                    <button type="button" onClick={() => navigate('PROFILE')} className="h-9 w-9 rounded-full transition-transform duration-200 hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200/60">
                      <UserAvatar user={user} className="h-9 w-9 rounded-full object-cover ring-1 ring-white/10" initialsClassName="text-xs" />
                    </button>
                    {showFreeBoxTooltip ? (
                      <div className="absolute left-1/2 top-full z-30 mt-2 w-max -translate-x-1/2 rounded-md border border-emerald-400/35 bg-[#0f1517] px-2 py-1 text-[10px] font-semibold text-emerald-200 shadow-lg">
                        <div className="flex items-center gap-1.5">
                          <span>Free box available</span>
                          <button
                            type="button"
                            onClick={dismissFreeBoxTooltip}
                            className="rounded p-0.5 text-emerald-100/80 transition-colors hover:bg-white/10 hover:text-white"
                            aria-label="Dismiss free box tooltip"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                  <button
                    onClick={handleLogout}
                    className={iconButtonClass}
                    aria-label="Log out"
                  >
                    <LogOut className="h-4 w-4" />
                  </button>
                </div>
              </>
            ) : (
              <div className="hidden items-center lg:flex">{startPullingButton}</div>
            )}

            {authInitialized && !isAuthenticated && <div className="flex min-h-[44px] min-w-[132px] items-center lg:hidden">{startPullingButton}</div>}

            {authInitialized && isAuthenticated && (
              <div className="flex min-h-[44px] min-w-0 items-center gap-1.5 sm:gap-2 lg:hidden">
                <div className="flex h-9 min-w-[58px] items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.045] px-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] sm:min-w-[70px] sm:px-3">
                  <img src={XP_ICON} alt="XP" className="h-4 w-4 object-contain" width={16} height={16} />
                  <span className="min-w-[24px] text-xs font-bold tabular-nums text-white sm:min-w-[30px] sm:text-sm"><AnimatedNumber value={targetXp} /></span>
                </div>
                <div className="relative min-w-[112px] shrink-0 overflow-hidden rounded-full border border-white/10 bg-white/[0.04] p-px shadow-[0_10px_24px_rgba(0,0,0,0.24)] sm:min-w-[126px]">
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-[-120%] bg-[conic-gradient(from_120deg,_rgba(255,56,92,0.5),_rgba(59,130,246,0.34),_rgba(45,212,191,0.38),_rgba(255,56,92,0.5))] opacity-70 motion-safe:animate-[spin_6s_linear_infinite]"
                  />
                  <div className="relative z-10 flex items-center justify-between gap-1.5 rounded-full bg-[#06090e] py-1 pl-2.5 pr-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] sm:gap-2 sm:pl-3">
                    <CoinAmount amount={balance} className="min-w-[72px] text-xs font-extrabold leading-none tracking-tight text-white sm:min-w-[82px] sm:text-sm" iconClassName="h-4 w-4" textClassName="min-w-[44px] text-right tabular-nums sm:min-w-[52px]" formatOptions={{ maximumFractionDigits: 0 }} />
                    <button
                      type="button"
                      onClick={openTopUp}
                      className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-black shadow-sm transition-all duration-200 hover:scale-105 hover:bg-cyan-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:ring-offset-2 focus-visible:ring-offset-black active:scale-95 sm:h-7 sm:w-7"
                      aria-label="Top up"
                    >
                      <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    </button>
                  </div>
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
        className={`fixed inset-x-0 bottom-[var(--pullz-mobile-bottom-nav-height,72px)] z-40 bg-black/70 backdrop-blur-sm transition-opacity duration-300 ease-out lg:hidden ${
          isSticky ? 'top-[var(--pullz-header-height)]' : 'top-0'
        } ${isMobileMenuOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'}`}
        aria-label="Close menu overlay"
      />

      <div
        className={`fixed inset-x-0 bottom-[var(--pullz-mobile-bottom-nav-height,72px)] z-50 w-full overflow-y-auto overscroll-contain border-t border-white/10 bg-[#090f16]/96 px-4 pb-4 pt-3 shadow-[0_-24px_70px_rgba(0,0,0,0.45)] backdrop-blur-2xl transition-all duration-300 ease-out lg:hidden ${
          isSticky ? 'top-[var(--pullz-header-height)]' : 'top-0'
        } ${
          isMobileMenuOpen ? 'translate-x-0 opacity-100' : 'pointer-events-none translate-x-full opacity-0'
        }`}
        role="dialog"
        aria-modal="true"
        aria-label="Mobile navigation menu"
      >
        <div className="sticky top-0 z-10 -mx-4 mb-4 flex items-center justify-between border-b border-white/10 bg-[#090f16]/95 px-4 pb-3 pt-1 backdrop-blur">
          <span className="text-sm font-extrabold uppercase tracking-[0.18em] text-white">Menu</span>
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(false)}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-white transition-all duration-200 hover:border-cyan-300/25 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
            aria-label="Close mobile menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex flex-col gap-6 pb-4">
          {isAuthenticated ? (
            <div className="grid grid-cols-2 gap-3">
              <>
                <button onClick={() => navigate('PROFILE')} className="flex items-center justify-center gap-2 rounded-2xl border border-blue-300/25 bg-[#205DD7]/90 py-3.5 font-bold text-white shadow-[0_12px_30px_rgba(32,93,215,0.22)]"><UserIcon className="h-5 w-5" />Account</button>
                <button onClick={() => { playSound('click'); setIsMobileMenuOpen(false); logout(); }} className="flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.045] py-3.5 font-bold text-white"><LogOut className="h-5 w-5 text-neutral-400" />Log out</button>
              </>
            </div>
          ) : null}

          {user.isAdmin && (
            <button onClick={() => navigate('ADMIN')} className="flex w-full items-center justify-center gap-2 rounded-xl border border-blue-500/30 bg-blue-900/40 py-3 font-bold text-blue-400">
              <ShieldCheck className="h-5 w-5" />
              Access Admin Panel
            </button>
          )}

          <section className="space-y-3">
            <button type="button" onClick={() => toggleMobileSection('games')} className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-white/[0.045] px-3 py-3 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
              <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-white"><GamesIcon className="h-4 w-4 text-white" />Games</h3>
              <ChevronDown className={`h-4 w-4 text-neutral-400 transition-transform ${openMobileSections.games ? 'rotate-180' : ''}`} />
            </button>
            {openMobileSections.games ? (
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => navigate('BOXES')} className={drawerCardClass}><Package className="h-5 w-5 text-orange-500" /><span className="text-sm font-bold text-white">Boxes</span></button>
                <button onClick={() => navigate('PLINKO')} className={drawerCardClass}><UpgraderIcon className="h-5 w-5 text-emerald-400" /><span className="text-sm font-bold text-white">Upgrader</span></button>
              </div>
            ) : null}
          </section>

          <section className="space-y-3">
            <button type="button" onClick={() => toggleMobileSection('rewards')} className={rewardsMobileTabClass}>
              {showDailySpinReady ? <span aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[linear-gradient(110deg,transparent_20%,rgba(96,165,250,0.25)_50%,transparent_82%)] motion-safe:animate-[pulse_2.2s_ease-in-out_infinite]" /> : null}
              <h3 className={`relative z-10 flex items-center gap-2 text-xs font-bold uppercase tracking-wider ${showDailySpinReady ? 'text-blue-100' : 'text-white'}`}><RewardsIcon className={`h-4 w-4 ${showDailySpinReady ? 'text-blue-200' : 'text-white'}`} />Rewards</h3>
              <div className="relative z-10 flex items-center gap-2">
                <ChevronDown className={`h-4 w-4 transition-transform ${openMobileSections.rewards ? 'rotate-180' : ''} ${showDailySpinReady ? 'text-blue-200' : 'text-neutral-400'}`} />
              </div>
            </button>
            {openMobileSections.rewards ? (
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => navigate('BONUSES')} className={dailySpinMobileClass}>
                  <RefreshCw className="h-5 w-5 text-blue-500" />
                  <span className="text-sm font-bold text-white">Daily Spin</span>
                  {showDailySpinReady ? <span className="ml-auto rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-extrabold text-white">Ready</span> : null}
                </button>
                <button onClick={() => navigate('POLLS')} className={drawerCardClass}><BarChart3 className="h-5 w-5 text-cyan-300" /><span className="text-sm font-bold text-white">Polls</span></button>
                <button onClick={() => navigate('REFERRALS')} className={drawerCardClass}><Users className="h-5 w-5 text-blue-300" /><span className="text-sm font-bold text-white">Referrals</span></button>
                <button onClick={() => navigate('LEADERBOARD')} className={drawerCardClass}><Trophy className="h-5 w-5 text-white" /><span className="text-sm font-bold text-white">Leaderboard</span></button>
                <button onClick={() => navigate('QUESTS')} className={`${drawerCardClass} relative`}><Sparkles className="h-5 w-5 text-blue-300" /><span className="text-sm font-bold text-white">Quests</span>{questReadyCount > 0 ? <span className="absolute right-2 top-2 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-emerald-500 px-1 text-[10px] font-extrabold text-white">{questReadyCount}</span> : claimedTodayCount > 0 ? <span className="absolute right-2 top-2 inline-flex items-center justify-center rounded-full bg-cyan-500/90 px-2 py-0.5 text-[10px] font-extrabold text-white">Claimed</span> : null}</button>
              </div>
            ) : null}
          </section>

          <section className="space-y-3">
            <button type="button" onClick={() => toggleMobileSection('learn')} className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-white/[0.045] px-3 py-3 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
              <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500">Learn</h3>
              <ChevronDown className={`h-4 w-4 text-neutral-400 transition-transform ${openMobileSections.learn ? 'rotate-180' : ''}`} />
            </button>
            {openMobileSections.learn ? (
              <div className="grid grid-cols-2 gap-3">
                <button disabled className={`${drawerCardClass} cursor-not-allowed opacity-70`}><PenTool className="h-5 w-5 text-neutral-400" /><span className="text-sm font-bold text-white">Blog</span></button>
                <button disabled className={`${drawerCardClass} cursor-not-allowed opacity-70`}><HelpCircle className="h-5 w-5 text-neutral-400" /><span className="text-sm font-bold text-white">FAQ</span></button>
              </div>
            ) : null}
          </section>

          <section className="space-y-3">
            <button type="button" onClick={() => toggleMobileSection('support')} className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-white/[0.045] px-3 py-3 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
              <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500">Info and Support</h3>
              <ChevronDown className={`h-4 w-4 text-neutral-400 transition-transform ${openMobileSections.support ? 'rotate-180' : ''}`} />
            </button>
            {openMobileSections.support ? (
              <>
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
              </>
            ) : null}
          </section>

          <section className="mt-2 flex flex-col items-center gap-6">
            <button type="button" onClick={() => toggleMobileSection('social')} className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-white/[0.045] px-3 py-3 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
              <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500">Social Media</h3>
              <ChevronDown className={`h-4 w-4 text-neutral-400 transition-transform ${openMobileSections.social ? 'rotate-180' : ''}`} />
            </button>
            {openMobileSections.social ? (
              <>
                <div className="flex w-full justify-center text-white">
                  <a
                    href="https://www.instagram.com/pullz.gg/"
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Follow Pullz.gg on Instagram"
                    className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.055] transition-all duration-200 hover:-translate-y-0.5 hover:border-cyan-300/25 hover:bg-white/[0.085] focus:outline-none focus:ring-2 focus:ring-cyan-300/70"
                  >
                    <Instagram className="h-6 w-6" />
                  </a>
                </div>
                <div className="flex flex-col items-center gap-3 text-xs font-bold text-neutral-500">
                  <div className="flex items-center gap-4">
                    <button onClick={() => navigate('TERMS')} className="hover:text-white">Terms of Service</button>
                    <span>|</span>
                    <button onClick={() => navigate('PRIVACY')} className="hover:text-white">Privacy Policy</button>
                  </div>
                  <button disabled className="cursor-not-allowed opacity-70">AML &amp; KYC Policy</button>
                </div>
              </>
            ) : null}
          </section>
        </div>
      </div>
    </div>
    <Suspense fallback={null}>
      {showActivity ? <ActivityDrawer open={showActivity} onClose={() => setShowActivity(false)} /> : null}
    </Suspense>
    <style>{`@media (prefers-reduced-motion: reduce){.ambient-pulse{animation:none!important;}}`}</style>
    </>
  );
};

export const Header = memo(HeaderComponent);
Header.displayName = 'Header';
