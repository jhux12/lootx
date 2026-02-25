import { collection, doc, getDoc, getDocs, orderBy, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { authedFetch } from '../utils/authedFetch';
import { normalizePlinkoBoard, normalizePlinkoSettings, PlinkoBoard } from '../utils/plinko';

export const getPlinkoSettings = async () => {
  const snapshot = await getDoc(doc(db, 'settings', 'plinkoPublic'));
  return normalizePlinkoSettings(snapshot.exists() ? snapshot.data() : undefined);
};

export const getPlinkoBoard = async (boardId: string): Promise<PlinkoBoard> => {
  const snapshot = await getDoc(doc(db, 'plinkoBoards', boardId));
  return normalizePlinkoBoard(boardId, snapshot.exists() ? snapshot.data() : undefined);
};

export const listPlinkoBoards = async (): Promise<PlinkoBoard[]> => {
  const snapshot = await getDocs(collection(db, 'plinkoBoards'));
  return snapshot.docs.map((boardDoc) => normalizePlinkoBoard(boardDoc.id, boardDoc.data()));
};

export const listPlinkoPoolItems = async (poolId: string) => {
  const poolQuery = query(
    collection(db, 'plinkoPools', poolId, 'items'),
    where('enabled', '==', true),
    orderBy('coinValue', 'asc')
  );
  const snapshot = await getDocs(poolQuery);
  return snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
};

export const attemptPlinko = async (payload: { bet: number; clientSeed?: string }) => {
  const response = await authedFetch('/api/attempt-plinko', {
    method: 'POST',
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data?.message || 'Plinko attempt failed.');
  }

  return response.json();
};
