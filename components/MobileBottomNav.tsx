import React, { useEffect, useMemo, useState } from 'react';
import { Backpack, Box, Crown, X } from 'lucide-react';
import { useGame } from '../context/GameContext';
import { useSound } from '../context/SoundContext';

type NavItem = {
  id: 'MENU' | 'BOXES' | 'PLINKO' | 'INVENTORY' | 'LEADERBOARD';
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  iconClassName?: string;
  requiresAuth?: boolean;
};

const UpgraderIcon: React.FC<{ className?: string }> = ({ className }) => (
  <i className={`fa-brands fa-superpowers ${className ?? ''}`.trim()} aria-hidden="true" />
);

const NAV_ITEMS: NavItem[] = [
  { id: 'MENU', label: 'Menu' },
  { id: 'BOXES', label: 'Boxes', icon: Box },
  { id: 'PLINKO', label: 'Upgrader', icon: UpgraderIcon, iconClassName: 'text-[18px]' },
  { id: 'INVENTORY', label: 'Inventory', icon: Backpack, requiresAuth: true },
  { id: 'LEADERBOARD', label: 'Ladder', icon: Crown }
];

export const MobileBottomNav: React.FC = () => {
  const { view, setView, isAuthenticated, openAuthModal, user, boxes } = useGame();
  const { playSound } = useSound();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isFreeBoxTooltipDismissed, setIsFreeBoxTooltipDismissed] = useState(false);

  useEffect(() => {
    if (typeof document === 'undefined') return undefined;

    document.documentElement.style.setProperty('--pullz-mobile-bottom-nav-height', 'calc(env(safe-area-inset-bottom) + 64px)');
    return () => {
      document.documentElement.style.removeProperty('--pullz-mobile-bottom-nav-height');
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const handleMenuState = (event: Event) => {
      const detail = (event as CustomEvent<{ isOpen: boolean }>).detail;
      setIsMenuOpen(Boolean(detail?.isOpen));
    };

    window.addEventListener('pullz:mobile-menu-state', handleMenuState);
    return () => window.removeEventListener('pullz:mobile-menu-state', handleMenuState);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setIsFreeBoxTooltipDismissed(window.sessionStorage.getItem('pullz:free-box-tooltip-dismissed') === '1');
  }, []);

  const handleNav = (item: NavItem) => {
    playSound('click');

    if (item.id === 'MENU') {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('pullz:toggle-mobile-menu'));
      }
      return;
    }

    if (item.requiresAuth && !isAuthenticated) {
      openAuthModal('login');
      return;
    }

    if (isMenuOpen && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('pullz:close-mobile-menu'));
    }

    setView({ type: item.id });
  };

  const activeId = useMemo(() => (view.type === 'HOME' ? 'MENU' : (view.type as NavItem['id'])), [view.type]);

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

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-[70] min-h-[var(--pullz-mobile-bottom-nav-height,72px)] border-t border-cyan-400/20 bg-[#141b22]/95 px-2.5 pb-[calc(env(safe-area-inset-bottom)+6px)] pt-2 backdrop-blur lg:hidden"
      aria-label="Primary navigation"
    >
      <nav className="grid grid-cols-5 gap-0.5">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = item.id === 'MENU' ? isMenuOpen : activeId === item.id;
          const isMenuToggle = item.id === 'MENU';
          return (
            <div key={item.id} className="relative flex justify-center">
              {item.id === 'INVENTORY' && showFreeBoxTooltip ? (
                <div className="absolute bottom-full left-1/2 z-20 mb-1.5 w-max -translate-x-1/2 rounded-md border border-emerald-400/35 bg-[#0f1517] px-2 py-1 text-[10px] font-semibold text-emerald-200 shadow-lg">
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
                className={`flex flex-col items-center gap-0.5 rounded-lg py-1 text-[11px] font-medium ${
                  isActive ? 'text-white' : 'text-slate-400'
                }`}
                aria-current={isActive ? 'page' : undefined}
                aria-expanded={isMenuToggle ? isMenuOpen : undefined}
                aria-label={isMenuToggle ? (isMenuOpen ? 'Close menu' : 'Open menu') : undefined}
              >
                {isMenuToggle ? (
                  <span className="relative mt-0.5 block h-5 w-5" aria-hidden="true">
                    <span
                      className={`absolute left-1 top-[7px] h-px w-3.5 rounded-full bg-current transition-transform duration-200 ${
                        isMenuOpen ? 'translate-y-[4px] rotate-45' : ''
                      }`}
                    />
                    <span
                      className={`absolute left-1 top-[11px] h-px w-3.5 rounded-full bg-current transition-opacity duration-200 ${
                        isMenuOpen ? 'opacity-0' : 'opacity-100'
                      }`}
                    />
                    <span
                      className={`absolute left-1 top-[15px] h-px w-3.5 rounded-full bg-current transition-transform duration-200 ${
                        isMenuOpen ? '-translate-y-[4px] -rotate-45' : ''
                      }`}
                    />
                  </span>
                ) : Icon ? (
                  <span className="relative">
                    <Icon className={item.iconClassName ?? iconClassName} />
                    {item.id === 'INVENTORY' && hasFreeSignupBox && (
                      <span className="absolute -right-1 -top-1 inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-[#1b2024]" aria-hidden="true" />
                    )}
                  </span>
                ) : null}
                {!isMenuToggle && <span>{item.label}</span>}
              </button>
            </div>
          );
        })}
      </nav>
    </div>
  );
};
