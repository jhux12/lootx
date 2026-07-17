import React, { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import { Header } from './components/Header';
import { GameProvider, useGame } from './context/GameContext';
import { SoundProvider, useSound } from './context/SoundContext';
import { PreviewProvider } from './context/PreviewContext';
import { ShieldAlert } from 'lucide-react';
import { ResetPasswordModal } from './components/ResetPasswordModal';
import { MobileBottomNav } from './components/MobileBottomNav';
import { HomeReplica } from './components/HomeReplica';
import { VerifyEmailPage } from './components/VerifyEmailPage';
import { ToastProvider } from './src/ui/toast/ToastProvider';
import { SeoHead } from './components/SeoHead';
import { AdminGate } from './components/AdminGate';
import { trackEvent, trackMetaEvent } from './utils/trackEvent';
import { auth } from './firebase';
import { setPostSignupRedirect } from './utils/postSignupRedirect';
import { HomepageAssetUrls, subscribeHomepageConfig } from './utils/homepageShowcase';
import { usePerformanceMode } from './src/lib/performance';
import { ErrorBoundary } from './components/ErrorBoundary';

type TawkApi = {
  hideWidget?: () => void;
  showWidget?: () => void;
  maximize?: () => void;
  onLoad?: () => void;
  onChatMinimized?: () => void;
  onChatHidden?: () => void;
};

type PullzWindow = Window &
  typeof globalThis & {
    Tawk_API?: TawkApi;
    Tawk_LoadStart?: Date;
  };

type ClarityWindow = PullzWindow & {
    clarity?: (...args: unknown[]) => void;
    __pullzClarityInitialized?: boolean;
    __pullzClarityNavigationTrackingInstalled?: boolean;
  };

const CLARITY_PROJECT_ID = 'wie0qmjc7c';

const runAfterIdleOrInteraction = (callback: () => void, timeout = 3500) => {
  if (typeof window === 'undefined') return () => undefined;
  let didRun = false;
  let idleId: number | null = null;
  let timeoutId: ReturnType<typeof globalThis.setTimeout> | null = null;
  const run = () => {
    if (didRun) return;
    didRun = true;
    cleanup();
    callback();
  };
  const cleanup = () => {
    window.removeEventListener('pointerdown', run);
    window.removeEventListener('keydown', run);
    window.removeEventListener('touchstart', run);
    if (idleId !== null && 'cancelIdleCallback' in window) window.cancelIdleCallback(idleId);
    if (timeoutId !== null) globalThis.clearTimeout(timeoutId);
  };
  window.addEventListener('pointerdown', run, { once: true, passive: true });
  window.addEventListener('keydown', run, { once: true });
  window.addEventListener('touchstart', run, { once: true, passive: true });
  if ('requestIdleCallback' in window) {
    idleId = window.requestIdleCallback(run, { timeout }) as unknown as number;
  } else {
    timeoutId = globalThis.setTimeout(run, timeout);
  }
  return cleanup;
};

const getClarity = () => {
  if (typeof window === 'undefined') return undefined;
  return (window as ClarityWindow).clarity;
};

const trackClarityEvent = (eventName: string) => {
  const clarity = getClarity();
  if (!clarity) return;
  clarity('event', eventName);
};

const trackClarityPageView = () => {
  if (typeof window === 'undefined') return;
  const pagePath = window.location.pathname || '/';
  const normalized = pagePath.replace(/[^a-z0-9/_-]/gi, '_') || '/';
  trackClarityEvent(`page_view_${normalized}`);
};

const BoxCatalog = lazy(() => import('./components/BoxCatalog').then((module) => ({ default: module.BoxCatalog })));
const Bonuses = lazy(() => import('./components/Bonuses').then((module) => ({ default: module.Bonuses })));
const LoginModal = lazy(() => import('./components/LoginModal').then((module) => ({ default: module.LoginModal })));
const EmailVerificationModal = lazy(() => import('./components/EmailVerificationModal').then((module) => ({ default: module.EmailVerificationModal })));
const EmailVerifiedModal = lazy(() => import('./components/EmailVerifiedModal').then((module) => ({ default: module.EmailVerifiedModal })));
const TopUpModal = lazy(() => import('./components/TopUpModal').then((module) => ({ default: module.TopUpModal })));
const LegalPage = lazy(() => import('./components/LegalPage').then((module) => ({ default: module.LegalPage })));
const SiteFooter = lazy(() => import('./components/SiteFooter').then((module) => ({ default: module.SiteFooter })));
const ProvablyFairPage = lazy(() => import('./components/ProvablyFairPage').then((module) => ({ default: module.ProvablyFairPage })));
const ContactSupport = lazy(() => import('./components/ContactSupport').then((module) => ({ default: module.ContactSupport })));
const TrustPage = lazy(() => import('./components/TrustPage').then((module) => ({ default: module.TrustPage })));
const ReferralsPage = lazy(() => import('./components/ReferralsPage').then((module) => ({ default: module.ReferralsPage })));
const PollsPage = lazy(() => import('./components/PollsPage').then((module) => ({ default: module.PollsPage })));
const SpinLandingPage = lazy(() => import('./components/SpinLandingPage').then((module) => ({ default: module.SpinLandingPage })));
const AdminPanel = lazy(() => import('./components/AdminPanel').then((module) => ({ default: module.AdminPanel })));
const CaseOpening = lazy(() => import('./components/CaseOpening').then((module) => ({ default: module.CaseOpening })));
const UpgraderPage = lazy(() => import('./src/pages/UpgraderPage'));
const UpgraderSettingsPage = lazy(() => import('./src/pages/admin/UpgraderSettingsPage'));
const UpgraderTargetsPage = lazy(() => import('./src/pages/admin/UpgraderTargetsPage'));
const Profile = lazy(() => import('./components/Profile').then((module) => ({ default: module.Profile })));
const Leaderboard = lazy(() => import('./components/Leaderboard').then((module) => ({ default: module.Leaderboard })));
const CustomCaseCreator = lazy(() => import('./components/CustomCaseCreator').then((module) => ({ default: module.CustomCaseCreator })));
const Quests = lazy(() => import('./components/Quests').then((module) => ({ default: module.Quests })));

const LoadingSpinner = React.memo(() => (
  <div className="flex min-h-[40vh] items-center justify-center" aria-live="polite" aria-busy="true">
    <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/20 border-t-cyan-300 will-change-transform" />
  </div>
));

const ModalLoadingShell = React.memo(() => (
  <div className="fixed inset-0 z-[200] grid place-items-center bg-black/65 px-4 backdrop-blur-sm" aria-busy="true" aria-live="polite">
    <div className="h-[360px] w-full max-w-md rounded-2xl border border-white/10 bg-[#151b22] shadow-2xl" />
  </div>
));
ModalLoadingShell.displayName = 'ModalLoadingShell';


const ProtectedPageLoading: React.FC = () => (
  <div className="mx-auto mt-10 w-full max-w-xl px-4">
    <div className="rounded-2xl border border-gray-800 bg-[#0b0e14] p-6 sm:p-10" aria-busy="true" aria-live="polite">
      <div className="mx-auto mb-4 h-12 w-12 animate-pulse rounded-full bg-white/10" />
      <div className="mx-auto mb-3 h-6 w-48 animate-pulse rounded-lg bg-white/10" />
      <div className="mx-auto h-4 w-full max-w-sm animate-pulse rounded-lg bg-white/5" />
      <p className="sr-only">Checking your sign-in status...</p>
    </div>
  </div>
);


const TAWK_SCRIPT_SRC = 'https://embed.tawk.to/6a4c4bec6f19351d47f86c36/1jst0h54s';
const TAWK_SCRIPT_ID = 'pullz-tawk-script';

const isAdminViewType = (viewType: string) => viewType === 'ADMIN' || viewType.startsWith('ADMIN_');

const PullzSupportChat: React.FC<{ isAdminPage: boolean }> = ({ isAdminPage }) => {
  const [isTabVisible, setIsTabVisible] = useState(!isAdminPage);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [hasLoadFailed, setHasLoadFailed] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return undefined;

    const pullzWindow = window as PullzWindow;
    const showTab = () => {
      setIsChatOpen(false);
      setIsTabVisible(!isAdminPage);
    };
    const hideDefaultWidget = () => {
      if (typeof pullzWindow.Tawk_API?.hideWidget === 'function') {
        pullzWindow.Tawk_API.hideWidget();
      }
    };

    pullzWindow.Tawk_API = pullzWindow.Tawk_API || {};
    pullzWindow.Tawk_LoadStart = pullzWindow.Tawk_LoadStart || new Date();
    pullzWindow.Tawk_API.onLoad = () => {
      setHasLoadFailed(false);
      hideDefaultWidget();
      showTab();
    };
    pullzWindow.Tawk_API.onChatMinimized = () => {
      hideDefaultWidget();
      showTab();
    };
    pullzWindow.Tawk_API.onChatHidden = showTab;

    const existingScript = document.getElementById(TAWK_SCRIPT_ID) as HTMLScriptElement | null;
    if (!existingScript) {
      const script = document.createElement('script');
      script.id = TAWK_SCRIPT_ID;
      script.async = true;
      script.src = TAWK_SCRIPT_SRC;
      script.charset = 'UTF-8';
      script.setAttribute('crossorigin', '*');
      script.onerror = () => {
        setHasLoadFailed(true);
        setIsChatOpen(false);
        setIsTabVisible(!isAdminPage);
      };
      document.body.appendChild(script);
    } else {
      existingScript.onerror = () => {
        setHasLoadFailed(true);
        setIsChatOpen(false);
        setIsTabVisible(!isAdminPage);
      };
      hideDefaultWidget();
    }

    return () => {
      if (pullzWindow.Tawk_API) {
        pullzWindow.Tawk_API.onLoad = undefined;
        pullzWindow.Tawk_API.onChatMinimized = undefined;
        pullzWindow.Tawk_API.onChatHidden = undefined;
      }
    };
  }, [isAdminPage]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const pullzWindow = window as PullzWindow;

    if (isAdminPage) {
      setIsTabVisible(false);
      setIsChatOpen(false);
      if (typeof pullzWindow.Tawk_API?.hideWidget === 'function') {
        pullzWindow.Tawk_API.hideWidget();
      }
      return;
    }

    if (!isChatOpen) {
      setIsTabVisible(true);
      if (typeof pullzWindow.Tawk_API?.hideWidget === 'function') {
        pullzWindow.Tawk_API.hideWidget();
      }
    }
  }, [isAdminPage, isChatOpen]);

  const openSupportChat = () => {
    if (isAdminPage || hasLoadFailed || typeof window === 'undefined') return;
    const tawkApi = (window as PullzWindow).Tawk_API;

    if (typeof tawkApi?.showWidget === 'function') {
      tawkApi.showWidget();
    }
    if (typeof tawkApi?.maximize === 'function') {
      tawkApi.maximize();
      setIsChatOpen(true);
      setIsTabVisible(false);
      return;
    }

    setIsTabVisible(true);
  };

  if (isAdminPage || !isTabVisible) return null;

  return (
    <button
      id="pullz-support-tab"
      type="button"
      aria-label={hasLoadFailed ? 'Support chat is unavailable' : 'Open support chat'}
      aria-disabled={hasLoadFailed}
      onClick={openSupportChat}
      title={hasLoadFailed ? 'Support chat is temporarily unavailable' : 'Open support chat'}
    >
      Support
    </button>
  );
};

