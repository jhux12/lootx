import { admin, adminAuth, firestore } from './_lib/firebaseAdmin.js';
import { requireActiveAccount } from './_utils/auth.js';
import { computeRoll, pickPrizeByWeight, randomSeed, sha256 } from './_lib/provablyFair.js';
import { getBearerToken, readJsonBody, sendJson } from './_lib/http.js';
import { normalizeEconomySettings, getXpCost } from './_lib/economy.js';
import { appendLedgerEntry } from './_lib/ledger.js';
import { applySpendAndRewards, getRewardsSettings } from './_lib/rewards.js';
import { recordBalanceChange } from './_lib/balanceAudit.js';
import { consumeRateLimit, getRateLimitKey } from './_utils/ratelimit.js';
import { sendMetaEvent } from './_lib/metaCapi.js';
import { markReferralFirstGameQualified } from './_lib/referrals.js';

const DEFAULT_CLIENT_SEED = 'pullz-player';
const DEFAULT_NEW_USER_COINS = 0;

const normalizeSizes = (sizes = []) =>
  sizes
    .filter((size) => typeof size === 'string')
    .map((size) => size.trim())
    .filter(Boolean);

const pickRandomSize = (sizes = []) => sizes[Math.floor(Math.random() * sizes.length)];

const toFiniteNumber = (value, fallback = 0) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
};

const toSafeNonNegativeNumber = (value, fallback = 0) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(0, numeric);
};

const toSafeMultiplier = (value, fallback = 1) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(0, numeric);
};

const fail = (status, error, message, details = {}) => {
  throw { status, error, message, ...details };
};

