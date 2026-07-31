import React, { createContext, useContext, useEffect, useState } from 'react';

export type PerformanceMode = {
  isMobile: boolean;
  prefersReducedMotion: boolean;
  isLowPower: boolean;
  isHidden: boolean;
};

const MOBILE_QUERY = '(max-width: 768px), (pointer: coarse)';
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

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

/** One application-wide capability check without running an active FPS benchmark. */
export const PerformanceModeProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [mode, setMode] = useState<PerformanceMode>(resolveInitialMode);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    const mobileMedia = window.matchMedia(MOBILE_QUERY);
    const motionMedia = window.matchMedia(REDUCED_MOTION_QUERY);
    const publish = () => {
      const initial = resolveInitialMode();
      const next = {
        ...initial,
        isMobile: mobileMedia.matches,
        prefersReducedMotion: motionMedia.matches,
        isHidden: document.visibilityState === 'hidden'
      };
      applyPerformanceClasses(next);
      setMode(next);
    };
    const onChange = () => publish();
    const onVisibility = () => {
      publish();
    };

    publish();
    mobileMedia.addEventListener('change', onChange);
    motionMedia.addEventListener('change', onChange);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
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
