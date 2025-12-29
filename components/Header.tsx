import React, { useEffect, useState } from 'react';
import { 
  Gamepad2, 
  Trophy, 
  Gift, 
  Bell, 
  Settings, 
  Plus, 
  ChevronDown, 
  User, 
  LogOut, 
  Menu, 
  X, 
  Swords, 
  Volume2, 
  VolumeX, 
  ShieldCheck, 
  FlaskConical, 
  PackageOpen
} from 'lucide-react';
import { useGame } from '../context/GameContext';
import { useSound } from '../context/SoundContext';

export const Header: React.FC = () => {
  const { user, balance, setView, isAuthenticated, setShowLoginModal, setShowTopUpModal, logout } = useGame();
  const { muted, toggleMute, playSound } = useSound();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [lootRevealActive, setLootRevealActive] = useState(false);

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const triggerAnimation = () => {
      setLootRevealActive(true);
      timeoutId = setTimeout(() => setLootRevealActive(false), 1700);
    };

    // Trigger once on mount
    triggerAnimation();
    // Then every 10s
    const intervalId = setInterval(triggerAnimation, 10000);

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      clearInterval(intervalId);
    };
  }, []);

  const handleNav = (view: any) => {
    playSound('click');
    if (view?.type === 'BONUSES' && !isAuthenticated) {
      setShowLoginModal(true);
      return;
    }
    setView(view);
  };

  const handleAuthAction = (action: () => void) => {
    playSound('click');
    if (!isAuthenticated) {
      setShowLoginModal(true);
    } else {
      action();
    }
  };

  return (
    <>
      <style>{`
        @keyframes loot-reveal {
          0% { 
            transform: scale(1) rotate(0deg) translateY(0); 
            filter: brightness(1) hue-rotate(0deg); 
          }
          10% { transform: scale(0.94) rotate(-3deg) translateY(0); }
          20% { transform: scale(0.92) rotate(3deg) translateY(0); }
          30% { transform: scale(0.9) rotate(-2deg) translateY(0); }
          40% { 
            transform: scale(1.5) rotate(0deg) translateY(-6px); 
            filter: brightness(2) hue-rotate(25deg); 
          }
          50% { 
            transform: scale(1.35) rotate(1deg) translateY(-8px); 
            filter: brightness(1.8) hue-rotate(35deg); 
          }
          70% { 
            transform: scale(1.05) rotate(0deg) translateY(-2px); 
            filter: brightness(1.1) hue-rotate(10deg); 
          }
          100% { 
            transform: scale(1) rotate(0deg) translateY(0); 
            filter: brightness(1) hue-rotate(0deg); 
          }
        }

        .animate-loot-reveal {
          animation: loot-reveal 1.7s ease-in-out;
        }
      `}</style>

      <header className="flex items-center justify-between px-4 md:px-6 py-3 bg-[#080b14] border-b border-gray-800/50 sticky top-0 z-50">
        <div className="flex items-center gap-4 lg:gap-10">
          
          {/* Mobile Menu Button */}
          <button 
            className="lg:hidden text-gray-400 hover:text-white"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>

          {/* Logo */}
          <div
            className="flex items-center gap-2 cursor-pointer hover:opacity-90 transition-opacity"
            onClick={() => handleNav({ type: 'HOME' })}
          >
            <span className="text-2xl md:text-3xl font-black italic text-white tracking-tight leading-none">
              PULLZ
            </span>
            <span
              className={`text-2xl md:text-3xl font-black tracking-tight leading-none not-italic bg-gradient-to-r from-[#8b5cf6] to-[#22d3ee] text-transparent bg-clip-text inline-block origin-left ${lootRevealActive ? 'animate-loot-reveal' : ''}`}
            >
              .GG
            </span>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-8">
            <button 
              onClick={() => handleNav({ type: 'HOME' })} 
              className="flex items-center gap-2 text-white hover:text-blue-400 transition-colors text-sm font-semibold"
            >
              <PackageOpen className="w-4 h-4" /> Cases
            </button>
            <button 
              onClick={() => handleNav({ type: 'BATTLES' })} 
              className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors text-sm font-medium"
            >
              <Swords className="w-4 h-4" /> Battles
            </button>
            <button 
              onClick={() => handleNav({ type: 'LEADERBOARD' })} 
              className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors text-sm font-medium"
            >
              <Trophy className="w-4 h-4" /> Leaderboard
            </button>
            <button 
              onClick={() => handleNav({ type: 'BONUSES' })} 
              className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors text-sm font-medium"
            >
              <Gift className="w-4 h-4" /> Bonuses
            </button>
            
            {/* Case Lab - Always Visible */}
            <button 
              onClick={() => handleAuthAction(() => setView({ type: 'CUSTOM_CREATOR' }))} 
              className="flex items-center gap-2 text-brand-purple hover:text-purple-400 transition-colors text-sm font-bold"
            >
              <FlaskConical className="w-4 h-4" /> Case Lab
            </button>

            {/* Admin Panel Link - Only visible to Admins */}
            {user.isAdmin && (
              <button 
                onClick={() => handleNav({ type: 'ADMIN' })} 
                className="flex items-center gap-2 text-red-500 hover:text-red-400 transition-colors text-sm font-bold ml-4 bg-red-500/10 px-3 py-1 rounded-full border border-red-500/20"
              >
                <ShieldCheck className="w-4 h-4" /> Admin
              </button>
            )}
          </nav>
        </div>

        {/* User Area */}
        <div className="flex items-center gap-3 md:gap-4">
          {/* Sound Toggle */}
          <button onClick={toggleMute} className="text-gray-500 hover:text-white transition-colors">
            {muted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
          </button>

          {isAuthenticated ? (
            <>
              <div className="flex items-center bg-[#111621] rounded-lg p-1 pr-3 border border-gray-800">
                <div className="bg-[#1a2130] px-2 md:px-3 py-1 rounded text-cyan-400 font-bold text-xs md:text-sm mr-2 md:mr-3">
                  ${balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <button 
                  onClick={() => setShowTopUpModal(true)}
                  className="bg-blue-600 hover:bg-blue-500 text-white rounded p-1 transition-colors active:scale-95"
                  title="Add Balance"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>

              <div className="group relative hidden md:block">
                <div className="flex items-center gap-2 text-gray-400 hover:text-white cursor-pointer border-r border-gray-800 pr-4">
                  <img 
                    src={user.avatar} 
                    className="w-8 h-8 rounded-lg border border-gray-700" 
                    alt="Avatar" 
                  />
                  <div className="flex flex-col">
                    <span className="text-sm font-medium leading-none max-w-[120px] truncate flex items-center gap-1">
                      {user.name}
                      {user.isAdmin && (
                        <span className="text-[9px] font-bold text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded-full border border-red-500/30">
                          Admin
                        </span>
                      )}
                    </span>
                    <span className="text-[10px] text-gray-500">Lvl {user.level}</span>
                  </div>
                  <ChevronDown className="w-3 h-3" />
                </div>

                {/* Desktop Dropdown */}
                <div className="absolute right-4 top-full mt-2 w-48 bg-[#151a23] border border-gray-800 rounded-xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 transform translate-y-2 group-hover:translate-y-0">
                  <div className="p-2">
                    <button 
                      onClick={() => handleNav({ type: 'PROFILE' })}
                      className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-300 hover:bg-gray-800 rounded-lg transition-colors text-left"
                    >
                      <User className="w-4 h-4" /> Profile
                    </button>
                    <button className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-300 hover:bg-gray-800 rounded-lg transition-colors text-left">
                      <Settings className="w-4 h-4" /> Settings
                    </button>
                    <div className="h-px bg-gray-800 my-1"></div>
                    <button 
                      onClick={logout}
                      className="w-full flex items-center gap-3 px-3 py-2 text-sm text-red-400 hover:bg-red-400/10 rounded-lg transition-colors text-left"
                    >
                      <LogOut className="w-4 h-4" /> Sign out
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 text-gray-500">
                <button className="hover:text-white transition-colors hidden sm:block">
                  <Bell className="w-4 h-4" />
                </button>
                <div className="flex items-center gap-2 md:hidden">
                  <img 
                    src={user.avatar} 
                    className="w-8 h-8 rounded-lg border border-gray-700" 
                    alt="Avatar" 
                    onClick={() => handleNav({ type: 'PROFILE' })} 
                  />
                  {user.isAdmin && (
                    <span className="text-[10px] font-bold text-red-400 bg-red-500/10 px-2 py-1 rounded-full border border-red-500/30">
                      Admin
                    </span>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-3">
              <button 
                onClick={() => { playSound('click'); setShowLoginModal(true); }}
                className="px-5 py-2 text-sm font-bold text-white bg-[#1a2130] hover:bg-[#232b3d] border border-gray-700 rounded-lg transition-colors"
              >
                Sign In
              </button>
              <button 
                onClick={() => { playSound('click'); setShowLoginModal(true); }}
                className="px-5 py-2 text-sm font-bold text-black bg-green-500 hover:bg-green-400 rounded-lg transition-colors hidden sm:block shadow-[0_0_15px_rgba(34,197,94,0.4)]"
              >
                Register
              </button>
            </div>
          )}
        </div>

        {/* Mobile Menu Overlay */}
        {isMobileMenuOpen && (
          <div className="fixed inset-0 top-[60px] bg-[#0b0e14] z-40 lg:hidden flex flex-col p-4 animate-in slide-in-from-left-full duration-200">
            <nav className="flex flex-col gap-2">
              <button 
                onClick={() => { handleNav({ type: 'HOME' }); setIsMobileMenuOpen(false); }} 
                className="flex items-center gap-3 px-4 py-3 bg-[#131720] rounded-lg text-white font-medium"
              >
                <PackageOpen className="w-5 h-5 text-blue-500" /> Cases
              </button>
              <button 
                onClick={() => { handleNav({ type: 'BATTLES' }); setIsMobileMenuOpen(false); }} 
                className="flex items-center gap-3 px-4 py-3 bg-[#131720] rounded-lg text-gray-300 font-medium"
              >
                <Swords className="w-5 h-5 text-purple-500" /> Battles
              </button>
              <button 
                onClick={() => { handleNav({ type: 'LEADERBOARD' }); setIsMobileMenuOpen(false); }} 
                className="flex items-center gap-3 px-4 py-3 bg-[#131720] rounded-lg text-gray-300 font-medium"
              >
                <Trophy className="w-5 h-5 text-yellow-500" /> Leaderboard
              </button>
              <button 
                onClick={() => { handleNav({ type: 'BONUSES' }); setIsMobileMenuOpen(false); }} 
                className="flex items-center gap-3 px-4 py-3 bg-[#131720] rounded-lg text-gray-300 font-medium"
              >
                <Gift className="w-5 h-5 text-green-500" /> Bonuses
              </button>
              {/* Case Lab Mobile */}
              <button 
                onClick={() => { 
                  handleAuthAction(() => setView({ type: 'CUSTOM_CREATOR' })); 
                  if (isAuthenticated) setIsMobileMenuOpen(false);
                }} 
                className="flex items-center gap-3 px-4 py-3 bg-[#131720] rounded-lg text-brand-purple font-medium"
              >
                <FlaskConical className="w-5 h-5" /> Case Lab
              </button>

              {user.isAdmin && (
                <button 
                  onClick={() => { handleNav({ type: 'ADMIN' }); setIsMobileMenuOpen(false); }} 
                  className="flex items-center gap-3 px-4 py-3 bg-[#131720] rounded-lg text-red-400 font-medium"
                >
                  <ShieldCheck className="w-5 h-5 text-red-500" /> Admin Panel
                </button>
              )}
              <hr className="border-gray-800 my-2" />
              
              {isAuthenticated ? (
                <>
                  <button 
                    onClick={() => { handleNav({ type: 'PROFILE' }); setIsMobileMenuOpen(false); }} 
                    className="flex items-center gap-3 px-4 py-3 bg-[#131720] rounded-lg text-gray-300 font-medium"
                  >
                    <User className="w-5 h-5 text-gray-400" /> Profile
                  </button>
                  <button 
                    onClick={() => { logout(); setIsMobileMenuOpen(false); }} 
                    className="flex items-center gap-3 px-4 py-3 bg-[#131720] rounded-lg text-red-400 font-medium"
                  >
                    <LogOut className="w-5 h-5" /> Sign out
                  </button>
                </>
              ) : (
                <button 
                  onClick={() => { setShowLoginModal(true); setIsMobileMenuOpen(false); }} 
                  className="flex items-center gap-3 px-4 py-3 bg-blue-600 rounded-lg text-white font-medium justify-center"
                >
                  Sign In
                </button>
              )}
            </nav>
          </div>
        )}
      </header>
    </>
  );
};
