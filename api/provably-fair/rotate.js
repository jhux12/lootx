import { adminAuth, firestore } from '../_lib/firebaseAdmin.js';
import { ensureProvablyFairState } from '../_lib/provablyFairState.js';
import { randomSeed, sha256 } from '../_lib/provablyFair.js';
import { getBearerToken, sendJson } from '../_lib/http.js';

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
    const { serverSeed, serverSeedHash, clientSeed } = await ensureProvablyFairState(firestore, decoded.uid);

    const revealRef = firestore
      .collection('provablyFairReveals')
      .doc(decoded.uid)
      .collection('reveals')
      .doc();
    const rotatedAt = Date.now();
    const reveal = {
      serverSeed,
      serverSeedHash,
      rotatedAt
    };

    const nextServerSeed = randomSeed();
    const nextHash = sha256(nextServerSeed);

    await Promise.all([
      revealRef.set(reveal),
      firestore.collection('provablyFair').doc(decoded.uid).set({
        serverSeed: nextServerSeed,
        serverSeedHash: nextHash,
        clientSeed,
        nonce: 0
      }, { merge: true })
    ]);

    return sendJson(res, 200, {
      revealed: reveal,
      current: {
        serverSeedHash: nextHash,
        clientSeed,
        nonce: 0
      }
    });
  } catch (error) {
    console.error('rotate error', error);
    return sendJson(res, 500, { error: 'Unable to rotate server seed' });
  }
}
