import crypto from 'crypto';
import { admin, firestore } from './_lib/firebaseAdmin.js';
import { readJsonBody, sendJson } from './_lib/http.js';

const buildSecureHash = (transId, secret) =>
  crypto.createHash('md5').update(`${transId}-${secret}`).digest('hex');

const getQueryValue = (value) => (Array.isArray(value) ? value[0] : value);

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return sendJson(res, 405, { error: 'Method Not Allowed' });
  }

  const body = req.method === 'POST' ? await readJsonBody(req) : null;
  if (req.method === 'POST' && body === null) {
    return sendJson(res, 400, { error: 'Invalid JSON body' });
  }

  const payload = body && typeof body === 'object' ? body : req.query;

  console.log('CPX POSTBACK:', payload);

  const statusRaw = getQueryValue(payload.status);
  const transId = getQueryValue(payload.trans_id ?? payload.transaction_id);
  const userId = getQueryValue(payload.user_id ?? payload.ext_user_id);
  const amountUsdRaw = getQueryValue(payload.amount_usd);
  const amountLocalRaw = getQueryValue(payload.amount_local);
  const receivedHash = getQueryValue(payload.hash ?? payload.secure_hash);

  if (!statusRaw || !transId || !userId || !amountUsdRaw || !receivedHash) {
    return sendJson(res, 400, { error: 'Missing required CPX params' });
  }

  if (userId.length < 12 || userId.includes('{') || userId.includes('}')) {
    console.warn('CPX postback user_id looks invalid', { userId });
  }

  const secureHashSecret = process.env.CPX_SECURE_HASH;
  if (!secureHashSecret) {
    return sendJson(res, 500, { error: 'Offerwall configuration missing' });
  }

  const expectedHash = buildSecureHash(transId, secureHashSecret);
  if (receivedHash !== expectedHash) {
    console.warn('CPX postback hash mismatch', {
      transId,
      userId,
      expectedHash,
      receivedHash
    });
    return sendJson(res, 403, { error: 'Invalid secure hash' });
  }

  const status = Number(statusRaw);
  const amountUsdString = typeof amountUsdRaw === 'string' ? amountUsdRaw : String(amountUsdRaw);
  const amountUsdValue = Number(amountUsdRaw);
  const amountUsd = Number.isFinite(amountUsdValue)
    ? amountUsdValue / (amountUsdString.includes('.') ? 1 : 100)
    : amountUsdValue;
  const amountLocal = Number(amountLocalRaw ?? 0);
  const coinsPerUsdRaw = process.env.CPX_COINS_PER_USD ?? '100';
  const coinsPerUsd = Number(coinsPerUsdRaw);
  const computedCoins = Number.isFinite(amountUsd) && Number.isFinite(coinsPerUsd)
    ? Math.floor(amountUsd * coinsPerUsd)
    : 0;
  const coins = Number.isFinite(computedCoins) ? Math.max(0, computedCoins) : 0;
  const balanceUsd = Number.isFinite(amountUsd) ? amountUsd : 0;

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

  if (status === 1 && coins <= 0 && balanceUsd <= 0) {
    return sendJson(res, 200, { ok: true, outcome: 'no credit' });
  }

  const transactionRef = firestore.collection('offerwall_transactions').doc(transId);
  const userRef = firestore.collection('users').doc(userId);
  const now = admin.firestore.FieldValue.serverTimestamp();
  let outcome = 'processed';

  await firestore.runTransaction(async (transaction) => {
    const existing = await transaction.get(transactionRef);
    const existingData = existing.exists ? existing.data() : null;
    const userSnapshot = await transaction.get(userRef);
    const userData = userSnapshot.exists ? userSnapshot.data() : null;
    const currentCoins = Number.isFinite(userData?.coins) ? userData.coins : 0;
    const currentBalance = Number.isFinite(userData?.balance) ? userData.balance : 0;

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
      const nextCoins = Math.max(0, currentCoins + coins);
      const nextBalance = Math.max(0, currentBalance + balanceUsd);
      transaction.set(
        userRef,
        {
          coins: nextCoins,
          balance: nextBalance
        },
        { merge: true }
      );
      transaction.set(
        transactionRef,
        {
          uid: userId,
          coins,
          amount_usd: balanceUsd,
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
      const previousAmountUsd = Number.isFinite(existingData?.amount_usd)
        ? existingData.amount_usd
        : 0;
      const reversalAmountUsd = Number.isFinite(amountUsd)
        ? amountUsd
        : existingData?.amount_usd ?? 0;
      if (existingData?.credited && !existingData?.reversed) {
        const nextCoins = Math.max(0, currentCoins - previousCoins);
        const nextBalance = Math.max(0, currentBalance - previousAmountUsd);
        transaction.set(
          userRef,
          {
            coins: nextCoins,
            balance: nextBalance
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
            amount_usd: reversalAmountUsd,
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
          amount_usd: balanceUsd,
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
