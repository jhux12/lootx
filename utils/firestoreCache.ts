import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';

type CacheEntry = { value: Record<string, unknown>; expiresAt: number };
const values = new Map<string, CacheEntry>();
const requests = new Map<string, Promise<Record<string, unknown>>>();

/** Deduplicated one-time settings read. Rejections are not retained. */
export const getCachedDocument = (path: string, ttlMs = 5 * 60_000) => {
  const hit = values.get(path);
  if (hit && hit.expiresAt > Date.now()) return Promise.resolve(hit.value);
  const pending = requests.get(path);
  if (pending) return pending;
  const [collectionName, documentId] = path.split('/');
  if (!collectionName || !documentId) return Promise.reject(new Error(`Invalid Firestore document path: ${path}`));
  const request = getDoc(doc(db, collectionName, documentId)).then((snapshot) => {
    const value = (snapshot.data() ?? {}) as Record<string, unknown>;
    values.set(path, { value, expiresAt: Date.now() + ttlMs });
    return value;
  }).finally(() => requests.delete(path));
  requests.set(path, request);
  return request;
};
