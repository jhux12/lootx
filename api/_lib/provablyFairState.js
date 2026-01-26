import { randomSeed, sha256 } from './provablyFair.js';

const DEFAULT_CLIENT_SEED = 'lootx-player';

export const ensureProvablyFairState = async (rtdb, uid) => {
  const secretRef = rtdb.ref(`provablyFairSecret/${uid}`);
  const publicRef = rtdb.ref(`provablyFairPublic/${uid}`);

  const secretSnap = await secretRef.get();
  let serverSeed = secretSnap.val()?.serverSeed;
  if (!serverSeed) {
    serverSeed = randomSeed();
    await secretRef.set({ serverSeed });
  }

  const serverSeedHash = sha256(serverSeed);
  const publicSnap = await publicRef.get();
  const publicData = publicSnap.val() ?? {};
  const clientSeed = typeof publicData.clientSeed === 'string' && publicData.clientSeed.trim().length
    ? publicData.clientSeed
    : DEFAULT_CLIENT_SEED;
  const nonce = Number.isFinite(publicData.nonce) ? Number(publicData.nonce) : 0;

  const updates = {};
  if (publicData.serverSeedHash !== serverSeedHash) updates.serverSeedHash = serverSeedHash;
  if (publicData.clientSeed !== clientSeed) updates.clientSeed = clientSeed;
  if (publicData.nonce !== nonce) updates.nonce = nonce;

  if (Object.keys(updates).length) {
    await publicRef.update(updates);
  }

  return { serverSeed, serverSeedHash, clientSeed, nonce };
};

export const getPublicState = async (rtdb, uid) => {
  const publicSnap = await rtdb.ref(`provablyFairPublic/${uid}`).get();
  const publicData = publicSnap.val() ?? {};
  return {
    serverSeedHash: publicData.serverSeedHash ?? '',
    clientSeed: publicData.clientSeed ?? DEFAULT_CLIENT_SEED,
    nonce: Number.isFinite(publicData.nonce) ? Number(publicData.nonce) : 0
  };
};

export const DEFAULT_PROVABLY_FAIR_CLIENT_SEED = DEFAULT_CLIENT_SEED;
