import { adminAuth, db } from './_lib/firebaseAdmin.js';
import { getBearerToken, sendJson } from './_lib/http.js';

const USER_PROFILE_SAFE_KEYS = [
  'uid',
  'email',
  'username',
  'usernameLower',
  'createdAt',
  'updatedAt',
  'photoURL',
  'displayName',
  'lastLogin',
  'shippingAddress',
  'topPullsPublic'
];

const normalizeUsername = (value = '') =>
  String(value)
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .replace(/^_+|_+$/g, '');

const clampFirestoreUsernameLower = (value) => normalizeUsername(value).slice(0, 16);
const isValidFirestoreUsernameLower = (value) => /^[a-z0-9_]{3,16}$/.test(value);
const toFirestoreUsernameLower = (value, fallback = 'player') => {
  const normalized = clampFirestoreUsernameLower(value);
  if (isValidFirestoreUsernameLower(normalized)) return normalized;

  const normalizedFallback = clampFirestoreUsernameLower(fallback);
  return isValidFirestoreUsernameLower(normalizedFallback) ? normalizedFallback : 'player';
};

const buildBaseUsername = (displayName, email) => {
  const fromDisplayName = normalizeUsername(displayName ?? '');
  if (fromDisplayName) return fromDisplayName;
  const emailPrefix = String(email ?? '').split('@')[0] ?? '';
  const fromEmail = normalizeUsername(emailPrefix);
  return fromEmail || 'player';
};

const filterSafeUserProfileFields = (payload) => Object.fromEntries(
  Object.entries(payload).filter(([key, value]) => USER_PROFILE_SAFE_KEYS.includes(key) && value !== undefined)
);

const buildLegacyUserProfileBackfill = (userRecord, data = {}) => {
  const metadataCreatedAt = userRecord.metadata.creationTime ? Date.parse(userRecord.metadata.creationTime) : NaN;
  const fallbackCreatedAt = Number.isFinite(metadataCreatedAt) ? metadataCreatedAt : Date.now();
  const username =
    typeof data.username === 'string' && data.username.trim()
      ? data.username.trim()
      : buildBaseUsername(data.displayName, data.email ?? userRecord.email);
  const existingUsernameLower = typeof data.usernameLower === 'string' ? data.usernameLower.trim() : '';
  const usernameLower = isValidFirestoreUsernameLower(existingUsernameLower)
    ? existingUsernameLower
    : toFirestoreUsernameLower(existingUsernameLower || username);

  const patch = {};

  if (data.uid !== userRecord.uid) patch.uid = userRecord.uid;
  if (typeof data.email !== 'string' && userRecord.email) patch.email = userRecord.email;
  if (!(typeof data.username === 'string' && data.username.trim())) patch.username = username;
  if (!isValidFirestoreUsernameLower(existingUsernameLower)) patch.usernameLower = usernameLower;
  if (data.createdAt === undefined) patch.createdAt = fallbackCreatedAt;
  if (data.updatedAt === undefined) patch.updatedAt = Date.now();
  if (data.lastLogin === undefined) patch.lastLogin = Date.now();
  if (data.photoURL === undefined && userRecord.photoURL) patch.photoURL = userRecord.photoURL;
  if (data.displayName === undefined && (userRecord.displayName || typeof data.username === 'string')) {
    patch.displayName = userRecord.displayName || (typeof data.username === 'string' ? data.username : username);
  }

  return filterSafeUserProfileFields(patch);
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return sendJson(res, 405, { error: 'METHOD_NOT_ALLOWED', message: 'Method not allowed.' });
  }

  const token = getBearerToken(req);
  if (!token) {
    return sendJson(res, 401, { error: 'UNAUTHENTICATED', message: 'Authentication is required.' });
  }

  let decoded;
  try {
    decoded = await adminAuth.verifyIdToken(token);
  } catch {
    return sendJson(res, 401, { error: 'UNAUTHENTICATED', message: 'Authentication is required.' });
  }

  try {
    const userRef = db.collection('users').doc(decoded.uid);
    const [userSnapshot, userRecord] = await Promise.all([userRef.get(), adminAuth.getUser(decoded.uid)]);

    if (!userSnapshot.exists) {
      return sendJson(res, 200, { ok: true, patched: false });
    }

    const patch = buildLegacyUserProfileBackfill(userRecord, userSnapshot.data() ?? {});
    if (Object.keys(patch).length === 0) {
      return sendJson(res, 200, { ok: true, patched: false });
    }

    await userRef.set(patch, { merge: true });
    return sendJson(res, 200, { ok: true, patched: true });
  } catch (error) {
    console.error('Failed to backfill legacy user profile fields', error);
    return sendJson(res, 500, {
      error: 'PROFILE_BACKFILL_FAILED',
      message: 'Unable to update your profile right now.'
    });
  }
}
