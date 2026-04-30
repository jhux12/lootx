import React, { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Analytics } from '@vercel/analytics/react';
import { Header } from './components/Header';
import { LiveTicker } from './components/LiveTicker';
import { Hero } from './components/Hero';
import { BoxGrid } from './components/BoxGrid';
import { BoxCard } from './components/BoxCard';
import { BoxRow } from './components/BoxRow';
import { CategoryRow } from './components/CategoryRow';
import { BoxCatalog } from './components/BoxCatalog';
import { Bonuses } from './components/Bonuses';
import { LoginModal } from './components/LoginModal';
import { EmailVerificationModal } from './components/EmailVerificationModal';
import { EmailVerifiedModal } from './components/EmailVerifiedModal';
import { TopUpModal } from './components/TopUpModal';
import { LegalPage } from './components/LegalPage';
import { GameProvider, useGame } from './context/GameContext';
import { SoundProvider, useSound } from './context/SoundContext';
import { PreviewProvider } from './context/PreviewContext';
import { ShieldAlert } from 'lucide-react';
import { ResetPasswordModal } from './components/ResetPasswordModal';
import { HowItWorksSection } from './components/HowItWorksSection';
import { TrustSection } from './components/TrustSection';
import { FinalCTA } from './components/FinalCTA';
import { SiteFooter } from './components/SiteFooter';
import { ProvablyFairPage } from './components/ProvablyFairPage';
import { HomeBanners } from './components/HomeBanners';
import { CaseLabPromo } from './components/CaseLabPromo';
import { ContactSupport } from './components/ContactSupport';
import { MobileBottomNav } from './components/MobileBottomNav';
import { LegendaryShowcase } from './components/LegendaryShowcase';
import { ReferralsPage } from './components/ReferralsPage';
import { PollsPage } from './components/PollsPage';
import { SpinLandingPage } from './components/SpinLandingPage';
import { getBoxTags } from './utils/boxTags';
import { HomeReplica } from './components/HomeReplica';
import { VerifyEmailPage } from './components/VerifyEmailPage';
import { ToastProvider } from './src/ui/toast/ToastProvider';
import { InstallPrompt } from './src/ui/pwa/InstallPrompt';
import { SeoHead } from './components/SeoHead';
import { AdminGate } from './components/AdminGate';
import { trackEvent, trackMetaEvent } from './utils/trackEvent';
import { auth } from './firebase';
import PullToRefresh from './components/PullToRefresh';
import { setPostSignupRedirect } from './utils/postSignupRedirect';
import {
  ShowcaseRow,
  ShowcaseRowBoxes,
  ShowcaseRowCategories,
  normalizeShowcaseRows,
  subscribeHomepageConfig
} from './utils/homepageShowcase';

type ClarityWindow = Window &
  typeof globalThis & {
    clarity?: (...args: unknown[]) => void;
    __pullzClarityInitialized?: boolean;
    __pullzClarityNavigationTrackingInstalled?: boolean;
  };

const CLARITY_PROJECT_ID = 'wie0qmjc7c';

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

type HomeRowConfig = {
  id: string;
  title: string;
  query: {
    tags?: string[];
    maxPrice?: number;
    minPrice?: number;
  };
  limit: number;
};

const HOME_ROWS: HomeRowConfig[] = [
  { id: 'new', title: 'New Drops', query: { tags: ['new'] }, limit: 8 },
  { id: 'trending', title: 'Trending Now', query: { tags: ['trending'] }, limit: 8 },
  { id: 'budget', title: 'Budget Picks', query: { maxPrice: 500 }, limit: 8 },
  { id: 'high-roller', title: 'High Roller', query: { minPrice: 2000 }, limit: 8 }
];

type MainContentProps = {
  isChatCollapsed: boolean;
};