const DeferredAnalytics = React.memo(() => {
  const [AnalyticsComponent, setAnalyticsComponent] = useState<React.ComponentType | null>(null);

  useEffect(() => runAfterIdleOrInteraction(() => {
    void import('@vercel/analytics/react')
      .then((module) => setAnalyticsComponent(() => module.Analytics))
      .catch((error: unknown) => {
        console.warn('Vercel Analytics failed to load', error);
      });
  }, 6500), []);

  return AnalyticsComponent ? <AnalyticsComponent /> : null;
});
DeferredAnalytics.displayName = 'DeferredAnalytics';
type MainContentProps = {
  isChatCollapsed: boolean;
};

// Main content wrapper to handle view switching
const MainContent: React.FC<MainContentProps> = ({ isChatCollapsed }) => {
  const { view, showLoginModal, showTopUpModal, showEmailVerificationModal, showEmailVerifiedModal, isAuthenticated, authInitialized, user, setView, setShowLoginModal, boxes, openAuthModal } = useGame();
  const { playSound } = useSound();
  const performanceMode = usePerformanceMode();
  const [homepageDemoBoxId, setHomepageDemoBoxId] = useState<string | null>(null);
  const [homepageTrendingBoxIds, setHomepageTrendingBoxIds] = useState<string[]>([]);
  const [homepageAssetUrls, setHomepageAssetUrls] = useState<HomepageAssetUrls>({});
  const trackedPurchaseSessionsRef = useRef<Set<string>>(new Set());
  const [showHomePrompt, setShowHomePrompt] = useState(false);
  const [homePromptVariant, setHomePromptVariant] = useState<'default' | 'returning'>('default');
  const homePromptTrackedRef = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    const clarityWindow = window as ClarityWindow;
    if (!clarityWindow.__pullzClarityInitialized) {
      clarityWindow.__pullzClarityInitialized = true;
      clarityWindow.clarity =
        clarityWindow.clarity ||
        ((...args: unknown[]) => {
          const queue = ((clarityWindow.clarity as unknown as { q?: unknown[][] }).q ??= []);
          queue.push(args);
        });
    }

    const clarityDelay = performanceMode.isMobile || performanceMode.isLowPower ? 9000 : 4500;
    const cancelClarityLoad = runAfterIdleOrInteraction(() => {
      if (document.visibilityState === 'hidden') return;
      const existingScript = document.querySelector<HTMLScriptElement>(`script[data-clarity-project-id="${CLARITY_PROJECT_ID}"]`);
      if (existingScript) return;
      const script = document.createElement('script');
      script.async = true;
      script.src = `https://www.clarity.ms/tag/${CLARITY_PROJECT_ID}`;
      script.setAttribute('data-clarity-project-id', CLARITY_PROJECT_ID);
      document.head.appendChild(script);
    }, clarityDelay);

    if (!clarityWindow.__pullzClarityNavigationTrackingInstalled) {
      clarityWindow.__pullzClarityNavigationTrackingInstalled = true;

      const pushState = history.pushState.bind(history);
      const replaceState = history.replaceState.bind(history);

      history.pushState = function (...args) {
        pushState(...args);
        if (document.visibilityState !== 'hidden') window.setTimeout(trackClarityPageView, 500);
      };

      history.replaceState = function (...args) {
        replaceState(...args);
        if (document.visibilityState !== 'hidden') window.setTimeout(trackClarityPageView, 500);
      };

      const onNavigation = () => {
        if (document.visibilityState === 'hidden') return;
        window.setTimeout(trackClarityPageView, 500);
      };

      window.addEventListener('popstate', onNavigation, { passive: true });
      window.addEventListener('load', trackClarityPageView, { once: true });
    }

    if (!performanceMode.isLowPower && document.visibilityState !== 'hidden') {
      trackClarityPageView();
    }
    return cancelClarityLoad;
  }, [performanceMode.isLowPower, performanceMode.isMobile]);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    const cancel = runAfterIdleOrInteraction(() => {
      unsubscribe = subscribeHomepageConfig(
        (config) => {
          const nextDemoBoxId = config?.demoBoxId ?? null;
          const nextTrendingBoxIds = config?.trendingBoxIds ?? [];
          setHomepageDemoBoxId((current) => (current === nextDemoBoxId ? current : nextDemoBoxId));
          setHomepageTrendingBoxIds((current) => (current.join('|') === nextTrendingBoxIds.join('|') ? current : nextTrendingBoxIds));
          setHomepageAssetUrls(config?.assetUrls ?? {});
        },
        () => {
          setHomepageDemoBoxId((current) => (current === null ? current : null));
          setHomepageTrendingBoxIds((current) => (current.length === 0 ? current : []));
          setHomepageAssetUrls({});
        }
      );
    }, 4200);
    return () => {
      cancel();
      unsubscribe?.();
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (document.visibilityState === 'hidden') return;
    const timeoutId = window.setTimeout(() => {
      trackEvent('PageView', {
        page: view.type,
        path: window.location.pathname
      });
    }, performanceMode.isLowPower ? 900 : 80);
    return () => window.clearTimeout(timeoutId);
  }, [performanceMode.isLowPower, view.type]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (view.type !== 'HOME' || isAuthenticated) return;
    if (window.sessionStorage.getItem('homePromptShown') === 'true' || window.sessionStorage.getItem('homePromptDismissed') === 'true') return;

    let timeoutId: number | null = window.setTimeout(() => {
      setShowHomePrompt(true);
      setHomePromptVariant('default');
    }, 22000);

    const showPrompt = (variant: 'default' | 'returning') => {
      if (window.sessionStorage.getItem('homePromptShown') === 'true' || window.sessionStorage.getItem('homePromptDismissed') === 'true') return;
      setHomePromptVariant(variant);
      setShowHomePrompt(true);
    };

    const onScroll = () => {
      const doc = document.documentElement;
      const maxScrollable = doc.scrollHeight - window.innerHeight;
      if (maxScrollable <= 0) return;
      const depth = (window.scrollY / maxScrollable) * 100;
      if (depth >= 45) {
        showPrompt('returning');
      }
    };

    const onExitIntent = (event: MouseEvent) => {
      if (window.innerWidth < 1024) return;
      if (event.clientY <= 6) {
        showPrompt('default');
      }
    };

    const listenerDelayId = window.setTimeout(() => {
      window.addEventListener('scroll', onScroll, { passive: true });
      document.addEventListener('mouseout', onExitIntent);
    }, 1500);

    return () => {
      if (timeoutId) window.clearTimeout(timeoutId);
      window.clearTimeout(listenerDelayId);
      window.removeEventListener('scroll', onScroll);
      document.removeEventListener('mouseout', onExitIntent);
    };
  }, [isAuthenticated, view.type]);

  useEffect(() => {
    if (!showHomePrompt || homePromptTrackedRef.current) return;
    homePromptTrackedRef.current = true;
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem('homePromptShown', 'true');
    }
    trackEvent('homepage_idle_prompt_shown', { variant: homePromptVariant });
  }, [homePromptVariant, showHomePrompt]);

  useEffect(() => {
    if (performanceMode.isLowPower) return;
    switch (view.type) {
      case 'CASE_OPENING':
        trackClarityEvent('view_case_page');
        break;
      case 'INVENTORY':
        trackClarityEvent('view_inventory');
        break;
      case 'PLINKO':
      case 'ADMIN_UPGRADER_SETTINGS':
      case 'ADMIN_UPGRADER_TARGETS':
        trackClarityEvent('view_upgrader');
        break;
      case 'BOXES':
      case 'CUSTOM_CREATOR':
        trackClarityEvent('view_marketplace');
        break;
      default:
        break;
    }
  }, [performanceMode.isLowPower, view.type]);

  useEffect(() => {
    if (showLoginModal) {
      trackClarityEvent('view_login_modal');
    }
  }, [showLoginModal]);

  useEffect(() => {
    if (showTopUpModal) {
      trackClarityEvent('view_topup_modal');
    }
  }, [showTopUpModal]);

  useEffect(() => {
    if (showEmailVerificationModal) {
      trackClarityEvent('view_email_verification_modal');
    }
  }, [showEmailVerificationModal]);

  useEffect(() => {
    if (showEmailVerifiedModal) {
      trackClarityEvent('view_email_verified_modal');
    }
  }, [showEmailVerifiedModal]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const firebaseUser = auth.currentUser;
    if (!isAuthenticated || !user || !firebaseUser) return;

    const params = new URLSearchParams(window.location.search);
    if (params.get('topup') !== 'success') return;

    const sessionId = params.get('session_id');
    if (!sessionId || trackedPurchaseSessionsRef.current.has(sessionId)) return;
    trackedPurchaseSessionsRef.current.add(sessionId);

    let isCancelled = false;

    const syncPurchaseTracking = async () => {
      try {
        const token = await firebaseUser.getIdToken();
        const response = await fetch('/api/topup-purchase', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ sessionId })
        });

        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload || isCancelled) {
          return;
        }

        if (payload.status !== 'ready') {
          trackedPurchaseSessionsRef.current.delete(sessionId);
          return;
        }

        const purchase = payload.purchase ?? {};
        const eventId = typeof purchase.eventID === 'string' && purchase.eventID.trim()
          ? purchase.eventID.trim()
          : `purchase_${sessionId}`;
        const firstDepositEventId = typeof purchase.firstDepositEventID === 'string' && purchase.firstDepositEventID.trim()
          ? purchase.firstDepositEventID.trim()
          : `first_deposit_${sessionId}`;
        const purchaseValue = Number(purchase.value);

        if (!Number.isFinite(purchaseValue) || purchaseValue <= 0) {
          trackedPurchaseSessionsRef.current.delete(sessionId);
          return;
        }

        const normalizedCurrency = 'USD';
        const purchaseEventData: Record<string, unknown> = {
          currency: normalizedCurrency,
          value: purchaseValue,
          content_name: typeof purchase.content_name === 'string' ? purchase.content_name : 'Top Up',
          content_ids: Array.isArray(purchase.content_ids) ? purchase.content_ids : undefined,
          content_type: 'product',
          num_items: 1
        };
        if (user.email) {
          purchaseEventData.em = user.email;
        }
        if (user.id) {
          purchaseEventData.external_id = user.id;
        }

        let markPurchaseTracked = false;
        let markFirstDepositTracked = false;

        if (purchase.alreadyTracked !== true) {
          console.log('[Meta] Purchase candidate data:', purchase);

          try {
            markPurchaseTracked = trackMetaEvent('Purchase', purchaseEventData, { eventID: eventId });
            if (markPurchaseTracked) {
              console.log('[Meta] Purchase fired:', {
                value: purchaseValue,
                currency: normalizedCurrency,
                eventID: eventId
              });
            }
          } catch (err) {
            console.warn('Meta Purchase tracking failed', err);
          }
        }

        if (purchase.isFirstDeposit === true && purchase.firstDepositAlreadyTracked !== true) {
          try {
            markFirstDepositTracked = trackMetaEvent('FirstDeposit', purchaseEventData, { eventID: firstDepositEventId });
            if (markFirstDepositTracked) {
              console.log('[Meta] FirstDeposit fired:', {
                value: purchaseValue,
                currency: normalizedCurrency,
                eventID: firstDepositEventId
              });
            }
          } catch (err) {
            console.warn('Meta FirstDeposit tracking failed', err);
          }
        }

        if (markPurchaseTracked || markFirstDepositTracked) {
          await fetch('/api/topup-purchase', {
            method: 'PATCH',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              sessionId,
              markPurchaseTracked,
              markFirstDepositTracked
            })
          }).catch(() => undefined);
        }

        const purchaseComplete =
          purchase.alreadyTracked === true ||
          markPurchaseTracked;
        const firstDepositComplete =
          purchase.isFirstDeposit !== true ||
          purchase.firstDepositAlreadyTracked === true ||
          markFirstDepositTracked;

        if (purchaseComplete && firstDepositComplete) {
          const nextParams = new URLSearchParams(window.location.search);
          nextParams.delete('topup');
          nextParams.delete('session_id');
          const nextSearch = nextParams.toString();
          const nextUrl =
            `${window.location.pathname}` +
            `${nextSearch ? `?${nextSearch}` : ''}` +
            `${window.location.hash}`;
          window.history.replaceState({}, '', nextUrl);
        } else {
          trackedPurchaseSessionsRef.current.delete(sessionId);
        }
      } catch (error) {
        trackedPurchaseSessionsRef.current.delete(sessionId);
        console.warn('Unable to finalize Meta purchase tracking', error);
      }
    };

    void syncPurchaseTracking();

    return () => {
      isCancelled = true;
    };
  }, [isAuthenticated, user?.id]);

  const baseHomeBoxes = useMemo(
    () => boxes.filter(box => !box.isUserCreated && !box.isDaily && !box.isPullPassBox && !(box.currencyType === 'XP' || Number(box.priceXP ?? 0) > 0)),
    [boxes]
  );





  return (
    <main className="flex-1 min-w-0 pb-[90px] sm:pb-10 transition-[width] duration-200 ease-[cubic-bezier(0.2,0.8,0.2,1)]">
      <Suspense fallback={<LoadingSpinner />}>
      {view.type === 'HOME' && (
        <HomeReplica
          boxes={baseHomeBoxes}
          demoBoxId={homepageDemoBoxId}
          trendingBoxIds={homepageTrendingBoxIds}
          assetUrls={homepageAssetUrls}
          isChatCollapsed={isChatCollapsed}
          onOpenBox={(boxId) => {
            playSound('click');
            setView({ type: 'CASE_OPENING', boxId });
          }}
          onViewAllBoxes={() => {
            playSound('click');
            setView({ type: 'BOXES' });
            window.history.replaceState({}, '', '/boxes');
          }}
          onSignUp={() => {
            playSound('click');
            trackEvent('signup_cta_clicked', { placement: 'home_hero' });
            setPostSignupRedirect('/case/free-box');
            openAuthModal('register');
          }}
        />
      )}
      {view.type === 'HOME' && showHomePrompt && !isAuthenticated && (
        <div className="fixed bottom-[calc(var(--pullz-mobile-bottom-nav-height,72px)+0.75rem)] left-1/2 z-[150] w-[calc(100%-1rem)] max-w-md -translate-x-1/2 rounded-2xl border border-slate-500/25 bg-[#22282c]/95 p-4 shadow-[0_20px_45px_rgba(0,0,0,0.55)] backdrop-blur-md lg:bottom-4">
          <p className="text-base font-bold text-white">{homePromptVariant === 'returning' ? 'Finish your free pull' : 'Your first pull is free 🎁'}</p>
          <p className="mt-1 text-sm text-slate-300">{homePromptVariant === 'returning' ? 'You’re one step away from opening your first box' : 'Open your first box — no deposit needed'}</p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => {
                trackEvent('homepage_idle_prompt_clicked', { action: 'primary' });
                trackEvent('signup_cta_clicked', { placement: 'home_prompt' });
                setPostSignupRedirect('/case/free-box');
                setShowHomePrompt(false);
                openAuthModal('register');
              }}
              className="flex-1 rounded-xl bg-slate-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors duration-200 hover:bg-slate-600"
            >
              Open Free Box
            </button>
            <button
              type="button"
              onClick={() => {
                if (typeof window !== 'undefined') {
                  window.sessionStorage.setItem('homePromptDismissed', 'true');
                }
                setShowHomePrompt(false);
              }}
              className="rounded-xl border border-slate-400/30 px-4 py-2.5 text-sm text-slate-200 transition-colors duration-200 hover:bg-slate-500/10"
            >
              Maybe later
            </button>
          </div>
        </div>
      )}
      
      {view.type === 'BOXES' && (
        <div className="w-full">
          <BoxCatalog isChatCollapsed={isChatCollapsed} />
        </div>
      )}

      {view.type === 'SPIN' && (
        <div className="w-full">
          <SpinLandingPage />
        </div>
      )}

      {view.type === 'BONUSES' && (
        <div className="w-full">
          {!authInitialized ? (
            <ProtectedPageLoading />
          ) : isAuthenticated ? (
            <Bonuses />
          ) : (
            <div className="max-w-xl mx-auto bg-[#0b0e14] border border-gray-800 rounded-2xl p-10 text-center mt-10">
              <ShieldAlert className="w-12 h-12 text-red-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-white mb-2">Sign in to access bonuses</h2>
              <p className="text-gray-400 mb-6">Bonuses, rakeback, and affiliate rewards are available to registered players only.</p>
              <button
                onClick={() => setShowLoginModal(true)}
                className="px-6 py-3 btn-logo-gradient text-white font-bold rounded-lg transition-colors"
              >
                Sign in
              </button>
            </div>
          )}
        </div>
      )}

      {view.type === 'QUESTS' && (
        <div className="w-full">
          {!authInitialized ? (
            <ProtectedPageLoading />
          ) : isAuthenticated ? (
            <Quests />
          ) : (
            <div className="max-w-xl mx-auto bg-[#0b0e14] border border-gray-800 rounded-2xl p-10 text-center mt-10">
              <ShieldAlert className="w-12 h-12 text-red-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-white mb-2">Sign in to access quests</h2>
              <p className="text-gray-400 mb-6">Complete daily actions and claim rewards once you're signed in.</p>
              <button
                onClick={() => setShowLoginModal(true)}
                className="px-6 py-3 btn-logo-gradient text-white font-bold rounded-lg transition-colors"
              >
                Sign in
              </button>
            </div>
          )}
        </div>
      )}

      {view.type === 'POLLS' && (
        <div className="w-full">
          <PollsPage />
        </div>
      )}

      {view.type === 'REFERRALS' && (
        <div className="w-full">
          <ReferralsPage />
        </div>
      )}

      {view.type === 'CONTACT' && (
        <div className="w-full">
          <ContactSupport />
        </div>
      )}

      {view.type === 'TERMS' && (
        <div className="w-full">
          <LegalPage variant="terms" />
        </div>
      )}

      {view.type === 'PRIVACY' && (
        <div className="w-full">
          <LegalPage variant="privacy" />
        </div>
      )}

      {view.type === 'FAQ' && (
        <div className="w-full">
          <TrustPage variant="faq" />
        </div>
      )}

      {view.type === 'ABOUT' && (
        <div className="w-full">
          <TrustPage variant="about" />
        </div>
      )}

      {view.type === 'SHIPPING_POLICY' && (
        <div className="w-full">
          <TrustPage variant="shipping" />
        </div>
      )}

      {view.type === 'REFUND_POLICY' && (
        <div className="w-full">
          <TrustPage variant="refund" />
        </div>
      )}

      {view.type === 'LEADERBOARD' && (
        <div className="w-full">
          <Leaderboard />
        </div>
      )}

      {view.type === 'ADMIN' && (
        <AdminGate>
          <div className="w-full">
            <AdminPanel />
          </div>
        </AdminGate>
      )}


      {view.type === 'PROVABLY_FAIR' && (
        <div className="w-full">
          <ProvablyFairPage />
        </div>
      )}

      {view.type === 'CUSTOM_CREATOR' && (
        <div className="w-full">
          <CustomCaseCreator />
        </div>
      )}

      {view.type === 'VERIFY_EMAIL' && (
        <div className="w-full">
          <VerifyEmailPage />
        </div>
      )}

      {view.type === 'CASE_OPENING' && (
        <div className="w-full">
          <ErrorBoundary
            title="Case opening needs a refresh"
            message="We could not render this case-opening view. Retry the view to continue without exposing internal details."
            actionLabel="Retry case opening"
          >
            <CaseOpening
              boxId={view.boxId}
              isFree={view.isFree}
              inventoryId={view.inventoryId}
              pullPassClaimTier={view.pullPassClaimTier}
            />
          </ErrorBoundary>
        </div>
      )}

      {view.type === 'PLINKO' && (
        <div className="w-full">
          <UpgraderPage />
        </div>
      )}

      {view.type === 'ADMIN_UPGRADER_SETTINGS' && (
        <AdminGate>
          <div className="w-full">
            <UpgraderSettingsPage />
          </div>
        </AdminGate>
      )}

      {view.type === 'ADMIN_UPGRADER_TARGETS' && (
        <AdminGate>
          <div className="w-full">
            <UpgraderTargetsPage />
          </div>
        </AdminGate>
      )}

      {view.type === 'PROFILE' && (
        <div className="w-full pt-6">
          {authInitialized ? <Profile /> : <ProtectedPageLoading />}
        </div>
      )}

      {view.type === 'INVENTORY' && (
        <div className="w-full pt-6">
          {authInitialized ? <Profile initialTab="inventory" /> : <ProtectedPageLoading />}
        </div>
      )}

      </Suspense>

      {/* Modals */}
      <Suspense fallback={<ModalLoadingShell />}>
        {showLoginModal && <LoginModal />}
        {showEmailVerificationModal && <EmailVerificationModal />}
        {showEmailVerifiedModal && <EmailVerifiedModal />}
        {showTopUpModal && <TopUpModal />}
      </Suspense>
      <Suspense fallback={<div className="min-h-[220px]" aria-hidden="true" />}>
        <SiteFooter />
      </Suspense>
    </main>
  );
};

