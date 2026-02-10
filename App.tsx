import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Header } from './components/Header';
import { LiveTicker } from './components/LiveTicker';
import { ChatSidebar } from './components/ChatSidebar';
import { Hero } from './components/Hero';
import { BoxGrid } from './components/BoxGrid';
import { BoxCard } from './components/BoxCard';
import { BoxRow } from './components/BoxRow';
import { CategoryRow } from './components/CategoryRow';
import { BoxCatalog } from './components/BoxCatalog';
import { CaseOpening } from './components/CaseOpening';
import { Profile } from './components/Profile';
import { BattleArena } from './components/BattleArena';
import { Bonuses } from './components/Bonuses';
import { AdminPanel } from './components/AdminPanel';
import { LoginModal } from './components/LoginModal';
import { EmailVerificationModal } from './components/EmailVerificationModal';
import { EmailVerifiedModal } from './components/EmailVerifiedModal';
import { CustomCaseCreator } from './components/CustomCaseCreator';
import { Leaderboard } from './components/Leaderboard';
import { TopUpModal } from './components/TopUpModal';
import { LegalPage } from './components/LegalPage';
import { GameProvider, useGame } from './context/GameContext';
import { SoundProvider, useSound } from './context/SoundContext';
import { PreviewProvider } from './context/PreviewContext';
import { ShieldAlert, Swords } from 'lucide-react';
import { InboxModal } from './components/InboxModal';
import { ResetPasswordModal } from './components/ResetPasswordModal';
import { HowItWorksSection } from './components/HowItWorksSection';
import { TrustSection } from './components/TrustSection';
import { FinalCTA } from './components/FinalCTA';
import { SiteFooter } from './components/SiteFooter';
import { ProvablyFairPage } from './components/ProvablyFairPage';
import { HomeBanners } from './components/HomeBanners';
import { CaseLabPromo } from './components/CaseLabPromo';
import { ContactSupport } from './components/ContactSupport';
import { PromoPopupModal } from './components/PromoPopupModal';
import { MobileBottomNav } from './components/MobileBottomNav';
import { CookieConsentToast } from './components/CookieConsentToast';
import { LegendaryShowcase } from './components/LegendaryShowcase';
import { getBoxTags } from './utils/boxTags';
import { useSiteChat } from './hooks/useSiteChat';
import {
  ShowcaseRow,
  ShowcaseRowBoxes,
  ShowcaseRowCategories,
  normalizeShowcaseRows,
  subscribeHomepageConfig
} from './utils/homepageShowcase';

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
  const { view, showLoginModal, showTopUpModal, showEmailVerificationModal, showEmailVerifiedModal, isAuthenticated, user, setView, setShowLoginModal, boxes, openAuthModal, authInitialized } = useGame();
  const { playSound } = useSound();
  const [showcaseRows, setShowcaseRows] = useState<ShowcaseRow[] | null>(null);
  const [showPromoPopup, setShowPromoPopup] = useState(false);

  useEffect(() => {
    if (!authInitialized || isAuthenticated || view.type !== 'HOME') return undefined;
    if (typeof window === 'undefined') return undefined;
    const hasSeenPromo = window.sessionStorage.getItem('pullz_seen_promo_popup') === '1';
    if (hasSeenPromo) return undefined;

    const timeoutId = window.setTimeout(() => {
      setShowPromoPopup(true);
      window.sessionStorage.setItem('pullz_seen_promo_popup', '1');
    }, 7000);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [authInitialized, isAuthenticated, view.type]);

  useEffect(() => {
    if (isAuthenticated && showPromoPopup) {
      setShowPromoPopup(false);
    }
  }, [isAuthenticated, showPromoPopup]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(
      new CustomEvent('pullz:promo-visibility', {
        detail: { isOpen: showPromoPopup }
      })
    );
  }, [showPromoPopup]);

  const closePromoPopup = () => {
    setShowPromoPopup(false);
  };

  useEffect(() => {
    const unsubscribe = subscribeHomepageConfig(
      (config) => {
        const rows = normalizeShowcaseRows(config?.showcaseRows);
        setShowcaseRows(rows.length ? rows : null);
      },
      () => {
        setShowcaseRows(null);
      }
    );
    return () => unsubscribe();
  }, []);

  const baseHomeBoxes = useMemo(
    () => boxes.filter(box => !box.isUserCreated && !box.isDaily),
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

  const BattlesComingSoon = () => (
    <div className="mt-6 rounded-2xl border border-gray-800 bg-[#0b0e14] p-6 sm:p-8">
      <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-4">
          <div className="rounded-xl bg-purple-500/10 p-3 text-purple-400">
            <Swords className="h-6 w-6" />
          </div>
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-purple-500/30 bg-purple-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-purple-200">
              Coming Soon
            </div>
            <h2 className="mt-3 text-2xl font-bold text-white">Case Battles are on the way</h2>
            <p className="mt-2 text-sm text-gray-400 sm:text-base">
              We&apos;re polishing the battle arena experience. It&apos;s not available yet, but it will launch soon with
              mobile-first matchups and fair rewards.
            </p>
          </div>
        </div>
        <div className="rounded-xl border border-gray-800 bg-[#050811] px-4 py-3 text-left text-xs text-gray-400 sm:text-sm md:text-right">
          Check back soon for launch updates.
        </div>
      </div>
    </div>
  );

  return (
    <main className="flex-1 min-w-0 pb-[90px] sm:pb-10 transition-[width] duration-200 ease-[cubic-bezier(0.2,0.8,0.2,1)]">
      {view.type === 'HOME' && (
        <div className={`mx-auto flex flex-col gap-14 px-4 pb-16 pt-8 sm:px-6 lg:px-8 animate-in fade-in duration-300 ${isChatCollapsed ? 'max-w-[1280px]' : 'max-w-[1200px]'}`}>
          {!isAuthenticated && <Hero />}
          {showcaseRowsWithBoxes && showcaseRowsWithBoxes.length > 0 ? (
            <div className="space-y-12">
              {showcaseRowsWithBoxes.map((row) => {
                if (row.type === 'categories') {
                  return <CategoryRow key={row.id} row={row} />;
                }
                if (row.boxes.length === 0) return null;
                const mobileColumns = clampGrid(row.maxMobile, 2);
                const desktopColumns = clampGrid(row.maxDesktop, 4);
                const gridClassName = `grid ${gridCols[1]} gap-4 ${smGridCols[mobileColumns]} ${lgGridCols[desktopColumns]}`;
                return (
                  <section key={row.id} className="space-y-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="text-lg font-semibold text-white">{row.title}</h3>
                        {row.subtitle && <p className="text-sm text-gray-400">{row.subtitle}</p>}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          playSound('click');
                          setView({ type: 'BOXES' });
                          window.history.replaceState({}, '', '/boxes');
                        }}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-gray-400 transition hover:text-white"
                      >
                        View all
                      </button>
                    </div>
                    {row.layout === 'carousel' ? (
                      <div className="relative">
                        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 hidden w-10 bg-gradient-to-r from-[#050811] via-[#050811]/80 to-transparent sm:block" />
                        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 hidden w-10 bg-gradient-to-l from-[#050811] via-[#050811]/80 to-transparent sm:block" />
                        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-10 bg-gradient-to-r from-[#050811] via-[#050811]/90 to-transparent sm:hidden" />
                        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-10 bg-gradient-to-l from-[#050811] via-[#050811]/90 to-transparent sm:hidden" />
                        <div className="flex gap-3 overflow-x-auto pb-2 pt-1 snap-x snap-mandatory sm:gap-4 sm:overflow-visible">
                          {row.boxes.map((box) => (
                            <div key={box.id} className="min-w-[200px] snap-start sm:min-w-0">
                              <BoxCard
                                box={box}
                                size="compact"
                                onSelect={(boxId) => {
                                  playSound('click');
                                  setView({ type: 'CASE_OPENING', boxId });
                                }}
                                onHover={() => playSound('hover')}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className={gridClassName}>
                        {row.boxes.map((box) => (
                          <BoxCard
                            key={box.id}
                            box={box}
                            onSelect={(boxId) => {
                              playSound('click');
                              setView({ type: 'CASE_OPENING', boxId });
                            }}
                            onHover={() => playSound('hover')}
                          />
                        ))}
                      </div>
                    )}
                  </section>
                );
              })}
            </div>
          ) : (
            <>
              <BoxGrid />
              {homeRows.map((row) => (
                <BoxRow key={row.id} title={row.title} boxes={row.boxes} viewAllQuery={row.query} />
              ))}
            </>
          )}
          <HomeBanners />
          <LegendaryShowcase />
          <TrustSection />
          <HowItWorksSection />
          <CaseLabPromo />
          <section className="space-y-3">
            <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.3em] text-gray-500">
              <span>Live Wins</span>
            </div>
            <LiveTicker />
          </section>
          <FinalCTA />
        </div>
      )}
      
      {view.type === 'BATTLES' && (
        <div className="max-w-[1400px] mx-auto p-4 md:p-6 lg:p-8 animate-in fade-in duration-300">
           <div className="mb-8">
               <h1 className="text-3xl font-bold text-white mb-2">Case Battles</h1>
               <p className="text-gray-400">This feature is coming soon and is not yet available.</p>
           </div>
           <BattlesComingSoon />
        </div>
      )}

      {view.type === 'BOXES' && (
        <div className="w-full">
          <BoxCatalog isChatCollapsed={isChatCollapsed} />
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
        user.isAdmin ? (
          <div className="w-full">
            <AdminPanel />
          </div>
        ) : (
          <div className="w-full h-[60vh] flex flex-col items-center justify-center text-center p-4">
             <div className="bg-red-500/10 p-8 rounded-2xl border border-red-500/30 max-w-md animate-in zoom-in-95">
                <ShieldAlert className="w-16 h-16 text-red-500 mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-white mb-2">Access Denied</h2>
                <p className="text-gray-400 text-sm mb-6">
                    This area is restricted to authorized personnel only. 
                    Verification via Admin SDK failed.
                </p>
                <button 
                    onClick={() => setView({ type: 'HOME' })}
                    className="px-8 py-3 bg-gray-800 hover:bg-gray-700 rounded-lg text-white font-bold transition-colors border border-gray-700"
                >
                    Return Home
                </button>
             </div>
          </div>
        )
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

      {view.type === 'CASE_OPENING' && (
        <div className="w-full">
          <CaseOpening 
            boxId={view.boxId} 
            isFree={view.isFree}
          />
        </div>
      )}

      {view.type === 'BATTLE_ARENA' && (
        <div className="w-full pt-6">
          <BattleArena battleId={view.battleId} />
        </div>
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

      {/* Modals */}
      {showLoginModal && <LoginModal />}
      {showEmailVerificationModal && <EmailVerificationModal />}
      {showEmailVerifiedModal && <EmailVerifiedModal />}
      {showTopUpModal && <TopUpModal />}
      <PromoPopupModal
        isOpen={showPromoPopup}
        onClose={closePromoPopup}
        onSignUp={() => {
          playSound('click');
          closePromoPopup();
          openAuthModal('register');
        }}
        onSignIn={() => {
          playSound('click');
          closePromoPopup();
          openAuthModal('login');
        }}
      />

      <SiteFooter />
    </main>
  );
};

function App() {
  return (
    <SoundProvider>
      <GameProvider>
        <PreviewProvider>
          <AppShell />
        </PreviewProvider>
      </GameProvider>
    </SoundProvider>
  );
}

export default App;

const AppShell = () => {
  const [showInbox, setShowInbox] = useState(false);
  const { messages } = useSiteChat();
  const latestMessageAt = messages[messages.length - 1]?.createdAt ?? 0;
  const [lastSeenAt, setLastSeenAt] = useState(0);
  const hasUnseenChatMessages = latestMessageAt > lastSeenAt;
  const [isPromoVisible, setIsPromoVisible] = useState(false);
  const loadAnalyticsScripts = useCallback(() => {
    // Analytics integrations will be enabled after consent.
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handlePromoVisibility = (event: Event) => {
      const detail = (event as CustomEvent<{ isOpen: boolean }>).detail;
      setIsPromoVisible(Boolean(detail?.isOpen));
    };
    window.addEventListener('pullz:promo-visibility', handlePromoVisibility);
    return () => window.removeEventListener('pullz:promo-visibility', handlePromoVisibility);
  }, []);

  const markChatSeen = useCallback(() => {
    if (!latestMessageAt) return;
    setLastSeenAt((prev) => Math.max(prev, latestMessageAt));
  }, [latestMessageAt]);

  return (
    <div className="min-h-screen bg-[#050811] text-white font-sans selection:bg-blue-500 selection:text-white flex flex-col">
      <Header
        onOpenInbox={() => setShowInbox(true)}
        unreadChatCount={hasUnseenChatMessages ? 1 : 0}
      />
      <AppLayout
        hasUnseenChatMessages={hasUnseenChatMessages}
        onChatViewed={markChatSeen}
      />
      <MobileBottomNav />

      <InboxModal
        isOpen={showInbox}
        onClose={() => setShowInbox(false)}
        hasUnseenMessages={hasUnseenChatMessages}
        unreadChatCount={hasUnseenChatMessages ? 1 : 0}
        onChatViewed={markChatSeen}
      />
      <ResetPasswordModal />
      <CookieConsentToast onAnalyticsConsent={loadAnalyticsScripts} isPromoVisible={isPromoVisible} />
    </div>
  );
};

const AppLayout: React.FC<{
  hasUnseenChatMessages: boolean;
  onChatViewed: () => void;
}> = ({ hasUnseenChatMessages, onChatViewed }) => {
  const { isAuthenticated } = useGame();
  const [isChatCollapsed, setIsChatCollapsed] = useState(!isAuthenticated);

  useEffect(() => {
    setIsChatCollapsed(!isAuthenticated);
  }, [isAuthenticated]);

  const chatWidth = isChatCollapsed ? '64px' : '380px';

  return (
    <div
      className="flex flex-1 pt-[72px] md:pt-[80px] lg:pt-[88px]"
      style={{ '--chatw': chatWidth } as React.CSSProperties}
      data-chat-collapsed={isChatCollapsed}
    >
      <MainContent isChatCollapsed={isChatCollapsed} />
      <div
        className="relative hidden shrink-0 xl:flex transition-[width] duration-200 ease-[cubic-bezier(0.2,0.8,0.2,1)]"
        style={{ width: 'var(--chatw)' }}
      >
        <ChatSidebar
          isCollapsed={isChatCollapsed}
          onToggle={setIsChatCollapsed}
          hasUnseenMessages={hasUnseenChatMessages}
          onChatViewed={onChatViewed}
        />
      </div>
    </div>
  );
};