function sanitizeForFirestore(obj) {
  return Object.fromEntries(
    Object.entries(obj).filter(([, value]) => value !== undefined)
  );
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return sendJson(res, 405, { error: 'INVALID_REQUEST', message: 'Only POST is allowed for this endpoint.' });
  }

  let uid = null;
  let requestBoxId = null;

  try {
    const token = getBearerToken(req);
    if (!token) {
      return sendJson(res, 401, { error: 'AUTH_REQUIRED', message: 'Please log in to open a case.' });
    }

    const decoded = await adminAuth.verifyIdToken(token);
    await requireActiveAccount(decoded.uid);
    uid = decoded.uid;
    const rateLimit = consumeRateLimit({
      key: getRateLimitKey({ req, uid: decoded.uid, prefix: 'open-case' }),
      limit: 30,
      windowMs: 60_000
    });
    if (!rateLimit.ok) {
      return sendJson(res, 429, { ok: false, error: 'Rate limit' });
    }

    const body = await readJsonBody(req);
    const boxId = typeof body?.boxId === 'string' ? body.boxId : (typeof body?.caseId === 'string' ? body.caseId : null);
    const requestedPaymentMethod = body?.paymentMethod === 'xp' ? 'xp' : 'coins';
    const pullPassInventoryId = typeof body?.inventoryId === 'string' && body.inventoryId.trim().length
      ? body.inventoryId.trim()
      : null;
    const pullPassClaimTier = Number.isFinite(Number(body?.pullPassClaimTier))
      ? Math.max(1, Math.floor(Number(body.pullPassClaimTier)))
      : null;
    requestBoxId = boxId;
    const isFree = body?.isFree === true;
    if (!boxId || typeof boxId !== 'string') {
      return sendJson(res, 400, { error: 'INVALID_REQUEST', message: 'Missing case identifier (boxId).' });
    }

    const boxRef = firestore.collection('boxes').doc(boxId);
    const USER_BOX_EXPIRY_MS = 24 * 60 * 60 * 1000;
    const userRef = firestore.collection('users').doc(decoded.uid);
    const provablyRef = firestore.collection('provablyFair').doc(decoded.uid);
    const bonusSettingsRef = firestore.collection('settings').doc('bonus-settings');
    const economySettingsRef = firestore.collection('settings').doc('economy');
    const pullPassSettingsRef = firestore.collection('settings').doc('pullPass');
    const inventoryRef = userRef.collection('inventory').doc();
    const pullPassInventoryRef = pullPassInventoryId ? userRef.collection('inventory').doc(pullPassInventoryId) : null;
    const openRef = firestore.collection('opens').doc();
    const operationId = typeof body?.operationId === 'string' && body.operationId.trim().length
      ? body.operationId.trim()
      : openRef.id;
    const processedOpRef = userRef.collection('processedCaseOps').doc(operationId);
    const xpLedgerRef = userRef.collection('xpLedger').doc(operationId);

    let responsePayload;

    await firestore.runTransaction(async (transaction) => {
      const [boxSnap, userSnap, provablySnap, bonusSettingsSnap, economySettingsSnap, pullPassSettingsSnap, processedOpSnap, pullPassInventorySnap] = await Promise.all([
        transaction.get(boxRef),
        transaction.get(userRef),
        transaction.get(provablyRef),
        transaction.get(bonusSettingsRef),
        transaction.get(economySettingsRef),
        transaction.get(pullPassSettingsRef),
        transaction.get(processedOpRef),
        pullPassInventoryRef ? transaction.get(pullPassInventoryRef) : Promise.resolve(null)
      ]);

      if (processedOpSnap.exists) {
        fail(409, 'ALREADY_PROCESSED', 'This case open operation was already processed.', { operationId });
      }

      if (!boxSnap.exists) {
        fail(404, 'CASE_NOT_FOUND', 'Case not found.', { caseId: boxId });
      }

      const boxData = boxSnap.data() ?? {};
      const userData = userSnap.exists ? userSnap.data() ?? {} : {};
      const pullPassInventoryData = pullPassInventorySnap?.exists ? pullPassInventorySnap.data() ?? {} : null;
      const isPullPassInventoryOpen = Boolean(pullPassInventoryRef);
      const isPullPassClaimOpen = Boolean(pullPassClaimTier);
      if (isPullPassInventoryOpen) {
        if (!pullPassInventoryData) {
          fail(404, 'PULL_PASS_REWARD_NOT_FOUND', 'Pull Pass reward box not found in inventory.', { inventoryId: pullPassInventoryId });
        }
        if (pullPassInventoryData.status !== 'available' || pullPassInventoryData.openedAt) {
          fail(409, 'PULL_PASS_REWARD_ALREADY_OPENED', 'This Pull Pass reward box has already been opened.', { inventoryId: pullPassInventoryId });
        }
        if (pullPassInventoryData.source !== 'pullPassBoxReward' || pullPassInventoryData.boxId !== boxId) {
          fail(403, 'INVALID_PULL_PASS_REWARD', 'This inventory item cannot open the requested Pull Pass box.', { inventoryId: pullPassInventoryId, caseId: boxId });
        }
      }
      const pullPassClaimKey = pullPassClaimTier ? String(pullPassClaimTier) : null;
      const pullPassClaimData = pullPassClaimKey && userData.pullPassClaims && typeof userData.pullPassClaims === 'object'
        ? userData.pullPassClaims[pullPassClaimKey]
        : null;
      const activePullPassBoxClaim = userData.activePullPassBoxClaim && typeof userData.activePullPassBoxClaim === 'object'
        ? userData.activePullPassBoxClaim
        : null;
      if (isPullPassClaimOpen) {
        if (!pullPassClaimData) {
          fail(404, 'PULL_PASS_CLAIM_NOT_FOUND', 'Pull Pass box reward claim not found.', { tier: pullPassClaimTier });
        }
        if (!activePullPassBoxClaim || Number(activePullPassBoxClaim.tier) !== pullPassClaimTier || activePullPassBoxClaim.boxId !== boxId) {
          fail(403, 'INVALID_PULL_PASS_REWARD', 'This Pull Pass reward is not active for opening.', { tier: pullPassClaimTier, caseId: boxId });
        }
        if (pullPassClaimData.opened === true || pullPassClaimData.openedAt) {
          fail(409, 'PULL_PASS_REWARD_ALREADY_OPENED', 'This Pull Pass reward box has already been opened.', { tier: pullPassClaimTier });
        }
        if (pullPassClaimData.boxId !== boxId) {
          fail(403, 'INVALID_PULL_PASS_REWARD', 'This Pull Pass claim cannot open the requested box.', { tier: pullPassClaimTier, caseId: boxId });
        }
      }
      if (boxData.isUserCreated && boxData.createdAt) {
        const createdAt = typeof boxData.createdAt.toMillis === 'function'
          ? boxData.createdAt.toMillis()
          : Number(boxData.createdAt);
        if (Number.isFinite(createdAt) && Date.now() - createdAt >= USER_BOX_EXPIRY_MS) {
          fail(404, 'CASE_NOT_FOUND', 'Case not found.', { caseId: boxId });
        }
      }
      const price = toFiniteNumber(boxData.price, 0);
      const explicitPriceXp = toFiniteNumber(boxData.priceXP, 0);
      const inferredXpLegacy = Number.isFinite(explicitPriceXp) && explicitPriceXp > 0;
      const currencyType = boxData.currencyType === 'XP' || inferredXpLegacy ? 'XP' : 'COIN';
      const fallbackPriceXp = currencyType === 'XP' ? toFiniteNumber(boxData.price, 0) : 0;
      const resolvedPriceXp = Number.isFinite(explicitPriceXp) && explicitPriceXp > 0
        ? explicitPriceXp
        : fallbackPriceXp;
      const priceXP = Math.max(0, Math.floor(resolvedPriceXp));
      const rawSellBackRate = Number(
        boxData.sellBackRate ?? (boxData.isUserCreated ? 0.75 : 0.82)
      );
      const sellBackRate = Number.isFinite(rawSellBackRate)
        ? Math.min(1, Math.max(0, rawSellBackRate))
        : 0.8;
      const prizes = Array.isArray(boxData.items) ? boxData.items : (Array.isArray(boxData.prizes) ? boxData.prizes : []);
      if (!prizes.length) {
        fail(400, 'INVALID_REQUEST', 'This case has no configured prizes.', { caseId: boxId });
      }

      if (currencyType === 'COIN' && !isFree && !(isPullPassInventoryOpen || isPullPassClaimOpen) && (!Number.isFinite(price) || price <= 0)) {
        fail(400, 'INVALID_REQUEST', 'This case does not have a valid coin price.', { caseId: boxId });
      }

      const existingFreeBoxClaim = toFiniteNumber(userData.lastFreeBoxClaim, Number.NaN);

      if (isFree) {
        if (boxData.isDaily !== true) {
          fail(400, 'INVALID_REQUEST', 'Only the signup free box can be opened for free.', { caseId: boxId });
        }
        if (Number.isFinite(existingFreeBoxClaim) && existingFreeBoxClaim > 0) {
          fail(409, 'FREE_BOX_ALREADY_CLAIMED', 'Free signup box already claimed.', {
            caseId: boxId,
            claimedAt: existingFreeBoxClaim
          });
        }
      }

      const provablyData = provablySnap.data() ?? {};
      let serverSeed = provablyData.serverSeed;
      if (!serverSeed) serverSeed = randomSeed();
      const serverSeedHash = provablyData.serverSeedHash ?? sha256(serverSeed);
      const clientSeed = typeof provablyData.clientSeed === 'string' && provablyData.clientSeed.trim().length
        ? provablyData.clientSeed
        : DEFAULT_CLIENT_SEED;
      const nonce = Number.isFinite(provablyData.nonce) ? Number(provablyData.nonce) : 0;

      const rawCoins = userSnap.exists ? (userData.coins ?? userData.balance) : undefined;
      const hasCoins = Number.isFinite(toFiniteNumber(rawCoins, Number.NaN));
      const currentCoins = hasCoins ? toFiniteNumber(rawCoins, 0) : DEFAULT_NEW_USER_COINS;
      const currentXp = Math.max(0, Math.floor(toFiniteNumber(userData.xpBalance ?? userData.xp, 0)));
      const normalizedEconomy = normalizeEconomySettings(economySettingsSnap.exists ? economySettingsSnap.data() ?? {} : {});
      const { settings: rewardsSettings } = await getRewardsSettings(transaction);
      if (!economySettingsSnap.exists) {
        transaction.set(economySettingsRef, normalizedEconomy, { merge: true });
      }
      const xpCostForCoinCase = getXpCost(price, normalizedEconomy);
      const isPullPassRewardOpen = isPullPassInventoryOpen || isPullPassClaimOpen;
      const shouldUseXpForOpen = !isPullPassRewardOpen && !isFree && currencyType === 'COIN' && requestedPaymentMethod === 'xp';
      const paidWithXp = !isPullPassRewardOpen && (currencyType === 'XP' || shouldUseXpForOpen);
      if (shouldUseXpForOpen && normalizedEconomy.xpOpenEnabled !== true) {
        fail(403, 'XP_OPEN_DISABLED', 'Opening cases with XP is currently disabled.');
      }
      const bonusSettings = bonusSettingsSnap.exists ? bonusSettingsSnap.data() ?? {} : {};
      const openCaseRule = bonusSettings?.earnRules?.openCase ?? {};
      const xpPer100CoinsWagered = toSafeNonNegativeNumber(
        bonusSettings.xpPer100CoinsWagered
          ?? bonusSettings.xpPer100Coins
          ?? openCaseRule.percentPer100Coins,
        0
      );
      const xpPerCaseOpened = toSafeNonNegativeNumber(
        bonusSettings.xpPerCaseOpened
          ?? bonusSettings.xpPerCaseOpen
          ?? openCaseRule.fixedXp,
        0
      );
      const baseXpBonus = toSafeNonNegativeNumber(bonusSettings.baseXpBonus, 0);
      const xpMultiplier = toSafeMultiplier(bonusSettings.xpMultiplier, 1);
      const xpSystemEnabled = bonusSettings.enabled === false ? false : true;
      const allowXpCaseAward = bonusSettings.awardXpForXpCases === true
        || openCaseRule.allowXpCurrency === true;

      const coinsSpent = !isPullPassRewardOpen && !isFree && currencyType === 'COIN' && !shouldUseXpForOpen ? price : 0;
      if (!Number.isFinite(coinsSpent)) {
        fail(400, 'INVALID_REQUEST', 'Invalid case price for XP calculation.', { caseId: boxId });
      }
      const xpFromSpend = Math.floor((Math.max(0, coinsSpent) / 100) * xpPer100CoinsWagered);
      const shouldAwardForOpenType = !paidWithXp || allowXpCaseAward;
      const pullPassSettings = pullPassSettingsSnap.exists ? pullPassSettingsSnap.data() ?? {} : {};
      const pullPassStartsAt = typeof pullPassSettings.startsAt === 'string' && pullPassSettings.startsAt
        ? new Date(pullPassSettings.startsAt).getTime()
        : null;
      const pullPassEndsAt = typeof pullPassSettings.endsAt === 'string' && pullPassSettings.endsAt
        ? new Date(pullPassSettings.endsAt).getTime()
        : null;
      const pullPassIsActive = pullPassSettings.enabled !== false
        && (!Number.isFinite(pullPassStartsAt) || Date.now() >= pullPassStartsAt)
        && (!Number.isFinite(pullPassEndsAt) || Date.now() <= pullPassEndsAt);
      const pullPassLastResetAt = Math.max(0, Math.floor(toSafeNonNegativeNumber(pullPassSettings.lastResetAt, 0)) || 0);
      const userPullPassResetAt = Math.max(0, Math.floor(toSafeNonNegativeNumber(userData.pullPassResetAt, 0)) || 0);
      const shouldResetUserPullPassBeforeAward = pullPassLastResetAt > userPullPassResetAt;
      const pullPassCoinsPerXp = Math.max(1, Math.floor(toSafeNonNegativeNumber(pullPassSettings.coinsPerXp, 10)) || 10);
      const pullPassXpAward = pullPassIsActive && coinsSpent > 0
        ? Math.floor(Math.max(0, coinsSpent) / pullPassCoinsPerXp)
        : 0;
      const xpFromOpen = !isFree && shouldAwardForOpenType ? xpPerCaseOpened : 0;
      const totalXpAward = xpSystemEnabled && shouldAwardForOpenType
        ? Math.max(0, Math.floor((xpFromSpend + xpFromOpen + baseXpBonus) * xpMultiplier))
        : 0;

      if (!isPullPassRewardOpen && (currencyType === 'XP' || shouldUseXpForOpen)) {
        const requiredXp = currencyType === 'XP' ? priceXP : xpCostForCoinCase;
        if (!Number.isInteger(priceXP) || priceXP <= 0) {
          if (currencyType === 'XP') {
            fail(400, 'INVALID_REQUEST', 'This XP case is missing a valid XP price.', { caseId: boxId });
          }
        }
        if (currentXp < requiredXp) {
          fail(402, 'INSUFFICIENT_FUNDS', 'Not enough XP to open this case.', {
            currencyType: shouldUseXpForOpen ? 'XP' : currencyType,
            caseId: boxId,
            xpBalance: currentXp,
            priceXP: requiredXp
          });
        }
      } else if (!isPullPassRewardOpen && !isFree && currentCoins < price) {
        fail(402, 'INSUFFICIENT_FUNDS', 'Not enough coins to open this case.', {
          currencyType: paidWithXp ? 'XP' : currencyType,
          caseId: boxId,
          coins: currentCoins,
          price
        });
      }

      const { roll, rollHash, message } = computeRoll(serverSeed, clientSeed, nonce, boxId);
      const prize = pickPrizeByWeight(prizes, roll);
      const prizeForcesFullSellBack = prize?.forceFullSellBack === true;
      const appliedSellBackRate = isFree || prizeForcesFullSellBack ? 1 : sellBackRate;
      const sizeOptions = normalizeSizes(prize.sizes ?? []);
      const selectedSize = sizeOptions.length ? pickRandomSize(sizeOptions) : null;
      const prizeValue = Number(prize.value ?? prize.price ?? 0);
      const resolvedXpCost = currencyType === 'XP' ? priceXP : xpCostForCoinCase;
      const coinCost = currencyType === 'COIN' && !isPullPassRewardOpen && !isFree && !shouldUseXpForOpen ? price : 0;
      let newCoins = currentCoins;
      let newXpBalance = currentXp;
      let balanceState = {
        ...userData,
        coins: currentCoins,
        balance: currentCoins,
        xpBalance: currentXp,
        xp: currentXp
      };

      const freeBoxClaimedAt = isFree ? Date.now() : null;
      const nextUserPatch = sanitizeForFirestore({
        ...(!userSnap.exists ? { createdAt: admin.firestore.FieldValue.serverTimestamp() } : {}),
        ...(isFree ? { lastFreeBoxClaim: freeBoxClaimedAt } : {})
      });

      if (coinCost > 0) {
        const result = await recordBalanceChange({
          transaction,
          uid: decoded.uid,
          userRef,
          userData: balanceState,
          currency: 'coins',
          amount: -coinCost,
          reason: 'case_open_cost',
          actorType: 'user',
          actorUid: decoded.uid,
          source: 'api/open-case',
          relatedId: openRef.id,
          metadata: { boxId, paymentMethod: 'coins', caseName: boxData.name ?? 'Mystery Box' }
        });
        newCoins = result.balanceAfter;
        balanceState = result.userData;
      }

      if (paidWithXp) {
        const spendResult = await recordBalanceChange({
          transaction,
          uid: decoded.uid,
          userRef,
          userData: balanceState,
          currency: 'xp',
          amount: -resolvedXpCost,
          reason: 'case_open_cost',
          actorType: 'user',
          actorUid: decoded.uid,
          source: 'api/open-case',
          relatedId: openRef.id,
          metadata: { boxId, paymentMethod: 'xp', caseName: boxData.name ?? 'Mystery Box' }
        });
        newXpBalance = spendResult.balanceAfter;
        balanceState = spendResult.userData;
      }

      transaction.set(userRef, nextUserPatch, { merge: true });
      const today = new Date().toISOString().slice(0, 10);
      const priorDay = typeof userData.challengeStatsDay === 'string' ? userData.challengeStatsDay : '';
      const priorStats = priorDay === today && userData.challengeStats && typeof userData.challengeStats === 'object'
        ? userData.challengeStats
        : {};
      const rarityKey = String(prize.rarity ?? 'common').toLowerCase();
      const nextChallengeStats = {
        boxesOpened: Math.max(0, Number(priorStats.boxesOpened ?? 0)) + 1,
        sellBackItems: Math.max(0, Number(priorStats.sellBackItems ?? 0)),
        sellBackCoins: Math.max(0, Number(priorStats.sellBackCoins ?? 0)),
        upgraderUses: Math.max(0, Number(priorStats.upgraderUses ?? 0)),
        rarityUnboxed: {
          ...(priorStats.rarityUnboxed ?? {}),
          [rarityKey]: Math.max(0, Number(priorStats.rarityUnboxed?.[rarityKey] ?? 0)) + 1
        }
      };
      transaction.set(userRef, {
        challengeStatsDay: today,
        challengeStats: nextChallengeStats
      }, { merge: true });

      if (coinCost > 0) {
        appendLedgerEntry({
          transaction,
          userRef,
          userData,
          entry: {
            id: openRef.id,
            userId: decoded.uid,
            type: 'case_open',
            amount: -coinCost,
            createdAt: Date.now(),
            balanceAfter: newCoins,
            sourceId: openRef.id,
            memo: `Opened ${boxData.name ?? 'Mystery Box'}`,
            prizeName: prize.name ?? 'Mystery Item',
            prizeImage: prize.image ?? ''
          }
        });
        await applySpendAndRewards({
          transaction,
          uid: decoded.uid,
          userRef,
          coinsSpent: coinCost,
          context: 'case_open',
          referenceId: openRef.id,
          userData,
          rewardsSettings
        });
      }

      if (totalXpAward > 0) {
        const xpAwardResult = await recordBalanceChange({
          transaction,
          uid: decoded.uid,
          userRef,
          userData: balanceState,
          currency: 'xp',
          amount: totalXpAward,
          reason: 'case_open_xp_reward',
          actorType: 'system',
          actorUid: null,
          source: 'api/open-case',
          relatedId: openRef.id,
          metadata: { boxId, coinCost, xpCost: paidWithXp ? resolvedXpCost : 0 }
        });
        newXpBalance = xpAwardResult.balanceAfter;
        balanceState = xpAwardResult.userData;
        const dateKey = new Date().toISOString().slice(0, 10);
        transaction.update(userRef, {
          xpEarnedLifetime: admin.firestore.FieldValue.increment(totalXpAward),
          [`xpDailyEarned.${dateKey}`]: admin.firestore.FieldValue.increment(totalXpAward),
          lastXpAwardAction: 'openCase',
          lastXpAwardAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }

      if (pullPassXpAward > 0) {
        const pullPassAwardPatch = shouldResetUserPullPassBeforeAward
          ? {
              pullPassSeasonXp: pullPassXpAward,
              pullPassXp: pullPassXpAward,
              pullPassClaims: {},
              pullPass: admin.firestore.FieldValue.delete(),
              activePullPassBoxClaim: admin.firestore.FieldValue.delete(),
              pullPassResetAt: pullPassLastResetAt,
              pullPassLastXpAwardAt: admin.firestore.FieldValue.serverTimestamp()
            }
          : {
              pullPassSeasonXp: admin.firestore.FieldValue.increment(pullPassXpAward),
              pullPassXp: admin.firestore.FieldValue.increment(pullPassXpAward),
              pullPassLastXpAwardAt: admin.firestore.FieldValue.serverTimestamp()
            };
        transaction.set(userRef, pullPassAwardPatch, { merge: true });
      }

      transaction.set(provablyRef, {
        serverSeed,
        serverSeedHash,
        clientSeed,
        nonce: nonce + 1
      }, { merge: true });

      const obtainedAt = admin.firestore.FieldValue.serverTimestamp();
      const inventoryPayload = {
        boxId,
        acquisitionCurrencyType: currencyType,
        openCurrencyType: paidWithXp ? 'XP' : currencyType,
        prizeId: prize.id ?? null,
        name: prize.name ?? 'Mystery Item',
        value: prizeValue,
        image: prize.image ?? '',
        rarity: prize.rarity ?? 'common',
        status: 'available',
        obtainedAt,
        sellBackRate: appliedSellBackRate,
        redeemable: prize.redeemable ?? true,
        forceFullSellBack: prizeForcesFullSellBack
      };
      if (selectedSize) {
        inventoryPayload.size = selectedSize;
      }
      transaction.set(inventoryRef, inventoryPayload);
      if (pullPassInventoryRef) {
        transaction.set(pullPassInventoryRef, {
          status: 'opened',
          openedAt: obtainedAt,
          openedCaseId: boxId,
          openedInventoryId: inventoryRef.id,
          updatedAt: obtainedAt
        }, { merge: true });
      }
      if (pullPassClaimKey && pullPassClaimData) {
        transaction.set(userRef, {
          pullPassClaims: {
            ...(userData.pullPassClaims ?? {}),
            [pullPassClaimKey]: {
              ...pullPassClaimData,
              opened: true,
              openedAt: Date.now(),
              openedInventoryId: inventoryRef.id
            }
          },
          activePullPassBoxClaim: admin.firestore.FieldValue.delete(),
          updatedAt: Date.now()
        }, { merge: true });
      }

      const openPayload = {
        uid: decoded.uid,
        boxId,
        boxName: boxData.name ?? 'Mystery Box',
        price,
        priceXP: paidWithXp ? resolvedXpCost : null,
        currencyType: paidWithXp ? 'XP' : currencyType,
        paymentMethod: paidWithXp ? 'xp' : 'coins',
        prize: {
          id: prize.id ?? null,
          name: prize.name ?? 'Mystery Item',
          value: prizeValue,
          image: prize.image ?? '',
          rarity: prize.rarity ?? 'common',
          weight: Number(prize.weight ?? prize.chance ?? 0),
          redeemable: prize.redeemable ?? true,
          forceFullSellBack: prizeForcesFullSellBack,
          size: selectedSize || null
        },
        createdAt: obtainedAt,
        provablyFair: {
          serverSeedHash,
          clientSeed,
          nonce,
          roll
        }
      };
      transaction.set(openRef, openPayload);

      if (paidWithXp) {
        const transactionRef = userRef.collection('transactions').doc();
        transaction.set(transactionRef, {
          type: 'case_open_xp',
          caseId: boxId,
          openId: openRef.id,
          amountXp: resolvedXpCost,
          paymentMethod: 'xp',
          createdAt: obtainedAt
        });
      }

      if (totalXpAward > 0) {
        transaction.set(xpLedgerRef, {
          type: 'CASE_OPEN',
          operationId,
          coinsSpent,
          xpAward: totalXpAward,
          caseId: boxId,
          createdAt: obtainedAt
        }, { merge: true });
      }

      responsePayload = {
        ok: true,
        price,
        priceXP: paidWithXp ? resolvedXpCost : null,
        currencyType: paidWithXp ? 'XP' : currencyType,
        paymentMethod: paidWithXp ? 'xp' : 'coins',
        prize: {
          ...prize,
          price: prizeValue,
          value: prizeValue,
          redeemable: prize.redeemable ?? true,
          forceFullSellBack: prizeForcesFullSellBack,
          size: selectedSize || undefined
        },
        freeBoxClaimedAt: freeBoxClaimedAt ?? undefined,
        sellBackRate: appliedSellBackRate,
        newCoinBalance: newCoins,
        newCoins,
        newXpBalance,
        xpAwarded: totalXpAward,
        pullPassXpAwarded: pullPassXpAward,
        xpSettingsUsed: {
          xpPer100: xpPer100CoinsWagered,
          xpPerOpen: xpPerCaseOpened,
          baseXpBonus,
          xpMultiplier,
          enabled: xpSystemEnabled,
          allowXpCaseAward
        },
        inventoryId: inventoryRef.id,
        openId: openRef.id,
        operationId,
        provablyFair: {
          serverSeedHash,
          clientSeed,
          nonce,
          roll,
          rollHash,
          message
        }
      };

      const cleanPrize = sanitizeForFirestore(responsePayload.prize ?? {});
      const cleanResponsePayload = sanitizeForFirestore({
        ...responsePayload,
        prize: cleanPrize
      });

      transaction.set(processedOpRef, {
        operationId,
        uid: decoded.uid,
        boxId,
        openId: openRef.id,
        xpAwarded: totalXpAward,
        createdAt: obtainedAt,
        responsePayload: cleanResponsePayload
      });

      console.info('open-case xp-award', {
        uid: decoded.uid,
        operationId,
        boxId,
        currencyType,
        paymentMethod: paidWithXp ? 'xp' : 'coins',
        coinsSpent,
        xpPer100CoinsWagered,
        xpPerCaseOpened,
        pullPassCoinsPerXp,
        pullPassXpAward,
        baseXpBonus,
        xpMultiplier,
        xpSystemEnabled,
        allowXpCaseAward,
        xpAwarded: totalXpAward
      });
    });


    try {
      if (responsePayload && responsePayload.isFree !== true) {
        await markReferralFirstGameQualified({ referredUid: uid });
      }
    } catch (referralError) {
      console.error('open-case failed to evaluate referral game qualification', referralError);
    }

    const sourceBoxId = requestBoxId || 'unknown';
    const openBoxEventId = `openbox_${uid}_${responsePayload?.openId ?? Date.now()}`;

    try {
      const metaResult = await sendMetaEvent({
        req,
        event_name: 'OpenBox',
        event_id: openBoxEventId,
        event_source_url: `${process.env.APP_URL}/case/${sourceBoxId}`,
        user: {
          email: decoded?.email,
          phone: decoded?.phone_number,
          external_id: uid
        },
        custom_data: {
          box_id: sourceBoxId,
          box_name: responsePayload?.boxName ?? undefined,
          currency: 'USD',
          value: Number(responsePayload?.price ?? 0) || 0,
          prize_name: responsePayload?.prize?.name ?? undefined
        },
        test_event_code: process.env.META_TEST_EVENT_CODE
      });

      if (!metaResult.ok && !metaResult.skipped) {
        console.warn('open-case meta OpenBox event failed', {
          openBoxEventId,
          status: metaResult.status,
          error: metaResult.error
        });
      }
    } catch (metaError) {
      console.error('open-case meta OpenBox event error', {
        openBoxEventId,
        message: metaError?.message
      });
    }

    return sendJson(res, 200, responsePayload);
  } catch (error) {
    const status = Number(error?.status) || 500;
    const errorCode = typeof error?.error === 'string'
      ? error.error
      : (status === 401 ? 'AUTH_REQUIRED' : (status === 404 ? 'CASE_NOT_FOUND' : 'INTERNAL_ERROR'));
    const message = typeof error?.message === 'string'
      ? error.message
      : 'An unexpected error occurred while opening this case.';

    console.error('open-case failed', {
      uid,
      caseId: requestBoxId,
      where: errorCode,
      status,
      currencyType: error?.currencyType,
      price: error?.price ?? error?.priceXP,
      details: error?.details ?? null
    });

    return sendJson(res, status, {
      error: errorCode,
      message
    });
  }
}
