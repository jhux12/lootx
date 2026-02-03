import React, { useEffect, useState } from 'react';
import { Header } from './components/Header';
import { LiveWinsStrip } from './components/LiveWinsStrip';
import { ChatSidebar } from './components/ChatSidebar';
import { Hero } from './components/Hero';
import { BoxGrid } from './components/BoxGrid';
import { BoxCatalog } from './components/BoxCatalog';
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
import { ShieldAlert, MessageCircle, Swords } from 'lucide-react';
import { MobileChatModal } from './components/MobileChatModal';
import { ResetPasswordModal } from './components/ResetPasswordModal';
import { HowItWorks } from './components/HowItWorks';
import { TrustCards } from './components/TrustCards';
import { FinalCTA } from './components/FinalCTA';
import { Footer } from './components/Footer';

// Main content wrapper to handle view switching
const MainContent: React.FC = () => {
  const { view, showLoginModal, showTopUpModal, isAuthenticated, user, setView, setShowLoginModal } = useGame();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [view]);

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
    <main className={`flex-1 min-w-0 pb-10 ${isAuthenticated ? 'xl:mr-72' : ''}`}>
      
      {view.type === 'HOME' && (
        <div className="max-w-[1400px] mx-auto p-4 md:p-6 lg:p-8 animate-in fade-in duration-300">
          <Hero />
          <LiveWinsStrip />
          <BoxGrid />
          <HowItWorks />
          <TrustCards />
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
          <BoxCatalog />
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

      {view.type === 'INVENTORY' && (
        <div className="w-full pt-6">
          <Profile initialTab="inventory" />
        </div>
      )}

      {/* Modals */}
      {showLoginModal && <LoginModal />}
      {showTopUpModal && <TopUpModal />}

      <Footer />
    </main>
  );
};

const AppShell: React.FC = () => {
  const [showSupportChat, setShowSupportChat] = useState(false);
  const { isAuthenticated } = useGame();

  return (
    <div className="min-h-screen bg-[#050811] text-white font-sans selection:bg-blue-500 selection:text-white flex flex-col overflow-x-hidden">
      <Header />
      
      <div className="flex flex-1 pt-[72px] md:pt-[80px] lg:pt-[88px]">
        <MainContent />
        <ChatSidebar />
      </div>
      
      {/* Mobile Chat Icon */}
      <button
        onClick={() => setShowSupportChat(true)}
        className={`fixed bottom-5 right-5 sm:bottom-6 sm:right-6 z-50 p-4 rounded-full shadow-2xl bg-gradient-to-r from-brand-purple to-blue-600 text-white flex items-center justify-center border border-white/10 sm:hidden hover:scale-105 active:scale-95 transition-transform ${isAuthenticated ? 'opacity-80 hover:opacity-100' : ''}`}
        aria-label="Open support chat"
      >
        <MessageCircle className="w-5 h-5" />
      </button>

      {/* Mobile Chat Modal */}
      <MobileChatModal 
        isOpen={showSupportChat} 
        onClose={() => setShowSupportChat(false)} 
      />
      <ResetPasswordModal />
    </div>
  );
};

function App() {
  return (
    <SoundProvider>
      <GameProvider>
        <AppShell />
      </GameProvider>
    </SoundProvider>
  );
}

export default App;
