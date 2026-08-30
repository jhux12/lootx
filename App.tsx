import React, { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Header } from './components/Header';
import { GameProvider, useGame } from './context/GameContext';
import { SoundProvider, useSound } from './context/SoundContext';
import { PreviewProvider } from './context/PreviewContext';
import { Ban, CreditCard, PackageX, ShieldAlert } from 'lucide-react';
import { ResetPasswordModal } from './components/ResetPasswordModal';
import { MobileBottomNav } from './components/MobileBottomNav';
import { HomeReplica } from './components/HomeReplica';
import { VerifyEmailPage } from './components/VerifyEmailPage';
import { ToastProvider } from './src/ui/toast/ToastProvider';
import { SeoHead } from './components/SeoHead';
import { AdminGate } from './components/AdminGate';
import { trackEvent, trackMetaEvent } from './utils/trackEvent';
import { auth, db } from './firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { setPostSignupRedirect } from './utils/postSignupRedirect';
import { subscribeHomepageConfig } from './utils/homepageShowcase';
import { PerformanceModeProvider, usePerformanceMode } from './src/lib/performance';
import { ErrorBoundary } from './components/ErrorBoundary';
import { CookieConsentToast } from './components/CookieConsentToast';
import { getCookieConsent, hasAnalyticsConsent } from './utils/cookieConsent';
import { initializeAnalytics, trackEvent as trackGaEvent, trackPageView } from './services/analytics';
import { clearPendingCheckout, getPendingCheckout } from './services/checkoutTracking';

