import { adminAuth, rtdb } from '../_lib/firebaseAdmin.js';
import { ensureProvablyFairState } from '../_lib/provablyFairState.js';
import { getBearerToken, readJsonBody, sendJson } from '../_lib/http.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return sendJson(res, 405, { error: 'Method Not Allowed' });
  }

  try {
    const token = getBearerToken(req);
    if (!token) {
      return sendJson(res, 401, { error: 'Missing bearer token' });
    }

    const decoded = await adminAuth.verifyIdToken(token);
    const body = await readJsonBody(req);
    if (!body || typeof body.clientSeed !== 'string') {
      return sendJson(res, 400, { error: 'Invalid payload' });
    }

    const clientSeed = body.clientSeed.trim();
    if (clientSeed.length < 1 || clientSeed.length > 64) {
      return sendJson(res, 400, { error: 'Client seed must be 1-64 characters' });
    }

    const state = await ensureProvablyFairState(rtdb, decoded.uid);
    const publicRef = rtdb.ref(`provablyFairPublic/${decoded.uid}`);

    await publicRef.update({
      clientSeed,
      nonce: 0,
      serverSeedHash: state.serverSeedHash
    });

    return sendJson(res, 200, {
      serverSeedHash: state.serverSeedHash,
      clientSeed,
      nonce: 0
    });
  } catch (error) {
    console.error('client-seed error', error);
    return sendJson(res, 500, { error: 'Unable to update client seed' });
  }
}
