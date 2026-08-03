import { adminAuth, db } from '../_lib/firebaseAdmin.js';

export const requireActiveAccount = async (uid) => {
  const snapshot = await db.collection('users').doc(uid).get();
  const status = snapshot.data()?.status;
  if (status === 'banned' || status === 'suspended') {
    throw { status: 403, error: 'ACCOUNT_RESTRICTED' };
  }
};

export const getBearerToken = (req) => {
  const header = req?.headers?.authorization;
  if (typeof header !== 'string') return null;
  const [scheme, token] = header.split(' ');
  if (!scheme || !token || scheme.toLowerCase() !== 'bearer') return null;
  return token.trim() || null;
};

export const deny = (res, status, message) => {
  res.status(status).json({ ok: false, error: message });
};

export const ok = (res, data = {}) => {
  res.status(200).json({ ok: true, ...data });
};

export const requireUser = async (req) => {
  const token = getBearerToken(req);
  if (!token) {
    throw { status: 401, error: 'AUTH_REQUIRED' };
  }

  let decoded;
  try {
    decoded = await adminAuth.verifyIdToken(token);
  } catch {
    throw { status: 401, error: 'INVALID_AUTH_TOKEN' };
  }
  await requireActiveAccount(decoded.uid);
  return decoded;
};

export const requireAdmin = async (req) => {
  const decoded = await requireUser(req);
  if (decoded?.admin !== true) {
    throw { status: 403, error: 'ADMIN_REQUIRED' };
  }
  return decoded;
};
