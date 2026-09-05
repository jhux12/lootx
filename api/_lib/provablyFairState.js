import { randomSeed, sha256 } from './provablyFair.js';

const DEFAULT_CLIENT_SEED = 'ripza-player';
const AUTO_ROTATE_INTERVAL_MS = 60 * 60 * 1000;

export const ensureProvablyFairState = async (firestore, uid) => {
  const docRef = firestore.collection('provablyFair').doc(uid);
  const snap = await docRef.get();

  if (!snap.exists) {
    const serverSeed = randomSeed();
    const serverSeedHash = sha256(serverSeed);
    const clientSeed = DEFAULT_CLIENT_SEED;
    const nonce = 0;
    const lastServerSeedRotationAt = Date.now();
    await docRef.set({
      serverSeed,
      serverSeedHash,
      clientSeed,
      nonce,
      lastServerSeedRotationAt
    });
    return { serverSeed, serverSeedHash, clientSeed, nonce };
  }

  const data = snap.data() ?? {};
  const now = Date.now();
  let serverSeed = data.serverSeed || randomSeed();
  let serverSeedHash = data.serverSeedHash || sha256(serverSeed);
  const clientSeed = typeof data.clientSeed === 'string' && data.clientSeed.trim().length
    ? data.clientSeed
    : DEFAULT_CLIENT_SEED;
  let nonce = Number.isFinite(data.nonce) ? Number(data.nonce) : 0;
  let lastServerSeedRotationAt = Number.isFinite(data.lastServerSeedRotationAt)
    ? Number(data.lastServerSeedRotationAt)
    : now;

  if (now - lastServerSeedRotationAt >= AUTO_ROTATE_INTERVAL_MS) {
    serverSeed = randomSeed();
    serverSeedHash = sha256(serverSeed);
    nonce = 0;
    lastServerSeedRotationAt = now;
  }

  const updates = {};
  if (data.serverSeed !== serverSeed) updates.serverSeed = serverSeed;
  if (data.serverSeedHash !== serverSeedHash) updates.serverSeedHash = serverSeedHash;
  if (data.clientSeed !== clientSeed) updates.clientSeed = clientSeed;
  if (data.nonce !== nonce) updates.nonce = nonce;
  if (data.lastServerSeedRotationAt !== lastServerSeedRotationAt) updates.lastServerSeedRotationAt = lastServerSeedRotationAt;

  if (Object.keys(updates).length) {
    await docRef.set(updates, { merge: true });
  }

  return { serverSeed, serverSeedHash, clientSeed, nonce };
};

export const getPublicState = async (firestore, uid) => {
  const snap = await firestore.collection('provablyFair').doc(uid).get();
  const data = snap.data() ?? {};
  return {
    serverSeedHash: data.serverSeedHash ?? '',
    clientSeed: data.clientSeed ?? DEFAULT_CLIENT_SEED,
    nonce: Number.isFinite(data.nonce) ? Number(data.nonce) : 0
  };
};

export const DEFAULT_PROVABLY_FAIR_CLIENT_SEED = DEFAULT_CLIENT_SEED;
