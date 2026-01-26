import { adminAuth, rtdb } from './_lib/firebaseAdmin.js';
import { computeRoll, pickPrizeByWeight, randomSeed, sha256 } from './_lib/provablyFair.js';

const DEFAULT_CLIENT_SEED = 'lootx-player';

const getBearerToken = (req) => {
  const header = req.headers.authorization || '';
  const [, token] = header.split(' ');
  return token;
};

const ensureSeeds = async (uid) => {
  const secretRef = rtdb.ref(`provablyFairSecret/${uid}`);
  const publicRef = rtdb.ref(`provablyFairPublic/${uid}`);
  const [secretSnap, publicSnap] = await Promise.all([secretRef.get(), publicRef.get()]);

  let serverSeed = secretSnap.val()?.serverSeed;
  if (!serverSeed) {
    serverSeed = randomSeed();
    await secretRef.set({ serverSeed });
  }

  const publicData = publicSnap.val();
  if (!publicData) {
    await publicRef.set({
      clientSeed: DEFAULT_CLIENT_SEED,
      nonce: 0,
      serverSeedHash: sha256(serverSeed)
    });
  }

  const latestPublicSnap = await publicRef.get();
  return {
    serverSeed,
    publicData: latestPublicSnap.val()
  };
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
    const { caseId } = req.body ?? {};

    if (!caseId) {
      res.status(400).json({ error: 'Missing caseId' });
      return;
    }

    const caseSnap = await rtdb.ref(`cases/${caseId}`).get();
    const caseData = caseSnap.val();

    if (!caseData) {
      res.status(404).json({ error: 'Case not found' });
      return;
    }
    if (!Array.isArray(caseData.prizes) || caseData.prizes.length === 0) {
      res.status(400).json({ error: 'Case has no prizes' });
      return;
    }

    const { serverSeed, publicData } = await ensureSeeds(uid);
    const clientSeed = publicData?.clientSeed || DEFAULT_CLIENT_SEED;

    const nonceRef = rtdb.ref(`provablyFairPublic/${uid}/nonce`);
    const nonceResult = await nonceRef.transaction((current) => Number(current ?? 0) + 1);

    if (!nonceResult.committed) {
      res.status(409).json({ error: 'Unable to reserve nonce' });
      return;
    }

    const nextNonce = Number(nonceResult.snapshot.val() ?? 1);
    const nonceUsed = nextNonce - 1;
    const { roll } = computeRoll(serverSeed, clientSeed, nonceUsed, caseId);
    const prize = pickPrizeByWeight(caseData.prizes || [], roll);
    const normalizedPrize = {
      ...prize,
      price: Number(prize.value ?? prize.price ?? 0),
      chance: Number(prize.weight ?? prize.chance ?? 0)
    };
    const price = Number(caseData.price ?? 0);

    const coinsRef = rtdb.ref(`users/${uid}/coins`);
    const coinsResult = await coinsRef.transaction((current) => {
      const coins = Number(current ?? 0);
      if (coins < price) {
        return;
      }
      return coins - price;
    });

    if (!coinsResult.committed) {
      res.status(400).json({ error: 'Insufficient coins' });
      return;
    }

    const newCoins = Number(coinsResult.snapshot.val() ?? 0);
    const inventoryId = rtdb.ref(`users/${uid}/inventory`).push().key;
    const openId = rtdb.ref('opens').push().key;
    const now = Date.now();

    const inventoryItem = {
      ...normalizedPrize,
      instanceId: inventoryId,
      obtainedAt: now,
      status: 'available',
      provenance: {
        sourceType: 'case_open',
        sourceId: caseId
      }
    };

    const updates = {};
    if (inventoryId) {
      updates[`users/${uid}/inventory/${inventoryId}`] = inventoryItem;
    }
    if (openId) {
      updates[`opens/${openId}`] = {
        uid,
        caseId,
        price,
        prize: normalizedPrize,
        inventoryId,
        createdAt: now,
        provablyFair: {
          serverSeedHash: sha256(serverSeed),
          clientSeed,
          nonce: nonceUsed,
          roll
        }
      };
    }

    await rtdb.ref().update(updates);

    res.status(200).json({
      ok: true,
      prize: normalizedPrize,
      newCoins,
      inventoryId,
      openId,
      provablyFair: {
        serverSeedHash: sha256(serverSeed),
        clientSeed,
        nonce: nonceUsed,
        roll
      }
    });
  } catch (error) {
    console.error('Failed to open case', error);
    res.status(500).json({ error: 'Failed to open case' });
  }
}
