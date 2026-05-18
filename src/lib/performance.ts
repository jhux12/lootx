import { useEffect, useState } from 'react';

export type PerformanceMode = {
  isMobile: boolean;
  prefersReducedMotion: boolean;
  isLowPower: boolean;
  isHidden: boolean;
};

const MOBILE_QUERY = '(max-width: 768px), (pointer: coarse)';
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

const getDeviceMemory = () => {
  if (typeof navigator === 'undefined') return undefined;
  return (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
};

const resolveInitialMode = (): PerformanceMode => {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return { isMobile: false, prefersReducedMotion: false, isLowPower: false, isHidden: false };
  }

  const isMobile = window.matchMedia(MOBILE_QUERY).matches;
  const prefersReducedMotion = window.matchMedia(REDUCED_MOTION_QUERY).matches;
  const cores = navigator.hardwareConcurrency ?? 8;
  const memory = getDeviceMemory() ?? 8;
  const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
  const isLowPower = prefersReducedMotion || (isMobile && (cores <= 4 || memory <= 4 || isSafari));

  return {
    isMobile,
    prefersReducedMotion,
    isLowPower,
    isHidden: document.visibilityState === 'hidden'
  };
};

export const applyPerformanceClasses = (mode: PerformanceMode) => {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.classList.toggle('pullz-mobile-optimized', mode.isMobile || mode.isLowPower);
  root.classList.toggle('pullz-low-performance', mode.isLowPower);
  root.classList.toggle('pullz-reduced-motion', mode.prefersReducedMotion);
  root.classList.toggle('pullz-tab-hidden', mode.isHidden);
};

export const usePerformanceMode = () => {
  const [mode, setMode] = useState<PerformanceMode>(() => resolveInitialMode());

  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    const mobileMedia = window.matchMedia(MOBILE_QUERY);
    const motionMedia = window.matchMedia(REDUCED_MOTION_QUERY);
    let rafId: number | null = null;
    let cancelled = false;

    const updateMode = (forceLowPower = false) => {
      setMode((current) => {
        const cores = navigator.hardwareConcurrency ?? 8;
        const memory = getDeviceMemory() ?? 8;
        const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
        const next: PerformanceMode = {
          isMobile: mobileMedia.matches,
          prefersReducedMotion: motionMedia.matches,
          isLowPower: forceLowPower || motionMedia.matches || (mobileMedia.matches && (cores <= 4 || memory <= 4 || isSafari)) || current.isLowPower,
          isHidden: document.visibilityState === 'hidden'
        };
        applyPerformanceClasses(next);
        return next;
      });
    };

    const sampleFps = () => {
      if (!mobileMedia.matches || motionMedia.matches) return;
      let frames = 0;
      let startedAt = performance.now();
      let previous = startedAt;
      let droppedFrames = 0;

      const tick = (now: number) => {
        if (cancelled) return;
        frames += 1;
        if (now - previous > 34) droppedFrames += 1;
        previous = now;

        if (frames < 90 && now - startedAt < 1800) {
          rafId = window.requestAnimationFrame(tick);
          return;
        }

        const elapsed = Math.max(1, now - startedAt);
        const fps = (frames / elapsed) * 1000;
        if (fps < 45 || droppedFrames > 10) updateMode(true);
      };

      rafId = window.requestAnimationFrame((now) => {
        startedAt = now;
        previous = now;
        rafId = window.requestAnimationFrame(tick);
      });
    };

    const onChange = () => updateMode(false);
    const onVisibility = () => updateMode(false);

    updateMode(false);
    const idleId = 'requestIdleCallback' in window
      ? window.requestIdleCallback(sampleFps, { timeout: 3200 })
      : window.setTimeout(sampleFps, 1800);

    mobileMedia.addEventListener('change', onChange);
    motionMedia.addEventListener('change', onChange);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelled = true;
      if (rafId !== null) window.cancelAnimationFrame(rafId);
      if ('cancelIdleCallback' in window && typeof idleId === 'number') window.cancelIdleCallback(idleId);
      else window.clearTimeout(idleId as number);
      mobileMedia.removeEventListener('change', onChange);
      motionMedia.removeEventListener('change', onChange);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  return mode;
};
