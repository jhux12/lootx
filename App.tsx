import React, { useEffect, useMemo, useState } from 'react';
import { Header } from './components/Header';
import { LiveTicker } from './components/LiveTicker';
import { ChatSidebar } from './components/ChatSidebar';
import { Hero } from './components/Hero';
import { BoxGrid } from './components/BoxGrid';
import { BattlesList } from './components/BattlesList';
import { CaseOpening } from './components/CaseOpening';
import { Profile } from './components/Profile';
import { BattleArena } from './components/BattleArena';
import { Bonuses } from './components/Bonuses';
import { AdminPanel } from './components/AdminPanel';
import { LoginModal } from './components/LoginModal';
import { CustomCaseCreator } from './components/CustomCaseCreator';
import { Leaderboard } from './components/Leaderboard';
import { TopUpModal } from './components/TopUpModal';
import { GameProvider, useGame } from './context/GameContext';
import { SoundProvider } from './context/SoundContext';
import { ShieldAlert, MessageCircle, Swords, Trophy, Gift, FlaskConical } from 'lucide-react';
import { MobileChatModal } from './components/MobileChatModal';
import { FirstVisitModal, IntroContent } from './components/FirstVisitModal';

// Main content wrapper to handle view switching
const MainContent: React.FC = () => {
  const { view, showLoginModal, showTopUpModal, isAuthenticated, user, setView, setShowLoginModal } = useGame();

  return (
    <main className="flex-1 min-w-0 pb-10 xl:mr-80">
      <LiveTicker />
      
      {view.type === 'HOME' && (
        <div className="max-w-[1400px] mx-auto p-4 md:p-6 lg:p-8 animate-in fade-in duration-300">
          {!isAuthenticated && <Hero />}
          <BoxGrid />
          <BattlesList />
        </div>
      )}
      
      {view.type === 'BATTLES' && (
        <div className="max-w-[1400px] mx-auto p-4 md:p-6 lg:p-8 animate-in fade-in duration-300">
           <div className="mb-8">
               <h1 className="text-3xl font-bold text-white mb-2">Case Battles</h1>
               <p className="text-gray-400">Compete against other players for the best drops.</p>
           </div>
           <BattlesList />
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
                className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg transition-colors"
              >
                Sign in
              </button>
            </div>
          )}
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

      {/* Modals */}
      {showLoginModal && <LoginModal />}
      {showTopUpModal && <TopUpModal />}

      {/* Footer */}
      <footer className="mt-auto border-t border-gray-800/50 py-8 text-center text-gray-600 text-sm">
          <div className="flex justify-center gap-6 mb-4 font-medium flex-wrap px-4">
            <span className="cursor-pointer hover:text-gray-400">Terms of Service</span>
            <span className="cursor-pointer hover:text-gray-400">Privacy Policy</span>
            <span className="cursor-pointer hover:text-gray-400">Fairness</span>
            <span className="cursor-pointer hover:text-gray-400">Support</span>
          </div>
          <p>&copy; 2024 LootX. All rights reserved.</p>
      </footer>
    </main>
  );
};

