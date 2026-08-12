import { adminAuth, db } from './_lib/firebaseAdmin.js';
import { getBearerToken, sendJson } from './_lib/http.js';

const validUsername = (value) => /^[a-zA-Z0-9_]{3,16}$/.test(value);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return sendJson(res, 405, { error: 'METHOD_NOT_ALLOWED', message: 'Method not allowed.' });
  }
  const token = getBearerToken(req);
  if (!token) return sendJson(res, 401, { error: 'UNAUTHENTICATED', message: 'Please sign in again.' });

  try {
    const decoded = await adminAuth.verifyIdToken(token, true);
    const username = typeof req.body?.username === 'string' ? req.body.username.trim() : undefined;
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : undefined;
    if (username === undefined && email === undefined) return sendJson(res, 400, { error: 'NO_CHANGES', message: 'No account changes were provided.' });

    const patch = { updatedAt: Date.now() };
    if (username !== undefined) {
      if (!validUsername(username)) return sendJson(res, 400, { error: 'INVALID_USERNAME', message: 'Username must be 3–16 characters using only letters, numbers, or underscores.' });
      const usernameLower = username.toLowerCase();
      const existing = await db.collection('users').where('usernameLower', '==', usernameLower).limit(2).get();
      if (existing.docs.some((document) => document.id !== decoded.uid)) return sendJson(res, 409, { error: 'USERNAME_TAKEN', message: 'That username is already taken.' });
      Object.assign(patch, { username, usernameLower, displayName: username });
    }
    if (email !== undefined) {
      // A freshly issued ID token proves Firebase Auth accepted this email change.
      if (!decoded.email || decoded.email.toLowerCase() !== email) return sendJson(res, 409, { error: 'EMAIL_NOT_UPDATED', message: 'Please complete the email change and try again.' });
      patch.email = email;
    }
    if (patch.usernameLower) {
      const userRef = db.collection('users').doc(decoded.uid);
      const usernameRef = db.collection('usernames').doc(patch.usernameLower);
      await db.runTransaction(async (transaction) => {
        const [userSnapshot, reservation] = await Promise.all([transaction.get(userRef), transaction.get(usernameRef)]);
        if (reservation.exists && reservation.data()?.uid !== decoded.uid) {
          const conflict = new Error('That username is already taken.');
          conflict.code = 'USERNAME_TAKEN';
          throw conflict;
        }
        const previousUsernameLower = userSnapshot.data()?.usernameLower;
        const previousRef = previousUsernameLower && previousUsernameLower !== patch.usernameLower
          ? db.collection('usernames').doc(previousUsernameLower)
          : null;
        const previousReservation = previousRef ? await transaction.get(previousRef) : null;
        transaction.set(userRef, patch, { merge: true });
        transaction.set(usernameRef, { uid: decoded.uid, createdAt: Date.now() }, { merge: true });
        if (previousRef && previousReservation?.data()?.uid === decoded.uid) transaction.delete(previousRef);
      });
    } else {
      await db.collection('users').doc(decoded.uid).set(patch, { merge: true });
    }
    return sendJson(res, 200, { ok: true, profile: patch });
  } catch (error) {
    console.error('Failed to update account profile', error);
    if (error?.code === 'USERNAME_TAKEN') return sendJson(res, 409, { error: 'USERNAME_TAKEN', message: error.message });
    const unauthenticated = error?.code === 'auth/id-token-revoked' || error?.code === 'auth/argument-error';
    return sendJson(res, unauthenticated ? 401 : 500, { error: unauthenticated ? 'UNAUTHENTICATED' : 'PROFILE_UPDATE_FAILED', message: unauthenticated ? 'Please sign in again.' : 'Could not update your account information.' });
  }
}
