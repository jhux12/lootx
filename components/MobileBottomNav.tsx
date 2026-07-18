import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Box, Flame, Home, Trophy, User, X } from 'lucide-react';
import { useGame } from '../context/GameContext';
import { useSound } from '../context/SoundContext';
import { UserAvatar } from './UserAvatar';

type NavItem = {
  id: 'HOME' | 'BOXES' | 'PLINKO' | 'LEADERBOARD' | 'PROFILE';
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  iconClassName?: string;
  requiresAuth?: boolean;
};

const UpgraderIcon: React.FC<{ className?: string }> = ({ className }) => <Flame className={className} aria-hidden="true" />;
const NAV_ITEMS: NavItem[] = [
  { id: 'HOME', label: 'Menu', icon: Home },
  { id: 'BOXES', label: 'Boxes', icon: Box },
  { id: 'PLINKO', label: 'Upgrader', icon: UpgraderIcon },
  { id: 'LEADERBOARD', label: 'Leaders', icon: Trophy },
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
    root.style.setProperty('--pullz-mobile-bottom-nav-height', 'calc(72px + max(env(safe-area-inset-bottom), 10px))');
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


  // Track the visual viewport offset to keep fixed mobile chrome pinned during browser toolbar changes.
  // We also listen to window 'scroll' and 'pageshow' because scroll-lock release calls
  // window.scrollTo() which can change the visual viewport position without triggering
  // a visualViewport scroll/resize event (e.g. after the login modal closes on Safari).
  useEffect(() => {
    const vv = typeof window !== 'undefined' ? window.visualViewport : null;
    if (!vv) return undefined;

    let rafId: number;
    const update = () => {
      const offset = Math.max(0, window.innerHeight - vv.offsetTop - vv.height);
      document.documentElement.style.setProperty('--pullz-viewport-bottom-offset', `${offset}px`);
    };
    // Deferred update via rAF so that DOM layout has settled after programmatic scrolls
    const deferredUpdate = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(update);
    };

    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    // window scroll fires after window.scrollTo() from scroll-lock release
    window.addEventListener('scroll', deferredUpdate, { passive: true });
    // pageshow fires when the page is restored from bfcache
    window.addEventListener('pageshow', deferredUpdate);
    return () => {
      cancelAnimationFrame(rafId);
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
      window.removeEventListener('scroll', deferredUpdate);
      window.removeEventListener('pageshow', deferredUpdate);
      document.documentElement.style.removeProperty('--pullz-viewport-bottom-offset');
    };
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
    if (view.type === 'LEADERBOARD') return 'LEADERBOARD';
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
      className={`pullz-mobile-bottom-nav fixed bottom-[var(--pullz-viewport-bottom-offset,0px)] left-0 right-0 top-auto z-[220] h-[var(--pullz-mobile-bottom-nav-height,82px)] w-full border-t border-blue-300/15 bg-[#070b13]/94 px-2 pb-[max(env(safe-area-inset-bottom),10px)] pt-2.5 shadow-[0_-18px_50px_rgba(0,0,0,0.48),0_0_36px_rgba(32,93,215,0.12)] backdrop-blur-2xl transition-[opacity,transform] duration-200 ease-out lg:hidden ${
        isSuppressed || showTopUpModal ? 'pointer-events-none opacity-0' : 'opacity-100'
      }`}
      style={{
        height: 'calc(72px + max(env(safe-area-inset-bottom), 10px))',
        bottom: 'var(--pullz-viewport-bottom-offset, 0px)',
        paddingBottom: 'max(env(safe-area-inset-bottom), 10px)',
        transform: isSuppressed || showTopUpModal ? 'translate3d(0, 100%, 0)' : 'translate3d(0, 0, 0)',
        WebkitTransform: isSuppressed || showTopUpModal ? 'translate3d(0, 100%, 0)' : 'translate3d(0, 0, 0)',
        willChange: isSuppressed || showTopUpModal ? 'transform' : 'auto'
      }}
      aria-label="Primary navigation"
      aria-hidden={isSuppressed || showTopUpModal}
    >
      <nav className="relative grid h-full grid-cols-5 items-center gap-1 overflow-hidden rounded-[24px] border border-white/10 bg-white/[0.035] px-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] before:pointer-events-none before:absolute before:inset-0 before:bg-[radial-gradient(circle_at_12%_0%,rgba(32,93,215,0.18),transparent_34%),radial-gradient(circle_at_88%_0%,rgba(84,245,179,0.10),transparent_32%)] before:content-['']">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeId === item.id;
          const isProfile = item.id === 'PROFILE';
          return (
            <div key={item.id} className="relative flex justify-center">
              {item.id === 'PROFILE' && showFreeBoxTooltip ? (
                <div className="absolute bottom-full left-1/2 z-20 mb-1.5 w-max -translate-x-1/2 rounded-xl border border-emerald-300/25 bg-[#071018]/95 px-2 py-1 text-[10px] font-semibold text-emerald-100 shadow-[0_10px_28px_rgba(0,0,0,0.45)] backdrop-blur-xl">
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
                className={`relative z-10 flex min-h-14 w-full flex-col items-center justify-center gap-1 rounded-2xl px-1 py-1 text-[9px] font-black uppercase tracking-wide transition-all duration-200 active:scale-[0.98] ${
                  isActive ? 'bg-[linear-gradient(135deg,rgba(32,93,215,0.34),rgba(84,245,179,0.13))] text-[#7dd3fc] shadow-[inset_0_0_0_1px_rgba(125,211,252,0.20),0_8px_22px_rgba(32,93,215,0.16)]' : 'text-slate-400 hover:bg-white/[0.06] hover:text-slate-100'
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
                      <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-[#7dd3fc] ring-1 ring-[#070b13]" aria-hidden="true" />
                    )}
                    {hasFreeSignupBox && (
                      <span className="absolute -left-0.5 -top-0.5 inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400 ring-1 ring-[#070b13]" aria-hidden="true" />
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
