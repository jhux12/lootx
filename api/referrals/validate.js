import { firestore } from '../_lib/firebaseAdmin.js';
import { readJsonBody, sendJson } from '../_lib/http.js';

const normalizeCode = (value) => String(value ?? '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return sendJson(res, 405, { ok: false, error: 'Method Not Allowed' });
  }

  try {
    const body = await readJsonBody(req);
    const code = normalizeCode(body?.referralCode ?? body?.code);
    if (!code) return sendJson(res, 400, { ok: false, valid: false, error: 'INVALID_REFERRAL_CODE' });

    const [affiliateMatch, usernameMatch] = await Promise.all([
      firestore.collection('users').where('affiliateCode', '==', code).limit(1).get(),
      firestore.collection('users').where('usernameLower', '==', code.toLowerCase()).limit(1).get()
    ]);
    const valid = !affiliateMatch.empty || !usernameMatch.empty;
    return sendJson(res, 200, { ok: true, valid, code: valid ? code : null });
  } catch (error) {
    return sendJson(res, 500, { ok: false, valid: false, error: error?.error ?? 'Failed to validate referral code' });
  }
}
