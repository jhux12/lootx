import { addDoc, collection, deleteDoc, deleteField, doc, getDocs, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { DEFAULT_PLINKO_SETTINGS, normalizePlinkoBoard, normalizePlinkoSettings, PlinkoBoard, PlinkoPoolItem, PlinkoSettings } from '../utils/plinko';

export const savePlinkoSettings = async (settings: Partial<PlinkoSettings>) => {
  const merged = { ...DEFAULT_PLINKO_SETTINGS, ...settings, updatedAt: Date.now() };
  await setDoc(doc(db, 'settings', 'plinkoPublic'), {
    ...merged,
    serverSeed: deleteField()
  }, { merge: true });
  await setDoc(doc(db, 'settings', 'plinko'), {
    ...merged,
    serverSeed: deleteField()
  }, { merge: true });
};

export const rotatePlinkoServerSeedHash = async () => {
  const nextSeed = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(nextSeed));
  const hash = Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
  await setDoc(doc(db, 'settings', 'plinkoPublic'), {
    serverSeed: deleteField(),
    serverSeedHash: hash,
    seedRotatedAt: Date.now(),
    updatedAt: Date.now()
  }, { merge: true });
  await setDoc(doc(db, 'settings', 'plinko'), {
    serverSeed: deleteField(),
    serverSeedHash: hash,
    seedRotatedAt: Date.now(),
    updatedAt: Date.now()
  }, { merge: true });
  return hash;
};

export const listPlinkoBoardsAdmin = async (): Promise<PlinkoBoard[]> => {
  const snapshot = await getDocs(collection(db, 'plinkoBoards'));
  return snapshot.docs.map((snap) => normalizePlinkoBoard(snap.id, snap.data()));
};

export const savePlinkoBoard = async (board: Partial<PlinkoBoard> & { id?: string }) => {
  const boardId = board.id?.trim() || board.name?.trim() || 'medium';
  const normalized = normalizePlinkoBoard(boardId, board);
  await setDoc(doc(db, 'plinkoBoards', boardId), {
    name: normalized.name,
    rows: normalized.rows,
    slots: normalized.slots,
    updatedAt: Date.now()
  }, { merge: true });
  return boardId;
};

export const listPlinkoPoolItemsAdmin = async (poolId: string): Promise<PlinkoPoolItem[]> => {
  const snapshot = await getDocs(collection(db, 'plinkoPools', poolId, 'items'));
  return snapshot.docs.map((snap) => ({ id: snap.id, ...snap.data() } as PlinkoPoolItem));
};

export const savePlinkoPoolItem = async (poolId: string, item: Partial<PlinkoPoolItem> & { id?: string }) => {
  const payload = {
    enabled: item.enabled !== false,
    weight: Math.max(1, Number(item.weight ?? 1)),
    name: String(item.name ?? 'Unknown Item'),
    imageUrl: String(item.imageUrl ?? ''),
    coinValue: Math.max(0, Number(item.coinValue ?? 0)),
    rarity: String(item.rarity ?? 'common'),
    category: String(item.category ?? ''),
    updatedAt: Date.now()
  };

  if (item.id) {
    await setDoc(doc(db, 'plinkoPools', poolId, 'items', item.id), payload, { merge: true });
    return item.id;
  }

  const created = await addDoc(collection(db, 'plinkoPools', poolId, 'items'), payload);
  return created.id;
};

export const deletePlinkoPoolItem = async (poolId: string, itemId: string) => {
  await deleteDoc(doc(db, 'plinkoPools', poolId, 'items', itemId));
};

export { normalizePlinkoSettings };
