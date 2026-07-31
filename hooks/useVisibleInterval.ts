import { useEffect, useRef } from 'react';

/**
 * Like setInterval, but pauses while the tab is hidden and fires immediately
 * (instead of waiting a full period) the moment the tab becomes visible again.
 * Keeps 1s-tick UI clocks from running forever in backgrounded tabs.
 */
export const useVisibleInterval = (callback: () => void, delayMs: number, enabled = true) => {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    if (!enabled || typeof document === 'undefined') return;
    let intervalId: number | null = null;

    const stop = () => {
      if (intervalId !== null) {
        window.clearInterval(intervalId);
        intervalId = null;
      }
    };
    const start = () => {
      if (intervalId !== null) return;
      callbackRef.current();
      intervalId = window.setInterval(() => callbackRef.current(), delayMs);
    };
    const onVisibility = () => {
      if (document.hidden) stop();
      else start();
    };

    if (!document.hidden) start();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [delayMs, enabled]);
};
