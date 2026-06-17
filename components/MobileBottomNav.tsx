import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Box, Flame, Home, User, X } from 'lucide-react';
import { useGame } from '../context/GameContext';
import { useSound } from '../context/SoundContext';
import { UserAvatar } from './UserAvatar';

type NavItem = {
  id: 'HOME' | 'BOXES' | 'PLINKO' | 'PULL_PASS' | 'PROFILE';
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  iconClassName?: string;
  requiresAuth?: boolean;
};

const UpgraderIcon: React.FC<{ className?: string }> = ({ className }) => <Flame className={className} aria-hidden="true" />;
const PullPassTabIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 64 64" fill="none" className={className} aria-hidden="true">
    <path d="M32 4L55 17V47L32 60L9 47V17L32 4Z" fill="#111827" stroke="currentColor" strokeWidth="3" />
    <path d="M32 9L50 19.5V44.5L32 55L14 44.5V19.5L32 9Z" fill="url(#mobile-pull-pass-gradient)" stroke="currentColor" strokeWidth="1.5" />
    <path d="M32 17L36.2 26.1L46 27.2L38.7 33.8L40.7 43.5L32 38.5L23.3 43.5L25.3 33.8L18 27.2L27.8 26.1L32 17Z" fill="#FACC15" stroke="#FEF3C7" strokeWidth="1.5" />
    <path d="M32 17L36.2 26.1L46 27.2L38.7 33.8L40.7 43.5L32 38.5V17Z" fill="#F59E0B" opacity="0.65" />
    <defs>
      <linearGradient id="mobile-pull-pass-gradient" x1="32" y1="9" x2="32" y2="55" gradientUnits="userSpaceOnUse">
        <stop stopColor="#312E81" />
        <stop offset="1" stopColor="#09090B" />
      </linearGradient>
    </defs>
  </svg>
);

const NAV_ITEMS: NavItem[] = [
  { id: 'HOME', label: 'Home', icon: Home },
  { id: 'BOXES', label: 'Boxes', icon: Box },
  { id: 'PLINKO', label: 'Upgrader', icon: UpgraderIcon },
  { id: 'PULL_PASS', label: 'Rewards', icon: PullPassTabIcon },
  { id: 'PROFILE', label: 'Profile', requiresAuth: true }
];

