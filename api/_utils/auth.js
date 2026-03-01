import { adminAuth } from '../_lib/firebaseAdmin.js';

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

  try {
    return await adminAuth.verifyIdToken(token);
  } catch {
    throw { status: 401, error: 'INVALID_AUTH_TOKEN' };
  }
};

export const requireAdmin = async (req) => {
  const decoded = await requireUser(req);
  if (decoded?.admin !== true) {
    throw { status: 403, error: 'ADMIN_REQUIRED' };
  }
  return decoded;
};
