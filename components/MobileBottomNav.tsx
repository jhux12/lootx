import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Boxes, Flame, X } from 'lucide-react';
import { useAuth, useUI, useWallet } from '../context/GameContext';
import { useSound } from '../context/SoundContext';
import { COIN_ICON } from '../constants';

/**
 * The same bottom dock shown on the homepage (Home / Boxes / Balance / More),
 * for every other page. Keeping one shared design here means any visual or
 * behavioral change to the dock only needs to happen in one place — this
 * component mirrors src/figma/FigmaHomePage.tsx's dock markup and classes.
 */
export const MobileBottomNav: React.FC = () => {
  const { view, setView, showTopUpModal, setShowTopUpModal } = useUI();
  const { isAuthenticated, openAuthModal } = useAuth();
  const { balance } = useWallet();
  const { playSound } = useSound();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSuppressed, setIsSuppressed] = useState(false);
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (typeof document === 'undefined') return undefined;

    const root = document.documentElement;
    root.style.setProperty('--pullz-mobile-bottom-nav-height', 'calc(86px + max(env(safe-area-inset-bottom), 8px))');
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
      setIsMobileMenuOpen(Boolean(detail?.isOpen));
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
    const deferredUpdate = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(update);
    };

    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    window.addEventListener('scroll', deferredUpdate, { passive: true });
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

  const isHidden = isSuppressed || showTopUpModal;

  const navigate = (target: 'HOME' | 'BOXES') => {
    playSound('click');
    if (isMobileMenuOpen && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('pullz:close-mobile-menu'));
    }
    setView({ type: target });
  };

  const toggleMobileMenu = () => {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new CustomEvent('pullz:toggle-mobile-menu'));
  };

  const handleBalanceClick = () => {
    if (!isAuthenticated) {
      openAuthModal('login');
      return;
    }
    setShowTopUpModal(true);
  };

  // The homepage renders its own copy of this dock directly (and it's
  // desktop-hidden via CSS); the spin campaign uses section-based header
  // navigation instead.
  if (view.type === 'HOME' || view.type === 'SPIN') return null;

  const nav = (
    <nav
      className="bet-home-dock lg:hidden"
      style={{
        bottom: `calc(max(20px, env(safe-area-inset-bottom)) + var(--pullz-viewport-bottom-offset, 0px))`,
        transition: 'opacity 0.2s ease-out, transform 0.2s ease-out',
        opacity: isHidden ? 0 : 1,
        pointerEvents: isHidden ? 'none' : 'auto',
        transform: isHidden ? 'translate3d(-50%, 130%, 0)' : 'translate3d(-50%, 0, 0)',
      }}
      aria-label="Primary navigation"
      aria-hidden={isHidden}
    >
      <button type="button" className={view.type === 'BOXES' || view.type === 'CASE_OPENING' ? '' : undefined} onClick={() => navigate('HOME')}>
        <Flame /><span>Home</span>
      </button>
      <button type="button" className={view.type === 'BOXES' || view.type === 'CASE_OPENING' ? 'is-active' : ''} onClick={() => navigate('BOXES')}>
        <Boxes /><span>Boxes</span>
      </button>
      <button
        type="button"
        onClick={handleBalanceClick}
        aria-label={isAuthenticated ? 'Add coins' : 'Sign in to add coins'}
      >
        <img src={COIN_ICON} alt="" className="bet-home-dock-coin" />
        <span>{isAuthenticated ? balance.toLocaleString(undefined, { maximumFractionDigits: 0 }) : '——'}</span>
      </button>
      <button type="button" onClick={toggleMobileMenu} aria-expanded={isMobileMenuOpen}>
        {isMobileMenuOpen ? <X /> : <span className="bet-home-dock-more-dots" aria-hidden="true"><i /><i /><i /></span>}
        <span>{isMobileMenuOpen ? 'Close' : 'More'}</span>
      </button>
    </nav>
  );

  return portalTarget ? createPortal(nav, portalTarget) : nav;
};
