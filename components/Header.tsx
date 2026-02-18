import React, { useEffect, useMemo, useState } from 'react';
import {
  Facebook,
  Flame,
  Gamepad2,
  HelpCircle,
  Info,
  Instagram,
  LifeBuoy,
  LogOut,
  Package,
  PenTool,
  Plus,
  RefreshCw,
  Shield,
  ShieldCheck,
  Star,
  Swords,
  Trophy,
  Twitter,
  User as UserIcon,
  X,
  Youtube
} from 'lucide-react';
import { useGame } from '../context/GameContext';
import { useSound } from '../context/SoundContext';
import { CoinAmount } from './CoinAmount';
import { BrandLockup } from './BrandLockup';
import { useNotifications } from '../hooks/useNotifications';

type HeaderProps = {
  onOpenInbox: () => void;
  unreadChatCount?: number;
};

const drawerCardClass =
  'flex items-center gap-3 rounded-xl border border-white/5 bg-[#18181b] p-3 text-left transition-colors hover:bg-[#202023]';

export const Header: React.FC<HeaderProps> = ({ onOpenInbox, unreadChatCount }) => {
  const {
    user,
    balance,
    setView,
    isAuthenticated,
    openAuthModal,
    setShowTopUpModal,
    logout,
    notifications
  } = useGame();
  const { playSound } = useSound();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const openMobileMenu = () => {
      setIsMobileMenuOpen(true);
    };

    window.addEventListener('pullz:open-mobile-menu', openMobileMenu);
    return () => window.removeEventListener('pullz:open-mobile-menu', openMobileMenu);
  }, []);


  const { unreadCount: persistentUnreadCount } = useNotifications(isAuthenticated ? user.id : null);
  const notificationCount = persistentUnreadCount || notifications.length;
  const chatCount = typeof unreadChatCount === 'number' ? unreadChatCount : 0;
  const inboxCount = notificationCount + chatCount;
  const inboxCountLabel = inboxCount > 99 ? '99+' : inboxCount;

  const navigate = (type: 'HOME' | 'BOXES' | 'BATTLES' | 'BONUSES' | 'LEADERBOARD' | 'PROVABLY_FAIR' | 'CONTACT' | 'TERMS' | 'PRIVACY' | 'PROFILE' | 'ADMIN' | 'INVENTORY') => {
    playSound('click');
    if ((type === 'BONUSES' || type === 'INVENTORY' || type === 'PROFILE') && !isAuthenticated) {
      openAuthModal('login');
      return;
    }
    setView({ type } as any);
    setIsMobileMenuOpen(false);
  };

  const authButtons = useMemo(() => (
    <>
      <button
        onClick={() => {
          playSound('click');
          openAuthModal('login');
        }}
        className="rounded-xl border border-white/10 bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-neutral-800"
      >
        Sign in
      </button>
      <button
        onClick={() => {
          playSound('click');
          openAuthModal('register');
        }}
        className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-500"
      >
        Sign up
      </button>
    </>
  ), [openAuthModal, playSound]);

  return (
    <div className="relative z-50">
      <header className="fixed left-0 right-0 top-0 z-50 border-b border-white/5 bg-neutral-950/90 backdrop-blur-md">
        <nav className="mx-auto flex h-[72px] max-w-7xl items-center justify-between px-4 lg:px-8">
          <div className="flex items-center gap-3 lg:gap-x-10">
            <button
              type="button"
              onClick={() => navigate('HOME')}
              className="inline-flex items-center"
              aria-label="Go home"
            >
              <BrandLockup />
            </button>

            <div className="hidden lg:flex lg:gap-x-3">
              <button onClick={() => navigate('BATTLES')} className="flex items-center gap-2 rounded-xl border border-transparent bg-zinc-900/50 px-4 py-2.5 text-sm font-semibold text-neutral-400 transition-colors hover:border-white/5 hover:bg-neutral-800 hover:text-white">
                <Gamepad2 className="h-4 w-4" />
                Games
              </button>
              <button onClick={() => navigate('BONUSES')} className="flex items-center gap-2 rounded-xl border border-transparent bg-zinc-900/50 px-4 py-2.5 text-sm font-semibold text-purple-400 transition-colors hover:border-white/5 hover:bg-neutral-800">
                <Flame className="h-4 w-4" />
                Rewards
              </button>
              <button onClick={() => navigate('LEADERBOARD')} className="flex items-center gap-2 rounded-xl border border-transparent bg-zinc-900/50 px-4 py-2.5 text-sm font-semibold text-neutral-400 transition-colors hover:border-white/5 hover:bg-neutral-800 hover:text-white">
                <Trophy className="h-4 w-4" />
                Leaderboard
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {isAuthenticated ? (
              <>
                <div className="hidden items-center gap-2 lg:flex">
                  <div className="flex items-center gap-2 rounded-lg border border-indigo-500/20 bg-[#18181b] pl-3 pr-1.5 py-1">
                    <CoinAmount amount={balance} className="text-white text-sm font-bold" iconClassName="h-4 w-4" formatOptions={{ maximumFractionDigits: 0 }} />
                    <button
                      onClick={() => {
                        playSound('click');
                        setShowTopUpModal(true);
                      }}
                      className="flex h-7 w-7 items-center justify-center rounded-md bg-indigo-600 text-white hover:bg-indigo-500"
                      aria-label="Top up"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    playSound('click');
                    onOpenInbox();
                  }}
                  className="relative rounded-lg border border-gray-700 bg-[#111621] p-2 text-gray-200 hover:text-white"
                  aria-label="Open inbox"
                >
                  <Info className="h-4 w-4" />
                  {inboxCount > 0 && (
                    <span className="absolute -right-1 -top-1 min-w-[18px] rounded-full bg-cyan-400 px-1 text-center text-[10px] font-bold text-[#0b0e14]">
                      {inboxCountLabel}
                    </span>
                  )}
                </button>

                <div className="hidden items-center gap-2 border-l border-white/10 pl-2 lg:flex">
                  {user.isAdmin && (
                    <button onClick={() => navigate('ADMIN')} className="hidden items-center gap-2 rounded-lg border border-indigo-500/20 bg-indigo-600/10 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-indigo-400 transition-colors hover:bg-indigo-600 hover:text-white xl:flex">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      Admin
                    </button>
                  )}
                  <button onClick={() => navigate('PROFILE')} className="text-right">
                    <span className="block text-sm font-bold text-white hover:text-indigo-400">{user.name}</span>
                    <span className="text-[10px] font-bold text-indigo-400">Level {user.level ?? 0}</span>
                  </button>
                  <button type="button" onClick={() => navigate('PROFILE')}>
                    <img src={user.avatar} alt={user.name} className="h-9 w-9 rounded-lg border border-white/10 object-cover" />
                  </button>
                  <button
                    onClick={() => {
                      playSound('click');
                      logout();
                    }}
                    className="rounded-lg border border-white/10 bg-zinc-900 p-2 text-gray-300 hover:bg-zinc-800 hover:text-white"
                    aria-label="Log out"
                  >
                    <LogOut className="h-4 w-4" />
                  </button>
                </div>
              </>
            ) : (
              <div className="hidden items-center gap-3 lg:flex">{authButtons}</div>
            )}

            {!isAuthenticated && <div className="flex items-center gap-2 lg:hidden">{authButtons}</div>}

            {isAuthenticated && (
              <div className="flex items-center gap-2 lg:hidden">
                <button
                  onClick={() => {
                    playSound('click');
                    setShowTopUpModal(true);
                  }}
                  className="flex items-center gap-1 rounded-md border border-indigo-500/20 bg-[#18181b] pl-2 pr-1 py-1"
                >
                  <Star className="h-3 w-3 text-orange-500" />
                  <span className="text-xs font-bold text-white">{Math.floor(balance).toLocaleString()}</span>
                  <span className="rounded bg-indigo-600 p-0.5"><Plus className="h-3 w-3" /></span>
                </button>
              </div>
            )}

          </div>
        </nav>
      </header>

      {isMobileMenuOpen && <button type="button" onClick={() => setIsMobileMenuOpen(false)} className="fixed inset-0 z-40 bg-black/80 lg:hidden" aria-label="Close menu overlay" />}

      <div className={`fixed inset-y-0 right-0 z-50 w-full max-w-sm overflow-y-auto bg-[#09090b] px-4 py-4 transition-transform duration-300 ease-in-out lg:hidden ${isMobileMenuOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="mb-6 flex items-center justify-between">
          <button type="button" onClick={() => navigate('HOME')} className="inline-flex items-center"><BrandLockup /></button>
          <button type="button" className="rounded-md p-2 text-gray-300" onClick={() => setIsMobileMenuOpen(false)} aria-label="Close menu"><X className="h-6 w-6" /></button>
        </div>

        <div className="flex flex-col gap-6 pb-20">
          <div className="grid grid-cols-2 gap-3">
            {isAuthenticated ? (
              <>
                <button onClick={() => navigate('PROFILE')} className="flex items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3.5 font-bold text-white"><UserIcon className="h-5 w-5" />Account</button>
                <button onClick={() => { playSound('click'); setIsMobileMenuOpen(false); logout(); }} className="flex items-center justify-center gap-2 rounded-xl border border-white/5 bg-[#18181b] py-3.5 font-bold text-white"><LogOut className="h-5 w-5 text-neutral-400" />Log out</button>
              </>
            ) : (
              <>
                <button onClick={() => { playSound('click'); setIsMobileMenuOpen(false); openAuthModal('login'); }} className="rounded-xl bg-indigo-600 py-3.5 font-bold text-white">Log In</button>
                <button onClick={() => { playSound('click'); setIsMobileMenuOpen(false); openAuthModal('register'); }} className="rounded-xl border border-white/5 bg-[#18181b] py-3.5 font-bold text-white">Register</button>
              </>
            )}
          </div>

          {user.isAdmin && (
            <button onClick={() => navigate('ADMIN')} className="flex w-full items-center justify-center gap-2 rounded-xl border border-indigo-500/30 bg-indigo-900/40 py-3 font-bold text-indigo-400">
              <ShieldCheck className="h-5 w-5" />
              Access Admin Panel
            </button>
          )}

          <section className="space-y-3">
            <h3 className="ml-1 text-xs font-bold uppercase tracking-wider text-neutral-500">Games</h3>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => navigate('BOXES')} className={drawerCardClass}><Package className="h-5 w-5 text-orange-500" /><span className="text-sm font-bold text-white">Boxes</span></button>
              <button onClick={() => navigate('BATTLES')} className={drawerCardClass}><Swords className="h-5 w-5 text-red-500" /><span className="text-sm font-bold text-white">Battles</span></button>
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="ml-1 text-xs font-bold uppercase tracking-wider text-neutral-500">Rewards</h3>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => navigate('BONUSES')} className={drawerCardClass}><RefreshCw className="h-5 w-5 text-blue-500" /><span className="text-sm font-bold text-white">Daily Spin</span></button>
              <button onClick={() => navigate('LEADERBOARD')} className={drawerCardClass}><Trophy className="h-5 w-5 text-yellow-500" /><span className="text-sm font-bold text-white">Leaderboard</span></button>
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="ml-1 text-xs font-bold uppercase tracking-wider text-neutral-500">Learn</h3>
            <div className="grid grid-cols-2 gap-3">
              <button disabled className={`${drawerCardClass} cursor-not-allowed opacity-70`}><PenTool className="h-5 w-5 text-neutral-400" /><span className="text-sm font-bold text-white">Blog</span></button>
              <button disabled className={`${drawerCardClass} cursor-not-allowed opacity-70`}><HelpCircle className="h-5 w-5 text-neutral-400" /><span className="text-sm font-bold text-white">FAQ</span></button>
            </div>
            <button onClick={() => navigate('PROVABLY_FAIR')} className={`${drawerCardClass} w-full`}><Shield className="h-5 w-5 text-green-500" /><span className="text-sm font-bold text-white">Fairness</span></button>
          </section>

          <section className="space-y-3">
            <h3 className="ml-1 text-xs font-bold uppercase tracking-wider text-neutral-500">Info and Support</h3>
            <button onClick={() => navigate('CONTACT')} className={`${drawerCardClass} w-full`}><LifeBuoy className="h-5 w-5 text-white" /><span className="text-sm font-bold text-white">Support</span></button>
          </section>

          <section className="mt-2 flex flex-col items-center gap-6">
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500">Social Media</h3>
            <div className="flex items-center gap-6 text-white">
              <a href="#" aria-label="Facebook"><Facebook className="h-6 w-6" /></a>
              <a href="#" aria-label="Instagram"><Instagram className="h-6 w-6" /></a>
              <a href="#" aria-label="Youtube"><Youtube className="h-6 w-6" /></a>
              <a href="#" aria-label="Twitter"><Twitter className="h-6 w-6" /></a>
            </div>
            <div className="flex flex-col items-center gap-3 text-xs font-bold text-neutral-500">
              <div className="flex items-center gap-4">
                <button onClick={() => navigate('TERMS')} className="hover:text-white">Terms of Service</button>
                <span>|</span>
                <button onClick={() => navigate('PRIVACY')} className="hover:text-white">Privacy Policy</button>
              </div>
              <button disabled className="cursor-not-allowed opacity-70">AML &amp; KYC Policy</button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
