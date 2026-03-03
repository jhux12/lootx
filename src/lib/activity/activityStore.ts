import { ActivityEntry } from './types';

const STORAGE_KEY = 'pullz:activity:v1';
const MAX_ITEMS = 100;

let entries: ActivityEntry[] = [];
const listeners = new Set<() => void>();

const emit = () => listeners.forEach((listener) => listener());

const persist = () => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, MAX_ITEMS)));
};

const hydrate = () => {
  if (typeof window === 'undefined') return;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return;
    entries = parsed
      .filter((entry) => entry && typeof entry === 'object')
      .slice(0, MAX_ITEMS);
  } catch {
    entries = [];
  }
};

hydrate();

export const activityStore = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getSnapshot() {
    return entries;
  },
  add(entry: Omit<ActivityEntry, 'id' | 'timestamp' | 'read'> & Partial<Pick<ActivityEntry, 'id' | 'timestamp'>>) {
    const next: ActivityEntry = {
      ...entry,
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
