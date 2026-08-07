import { admin, adminAuth, firestore } from './_lib/firebaseAdmin.js';
import { recordBalanceChange } from './_lib/balanceAudit.js';
import { requireVerifiedPhone } from './_utils/phoneVerification.js';

const BONUS_SETTINGS_DOC = 'bonus-settings';
const SPIN_COOLDOWN_MS = 24 * 60 * 60 * 1000;
const PENDING_SPIN_TTL_MS = 10 * 60 * 1000;
const DEFAULT_PRIZES = [10, 25, 100, 500, 1000, 2500];

const sanitizeOdds = (input) => {
  const base = {};

  if (input && typeof input === 'object') {
    for (const [key, value] of Object.entries(input)) {
      const amount = Number(key);
      if (!Number.isFinite(amount) || amount <= 0) continue;
      const weight = Number(value);
      if (!Number.isFinite(weight) || weight < 0) continue;
      base[Math.floor(amount)] = weight;
    }
  }

  for (const amount of DEFAULT_PRIZES) {
    if (!(amount in base)) {
      base[amount] = 1;
    }
  }

  const entries = Object.entries(base)
    .map(([amount, weight]) => ({ amount: Number(amount), weight: Number(weight) }))
    .filter((entry) => Number.isFinite(entry.weight) && entry.weight > 0)
    .sort((a, b) => a.amount - b.amount);

  if (entries.length === 0) {
    return DEFAULT_PRIZES.map((amount) => ({ amount, weight: 1 }));
  }

  return entries;
};

const pickWeightedPrize = (entries) => {
  const totalWeight = entries.reduce((sum, entry) => sum + entry.weight, 0);
  if (totalWeight <= 0) return entries[0]?.amount ?? DEFAULT_PRIZES[0];

  let cursor = Math.random() * totalWeight;
  for (const entry of entries) {
    cursor -= entry.weight;
    if (cursor <= 0) return entry.amount;
  }

  return entries[entries.length - 1].amount;
};

const extractBearerToken = (authorizationHeader) => {
  if (!authorizationHeader) return null;
  const [scheme, token] = authorizationHeader.split(' ');
  if (scheme !== 'Bearer' || !token) return null;
  return token;
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED', message: 'Only POST is allowed.' });
  }

  try {
    const action = req.body?.action === 'claim' ? 'claim' : 'spin';
    const token = extractBearerToken(req.headers.authorization || req.headers.Authorization);
    if (!token) {
      return res.status(401).json({ error: 'UNAUTHENTICATED', message: 'Missing authorization token.' });
    }

    const decoded = await adminAuth.verifyIdToken(token);
    const uid = decoded.uid;
    await requireVerifiedPhone(adminAuth, uid);
    const userRef = firestore.collection('users').doc(uid);
    const bonusSettingsRef = firestore.collection('settings').doc(BONUS_SETTINGS_DOC);

    const result = await firestore.runTransaction(async (transaction) => {
      const [userSnap, bonusSettingsSnap] = await Promise.all([
        transaction.get(userRef),
        transaction.get(bonusSettingsRef)
      ]);

      const userData = userSnap.exists ? userSnap.data() || {} : {};
      const bonusSettings = bonusSettingsSnap.exists ? bonusSettingsSnap.data() || {} : {};
      const now = Date.now();

      const pendingSpin =
        userData.dailySpinPending && typeof userData.dailySpinPending === 'object'
          ? {
              amount: Math.floor(Number(userData.dailySpinPending.amount ?? 0)),
              createdAt: Number(userData.dailySpinPending.createdAt ?? 0),
              credited: userData.dailySpinPending.credited === true
            }
          : null;
      const hasValidPendingSpin =
        pendingSpin &&
        Number.isFinite(pendingSpin.amount) &&
        pendingSpin.amount > 0 &&
        Number.isFinite(pendingSpin.createdAt) &&
        pendingSpin.createdAt > 0 &&
        now - pendingSpin.createdAt <= PENDING_SPIN_TTL_MS;

      if (action === 'claim') {
        if (!hasValidPendingSpin) {
          throw Object.assign(new Error('No pending spin to claim.'), {
            status: 409,
            code: 'DAILY_SPIN_NOT_PENDING'
          });
        }

        const prizeAmount = pendingSpin.amount;

        if (!pendingSpin.credited) {
          await recordBalanceChange({
            transaction,
            uid,
            userRef,
            userData,
            currency: 'coins',
            amount: prizeAmount,
            reason: 'daily_spin_reward',
            actorType: 'system',
            actorUid: null,
            source: 'api/daily-spin',
            relatedId: null,
            metadata: { action: 'claim' }
          });
        }
        const claimTime = Number.isFinite(pendingSpin.createdAt) && pendingSpin.createdAt > 0 ? pendingSpin.createdAt : now;
        transaction.set(
          userRef,
          {
            lastDailyClaim: claimTime,
            dailySpinPending: admin.firestore.FieldValue.delete(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          },
          { merge: true }
        );

        return {
          prizeAmount,
          lastDailyClaim: claimTime,
          nextClaimAt: claimTime + SPIN_COOLDOWN_MS,
          claimed: true
        };
      }

      if (hasValidPendingSpin) {
        return {
          prizeAmount: pendingSpin.amount,
          nextClaimAt: pendingSpin.createdAt + SPIN_COOLDOWN_MS,
          pending: true
        };
      }

      const lastDailyClaim = Number(userData.lastDailyClaim ?? 0);
      const nextClaimAt = lastDailyClaim + SPIN_COOLDOWN_MS;

      if (Number.isFinite(lastDailyClaim) && lastDailyClaim > 0 && nextClaimAt > now) {
        throw Object.assign(new Error('Daily spin cooldown active.'), {
          status: 429,
          code: 'DAILY_SPIN_COOLDOWN',
          nextClaimAt
        });
      }

      const entries = sanitizeOdds(bonusSettings.dailySpinOdds);
      const prizeAmount = pickWeightedPrize(entries);

      await recordBalanceChange({
        transaction,
        uid,
        userRef,
        userData,
        currency: 'coins',
        amount: prizeAmount,
        reason: 'daily_spin_reward',
        actorType: 'system',
        actorUid: null,
        source: 'api/daily-spin',
        relatedId: null,
        metadata: { action: 'spin' }
      });
      transaction.set(
        userRef,
        {
          lastDailyClaim: now,
          dailySpinPending: {
            amount: prizeAmount,
            createdAt: now,
            credited: true
          },
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        },
        { merge: true }
      );

      return {
        prizeAmount,
        nextClaimAt: now + SPIN_COOLDOWN_MS,
        pending: true,
        odds: entries
      };
    });

    return res.status(200).json(result);
  } catch (error) {
    const status = Number(error?.status) || 500;
    const code = error?.code || 'DAILY_SPIN_FAILED';
    const message = typeof error?.message === 'string' ? error.message : 'Unable to complete daily spin.';
    const payload = { error: code, message };

    if (error?.nextClaimAt) {
      payload.nextClaimAt = Number(error.nextClaimAt);
    }

    return res.status(status).json(payload);
  }
}
