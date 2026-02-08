import crypto from 'crypto';
import { adminAuth } from './_lib/firebaseAdmin.js';
import { getBearerToken, sendJson } from './_lib/http.js';

const buildSecureHash = (uid, secret) =>
  crypto.createHash('md5').update(`${uid}-${secret}`).digest('hex');

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return sendJson(res, 405, { error: 'Method Not Allowed' });
  }

  try {
    const token = getBearerToken(req);
    if (!token) {
      return sendJson(res, 401, { error: 'Missing bearer token' });
    }

    const decoded = await adminAuth.verifyIdToken(token);
    const uid = decoded.uid;
    const name = decoded.name ?? '';
    const email = decoded.email ?? '';

    const appId = process.env.CPX_APP_ID;
    const secureHashSecret = process.env.CPX_SECURE_HASH;

    if (!appId || !secureHashSecret) {
      return sendJson(res, 500, { error: 'Offerwall configuration missing' });
    }

    const secureHash = buildSecureHash(uid, secureHashSecret);
    const url = `https://offers.cpx-research.com/index.php?app_id=${encodeURIComponent(appId)}`
      + `&ext_user_id=${encodeURIComponent(uid)}`
      + `&secure_hash=${encodeURIComponent(secureHash)}`
      + `&username=${encodeURIComponent(name)}`
      + `&email=${encodeURIComponent(email)}`;

    return sendJson(res, 200, { url });
  } catch (error) {
    console.error('Failed to create CPX offerwall URL', error);
    return sendJson(res, 500, { error: 'Failed to create offerwall URL' });
  }
}
