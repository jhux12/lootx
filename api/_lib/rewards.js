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
    // Leaderboard points are always a strict 1:1 mapping with spent coins.
    pointsPerCoinSpent: 1,
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

  const pointsAdded = spendAmount;
  if (pointsAdded <= 0) return { pointsAdded: 0, seasonId: settings.seasonId };

  const leaderboardUserRef = firestore
    .collection('leaderboards')
    .doc(`rewardsSeason_${settings.seasonId}`)
    .collection('users')
    .doc(uid);

  const displayName = userData.username || userData.displayName || userData.name || 'Player';
  const avatarUrl = userData.avatar || userData.photoURL || '';
  const hiddenFromLeaderboard = userData.hiddenFromLeaderboard === true || userData.hiddenFromPublicDisplay === true;
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
    username: displayName,
    avatarUrl,
    hiddenFromLeaderboard
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


const payoutForEntry = (settings, rank, points) => {
  const byRank = Array.isArray(settings?.rewardRules?.payoutsByRank) ? settings.rewardRules.payoutsByRank : [];
  const byPoints = Array.isArray(settings?.rewardRules?.payoutsByPoints) ? settings.rewardRules.payoutsByPoints : [];
  const rankMatch = byRank.find((entry) => rank >= Number(entry.minRank) && rank <= Number(entry.maxRank));
  const pointsMatch = [...byPoints]
    .sort((a, b) => Number(b.minPoints) - Number(a.minPoints))
    .find((entry) => points >= Number(entry.minPoints));
  const selected = rankMatch ?? pointsMatch;
  if (!selected) return { coins: 0, xp: 0, itemId: '' };
  return {
    coins: Math.max(0, Math.floor(toNumber(selected.rewardAmountCoins, 0))),
    xp: Math.max(0, Math.floor(toNumber(selected.rewardAmountXP, 0))),
    itemId: typeof selected.rewardItemId === 'string' ? selected.rewardItemId : ''
  };
};

export const settleExpiredRewardsSeason = async ({ force = false, maxUsers = 100 } = {}) => {
  const { settings } = await getRewardsSettings(null);
  if (settings.enabled === false) {
    return { settled: false, reason: 'disabled' };
  }

  const now = Date.now();
  if (!force && (!settings.seasonEndsAt || now < settings.seasonEndsAt)) {
    return { settled: false, reason: 'season_active' };
  }

  const seasonId = settings.seasonId;
  const topQuery = firestore
    .collection('leaderboards')
    .doc(`rewardsSeason_${seasonId}`)
    .collection('users')
    .orderBy('points', 'desc')
    .orderBy('updatedAt', 'asc')
    .limit(Math.max(1, Math.min(1000, Math.floor(maxUsers))));

  const topSnap = await topQuery.get();
  if (topSnap.empty) {
    await firestore.collection('settings').doc('rewards').set({
      lastSettledSeasonId: seasonId,
      rewardsSettledAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    return { settled: true, awardedUsers: 0, totalCoinsAwarded: 0, seasonId };
  }

  let totalCoinsAwarded = 0;
  let totalXpAwarded = 0;
  let awardedUsers = 0;

  const visibleLeaderboardDocs = topSnap.docs.filter((docSnap) => docSnap.data()?.hiddenFromLeaderboard !== true);

  for (let idx = 0; idx < visibleLeaderboardDocs.length; idx += 1) {
    const docSnap = visibleLeaderboardDocs[idx];
    const uid = docSnap.id;
    const points = Math.max(0, Math.floor(toNumber(docSnap.data()?.points, 0)));
    const rank = idx + 1;
    const payout = payoutForEntry(settings, rank, points);
    if (payout.coins <= 0 && payout.xp <= 0 && !payout.itemId) continue;

    const payoutRef = firestore.collection('rewardsPayouts').doc(`${seasonId}_${uid}`);
    const userRef = firestore.collection('users').doc(uid);

    const applied = await firestore.runTransaction(async (tx) => {
      const payoutSnap = await tx.get(payoutRef);
      if (payoutSnap.exists) return false;

      const userPatch = {
        rewardLastPayoutSeasonId: seasonId,
        rewardLastPayoutAt: admin.firestore.FieldValue.serverTimestamp()
      };
      if (payout.coins > 0) {
        userPatch.coins = admin.firestore.FieldValue.increment(payout.coins);
      }
      if (payout.xp > 0) {
        userPatch.xpBalance = admin.firestore.FieldValue.increment(payout.xp);
        userPatch.xp = admin.firestore.FieldValue.increment(payout.xp);
      }

      tx.set(userRef, userPatch, { merge: true });
      tx.set(payoutRef, {
        uid,
        seasonId,
        rank,
        points,
        payoutCoins: payout.coins,
        payoutXP: payout.xp,
        payoutItemId: payout.itemId || null,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        source: 'season_settlement'
      });
      return true;
    });

    if (applied) {
      awardedUsers += 1;
      totalCoinsAwarded += payout.coins;
      totalXpAwarded += payout.xp;
    }
  }

  await firestore.collection('settings').doc('rewards').set({
    lastSettledSeasonId: seasonId,
    rewardsSettledAt: admin.firestore.FieldValue.serverTimestamp(),
    rewardsLastSettlementSummary: {
      seasonId,
      awardedUsers,
      totalCoinsAwarded,
      totalXpAwarded,
      processedAt: Date.now()
    }
  }, { merge: true });

  return { settled: true, seasonId, awardedUsers, totalCoinsAwarded, totalXpAwarded };
};

export { DEFAULT_REWARDS_SETTINGS };
