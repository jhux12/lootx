import React, { useEffect, useRef, useState } from 'react';

const TRIGGER_DISTANCE = 78;
const MAX_PULL_DISTANCE = 128;
const ICON_RESTING_OFFSET = 34;

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
        setPullDistance(ICON_RESTING_OFFSET);

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

  const pullProgress = Math.min(1, pullDistance / TRIGGER_DISTANCE);
  const iconRotation = Math.round(pullProgress * 360);
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
          height: `${Math.min(pullDistance, ICON_RESTING_OFFSET)}px`,
          transition: isPulling.current || isRefreshing ? 'none' : 'height 180ms ease-out'
        }}
      />
      <div
        aria-live="polite"
        aria-label={indicatorLabel}
        className="pointer-events-none fixed inset-x-0 top-[max(env(safe-area-inset-top),0px)] z-[70] flex justify-center pt-2"
        style={{
          transform: `translateY(${Math.max(-28, Math.min(pullDistance - 42, 18))}px)`,
          opacity: pullDistance > 4 || isRefreshing ? Math.max(0.2, pullProgress) : 0,
          transition: isPulling.current || isRefreshing ? 'opacity 80ms linear, transform 80ms linear' : 'opacity 160ms ease, transform 180ms ease'
        }}
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className={`h-6 w-6 drop-shadow-[0_2px_8px_rgba(0,0,0,0.35)] ${isRefreshing ? 'animate-spin text-cyan-200' : 'text-white/80'}`}
          fill="none"
          style={isRefreshing ? undefined : { transform: `rotate(${iconRotation}deg)`, transition: 'transform 80ms linear' }}
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
      <div className="relative">
        {children}
      </div>
    </div>
  );
};

export default PullToRefresh;
