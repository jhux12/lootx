import React, { useRef, useState } from 'react';
import {
  ChevronDown,
  FlaskConical,
  Gift,
  Inbox,
  LogOut,
  PackageOpen,
  Plus,
  Trophy,
  User,
  Volume2,
  VolumeX
} from 'lucide-react';
import { useGame } from '../context/GameContext';
import { useSound } from '../context/SoundContext';
import { CoinAmount } from './CoinAmount';
import { BrandLockup } from './BrandLockup';
import { XP_ICON } from '../constants';
import { useNotifications } from '../hooks/useNotifications';

type HeaderProps = {
  onOpenInbox: () => void;
  unreadChatCount?: number;
};

const navItems = [
  { id: 'BOXES', label: 'Boxes', icon: PackageOpen },
  { id: 'CUSTOM_CREATOR', label: 'Case Lab', icon: FlaskConical },
  { id: 'LEADERBOARD', label: 'Leaderboard', icon: Trophy },
  { id: 'BONUSES', label: 'Bonuses', icon: Gift }
] as const;

export const Header: React.FC<HeaderProps> = ({ onOpenInbox, unreadChatCount }) => {
  const {
    user,
    balance,
    view,
    setView,
    isAuthenticated,
    openAuthModal,
    setShowTopUpModal,
    logout,
    notifications
  } = useGame();
  const { muted, toggleMute, playSound } = useSound();

  const [isMobileProfileOpen, setIsMobileProfileOpen] = useState(false);
  const closeTimer = useRef<number | null>(null);

  const handleNav = (nextView: any) => {
    playSound('click');
    setIsMobileProfileOpen(false);
    if (nextView?.type === 'BONUSES' && !isAuthenticated) {
      openAuthModal('login');
      return;
    }
    setView(nextView);
  };

  const handleAuthAction = (action: () => void) => {
    playSound('click');
    if (!isAuthenticated) {
      openAuthModal('login');
      return;
    }
    action();
  };

  const { unreadCount: persistentUnreadCount } = useNotifications(isAuthenticated ? user.id : null);
  const notificationCount = persistentUnreadCount || notifications.length;
  const chatCount = typeof unreadChatCount === 'number' ? unreadChatCount : 0;
  const inboxCount = notificationCount + chatCount;
  const inboxCountLabel = inboxCount > 99 ? '99+' : inboxCount;

  return (
    <header className="fixed left-0 right-0 top-0 z-50 border-b border-white/10 bg-[#050811]/90 backdrop-blur-xl">
      <div className="mx-auto flex min-h-[74px] w-full max-w-[1200px] items-center gap-3 px-3 sm:px-4 lg:px-6">
        <button
          type="button"
          className="shrink-0"
          onClick={() => handleNav({ type: 'HOME' })}
          aria-label="Go to homepage"
        >
          <BrandLockup logoClassName="h-10 sm:h-11" textClassName="text-base" />
        </button>

        <nav className="mx-auto hidden items-center gap-2 lg:flex">
          {navItems.map(({ id, label, icon: Icon }) => {
            const active = view.type === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => {
                  if (id === 'CUSTOM_CREATOR') {
                    handleAuthAction(() => setView({ type: 'CUSTOM_CREATOR' }));
                    return;
                  }
                  handleNav({ type: id });
                }}
                className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition ${
                  active
                    ? 'border-violet-300/50 bg-violet-500/15 text-white shadow-[0_0_24px_rgba(139,92,246,0.25)]'
                    : 'border-white/10 bg-white/[0.03] text-gray-200 hover:border-violet-300/40 hover:text-white'
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          <button
            onClick={toggleMute}
            className="hidden rounded-full border border-white/10 bg-white/[0.03] p-2 text-gray-300 transition hover:text-white md:inline-flex"
            aria-label={muted ? 'Unmute sounds' : 'Mute sounds'}
            type="button"
          >
            {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>

          {isAuthenticated ? (
            <>
              <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] p-1 pl-3">
                <CoinAmount amount={balance} formatOptions={{ maximumFractionDigits: 0 }} className="text-sm text-violet-100" iconClassName="h-4 w-4" />
                <button
                  onClick={() => setShowTopUpModal(true)}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-violet-500 text-white transition hover:bg-violet-400"
                  type="button"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>

              <button
                type="button"
                onClick={() => {
                  playSound('click');
                  onOpenInbox();
                }}
                className="relative rounded-full border border-white/10 bg-white/[0.03] p-2 text-gray-300 hover:text-white"
                aria-label="Open inbox"
              >
                <Inbox className="h-4 w-4" />
                {inboxCount > 0 && (
                  <span className="absolute -right-1 -top-1 min-w-[18px] rounded-full bg-violet-400 px-1 text-center text-[10px] font-bold text-[#090d18]">
                    {inboxCountLabel}
                  </span>
                )}
              </button>

              <div
                className="group relative"
                onMouseEnter={() => {
                  if (closeTimer.current) window.clearTimeout(closeTimer.current);
                }}
                onMouseLeave={() => {
                  closeTimer.current = window.setTimeout(() => setIsMobileProfileOpen(false), 120);
                }}
              >
                <button
                  type="button"
                  className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-2 py-1.5 text-sm"
                  onClick={() => setIsMobileProfileOpen((prev) => !prev)}
                >
                  <img src={user.avatar} className="h-7 w-7 rounded-full border border-white/15" alt="Avatar" />
                  <ChevronDown className="h-4 w-4 text-gray-300" />
                </button>

                <div className={`absolute right-0 top-full z-50 mt-2 w-56 rounded-2xl border border-white/10 bg-[#101627] p-2 shadow-2xl transition ${isMobileProfileOpen ? 'visible opacity-100' : 'invisible opacity-0 group-hover:visible group-hover:opacity-100'}`}>
                  <div className="mb-2 rounded-xl border border-white/10 bg-[#0d1322] p-3">
                    <p className="truncate text-sm font-semibold text-white">{user.name}</p>
                    <div className="mt-1 flex items-center gap-2 text-xs text-gray-400">
                      <img src={XP_ICON} alt="XP" className="h-4 w-4 object-contain" />
                      <span>{Math.floor(user.xpBalance ?? user.xp ?? 0).toLocaleString()} XP</span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleNav({ type: 'PROFILE' })}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-gray-200 hover:bg-white/10"
                    type="button"
                  >
                    <User className="h-4 w-4" /> Profile
                  </button>
                  <button
                    onClick={() => {
                      playSound('click');
                      setIsMobileProfileOpen(false);
                      logout();
                    }}
                    className="mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-red-300 hover:bg-red-500/10"
                    type="button"
                  >
                    <LogOut className="h-4 w-4" /> Sign out
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  playSound('click');
                  openAuthModal('login');
                }}
                className="rounded-full border border-white/15 bg-white/[0.03] px-4 py-2 text-sm font-semibold text-white hover:bg-white/[0.08]"
                type="button"
              >
                Sign in
              </button>
              <button
                onClick={() => {
                  playSound('click');
                  openAuthModal('register');
                }}
                className="rounded-full bg-gradient-to-r from-violet-500 to-blue-500 px-4 py-2 text-sm font-semibold text-white shadow-[0_0_20px_rgba(99,102,241,0.45)]"
                type="button"
              >
                Sign up
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="mx-auto flex max-w-[1200px] items-center gap-2 overflow-x-auto px-3 pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:hidden">
        {navItems.map(({ id, label }) => (
          <button
            key={`mobile-${id}`}
            type="button"
            onClick={() => {
              if (id === 'CUSTOM_CREATOR') {
                handleAuthAction(() => setView({ type: 'CUSTOM_CREATOR' }));
                return;
              }
              handleNav({ type: id });
            }}
            className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold ${view.type === id ? 'border-violet-300/50 bg-violet-500/15 text-white' : 'border-white/10 bg-white/[0.03] text-gray-200'}`}
          >
            {label}
          </button>
        ))}
      </div>
    </header>
  );
};
