import { collection, getDocs, limit, orderBy, query, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import type { CaseItem } from '../types';

export type HomepageWin = { id: string; itemName: string; itemImage: string; boxId: string; boxName: string; rarity: CaseItem['rarity']; timestamp: Date | null };
let cached: HomepageWin[] | null = null;
let inFlight: Promise<HomepageWin[]> | null = null;

/** One bounded, session-cached query containing public display fields only. */
export const getHomepageWins = (): Promise<HomepageWin[]> => {
  if (cached) return Promise.resolve(cached);
  if (inFlight) return inFlight;
  inFlight = getDocs(query(collection(db, 'homepageWins'), orderBy('timestamp', 'desc'), limit(10))).then((snapshot) => snapshot.docs.map((entry) => {
    const data = entry.data(); const rarity = String(data.rarity ?? 'common');
    return { id: entry.id, itemName: String(data.itemName ?? 'Mystery Item'), itemImage: typeof data.itemImage === 'string' ? data.itemImage : '', boxId: String(data.boxId ?? ''), boxName: String(data.boxName ?? 'Mystery Box'), rarity: ['common', 'uncommon', 'rare', 'epic', 'legendary'].includes(rarity) ? rarity as CaseItem['rarity'] : 'common', timestamp: data.timestamp instanceof Timestamp ? data.timestamp.toDate() : null };
  })).then((wins) => { cached = wins; return wins; }).finally(() => { inFlight = null; });
  return inFlight;
};
