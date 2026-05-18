import { useMemo, useSyncExternalStore } from 'react';
import { activityStore } from './activityStore';
import { ActivityEntry } from './types';

export const useActivity = () => {
  const entries = useSyncExternalStore(activityStore.subscribe, activityStore.getSnapshot, activityStore.getSnapshot);
  const unreadCount = useMemo(() => entries.reduce((count, entry) => count + (entry.read ? 0 : 1), 0), [entries]);

  const addActivity = (entry: Omit<ActivityEntry, 'id' | 'timestamp' | 'read'> & Partial<Pick<ActivityEntry, 'id' | 'timestamp'>>) =>
    activityStore.add(entry);

  return {
    entries,
    unreadCount,
    addActivity,
    markAllRead: activityStore.markAllRead
  };
};

export const useUnreadActivityCount = () =>
  useSyncExternalStore(activityStore.subscribe, activityStore.getUnreadSnapshot, activityStore.getUnreadSnapshot);
