import { adminAuth, db } from '../_lib/firebaseAdmin.js';
import { readJsonBody, sendJson } from '../_lib/http.js';
import { consumeRateLimit, getRateLimitKey } from '../_utils/ratelimit.js';

const genericResponse = (res) => sendJson(res, 200, { ok: true });

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return sendJson(res, 405, { ok: false, error: 'METHOD_NOT_ALLOWED' });
  }

  const rateLimit = consumeRateLimit({
    key: getRateLimitKey({ req, prefix: 'restore-restricted-login' }),
    limit: 10,
    windowMs: 60_000
  });
  if (!rateLimit.ok) return genericResponse(res);

  const body = await readJsonBody(req).catch(() => ({}));
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase().slice(0, 320) : '';
  if (!email) return genericResponse(res);

  try {
    const authUser = await adminAuth.getUserByEmail(email);
    if (!authUser.disabled) return genericResponse(res);

    const profile = await db.collection('users').doc(authUser.uid).get();
    const status = profile.data()?.status;
    if (status === 'banned' || status === 'suspended') {
      await adminAuth.updateUser(authUser.uid, { disabled: false });
    }
  } catch (error) {
    // Always return the same response so this recovery path cannot be used to
    // enumerate registered or restricted accounts.
    if (error?.code !== 'auth/user-not-found') {
      console.error('Unable to restore restricted account sign-in', error);
    }
  }

  return genericResponse(res);
}
