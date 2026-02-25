import { admin, adminAuth, firestore } from './_lib/firebaseAdmin.js';
import { getBearerToken, readJsonBody, sendJson } from './_lib/http.js';
import { randomSeed, sha256 } from './_lib/provablyFair.js';

const DEFAULT_CLIENT_SEED = 'lootx-player';

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toSafeString = (value, fallback = '') => (typeof value === 'string' ? value : fallback);

const getCoinValue = (item = {}) => Math.max(0, toNumber(item.coinValue ?? item.value ?? item.price, 0));

const computeChance = ({ sourceValue, targetValue, settings, sourceItem, targetItem, user }) => {
  const raw = sourceValue / targetValue;
  let chance = raw * toNumber(settings.edgeMultiplier, 0.92);

  if (settings.rarityBonusEnabled === true && sourceItem.rarity === targetItem.rarity) {
    chance += toNumber(settings.rarityBonusPercent, 0);
  }

  if (settings.vipBonusEnabled === true) {
    const vipMultiplier = toNumber(user?.vipUpgradeMultiplier, 1);
    if (vipMultiplier > 0) chance *= vipMultiplier;
  }

  chance *= toNumber(settings.promoEventMultiplier, 1);
  const minChance = Math.max(0, Math.min(1, toNumber(settings.minChance, 0.02)));
  const maxChance = Math.max(0, Math.min(1, toNumber(settings.maxChance, 0.7)));
  return Math.min(maxChance, Math.max(minChance, chance));
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'METHOD_NOT_ALLOWED' });
  const token = getBearerToken(req);
  if (!token) return sendJson(res, 401, { error: 'UNAUTHENTICATED', message: 'Missing bearer token.' });

  let decoded;
  try {
    decoded = await adminAuth.verifyIdToken(token);
  } catch {
    return sendJson(res, 401, { error: 'UNAUTHENTICATED', message: 'Invalid authentication token.' });
  }

  const body = await readJsonBody(req);
  if (!body) return sendJson(res, 400, { error: 'BAD_JSON' });

  const sourceItemInstanceId = typeof body.sourceItemInstanceId === 'string' ? body.sourceItemInstanceId : '';
  const targetItemId = typeof body.targetItemId === 'string' ? body.targetItemId : '';
  const inputClientSeed = typeof body.clientSeed === 'string' && body.clientSeed.trim() ? body.clientSeed.trim().slice(0, 64) : null;

  if (!sourceItemInstanceId || !targetItemId) return sendJson(res, 400, { error: 'INVALID_INPUT' });

  try {
    let resultPayload = null;

    await firestore.runTransaction(async (transaction) => {
      const userRef = firestore.collection('users').doc(decoded.uid);
      const sourceRef = userRef.collection('inventory').doc(sourceItemInstanceId);
      const targetRef = firestore.collection('upgraderTargets').doc(targetItemId);
      const settingsRef = firestore.collection('settings').doc('upgrader');
      const provablyRef = firestore.collection('provablyFair').doc(decoded.uid);

      const [userSnap, sourceSnap, targetSnap, settingsSnap, provablySnap] = await Promise.all([
        transaction.get(userRef),
        transaction.get(sourceRef),
        transaction.get(targetRef),
        transaction.get(settingsRef),
        transaction.get(provablyRef)
      ]);

      if (!sourceSnap.exists) throw new Error('Source item not found in your inventory.');
      if (!targetSnap.exists) throw new Error('Target item unavailable.');

      const settings = settingsSnap.exists ? settingsSnap.data() ?? {} : {};
      if (settings.enabled === false) throw new Error('Upgrader is currently disabled.');

      const sourceItem = sourceSnap.data() ?? {};
      const targetItem = targetSnap.data() ?? {};
      if (sourceItem.status && sourceItem.status !== 'available') throw new Error('Source item is not available.');
      if (sourceItem.locked === true) throw new Error('Source item is locked.');
      if (targetItem.enabled === false) throw new Error('Target item disabled by admin.');

      const sourceValue = getCoinValue(sourceItem);
      const targetValue = getCoinValue(targetItem);
      if (sourceValue <= 0 || targetValue <= 0) throw new Error('Invalid item values for upgrade.');
      if (settings.requireTargetHigherValue !== false && targetValue <= sourceValue) throw new Error('Target must be higher value.');
      if (targetValue < sourceValue * toNumber(settings.minUpgradeRatio, 1.25)) throw new Error('Target does not meet minimum upgrade ratio.');
      if (settings.maxTargetValue != null && targetValue > Number(settings.maxTargetValue)) throw new Error('Target exceeds configured cap.');
      if (Array.isArray(settings.categoriesEnabled) && settings.categoriesEnabled.length > 0 && !settings.categoriesEnabled.includes(targetItem.category)) throw new Error('Target category is currently disabled.');
      if (Array.isArray(settings.raritiesEnabled) && settings.raritiesEnabled.length > 0 && !settings.raritiesEnabled.includes(targetItem.rarity)) throw new Error('Target rarity is currently disabled.');
      if (sourceItem.source === 'freebox' && settings.allowFromFreeBox === false) throw new Error('Free box items are blocked for upgrades.');
      const allowedSourceItemIds = Array.isArray(settings.sourceItemIdsEnabled) ? settings.sourceItemIdsEnabled.map((entry) => String(entry)) : [];
      if (allowedSourceItemIds.length > 0 && !allowedSourceItemIds.includes(String(sourceItem.id ?? ''))) throw new Error('Source item is not enabled for upgrades.');
      if (sourceItem.source === 'promo' && settings.allowFromPromo === false) throw new Error('Promo items are blocked for upgrades.');
      if (targetItem.minSourceValue != null && sourceValue < Number(targetItem.minSourceValue)) throw new Error('Source value below target minimum.');
      if (targetItem.maxSourceValue != null && sourceValue > Number(targetItem.maxSourceValue)) throw new Error('Source value above target maximum.');

      const userData = userSnap.data() ?? {};
      const provablyData = provablySnap.data() ?? {};
      const serverSeed = typeof provablyData.serverSeed === 'string' && provablyData.serverSeed ? provablyData.serverSeed : randomSeed();
      const serverSeedHash = typeof provablyData.serverSeedHash === 'string' && provablyData.serverSeedHash ? provablyData.serverSeedHash : sha256(serverSeed);
      const clientSeed = inputClientSeed || (typeof provablyData.clientSeed === 'string' && provablyData.clientSeed.trim() ? provablyData.clientSeed.trim() : DEFAULT_CLIENT_SEED);
      const nonce = Math.max(0, Math.floor(toNumber(provablyData.upgradeNonce, 0))) + 1;

      const chance = computeChance({ sourceValue, targetValue, settings, sourceItem, targetItem, user: userData });
      const hashInput = `${serverSeed}:${decoded.uid}:${clientSeed}:${nonce}:${targetItemId}:${sourceItemInstanceId}`;
      const hash = sha256(hashInput);
      const roll = parseInt(hash.slice(0, 8), 16) / 0xffffffff;
      const win = roll < chance;

      const attemptRef = firestore.collection('upgradeAttempts').doc();
      const awardedRef = win ? userRef.collection('inventory').doc() : null;

      const targetName = toSafeString(targetItem.name, 'Upgrader Target');
      const targetImage = toSafeString(targetItem.imageUrl || targetItem.image, '');
      const targetRarity = toSafeString(targetItem.rarity, 'common');
      const targetCategory = toSafeString(targetItem.category, 'misc');
      const sourceName = toSafeString(sourceItem.name, 'Inventory Item');
      const sourceRarity = toSafeString(sourceItem.rarity, 'common');
      const sourceCategory = toSafeString(sourceItem.category, 'misc');

      transaction.delete(sourceRef);
      if (awardedRef) {
        transaction.set(awardedRef, {
          instanceId: awardedRef.id,
          id: targetItemId,
          name: targetName,
          image: targetImage,
          price: targetValue,
          coinValue: targetValue,
          rarity: targetRarity,
          category: targetCategory,
          chance: 0,
          color: toSafeString(targetItem.color, '#22d3ee'),
          obtainedAt: Date.now(),
          status: 'available',
          source: 'upgrader'
        }, { merge: true });
      }

      transaction.set(userRef, { lastUpgradeAt: Date.now() }, { merge: true });
      transaction.set(provablyRef, {
        serverSeed,
        serverSeedHash,
        clientSeed,
        upgradeNonce: nonce
      }, { merge: true });

      transaction.set(attemptRef, {
        uid: decoded.uid,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        sourceItemInstanceId,
        sourceItemSnapshot: {
          name: sourceName,
          value: sourceValue,
          rarity: sourceRarity,
          category: sourceCategory
        },
        targetItemId,
        targetItemSnapshot: {
          name: targetName,
          value: targetValue,
          rarity: targetRarity,
          category: targetCategory
        },
        chance,
        roll,
        win,
        nonce,
        clientSeed,
        serverSeedHash,
        hashInputSummary: {
          uid: decoded.uid,
          nonce,
          clientSeed,
          targetItemId,
          sourceItemInstanceId
        },
        resultItemInstanceId: awardedRef?.id ?? null
      });

      resultPayload = {
        win,
        roll,
        chance,
        attemptId: attemptRef.id,
        awardedItem: awardedRef ? { id: awardedRef.id, name: targetName, imageUrl: targetImage } : undefined
      };
    });

    return sendJson(res, 200, resultPayload);
  } catch (error) {
    return sendJson(res, 400, { error: 'UPGRADE_FAILED', message: error instanceof Error ? error.message : 'Upgrade failed.' });
  }
}
