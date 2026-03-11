import { ActivityEntry } from './types';
import { collection, doc, getDocs, limit, orderBy, query, setDoc, writeBatch } from 'firebase/firestore';
import { db } from '../../../firebase';

const STORAGE_KEY_PREFIX = 'pullz:activity:v2:';
const MAX_ITEMS = 100;

let scopeKey = 'guest';
let entries: ActivityEntry[] = [];
const listeners = new Set<() => void>();
let scopeSyncNonce = 0;

const emit = () => listeners.forEach((listener) => listener());

const makeStorageKey = (scope: string) => `${STORAGE_KEY_PREFIX}${scope}`;

const persist = () => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(makeStorageKey(scopeKey), JSON.stringify(entries.slice(0, MAX_ITEMS)));
};

const isAccountScope = (scope: string) => scope !== 'guest';

const normalizeEntries = (nextEntries: ActivityEntry[]) => nextEntries
  .filter((entry) => entry && typeof entry === 'object')
  .sort((a, b) => Number(b.timestamp ?? 0) - Number(a.timestamp ?? 0))
  .slice(0, MAX_ITEMS);

const mergeEntries = (primary: ActivityEntry[], secondary: ActivityEntry[]) => {
  const byId = new Map<string, ActivityEntry>();
  [...secondary, ...primary].forEach((entry) => {
    if (!entry?.id) return;
    byId.set(entry.id, entry);
  });
  return normalizeEntries(Array.from(byId.values()));
};

const persistToAccount = async (scope: string, nextEntry: ActivityEntry) => {
  if (!isAccountScope(scope)) return;
  try {
    await setDoc(doc(db, 'users', scope, 'activity', nextEntry.id), nextEntry, { merge: true });
  } catch {
    // Keep local cache as fallback; remote sync can recover on next write.
  }
};

const syncScopeFromAccount = async (scope: string, nonce: number) => {
  if (!isAccountScope(scope)) return;
  try {
    const activityQuery = query(collection(db, 'users', scope, 'activity'), orderBy('timestamp', 'desc'), limit(MAX_ITEMS));
    const snapshot = await getDocs(activityQuery);
    if (nonce !== scopeSyncNonce || scope !== scopeKey) return;

    const remoteEntries = normalizeEntries(snapshot.docs.map((docSnap) => {
      const data = docSnap.data() as Partial<ActivityEntry>;
      return {
        id: docSnap.id,
        userId: scope,
        type: data.type ?? 'open',
        title: String(data.title ?? 'Activity'),
        value: typeof data.value === 'number' ? data.value : undefined,
        meta: data.meta,
        timestamp: Number(data.timestamp ?? Date.now()),
        provablyFairData: data.provablyFairData,
        read: Boolean(data.read)
      } as ActivityEntry;
    }));

    const merged = mergeEntries(remoteEntries, entries);
    entries = merged;
    persist();
    emit();

    const localOnly = merged.filter((entry) => !remoteEntries.some((remoteEntry) => remoteEntry.id === entry.id));
    if (localOnly.length) {
      const batch = writeBatch(db);
      localOnly.forEach((entry) => {
        batch.set(doc(db, 'users', scope, 'activity', entry.id), entry, { merge: true });
      });
      await batch.commit();
    }
  } catch {
    // Keep local data if remote account sync is unavailable.
  }
};

const hydrate = (scope: string) => {
  if (typeof window === 'undefined') return;
  try {
    const raw = window.localStorage.getItem(makeStorageKey(scope));
    if (!raw) {
      entries = [];
      return;
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      entries = [];
      return;
    }
    entries = parsed
      .filter((entry) => entry && typeof entry === 'object')
      .slice(0, MAX_ITEMS);
  } catch {
    entries = [];
  }
};

hydrate(scopeKey);

export const activityStore = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getSnapshot() {
    return entries;
  },
  setScope(nextScopeKey: string) {
    const normalized = nextScopeKey.trim() || 'guest';
    if (normalized === scopeKey) return;
    scopeKey = normalized;
    hydrate(scopeKey);
    emit();
    scopeSyncNonce += 1;
    void syncScopeFromAccount(scopeKey, scopeSyncNonce);
  },
  add(entry: Omit<ActivityEntry, 'id' | 'timestamp' | 'read'> & Partial<Pick<ActivityEntry, 'id' | 'timestamp'>>) {
    const next: ActivityEntry = {
      ...entry,
      userId: entry.userId ?? (scopeKey === 'guest' ? undefined : scopeKey),
      id: entry.id ?? (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`),
      timestamp: entry.timestamp ?? Date.now(),
      read: false
    };
    entries = [next, ...entries].slice(0, MAX_ITEMS);
    persist();
    emit();
    void persistToAccount(scopeKey, next);
    return next;
  },
  markAllRead() {
    entries = entries.map((entry) => ({ ...entry, read: true }));
    persist();
    emit();

    if (!isAccountScope(scopeKey) || !entries.length) return;
    const scopeForWrite = scopeKey;
    const entriesToWrite = entries;
    void (async () => {
      try {
        const batch = writeBatch(db);
        entriesToWrite.forEach((entry) => {
          batch.set(doc(db, 'users', scopeForWrite, 'activity', entry.id), entry, { merge: true });
        });
        await batch.commit();
      } catch {
        // Keep local state as fallback.
      }
    })();
  }
};
