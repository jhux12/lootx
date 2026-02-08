import crypto from 'crypto';
import { admin, firestore } from './_lib/firebaseAdmin.js';

const buildSecureHash = (uid, secret) =>
  crypto.createHash('md5').update(`${uid}-${secret}`).digest('hex');

const getQueryValue = (value) => (Array.isArray(value) ? value[0] : value);

export default async function handler(req, res) {
  try {
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET');
      return res.status(405).json({ error: 'Method Not Allowed' });
    }

    console.log('🔥 CPX POSTBACK HIT 🔥');
    console.log('QUERY:', JSON.stringify(req.query, null, 2));

    const status = getQueryValue(req.query.status);
    const transId = getQueryValue(req.query.trans_id);
    const userId = getQueryValue(req.query.user_id);
    const subId = getQueryValue(req.query.subid_1);
    const amountUsdRaw = getQueryValue(req.query.amount_usd);
    const amountLocalRaw = getQueryValue(req.query.amount_local);
    const hash = getQueryValue(req.query.hash);

    if (!status || !transId || !amountUsdRaw || !hash) {
      // Early return: missing required params for secure processing.
      console.warn('CPX postback missing required params', {
        status,
        transId,
        amountUsdRaw,
        hashPresent: Boolean(hash)
      });
      return res.status(400).json({ error: 'Missing required CPX params' });
    }

    const uid = subId || userId;
    if (!uid) {
      // Early return: missing user identifier, cannot credit.
      console.warn('CPX postback missing uid', { userId, subId });
      return res.status(400).json({ error: 'Missing user ID' });
    }

    if (uid.length < 12 || uid.includes('{') || uid.includes('}')) {
      // Early return: malformed uid can cause silent writes or wrong doc updates.
      console.warn('CPX postback uid looks invalid', { uid });
      return res.status(400).json({ error: 'Invalid uid' });
    }

    console.log('CPX UID RESOLVED:', { uid });

    const secureHashSecret = process.env.CPX_SECURE_HASH;
    if (!secureHashSecret) {
      // Early return: server not configured with secure hash secret.
      console.warn('CPX postback missing secure hash secret');
      return res.status(500).json({ error: 'Offerwall configuration missing' });
    }

    const expectedHash = buildSecureHash(uid, secureHashSecret);
    if (hash !== expectedHash) {
      // Early return: failed signature verification.
      console.warn('CPX postback hash mismatch', { transId, uid });
      return res.status(403).json({ error: 'Invalid secure hash' });
    }

    if (String(status) !== '1' && String(status) !== '2') {
      // Early return: ignore non-credit/non-reversal statuses.
      console.warn('CPX postback ignored due to unsupported status', { status, transId });
      return res.status(200).json({ ok: true, ignored: true });
    }

    const amountUsd = Number(amountUsdRaw);
    const amountLocal = Number(amountLocalRaw);
    const coins = Number.isFinite(amountUsd) ? Math.floor(amountUsd * 100) : 0;

    console.log('💰 CREDIT ATTEMPT', {
      uid,
      coins,
      amount_usd: amountUsd,
      status: String(status)
    });

    if (String(status) === '1' && coins <= 0) {
      // Early return: no coins to credit.
      console.warn('CPX postback ignored due to non-positive coins', {
        uid,
        transId,
        amountUsd,
        coins
      });
      return res.status(200).json({ ok: true, outcome: 'no coins' });
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

      if (String(status) === '1') {
        if (existing.exists) {
          // Early return: duplicate credit callback for already credited tx.
          console.warn('CPX postback duplicate credit', { transId, uid });
          outcome = 'duplicate';
          return;
        }

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
            status: 'completed',
            credited: true,
            reversed: false,
            createdAt: now,
            updatedAt: now,
            creditedAt: now
          },
          { merge: true }
        );
        outcome = 'credited';
        return;
      }

      if (String(status) === '2') {
        if (!existingData?.credited) {
          // Early return: reversal with no credited transaction to undo.
          console.warn('CPX postback reversal ignored (no credited tx)', { transId, uid });
          outcome = 'ignored';
          transaction.set(
            transactionRef,
            {
              uid,
              coins: existingData?.coins ?? 0,
              amount_usd: Number.isFinite(amountUsd) ? amountUsd : 0,
              amount_local: Number.isFinite(amountLocal) ? amountLocal : 0,
              status: 'reversal',
              credited: existingData?.credited ?? false,
              reversed: existingData?.reversed ?? false,
              createdAt: existingData?.createdAt ?? now,
              updatedAt: now
            },
            { merge: true }
          );
          return;
        }

        if (existingData?.reversed) {
          // Early return: duplicate reversal callback.
          console.warn('CPX postback duplicate reversal', { transId, uid });
          outcome = 'duplicate';
          return;
        }

        const previousCoins = Number.isFinite(existingData?.coins) ? existingData.coins : 0;
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
            status: 'reversed',
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
      }
    });

    console.log('✅ TRANSACTION COMPLETE');
    return res.status(200).json({ success: true, outcome });
  } catch (err) {
    console.error('CPX POSTBACK ERROR', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// Reminder: CPX postbacks currently use 100 coins per USD.
// TESTING:
// - Trigger CPX test postback status=1 -> logs QUERY, CREDIT ATTEMPT, TRANSACTION COMPLETE
// - Trigger CPX test postback status=1 -> users/{uid}.coins and users/{uid}.balance increase by amount_usd*100
// - Trigger reversal status=2 for same trans_id -> coins decrease by the original credited amount (no recompute)
// - Confirm offerwall_transactions/{trans_id} records uid, coins, credited/reversed flags