const PageIntroManager: React.FC = () => {
  const { view, isAuthenticated } = useGame();
  const [isOpen, setIsOpen] = useState(false);
  const [content, setContent] = useState<IntroContent | null>(null);

  const contentMap = useMemo<Record<string, IntroContent | undefined>>(
    () => ({
      BATTLES: {
        key: 'lootx_intro_battles_v1',
        title: 'Battle smarter',
        subtitle: 'Join live lobbies, watch every pull, and chase multi-case jackpots in synced rounds.',
        icon: Swords,
        accent: 'from-brand-purple to-blue-500',
        tag: 'Battles page',
        highlights: [
          { title: 'Pick your lobby', description: 'Filter by price and player slots, then jump in before the countdown ends.' },
          { title: 'Track pulls live', description: 'Every spin streams in real time so you always know who is leading each round.' },
          { title: 'Rewards & rakeback', description: 'Battles still feed your XP and rakeback progress while you duel.' },
          { title: 'Fair results', description: 'Server-seeded rolls keep every round provably fair for all players.' }
        ],
        reminders: [
          'Fill empty slots with bots if you want to start quickly.',
          'Tie-breakers use total value pulled, so every cent counts.',
          'Multiplayer spins use the same odds as solo openings.',
          'You can return to the lobby from the arena without losing your spot.'
        ]
      },
      LEADERBOARD: {
        key: 'lootx_intro_leaderboard_v1',
        title: 'Climb the leaderboard',
        subtitle: 'See top rollers, streaks, and fresh high-value wins to scout who is hot right now.',
        icon: Trophy,
        accent: 'from-amber-400 to-orange-500',
        tag: 'Leaderboard page',
        highlights: [
          { title: 'Live momentum', description: 'Recent streaks and big wins refresh automatically so you never miss a run.' },
          { title: 'Profile deep dive', description: 'Tap a player to view their stats, followers, and current inventory highlights.' },
          { title: 'Friendly competition', description: 'Use the board to find rivals for battles or to follow rising players.' },
          { title: 'Seasonal resets', description: 'Ranks reset on schedule, keeping races tight and rewards attainable.' }
        ],
        reminders: [
          'Follow players you want to watch directly from their card.',
          'Your XP gains from cases and battles feed your leaderboard climb.',
          'Filters help you focus on daily, weekly, or all-time legends.',
          'Highlights are responsive—swipe through cards comfortably on mobile.'
        ]
      },
      BONUSES: {
        key: 'lootx_intro_bonuses_v1',
        title: 'Max your bonuses',
        subtitle: isAuthenticated
          ? 'Claim rakeback, streak perks, and event boosts tailored to your recent play.'
          : 'Sign in to unlock rakeback, streak perks, and seasonal boosts for your account.',
        icon: Gift,
        accent: 'from-emerald-400 to-teal-500',
        tag: 'Bonuses page',
        highlights: [
          { title: 'Rakeback ready', description: 'Earn and claim a share of every wager even while you explore new cases.' },
          { title: 'Daily streaks', description: 'Maintain consistent openings to unlock escalating daily rewards.' },
          { title: 'Event boosts', description: 'Special drops and limited events appear here first—check back often.' },
          { title: 'Affiliate perks', description: 'Use or share a code to generate extra value for both you and your friends.' }
        ],
        reminders: [
          isAuthenticated ? 'Set a reminder to claim rakeback frequently so it never caps out.' : 'Log in or register to reveal your available bonus tiers.',
          'Look for timers on streak rewards to know when the next boost is ready.',
          'Bonuses are mobile-first—quick claims take just a tap.',
          'Terms for each promo are summarized under the claim button.'
        ]
      },
      CUSTOM_CREATOR: {
        key: 'lootx_intro_caselab_v1',
        title: 'Welcome to Case Lab',
        subtitle: 'Prototype custom cases, tune the item mix, and publish your design to challenge friends.',
        icon: FlaskConical,
        accent: 'from-fuchsia-400 to-cyan-500',
        tag: 'Case Lab',
        highlights: [
          { title: 'Mix & test', description: 'Drag in items, set weights, and simulate spins to verify your payout curve.' },
          { title: 'Publish & share', description: 'Push your case live so others can open it or feature it in battles.' },
          { title: 'Mobile ready', description: 'All creator controls are touch-friendly for on-the-go edits.' },
          { title: 'Iterate fast', description: 'Duplicate an existing case to tweak odds without starting from scratch.' }
        ],
        reminders: [
          'Save drafts often so you can return later without losing tweaks.',
          'Testing spins use the same math as live openings for accurate previews.',
          'Preview images and names should match your theme for quick recognition.',
          'You can feature your case in a new battle right after publishing.'
        ]
      }
    }),
    [isAuthenticated]
  );

  useEffect(() => {
    const next = contentMap[view.type];
    if (!next) {
      setIsOpen(false);
      setContent(null);
      return;
    }

    setContent(next);
    const hidden = localStorage.getItem(next.key);
    setIsOpen(!hidden);
  }, [contentMap, view]);

  const handleClose = (dontShowAgain: boolean) => {
    if (content && dontShowAgain) {
      localStorage.setItem(content.key, 'true');
    }
    setIsOpen(false);
  };

  return <FirstVisitModal isOpen={isOpen} onClose={handleClose} content={content} />;
};

function App() {
  const [showSupportChat, setShowSupportChat] = useState(false);

  return (
    <SoundProvider>
      <GameProvider>
        <div className="min-h-screen bg-[#050811] text-white font-sans selection:bg-blue-500 selection:text-white flex flex-col">
          <Header />
          <PageIntroManager />
          
          <div className="flex flex-1">
            <MainContent />
            <ChatSidebar />
          </div>
          
          {/* Mobile Chat Icon */}
          <button
            onClick={() => setShowSupportChat(true)}
            className="fixed bottom-5 right-5 sm:bottom-6 sm:right-6 z-50 p-4 rounded-full shadow-2xl bg-gradient-to-r from-brand-purple to-blue-600 text-white flex items-center justify-center border border-white/10 sm:hidden hover:scale-105 active:scale-95 transition-transform"
            aria-label="Open support chat"
          >
            <MessageCircle className="w-5 h-5" />
          </button>

          {/* Mobile Chat Modal */}
          <MobileChatModal 
            isOpen={showSupportChat} 
            onClose={() => setShowSupportChat(false)} 
          />
        </div>
      </GameProvider>
    </SoundProvider>
  );
}

export default App;