function App() {
  return (
    <ErrorBoundary>
      <SoundProvider>
        <GameProvider>
        <PreviewProvider>
          <ToastProvider>
            <AppShell />
            <DeferredAnalytics />
          </ToastProvider>
        </PreviewProvider>
        </GameProvider>
      </SoundProvider>
    </ErrorBoundary>
  );
}

export default App;

const getNavigationScrollKey = (view: ReturnType<typeof useGame>['view']) => {
  switch (view.type) {
    case 'CASE_OPENING':
      return `${view.type}:${view.boxId ?? ''}:${view.isFree ? 'free' : 'paid'}`;
    case 'BATTLE_ARENA':
      return `${view.type}:${view.battleId ?? ''}`;
    case 'PROFILE':
      return `${view.type}:${view.userId ?? ''}`;
    default:
      return view.type;
  }
};

const AppShell = () => {
  const { view } = useGame();
  const shouldUseStickyHeader = true;
  const navigationScrollKey = getNavigationScrollKey(view);
  const previousNavigationScrollKey = useRef(navigationScrollKey);

  useEffect(() => {
    // Keep native mobile zoom behavior enabled (pinch + browser-level accessibility zoom).
    // Do not register gesture/touch preventDefault handlers here.
  }, []);

  useEffect(() => {
    if (previousNavigationScrollKey.current === navigationScrollKey) return undefined;
    previousNavigationScrollKey.current = navigationScrollKey;
    if (typeof window === 'undefined' || typeof document === 'undefined') return undefined;

    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [navigationScrollKey]);

  return (
    <div className="min-h-[100dvh] bg-[#1b2024] text-white font-sans selection:bg-blue-500 selection:text-white flex flex-col">
      <SeoHead view={view} />
      <Header
        onOpenInbox={() => undefined}
        isSticky={shouldUseStickyHeader}
      />
      <AppLayout hasStickyHeader={shouldUseStickyHeader} />
      <MobileBottomNav />
      <PullzSupportChat isAdminPage={isAdminViewType(view.type)} />
      <ResetPasswordModal />
    </div>
  );
};

const AppLayout: React.FC<{
  hasStickyHeader: boolean;
}> = ({ hasStickyHeader }) => {
  return (
    <div className={`flex flex-1 ${hasStickyHeader ? 'pt-[var(--pullz-header-height,72px)]' : ''}`}>
      <MainContent isChatCollapsed />
    </div>
  );
};
