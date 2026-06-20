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
  Flame,
  Home as HomeIcon,
  AtSign,
  ChevronDown,
  HelpCircle,
  Facebook,
  Instagram,
  LifeBuoy,
  LogIn,
  LogOut,
  Menu,
  Package,
  PenTool,
  Plus,
  RefreshCw,
  Sparkles,
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

const UpgraderIcon: React.FC<{ className?: string }> = ({ className }) => (
  <Flame className={className} aria-hidden="true" />
);
const GamesIcon: React.FC<{ className?: string }> = ({ className }) => (
  <Package className={className} aria-hidden="true" />
);
const RewardsIcon: React.FC<{ className?: string }> = ({ className }) => (
  <Sparkles className={className} aria-hidden="true" />
);
const PullPassNavIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 64 64" fill="none" className={className} aria-hidden="true">
    <path
      d="M32 4L55 17V47L32 60L9 47V17L32 4Z"
      fill="#111827"
      stroke="currentColor"
      strokeWidth="3"
    />
    <path
      d="M32 9L50 19.5V44.5L32 55L14 44.5V19.5L32 9Z"
      fill="url(#header-pull-pass-gradient)"
      stroke="currentColor"
      strokeWidth="1.5"
    />
    <path
      d="M32 17L36.2 26.1L46 27.2L38.7 33.8L40.7 43.5L32 38.5L23.3 43.5L25.3 33.8L18 27.2L27.8 26.1L32 17Z"
      fill="#FACC15"
      stroke="#FEF3C7"
      strokeWidth="1.5"
    />
    <path
      d="M32 17L36.2 26.1L46 27.2L38.7 33.8L40.7 43.5L32 38.5V17Z"
      fill="#F59E0B"
      opacity="0.65"
    />
    <defs>
      <linearGradient
        id="header-pull-pass-gradient"
        x1="32"
        y1="9"
        x2="32"
        y2="55"
        gradientUnits="userSpaceOnUse"
      >
        <stop stopColor="#312E81" />
        <stop offset="1" stopColor="#09090B" />
      </linearGradient>
    </defs>
  </svg>
);

const drawerCardClass =
  "flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.045] p-3 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition-all duration-200 hover:-translate-y-0.5 hover:border-cyan-300/25 hover:bg-white/[0.075] active:translate-y-0";

const desktopNavButtonBaseClass =
  "group relative flex h-11 items-center justify-center rounded-[11px] border px-4 text-[14px] font-semibold xl:px-6 xl:text-[15px] transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#070b12]";

const desktopNavButtonClass = `${desktopNavButtonBaseClass} border-transparent text-white/78 hover:border-white/10 hover:bg-[#101827]/70 hover:text-white`;

const desktopActiveNavButtonClass = `${desktopNavButtonBaseClass} border-[#233148]/80 bg-[#101a2b]/86 text-blue-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_10px_26px_rgba(0,0,0,0.18)]`;

const desktopMenuPanelClass =
  'absolute left-0 top-full z-50 mt-3 rounded-2xl border border-white/10 bg-[#101820]/95 p-1.5 shadow-[0_24px_80px_rgba(0,0,0,0.55),0_0_0_1px_rgba(34,211,238,0.05)] backdrop-blur-2xl transition-all duration-200 before:absolute before:-top-3 before:left-0 before:h-3 before:w-full before:content-[""]';

const desktopMenuItemClass =
  "flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-white/80 transition-all duration-200 hover:bg-white/[0.07] hover:text-white";

const utilityButtonClass =
  "relative inline-flex h-10 w-10 items-center justify-center rounded-[12px] border border-[#273044]/80 bg-[#0e1420]/78 text-gray-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition-all duration-200 hover:border-blue-300/35 hover:bg-[#141d2d] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300/60";

type RewardsSettingsData = Record<string, unknown> | undefined;

type PullPassHeaderTier = {
  tier?: number;
  xpRequired?: number;
  freeReward?: string;
};

type PullPassHeaderSettings = {
  tiers: PullPassHeaderTier[];
};

const PULL_PASS_HEADER_COIN_IMAGE =
  "https://firebasestorage.googleapis.com/v0/b/hyperdrop-6476c.firebasestorage.app/o/pullpass%2Fcoins.png?alt=media&token=a4dc007b-6e01-43bb-8b94-4dcc677f9567";
