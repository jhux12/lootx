import React, { useEffect, useMemo, useRef, useState } from 'react';

const TRIGGER_DISTANCE = 86;
const MAX_PULL_DISTANCE = 140;

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
        setPullDistance(58);

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

  const indicatorLabel = useMemo(() => {
    if (isRefreshing) return 'Refreshing…';
    if (isReady) return 'Release to refresh';
    return 'Pull down to refresh';
  }, [isReady, isRefreshing]);

  return (
    <div
      className="relative min-h-screen"
      style={{
        transform: `translateY(${pullDistance}px)`,
        transition: isPulling.current || isRefreshing ? 'none' : 'transform 200ms ease-out',
        willChange: pullDistance > 0 ? 'transform' : undefined
      }}
    >
      <div
        aria-hidden={pullDistance === 0 && !isRefreshing}
        className="pointer-events-none fixed inset-x-0 top-[max(env(safe-area-inset-top),0px)] z-[70] flex justify-center"
        style={{
          transform: `translateY(${Math.max(-60, pullDistance - 66)}px)`,
          opacity: pullDistance > 0 || isRefreshing ? 1 : 0,
          transition: 'opacity 180ms ease, transform 180ms ease'
        }}
      >
        <div className="flex items-center gap-2 rounded-full border border-cyan-300/35 bg-[#0d1628]/90 px-4 py-2 text-xs font-semibold tracking-wide text-cyan-100 shadow-[0_10px_30px_rgba(34,211,238,0.28)] backdrop-blur-md">
          <span
            className={`inline-flex h-4 w-4 rounded-full border-2 border-cyan-100/35 border-t-cyan-200 ${
              isRefreshing || isReady ? 'animate-spin' : ''
            }`}
          />
          {indicatorLabel}
        </div>
      </div>
      {children}
    </div>
  );
};

export default PullToRefresh;
