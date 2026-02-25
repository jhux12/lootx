import React, { useEffect, useMemo, useState } from 'react';
import { Backpack, Box, Crown, Gamepad2 } from 'lucide-react';
import { useGame } from '../context/GameContext';
import { useSound } from '../context/SoundContext';

type NavItem = {
  id: 'MENU' | 'BOXES' | 'PLINKO' | 'INVENTORY' | 'LEADERBOARD';
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  requiresAuth?: boolean;
};

const NAV_ITEMS: NavItem[] = [
  { id: 'MENU', label: 'Menu' },
  { id: 'BOXES', label: 'Boxes', icon: Box },
  { id: 'PLINKO', label: 'Upgrader', icon: Gamepad2 },
  { id: 'INVENTORY', label: 'Inventory', icon: Backpack, requiresAuth: true },
  { id: 'LEADERBOARD', label: 'Ladder', icon: Crown }
];

export const MobileBottomNav: React.FC = () => {
  const { view, setView, isAuthenticated, openAuthModal } = useGame();
  const { playSound } = useSound();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const handleMenuState = (event: Event) => {
      const detail = (event as CustomEvent<{ isOpen: boolean }>).detail;
      setIsMenuOpen(Boolean(detail?.isOpen));
    };

    window.addEventListener('pullz:mobile-menu-state', handleMenuState);
    return () => window.removeEventListener('pullz:mobile-menu-state', handleMenuState);
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

    setView({ type: item.id });
  };

  const activeId = useMemo(() => (view.type === 'HOME' ? 'MENU' : (view.type as NavItem['id'])), [view.type]);
  const iconClassName = 'h-5 w-5 [stroke-width:1.6]';

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-[70] border-t border-white/10 bg-[#080b10]/95 px-2.5 pb-[calc(env(safe-area-inset-bottom)+6px)] pt-2 backdrop-blur lg:hidden"
      aria-label="Primary navigation"
    >
      <nav className="grid grid-cols-5 gap-0.5">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = item.id === 'MENU' ? isMenuOpen : activeId === item.id;
          const isMenuToggle = item.id === 'MENU';
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleNav(item)}
              className={`flex flex-col items-center gap-0.5 rounded-lg py-1 text-[11px] font-medium ${
                isActive ? 'text-white' : 'text-gray-500'
              }`}
              aria-current={isActive ? 'page' : undefined}
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
                <Icon className={iconClassName} />
              ) : null}
              {!isMenuToggle && <span>{item.label}</span>}
            </button>
          );
        })}
      </nav>
    </div>
  );
};
