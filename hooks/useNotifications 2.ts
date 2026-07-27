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

const NOTIFICATION_LIST_LIMIT = 25;
const MARK_ALL_LIMIT = 50;

const toNotification = (id: string, data: DocumentData): UserNotification => ({
  id,
  type: typeof data.type === 'string' ? data.type : 'general',
  title: typeof data.title === 'string' ? data.title : 'Notification',
  body: typeof data.body === 'string' ? data.body : '',
  createdAt:
    data.createdAt instanceof Timestamp
      ? data.createdAt
      : typeof data.createdAt === 'number'
        ? Timestamp.fromMillis(data.createdAt)
        : null,
  link: typeof data.link === 'string' ? data.link : undefined,
  readAt: data.readAt instanceof Timestamp ? data.readAt : null,
  seenAt: data.seenAt instanceof Timestamp ? data.seenAt : null
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
    const listQuery = query(notificationsRef, orderBy('createdAt', 'desc'), limit(NOTIFICATION_LIST_LIMIT));

    const listPathLabel = `users/${uid}/notifications`;
    console.log('READING FIRESTORE PATH', listPathLabel);
    const unsubscribe = onSnapshot(listQuery, (snapshot) => {
      console.log('SNAPSHOT OK', {
        path: listPathLabel,
        size: 'size' in snapshot ? snapshot.size : undefined
      });
      const next = snapshot.docs
        .map((docSnap) => toNotification(docSnap.id, docSnap.data()))
        .sort((a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0));
      setNotifications(next);
      setUnreadCount(next.filter((entry) => !entry.readAt).length);
    }, (error) => {
      console.error('SNAPSHOT FAILED', {
        path: listPathLabel,
        code: error?.code,
        message: error?.message,
        error
      });
    });

    return () => {
      unsubscribe();
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
