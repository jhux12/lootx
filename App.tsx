import React, { useState } from 'react';
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
import { ShieldAlert, MessageCircle } from 'lucide-react';
import { MobileChatModal } from './components/MobileChatModal';

// Main content wrapper to handle view switching
const MainContent: React.FC = () => {
  const { view, showLoginModal, showTopUpModal, isAuthenticated, user, setView } = useGame();

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
          <Bonuses />
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

function App() {
  const [showSupportChat, setShowSupportChat] = useState(false);

  return (
    <SoundProvider>
      <GameProvider>
        <div className="min-h-screen bg-[#050811] text-white font-sans selection:bg-blue-500 selection:text-white flex flex-col">
          <Header />
          
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
