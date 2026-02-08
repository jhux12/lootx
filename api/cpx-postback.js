import crypto from 'crypto';
import { admin, firestore } from './_lib/firebaseAdmin.js';
import { readJsonBody, sendJson } from './_lib/http.js';

/**
 * CPX secure hash:
 * md5(trans_id + "-" + CPX_SECURE_HASH)
 */
const buildSecureHash = (transId, secret) =>
  crypto.createHash('md5').update(`${transId}-${secret}`).digest('hex');

const getQueryValue = (value) =>
  Array.isArray(value) ? value[0] : value;

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

  // --- Amount handling (CPX sends USD decimals, e.g. "0.01") ---
  const status = Number(statusRaw);

  const amountUsd = Number(amountUsdRaw);
  const balanceUsd = Number.isFinite(amountUsd) ? amountUsd : 0;

  const amountLocal = Number(amountLocalRaw ?? 0);

  // Economy: 1¢ = 1 coin
  const coinsPerUsd = Number(process.env.CPX_COINS_PER_USD ?? '100');

  const coins =
    Number.isFinite(balanceUsd) && Number.isFinite(coinsPerUsd)
      ? Math.max(0, Math.floor(balanceUsd * coinsPerUsd))
      : 0;

  console.log('CPX CREDIT:', {
    uid: userId,
    trans_id: transId,
    amount_usd: balanceUsd,
    coinsPerUsd,
    coins,
    status
  });

  if (status !== 1 && status !== 2) {
    return sendJson(res, 200, { ignored: true });
  }

  if (status === 1 && coins === 0 && balanceUsd === 0) {
    return sendJson(res, 200, { ok: true, outcome: 'no credit' });
  }

  const transactionRef = firestore.collection('offerwall_transactions').doc(transId);
  const userRef = firestore.collection('users').doc(userId);
  const now = admin.firestore.FieldValue.serverTimestamp();
  let outcome = 'processed';

  await firestore.runTransaction(async (tx) => {
    const txSnap = await tx.get(transactionRef);
    const existing = txSnap.exists ? txSnap.data() : null;

    const userSnap = await tx.get(userRef);
    const user = userSnap.exists ? userSnap.data() : {};
    const currentCoins = Number(user.coins ?? 0);
    const currentBalance = Number(user.balance ?? 0);

    if (existing) {
      if (status === 1 && existing.credited) {
        outcome = 'duplicate';
        return;
      }
      if (status === 2 && existing.reversed) {
        outcome = 'duplicate';
        return;
      }
    }

    // ---- CREDIT ----
    if (status === 1) {
      tx.set(
        userRef,
        {
          coins: currentCoins + coins,
          balance: currentBalance + balanceUsd
        },
        { merge: true }
      );

      tx.set(
        transactionRef,
        {
          uid: userId,
          coins,
          amount_usd: balanceUsd,
          amount_local: Number.isFinite(amountLocal) ? amountLocal : 0,
          status,
          credited: true,
          reversed: false,
          createdAt: existing?.createdAt ?? now,
          updatedAt: now,
          creditedAt: now
        },
        { merge: true }
      );

      outcome = 'credited';
      return;
    }

    // ---- REVERSAL ----
    if (status === 2) {
      const prevCoins = Number(existing?.coins ?? 0);
      const prevUsd = Number(existing?.amount_usd ?? 0);

      if (existing?.credited && !existing?.reversed) {
        tx.set(
          userRef,
          {
            coins: Math.max(0, currentCoins - prevCoins),
            balance: Math.max(0, currentBalance - prevUsd)
          },
          { merge: true }
        );

        tx.set(
          transactionRef,
          {
            status,
            reversed: true,
            reversedAt: now,
            updatedAt: now
          },
          { merge: true }
        );

        outcome = 'reversed';
        return;
      }

      outcome = 'ignored';
    }
  });

  return sendJson(res, 200, { ok: true, outcome });
}

/**
 * ENV REQUIRED:
 * CPX_SECURE_HASH=your_cpx_secure_hash
 * CPX_COINS_PER_USD=100   // 1¢ = 1 coin
 */
