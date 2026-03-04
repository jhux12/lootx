import { ActivityEntry } from './types';

const STORAGE_KEY_PREFIX = 'pullz:activity:v2:';
const MAX_ITEMS = 100;

let scopeKey = 'guest';
let entries: ActivityEntry[] = [];
const listeners = new Set<() => void>();

const emit = () => listeners.forEach((listener) => listener());

const makeStorageKey = (scope: string) => `${STORAGE_KEY_PREFIX}${scope}`;

const persist = () => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(makeStorageKey(scopeKey), JSON.stringify(entries.slice(0, MAX_ITEMS)));
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
    return next;
  },
  markAllRead() {
    entries = entries.map((entry) => ({ ...entry, read: true }));
    persist();
    emit();
  }
};
