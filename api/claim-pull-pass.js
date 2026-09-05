import { admin, adminAuth, firestore } from './_lib/firebaseAdmin.js';
import { getBearerToken, readJsonBody, sendJson } from './_lib/http.js';
import { recordBalanceChange } from './_lib/balanceAudit.js';

const toNumber = (value, fallback = 0) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
};

const getLocalDateValueTime = (value) => {
  if (typeof value !== 'string' || !value) return null;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
};

const getCoinAmount = (rewardName = '') => {
  const match = String(rewardName).match(/([0-9,]+)\s*coins?/i);
  return match ? Math.max(0, Number(match[1].replace(/,/g, '')) || 0) : 0;
};

const getBoxTypeForReward = (rewardName = '') => {
  const normalized = String(rewardName).toLowerCase();
  if (normalized.includes('bronze')) return 'bronze';
  if (normalized.includes('silver')) return 'silver';
  if (normalized.includes('gold collector')) return 'collector';
  if (normalized.includes('gold')) return 'gold';
  if (normalized.includes('elite')) return 'elite';
  if (normalized.includes('master')) return 'master';
  return null;
};

const fail = (status, error, message, details = {}) => {
  throw { status, error, message, ...details };
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return sendJson(res, 405, { error: 'INVALID_REQUEST', message: 'Only POST is allowed for this endpoint.' });
  }

  try {
    const token = getBearerToken(req);
    if (!token) return sendJson(res, 401, { error: 'UNAUTHENTICATED', message: 'Sign in to claim Pull Pass rewards.' });
    const decoded = await adminAuth.verifyIdToken(token);
    const body = await readJsonBody(req);
    const requestedTier = Math.max(1, Math.floor(toNumber(body?.tier, 0)));
    if (!requestedTier) return sendJson(res, 400, { error: 'INVALID_REQUEST', message: 'Missing Pull Pass tier.' });

    const settingsRef = firestore.collection('settings').doc('pullPass');
    const userRef = firestore.collection('users').doc(decoded.uid);

    let responsePayload = null;

    await firestore.runTransaction(async (transaction) => {
      const [settingsSnap, userSnap] = await Promise.all([
        transaction.get(settingsRef),
        transaction.get(userRef)
      ]);

      const settings = settingsSnap.exists ? settingsSnap.data() ?? {} : {};
      const startsAt = getLocalDateValueTime(settings.startsAt);
      const endsAt = getLocalDateValueTime(settings.endsAt);
      const now = Date.now();
      const isLive = settings.enabled !== false
        && (startsAt === null || now >= startsAt)
        && (endsAt === null || now <= endsAt);
      if (!isLive) fail(403, 'PULL_PASS_NOT_LIVE', 'Pull Pass rewards are not claimable right now.');

      const tiers = Array.isArray(settings.tiers) ? settings.tiers : [];
      const tier = tiers.find((entry) => Math.floor(toNumber(entry?.tier, 0)) === requestedTier);
      if (!tier) fail(404, 'TIER_NOT_FOUND', 'Pull Pass tier not found.', { tier: requestedTier });

      const userData = userSnap.exists ? userSnap.data() ?? {} : {};
      const lastResetAt = Math.max(0, Math.floor(toNumber(settings.lastResetAt, 0)));
      const userResetAt = Math.max(0, Math.floor(toNumber(userData.pullPassResetAt, 0)));
      const seasonXp = userResetAt >= lastResetAt
        ? Math.max(0, Math.floor(toNumber(userData.pullPassSeasonXp ?? userData.pullPassXp, 0)))
        : 0;
      const xpRequired = Math.max(0, Math.floor(toNumber(tier.xpRequired, 0)));
      if (seasonXp < xpRequired) {
        fail(403, 'TIER_LOCKED', 'You have not unlocked this Pull Pass tier yet.', { tier: requestedTier, seasonXp, xpRequired });
      }

      const rawClaims = userResetAt >= lastResetAt && userData.pullPassClaims && typeof userData.pullPassClaims === 'object'
        ? userData.pullPassClaims
        : {};
      const existingClaim = rawClaims[String(requestedTier)];
      if (existingClaim && toNumber(existingClaim.claimedAt, 0) > lastResetAt) {
        fail(409, 'ALREADY_CLAIMED', 'This Pull Pass reward was already claimed.', { tier: requestedTier });
      }

      const rewardName = typeof tier.freeReward === 'string' && tier.freeReward.trim()
        ? tier.freeReward.trim()
        : `Tier ${requestedTier} Reward`;
      const coinAmount = getCoinAmount(rewardName);
      const boxType = getBoxTypeForReward(rewardName);
      let pullPassBox = null;
      if (boxType) {
        const boxQuery = firestore.collection('boxes')
          .where('isPullPassBox', '==', true)
          .where('pullPassBoxType', '==', boxType)
          .limit(1);
        const boxSnapshot = await transaction.get(boxQuery);
        pullPassBox = boxSnapshot.docs[0] ? { id: boxSnapshot.docs[0].id, ...boxSnapshot.docs[0].data() } : null;
        if (!pullPassBox) fail(404, 'PULL_PASS_BOX_NOT_FOUND', 'No Pull Pass reward pack is configured for this reward.', { tier: requestedTier, boxType });
      }

      const claimedAt = Date.now();
      const claimPayload = {
        rewardName,
        rewardType: boxType || (coinAmount > 0 ? 'coins' : 'xp'),
        boxId: pullPassBox?.id ?? null,
        inventoryId: null,
        coinAmount,
        claimedAt,
        opened: false
      };

      let newCoinBalance = null;
      if (coinAmount > 0) {
        const currentCoins = toNumber(userData.coins ?? userData.balance, 0);
        const balanceResult = await recordBalanceChange({
          transaction,
          uid: decoded.uid,
          userRef,
          userData: { ...userData, coins: currentCoins, balance: currentCoins },
          currency: 'coins',
          amount: coinAmount,
          reason: 'pull_pass_reward',
          actorType: 'system',
          actorUid: null,
          source: 'api/claim-pull-pass',
          relatedId: `pull-pass-tier-${requestedTier}`,
          metadata: { tier: requestedTier, rewardName }
        });
        newCoinBalance = balanceResult.balanceAfter;
      }

      transaction.set(userRef, {
        pullPassSeasonXp: seasonXp,
        pullPassXp: seasonXp,
        pullPassClaims: {
          ...rawClaims,
          [String(requestedTier)]: claimPayload
        },
        ...(pullPassBox ? {
          activePullPassBoxClaim: {
            tier: requestedTier,
            boxId: pullPassBox.id,
            claimedAt,
            rewardName
          }
        } : {}),
        pullPassResetAt: Math.max(userResetAt, lastResetAt),
        updatedAt: claimedAt
      }, { merge: true });

      responsePayload = {
        ok: true,
        tier: requestedTier,
        rewardName,
        coinAmount,
        newCoinBalance,
        boxId: pullPassBox?.id ?? null,
        pullPassClaimTier: pullPassBox ? requestedTier : null
      };
    });

    return sendJson(res, 200, responsePayload);
  } catch (error) {
    const status = error?.status || 500;
    console.error('claim-pull-pass failed', error);
    return sendJson(res, status, {
      ok: false,
      error: error?.error || 'CLAIM_FAILED',
      message: error?.message || 'Unable to claim Pull Pass reward.'
    });
  }
}
