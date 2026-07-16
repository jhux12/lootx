import { useEffect, useState } from 'react';

export type PerformanceMode = {
  isMobile: boolean;
  prefersReducedMotion: boolean;
  isLowPower: boolean;
  isHidden: boolean;
};

const MOBILE_QUERY = '(max-width: 768px), (pointer: coarse)';
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';
const STARTUP_GRACE_MS = 5_000;
const SAMPLE_WINDOW_MS = 1_500;
const ENTER_FPS = 44;
const EXIT_FPS = 54;
const SLOW_WINDOWS_TO_ENTER = 3;
const HEALTHY_WINDOWS_TO_EXIT = 4;
const NORMAL_SAMPLE_INTERVAL_MS = 4_500;
const CONFIRMING_SAMPLE_INTERVAL_MS = 900;

const resolveInitialMode = (): PerformanceMode => {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return { isMobile: false, prefersReducedMotion: false, isLowPower: false, isHidden: false };
  }

  return {
    isMobile: window.matchMedia(MOBILE_QUERY).matches,
    prefersReducedMotion: window.matchMedia(REDUCED_MOTION_QUERY).matches,
    isLowPower: window.matchMedia(REDUCED_MOTION_QUERY).matches,
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
    let timeoutId: number | null = null;
    let stopped = false;
    let slowWindows = 0;
    let healthyWindows = 0;
    let lowPower = motionMedia.matches;
    let graceUntil = performance.now() + STARTUP_GRACE_MS;

    const publish = () => {
      const next: PerformanceMode = {
        isMobile: mobileMedia.matches,
        prefersReducedMotion: motionMedia.matches,
        isLowPower: motionMedia.matches || lowPower,
        isHidden: document.visibilityState === 'hidden'
      };
      applyPerformanceClasses(next);
      setMode(next);
    };

    const clearScheduled = () => {
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
        rafId = null;
      }
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
        timeoutId = null;
      }
    };

    const scheduleSample = (delay = 250) => {
      clearScheduled();
      if (stopped || document.visibilityState === 'hidden' || motionMedia.matches) return;
      timeoutId = window.setTimeout(sampleWindow, delay);
    };

    const recordWindow = (fps: number) => {
      if (performance.now() < graceUntil) {
        slowWindows = 0;
        healthyWindows = 0;
        return;
      }

      if (!lowPower && fps < ENTER_FPS) {
        slowWindows += 1;
        healthyWindows = 0;
        if (slowWindows >= SLOW_WINDOWS_TO_ENTER) {
          lowPower = true;
          slowWindows = 0;
          publish();
        }
        return;
      }

      if (lowPower && fps > EXIT_FPS) {
        healthyWindows += 1;
        slowWindows = 0;
        if (healthyWindows >= HEALTHY_WINDOWS_TO_EXIT) {
          lowPower = false;
          healthyWindows = 0;
          publish();
        }
        return;
      }

      if (fps >= ENTER_FPS) slowWindows = 0;
      if (fps <= EXIT_FPS) healthyWindows = 0;
    };

    function sampleWindow() {
      if (stopped || document.visibilityState === 'hidden' || motionMedia.matches) return;
      let frames = 0;
      let startedAt = performance.now();

      const tick = (now: number) => {
        if (stopped || document.visibilityState === 'hidden') return;
        frames += 1;
        if (now - startedAt < SAMPLE_WINDOW_MS) {
          rafId = window.requestAnimationFrame(tick);
          return;
        }
        const fps = (frames / Math.max(1, now - startedAt)) * 1000;
        recordWindow(fps);
        const isConfirmingEntry = !lowPower && slowWindows > 0;
        const isConfirmingExit = lowPower && healthyWindows > 0;
        scheduleSample(isConfirmingEntry || isConfirmingExit ? CONFIRMING_SAMPLE_INTERVAL_MS : NORMAL_SAMPLE_INTERVAL_MS);
      };

      rafId = window.requestAnimationFrame((now) => {
        startedAt = now;
        rafId = window.requestAnimationFrame(tick);
      });
    }

    const onChange = () => {
      if (motionMedia.matches) {
        lowPower = true;
      }
      publish();
      scheduleSample();
    };

    const onVisibility = () => {
      publish();
      if (document.visibilityState === 'hidden') {
        clearScheduled();
        return;
      }
      graceUntil = performance.now() + 1_000;
      scheduleSample();
    };

    publish();
    scheduleSample(STARTUP_GRACE_MS);
    mobileMedia.addEventListener('change', onChange);
    motionMedia.addEventListener('change', onChange);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      stopped = true;
      clearScheduled();
      mobileMedia.removeEventListener('change', onChange);
      motionMedia.removeEventListener('change', onChange);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  return mode;
};
