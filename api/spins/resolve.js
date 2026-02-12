import { admin, adminAuth, firestore } from '../_lib/firebaseAdmin.js';
import { computeRoll, pickPrizeByWeight, randomSeed, sha256 } from '../_lib/provablyFair.js';
import { getBearerToken, readJsonBody, sendJson } from '../_lib/http.js';

const DEFAULT_CLIENT_SEED = 'lootx-player';
const clampCount = (value) => Math.min(4, Math.max(1, Math.floor(Number(value) || 1)));
const dateKeyUtc = (date = new Date()) => date.toISOString().slice(0, 10);
const normalizeBoxItems = (boxData = {}) => (Array.isArray(boxData.items) ? boxData.items : (Array.isArray(boxData.prizes) ? boxData.prizes : []));
const toCoins = (value) => {
  const num = Number(value);
  return Number.isFinite(num) ? Math.max(0, num) : 0;
};
const getUserBalance = (userData = {}) => {
  const raw = Number(userData.coins ?? userData.balance ?? 0);
  return Number.isFinite(raw) ? Math.max(0, raw) : 0;
};
const getSellBackRate = (boxData = {}) => {
  const rawRate = Number(boxData.sellBackRate ?? (boxData.isUserCreated ? 0.75 : 0.82));
  return Number.isFinite(rawRate) ? Math.min(1, Math.max(0, rawRate)) : 0.82;
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return sendJson(res, 405, { error: 'INVALID_REQUEST', message: 'Only POST is allowed.' });
  }

  try {
    const token = getBearerToken(req);
    if (!token) return sendJson(res, 401, { error: 'AUTH_REQUIRED', message: 'Please log in to spin.' });

    const decoded = await adminAuth.verifyIdToken(token);
    const uid = decoded.uid;
    const body = await readJsonBody(req);
    const boxId = typeof body?.boxId === 'string' ? body.boxId.trim() : '';
    const clientRequestId = typeof body?.clientRequestId === 'string' ? body.clientRequestId.trim() : '';
    const requestedCount = clampCount(body?.count);

    if (!boxId || !clientRequestId) {
      return sendJson(res, 400, { error: 'INVALID_REQUEST', message: 'boxId and clientRequestId are required.' });
    }

    const userRef = firestore.collection('users').doc(uid);
    const boxRef = firestore.collection('boxes').doc(boxId);
    const provablyRef = firestore.collection('provablyFair').doc(uid);
    const idempotencyRef = firestore.collection('spinResolveRequests').doc(`${uid}_${clientRequestId}`);

    const [userSnap, boxSnap] = await Promise.all([userRef.get(), boxRef.get()]);
    if (!boxSnap.exists) return sendJson(res, 404, { error: 'BOX_NOT_FOUND', message: 'Box not found.' });

    const boxData = boxSnap.data() ?? {};
    const isDailyFree = boxData.isDailyFree === true || boxData.isDaily === true;
    if (isDailyFree && requestedCount > 1) {
      return sendJson(res, 400, { error: 'DAILY_FREE_LIMIT', message: 'Daily Free boxes support only x1 spins.' });
    }

    const preBalance = userSnap.exists ? getUserBalance(userSnap.data() ?? {}) : 0;
    const totalCost = isDailyFree ? 0 : toCoins(boxData.price) * requestedCount;
    if (!isDailyFree && preBalance < totalCost) {
      return sendJson(res, 402, { error: 'INSUFFICIENT_FUNDS', message: 'Not enough balance for this spin.' });
    }

    let responsePayload = null;

    await firestore.runTransaction(async (transaction) => {
      const [idemSnap, userTxSnap, boxTxSnap, provablySnap] = await Promise.all([
        transaction.get(idempotencyRef),
        transaction.get(userRef),
        transaction.get(boxRef),
        transaction.get(provablyRef)
      ]);

      if (idemSnap.exists) {
        responsePayload = idemSnap.data()?.response ?? null;
        return;
      }
      if (!userTxSnap.exists) throw { status: 404, error: 'USER_NOT_FOUND', message: 'User account not found.' };
      if (!boxTxSnap.exists) throw { status: 404, error: 'BOX_NOT_FOUND', message: 'Box not found.' };

      const userData = userTxSnap.data() ?? {};
      const txBoxData = boxTxSnap.data() ?? {};
      const count = clampCount(requestedCount);
      const txIsDailyFree = txBoxData.isDailyFree === true || txBoxData.isDaily === true;
      if (txIsDailyFree && count > 1) throw { status: 400, error: 'DAILY_FREE_LIMIT', message: 'Daily Free boxes support only x1 spins.' };

      const balance = getUserBalance(userData);
      const chargedAmount = txIsDailyFree ? 0 : toCoins(txBoxData.price) * count;
      const claimTs = Number(userData.lastDailyClaim ?? 0);
      if (txIsDailyFree && claimTs > 0 && dateKeyUtc(new Date(claimTs)) === dateKeyUtc()) {
        throw { status: 409, error: 'DAILY_ALREADY_CLAIMED', message: 'Daily free box already claimed today.' };
      }
      if (!txIsDailyFree && balance < chargedAmount) {
        throw { status: 402, error: 'INSUFFICIENT_FUNDS', message: 'Not enough balance for this spin.' };
      }

      const prizes = normalizeBoxItems(txBoxData);
      if (!prizes.length) throw { status: 400, error: 'INVALID_BOX', message: 'Box has no configured prizes.' };

      const provablyData = provablySnap.data() ?? {};
      const serverSeed = provablyData.serverSeed || randomSeed();
      const serverSeedHash = provablyData.serverSeedHash ?? sha256(serverSeed);
      const clientSeed = typeof provablyData.clientSeed === 'string' && provablyData.clientSeed.trim().length
        ? provablyData.clientSeed
        : DEFAULT_CLIENT_SEED;
      const nonceStart = Number.isFinite(provablyData.nonce) ? Number(provablyData.nonce) : 0;

      const now = admin.firestore.FieldValue.serverTimestamp();
      const spinBatchId = firestore.collection('spinBatches').doc().id;
      const sellBackRate = getSellBackRate(txBoxData);
      const results = [];

      for (let i = 0; i < count; i += 1) {
        const { roll } = computeRoll(serverSeed, clientSeed, nonceStart + i, boxId);
        const prize = pickPrizeByWeight(prizes, roll);
        const prizeValue = toCoins(prize.value ?? prize.price ?? 0);
        const sellValueCoins = Math.floor(prizeValue * sellBackRate);
        const itemRef = userRef.collection('inventory').doc();

        transaction.set(itemRef, {
          userId: uid,
          boxId,
          prizeId: prize.id ?? null,
          name: prize.name ?? 'Mystery Item',
          image: prize.image ?? '',
          rarity: prize.rarity ?? 'common',
          value: prizeValue,
          sellValueCoins,
          sellBackRate,
          status: 'pending_decision',
          spinBatchId,
          decisionLocked: false,
          redeemable: prize.redeemable ?? true,
          obtainedAt: now,
          createdAt: now,
          acquisitionCurrencyType: 'COIN',
          openCurrencyType: 'COIN'
        });

        results.push({
          itemId: itemRef.id,
          userId: uid,
          boxId,
          prizeId: prize.id ?? null,
          name: prize.name ?? 'Mystery Item',
          image: prize.image ?? '',
          rarity: prize.rarity ?? 'common',
          sellValueCoins,
          status: 'pending_decision',
          spinBatchId,
          decisionLocked: false
        });
      }

      const newBalance = Math.max(0, balance - chargedAmount);
      if (txIsDailyFree) {
        transaction.set(userRef, {
          lastDailyClaim: Date.now(),
          lastDailyFreeClaimDate: dateKeyUtc(),
          lastDailyFreeClaimAt: now
        }, { merge: true });
      } else {
        transaction.set(userRef, { coins: newBalance, balance: newBalance }, { merge: true });
      }

      transaction.set(provablyRef, { serverSeed, serverSeedHash, clientSeed, nonce: nonceStart + count }, { merge: true });

      const spinRef = firestore.collection('spins').doc();
      transaction.set(spinRef, {
        clientRequestId,
        userId: uid,
        boxId,
        count,
        chargedAmount,
        resultItemIds: results.map((item) => item.itemId),
        priceVersion: txBoxData.priceVersion ?? null,
        timestamp: Date.now(),
        createdAt: now
      });

      responsePayload = { charged: chargedAmount, results, newBalance, spinBatchId };

      transaction.set(idempotencyRef, {
        clientRequestId,
        uid,
        boxId,
        createdAt: now,
        response: responsePayload
      });
    });

    return sendJson(res, 200, responsePayload ?? { charged: 0, results: [], newBalance: preBalance });
  } catch (error) {
    return sendJson(res, Number(error?.status) || 500, {
      error: error?.error || 'SPIN_RESOLVE_FAILED',
      message: error?.message || 'Unable to resolve spin.'
    });
  }
}
