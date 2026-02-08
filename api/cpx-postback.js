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

  console.log('🔥 CPX POSTBACK HIT 🔥');
  console.log('QUERY:', JSON.stringify(req.query, null, 2));

  const statusRaw = getQueryValue(req.query.status);
  const transId = getQueryValue(req.query.trans_id);
  const userId = getQueryValue(req.query.user_id);
  const subId = getQueryValue(req.query.subid_1);
  const uid = subId || userId;
  const amountUsdRaw = getQueryValue(req.query.amount_usd);
  const amountLocalRaw = getQueryValue(req.query.amount_local);
  const hash = getQueryValue(req.query.hash);

  if (!statusRaw || !transId || !uid || !amountUsdRaw || !amountLocalRaw || !hash) {
    // Early return: missing required params for secure processing.
    console.warn('CPX postback missing required params', {
      statusRaw,
      transId,
      uid,
      amountUsdRaw,
      amountLocalRaw,
      hashPresent: Boolean(hash)
    });
    return sendJson(res, 400, { error: 'Missing required CPX params' });
  }

  if (uid.length < 12 || uid.includes('{') || uid.includes('}')) {
    // Early return: malformed uid can cause silent writes or wrong doc updates.
    console.warn('CPX postback uid looks invalid', { uid });
    return sendJson(res, 400, { error: 'Invalid uid' });
  }

  console.log('CPX UID RESOLVED:', { uid });

  const secureHashSecret = process.env.CPX_SECURE_HASH;
  if (!secureHashSecret) {
    // Early return: server not configured with secure hash secret.
    console.warn('CPX postback missing secure hash secret');
    return sendJson(res, 500, { error: 'Offerwall configuration missing' });
  }

  const expectedHash = buildSecureHash(uid, secureHashSecret);
  if (hash !== expectedHash) {
    // Early return: failed signature verification.
    console.warn('CPX postback hash mismatch', { transId, uid });
    return sendJson(res, 403, { error: 'Invalid secure hash' });
  }

  const status = Number(statusRaw);
  const amountUsd = Number(amountUsdRaw);
  const amountLocal = Number(amountLocalRaw);
  const coinsPerUsd = Number(process.env.CPX_COINS_PER_USD ?? 100);
  const coins = Number.isFinite(amountUsd)
    ? Math.floor(amountUsd * coinsPerUsd)
    : 0;

  console.log('💰 CREDIT ATTEMPT', { uid, coins, amount_usd: amountUsd, status });

  if (status !== 1 && status !== 2) {
    // Early return: ignore non-credit/non-reversal statuses.
    console.warn('CPX postback ignored due to unsupported status', { status, transId });
    return sendJson(res, 200, { ignored: true });
  }

  if (status === 1 && coins <= 0) {
    // Early return: no coins to credit.
    console.warn('CPX postback ignored due to non-positive coins', {
      uid,
      transId,
      amountUsd,
      coins
    });
    return sendJson(res, 200, { ok: true, outcome: 'no coins' });
  }

  const transactionRef = firestore.collection('offerwall_transactions').doc(transId);
  const userRef = firestore.collection('users').doc(uid);
  const now = admin.firestore.FieldValue.serverTimestamp();
  let outcome = 'processed';

  await firestore.runTransaction(async (transaction) => {
    const existing = await transaction.get(transactionRef);
    console.log('🧾 TX EXISTS:', existing.exists);
    console.log('🧾 TX DATA:', existing.exists ? existing.data() : null);
    const existingData = existing.exists ? existing.data() : null;

    if (existingData) {
      if (status === 1 && existingData.credited) {
        // Early return: duplicate credit callback for already credited tx.
        console.warn('CPX postback duplicate credit', { transId, uid });
        outcome = 'duplicate';
        return;
      }
      if (status === 2 && existingData.reversed) {
        // Early return: duplicate reversal callback.
        console.warn('CPX postback duplicate reversal', { transId, uid });
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
          uid,
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

      // Early return: reversal with no credited transaction to undo.
      console.warn('CPX postback reversal ignored (no credited tx)', { transId, uid });
      transaction.set(
        transactionRef,
        {
          uid,
          coins: previousCoins,
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

  console.log('✅ TRANSACTION COMPLETE');
  return sendJson(res, 200, { ok: true, outcome });
}

// Reminder: set Vercel env CPX_COINS_PER_USD=100
// TESTING:
// - Trigger CPX test postback status=1 -> logs QUERY, CREDIT ATTEMPT, TRANSACTION COMPLETE
// - Trigger CPX test postback status=1 -> users/{uid}.coins and users/{uid}.balance increase by amount_usd*100
// - Trigger reversal status=2 for same trans_id -> coins decrease by the original credited amount (no recompute)
// - Confirm offerwall_transactions/{trans_id} records uid, coins, credited/reversed flags
