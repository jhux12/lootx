import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FlaskConical, Gift, Home, PackageOpen, Trophy } from 'lucide-react';
import { useGame } from '../context/GameContext';
import { useSound } from '../context/SoundContext';

type NavItem = {
  id: 'HOME' | 'BOXES' | 'CUSTOM_CREATOR' | 'LEADERBOARD' | 'BONUSES';
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  requiresAuth?: boolean;
};

const NAV_ITEMS: NavItem[] = [
  { id: 'HOME', label: 'Home', icon: Home },
  { id: 'BOXES', label: 'Boxes', icon: PackageOpen },
  { id: 'CUSTOM_CREATOR', label: 'Case Lab', icon: FlaskConical, requiresAuth: true },
  { id: 'LEADERBOARD', label: 'Leaderboard', icon: Trophy },
  { id: 'BONUSES', label: 'Bonuses', icon: Gift, requiresAuth: true }
];

export const MobileBottomNav: React.FC = () => {
  const { view, setView, isAuthenticated, openAuthModal } = useGame();
  const { playSound } = useSound();
  const [isVisible, setIsVisible] = useState(true);
  const lastScrollY = useRef(0);
  const ticking = useRef(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    lastScrollY.current = window.scrollY;

    const handleScroll = () => {
      if (ticking.current) return;
      ticking.current = true;

      window.requestAnimationFrame(() => {
        const currentY = window.scrollY;
        const delta = currentY - lastScrollY.current;
        const hideThreshold = 12;
        const showThreshold = 2;

        if (delta > hideThreshold) {
          setIsVisible(false);
        } else if (delta < -showThreshold) {
          setIsVisible(true);
        }

        lastScrollY.current = currentY;

        ticking.current = false;
      });
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updatePreference = () => setPrefersReducedMotion(mediaQuery.matches);
    updatePreference();
    mediaQuery.addEventListener('change', updatePreference);
    return () => mediaQuery.removeEventListener('change', updatePreference);
  }, []);

  const handleNav = (nextView: NavItem['id']) => {
    playSound('click');
    if (nextView === 'BONUSES' && !isAuthenticated) {
      openAuthModal('login');
      return;
    }
    if (nextView === 'CUSTOM_CREATOR' && !isAuthenticated) {
      openAuthModal('login');
      return;
    }
    setView({ type: nextView });
  };

  const activeId = useMemo(() => view.type as NavItem['id'], [view.type]);

  return (
    <div
      className={`fixed left-1/2 z-40 w-[min(92vw,560px)] -translate-x-1/2 rounded-2xl border border-white/10 bg-[#0b1020]/70 px-3 py-2 shadow-[0_12px_40px_-20px_rgba(0,0,0,0.9)] backdrop-blur-md transition-all duration-300 ease-out lg:hidden ${
        isVisible ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0 pointer-events-none'
      } ${prefersReducedMotion ? 'transition-none' : 'motion-reduce:transition-none'}`}
      style={{ bottom: 'calc(env(safe-area-inset-bottom) + 12px)' }}
      aria-label="Primary navigation"
    >
      <nav className="grid grid-cols-5 gap-1">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeId === item.id;
          return (
            <button
              key={item.id}
              onClick={() => handleNav(item.id)}
              className={`relative flex flex-col items-center gap-1 rounded-xl px-2 py-2 text-[10px] font-semibold transition-colors ${
                isActive ? 'text-white' : 'text-gray-400'
              }`}
              aria-current={isActive ? 'page' : undefined}
            >
              <Icon className={`h-4 w-4 ${isActive ? 'text-white' : 'text-gray-500'}`} />
              <span className="leading-none">{item.label}</span>
              <span
                className={`mt-1 h-0.5 w-6 rounded-full bg-gradient-to-r from-purple-400/0 via-purple-400/70 to-blue-400/0 transition-opacity ${
                  isActive ? 'opacity-100' : 'opacity-0'
                }`}
              />
            </button>
          );
        })}
      </nav>
    </div>
  );
};