const PULL_PASS_HEADER_BOX_IMAGES = {
  bronze:
    "https://firebasestorage.googleapis.com/v0/b/hyperdrop-6476c.firebasestorage.app/o/pullpass%2Fbronze.png?alt=media&token=2074648a-5fc0-42bd-8fd6-776bbd716fed",
  silver:
    "https://firebasestorage.googleapis.com/v0/b/hyperdrop-6476c.firebasestorage.app/o/pullpass%2Fsilver.png?alt=media&token=60df1026-45da-41a6-b572-0fe5bbb9399e",
  gold: "https://firebasestorage.googleapis.com/v0/b/hyperdrop-6476c.firebasestorage.app/o/pullpass%2Fgold.png?alt=media&token=29316f1c-3d13-46c9-ab6c-5b1fb5823daa",
};

const getPullPassRewardImage = (rewardName: string) => {
  const normalized = rewardName.toLowerCase();
  if (normalized.includes("bronze")) return PULL_PASS_HEADER_BOX_IMAGES.bronze;
  if (normalized.includes("silver")) return PULL_PASS_HEADER_BOX_IMAGES.silver;
  if (
    normalized.includes("gold") ||
    normalized.includes("elite") ||
    normalized.includes("master")
  )
    return PULL_PASS_HEADER_BOX_IMAGES.gold;
  if (normalized.includes("coin")) return PULL_PASS_HEADER_COIN_IMAGE;
  return null;
};

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
  const [isRewardsMenuOpen, setIsRewardsMenuOpen] = useState(false);
  const [questReadyCount, setQuestReadyCount] = useState(0);
  const [claimedTodayCount, setClaimedTodayCount] = useState(0);
  const [locallyClaimedQuestIds, setLocallyClaimedQuestIds] = useState<
    Record<string, string>
  >({});
  const [showActivity, setShowActivity] = useState(false);
  const [isFreeBoxTooltipDismissed, setIsFreeBoxTooltipDismissed] =
    useState(false);
  const [openMobileSections, setOpenMobileSections] = useState({
    games: true,
    rewards: false,
    learn: false,
    support: false,
  });
  const headerRef = useRef<HTMLElement | null>(null);
  const gamesMenuRef = useRef<HTMLDivElement | null>(null);
  const rewardsMenuRef = useRef<HTMLDivElement | null>(null);
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
    "home" | "cases" | "upgrader" | "leaderboard" | "rewards" | "profile" | null
  >(() => {
    if (view.type === "HOME") return "home";
    if (view.type === "BOXES" || view.type === "CASE_OPENING") return "cases";
    if (view.type === "PLINKO") return "upgrader";
    if (view.type === "LEADERBOARD") return "leaderboard";
    if (
      view.type === "PULL_PASS" ||
      view.type === "BONUSES" ||
      view.type === "QUESTS" ||
      view.type === "POLLS" ||
      view.type === "REFERRALS"
    )
      return "rewards";
    if (view.type === "PROFILE" || view.type === "INVENTORY") return "profile";
    return null;
  }, [view.type]);
  const [rewardsSettings, setRewardsSettings] = useState<RewardsSettingsData>();
  const [pullPassSettings, setPullPassSettings] =
    useState<PullPassHeaderSettings>({ tiers: [] });
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
      if (
        isRewardsMenuOpen &&
        rewardsMenuRef.current &&
        !rewardsMenuRef.current.contains(target)
      ) {
        setIsRewardsMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleDocumentClick);
    document.addEventListener("touchstart", handleDocumentClick);
    return () => {
      document.removeEventListener("mousedown", handleDocumentClick);
      document.removeEventListener("touchstart", handleDocumentClick);
    };
  }, [isGamesMenuOpen, isRewardsMenuOpen]);

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
    let timeoutId: ReturnType<typeof window.setTimeout> | null = null;
    const enable = () => setEnableRewardsRealtime(true);
    if ("requestIdleCallback" in window)
      idleId = window.requestIdleCallback(enable, {
        timeout: 3000,
      }) as unknown as number;
    else timeoutId = window.setTimeout(enable, 3000);
    return () => {
      if (idleId !== null && "cancelIdleCallback" in window)
        window.cancelIdleCallback(idleId);
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
    const unsub = onSnapshot(
      doc(db, "settings", "pullPass"),
      (snap) => {
        const data = snap.data() as Record<string, unknown> | undefined;
        let tiers = Array.isArray(data?.tiers)
          ? (data?.tiers as PullPassHeaderTier[])
          : [];
        if (!tiers.length && typeof data?.tiersText === "string") {
          try {
            const parsed = JSON.parse(data.tiersText);
            tiers = Array.isArray(parsed) ? parsed : [];
          } catch {
            tiers = [];
          }
        }
        setPullPassSettings({ tiers });
      },
      (error) => {
        console.error("Pull Pass settings snapshot failed", error);
      },
    );
    return () => unsub();
  }, []);

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

  const nextPullPassReward = useMemo(() => {
    const tiers = pullPassSettings.tiers
      .map((tier, index) => ({
        tier: Math.max(1, Number(tier.tier ?? index + 1) || index + 1),
        xpRequired: Math.max(0, Number(tier.xpRequired ?? 0) || 0),
        freeReward:
          typeof tier.freeReward === "string" && tier.freeReward.trim()
            ? tier.freeReward.trim()
            : `Tier ${tier.tier ?? index + 1} Reward`,
      }))
      .sort((a, b) => a.tier - b.tier);
    const currentXp = Math.max(
      0,
      Number(
        (user as Record<string, unknown>).pullPassSeasonXp ??
          (user as Record<string, unknown>).pullPassXp ??
          0,
      ) || 0,
    );
    const nextTier = tiers.find((tier) => tier.xpRequired > currentXp);
    if (!nextTier) return null;
    const xpAway = Math.max(0, nextTier.xpRequired - currentXp);
    return {
      title: nextTier.freeReward,
      meta: `${xpAway.toLocaleString()} XP away`,
      imageUrl: getPullPassRewardImage(nextTier.freeReward),
      progress: Math.min(
        100,
        Math.max(0, (currentXp / Math.max(1, nextTier.xpRequired)) * 100),
      ),
      currentXp,
      xpRequired: nextTier.xpRequired,
    };
  }, [pullPassSettings.tiers, user]);

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
        | "PLINKO"
        | "PULL_PASS"
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
        type === "PULL_PASS" ||
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
      setIsRewardsMenuOpen(false);
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

  const dailySpinDesktopClass = `group relative flex w-full items-center gap-2 overflow-hidden rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-white/80 transition-all duration-200 ${
    showDailySpinReady
      ? "border border-blue-400/50 bg-blue-500/10 shadow-[0_0_16px_rgba(59,130,246,0.24)] hover:bg-blue-500/20"
      : "hover:bg-white/[0.07] hover:text-white"
  }`;

  const dailySpinMobileClass = `${drawerCardClass} group relative overflow-hidden transition-all ${
    showDailySpinReady
      ? "border-blue-400/60 bg-blue-500/10 shadow-[0_0_18px_rgba(59,130,246,0.25)] hover:bg-blue-500/20"
      : ""
  }`;
  const rewardsDesktopTabClass = `${activeDesktopSection === "rewards" ? desktopActiveNavButtonClass : desktopNavButtonClass} overflow-hidden ${showDailySpinReady ? "shadow-[0_0_18px_rgba(59,130,246,0.18)]" : ""}`;
  const rewardsMobileTabClass = `group relative flex w-full items-center justify-between overflow-hidden rounded-2xl border px-3 py-3 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition-all duration-200 ${
    showDailySpinReady
      ? "border-blue-400/60 bg-blue-500/10 shadow-[0_0_18px_rgba(59,130,246,0.22)] hover:bg-blue-500/20"
      : "border-white/10 bg-white/[0.045] hover:bg-white/[0.07]"
  }`;

  const toggleMobileSection = useCallback(
    (section: keyof typeof openMobileSections) => {
      setOpenMobileSections((prev) => ({ ...prev, [section]: !prev[section] }));
    },
    [],
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
          className={`${isSticky ? "pullz-mobile-header fixed inset-x-0 top-0" : "relative"} z-[120] border-b border-[#3a4146]/70 bg-[#1b2024] lg:px-4 lg:py-2`}
        >
          <div className="pt-[env(safe-area-inset-top,0px)]">
            <nav className="relative mx-auto flex h-[52px] max-w-7xl items-center justify-between px-3 sm:h-[56px] sm:px-4 lg:h-[72px] lg:max-w-none lg:rounded-[13px] lg:border lg:border-[#3a4146]/70 lg:bg-[#1b2024] lg:px-5 lg:shadow-[inset_0_1px_0_rgba(255,255,255,0.035),0_18px_58px_rgba(0,0,0,0.24)] xl:px-9">
              <div className="flex min-w-0 items-center gap-3 lg:gap-x-4 xl:gap-x-5">
                <button
                  type="button"
                  onClick={() => setIsMobileMenuOpen((open) => !open)}
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-[#3a4146]/70 bg-[#242b31] text-slate-300 transition-colors hover:text-white lg:hidden"
                  aria-label={isMobileMenuOpen ? "Close menu" : "Open menu"}
                  aria-expanded={isMobileMenuOpen}
                >
                  {isMobileMenuOpen ? (
                    <X className="h-4 w-4" />
                  ) : (
                    <Menu className="h-4 w-4" />
                  )}
                </button>
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

                <div className="hidden items-center gap-2 lg:flex xl:gap-3">
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
                    onClick={() => navigate("PLINKO")}
                    className={
                      activeDesktopSection === "upgrader"
                        ? desktopActiveNavButtonClass
                        : desktopNavButtonClass
                    }
                  >
                    Upgrader
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
                </div>
              </div>

              <div className="flex min-h-[42px] min-w-[132px] shrink-0 items-center justify-end gap-2 sm:min-w-[148px] sm:gap-3 lg:min-w-0 xl:min-w-[360px]">
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
                  <div className="flex min-h-[44px] min-w-[132px] items-center gap-2 lg:hidden">
                    <button
                      type="button"
                      onClick={handleSignIn}
                      className="relative inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] border border-[#273044]/80 bg-[#0e1420]/78 text-gray-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition-all duration-200 hover:border-blue-300/35 hover:bg-[#141d2d] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300/60"
                      aria-label="Sign in"
                    >
                      <LogIn className="h-4 w-4" />
                    </button>
                    {startPullingButton}
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
                  </div>
                )}
              </div>
            </nav>
          </div>
        </header>

        <button
          type="button"
          onClick={() => setIsMobileMenuOpen(false)}
          className={`fixed inset-x-0 bottom-[calc(var(--pullz-mobile-bottom-nav-height,72px)+var(--pullz-viewport-bottom-offset,0px))] z-[230] bg-black/80 transition-opacity duration-300 ease-out lg:hidden ${
            isSticky ? "top-[var(--pullz-header-height)]" : "top-0"
          } ${isMobileMenuOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"}`}
          aria-label="Close menu overlay"
        />

        <div
          className={`fixed inset-x-0 bottom-[calc(var(--pullz-mobile-bottom-nav-height,72px)+var(--pullz-viewport-bottom-offset,0px))] z-[240] w-full overflow-y-auto overscroll-contain border-t border-[#3a4146]/70 bg-[#1b2024] px-4 pb-4 pt-3 shadow-[0_-18px_48px_rgba(0,0,0,0.28)] transition-all duration-300 ease-out lg:hidden ${
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
          <div className="flex min-h-full flex-col pb-4 pt-1">
            <div className="mb-7 flex w-full items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => navigate("PROFILE")}
                className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl px-1 py-1 text-left transition-colors hover:bg-white/[0.045]"
              >
                {isAuthenticated ? (
                  <UserAvatar
                    user={user}
                    className="h-14 w-14 rounded-full object-cover ring-1 ring-purple-300/25"
                    initialsClassName="text-base"
                  />
                ) : (
                  <div className="grid h-14 w-14 place-items-center rounded-full border border-purple-300/25 bg-purple-500/10 text-base font-black text-purple-100">
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
                  className="shrink-0 rounded-xl border border-white/10 bg-white/[0.045] px-3 py-2 text-xs font-black uppercase text-slate-200 transition-colors hover:bg-white/[0.075]"
                >
                  Sign out
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSignIn}
                  className="shrink-0 rounded-xl border border-purple-300/25 bg-purple-500/15 px-3 py-2 text-xs font-black uppercase text-purple-100 transition-colors hover:bg-purple-500/25"
                >
                  Sign in
                </button>
              )}
            </div>

            <nav className="space-y-2" aria-label="Mobile menu links">
              <button
                onClick={() => navigate("HOME")}
                className={`flex min-h-14 w-full items-center gap-4 rounded-2xl px-4 text-left text-base font-extrabold transition-colors ${view.type === "HOME" ? "bg-purple-500/12 text-purple-100" : "text-slate-200 hover:bg-white/[0.055]"}`}
              >
                <HomeIcon className="h-5 w-5 text-purple-300" />
                Home
              </button>
              <button
                onClick={() => navigate("BOXES")}
                className={`flex min-h-14 w-full items-center gap-4 rounded-2xl px-4 text-left text-base font-extrabold transition-colors ${view.type === "BOXES" || view.type === "CASE_OPENING" ? "bg-purple-500/12 text-purple-100" : "text-slate-200 hover:bg-white/[0.055]"}`}
              >
                <Package className="h-5 w-5 text-purple-300" />
                Boxes
              </button>
              <button
                onClick={() => navigate("PLINKO")}
                className={`flex min-h-14 w-full items-center gap-4 rounded-2xl px-4 text-left text-base font-extrabold transition-colors ${view.type === "PLINKO" ? "bg-purple-500/12 text-purple-100" : "text-slate-200 hover:bg-white/[0.055]"}`}
              >
                <UpgraderIcon className="h-5 w-5 text-purple-300" />
                Upgrader
              </button>
              <button
                onClick={() => navigate("LEADERBOARD")}
                className={`flex min-h-14 w-full items-center gap-4 rounded-2xl px-4 text-left text-base font-extrabold transition-colors ${view.type === "LEADERBOARD" ? "bg-purple-500/12 text-purple-100" : "text-slate-200 hover:bg-white/[0.055]"}`}
              >
                <Trophy className="h-5 w-5 text-purple-300" />
                Leaderboard
              </button>
              <button
                onClick={() => navigate("PROFILE")}
                className={`flex min-h-14 w-full items-center gap-4 rounded-2xl px-4 text-left text-base font-extrabold transition-colors ${view.type === "PROFILE" || view.type === "INVENTORY" ? "bg-purple-500/12 text-purple-100" : "text-slate-200 hover:bg-white/[0.055]"}`}
              >
                <UserIcon className="h-5 w-5 text-purple-300" />
                Profile
              </button>
              {isAuthenticated && nextPullPassReward ? (
                <button
                  type="button"
                  onClick={() => navigate("PULL_PASS")}
                  className="mt-3 flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3 text-left transition-colors hover:bg-white/[0.06]"
                >
                  <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-purple-500/10">
                    {nextPullPassReward.imageUrl ? (
                      <img
                        src={nextPullPassReward.imageUrl}
                        alt=""
                        className="h-12 w-12 object-contain"
                        loading="lazy"
                        decoding="async"
                      />
                    ) : (
                      <span className="text-sm font-black text-purple-100">
                        XP
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">
                      Next Reward
                    </p>
                    <p className="truncate text-sm font-bold text-white">
                      {nextPullPassReward.title}
                    </p>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-800">
                      <div
                        className="h-full rounded-full bg-[linear-gradient(90deg,#7c3aed,#a855f7)]"
                        style={{ width: `${nextPullPassReward.progress}%` }}
                      />
                    </div>
                    <p className="mt-1 text-xs font-semibold text-slate-400">
                      {nextPullPassReward.meta}
                    </p>
                  </div>
                </button>
              ) : null}
            </nav>

            <div className="mt-auto space-y-2 border-t border-[#3a4146]/70 pt-4">
              <button
                onClick={() => navigate("REFERRALS")}
                className="flex min-h-14 w-full items-center gap-4 rounded-2xl px-4 text-left text-base font-extrabold text-slate-200 transition-colors hover:bg-white/[0.055]"
              >
                <Users className="h-5 w-5 text-purple-300" />
                Refer a Friend
              </button>
              <button
                onClick={() => navigate("CONTACT")}
                className="flex min-h-14 w-full items-center gap-4 rounded-2xl px-4 text-left text-base font-extrabold text-slate-200 transition-colors hover:bg-white/[0.055]"
              >
                <LifeBuoy className="h-5 w-5 text-purple-300" />
                Support
              </button>
            </div>
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