type ClarityWindow = Window &
  typeof globalThis & {
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
const PhoneVerificationModal = lazy(() => import('./components/PhoneVerificationModal').then((module) => ({ default: module.PhoneVerificationModal })));
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


const DeferredAnalytics = React.memo(({ viewType }: { viewType: string }) => {
  const [AnalyticsComponent, setAnalyticsComponent] = useState<React.ComponentType | null>(null);

  useEffect(() => runAfterIdleOrInteraction(() => {
    initializeAnalytics();
    trackPageView(viewType);
  }), [viewType]);

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
  const trackedPurchaseSessionsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    // Session replay is strictly opt-in and avoided on constrained/mobile sessions.
    const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData === true;
    if (!hasAnalyticsConsent(getCookieConsent()) || performanceMode.isMobile || performanceMode.isLowPower || performanceMode.prefersReducedMotion || saveData) return;
    // Stable per-session 10% sample prevents a sampling flip during navigation.
    const sampleKey = 'pullz:clarity-sample';
    const sampled = sessionStorage.getItem(sampleKey) ?? (Math.random() < 0.1 ? '1' : '0');
    sessionStorage.setItem(sampleKey, sampled);
    if (sampled !== '1') return;

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
  }, [performanceMode.isLowPower, performanceMode.isMobile, performanceMode.prefersReducedMotion]);

  useEffect(() => {
    // Trending selections determine the first homepage content users see, so do
    // not defer this subscription behind the rest of the non-critical work.
    return subscribeHomepageConfig(
      (config) => {
        const nextDemoBoxId = config?.demoBoxId ?? null;
        const nextTrendingBoxIds = config?.trendingBoxIds ?? [];
        setHomepageDemoBoxId((current) => (current === nextDemoBoxId ? current : nextDemoBoxId));
        setHomepageTrendingBoxIds((current) => (current.join('|') === nextTrendingBoxIds.join('|') ? current : nextTrendingBoxIds));
      },
      () => {
        setHomepageDemoBoxId((current) => (current === null ? current : null));
        setHomepageTrendingBoxIds((current) => (current.length === 0 ? current : []));
      }
    );
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

  const handleAnalyticsConsent = useCallback(() => {
    initializeAnalytics();
    trackPageView(view.type);
  }, [view.type]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const status = params.get('topup');
    if (status !== 'success' && status !== 'cancel') return;

    const pending = getPendingCheckout();
    const sessionId = params.get('session_id') || pending?.sessionId;
    trackGaEvent('checkout_return', {
      checkout_status: status,
      checkout_session_id: sessionId || undefined,
      package_id: pending?.packageId,
      checkout_source: pending?.source
    }, `${status}:${sessionId || 'unknown'}`);

    if (status !== 'cancel') return;

    trackGaEvent('checkout_abandoned', {
      abandonment_reason: 'stripe_cancel_return',
      checkout_session_id: sessionId || undefined,
      package_id: pending?.packageId,
      currency: pending?.currency,
      value: pending?.value,
      checkout_source: pending?.source,
      elapsed_seconds: pending?.startedAt
        ? Math.max(0, Math.floor((Date.now() - pending.startedAt) / 1000))
        : undefined
    }, sessionId || 'unknown');
    clearPendingCheckout(sessionId);

    params.delete('topup');
    params.delete('session_id');
    const nextSearch = params.toString();
    window.history.replaceState(
      {},
      '',
      `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ''}${window.location.hash}`
    );
  }, []);

  useEffect(() => {
    if (performanceMode.isLowPower) return;
    switch (view.type) {
      case 'CASE_OPENING':
        trackClarityEvent('view_case_page');
        break;
      case 'INVENTORY':
        trackClarityEvent('view_inventory');
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
          clearPendingCheckout(sessionId);
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






  return (
    <main className="flex-1 min-w-0 pb-[90px] sm:pb-10 transition-[width] duration-200 ease-[cubic-bezier(0.2,0.8,0.2,1)]">
      <Suspense fallback={<LoadingSpinner />}>
      {view.type === 'HOME' && (
        <HomeReplica
          demoBoxId={homepageDemoBoxId}
          trendingBoxIds={homepageTrendingBoxIds}
          isChatCollapsed={isChatCollapsed}
          onOpenBox={(boxId, isFree = false) => {
            playSound('click');
            setView({ type: 'CASE_OPENING', boxId, isFree });
          }}
          onViewAllBoxes={(query) => {
            playSound('click');
            setView({ type: 'BOXES' });
            window.history.replaceState({}, '', `/boxes${query ?? ''}`);
          }}
          onSignUp={() => {
            playSound('click');
            trackEvent('signup_cta_clicked', { placement: 'home_hero' });
            setPostSignupRedirect('/case/free-box');
            openAuthModal('register');
          }}
        />
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
        <PhoneVerificationModal />
        {showEmailVerificationModal && <EmailVerificationModal />}
        {showEmailVerifiedModal && <EmailVerifiedModal />}
        {showTopUpModal && <TopUpModal />}
      </Suspense>
      <Suspense fallback={<div className="min-h-[220px]" aria-hidden="true" />}>
        <SiteFooter />
      </Suspense>
      <CookieConsentToast onAnalyticsConsent={handleAnalyticsConsent} />
      <DeferredAnalytics viewType={view.type} />
    </main>
  );
};

function App() {
  return (
    <ErrorBoundary>
      <SoundProvider>
        <GameProvider>
        <PreviewProvider>
          <PerformanceModeProvider>
            <ToastProvider>
              <AppShell />
            </ToastProvider>
          </PerformanceModeProvider>
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
  const { view, user, isAuthenticated, setView } = useGame();
  const shouldUseStickyHeader = true;
  const isAccountBanned = isAuthenticated && user.status === 'banned';
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
    <div className="flex min-h-[100dvh] flex-col bg-[radial-gradient(circle_at_70%_6%,rgba(91,69,221,0.11),transparent_30rem),#0f1118] font-sans text-white selection:bg-violet-500 selection:text-white">
      <SeoHead view={view} />
      <Header onOpenInbox={() => undefined} isSticky={shouldUseStickyHeader} />
      {isAccountBanned && (
        <div className="fixed inset-x-0 top-[var(--pullz-header-height,72px)] z-[90] border-y border-red-400/40 bg-red-950 px-3 py-2.5 text-center text-xs font-semibold text-red-50 shadow-lg sm:text-sm" role="alert">
          Your account is banned for violating our Terms of Service. Think this is an error?{' '}
          <button className="font-bold underline decoration-red-300 underline-offset-2 hover:text-white" onClick={() => setView({ type: 'CONTACT' })}>Contact customer support</button>.
        </div>
      )}
      {isAccountBanned && view.type !== 'CONTACT' ? (
        <div className="flex flex-1 pt-[calc(var(--pullz-header-height,72px)+48px)]">
          <section className="mx-auto flex w-full max-w-3xl flex-col items-center px-4 py-10 text-center sm:py-16">
            <Ban className="mb-4 h-12 w-12 text-red-400" aria-hidden="true" />
            <h1 className="text-2xl font-black text-white sm:text-3xl">Account features are disabled</h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-gray-400 sm:text-base">Top ups, box openings, rewards, shipments, selling, games, and other account actions are unavailable while this ban is active.</p>
            <div className="mt-7 grid w-full grid-cols-1 gap-3 sm:grid-cols-3" aria-label="Disabled account features">
              {[['Top ups', CreditCard], ['Box openings', PackageX], ['Shipments & rewards', ShieldAlert]].map(([label, Icon]) => (
                <div key={label as string} aria-disabled="true" className="flex min-h-24 items-center justify-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 text-gray-500 grayscale opacity-60">
                  <Icon className="h-5 w-5" /><span className="font-bold">{label as string}</span>
                </div>
              ))}
            </div>
            <button onClick={() => setView({ type: 'CONTACT' })} className="mt-8 min-h-11 w-full rounded-xl bg-red-600 px-5 py-3 font-bold text-white hover:bg-red-500 sm:w-auto">Contact customer support</button>
          </section>
        </div>
      ) : <AppLayout hasStickyHeader={shouldUseStickyHeader} hasBanBanner={isAccountBanned} />}
      <div className={isAccountBanned ? 'pointer-events-none grayscale opacity-40' : ''} aria-disabled={isAccountBanned || undefined}><MobileBottomNav /></div>
      <ResetPasswordModal />
    </div>
  );
};

const AppLayout: React.FC<{
  hasStickyHeader: boolean;
  hasBanBanner?: boolean;
}> = ({ hasStickyHeader, hasBanBanner = false }) => {
  return (
    <div className={`flex flex-1 ${hasStickyHeader ? 'pt-[var(--pullz-header-height,72px)]' : ''} ${hasBanBanner ? 'pt-[calc(var(--pullz-header-height,72px)+48px)]' : ''}`}>
      <MainContent isChatCollapsed />
    </div>
  );
};
