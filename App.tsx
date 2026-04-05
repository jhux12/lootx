import React, { Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react';
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
import PullToRefresh from './components/PullToRefresh';
import {
  ShowcaseRow,
  ShowcaseRowBoxes,
  ShowcaseRowCategories,
  normalizeShowcaseRows,
  subscribeHomepageConfig
} from './utils/homepageShowcase';


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

    const params = new URLSearchParams(window.location.search);
    const topUpStatus = params.get('topup');
    if (topUpStatus !== 'success') return;

    const sessionId = params.get('session_id');
    trackMetaEvent('Purchase', {
      content_name: 'TopUp',
      status: 'success'
    }, sessionId ? { eventID: `purchase_${sessionId}` } : undefined);
  }, []);

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
    if (!window.matchMedia('(pointer: coarse)').matches) return undefined;

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
      <div className="min-h-screen bg-[#050811] text-white font-sans selection:bg-blue-500 selection:text-white flex flex-col">
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
