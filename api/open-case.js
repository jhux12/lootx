import { adminAuth, rtdb, adminDb } from './_lib/firebaseAdmin.js';
import { computeRoll, pickPrizeByWeight } from './_lib/provablyFair.js';
import { ensureProvablyFairState } from './_lib/provablyFairState.js';
import { getBearerToken, readJsonBody, sendJson } from './_lib/http.js';

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
    const caseId = body?.caseId;
    if (!caseId || typeof caseId !== 'string') {
      return sendJson(res, 400, { error: 'Missing caseId' });
    }

    const caseSnap = await rtdb.ref(`cases/${caseId}`).get();
    let caseData = caseSnap.val();

    if (!caseData) {
      const boxSnap = await adminDb.collection('boxes').doc(caseId).get();
      if (boxSnap.exists) {
        const boxData = boxSnap.data() ?? {};
        caseData = {
          price: boxData.price ?? 0,
          prizes: Array.isArray(boxData.items) ? boxData.items : [],
          isUserCreated: boxData.isUserCreated ?? false
        };
      }
    }

    if (!caseData) {
      return sendJson(res, 404, { error: 'Case not found' });
    }

    const price = Number(caseData.price ?? 0);
    const prizes = Array.isArray(caseData.prizes) ? caseData.prizes : [];
    if (!prizes.length) {
      return sendJson(res, 400, { error: 'Case has no prizes' });
    }

    const { serverSeed, serverSeedHash } = await ensureProvablyFairState(rtdb, decoded.uid);

    const coinsRef = rtdb.ref(`users/${decoded.uid}/coins`);
    const coinsResult = await coinsRef.transaction((current) => {
      const balance = Number(current ?? 0);
      if (balance < price) {
        return;
      }
      return balance - price;
    });

    if (!coinsResult.committed) {
      return sendJson(res, 400, { error: 'Insufficient coins' });
    }

    const publicRef = rtdb.ref(`provablyFairPublic/${decoded.uid}`);
    const nonceResult = await publicRef.transaction((current) => {
      const data = current ?? {};
      const clientSeed = typeof data.clientSeed === 'string' && data.clientSeed.trim().length
        ? data.clientSeed
        : 'lootx-player';
      const nonce = Number.isFinite(data.nonce) ? Number(data.nonce) : 0;
      return {
        ...data,
        clientSeed,
        nonce: nonce + 1,
        serverSeedHash
      };
    });

    if (!nonceResult.committed) {
      await coinsRef.transaction((current) => Number(current ?? 0) + price);
      return sendJson(res, 500, { error: 'Unable to allocate nonce' });
    }

    const publicData = nonceResult.snapshot.val() ?? {};
    const clientSeed = publicData.clientSeed ?? 'lootx-player';
    const nonceUsed = Number(publicData.nonce ?? 1) - 1;

    const { roll, rollHash, message } = computeRoll(serverSeed, clientSeed, nonceUsed, caseId);
    const prize = pickPrizeByWeight(prizes, roll);

    const inventoryRef = rtdb.ref(`users/${decoded.uid}/inventory`).push();
    const inventoryId = inventoryRef.key;
    const openRef = rtdb.ref('opens').push();
    const openId = openRef.key;
    const obtainedAt = Date.now();

    const inventoryItem = {
      id: prize.id ?? inventoryId,
      name: prize.name,
      value: Number(prize.value ?? prize.price ?? 0),
      price: Number(prize.value ?? prize.price ?? 0),
      image: prize.image ?? '',
      rarity: prize.rarity ?? 'common',
      obtainedAt,
      status: 'available',
      provenance: {
        sourceType: 'case_open',
        sourceId: caseId
      }
    };

    const openRecord = {
      id: openId,
      uid: decoded.uid,
      caseId,
      price,
      prizeId: prize.id ?? null,
      createdAt: obtainedAt,
      provablyFair: {
        serverSeedHash,
        clientSeed,
        nonce: nonceUsed,
        roll,
        rollHash,
        message
      }
    };

    await rtdb.ref().update({
      [`users/${decoded.uid}/inventory/${inventoryId}`]: inventoryItem,
      [`opens/${openId}`]: openRecord
    });

    return sendJson(res, 200, {
      ok: true,
      prize: {
        ...prize,
        price: Number(prize.value ?? prize.price ?? 0)
      },
      newCoins: coinsResult.snapshot.val(),
      inventoryId,
      openId,
      provablyFair: {
        serverSeedHash,
        clientSeed,
        nonce: nonceUsed,
        roll,
        rollHash,
        message
      }
    });
  } catch (error) {
    console.error('open-case error', error);
    return sendJson(res, 500, { error: 'Unable to open case' });
  }
}
