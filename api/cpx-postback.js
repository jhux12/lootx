import crypto from 'crypto';
import { admin, firestore } from './_lib/firebaseAdmin.js';
import { sendJson } from './_lib/http.js';

const buildSecureHash = (uid, secret) =>
  crypto.createHash('md5').update(`${uid}-${secret}`).digest('hex');

const getQueryValue = (value) => (Array.isArray(value) ? value[0] : value);

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return sendJson(res, 405, { error: 'Method Not Allowed' });
  }

  console.log('CPX POSTBACK:', req.query);

  const statusRaw = getQueryValue(req.query.status);
  const transId = getQueryValue(req.query.trans_id);
  const userId = getQueryValue(req.query.user_id);
  const amountUsdRaw = getQueryValue(req.query.amount_usd);
  const amountLocalRaw = getQueryValue(req.query.amount_local);
  const hash = getQueryValue(req.query.hash);

  if (!statusRaw || !transId || !userId || !amountUsdRaw || !amountLocalRaw || !hash) {
    return sendJson(res, 400, { error: 'Missing required CPX params' });
  }

  if (userId.length < 12 || userId.includes('{') || userId.includes('}')) {
    console.warn('CPX postback user_id looks invalid', { userId });
  }

  const secureHashSecret = process.env.CPX_SECURE_HASH;
  if (!secureHashSecret) {
    return sendJson(res, 500, { error: 'Offerwall configuration missing' });
  }

  const expectedHash = buildSecureHash(userId, secureHashSecret);
  if (hash !== expectedHash) {
    console.warn('CPX postback hash mismatch', { transId, userId });
    return sendJson(res, 403, { error: 'Invalid secure hash' });
  }

  const status = Number(statusRaw);
  const amountUsd = Number(amountUsdRaw);
  const amountLocal = Number(amountLocalRaw);
  const coinsPerUsdRaw = process.env.CPX_COINS_PER_USD ?? '100';
  const coinsPerUsd = Number(coinsPerUsdRaw);
  const computedCoins = Number.isFinite(amountUsd) && Number.isFinite(coinsPerUsd)
    ? Math.floor(amountUsd * coinsPerUsd)
    : 0;
  const coins = Number.isFinite(computedCoins) ? Math.max(0, computedCoins) : 0;

  console.log('CPX CREDIT:', {
    uid: userId,
    trans_id: transId,
    amount_usd: amountUsd,
    coins,
    status
  });

  if (status !== 1 && status !== 2) {
    return sendJson(res, 200, { ignored: true });
  }

  if (status === 1 && coins <= 0) {
    return sendJson(res, 200, { ok: true, outcome: 'no coins' });
  }

  const transactionRef = firestore.collection('offerwall_transactions').doc(transId);
  const userRef = firestore.collection('users').doc(userId);
  const now = admin.firestore.FieldValue.serverTimestamp();
  let outcome = 'processed';

  await firestore.runTransaction(async (transaction) => {
    const existing = await transaction.get(transactionRef);
    const existingData = existing.exists ? existing.data() : null;

    if (existingData) {
      if (status === 1 && existingData.credited) {
        outcome = 'duplicate';
        return;
      }
      if (status === 2 && existingData.reversed) {
        outcome = 'duplicate';
        return;
      }
    }

    if (status === 1) {
      transaction.set(
        userRef,
        {
          coins: admin.firestore.FieldValue.increment(coins),
          balance: admin.firestore.FieldValue.increment(coins)
        },
        { merge: true }
      );
      transaction.set(
        transactionRef,
        {
          uid: userId,
          coins,
          amount_usd: Number.isFinite(amountUsd) ? amountUsd : 0,
          amount_local: Number.isFinite(amountLocal) ? amountLocal : 0,
          status,
          credited: true,
          reversed: false,
          createdAt: existingData?.createdAt ?? now,
          updatedAt: now,
          creditedAt: now
        },
        { merge: true }
      );
      outcome = 'credited';
      return;
    }

    if (status === 2) {
      const previousCoins = Number.isFinite(existingData?.coins) ? existingData.coins : 0;
      if (existingData?.credited && !existingData?.reversed) {
        transaction.set(
          userRef,
          {
            coins: admin.firestore.FieldValue.increment(-previousCoins),
            balance: admin.firestore.FieldValue.increment(-previousCoins)
          },
          { merge: true }
        );
        transaction.set(
          transactionRef,
          {
            status,
            reversed: true,
            updatedAt: now,
            reversedAt: now,
            amount_usd: Number.isFinite(amountUsd) ? amountUsd : existingData.amount_usd ?? 0,
            amount_local: Number.isFinite(amountLocal) ? amountLocal : existingData.amount_local ?? 0,
            coins: previousCoins
          },
          { merge: true }
        );
        outcome = 'reversed';
        return;
      }

      transaction.set(
        transactionRef,
        {
          uid: userId,
          coins,
          amount_usd: Number.isFinite(amountUsd) ? amountUsd : 0,
          amount_local: Number.isFinite(amountLocal) ? amountLocal : 0,
          status,
          credited: existingData?.credited ?? false,
          reversed: existingData?.reversed ?? false,
          createdAt: existingData?.createdAt ?? now,
          updatedAt: now
        },
        { merge: true }
      );
      outcome = 'ignored';
    }
  });

  return sendJson(res, 200, { ok: true, outcome });
}

// Reminder: set Vercel env CPX_COINS_PER_USD=100
// TESTING:
// - Trigger CPX test postback status=1 -> users/{uid}.coins increases by amount_usd*100
// - Trigger reversal status=2 for same trans_id -> coins decrease by the original credited amount
// - Confirm offerwall_transactions/{trans_id} records credited/reversed flags
