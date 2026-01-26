import { adminAuth, rtdb } from './_lib/firebaseAdmin.js';
import { randomSeed, sha256 } from './_lib/provablyFair.js';

const DEFAULT_CLIENT_SEED = 'lootx-player';

const getBearerToken = (req) => {
  const header = req.headers.authorization || '';
  const [, token] = header.split(' ');
  return token;
};

const ensurePublicState = async ({ uid, serverSeed, publicData }) => {
  const serverSeedHash = sha256(serverSeed);
  const publicRef = rtdb.ref(`provablyFairPublic/${uid}`);
  const nextPublic = {
    clientSeed: publicData?.clientSeed || DEFAULT_CLIENT_SEED,
    nonce: Number(publicData?.nonce ?? 0),
    serverSeedHash
  };

  await publicRef.set(nextPublic);
  return nextPublic;
};

export default async function handler(req, res) {
  if (req.method !== 'GET') {
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
    let serverSeed = secretSnap.val()?.serverSeed;
    const publicData = publicSnap.val();

    if (!serverSeed) {
      serverSeed = randomSeed();
      await secretRef.set({ serverSeed });
    }

    const publicState = await ensurePublicState({ uid, serverSeed, publicData });

    res.status(200).json(publicState);
  } catch (error) {
    console.error('Failed to load provably fair state', error);
    res.status(500).json({ error: 'Failed to load provably fair state' });
  }
}
