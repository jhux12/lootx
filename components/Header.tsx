import React, {
  Suspense,
  lazy,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Home as HomeIcon,
  AtSign,
  ChevronDown,
  HelpCircle,
  Facebook,
  Gift,
  Instagram,
  LifeBuoy,
  LogIn,
  LogOut,
  Menu,
  Package,
  PenTool,
  Plus,
  RefreshCw,
  BarChart3,
  Bell,
  Box,
  Clock3,
  ShieldCheck,
  Trophy,
  Twitter,
  User as UserIcon,
  Users,
  X,
} from "lucide-react";
import { useGame } from "../context/GameContext";
import { useSound } from "../context/SoundContext";
import { CoinAmount } from "./CoinAmount";
import { BrandLockup } from "./BrandLockup";
import { useBalanceFeedback } from "../src/ui/feedback/useBalanceFeedback";
import { useUnreadActivityCount } from "../src/lib/activity/useActivity";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import {
  getClaimReadyQuestCount,
  normalizeQuestRules,
} from "../src/lib/quests";
import { UserAvatar } from "./UserAvatar";
import { resolveUserDisplayName } from "../utils/userIdentity";
import { lockPageScroll } from "../utils/scrollLock";

const ActivityDrawer = lazy(() =>
  import("../src/ui/activity/ActivityDrawer").then((module) => ({
    default: module.ActivityDrawer,
  })),
);

type HeaderProps = {
  onOpenInbox: () => void;
  unreadChatCount?: number;
  isSticky?: boolean;
};

const GamesIcon: React.FC<{ className?: string }> = ({ className }) => (
  <Package className={className} aria-hidden="true" />
);
const drawerCardClass =
  "flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.045] p-3 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition-all duration-200 hover:-translate-y-0.5 hover:border-cyan-300/25 hover:bg-white/[0.075] active:translate-y-0";

const desktopNavButtonBaseClass =
  "group relative flex h-11 items-center justify-center rounded-[11px] border px-4 text-[14px] font-semibold xl:px-6 xl:text-[15px] transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#070b12]";

const desktopNavButtonClass = `${desktopNavButtonBaseClass} border-transparent text-white/78 hover:border-violet-300/20 hover:bg-violet-500/10 hover:text-white`;

const desktopActiveNavButtonClass = `${desktopNavButtonBaseClass} border-violet-300/25 bg-violet-500/15 text-violet-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_10px_26px_rgba(0,0,0,0.22)]`;

const desktopMenuPanelClass =
  'absolute left-0 top-full z-50 mt-3 rounded-2xl border border-white/10 bg-[#0b0e15]/[.98] p-1.5 shadow-[0_24px_80px_rgba(0,0,0,0.65),0_0_0_1px_rgba(124,60,255,0.16)] backdrop-blur-2xl transition-all duration-200 before:absolute before:-top-3 before:left-0 before:h-3 before:w-full before:content-[""]';

const desktopMenuItemClass =
  "flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-white/80 transition-all duration-200 hover:bg-white/[0.07] hover:text-white";

const utilityButtonClass =
  "relative inline-flex h-10 w-10 items-center justify-center rounded-[12px] border border-white/10 bg-white/[0.045] text-gray-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition-all duration-200 hover:border-violet-300/35 hover:bg-violet-500/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300/60";

type RewardsSettingsData = Record<string, unknown> | undefined;

const HeaderSkeleton: React.FC = memo(() => (
  <div className="flex min-h-[44px] items-center gap-2" aria-hidden="true">
    <div className="hidden h-8 w-[72px] rounded-lg border border-amber-500/10 bg-white/[0.06] lg:block" />
    <div className="h-9 w-[118px] rounded-full bg-white/[0.07] sm:w-[132px] lg:h-10 lg:w-[148px]" />
    <div className="hidden h-9 w-[168px] rounded-lg bg-white/[0.06] lg:block" />
    <div className="h-10 w-10 rounded-xl bg-white/[0.07] lg:hidden" />
  </div>
));
HeaderSkeleton.displayName = "HeaderSkeleton";

