import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Timestamp,
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
  type DocumentData
} from 'firebase/firestore';
import { db } from '../firebase';

export interface UserNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  createdAt: Timestamp | null;
  link?: string;
  readAt: Timestamp | null;
  seenAt?: Timestamp | null;
}

const UNREAD_COUNT_LIMIT = 100;
const MARK_ALL_LIMIT = 50;

const toTimestamp = (value: unknown): Timestamp | null => {
  if (value instanceof Timestamp) return value;
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Timestamp.fromMillis(value);
  }
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) {
      return Timestamp.fromMillis(parsed);
    }
  }
  if (typeof value === 'object' && value !== null) {
    const timestampLike = value as { seconds?: unknown; nanoseconds?: unknown };
    if (typeof timestampLike.seconds === 'number') {
      const seconds = timestampLike.seconds;
      const nanoseconds = typeof timestampLike.nanoseconds === 'number' ? timestampLike.nanoseconds : 0;
      return new Timestamp(seconds, nanoseconds);
    }
  }
  return null;
};

const toNotification = (id: string, data: DocumentData): UserNotification => ({
  id,
  type: typeof data.type === 'string' ? data.type : 'general',
  title:
    typeof data.title === 'string'
      ? data.title
      : typeof data.message === 'string'
        ? 'Shipping update'
        : 'Notification',
  body: typeof data.body === 'string' ? data.body : typeof data.message === 'string' ? data.message : '',
  createdAt: toTimestamp(data.createdAt) ?? toTimestamp(data.updatedAt),
  link: typeof data.link === 'string' ? data.link : undefined,
  readAt: toTimestamp(data.readAt),
  seenAt: toTimestamp(data.seenAt)
});

export const useNotifications = (uid?: string | null) => {
  const [notifications, setNotifications] = useState<UserNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isMarkingAllRead, setIsMarkingAllRead] = useState(false);

  useEffect(() => {
    if (!uid) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    const notificationsRef = collection(db, 'users', uid, 'notifications');
    const listQuery = query(notificationsRef);
    const unreadQuery = query(notificationsRef, where('readAt', '==', null), limit(UNREAD_COUNT_LIMIT));

    const unsubList = onSnapshot(listQuery, (snapshot) => {
      const next = snapshot.docs
        .map((docSnap) => toNotification(docSnap.id, docSnap.data()))
        .sort((a, b) => {
          const aCreated = a.createdAt?.toMillis() ?? 0;
          const bCreated = b.createdAt?.toMillis() ?? 0;
          if (aCreated !== bCreated) return bCreated - aCreated;
          return b.id.localeCompare(a.id);
        });
      setNotifications(next);
    });

    const unsubUnread = onSnapshot(unreadQuery, (snapshot) => {
      setUnreadCount(snapshot.size);
    });

    return () => {
      unsubList();
      unsubUnread();
    };
  }, [uid]);

  const markRead = useCallback(
    async (notificationId: string) => {
      if (!uid) return;
      const notificationRef = doc(db, 'users', uid, 'notifications', notificationId);
      await updateDoc(notificationRef, {
        readAt: serverTimestamp(),
        seenAt: serverTimestamp()
      });
    },
    [uid]
  );

  const markVisibleAsSeen = useCallback(async () => {
    if (!uid || notifications.length === 0) return;

    const batch = writeBatch(db);
    let hasWrite = false;

    notifications.forEach((notification) => {
      if (!notification.readAt && !notification.seenAt) {
        hasWrite = true;
        const notificationRef = doc(db, 'users', uid, 'notifications', notification.id);
        batch.update(notificationRef, { seenAt: serverTimestamp() });
      }
    });

    if (hasWrite) {
      await batch.commit();
    }
  }, [notifications, uid]);

  const markAllRead = useCallback(async () => {
    if (!uid || isMarkingAllRead) return;

    setIsMarkingAllRead(true);
    try {
      const notificationsRef = collection(db, 'users', uid, 'notifications');
      const unreadDocs = await getDocs(
        query(notificationsRef, where('readAt', '==', null), orderBy('createdAt', 'desc'), limit(MARK_ALL_LIMIT))
      );

      if (unreadDocs.empty) return;

      const batch = writeBatch(db);
      unreadDocs.docs.forEach((docSnap) => {
        batch.update(docSnap.ref, {
          readAt: serverTimestamp(),
          seenAt: serverTimestamp()
        });
      });
      await batch.commit();
    } finally {
      setIsMarkingAllRead(false);
    }
  }, [isMarkingAllRead, uid]);

  const dismissNotification = useCallback(
    async (notificationId: string) => {
      if (!uid) return;
      const notificationRef = doc(db, 'users', uid, 'notifications', notificationId);
      await deleteDoc(notificationRef);
    },
    [uid]
  );

  return useMemo(
    () => ({
      notifications,
      unreadCount,
      isMarkingAllRead,
      markRead,
      markAllRead,
      markVisibleAsSeen,
      dismissNotification
    }),
    [dismissNotification, isMarkingAllRead, markAllRead, markRead, markVisibleAsSeen, notifications, unreadCount]
  );
};
