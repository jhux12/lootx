import { admin, adminAuth, firestore } from './_lib/firebaseAdmin.js';
import { getBearerToken, readJsonBody, sendJson } from './_lib/http.js';
import { randomSeed, sha256 } from './_lib/provablyFair.js';
import { applySpendAndRewards, getRewardsSettings } from './_lib/rewards.js';
import { markReferralFirstGameQualified } from './_lib/referrals.js';

const DEFAULTS = {
  enabled: true,
  rows: 16,
  minBet: 100,
  maxBet: 50000,
  cooldownMs: 1200,
  houseEdgeMultiplier: 0.92,
  activeBoardId: 'medium',
  allowFromFreeBox: false,
  allowFromPromo: false
};

const toNumber = (value, fallback = 0) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
};

const toSafeString = (value, fallback = '') => (typeof value === 'string' && value.trim() ? value.trim() : fallback);

const hashToBits = (hashHex, rows) => {
  const bits = [];
  for (let i = 0; i < hashHex.length && bits.length < rows; i += 1) {
    const nibble = parseInt(hashHex[i], 16);
    bits.push((nibble >> 3) & 1, (nibble >> 2) & 1, (nibble >> 1) & 1, nibble & 1);
  }
  return bits.slice(0, rows);
};

const weightedPick = (items, seedHex) => {
  const normalized = items
    .map((item) => ({ ...item, weight: Math.max(1, Number(item.weight ?? 1)) }))
    .sort((a, b) => String(a.id).localeCompare(String(b.id)));

  const total = normalized.reduce((sum, item) => sum + item.weight, 0);
  const cursor = parseInt(seedHex.slice(0, 13), 16) / 0x10000000000000;
  let threshold = cursor * total;
  for (const item of normalized) {
    if (threshold < item.weight) return item;
    threshold -= item.weight;
  }
  return normalized[normalized.length - 1];
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return sendJson(res, 405, { error: 'INVALID_REQUEST', message: 'Only POST is allowed for this endpoint.' });
  }

  try {
    const token = getBearerToken(req);
    if (!token) {
      return sendJson(res, 401, { error: 'AUTH_REQUIRED', message: 'Please log in to play Plinko.' });
    }

    const decoded = await adminAuth.verifyIdToken(token);
    const body = await readJsonBody(req);
    const bet = Math.floor(toNumber(body?.bet, 0));
    const clientSeed = toSafeString(body?.clientSeed, `${Date.now()}`);

    const settingsRef = firestore.collection('settings').doc('plinko');
    const userRef = firestore.collection('users').doc(decoded.uid);
    const dropRef = firestore.collection('plinkoDrops').doc();

    let responsePayload = null;

    await firestore.runTransaction(async (transaction) => {
      const [settingsSnap, userSnap] = await Promise.all([
        transaction.get(settingsRef),
        transaction.get(userRef)
      ]);

      const settingsData = settingsSnap.exists ? settingsSnap.data() ?? {} : {};
      const { settings: rewardsSettings } = await getRewardsSettings(transaction);
      const settings = {
        ...DEFAULTS,
        ...settingsData,
        rows: Math.max(8, Math.min(24, Math.round(toNumber(settingsData.rows, DEFAULTS.rows))))
      };

      if (settings.enabled === false) {
        throw new Error('Plinko is currently disabled.');
      }

      if (!Number.isFinite(bet) || bet < settings.minBet || bet > settings.maxBet) {
        throw new Error(`Bet must be between ${settings.minBet} and ${settings.maxBet}.`);
      }

      const boardRef = firestore.collection('plinkoBoards').doc(settings.activeBoardId);
      const boardSnap = await transaction.get(boardRef);
      if (!boardSnap.exists) {
        throw new Error('Active Plinko board is not configured.');
      }

      const boardData = boardSnap.data() ?? {};
      const rows = Math.max(8, Math.min(24, Math.round(toNumber(boardData.rows, settings.rows))));
      const slots = Array.isArray(boardData.slots) ? boardData.slots : [];

      const userData = userSnap.exists ? userSnap.data() ?? {} : {};
      const currentCoins = Math.max(0, Math.floor(toNumber(userData.coins, 0)));
      const lastPlinkoAt = Math.max(0, Math.floor(toNumber(userData.lastPlinkoAt, 0)));
      if (settings.cooldownMs > 0 && Date.now() - lastPlinkoAt < settings.cooldownMs) {
        throw new Error('Plinko cooldown is active. Please wait a moment.');
      }
      if (currentCoins < bet) {
        throw new Error('Not enough coins to drop.');
      }

      const nonce = Math.max(0, Math.floor(toNumber(userData.plinkoNonce, 0)));
      let serverSeed = toSafeString(settingsData.serverSeed, '');
      if (!serverSeed) serverSeed = randomSeed();
      const serverSeedHash = toSafeString(settingsData.serverSeedHash, sha256(serverSeed));

      const hashInput = `${serverSeed}:${decoded.uid}:${clientSeed}:${nonce}:plinko`;
      const rollHash = sha256(hashInput);
      const pathBits = hashToBits(rollHash, rows);
      const slotIndex = pathBits.reduce((sum, bit) => sum + (bit === 1 ? 1 : 0), 0);
      const slotConfig = slots[slotIndex];
      if (!slotConfig || slotConfig.enabled === false) {
        throw new Error('Selected slot is unavailable on this board.');
      }

      const minValue = Math.max(0, bet * toNumber(slotConfig.minMult, 0) * toNumber(settings.houseEdgeMultiplier, DEFAULTS.houseEdgeMultiplier));
      const maxValue = Math.max(minValue, bet * toNumber(slotConfig.maxMult, 0) * toNumber(settings.houseEdgeMultiplier, DEFAULTS.houseEdgeMultiplier));

      const poolId = toSafeString(slotConfig.poolId, 'default');
      const poolItemsRef = firestore.collection('plinkoPools').doc(poolId).collection('items');
      const poolItemsSnap = await transaction.get(poolItemsRef);
      const enabledItems = poolItemsSnap.docs
        .map((docSnap) => ({ id: docSnap.id, ...(docSnap.data() ?? {}) }))
        .filter((item) => item.enabled !== false);

      if (!enabledItems.length) {
        throw new Error(`No enabled items found in pool: ${poolId}`);
      }

      const inBand = enabledItems.filter((item) => {
        const value = toNumber(item.coinValue, 0);
        return value >= minValue && value <= maxValue;
      });

      const pickSource = inBand.length ? inBand : [...enabledItems].sort((a, b) => {
        const aDistance = Math.abs(toNumber(a.coinValue, 0) - (minValue + maxValue) / 2);
        const bDistance = Math.abs(toNumber(b.coinValue, 0) - (minValue + maxValue) / 2);
        if (aDistance === bDistance) return String(a.id).localeCompare(String(b.id));
        return aDistance - bDistance;
      }).slice(0, Math.min(10, enabledItems.length));

      const awardedItem = weightedPick(pickSource, sha256(`${rollHash}:item`));
      const newCoins = currentCoins - bet;
      const obtainedAt = admin.firestore.FieldValue.serverTimestamp();
      const inventoryRef = userRef.collection('inventory').doc();

      transaction.set(userRef, {
        coins: newCoins,
        plinkoNonce: nonce + 1,
        lastPlinkoAt: Date.now()
      }, { merge: true });

      await applySpendAndRewards({
        transaction,
        uid: decoded.uid,
        userRef,
        coinsSpent: bet,
        context: 'plinko_drop',
        referenceId: dropRef.id,
        userData,
        rewardsSettings
      });

      transaction.set(settingsRef, {
        serverSeed,
        serverSeedHash,
        updatedAt: Date.now()
      }, { merge: true });

      const awardedSnapshot = {
        itemId: awardedItem.id,
        name: toSafeString(awardedItem.name, 'Mystery Item'),
        imageUrl: toSafeString(awardedItem.imageUrl, ''),
        coinValue: Math.max(0, toNumber(awardedItem.coinValue, 0)),
        rarity: toSafeString(awardedItem.rarity, 'common'),
        category: toSafeString(awardedItem.category, ''),
        sellBackRate: 0.82
      };

      transaction.set(inventoryRef, {
        name: awardedSnapshot.name,
        image: awardedSnapshot.imageUrl,
        value: awardedSnapshot.coinValue,
        rarity: awardedSnapshot.rarity,
        category: awardedSnapshot.category,
        status: 'available',
        obtainedAt,
        redeemable: true,
        sellBackRate: awardedSnapshot.sellBackRate,
        source: 'plinko'
      });

      transaction.set(dropRef, {
        uid: decoded.uid,
        createdAt: obtainedAt,
        bet,
        rows,
        boardId: settings.activeBoardId,
        pathBits,
        slotIndex,
        slotLabel: toSafeString(slotConfig.label, 'Common'),
        minValue,
        maxValue,
        awardedItemSnapshot: awardedSnapshot,
        nonce,
        clientSeed,
        serverSeedHash,
        hashInputSummary: {
          uid: decoded.uid,
          clientSeed,
          nonce,
          game: 'plinko',
          boardId: settings.activeBoardId
        },
        rollHash
      });

      responsePayload = {
        pathBits,
        slotIndex,
        slotLabel: toSafeString(slotConfig.label, 'Common'),
        awardedItem: awardedSnapshot,
        minValue,
        maxValue,
        nonce,
        serverSeedHash,
        rollHash,
        inventoryId: inventoryRef.id,
        newCoins
      };
    });

    try {
      await markReferralFirstGameQualified({ referredUid: decoded.uid });
    } catch (referralError) {
      console.error('attempt-plinko failed to evaluate referral game qualification', referralError);
    }

    return sendJson(res, 200, responsePayload);
  } catch (error) {
    return sendJson(res, 400, {
      error: 'PLINKO_FAILED',
      message: error instanceof Error ? error.message : 'Plinko attempt failed.'
    });
  }
}