export const MobileBottomNav: React.FC = () => {
  const { view, setView, isAuthenticated, openAuthModal, user, boxes, showTopUpModal } = useGame();
  const { playSound } = useSound();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isFreeBoxTooltipDismissed, setIsFreeBoxTooltipDismissed] = useState(false);
  const [isSuppressed, setIsSuppressed] = useState(false);
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (typeof document === 'undefined') return undefined;

    const root = document.documentElement;
    root.style.setProperty('--pullz-mobile-bottom-nav-height', 'calc(env(safe-area-inset-bottom) + 72px)');
    return () => {
      root.style.removeProperty('--pullz-mobile-bottom-nav-height');
    };
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    setPortalTarget(document.body);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const handleMenuState = (event: Event) => {
      const detail = (event as CustomEvent<{ isOpen: boolean }>).detail;
      setIsMenuOpen(Boolean(detail?.isOpen));
    };

    const handleBottomNavSuppressed = (event: Event) => {
      const detail = (event as CustomEvent<{ hidden: boolean }>).detail;
      setIsSuppressed(Boolean(detail?.hidden));
    };

    window.addEventListener('pullz:mobile-menu-state', handleMenuState);
    window.addEventListener('pullz:mobile-bottom-nav-visibility', handleBottomNavSuppressed);
    return () => {
      window.removeEventListener('pullz:mobile-menu-state', handleMenuState);
      window.removeEventListener('pullz:mobile-bottom-nav-visibility', handleBottomNavSuppressed);
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setIsFreeBoxTooltipDismissed(window.sessionStorage.getItem('pullz:free-box-tooltip-dismissed') === '1');
  }, []);

  const handleNav = (item: NavItem) => {
    playSound('click');

    if (item.requiresAuth && !isAuthenticated) {
      openAuthModal('login');
      return;
    }

    if (isMenuOpen && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('pullz:close-mobile-menu'));
    }

    setView({ type: item.id });
  };

  const activeId = useMemo<NavItem['id']>(() => {
    if (view.type === 'CASE_OPENING') return 'BOXES';
    if (view.type === 'INVENTORY' || view.type === 'PROFILE') return 'PROFILE';
    if (view.type === 'PULL_PASS' || view.type === 'BONUSES') return 'PULL_PASS';
    if (view.type === 'PLINKO') return 'PLINKO';
    if (view.type === 'BOXES') return 'BOXES';
    return 'HOME';
  }, [view.type]);

  const hasFreeSignupBox = useMemo(() => (
    isAuthenticated && boxes.some((box) => box.isDaily) && !user.lastFreeBoxClaim
  ), [boxes, isAuthenticated, user.lastFreeBoxClaim]);
  const showFreeBoxTooltip = hasFreeSignupBox && !isFreeBoxTooltipDismissed;
  const iconClassName = 'h-5 w-5 [stroke-width:1.6]';

  const dismissFreeBoxTooltip = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem('pullz:free-box-tooltip-dismissed', '1');
    }
    setIsFreeBoxTooltipDismissed(true);
  };

  const nav = (
    <div
      className={`pullz-mobile-bottom-nav fixed inset-x-0 bottom-0 z-[220] h-[var(--pullz-mobile-bottom-nav-height,72px)] border-t border-[#3a4146]/70 bg-[#1b2024] px-2 pb-[max(env(safe-area-inset-bottom),8px)] pt-2 shadow-[0_-12px_32px_rgba(0,0,0,0.35)] transition-[transform,opacity] duration-200 ease-out lg:hidden ${
        isSuppressed || showTopUpModal ? 'pointer-events-none translate-y-full opacity-0' : 'translate-y-0 opacity-100'
      }`}
      aria-label="Primary navigation"
      aria-hidden={isSuppressed || showTopUpModal}
    >
      <nav className="grid h-full grid-cols-5 items-center gap-0.5">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeId === item.id;
          const isProfile = item.id === 'PROFILE';
          return (
            <div key={item.id} className="relative flex justify-center">
              {item.id === 'PROFILE' && showFreeBoxTooltip ? (
                <div className="absolute bottom-full left-1/2 z-20 mb-1.5 w-max -translate-x-1/2 rounded-md border border-purple-400/35 bg-[#0f1018] px-2 py-1 text-[10px] font-semibold text-purple-100 shadow-lg">
                  <div className="flex items-center gap-1.5">
                    <span>Free box available</span>
                    <button
                      type="button"
                      onClick={dismissFreeBoxTooltip}
                      className="rounded p-0.5 text-emerald-100/80 transition-colors hover:bg-white/10 hover:text-white"
                      aria-label="Dismiss free box tooltip"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              ) : null}
              <button
                type="button"
                onClick={() => handleNav(item)}
                className={`flex min-h-12 w-full flex-col items-center justify-center gap-1 rounded-xl px-1 py-1 text-[9px] font-black uppercase tracking-wide transition-colors active:scale-[0.98] ${
                  isActive ? 'text-purple-300' : 'text-slate-500 hover:text-slate-300'
                }`}
                aria-current={isActive ? 'page' : undefined}
              >
                {isProfile ? (
                  <span className="relative">
                    {isAuthenticated ? (
                      <UserAvatar user={user} className="h-6 w-6 rounded-full object-cover ring-1 ring-white/10" initialsClassName="text-[10px]" />
                    ) : (
                      <span className="grid h-6 w-6 place-items-center rounded-full border border-slate-600 text-slate-400">
                        <User className="h-4 w-4 [stroke-width:1.7]" />
                      </span>
                    )}
                    {isAuthenticated && (
                      <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-purple-500 ring-1 ring-[#1b2024]" aria-hidden="true" />
                    )}
                    {hasFreeSignupBox && (
                      <span className="absolute -left-0.5 -top-0.5 inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400 ring-1 ring-[#1b2024]" aria-hidden="true" />
                    )}
                  </span>
                ) : Icon ? (
                  <span className="relative">
                    <Icon className={item.iconClassName ?? iconClassName} />
                  </span>
                ) : null}
                <span>{item.label}</span>
              </button>
            </div>
          );
        })}
      </nav>
    </div>
  );

  return portalTarget ? createPortal(nav, portalTarget) : nav;
};
