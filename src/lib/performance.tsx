import React, { createContext, useContext, useEffect, useState } from 'react';

export type PerformanceMode = {
  isMobile: boolean;
  prefersReducedMotion: boolean;
  isLowPower: boolean;
  isHidden: boolean;
};

const MOBILE_QUERY = '(max-width: 768px), (pointer: coarse)';
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';
const SAMPLE_WINDOW_MS = 1_500;
const LOW_FPS = 44;

const resolveInitialMode = (): PerformanceMode => {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return { isMobile: false, prefersReducedMotion: false, isLowPower: false, isHidden: false };
  }
  const reducedMotion = window.matchMedia(REDUCED_MOTION_QUERY).matches;
  const navigatorWithMemory = navigator as Navigator & { deviceMemory?: number };
  const constrainedDevice = (navigator.hardwareConcurrency > 0 && navigator.hardwareConcurrency <= 4)
    || (navigatorWithMemory.deviceMemory !== undefined && navigatorWithMemory.deviceMemory <= 4);
  return {
    isMobile: window.matchMedia(MOBILE_QUERY).matches,
    prefersReducedMotion: reducedMotion,
    isLowPower: reducedMotion || constrainedDevice,
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

const PerformanceModeContext = createContext<PerformanceMode | null>(null);

/** One application-wide capability check. The optional FPS sample runs only once. */
export const PerformanceModeProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [mode, setMode] = useState<PerformanceMode>(resolveInitialMode);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    const mobileMedia = window.matchMedia(MOBILE_QUERY);
    const motionMedia = window.matchMedia(REDUCED_MOTION_QUERY);
    let rafId: number | null = null;
    let sampleTimer: number | null = null;
    let sampled = false;
    let cancelled = false;
    let fpsLowPower = false;

    const publish = () => {
      const initial = resolveInitialMode();
      const next = {
        ...initial,
        isMobile: mobileMedia.matches,
        prefersReducedMotion: motionMedia.matches,
        isLowPower: initial.isLowPower || fpsLowPower,
        isHidden: document.visibilityState === 'hidden'
      };
      applyPerformanceClasses(next);
      setMode(next);
    };
    const cancelSample = () => {
      if (rafId !== null) window.cancelAnimationFrame(rafId);
      if (sampleTimer !== null) window.clearTimeout(sampleTimer);
      rafId = null;
      sampleTimer = null;
    };
    const sampleOnce = () => {
      if (cancelled || sampled || document.hidden || motionMedia.matches) return;
      sampled = true;
      let frames = 0;
      let startedAt = 0;
      const tick = (now: number) => {
        if (cancelled || document.hidden) return;
        frames += 1;
        if (now - startedAt < SAMPLE_WINDOW_MS) {
          rafId = window.requestAnimationFrame(tick);
          return;
        }
        fpsLowPower = (frames / Math.max(1, now - startedAt)) * 1000 < LOW_FPS;
        publish();
        rafId = null;
      };
      rafId = window.requestAnimationFrame((now) => {
        startedAt = now;
        rafId = window.requestAnimationFrame(tick);
      });
    };
    const scheduleSample = () => {
      if (!sampled && !document.hidden && !motionMedia.matches) {
        sampleTimer = window.setTimeout(sampleOnce, 1_000);
      }
    };
    const onChange = () => { publish(); scheduleSample(); };
    const onVisibility = () => {
      publish();
      if (document.hidden) cancelSample();
      else scheduleSample();
    };

    publish();
    scheduleSample();
    mobileMedia.addEventListener('change', onChange);
    motionMedia.addEventListener('change', onChange);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      cancelled = true;
      cancelSample();
      mobileMedia.removeEventListener('change', onChange);
      motionMedia.removeEventListener('change', onChange);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  return <PerformanceModeContext.Provider value={mode}>{children}</PerformanceModeContext.Provider>;
};

export const usePerformanceModeContext = () => useContext(PerformanceModeContext) ?? resolveInitialMode();

// Compatibility alias for existing consumers. It reads the root provider and never starts a detector.
export const usePerformanceMode = usePerformanceModeContext;