const HeaderComponent: React.FC<HeaderProps> = ({
  onOpenInbox: _onOpenInbox,
  unreadChatCount: _unreadChatCount,
  isSticky = true,
}) => {
  const [isSuppressed, setIsSuppressed] = useState(false);
  const {
    user,
    authInitialized,
    balance,
    view,
    setView,
    isAuthenticated,
    openAuthModal,
    setShowTopUpModal,
    showTopUpModal,
    logout,
    boxes,
  } = useGame();
  const { playSound } = useSound();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isGamesMenuOpen, setIsGamesMenuOpen] = useState(false);
  const [questReadyCount, setQuestReadyCount] = useState(0);
  const [claimedTodayCount, setClaimedTodayCount] = useState(0);
  const [locallyClaimedQuestIds, setLocallyClaimedQuestIds] = useState<
    Record<string, string>
  >({});
  const [showActivity, setShowActivity] = useState(false);
  const [isFreeBoxTooltipDismissed, setIsFreeBoxTooltipDismissed] =
    useState(false);
  const headerRef = useRef<HTMLElement | null>(null);
  const gamesMenuRef = useRef<HTMLDivElement | null>(null);
  const resolvedDisplayName = useMemo(
    () => (authInitialized ? resolveUserDisplayName(user) : ""),
    [authInitialized, user],
  );
  const balanceTone = useBalanceFeedback(balance, isAuthenticated);
  const unreadCount = useUnreadActivityCount();
  const lastDailyClaim = useMemo(
    () =>
      Number.isFinite(user.lastDailyClaim ?? NaN)
        ? Number(user.lastDailyClaim)
        : 0,
    [user.lastDailyClaim],
  );
  const isDailySpinReady = useMemo(() => {
    const dailyCooldownMs = 24 * 60 * 60 * 1000;
    return !lastDailyClaim || lastDailyClaim + dailyCooldownMs <= Date.now();
  }, [lastDailyClaim]);
  const showDailySpinReady = isAuthenticated && isDailySpinReady;
  const hasDailyBox = useMemo(() => boxes.some((box) => box.isDaily), [boxes]);
  const hasFreeSignupBox =
    isAuthenticated && hasDailyBox && !user.lastFreeBoxClaim;
  const showFreeBoxTooltip = hasFreeSignupBox && !isFreeBoxTooltipDismissed;
  const activeDesktopSection = useMemo<
    "home" | "cases" | "leaderboard" | "dailySpin" | "rewards" | "profile" | null
  >(() => {
    if (view.type === "HOME") return "home";
    if (view.type === "BOXES" || view.type === "CASE_OPENING") return "cases";
    if (view.type === "LEADERBOARD") return "leaderboard";
    if (view.type === "BONUSES") return "dailySpin";
    if (
      view.type === "QUESTS" ||
      view.type === "POLLS" ||
      view.type === "REFERRALS"
    )
      return "rewards";
    if (view.type === "PROFILE" || view.type === "INVENTORY") return "profile";
    return null;
  }, [view.type]);
  const [rewardsSettings, setRewardsSettings] = useState<RewardsSettingsData>();
  const [enableRewardsRealtime, setEnableRewardsRealtime] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setIsFreeBoxTooltipDismissed(
      window.sessionStorage.getItem("pullz:free-box-tooltip-dismissed") === "1",
    );
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const handleDocumentClick = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (!target) return;

      if (
        isGamesMenuOpen &&
        gamesMenuRef.current &&
        !gamesMenuRef.current.contains(target)
      ) {
        setIsGamesMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleDocumentClick);
    document.addEventListener("touchstart", handleDocumentClick);
    return () => {
      document.removeEventListener("mousedown", handleDocumentClick);
      document.removeEventListener("touchstart", handleDocumentClick);
    };
  }, [isGamesMenuOpen]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

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
      if (event.key === "Escape") {
        setIsMobileMenuOpen(false);
      }
    };

    window.addEventListener("pullz:open-mobile-menu", openMobileMenu);
    window.addEventListener("pullz:close-mobile-menu", closeMobileMenu);
    window.addEventListener("pullz:toggle-mobile-menu", toggleMobileMenu);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("pullz:open-mobile-menu", openMobileMenu);
      window.removeEventListener("pullz:close-mobile-menu", closeMobileMenu);
      window.removeEventListener("pullz:toggle-mobile-menu", toggleMobileMenu);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    window.dispatchEvent(
      new CustomEvent("pullz:mobile-menu-state", {
        detail: { isOpen: isMobileMenuOpen },
      }),
    );
    if (!isMobileMenuOpen) return undefined;

    return lockPageScroll({ preserveScrollPosition: true });
  }, [isMobileMenuOpen]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const handleHeaderVisibility = (event: Event) => {
      const detail = (event as CustomEvent<{ hidden: boolean }>).detail;
      setIsSuppressed(Boolean(detail?.hidden));
    };

    window.addEventListener("pullz:header-visibility", handleHeaderVisibility);
    return () =>
      window.removeEventListener(
        "pullz:header-visibility",
        handleHeaderVisibility,
      );
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const syncHeaderHeight = () => {
      const headerHeight = headerRef.current?.offsetHeight ?? 72;
      document.documentElement.style.setProperty(
        "--pullz-header-height",
        `${headerHeight}px`,
      );
    };

    syncHeaderHeight();

    const resizeObserver =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(syncHeaderHeight);

    if (headerRef.current && resizeObserver) {
      resizeObserver.observe(headerRef.current);
    }

    window.addEventListener("resize", syncHeaderHeight);

    return () => {
      window.removeEventListener("resize", syncHeaderHeight);
      resizeObserver?.disconnect();
      document.documentElement.style.removeProperty("--pullz-header-height");
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!isAuthenticated) {
      setEnableRewardsRealtime(false);
      return;
    }
    let idleId: number | null = null;
    let timeoutId: number | null = null;
    const enable = () => setEnableRewardsRealtime(true);
    const idleWindow = window as Window & {
      requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number;
      cancelIdleCallback?: (handle: number) => void;
    };
    if (typeof idleWindow.requestIdleCallback === "function")
      idleId = idleWindow.requestIdleCallback(enable, {
        timeout: 3000,
      }) as unknown as number;
    else timeoutId = window.setTimeout(enable, 3000);
    return () => {
      if (idleId !== null && typeof idleWindow.cancelIdleCallback === "function")
        idleWindow.cancelIdleCallback(idleId);
      if (timeoutId !== null) window.clearTimeout(timeoutId);
    };
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) {
      setRewardsSettings(undefined);
      return;
    }
    if (!enableRewardsRealtime) return;
    const unsub = onSnapshot(
      doc(db, "settings", "rewards"),
      (snap) => {
        setRewardsSettings(snap.data() as RewardsSettingsData);
      },
      (error) => {
        console.error("Rewards settings snapshot failed", error);
      },
    );
    return () => unsub();
  }, [enableRewardsRealtime, isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) {
      setQuestReadyCount((current) => (current === 0 ? current : 0));
      setClaimedTodayCount((current) => (current === 0 ? current : 0));
      return;
    }

    const today = new Date().toISOString().slice(0, 10);
    const claims = { ...(user.questClaims ?? {}), ...locallyClaimedQuestIds };
    const stats =
      user.challengeStatsDay === today ? (user.challengeStats ?? {}) : {};
    const rules = normalizeQuestRules(rewardsSettings?.questRules);
    const count = getClaimReadyQuestCount(rules, stats, claims, today);
    const claimedCount = rules.filter(
      (rule) => rule.enabled !== false && claims?.[rule.id] === today,
    ).length;

    setQuestReadyCount((current) => (current === count ? current : count));
    setClaimedTodayCount((current) =>
      current === claimedCount ? current : claimedCount,
    );
  }, [
    isAuthenticated,
    locallyClaimedQuestIds,
    rewardsSettings,
    user.challengeStats,
    user.challengeStatsDay,
    user.questClaims,
  ]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const handleQuestClaimed = (event: Event) => {
      const customEvent = event as CustomEvent<{
        questId?: string;
        day?: string;
      }>;
      const questId = customEvent.detail?.questId;
      const day = customEvent.detail?.day;
      if (!questId || !day) return;
      setLocallyClaimedQuestIds((prev) =>
        prev[questId] === day ? prev : { ...prev, [questId]: day },
      );
    };

    window.addEventListener(
      "pullz:quest-claimed",
      handleQuestClaimed as EventListener,
    );
    return () => {
      window.removeEventListener(
        "pullz:quest-claimed",
        handleQuestClaimed as EventListener,
      );
    };
  }, []);

  const navigate = useCallback(
    (
      type:
        | "HOME"
        | "BOXES"
        | "SPIN"
        | "BONUSES"
        | "LEADERBOARD"
        | "QUESTS"
        | "POLLS"
        | "REFERRALS"
        | "PROVABLY_FAIR"
        | "CONTACT"
        | "TERMS"
        | "PRIVACY"
        | "PROFILE"
        | "ADMIN"
        | "INVENTORY",
    ) => {
      playSound("click");
      const requiresAuth =
        type === "BONUSES" ||
        type === "QUESTS" ||
        type === "POLLS" ||
        type === "REFERRALS" ||
        type === "INVENTORY" ||
        type === "PROFILE";
      if (requiresAuth && !isAuthenticated) {
        openAuthModal("login");
        return;
      }
      setView({ type } as any);
      setIsMobileMenuOpen(false);
      setIsGamesMenuOpen(false);
    },
    [isAuthenticated, openAuthModal, playSound, setView],
  );

  const openTopUp = useCallback(() => {
    playSound("click");
    setShowTopUpModal(true);
  }, [playSound, setShowTopUpModal]);

  const openActivity = useCallback(() => setShowActivity(true), []);

  const handleSignIn = useCallback(() => {
    playSound("click");
    setIsMobileMenuOpen(false);
    openAuthModal("login");
  }, [openAuthModal, playSound]);

  const scrollToSpinSection = useCallback((sectionId: string) => {
    setIsMobileMenuOpen(false);
    // Wait for the fixed mobile menu and its backdrop to release the viewport
    // before starting the smooth scroll.
    window.setTimeout(() => {
      document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 180);
  }, []);

  const handleLogout = useCallback(() => {
    playSound("click");
    void logout();
  }, [logout, playSound]);

  const startPullingButton = useMemo(
    () => (
      <button
        type="button"
        onClick={() => {
          playSound("click");
          openAuthModal("register");
        }}
        className="group relative inline-flex h-10 shrink-0 items-center gap-2 overflow-hidden rounded-[10px] bg-[linear-gradient(135deg,#6225ef_0%,#4f7ff4_100%)] px-4 text-[13px] font-bold text-white shadow-[0_14px_34px_rgba(79,127,244,0.25)] outline-none transition-transform hover:scale-[1.01] focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:ring-offset-2 focus-visible:ring-offset-black active:scale-[0.99] sm:px-5 lg:h-11 lg:min-w-[188px] lg:justify-center lg:rounded-[11px] lg:text-[15px]"
        aria-label="Open Free Box"
      >
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_0%,rgba(255,255,255,0.28),transparent_32%)] opacity-80"
        />
        <Box
          className="relative z-10 h-4 w-4 stroke-[2.1] lg:h-5 lg:w-5"
          aria-hidden="true"
        />
        <span className="relative z-10 whitespace-nowrap">Open Free Box</span>
      </button>
    ),
    [openAuthModal, playSound],
  );


  const mobileMenuButton = (
    <button
      type="button"
      onClick={() => setIsMobileMenuOpen((open) => !open)}
      className="group relative inline-flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-blue-300/20 bg-[#111a2a]/90 text-blue-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_10px_24px_rgba(0,0,0,0.28)] transition-all duration-200 hover:border-cyan-200/40 hover:bg-[#162237] hover:text-white active:scale-95 lg:hidden"
      aria-label={isMobileMenuOpen ? "Close menu" : "Open menu"}
      aria-expanded={isMobileMenuOpen}
    >
      {isMobileMenuOpen ? (
        <X className="relative z-10 h-5 w-5" />
      ) : (
        <Menu className="relative z-10 h-5 w-5" />
      )}
    </button>
  );


  const dismissFreeBoxTooltip = useCallback(() => {
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem("pullz:free-box-tooltip-dismissed", "1");
    }
    setIsFreeBoxTooltipDismissed(true);
  }, []);

  return (
    <>
      <div
        className={`relative z-[260] transition-opacity duration-200 ease-out ${isSuppressed || showTopUpModal ? "pointer-events-none opacity-0" : "opacity-100"}`}
        aria-hidden={isSuppressed || showTopUpModal}
      >
        <header
          ref={headerRef}
          className={`${isSticky ? "pullz-mobile-header fixed inset-x-0 top-0" : "relative"} z-[120] border-b border-violet-300/15 bg-[#05060a]/[.96] shadow-[0_12px_34px_rgba(0,0,0,0.4)] backdrop-blur-xl lg:border-b-0 lg:bg-transparent lg:px-4 lg:py-2`}
        >
          <div className="pt-[env(safe-area-inset-top,0px)]">
            <nav className="relative mx-auto flex h-[56px] max-w-7xl items-center justify-between overflow-hidden px-3 sm:h-[60px] sm:px-4 lg:h-[72px] lg:max-w-none lg:rounded-[18px] lg:border lg:border-violet-300/15 lg:bg-[#0b0e15]/[.96] lg:px-5 lg:shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_18px_58px_rgba(0,0,0,0.4),0_0_42px_rgba(124,60,255,0.16)] lg:backdrop-blur-xl xl:px-9">
              <span aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_8%_0%,rgba(124,60,255,0.26),transparent_36%),radial-gradient(circle_at_92%_0%,rgba(77,141,255,0.16),transparent_30%),linear-gradient(180deg,rgba(255,255,255,0.045),transparent_58%)]" />
              <div className="relative z-10 flex min-w-0 items-center gap-3 lg:gap-x-4 xl:gap-x-5">
                <button
                  type="button"
                  onClick={() => navigate("HOME")}
                  className="inline-flex shrink-0 items-center rounded-2xl p-1 transition-all duration-200 hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300/60 lg:-ml-1"
                  aria-label="Go home"
                >
                  <BrandLockup
                    showText={false}
                    logoClassName="h-8 w-auto sm:h-9 lg:h-[42px]"
                  />
                </button>

                {view.type === 'SPIN' && <div className="hidden items-center gap-2 lg:flex xl:gap-3">{[
                  ['how', 'How It Works'], ['featured', 'Featured Pulls'], ['winners', 'Winners'], ['faq', 'FAQ']
                ].map(([id, label]) => <button key={id} type="button" onClick={() => scrollToSpinSection(id)} className={desktopNavButtonClass}>{label}</button>)}</div>}
                <div className={`${view.type === 'SPIN' ? 'hidden' : 'hidden items-center gap-2 lg:flex xl:gap-3'}`}>
                  <button
                    type="button"
                    onClick={() => navigate("HOME")}
                    className={
                      activeDesktopSection === "home"
                        ? desktopActiveNavButtonClass
                        : desktopNavButtonClass
                    }
                  >
                    Home
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate("BOXES")}
                    className={
                      activeDesktopSection === "cases"
                        ? desktopActiveNavButtonClass
                        : desktopNavButtonClass
                    }
                  >
                    Boxes
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate("LEADERBOARD")}
                    className={
                      activeDesktopSection === "leaderboard"
                        ? desktopActiveNavButtonClass
                        : desktopNavButtonClass
                    }
                  >
                    Leaderboard
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate("BONUSES")}
                    className={`${
                      activeDesktopSection === "dailySpin"
                        ? desktopActiveNavButtonClass
                        : desktopNavButtonClass
                    } gap-2`}
                  >
                    <Gift className="h-4 w-4" aria-hidden="true" />
                    <span>Rewards</span>
                    {showDailySpinReady ? (
                      <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-[#54f5b3] shadow-[0_0_12px_rgba(84,245,179,0.8)]" />
                    ) : null}
                  </button>
                </div>
              </div>

              <div className="relative z-10 flex min-h-[42px] min-w-[132px] shrink-0 items-center justify-end gap-2 sm:min-w-[148px] sm:gap-3 lg:min-w-0 xl:min-w-[360px]">
                {!authInitialized ? (
                  <HeaderSkeleton />
                ) : isAuthenticated ? (
                  <>
                    <div className="hidden items-center gap-2 lg:flex xl:gap-3">
                      <div
                        className={`relative min-w-[126px] xl:min-w-[142px] shrink-0 overflow-hidden rounded-[12px] border border-[#263046]/80 bg-[#0c121e]/72 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] ${balanceTone === "up" ? "ring-1 ring-emerald-400/35" : balanceTone === "down" ? "ring-1 ring-red-400/35" : ""}`}
                      >
                        <span
                          aria-hidden="true"
                          className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(99,102,241,0.12),rgba(59,130,246,0.08),rgba(255,255,255,0.015))]"
                        />
                        <div className="relative z-10 flex h-11 items-center justify-between gap-2 px-3 pr-2 xl:gap-3 xl:px-4">
                          <CoinAmount
                            amount={balance}
                            className="min-w-[76px] text-[14px] xl:min-w-[90px] xl:text-[15px] font-semibold leading-none tracking-tight text-white"
                            iconClassName="h-5 w-5"
                            textClassName="min-w-[52px] xl:min-w-[62px] text-right tabular-nums"
                            formatOptions={{ maximumFractionDigits: 0 }}
                          />
                          <button
                            type="button"
                            onClick={openTopUp}
                            className="flex h-8 w-8 items-center justify-center rounded-[10px] border border-white/10 bg-[#121a28] text-white shadow-sm transition-all duration-200 hover:bg-[#182337] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
                            aria-label="Top up"
                          >
                            <Plus className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="hidden items-center lg:flex">
                      <button
                        type="button"
                        onClick={openActivity}
                        className={utilityButtonClass}
                        aria-label="Open notifications and activity"
                      >
                        <Bell className="h-4 w-4" />
                        {unreadCount > 0 ? (
                          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-[#5ba7ff]" />
                        ) : null}
                      </button>
                    </div>

                    <div className="hidden items-center gap-2 lg:flex xl:gap-3">
                      {user.isAdmin && (
                        <button
                          onClick={() => navigate("ADMIN")}
                          className="hidden h-10 items-center gap-2 rounded-[12px] border border-blue-400/20 bg-blue-500/10 px-3 text-xs font-bold uppercase tracking-wide text-blue-200 transition-all duration-200 hover:border-blue-300/40 hover:bg-[#205DD7] hover:text-white xl:flex"
                        >
                          <ShieldCheck className="h-3.5 w-3.5" />
                          Admin
                        </button>
                      )}
                      <span
                        className="h-10 w-px bg-[#263046]/85"
                        aria-hidden="true"
                      />
                      <div className="relative flex items-center">
                        <button
                          type="button"
                          onClick={() => navigate("PROFILE")}
                          className="flex h-11 items-center gap-2 rounded-[12px] px-1.5 pr-2 transition-all duration-200 hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300/60"
                        >
                          <UserAvatar
                            user={user}
                            className="h-9 w-9 rounded-full object-cover"
                            initialsClassName="text-sm"
                          />
                          <span className="hidden max-w-[82px] truncate text-[15px] font-semibold text-white/92 xl:inline xl:max-w-[120px]">
                            {resolvedDisplayName}
                          </span>
                          <ChevronDown
                            className="hidden h-4 w-4 text-white/68 xl:block"
                            aria-hidden="true"
                          />
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
                        className={utilityButtonClass}
                        aria-label="Log out"
                      >
                        <LogOut className="h-4 w-4" />
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="hidden items-center gap-2 lg:flex">
                    <button
                      type="button"
                      onClick={handleSignIn}
                      className={utilityButtonClass}
                      aria-label="Sign in"
                      title="Sign in"
                    >
                      <LogIn className="h-4 w-4" />
                    </button>
                    {startPullingButton}
                  </div>
                )}

                {authInitialized && !isAuthenticated && (
                  <div className="flex min-h-[44px] min-w-[174px] items-center justify-end gap-2 lg:hidden">
                    {startPullingButton}
                    {mobileMenuButton}
                  </div>
                )}

                {authInitialized && isAuthenticated && (
                  <div className="flex min-h-[40px] min-w-0 items-center gap-1.5 lg:hidden">
                    <div className="relative min-w-[110px] shrink-0 overflow-hidden rounded-xl border border-white/10 bg-white/[0.045] sm:min-w-[126px]">
                      <span
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,56,92,0.12),rgba(34,211,238,0.08),rgba(255,255,255,0.02))]"
                      />
                      <div className="relative z-10 flex h-9 items-center justify-between gap-1.5 px-2 pl-2.5 pr-1 sm:gap-2 sm:pl-3 sm:pr-1.5">
                        <CoinAmount
                          amount={balance}
                          className="min-w-[72px] text-xs font-extrabold leading-none tracking-tight text-white sm:min-w-[82px] sm:text-sm"
                          iconClassName="h-4 w-4"
                          textClassName="min-w-[44px] text-right tabular-nums sm:min-w-[52px]"
                          formatOptions={{ maximumFractionDigits: 0 }}
                        />
                        <button
                          type="button"
                          onClick={openTopUp}
                          className="flex h-6 w-6 items-center justify-center rounded-lg bg-white/90 text-black shadow-sm transition-all duration-200 hover:bg-cyan-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:ring-offset-2 focus-visible:ring-offset-black sm:h-7 sm:w-7"
                          aria-label="Top up"
                        >
                          <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        </button>
                      </div>
                    </div>
                    {mobileMenuButton}
                  </div>
                )}
              </div>
            </nav>
          </div>
        </header>

        <button
          type="button"
          onClick={() => setIsMobileMenuOpen(false)}
          className={`fixed inset-x-0 bottom-[calc(var(--pullz-mobile-bottom-nav-height,72px)+var(--pullz-viewport-bottom-offset,0px))] z-[230] bg-[#02050c]/82 backdrop-blur-sm transition-opacity duration-300 ease-out lg:hidden ${
            isSticky ? "top-[var(--pullz-header-height)]" : "top-0"
          } ${isMobileMenuOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"}`}
          aria-label="Close menu overlay"
        />

        <div
          className={`fixed inset-x-0 bottom-[calc(var(--pullz-mobile-bottom-nav-height,72px)+var(--pullz-viewport-bottom-offset,0px))] z-[240] w-full max-w-[100vw] overflow-y-auto overflow-x-hidden overscroll-x-none overscroll-y-contain border-t border-violet-300/15 bg-[radial-gradient(circle_at_50%_15%,rgba(124,60,255,0.20),transparent_38%),radial-gradient(circle_at_10%_95%,rgba(77,141,255,0.13),transparent_42%),linear-gradient(rgba(5,6,10,0.98),rgba(5,6,10,0.98))] px-4 pb-4 pt-3 shadow-[0_-24px_70px_rgba(0,0,0,0.62)] backdrop-blur-2xl transition-all duration-300 ease-out lg:hidden ${
            isSticky ? "top-[var(--pullz-header-height)]" : "top-0"
          } ${
            isMobileMenuOpen
              ? "translate-x-0 opacity-100"
              : "pointer-events-none translate-x-full opacity-0"
          }`}
          role="dialog"
          aria-modal="true"
          aria-label="Mobile navigation menu"
        >
          <div className="relative flex min-h-full max-w-full flex-col overflow-x-hidden pb-4 pt-1">
            <span aria-hidden="true" className="pointer-events-none absolute -right-24 -top-24 h-56 w-56 rounded-full bg-violet-500/10 blur-3xl" />
            <span aria-hidden="true" className="pointer-events-none absolute -left-24 bottom-12 h-56 w-56 rounded-full bg-blue-500/10 blur-3xl" />
            <div className="mb-7 flex w-full items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => navigate("PROFILE")}
                className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.035] px-2 py-2 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] transition-colors hover:bg-white/[0.07]"
              >
                {isAuthenticated ? (
                  <UserAvatar
                    user={user}
                    className="h-14 w-14 rounded-full object-cover ring-2 ring-blue-300/25"
                    initialsClassName="text-base"
                  />
                ) : (
                  <div className="grid h-14 w-14 place-items-center rounded-full border border-blue-300/20 bg-[#101827] text-base font-black text-blue-100">
                    <UserIcon className="h-6 w-6" />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="truncate text-lg font-black text-white">
                    {isAuthenticated
                      ? resolvedDisplayName || "Pullz Player"
                      : "Welcome to Pullz"}
                  </p>
                </div>
              </button>
              {isAuthenticated ? (
                <button
                  type="button"
                  onClick={() => {
                    playSound("click");
                    setIsMobileMenuOpen(false);
                    void logout();
                  }}
                  className="shrink-0 rounded-xl border border-blue-300/20 bg-[#101827] px-3 py-2 text-xs font-black uppercase text-blue-100 transition-colors hover:bg-[#162237]"
                >
                  Sign out
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSignIn}
                  className="shrink-0 rounded-xl border border-blue-300/20 bg-[#101827] px-3 py-2 text-xs font-black uppercase text-blue-100 transition-colors hover:bg-[#162237]"
                >
                  Sign in
                </button>
              )}
            </div>

            {view.type === 'SPIN' ? (
              <nav className="relative z-10 space-y-2" aria-label="Spin page sections">
                {[
                  ['how', 'How It Works'], ['featured', 'Featured Pulls'], ['winners', 'Winners'], ['faq', 'FAQ']
                ].map(([id, label]) => (
                  <button key={id} type="button" onClick={() => scrollToSpinSection(id)} className="flex min-h-14 w-full items-center rounded-2xl px-4 text-left text-base font-extrabold text-slate-200 transition-colors hover:bg-violet-500/10 hover:text-white">
                    {label}
                  </button>
                ))}
              </nav>
            ) : <nav className="relative z-10 space-y-2" aria-label="Mobile menu links">
              <button
                onClick={() => navigate("HOME")}
                className={`flex min-h-14 w-full items-center gap-4 rounded-2xl px-4 text-left text-base font-extrabold transition-colors ${view.type === "HOME" ? "bg-[linear-gradient(135deg,rgba(32,93,215,0.28),rgba(84,245,179,0.12))] text-[#7dd3fc] shadow-[inset_0_0_0_1px_rgba(125,211,252,0.18)]" : "text-slate-200 hover:bg-white/[0.06] hover:text-white"}`}
              >
                <HomeIcon className="h-5 w-5 text-[#7dd3fc]" />
                Home
              </button>
              <button
                onClick={() => navigate("BOXES")}
                className={`flex min-h-14 w-full items-center gap-4 rounded-2xl px-4 text-left text-base font-extrabold transition-colors ${view.type === "BOXES" || view.type === "CASE_OPENING" ? "bg-[linear-gradient(135deg,rgba(32,93,215,0.28),rgba(84,245,179,0.12))] text-[#7dd3fc] shadow-[inset_0_0_0_1px_rgba(125,211,252,0.18)]" : "text-slate-200 hover:bg-white/[0.06] hover:text-white"}`}
              >
                <Package className="h-5 w-5 text-[#7dd3fc]" />
                Boxes
              </button>
              <button
                onClick={() => navigate("LEADERBOARD")}
                className={`flex min-h-14 w-full items-center gap-4 rounded-2xl px-4 text-left text-base font-extrabold transition-colors ${view.type === "LEADERBOARD" ? "bg-[linear-gradient(135deg,rgba(32,93,215,0.28),rgba(84,245,179,0.12))] text-[#7dd3fc] shadow-[inset_0_0_0_1px_rgba(125,211,252,0.18)]" : "text-slate-200 hover:bg-white/[0.06] hover:text-white"}`}
              >
                <Trophy className="h-5 w-5 text-[#7dd3fc]" />
                Leaderboard
              </button>
              <button
                onClick={() => navigate("BONUSES")}
                className={`relative flex min-h-14 w-full items-center gap-4 rounded-2xl px-4 text-left text-base font-extrabold transition-colors ${view.type === "BONUSES" ? "bg-[linear-gradient(135deg,rgba(32,93,215,0.28),rgba(84,245,179,0.12))] text-[#7dd3fc] shadow-[inset_0_0_0_1px_rgba(125,211,252,0.18)]" : "text-slate-200 hover:bg-white/[0.06] hover:text-white"}`}
              >
                <RefreshCw className="h-5 w-5 text-[#7dd3fc]" />
                <span className="min-w-0 flex-1">Daily Spin</span>
                {showDailySpinReady ? (
                  <span className="rounded-full border border-[#54f5b3]/30 bg-[#54f5b3]/15 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-[#7dd3fc]">Ready</span>
                ) : null}
              </button>
              <button
                onClick={() => navigate("PROFILE")}
                className={`flex min-h-14 w-full items-center gap-4 rounded-2xl px-4 text-left text-base font-extrabold transition-colors ${view.type === "PROFILE" || view.type === "INVENTORY" ? "bg-[linear-gradient(135deg,rgba(32,93,215,0.28),rgba(84,245,179,0.12))] text-[#7dd3fc] shadow-[inset_0_0_0_1px_rgba(125,211,252,0.18)]" : "text-slate-200 hover:bg-white/[0.06] hover:text-white"}`}
              >
                <UserIcon className="h-5 w-5 text-[#7dd3fc]" />
                Profile
              </button>
            </nav>}

            {view.type !== 'SPIN' && <div className="mt-auto space-y-2 border-t border-blue-300/15 pt-4">
              <button
                onClick={() => navigate("REFERRALS")}
                className="flex min-h-14 w-full items-center gap-4 rounded-2xl px-4 text-left text-base font-extrabold text-slate-200 transition-colors hover:bg-white/[0.06] hover:text-white"
              >
                <Users className="h-5 w-5 text-[#7dd3fc]" />
                Refer a Friend
              </button>
              <button
                onClick={() => navigate("CONTACT")}
                className="flex min-h-14 w-full items-center gap-4 rounded-2xl px-4 text-left text-base font-extrabold text-slate-200 transition-colors hover:bg-white/[0.06] hover:text-white"
              >
                <LifeBuoy className="h-5 w-5 text-[#7dd3fc]" />
                Support
              </button>
            </div>}
          </div>
        </div>
      </div>
      <Suspense fallback={null}>
        {showActivity ? (
          <ActivityDrawer
            open={showActivity}
            onClose={() => setShowActivity(false)}
          />
        ) : null}
      </Suspense>
      <style>{`@media (prefers-reduced-motion: reduce){.ambient-pulse{animation:none!important;}}`}</style>
    </>
  );
};

export const Header = memo(HeaderComponent);
Header.displayName = "Header";
