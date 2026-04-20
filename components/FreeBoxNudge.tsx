import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Gift, X } from 'lucide-react';
import { useGame } from '../context/GameContext';

const DESKTOP_QUERY = '(min-width: 1024px)';
const APPEAR_DELAY_MS = 600;

type Position = {
  top: number;
  left: number;
  isDesktop: boolean;
};

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

export const FreeBoxNudge: React.FC = () => {
  const { authInitialized, isAuthenticated, boxes, user, setView } = useGame();
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = useState<Position | null>(null);
  const [hiddenForSession, setHiddenForSession] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);

  const dismissKey = useMemo(() => (user.id ? `pullz:free-box-nudge:dismissed:${user.id}` : ''), [user.id]);
  const hasFreeSignupBox = useMemo(() => boxes.some((box) => box.isDaily), [boxes]);
  const isEligible = authInitialized
    && isAuthenticated
    && Boolean(user.id)
    && !user.isAdmin
    && hasFreeSignupBox
    && !user.lastFreeBoxClaim;

  const dismiss = () => {
    if (dismissKey && typeof window !== 'undefined') {
      window.sessionStorage.setItem(dismissKey, '1');
    }
    setHiddenForSession(true);
    setShouldRender(false);
  };

  useEffect(() => {
    if (!isEligible || !dismissKey || typeof window === 'undefined') {
      setHiddenForSession(false);
      return;
    }

    setHiddenForSession(window.sessionStorage.getItem(dismissKey) === '1');
  }, [dismissKey, isEligible]);

  useEffect(() => {
    if (!isEligible || hiddenForSession || typeof window === 'undefined') {
      setShouldRender(false);
      setPosition(null);
      return undefined;
    }

    let isCancelled = false;

    const getAnchor = () => {
      const isDesktop = window.matchMedia(DESKTOP_QUERY).matches;
      const selector = isDesktop
        ? '[data-free-box-desktop-anchor="true"]'
        : '[data-free-box-mobile-anchor="true"]';
      const anchor = document.querySelector<HTMLElement>(selector);
      return { isDesktop, anchor };
    };

    const updatePosition = () => {
      const { isDesktop, anchor } = getAnchor();
      const bubble = tooltipRef.current;
      if (!anchor || !bubble) {
        setPosition(null);
        return;
      }

      const rect = anchor.getBoundingClientRect();
      const bubbleRect = bubble.getBoundingClientRect();
      const padding = 12;
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const top = isDesktop
        ? rect.bottom + 10
        : rect.top - bubbleRect.height - 12;
      const left = isDesktop
        ? rect.right - bubbleRect.width + 4
        : rect.left + rect.width / 2 - bubbleRect.width / 2;

      setPosition({
        isDesktop,
        top: clamp(top, padding, viewportHeight - bubbleRect.height - padding),
        left: clamp(left, padding, viewportWidth - bubbleRect.width - padding)
      });
    };

    const timer = window.setTimeout(() => {
      if (isCancelled) return;
      setShouldRender(true);
      window.requestAnimationFrame(updatePosition);
    }, APPEAR_DELAY_MS);

    const onViewportChange = () => {
      window.requestAnimationFrame(updatePosition);
    };

    window.addEventListener('resize', onViewportChange);
    window.addEventListener('scroll', onViewportChange, true);

    return () => {
      isCancelled = true;
      window.clearTimeout(timer);
      window.removeEventListener('resize', onViewportChange);
      window.removeEventListener('scroll', onViewportChange, true);
    };
  }, [hiddenForSession, isEligible]);

  if (!isEligible || hiddenForSession || !shouldRender || !position) {
    return null;
  }

  return (
    <div
      ref={tooltipRef}
      className="fixed z-[160] w-[220px] animate-[nudgeFade_220ms_ease-out]"
      style={{ top: position.top, left: position.left }}
      role="dialog"
      aria-label="Free box available"
    >
      <button
        type="button"
        onClick={() => {
          setView({ type: 'PROFILE' });
          dismiss();
        }}
        className="group relative block w-full rounded-xl border border-emerald-300/30 bg-[linear-gradient(160deg,rgba(17,24,39,0.98),rgba(10,14,23,0.98))] px-3.5 py-3 text-left text-white shadow-[0_18px_45px_rgba(0,0,0,0.5)] transition hover:border-emerald-300/60"
      >
        <span
          aria-hidden="true"
          className={`absolute ${position.isDesktop ? 'right-5 -top-2 border-x-8 border-b-8 border-x-transparent border-b-emerald-300/25' : 'bottom-[-8px] left-1/2 -translate-x-1/2 border-x-8 border-t-8 border-x-transparent border-t-emerald-300/25'}`}
        />
        <span className="flex items-center gap-2.5 pr-7">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-400/15 text-emerald-300">
            <Gift className="h-4 w-4" />
          </span>
          <span className="text-sm font-semibold leading-tight">Free box available</span>
        </span>
        <span className="mt-1 block text-[11px] text-emerald-100/75 group-hover:text-emerald-100">Tap to open your signup reward.</span>
      </button>
      <button
        type="button"
        onClick={dismiss}
        className="absolute right-2 top-2 rounded-md p-1 text-gray-400 transition hover:bg-white/10 hover:text-white"
        aria-label="Dismiss free box tip"
      >
        <X className="h-3.5 w-3.5" />
      </button>

      <style>{`
        @keyframes nudgeFade {
          from {
            opacity: 0;
            transform: translateY(6px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
};
