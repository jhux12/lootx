import { admin, firestore } from './firebaseAdmin.js';

const DEFAULT_REWARDS_SETTINGS = {
  enabled: true,
  pointsPerCoinSpent: 1,
  seasonEndsAt: null,
  rewardRules: {
    payoutType: 'none',
    payoutsByRank: [],
    payoutsByPoints: []
  }
};

const toNumber = (value, fallback = 0) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
};

const toSeasonId = (seasonEndsAt) => {
  if (typeof seasonEndsAt === 'number' && Number.isFinite(seasonEndsAt) && seasonEndsAt > 0) {
    return `season_${new Date(seasonEndsAt).toISOString().slice(0, 10)}`;
  }
  return 'season_open';
};

const normalizeRewardRule = (rewardRules = {}) => {
  const payoutType = ['coins', 'xp', 'item', 'none'].includes(rewardRules?.payoutType)
    ? rewardRules.payoutType
    : 'none';

  const normalizeRankEntries = (Array.isArray(rewardRules?.payoutsByRank) ? rewardRules.payoutsByRank : [])
    .map((entry) => ({
      minRank: Math.max(1, Math.floor(toNumber(entry?.minRank, 0))),
      maxRank: Math.max(1, Math.floor(toNumber(entry?.maxRank, 0))),
      rewardAmountCoins: Math.max(0, Math.floor(toNumber(entry?.rewardAmountCoins, 0))),
      rewardAmountXP: Math.max(0, Math.floor(toNumber(entry?.rewardAmountXP, 0))),
      rewardItemId: typeof entry?.rewardItemId === 'string' ? entry.rewardItemId : ''
    }))
    .filter((entry) => entry.minRank > 0 && entry.maxRank >= entry.minRank);

  const normalizePointEntries = (Array.isArray(rewardRules?.payoutsByPoints) ? rewardRules.payoutsByPoints : [])
    .map((entry) => ({
      minPoints: Math.max(0, Math.floor(toNumber(entry?.minPoints, 0))),
      rewardAmountCoins: Math.max(0, Math.floor(toNumber(entry?.rewardAmountCoins, 0))),
      rewardAmountXP: Math.max(0, Math.floor(toNumber(entry?.rewardAmountXP, 0)))
    }))
    .sort((a, b) => b.minPoints - a.minPoints);

  return {
    payoutType,
    payoutsByRank: normalizeRankEntries,
    payoutsByPoints: normalizePointEntries
  };
};

export const normalizeRewardsSettings = (rawSettings = {}) => {
  const seasonEndsValue = rawSettings?.seasonEndsAt;
  const seasonEndsAt =
    typeof seasonEndsValue?.toMillis === 'function'
      ? seasonEndsValue.toMillis()
      : (typeof seasonEndsValue === 'number' && Number.isFinite(seasonEndsValue) ? seasonEndsValue : null);

  return {
    enabled: rawSettings?.enabled !== false,
    pointsPerCoinSpent: Math.max(0, toNumber(rawSettings?.pointsPerCoinSpent, 1)),
    seasonEndsAt,
    seasonId: toSeasonId(seasonEndsAt),
    rewardRules: normalizeRewardRule(rawSettings?.rewardRules)
  };
};

export const getRewardsSettingsRef = () => firestore.collection('settings').doc('rewards');

export const getRewardsSettings = async (transaction = null) => {
  const ref = getRewardsSettingsRef();
  const snap = transaction ? await transaction.get(ref) : await ref.get();
  const normalized = normalizeRewardsSettings(snap.exists ? snap.data() ?? {} : DEFAULT_REWARDS_SETTINGS);

  if (!snap.exists && !transaction) {
    await ref.set(normalized, { merge: true });
  }

  return { settings: normalized, ref, exists: snap.exists };
};

export const applySpendAndRewards = async ({
  transaction,
  uid,
  userRef,
  coinsSpent,
  context,
  referenceId,
  userData = {},
  rewardsSettings = null
}) => {
  const spendAmount = Math.max(0, Math.floor(toNumber(coinsSpent, 0)));
  if (spendAmount <= 0) return { pointsAdded: 0, seasonId: null };

  const settings = rewardsSettings ?? (transaction ? null : (await getRewardsSettings(null)).settings);
  if (!settings) {
    throw new Error('Rewards settings must be read before writes in Firestore transactions.');
  }
  if (settings.enabled === false) return { pointsAdded: 0, seasonId: settings.seasonId };

  const pointsAdded = Math.max(0, Math.round(spendAmount * settings.pointsPerCoinSpent));
  if (pointsAdded <= 0) return { pointsAdded: 0, seasonId: settings.seasonId };

  const leaderboardUserRef = firestore
    .collection('leaderboards')
    .doc(`rewardsSeason_${settings.seasonId}`)
    .collection('users')
    .doc(uid);

  const displayName = userData.displayName || userData.name || 'Player';
  const avatarUrl = userData.avatar || userData.photoURL || '';
  const nowTs = admin.firestore.FieldValue.serverTimestamp();
  const safeContext = typeof context === 'string' && context.trim().length ? context.trim() : 'spend';

  transaction.set(userRef, {
    rewardPointsBalance: admin.firestore.FieldValue.increment(pointsAdded),
    rewardPointsSeason: admin.firestore.FieldValue.increment(pointsAdded),
    rewardPointsSeasonId: settings.seasonId,
    rewardPointsUpdatedAt: nowTs
  }, { merge: true });

  transaction.set(leaderboardUserRef, {
    uid,
    points: admin.firestore.FieldValue.increment(pointsAdded),
    updatedAt: nowTs,
    displayName,
    avatarUrl
  }, { merge: true });

  const rewardsTxnRef = userRef.collection('rewardTransactions').doc(referenceId || undefined);
  transaction.set(rewardsTxnRef, {
    uid,
    coinsSpent: spendAmount,
    pointsAdded,
    type: safeContext,
    refId: referenceId ?? rewardsTxnRef.id,
    seasonId: settings.seasonId,
    createdAt: nowTs
  }, { merge: true });

  return { pointsAdded, seasonId: settings.seasonId };
};

export { DEFAULT_REWARDS_SETTINGS };
