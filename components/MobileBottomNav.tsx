import React, { useMemo } from 'react';
import { Backpack, Box, Crown } from 'lucide-react';
import { useGame } from '../context/GameContext';
import { useSound } from '../context/SoundContext';

type NavItem = {
  id: 'HOME' | 'BOXES' | 'PLINKO' | 'INVENTORY' | 'PROFILE';
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  iconClassName?: string;
  requiresAuth?: boolean;
};

const UpgraderIcon: React.FC<{ className?: string }> = ({ className }) => (
  <i className={`fa-brands fa-superpowers ${className ?? ''}`.trim()} aria-hidden="true" />
);

const NAV_ITEMS: NavItem[] = [
  { id: 'HOME', label: 'Home' },
  { id: 'BOXES', label: 'Boxes', icon: Box },
  { id: 'PLINKO', label: 'Upgrader', icon: UpgraderIcon, iconClassName: 'text-[18px]' },
  { id: 'INVENTORY', label: 'Inventory', icon: Backpack, requiresAuth: true },
  { id: 'PROFILE', label: 'Profile', icon: Crown, requiresAuth: true }
];

export const MobileBottomNav: React.FC = () => {
  const { view, setView, isAuthenticated, openAuthModal, user, boxes } = useGame();
  const { playSound } = useSound();
  const handleNav = (item: NavItem) => {
    playSound('click');

    if (item.requiresAuth && !isAuthenticated) {
      openAuthModal('login');
      return;
    }

    setView({ type: item.id });
  };

  const activeId = useMemo(() => (view.type as NavItem['id']), [view.type]);

  const hasFreeSignupBox = useMemo(() => (
    isAuthenticated && boxes.some((box) => box.isDaily) && !user.lastFreeBoxClaim
  ), [boxes, isAuthenticated, user.lastFreeBoxClaim]);
  const iconClassName = 'h-5 w-5 [stroke-width:1.6]';

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-[70] border-t border-white/10 bg-[#0e1422]/88 px-2.5 pb-[calc(env(safe-area-inset-bottom)+6px)] pt-2 shadow-[0_-12px_30px_rgba(0,0,0,0.45)] backdrop-blur-xl lg:hidden"
      aria-label="Primary navigation"
    >
      <nav className="grid grid-cols-5 gap-0.5">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeId === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleNav(item)}
              className={`flex min-h-[50px] flex-col items-center justify-center gap-1 rounded-xl py-1 text-[11px] font-semibold transition-all ${
                isActive ? 'bg-white/10 text-white shadow-[0_0_16px_rgba(124,92,255,0.2)]' : 'text-gray-500'
              }`}
              aria-current={isActive ? 'page' : undefined}
            >
              {Icon ? (
                <span className="relative">
                  <Icon className={item.iconClassName ?? iconClassName} />
                  {item.id === 'INVENTORY' && hasFreeSignupBox && (
                    <span className="absolute -right-1 -top-1 inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-[#0e1422]" aria-hidden="true" />
                  )}
                </span>
              ) : null}
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
};
