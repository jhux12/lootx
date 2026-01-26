import { adminAuth, rtdb } from '../_lib/firebaseAdmin.js';
import { randomSeed, sha256 } from '../_lib/provablyFair.js';

const DEFAULT_CLIENT_SEED = 'lootx-player';

const getBearerToken = (req) => {
  const header = req.headers.authorization || '';
  const [, token] = header.split(' ');
  return token;
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  try {
    const token = getBearerToken(req);
    if (!token) {
      res.status(401).json({ error: 'Missing token' });
      return;
    }

    const decoded = await adminAuth.verifyIdToken(token);
    const uid = decoded.uid;
    const { clientSeed } = req.body ?? {};
    const trimmed = String(clientSeed ?? '').trim();

    if (!trimmed || trimmed.length > 64) {
      res.status(400).json({ error: 'clientSeed must be 1-64 characters' });
      return;
    }

    const secretRef = rtdb.ref(`provablyFairSecret/${uid}`);
    const secretSnap = await secretRef.get();
    let serverSeed = secretSnap.val()?.serverSeed;
    if (!serverSeed) {
      serverSeed = randomSeed();
      await secretRef.set({ serverSeed });
    }
    const serverSeedHash = sha256(serverSeed);

    const publicRef = rtdb.ref(`provablyFairPublic/${uid}`);
    const publicSnap = await publicRef.get();
    const existing = publicSnap.val() || {};

    const nextPublic = {
      clientSeed: trimmed || DEFAULT_CLIENT_SEED,
      nonce: 0,
      serverSeedHash: serverSeedHash ?? existing.serverSeedHash
    };

    await publicRef.set(nextPublic);
    res.status(200).json(nextPublic);
  } catch (error) {
    console.error('Failed to update client seed', error);
    res.status(500).json({ error: 'Failed to update client seed' });
  }
}
