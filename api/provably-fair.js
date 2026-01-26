import { adminAuth, firestore } from './_lib/firebaseAdmin.js';
import { ensureProvablyFairState } from './_lib/provablyFairState.js';
import { getBearerToken, sendJson } from './_lib/http.js';

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
    const { serverSeedHash, clientSeed, nonce } = await ensureProvablyFairState(firestore, decoded.uid);

    return sendJson(res, 200, { serverSeedHash, clientSeed, nonce });
  } catch (error) {
    console.error('provably-fair error', error);
    return sendJson(res, 500, { error: 'Unable to load provably fair state' });
  }
}
