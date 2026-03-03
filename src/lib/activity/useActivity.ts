import { useSyncExternalStore } from 'react';
import { activityStore } from './activityStore';
import { ActivityEntry } from './types';

export const useActivity = () => {
  const entries = useSyncExternalStore(activityStore.subscribe, activityStore.getSnapshot, activityStore.getSnapshot);
  const unreadCount = entries.filter((entry) => !entry.read).length;

  const addActivity = (entry: Omit<ActivityEntry, 'id' | 'timestamp' | 'read'> & Partial<Pick<ActivityEntry, 'id' | 'timestamp'>>) =>
    activityStore.add(entry);

  return {
    entries,
    unreadCount,
    addActivity,
    markAllRead: activityStore.markAllRead
  };
};
