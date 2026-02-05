import { useCallback, useRef, useState } from 'react';

type SingleFlightRunner = <T>(key: string, task: () => Promise<T>) => Promise<T | undefined>;

export const useSingleFlight = () => {
  const inFlightRef = useRef<Set<string>>(new Set());
  const [, setInFlightSnapshot] = useState<Set<string>>(new Set());

  const syncSnapshot = () => {
    setInFlightSnapshot(new Set(inFlightRef.current));
  };

  const runWithKey: SingleFlightRunner = useCallback(async (key, task) => {
    if (!key) {
      return task();
    }

    if (inFlightRef.current.has(key)) {
      return undefined;
    }

    inFlightRef.current.add(key);
    syncSnapshot();

    try {
      return await task();
    } finally {
      inFlightRef.current.delete(key);
      syncSnapshot();
    }
  }, []);

  const isInFlight = useCallback((key: string) => {
    if (!key) return false;
    return inFlightRef.current.has(key);
  }, []);

  return { runWithKey, isInFlight };
};
