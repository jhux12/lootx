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
  X, 
  Volume2, 
  VolumeX, 
  MessageCircle,
  ShieldCheck, 
  FlaskConical, 
  PackageOpen
} from 'lucide-react';
import { useGame } from '../context/GameContext';
import { useSound } from '../context/SoundContext';
import { CoinAmount } from './CoinAmount';
import { BrandLockup } from './BrandLockup';
import { XP_ICON } from '../constants';

type HeaderProps = {
  onOpenSupportChat: () => void;
  hasUnseenChatMessages: boolean;
  isChatOpen: boolean;
};

export const Header: React.FC<HeaderProps> = ({ onOpenSupportChat, hasUnseenChatMessages, isChatOpen }) => {
  const {
    user,
    balance,
    setView,
    isAuthenticated,
    openAuthModal,
    setShowTopUpModal,
    logout,
    notifications,
    dismissNotification,
    clearNotifications
  } = useGame();
  const { muted, toggleMute, playSound } = useSound();
  const [lootRevealActive, setLootRevealActive] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isMobileProfileOpen, setIsMobileProfileOpen] = useState(false);
  const [balancePulse, setBalancePulse] = useState<'up' | 'down' | null>(null);
  const balanceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previousBalanceRef = useRef<number | null>(null);

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const triggerAnimation = () => {
      setLootRevealActive(true);
      timeoutId = setTimeout(() => setLootRevealActive(false), 1500);
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

  useEffect(() => {
    if (previousBalanceRef.current === null) {
      previousBalanceRef.current = balance;
      return;
    }

    if (previousBalanceRef.current !== balance) {
      const direction = balance > previousBalanceRef.current ? 'up' : 'down';
      setBalancePulse(direction);

      if (balanceTimeoutRef.current) {
        clearTimeout(balanceTimeoutRef.current);
      }

      balanceTimeoutRef.current = setTimeout(() => {
        setBalancePulse(null);
      }, 1400);
    }

    previousBalanceRef.current = balance;

    return () => {
      if (balanceTimeoutRef.current) {
        clearTimeout(balanceTimeoutRef.current);
      }
    };
  }, [balance]);

  const handleNav = (view: any) => {
    playSound('click');
    setIsMobileProfileOpen(false);
    if (view?.type === 'BONUSES' && !isAuthenticated) {
      openAuthModal('login');
      return;
    }
    setView(view);
  };

  const handleAuthAction = (action: () => void) => {
    playSound('click');
    if (!isAuthenticated) {
      openAuthModal('login');
    } else {
      action();
    }
  };

  const notificationCount = notifications.length;

  return (
    <>
      <style>{`
        @keyframes gamified-pop {
          0% { 
            transform: scale(1) rotate(0deg); 
            filter: brightness(1) drop-shadow(0 0 0 rgba(139, 92, 246, 0));
          }
          15% { 
            transform: scale(0.85) rotate(-10deg); 
          }
          30% { 
            transform: scale(1.6) rotate(8deg); 
            filter: brightness(2.2) drop-shadow(0 0 25px rgba(34, 211, 238, 0.9));
          }
          45% { 
            transform: scale(1.2) rotate(-4deg); 
            filter: brightness(1.6) drop-shadow(0 0 15px rgba(139, 92, 246, 0.7));
          }
          60% { 
            transform: scale(1.4) rotate(3deg); 
            filter: brightness(1.9) drop-shadow(0 0 20px rgba(34, 211, 238, 0.8));
          }
          80% { 
            transform: scale(1) rotate(0deg); 
            filter: brightness(1.2) drop-shadow(0 0 10px rgba(139, 92, 246, 0.4));
          }
          100% { 
            transform: scale(1) rotate(0deg); 
            filter: brightness(1) drop-shadow(0 0 0 rgba(139, 92, 246, 0));
          }
        }

        .animate-gamified-pop {
          animation: gamified-pop 1.5s cubic-bezier(0.34, 1.56, 0.64, 1);
        }

        @keyframes balance-boost {
          0% {
            transform: scale(1);
            box-shadow: 0 0 0 rgba(34, 211, 238, 0);
          }
          35% {
            transform: scale(1.08);
            box-shadow: 0 0 18px rgba(34, 211, 238, 0.8), 0 0 36px rgba(14, 116, 144, 0.5);
          }
          70% {
            transform: scale(1.02);
            box-shadow: 0 0 10px rgba(34, 211, 238, 0.5), 0 0 20px rgba(139, 92, 246, 0.4);
          }
          100% {
            transform: scale(1);
            box-shadow: 0 0 0 rgba(34, 211, 238, 0);
          }
        }

        @keyframes balance-dip {
          0% {
            transform: scale(1);
            box-shadow: 0 0 0 rgba(248, 113, 113, 0);
          }
          35% {
            transform: scale(0.96);
            box-shadow: 0 0 16px rgba(248, 113, 113, 0.6), 0 0 28px rgba(190, 24, 93, 0.4);
          }
          70% {
            transform: scale(1.01);
            box-shadow: 0 0 10px rgba(248, 113, 113, 0.45), 0 0 18px rgba(190, 24, 93, 0.3);
          }
          100% {
            transform: scale(1);
            box-shadow: 0 0 0 rgba(248, 113, 113, 0);
          }
        }

        @keyframes balance-sparkle {
          0% {
            opacity: 0;
            transform: scale(0.85) rotate(0deg);
          }
          40% {
            opacity: 0.8;
            transform: scale(1.1) rotate(40deg);
          }
          100% {
            opacity: 0;
            transform: scale(1.35) rotate(90deg);
          }
        }

        .balance-pulse {
          position: relative;
          transform-origin: center;
        }

        .balance-pulse-up {
          animation: balance-boost 1.4s ease-out;
        }

        .balance-pulse-down {
          animation: balance-dip 1.4s ease-out;
        }

        .balance-sparkle {
          position: absolute;
          inset: -10px;
          border-radius: 14px;
          background: conic-gradient(from 160deg, rgba(34, 211, 238, 0.6), rgba(139, 92, 246, 0.4), rgba(16, 185, 129, 0.5), rgba(34, 211, 238, 0.6));
          filter: blur(12px);
          opacity: 0;
          pointer-events: none;
        }

        .balance-sparkle-active {
          animation: balance-sparkle 1.2s ease-out;
        }

      `}</style>

      <header className="fixed top-0 left-0 right-0 z-50 w-full flex items-center justify-between px-4 md:px-6 py-3 min-h-[72px] md:min-h-[80px] lg:min-h-[88px] bg-[#080b14]/95 border-b border-gray-800/50 backdrop-blur">
        <div className="flex items-center gap-4 lg:gap-10">
          {/* Logo */}
          <div
            className="cursor-pointer hover:opacity-90 transition-opacity"
            onClick={() => handleNav({ type: 'HOME' })}
          >
            <BrandLockup />
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-8">
            <button 
              onClick={() => handleNav({ type: 'BOXES' })} 
              className="flex items-center gap-2 text-white hover:text-blue-400 transition-colors text-sm font-semibold"
            >
              <PackageOpen className="w-4 h-4" /> Boxes
            </button>
            {/* Case Lab - Always Visible */}
            <button 
              onClick={() => handleAuthAction(() => setView({ type: 'CUSTOM_CREATOR' }))} 
              className="flex items-center gap-2 text-brand-purple hover:text-purple-400 transition-colors text-sm font-bold"
            >
              <FlaskConical className="w-4 h-4" /> Case Lab
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
        <div className="flex items-center gap-2 md:gap-3">
          <div className="flex items-center gap-2 md:gap-3 text-gray-500">
            <button
              onClick={toggleMute}
              className="hover:text-white transition-colors p-2 rounded-lg hover:bg-[#11141d]"
              aria-label={muted ? 'Unmute sounds' : 'Mute sounds'}
            >
              {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
            {isAuthenticated && (
              <>
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
                        className="fixed top-[76px] left-2 right-2 w-auto max-w-none mt-0 bg-[#151a23] border border-gray-800 rounded-2xl shadow-2xl z-50 overflow-hidden md:absolute md:top-full md:right-0 md:left-auto md:mt-3 md:w-96 md:max-w-sm"
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
                <button
                  className="hover:text-white transition-colors p-2 rounded-lg hover:bg-[#11141d]"
                  onClick={onOpenSupportChat}
                  aria-label="Open support chat"
                >
                  <span className="relative flex">
                    <MessageCircle className="w-4 h-4" />
                    {hasUnseenChatMessages && !isChatOpen && (
                      <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-brand-purple shadow-[0_0_10px_rgba(124,58,237,0.9)]" />
                    )}
                  </span>
                </button>
              </>
            )}
          </div>
          {isAuthenticated ? (
            <>
              <div
                className={`flex items-center bg-[#111621] rounded-lg p-1 pr-3 border border-gray-800 balance-pulse ${
                  balancePulse === 'up'
                    ? 'balance-pulse-up'
                    : balancePulse === 'down'
                      ? 'balance-pulse-down'
                      : ''
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`balance-sparkle ${balancePulse ? 'balance-sparkle-active' : ''}`}
                />
                <div className="bg-[#1a2130] px-2 md:px-3 py-1 rounded text-xs md:text-sm mr-2 md:mr-3 relative z-10">
                  <CoinAmount
                    amount={balance}
                    formatOptions={{ maximumFractionDigits: 0 }}
                    className="text-cyan-400 font-bold"
                    iconClassName="w-3.5 h-3.5"
                  />
                </div>
                <button 
                  onClick={() => setShowTopUpModal(true)}
                  className="btn-logo-gradient text-white rounded p-1 transition-colors active:scale-95"
                  title="Add Coins"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>

              <div className="relative flex items-center gap-2 md:hidden">
                <button
                  type="button"
                  onClick={() => {
                    playSound('click');
                    setIsMobileProfileOpen((prev) => !prev);
                  }}
                  className="rounded-lg border border-gray-700"
                  aria-label="Open profile menu"
                  aria-expanded={isMobileProfileOpen}
                >
                  <img
                    src={user.avatar}
                    className="w-8 h-8 rounded-lg"
                    alt="Avatar"
                  />
                </button>

                {isMobileProfileOpen && (
                  <div className="absolute right-0 top-10 z-50 w-52 rounded-xl border border-gray-800 bg-[#151a23] p-2 shadow-xl">
                    <div className="mb-2 rounded-lg border border-gray-800 bg-[#0b0e14] px-3 py-2">
                      <div className="text-[10px] uppercase tracking-wide text-gray-500">XP Balance</div>
                      <div className="mt-1 flex items-center gap-2 text-sm font-bold text-white">
                        <img src={XP_ICON} alt="XP" className="h-5 w-5 object-contain" />
                        <span>{Math.floor(user.xpBalance ?? user.xp ?? 0).toLocaleString()}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleNav({ type: 'PROFILE' })}
                      className="w-full rounded-lg px-3 py-2 text-left text-sm text-gray-300 hover:bg-gray-800"
                    >
                      Profile
                    </button>
                    <button
                      onClick={() => handleNav({ type: 'INVENTORY' })}
                      className="mt-1 w-full rounded-lg px-3 py-2 text-left text-sm text-gray-300 hover:bg-gray-800"
                    >
                      Inventory
                    </button>
                  </div>
                )}
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
                    <span className="text-[10px] text-gray-500">XP {Math.floor(user.xpBalance ?? user.xp ?? 0).toLocaleString()}</span>
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
            </>
          ) : (
            <div className="flex items-center gap-3">
              <button 
                onClick={() => { playSound('click'); openAuthModal('login'); }}
                className="px-5 py-2 text-sm font-bold text-white bg-[#1a2130] hover:bg-[#232b3d] border border-gray-700 rounded-lg transition-colors"
              >
                Sign In
              </button>
              <button 
                onClick={() => { playSound('click'); openAuthModal('register'); }}
                className="px-5 py-2 text-sm font-bold text-black bg-green-500 hover:bg-green-400 rounded-lg transition-colors hidden sm:block shadow-[0_0_15px_rgba(34,197,94,0.4)]"
              >
                Register
              </button>
            </div>
          )}
        </div>

      </header>
    </>
  );
};
