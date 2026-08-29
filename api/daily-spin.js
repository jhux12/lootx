import { admin, adminAuth, firestore } from './_lib/firebaseAdmin.js';
import { recordBalanceChange } from './_lib/balanceAudit.js';
import { requireVerifiedPhone } from './_utils/phoneVerification.js';

const BONUS_SETTINGS_DOC = 'bonus-settings';
const SPIN_COOLDOWN_MS = 24 * 60 * 60 * 1000;
const DEFAULT_REWARD_TIERS = [
  { name: 'Starter Box', spendRequired: 0, rewardCoins: 25 },
  { name: 'Silver Box', spendRequired: 2500, rewardCoins: 50 },
  { name: 'Gold Box', spendRequired: 10000, rewardCoins: 100 },
  { name: 'Diamond Box', spendRequired: 50000, rewardCoins: 250 }
];

const extractBearerToken = (authorizationHeader) => {
  if (!authorizationHeader) return null;
  const [scheme, token] = authorizationHeader.split(' ');
  if (scheme !== 'Bearer' || !token) return null;
  return token;
};

const getRewardTier = (settings, totalSpent) => {
  const source = Array.isArray(settings.dailyRewardTiers) ? settings.dailyRewardTiers : DEFAULT_REWARD_TIERS;
  const tiers = source.map((tier, index) => ({
    name: typeof tier?.name === 'string' && tier.name.trim() ? tier.name.trim() : `Tier ${index + 1}`,
    spendRequired: Math.max(0, Math.floor(Number(tier?.spendRequired) || 0)),
    rewardCoins: Math.max(1, Math.floor(Number(tier?.rewardCoins) || 1))
  })).sort((a, b) => a.spendRequired - b.spendRequired);
  return tiers.filter((tier) => totalSpent >= tier.spendRequired).at(-1) || tiers[0] || DEFAULT_REWARD_TIERS[0];
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED', message: 'Only POST is allowed.' });
  }

  try {
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

      const lastDailyClaim = Number(userData.lastDailyClaim ?? 0);
      const nextClaimAt = lastDailyClaim + SPIN_COOLDOWN_MS;

      if (Number.isFinite(lastDailyClaim) && lastDailyClaim > 0 && nextClaimAt > now) {
        throw Object.assign(new Error('Your daily free box is not ready yet.'), {
          status: 429,
          code: 'DAILY_REWARD_COOLDOWN',
          nextClaimAt
        });
      }

      const hasDeposited = Number(userData.depositCount ?? 0) > 0 || Number(userData.totalDepositedCents ?? 0) > 0 || Number(userData.totalSpent ?? 0) > 0;
      if (!hasDeposited) {
        throw Object.assign(new Error('Make a deposit to unlock daily free boxes.'), { status: 403, code: 'DEPOSIT_REQUIRED' });
      }
      const tier = getRewardTier(bonusSettings, Math.max(0, Number(userData.totalSpent ?? 0)));
      const prizeAmount = tier.rewardCoins;

      await recordBalanceChange({
        transaction,
        uid,
        userRef,
        userData,
        currency: 'coins',
        amount: prizeAmount,
        reason: 'daily_free_box_reward',
        actorType: 'system',
        actorUid: null,
        source: 'api/daily-spin',
        relatedId: null,
        metadata: { action: 'open', tier: tier.name, spendRequired: tier.spendRequired }
      });
      transaction.set(
        userRef,
        {
          lastDailyClaim: now,
          dailySpinPending: admin.firestore.FieldValue.delete(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        },
        { merge: true }
      );

      return {
        prizeAmount,
        nextClaimAt: now + SPIN_COOLDOWN_MS,
        claimed: true,
        tier
      };
    });

    return res.status(200).json(result);
  } catch (error) {
    const status = Number(error?.status) || 500;
    const code = error?.code || 'DAILY_REWARD_FAILED';
    const message = typeof error?.message === 'string' ? error.message : 'Unable to open daily reward box.';
    const payload = { error: code, message };

    if (error?.nextClaimAt) {
      payload.nextClaimAt = Number(error.nextClaimAt);
    }

    return res.status(status).json(payload);
  }
}
