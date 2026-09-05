import { useEffect, useState } from 'react';
import { Timestamp, collection, limit, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '../../../firebase';
import type { CaseItem } from '../../../types';

export type RecentPull = {
  id: string;
  itemName: string;
  itemImage: string;
  rarity: CaseItem['rarity'];
  value: number;
  boxName: string;
  obtainedAt: number;
};

type OpenDoc = {
  boxName?: string;
  prize?: {
    name?: string;
    image?: string;
    rarity?: CaseItem['rarity'];
    value?: number;
  };
  createdAt?: Timestamp;
};

const toMillis = (value: Timestamp | undefined) =>
  value && typeof value.toMillis === 'function' ? value.toMillis() : 0;

const RECENT_PULLS_CACHE_KEY = 'ripza:recent-pulls:v1';
const RECENT_PULLS_CACHE_MAX_AGE_MS = 30 * 60 * 1000;

const readCachedPulls = (pullLimit: number): RecentPull[] => {
  if (typeof window === 'undefined') return [];
  try {
    const cached = JSON.parse(window.sessionStorage.getItem(RECENT_PULLS_CACHE_KEY) ?? 'null') as { savedAt?: number; pulls?: RecentPull[] } | null;
    if (!cached?.savedAt || Date.now() - cached.savedAt > RECENT_PULLS_CACHE_MAX_AGE_MS || !Array.isArray(cached.pulls)) return [];
    return cached.pulls.slice(0, pullLimit);
  } catch {
    return [];
  }
};

const cachePulls = (pulls: RecentPull[]) => {
  if (typeof window === 'undefined' || pulls.length === 0) return;
  try {
    window.sessionStorage.setItem(RECENT_PULLS_CACHE_KEY, JSON.stringify({ savedAt: Date.now(), pulls }));
  } catch {
    // sessionStorage can be disabled; the Firestore listener remains sufficient.
  }
};

/**
 * Live, site-wide feed of the most recently opened box prizes, sourced from
 * the top-level `opens` collection that api/open-case.js writes to on every
 * unboxing. This is real activity across all players (not just the signed-in
 * user), and works whether or not the visitor is signed in.
 *
 * Mobile connections drop and reconnect more often than desktop, and a
 * reconnect can briefly hand back an empty or from-cache snapshot before the
 * real one arrives. To avoid the ticker flickering to "no pulls" every time
 * that happens, we only ever replace known-good data with a non-empty
 * snapshot, and never clear it out on a transient listener error.
 */
export const useRecentPulls = (pullLimit = 30) => {
  const [pulls, setPulls] = useState<RecentPull[]>(() => readCachedPulls(pullLimit));
  const [isLoading, setIsLoading] = useState(() => readCachedPulls(pullLimit).length === 0);

  useEffect(() => {
    // Read a wider real-activity window before applying the value threshold so
    // a run of inexpensive pulls does not make the ticker appear fabricated or empty.
    // Cap the live listener at 100 documents. The old 10x multiplier downloaded
    // 300 documents for the default rail on every cold visit, which was costly
    // and noticeably delayed mobile rendering.
    const opensQuery = query(collection(db, 'opens'), orderBy('createdAt', 'desc'), limit(100));
    const loadingTimeout = window.setTimeout(() => setIsLoading(false), 6_000);

    const unsubscribe = onSnapshot(
      opensQuery,
      (snapshot) => {
        const next = snapshot.docs
          .map((docSnap) => {
            const data = docSnap.data() as OpenDoc;
            const prize = data.prize;
            if (!prize?.name || !prize?.image) return null;

            return {
              id: docSnap.id,
              itemName: prize.name,
              itemImage: prize.image,
              rarity: prize.rarity ?? 'common',
              value: Number(prize.value ?? 0),
              boxName: data.boxName ?? 'Mystery Pack',
              obtainedAt: toMillis(data.createdAt),
            };
          })
          .filter((entry): entry is RecentPull => Boolean(entry) && entry.value >= 500)
          .slice(0, pullLimit);

        // A momentary empty/from-cache snapshot shouldn't wipe out pulls we
        // already loaded successfully — only accept it if we have nothing
        // yet, or it actually has data.
        if (next.length > 0) cachePulls(next);
        setPulls((previous) => (next.length > 0 || previous.length === 0 ? next : previous));
        setIsLoading(false);
        window.clearTimeout(loadingTimeout);
      },
      (error) => {
        console.error('Failed to subscribe to recent pulls', error);
        // Keep whatever we already have rather than clearing it on a
        // transient network error — the listener will keep retrying.
        setIsLoading(false);
        window.clearTimeout(loadingTimeout);
      },
    );

    return () => {
      window.clearTimeout(loadingTimeout);
      unsubscribe();
    };
  }, [pullLimit]);

  return { pulls, isLoading };
};