// Main content wrapper to handle view switching
const MainContent: React.FC<MainContentProps> = ({ isChatCollapsed }) => {
  const { view, showLoginModal, showTopUpModal, showEmailVerificationModal, showEmailVerifiedModal, isAuthenticated, user, setView, setShowLoginModal, boxes, openAuthModal } = useGame();
  const { playSound } = useSound();
  const [showcaseRows, setShowcaseRows] = useState<ShowcaseRow[] | null>(null);
  const [homepageDemoBoxId, setHomepageDemoBoxId] = useState<string | null>(null);
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
      const existingScript = document.querySelector<HTMLScriptElement>(`script[data-clarity-project-id="${CLARITY_PROJECT_ID}"]`);
      if (!existingScript) {
        const script = document.createElement('script');
        script.async = true;
        script.src = `https://www.clarity.ms/tag/${CLARITY_PROJECT_ID}`;
        script.setAttribute('data-clarity-project-id', CLARITY_PROJECT_ID);
        document.head.appendChild(script);
      }
    }

    if (!clarityWindow.__pullzClarityNavigationTrackingInstalled) {
      clarityWindow.__pullzClarityNavigationTrackingInstalled = true;

      const pushState = history.pushState.bind(history);
      const replaceState = history.replaceState.bind(history);

      history.pushState = function (...args) {
        pushState(...args);
        window.setTimeout(trackClarityPageView, 300);
      };

      history.replaceState = function (...args) {
        replaceState(...args);
        window.setTimeout(trackClarityPageView, 300);
      };

      window.addEventListener('popstate', () => {
        window.setTimeout(trackClarityPageView, 300);
      });

      window.addEventListener('load', trackClarityPageView);
    }

    trackClarityPageView();
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeHomepageConfig(
      (config) => {
        const rows = normalizeShowcaseRows(config?.showcaseRows);
        setShowcaseRows(rows.length ? rows : null);
        setHomepageDemoBoxId(config?.demoBoxId ?? null);
      },
      () => {
        setShowcaseRows(null);
        setHomepageDemoBoxId(null);
      }
    );
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    trackEvent('PageView', {
      page: view.type,
      path: window.location.pathname
    });
  }, [view.type]);

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

    window.addEventListener('scroll', onScroll, { passive: true });
    document.addEventListener('mouseout', onExitIntent);

    return () => {
      if (timeoutId) window.clearTimeout(timeoutId);
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
  }, [view.type]);

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
        const purchaseValue = Number(purchase.value);

        if (purchase.alreadyTracked !== true) {
          if (!Number.isFinite(purchaseValue) || purchaseValue <= 0) {
            trackedPurchaseSessionsRef.current.delete(sessionId);
            return;
          }

          console.log('[Meta] Purchase candidate data:', purchase);

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

          try {
            trackMetaEvent('Purchase', purchaseEventData, { eventID: eventId });
            console.log('[Meta] Purchase fired:', {
              value: purchaseValue,
              currency: normalizedCurrency,
              eventID: eventId
            });
          } catch (err) {
            console.warn('Meta Purchase tracking failed', err);
          }

          await fetch('/api/topup-purchase', {
            method: 'PATCH',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ sessionId })
          }).catch(() => undefined);
        }

        const nextParams = new URLSearchParams(window.location.search);
        nextParams.delete('topup');
        nextParams.delete('session_id');
        const nextSearch = nextParams.toString();
        const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ''}${window.location.hash}`;
        window.history.replaceState({}, '', nextUrl);
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
    () => boxes.filter(box => !box.isUserCreated && !box.isDaily && !(box.currencyType === 'XP' || Number(box.priceXP ?? 0) > 0)),
    [boxes]
  );

  const homeRows = useMemo(() => (
    HOME_ROWS.map((row) => {
      let filtered = baseHomeBoxes;
      const { maxPrice, minPrice } = row.query;
      if (row.query.tags?.length) {
        const targetTags = row.query.tags.map((tag) => tag.trim().toLowerCase()).filter(Boolean);
        filtered = filtered.filter((box) => {
          const boxTags = getBoxTags(box);
          return targetTags.some((tag) => boxTags.includes(tag));
        });
      }
      if (typeof maxPrice === 'number') {
        filtered = filtered.filter((box) => box.price <= maxPrice);
      }
      if (typeof minPrice === 'number') {
        filtered = filtered.filter((box) => box.price >= minPrice);
      }
      return {
        ...row,
        boxes: filtered.slice(0, row.limit)
      };
    })
  ), [baseHomeBoxes]);

  const showcaseRowsWithBoxes = useMemo(() => {
    if (!showcaseRows) return null;
    const boxMap = new Map(baseHomeBoxes.map((box) => [box.id, box]));
    return showcaseRows.map((row) => {
      if (row.type === 'categories') {
        return row;
      }
      const rowBoxes = row.boxIds
        .map((id) => boxMap.get(id))
        .filter((box): box is typeof baseHomeBoxes[number] => Boolean(box));
      return {
        ...row,
        boxes: rowBoxes
      };
    }) as Array<ShowcaseRowCategories | (ShowcaseRowBoxes & { boxes: typeof baseHomeBoxes })>;
  }, [baseHomeBoxes, showcaseRows]);

  const gridCols = {
    1: 'grid-cols-1',
    2: 'grid-cols-2',
    3: 'grid-cols-3',
    4: 'grid-cols-4',
    5: 'grid-cols-5',
    6: 'grid-cols-6'
  } as const;
  const smGridCols = {
    1: 'sm:grid-cols-1',
    2: 'sm:grid-cols-2',
    3: 'sm:grid-cols-3',
    4: 'sm:grid-cols-4',
    5: 'sm:grid-cols-5',
    6: 'sm:grid-cols-6'
  } as const;
  const lgGridCols = {
    1: 'lg:grid-cols-1',
    2: 'lg:grid-cols-2',
    3: 'lg:grid-cols-3',
    4: 'lg:grid-cols-4',
    5: 'lg:grid-cols-5',
    6: 'lg:grid-cols-6'
  } as const;
  const clampGrid = (value: number | undefined, fallback: number) => {
    if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
    return Math.min(6, Math.max(1, Math.round(value)));
  };



  return (
    <main className="flex-1 min-w-0 pb-[90px] sm:pb-10 transition-[width] duration-200 ease-[cubic-bezier(0.2,0.8,0.2,1)]">
      <Suspense fallback={<LoadingSpinner />}>
      {view.type === 'HOME' && (
        <HomeReplica
          boxes={baseHomeBoxes}
          demoBoxId={homepageDemoBoxId}
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
        <div className="fixed bottom-4 left-1/2 z-[130] w-[calc(100%-1rem)] max-w-md -translate-x-1/2 rounded-2xl border border-slate-500/25 bg-[#22282c]/95 p-4 shadow-[0_20px_45px_rgba(0,0,0,0.55)] backdrop-blur-md">
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
          {isAuthenticated ? (
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
          {isAuthenticated ? (
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
          <CaseOpening 
            boxId={view.boxId} 
            isFree={view.isFree}
          />
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
          <Profile />
        </div>
      )}

      {view.type === 'INVENTORY' && (
        <div className="w-full pt-6">
          <Profile initialTab="inventory" />
        </div>
      )}

      </Suspense>

      {/* Modals */}
      {showLoginModal && <LoginModal />}
      {showEmailVerificationModal && <EmailVerificationModal />}
      {showEmailVerifiedModal && <EmailVerifiedModal />}
      {showTopUpModal && <TopUpModal />}
      <SiteFooter />
    </main>
  );
};

function App() {
  return (
    <SoundProvider>
      <GameProvider>
        <PreviewProvider>
          <ToastProvider>
            <AppShell />
            <Analytics />
          </ToastProvider>
        </PreviewProvider>
      </GameProvider>
    </SoundProvider>
  );
}

export default App;

const AppShell = () => {
  const { view } = useGame();
  const shouldUseStickyHeader = view.type !== 'BOXES';

  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return undefined;

    const setAppHeight = () => {
      const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
      document.documentElement.style.setProperty('--app-height', `${viewportHeight}px`);
    };

    setAppHeight();
    window.addEventListener('resize', setAppHeight);
    window.visualViewport?.addEventListener('resize', setAppHeight);
    window.visualViewport?.addEventListener('scroll', setAppHeight);

    return () => {
      window.removeEventListener('resize', setAppHeight);
      window.visualViewport?.removeEventListener('resize', setAppHeight);
      window.visualViewport?.removeEventListener('scroll', setAppHeight);
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return undefined;
    if (!window.matchMedia('(pointer: coarse)').matches) return undefined;
    const userAgent = navigator.userAgent || '';
    const isInAppBrowser = /(FBAN|FBAV|Instagram|Line\/|MiuiBrowser|wv)/i.test(userAgent);
    if (isInAppBrowser) return undefined;

    let lastTouchEnd = 0;

    const preventDefault = (event: Event) => {
      event.preventDefault();
    };

    const handleTouchMove = (event: TouchEvent) => {
      if (event.touches.length > 1) {
        event.preventDefault();
      }
    };

    const handleTouchEnd = (event: TouchEvent) => {
      const now = Date.now();
      if (now - lastTouchEnd <= 300) {
        event.preventDefault();
      }
      lastTouchEnd = now;
    };

    document.addEventListener('gesturestart', preventDefault, { passive: false });
    document.addEventListener('gesturechange', preventDefault, { passive: false });
    document.addEventListener('gestureend', preventDefault, { passive: false });
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd, { passive: false });

    return () => {
      document.removeEventListener('gesturestart', preventDefault);
      document.removeEventListener('gesturechange', preventDefault);
      document.removeEventListener('gestureend', preventDefault);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, []);

  return (
    <PullToRefresh>
      <div className="min-h-[var(--app-height,100vh)] bg-[#1b2024] text-white font-sans selection:bg-blue-500 selection:text-white flex flex-col">
        <SeoHead view={view} />
        <Header
          onOpenInbox={() => undefined}
          isSticky={shouldUseStickyHeader}
        />
        <AppLayout hasStickyHeader={shouldUseStickyHeader} />
        <MobileBottomNav />
        <InstallPrompt />
        <ResetPasswordModal />
      </div>
    </PullToRefresh>
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
