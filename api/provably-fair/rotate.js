import { adminAuth, rtdb } from '../_lib/firebaseAdmin.js';
import { randomSeed, sha256 } from '../_lib/provablyFair.js';

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
    const secretRef = rtdb.ref(`provablyFairSecret/${uid}`);
    const publicRef = rtdb.ref(`provablyFairPublic/${uid}`);

    const [secretSnap, publicSnap] = await Promise.all([secretRef.get(), publicRef.get()]);
    const serverSeed = secretSnap.val()?.serverSeed;
    const clientSeed = publicSnap.val()?.clientSeed || 'lootx-player';
    const nonce = Number(publicSnap.val()?.nonce ?? 0);

    let reveal = null;
    if (serverSeed) {
      const serverSeedHash = sha256(serverSeed);
      const revealId = rtdb.ref(`provablyFairReveals/${uid}`).push().key;
      reveal = {
        serverSeed,
        serverSeedHash,
        rotatedAt: Date.now()
      };

      if (revealId) {
        await rtdb.ref(`provablyFairReveals/${uid}/${revealId}`).set(reveal);
      }
    }

    const nextServerSeed = randomSeed();
    const nextHash = sha256(nextServerSeed);

    await Promise.all([
      secretRef.set({ serverSeed: nextServerSeed }),
      publicRef.set({
        serverSeedHash: nextHash,
        clientSeed,
        nonce
      })
    ]);

    res.status(200).json({
      revealed: reveal,
      current: {
        serverSeedHash: nextHash,
        clientSeed,
        nonce
      }
    });
  } catch (error) {
    console.error('Failed to rotate server seed', error);
    res.status(500).json({ error: 'Failed to rotate server seed' });
  }
}
