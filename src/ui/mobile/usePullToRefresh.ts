import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

type UsePullToRefreshOptions = {
  enabled: boolean;
  onRefresh: () => Promise<void>;
  threshold?: number;
};

const MAX_PULL_DISTANCE = 120;

export function usePullToRefresh({ enabled, onRefresh, threshold = 70 }: UsePullToRefreshOptions) {
  const [pullDistance, setPullDistance] = useState(0);
  const [isPulling, setIsPulling] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hasHapticFired, setHasHapticFired] = useState(false);

  const startYRef = useRef(0);
  const reducedMotion = useMemo(
    () => (typeof window !== 'undefined' ? window.matchMedia('(prefers-reduced-motion: reduce)').matches : false),
    []
  );

  const reset = useCallback(() => {
    setPullDistance(0);
    setIsPulling(false);
    setIsReady(false);
    setHasHapticFired(false);
  }, []);

  useEffect(() => {
    if (!enabled) {
      reset();
      return;
    }

    const onTouchStart = (event: TouchEvent) => {
      if (isRefreshing || window.scrollY !== 0) return;
      startYRef.current = event.touches[0]?.clientY ?? 0;
      setIsPulling(true);
      setHasHapticFired(false);
    };

    const onTouchMove = (event: TouchEvent) => {
      if (!isPulling || isRefreshing) return;

      const currentY = event.touches[0]?.clientY ?? 0;
      const diffY = Math.max(0, currentY - startYRef.current);
      if (diffY <= 0) return;
      if (window.scrollY !== 0) return;

      const nextDistance = Math.min(MAX_PULL_DISTANCE, diffY);
      setPullDistance(nextDistance);

      const crossedThreshold = nextDistance >= threshold;
      setIsReady(crossedThreshold);

      if (crossedThreshold && !hasHapticFired && 'vibrate' in navigator) {
        navigator.vibrate(10);
        setHasHapticFired(true);
      }

      event.preventDefault();
    };

    const onTouchEnd = async () => {
      if (!isPulling) return;

      if (isReady) {
        setIsRefreshing(true);
        setPullDistance(reducedMotion ? 0 : threshold / 2);
        try {
          await onRefresh();
        } finally {
          setIsRefreshing(false);
          reset();
        }
        return;
      }

      reset();
    };

    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd, { passive: true });
    window.addEventListener('touchcancel', onTouchEnd, { passive: true });

    return () => {
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [enabled, hasHapticFired, isPulling, isReady, isRefreshing, onRefresh, reducedMotion, reset, threshold]);

  const contentStyle = useMemo(() => {
    const transition = isPulling || isRefreshing || reducedMotion ? 'none' : 'transform 180ms ease-out';
    return {
      transform: `translateY(${pullDistance}px)`,
      transition,
      willChange: 'transform'
    } as const;
  }, [isPulling, isRefreshing, pullDistance, reducedMotion]);

  return {
    pullDistance,
    isPulling,
    isReady,
    isRefreshing,
    contentStyle
  };
}
