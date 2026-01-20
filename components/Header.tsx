import React, { useEffect, useRef, useState } from 'react';
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
import { CoinAmount } from './CoinAmount';

export const Header: React.FC = () => {
  const {
    user,
    balance,
    setView,
    isAuthenticated,
    setShowLoginModal,
    setShowTopUpModal,
    logout,
    notifications,
    dismissNotification,
    clearNotifications
  } = useGame();
  const { muted, toggleMute, playSound } = useSound();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const ggRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    const gg = ggRef.current;
    if (!gg) return undefined;

    const isDesktop = () => window.matchMedia('(min-width: 769px)').matches;
    let spinTimeoutId: ReturnType<typeof setTimeout> | undefined;
    let startTimeoutId: ReturnType<typeof setTimeout> | undefined;

    const run = () => {
      if (!isDesktop() || gg.classList.contains('is-spinning')) return;
      gg.classList.add('is-spinning');

      spinTimeoutId = window.setTimeout(() => {
        gg.classList.remove('is-spinning');
      }, 1350);
    };

    startTimeoutId = window.setTimeout(run, 1200);
    const intervalId = window.setInterval(run, 6500);

    const handleResize = () => {
      if (!isDesktop()) gg.classList.remove('is-spinning');
    };

    window.addEventListener('resize', handleResize);

    return () => {
      if (spinTimeoutId) window.clearTimeout(spinTimeoutId);
      if (startTimeoutId) window.clearTimeout(startTimeoutId);
      window.clearInterval(intervalId);
      window.removeEventListener('resize', handleResize);
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

  const notificationCount = notifications.length;

  return (
    <>
      <style>{`
        .brand {
          display: flex;
          align-items: center;
          gap: 10px;
          text-decoration: none;
          font-family: 'Satoshi', 'Inter', sans-serif;
        }

        .brand__icon {
          width: 38px;
          height: 38px;
          display: block;
          filter: drop-shadow(0 0 14px rgba(170, 90, 255, 0.25));
        }

        .brand__wordmark {
          display: flex;
          align-items: baseline;
          gap: 6px;
          font-weight: 800;
          letter-spacing: 0.2px;
          color: #fff;
        }

        @media (max-width: 768px) {
          .brand__wordmark {
            display: none;
          }

          .brand__icon {
            width: 44px;
            height: 44px;
          }
        }

        @media (min-width: 769px) {
          .brand__wordmark {
            display: flex;
          }
        }

        .gg {
          position: relative;
          display: inline-block;
          width: 52px;
          height: 28px;
        }

        .gg__text,
        .gg__spinner {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: flex-end;
          justify-content: flex-start;
        }

        .gg__text {
          font-size: 26px;
          line-height: 1;
          opacity: 1;
          transform: scale(1);
          transition: opacity 0.25s ease, transform 0.25s ease, filter 0.25s ease;
          filter: drop-shadow(0 0 10px rgba(120, 210, 255, 0.18));
        }

        .gg__spinner {
          opacity: 0;
          transform: scale(0.75);
          transition: opacity 0.25s ease, transform 0.25s ease;
          align-items: center;
          justify-content: center;
        }

        .gg.is-spinning .gg__text {
          opacity: 0;
          transform: scale(0.85);
          filter: blur(1px);
        }

        .gg.is-spinning .gg__spinner {
          opacity: 1;
          transform: scale(1);
        }

        .wheel {
          position: relative;
          width: 26px;
          height: 26px;
          border-radius: 999px;
          background: radial-gradient(circle at 30% 30%, rgba(120, 210, 255, 0.55), rgba(215, 115, 255, 0.35));
          box-shadow: 0 0 16px rgba(200, 120, 255, 0.35);
          overflow: hidden;
        }

        .wheel__tick {
          position: absolute;
          left: 50%;
          top: 50%;
          width: 2px;
          height: 11px;
          background: rgba(255, 255, 255, 0.65);
          transform-origin: 0 0;
          transform: translate(-1px, -11px) rotate(0deg);
          opacity: 0.75;
        }

        .wheel__tick:nth-child(1) {
          transform: translate(-1px, -11px) rotate(0deg);
        }

        .wheel__tick:nth-child(2) {
          transform: translate(-1px, -11px) rotate(60deg);
        }

        .wheel__tick:nth-child(3) {
          transform: translate(-1px, -11px) rotate(120deg);
        }

        .wheel__tick:nth-child(4) {
          transform: translate(-1px, -11px) rotate(180deg);
        }

        .wheel__tick:nth-child(5) {
          transform: translate(-1px, -11px) rotate(240deg);
        }

        .wheel__tick:nth-child(6) {
          transform: translate(-1px, -11px) rotate(300deg);
        }

        .wheel__needle {
          position: absolute;
          right: 2px;
          top: 50%;
          width: 0;
          height: 0;
          transform: translateY(-50%);
          border-left: 7px solid rgba(255, 255, 255, 0.85);
          border-top: 5px solid transparent;
          border-bottom: 5px solid transparent;
          filter: drop-shadow(0 0 8px rgba(255, 255, 255, 0.25));
        }

        .gg.is-spinning .wheel {
          animation: spinWheel 1.15s cubic-bezier(0.12, 0.78, 0.2, 1) both;
        }

        @keyframes spinWheel {
          0% {
            transform: rotate(0deg);
          }
          100% {
            transform: rotate(820deg);
          }
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
          <a
            className="brand cursor-pointer hover:opacity-90 transition-opacity"
            href="/"
            onClick={(event) => {
              event.preventDefault();
              handleNav({ type: 'HOME' });
            }}
          >
            <img className="brand__icon" src="/assets/pullz-p.png" alt="Pullz" />
            <span className="brand__wordmark" aria-label="pullz dot gg">
              <span className="brand__pullz">pullz</span>
              <span className="gg" aria-hidden="true" ref={ggRef}>
                <span className="gg__text">.gg</span>
                <span className="gg__spinner">
                  <span className="wheel">
                    <span className="wheel__tick"></span>
                    <span className="wheel__tick"></span>
                    <span className="wheel__tick"></span>
                    <span className="wheel__tick"></span>
                    <span className="wheel__tick"></span>
                    <span className="wheel__tick"></span>
                  </span>
                  <span className="wheel__needle"></span>
                </span>
              </span>
            </span>
          </a>

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
                <div className="bg-[#1a2130] px-2 md:px-3 py-1 rounded text-xs md:text-sm mr-2 md:mr-3">
                  <CoinAmount
                    amount={balance}
                    formatOptions={{ maximumFractionDigits: 0 }}
                    className="text-cyan-400 font-bold"
                    iconClassName="w-3.5 h-3.5"
                  />
                </div>
                <button 
                  onClick={() => setShowTopUpModal(true)}
                  className="bg-blue-600 hover:bg-blue-500 text-white rounded p-1 transition-colors active:scale-95"
                  title="Add Coins"
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
                <div className="relative">
                  <button
                    className="hover:text-white transition-colors p-2 rounded-lg hover:bg-[#11141d] relative"
                    onClick={() => setIsNotificationsOpen((prev) => !prev)}
                    aria-label="Notifications"
                  >
                    <Bell className="w-4 h-4" />
                    {notificationCount > 0 && (
                      <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full px-1.5 py-0.5">
                        {notificationCount > 9 ? '9+' : notificationCount}
                      </span>
                    )}
                  </button>
                  {isNotificationsOpen && (
                    <>
                      <div
                        className="fixed inset-0 z-40"
                        onClick={() => setIsNotificationsOpen(false)}
                      ></div>
                      <div
                        className="absolute right-0 mt-3 w-[90vw] max-w-sm md:w-96 bg-[#151a23] border border-gray-800 rounded-2xl shadow-2xl z-50 overflow-hidden"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
                          <span className="text-sm font-bold text-white">Notifications</span>
                          <button
                            onClick={() => clearNotifications()}
                            className="text-xs text-gray-400 hover:text-white disabled:opacity-50"
                            disabled={notificationCount === 0}
                          >
                            Clear all
                          </button>
                        </div>
                        <div className="max-h-72 overflow-y-auto">
                          {notificationCount === 0 ? (
                            <div className="px-4 py-6 text-center text-sm text-gray-500">
                              You are all caught up.
                            </div>
                          ) : (
                            notifications.map((notification) => {
                              const Icon = notification.type === 'shipping' ? PackageOpen : ShieldCheck;
                              const accent =
                                notification.type === 'shipping' ? 'text-green-400' : 'text-purple-400';
                              const badge =
                                notification.type === 'shipping'
                                  ? 'bg-green-500/10 border-green-500/20'
                                  : 'bg-purple-500/10 border-purple-500/20';
                              return (
                                <div
                                  key={notification.id}
                                  className="flex items-start gap-3 px-4 py-3 border-b border-gray-800 last:border-b-0"
                                >
                                  <div className={`p-2 rounded-lg border ${badge}`}>
                                    <Icon className={`w-4 h-4 ${accent}`} />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm text-gray-200 leading-snug">
                                      {notification.message}
                                    </p>
                                    <p className="text-[11px] text-gray-500 mt-1">
                                      {new Date(notification.createdAt).toLocaleTimeString()}
                                    </p>
                                  </div>
                                  <button
                                    onClick={() => dismissNotification(notification.id)}
                                    className="text-gray-500 hover:text-white"
                                    aria-label="Dismiss notification"
                                  >
                                    <X className="w-4 h-4" />
                                  </button>
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>
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
