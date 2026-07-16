import { useRef } from 'react';
import { MysteryBox } from '../../../types';
import { prefetchBox } from './prefetchBox';

export const useIntentPrefetch = (
  boxId: string,
  fetcher: () => Promise<MysteryBox | null>,
  heroImageUrl?: string
) => {
  const touchedRef = useRef(false);

  const runPrefetch = () => {
    void prefetchBox(boxId, fetcher, heroImageUrl);
  };

  return {
    onMouseEnter: runPrefetch,
    onFocus: runPrefetch,
    onTouchStart: () => {
      if (touchedRef.current) return;
      touchedRef.current = true;
      runPrefetch();
    }
  };
};
