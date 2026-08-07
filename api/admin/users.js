import { adminAuth, db } from '../_lib/firebaseAdmin.js';
import { deny, ok, requireAdmin } from '../_utils/auth.js';

const listAllAuthUsers = async (nextPageToken, acc = []) => {
  const result = await adminAuth.listUsers(1000, nextPageToken);
  const merged = acc.concat(result.users);
  if (result.pageToken) {
    return listAllAuthUsers(result.pageToken, merged);
  }
  return merged;
};

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'PATCH') {
    return deny(res, 405, 'METHOD_NOT_ALLOWED');
  }

  try {
    await requireAdmin(req);

    if (req.method === 'PATCH') {
      const { userId, status } = req.body ?? {};
      if (typeof userId !== 'string' || !['active', 'suspended', 'banned'].includes(status)) {
        return deny(res, 400, 'INVALID_USER_STATUS');
      }
      // Account restrictions live in Firestore so Firebase Auth must remain
      // enabled: banned users still need to sign in to see the restriction and
      // reach customer support.
      await Promise.all([
        adminAuth.updateUser(userId, { disabled: false }),
        db.collection('users').doc(userId).set({ status, updatedAt: new Date() }, { merge: true })
      ]);
      return ok(res, { userId, status, disabled: false });
    }

    const [authUsers, firestoreSnapshot] = await Promise.all([
      listAllAuthUsers(),
      db.collection('users').get()
    ]);

    const firestoreUsersById = new Map();
    firestoreSnapshot.forEach((docSnap) => {
      firestoreUsersById.set(docSnap.id, docSnap.data());
    });

    const users = authUsers.map((entry) => {
      const primaryProvider = Array.isArray(entry.providerData) && entry.providerData.length > 0
        ? entry.providerData[0]?.providerId
        : undefined;

      return {
        id: entry.uid,
        email: entry.email ?? '',
        displayName: entry.displayName ?? '',
        photoURL: entry.photoURL ?? '',
        provider: primaryProvider ?? undefined,
        phoneNumber: entry.phoneNumber ?? '',
        phoneVerified: Boolean(entry.phoneNumber),
        disabled: entry.disabled === true,
        createdAt: entry.metadata?.creationTime ? Date.parse(entry.metadata.creationTime) : undefined,
        firestoreData: firestoreUsersById.get(entry.uid) ?? {}
      };
    });

    firestoreUsersById.forEach((data, id) => {
      if (users.some((entry) => entry.id === id)) return;
      users.push({
        id,
        email: data.email ?? '',
        displayName: data.displayName ?? data.name ?? '',
        photoURL: data.photoURL ?? data.avatar ?? '',
        provider: data.provider ?? undefined,
        phoneNumber: '',
        phoneVerified: false,
        disabled: false,
        createdAt: typeof data.createdAt === 'number' ? data.createdAt : undefined,
        firestoreData: data
      });
    });

    return ok(res, { users });
  } catch (error) {
    const status = error?.status ?? 500;
    const message = error?.error ?? error?.message ?? 'FAILED_TO_LOAD_ADMIN_USERS';
    return deny(res, status, message);
  }
}
