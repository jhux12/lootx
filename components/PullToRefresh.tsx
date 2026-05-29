import React, { useEffect, useRef, useState } from 'react';

const TRIGGER_DISTANCE = 86;
const MAX_PULL_DISTANCE = 140;

const getScrollableAncestor = (target: Element | null): Element | null => {
  let element = target;
  while (element && element !== document.body && element !== document.documentElement) {
    const style = window.getComputedStyle(element);
    const canScrollY = /(auto|scroll|overlay)/.test(style.overflowY);
    if (canScrollY && element.scrollHeight > element.clientHeight) return element;
    element = element.parentElement;
  }
  return null;
};

const PullToRefresh: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [pullDistance, setPullDistance] = useState(0);
  const [isReady, setIsReady] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const touchStartY = useRef(0);
  const isPulling = useRef(false);
  const isCoarsePointerRef = useRef(false);
  const pullDistanceRef = useRef(0);
  const isRefreshingRef = useRef(false);

  useEffect(() => {
    pullDistanceRef.current = pullDistance;
  }, [pullDistance]);

  useEffect(() => {
    isRefreshingRef.current = isRefreshing;
  }, [isRefreshing]);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return undefined;

    const media = window.matchMedia('(pointer: coarse)');
    const updateCoarsePointer = () => {
      isCoarsePointerRef.current = media.matches;
    };

    updateCoarsePointer();
    media.addEventListener?.('change', updateCoarsePointer);

    const handleTouchStart = (event: TouchEvent) => {
      if (!isCoarsePointerRef.current || event.touches.length !== 1 || isRefreshingRef.current) return;
      if (window.scrollY > 0) return;

      const target = event.target as Element | null;
      if (target?.closest('[data-disable-pull-refresh="true"]')) return;
      if (getScrollableAncestor(target)) return;

      touchStartY.current = event.touches[0].clientY;
      isPulling.current = true;
      setIsReady(false);
    };

    const handleTouchMove = (event: TouchEvent) => {
      if (!isPulling.current || event.touches.length !== 1 || isRefreshingRef.current) return;

      const currentY = event.touches[0].clientY;
      const delta = currentY - touchStartY.current;

      if (delta <= 0) {
        setPullDistance(0);
        return;
      }

      if (window.scrollY > 0) {
        setPullDistance(0);
        isPulling.current = false;
        return;
      }

      const dampened = Math.min(MAX_PULL_DISTANCE, Math.round(delta * 0.45));
      setPullDistance(dampened);
      setIsReady(dampened >= TRIGGER_DISTANCE);
      event.preventDefault();
    };

    const handleTouchEnd = () => {
      if (!isPulling.current || isRefreshingRef.current) {
        isPulling.current = false;
        return;
      }

      if (pullDistanceRef.current >= TRIGGER_DISTANCE) {
        setIsRefreshing(true);
        setPullDistance(48);

        window.setTimeout(() => {
          window.location.reload();
        }, 220);
        return;
      }

      setPullDistance(0);
      setIsReady(false);
      isPulling.current = false;
    };

    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });
    document.addEventListener('touchcancel', handleTouchEnd, { passive: true });

    return () => {
      media.removeEventListener?.('change', updateCoarsePointer);
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
      document.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, []);

  const indicatorLabel = isRefreshing ? 'Refreshing' : isReady ? 'Release to refresh' : 'Pull down to refresh';

  return (
    <div
      className="relative min-h-screen"
      style={{
        overscrollBehaviorY: 'none'
      }}
    >
      <div
        aria-hidden="true"
        style={{
          height: `${pullDistance}px`,
          transition: isPulling.current || isRefreshing ? 'none' : 'height 200ms ease-out'
        }}
      />
      <div
        aria-live="polite"
        aria-label={indicatorLabel}
        className="pointer-events-none fixed inset-x-0 top-[max(env(safe-area-inset-top),0px)] z-[70] flex justify-center"
        style={{
          transform: `translateY(${Math.max(-44, pullDistance - 54)}px)`,
          opacity: pullDistance > 0 || isRefreshing ? 1 : 0,
          transition: 'opacity 160ms ease, transform 180ms ease'
        }}
      >
        <div className="grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-[#0b1220]/88 text-cyan-100 shadow-[0_10px_28px_rgba(0,0,0,0.26)] backdrop-blur-md">
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className={`h-5 w-5 ${isRefreshing || isReady ? 'animate-spin text-cyan-200' : 'text-white/75'}`}
            fill="none"
          >
            <path
              d="M17.7 6.3A8 8 0 1 0 20 12"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
            />
            <path
              d="M18 3v4h-4"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
            />
          </svg>
        </div>
      </div>
      <div className="relative">
        {children}
      </div>
    </div>
  );
};

export default PullToRefresh;
