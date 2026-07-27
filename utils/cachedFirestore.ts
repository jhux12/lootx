import { DocumentData, DocumentReference, DocumentSnapshot, getDoc } from 'firebase/firestore';

const values = new Map<string, { expiresAt: number; snapshot: DocumentSnapshot<DocumentData> }>();
const pending = new Map<string, Promise<DocumentSnapshot<DocumentData>>>();

/** Deduplicated, short-lived reads for global configuration that does not require realtime updates. */
export const getCachedDocument = (key: string, reference: DocumentReference<DocumentData>, ttlMs = 5 * 60_000) => {
  const cached = values.get(key);
  if (cached && cached.expiresAt > Date.now()) return Promise.resolve(cached.snapshot);
  const inFlight = pending.get(key);
  if (inFlight) return inFlight;
  const request = getDoc(reference).then((snapshot) => {
    values.set(key, { expiresAt: Date.now() + ttlMs, snapshot });
    return snapshot;
  }).finally(() => pending.delete(key));
  pending.set(key, request);
  return request;
};
