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

/**
 * Live, site-wide feed of the most recently opened box prizes, sourced from
 * the top-level `opens` collection that api/open-case.js writes to on every
 * unboxing. This is real activity across all players (not just the signed-in
 * user), and works whether or not the visitor is signed in.
 */
export const useRecentPulls = (pullLimit = 30) => {
  const [pulls, setPulls] = useState<RecentPull[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const opensQuery = query(collection(db, 'opens'), orderBy('createdAt', 'desc'), limit(pullLimit));

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
              boxName: data.boxName ?? 'Mystery Box',
              obtainedAt: toMillis(data.createdAt),
            };
          })
          .filter((entry): entry is RecentPull => Boolean(entry));

        setPulls(next);
        setIsLoading(false);
      },
      (error) => {
        console.error('Failed to subscribe to recent pulls', error);
        setPulls([]);
        setIsLoading(false);
      },
    );

    return () => unsubscribe();
  }, [pullLimit]);

  return { pulls, isLoading };
};
