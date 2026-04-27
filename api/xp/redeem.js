import { admin, adminAuth, firestore } from '../_lib/firebaseAdmin.js';
import { getBearerToken, readJsonBody, sendJson } from '../_lib/http.js';
import { recordBalanceChange } from '../_lib/balanceAudit.js';

const toInt = (value, fallback = 0) => {
  const num = Math.floor(Number(value));
  return Number.isFinite(num) ? num : fallback;
};

const stripUndefinedDeep = (value) => {
  if (Array.isArray(value)) return value.map(stripUndefinedDeep);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, entryValue]) => entryValue !== undefined)
        .map(([key, entryValue]) => [key, stripUndefinedDeep(entryValue)])
    );
  }
  return value;
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return sendJson(res, 405, { error: 'Method Not Allowed' });
  }

  try {
    const token = getBearerToken(req);
    if (!token) return sendJson(res, 401, { error: 'Missing bearer token' });

    const decoded = await adminAuth.verifyIdToken(token);
    const body = await readJsonBody(req);

    const itemId = typeof body?.itemId === 'string' ? body.itemId : null;
    const redemptionRequestId = typeof body?.redemptionRequestId === 'string' ? body.redemptionRequestId : null;

    if (!itemId || !redemptionRequestId) {
      return sendJson(res, 400, { error: 'Missing itemId or redemptionRequestId' });
    }

    const userRef = firestore.collection('users').doc(decoded.uid);
    const itemRef = firestore.collection('xpShopItems').doc(itemId);
    const requestRef = firestore.collection('xpRedemptionRequests').doc(redemptionRequestId);
    const redemptionRef = firestore.collection('xpRedemptions').doc();
    const inventoryRef = userRef.collection('inventory').doc();

    let responsePayload;

    await firestore.runTransaction(async (transaction) => {
      const [existingRequestSnap, userSnap, itemSnap] = await Promise.all([
        transaction.get(requestRef),
        transaction.get(userRef),
        transaction.get(itemRef)
      ]);

      if (existingRequestSnap.exists) {
        responsePayload = { ok: true, ...(existingRequestSnap.data() ?? {}), idempotent: true };
        return;
      }

      if (!itemSnap.exists) {
        throw { status: 404, error: 'XP shop item not found' };
      }

      const itemData = itemSnap.data() ?? {};
      if (itemData.enabled === false) {
        throw { status: 400, error: 'This reward is currently disabled' };
      }

      const xpCost = Math.max(0, toInt(itemData.xpCost, 0));
      const userData = userSnap.exists ? userSnap.data() ?? {} : {};
      const currentXp = Math.max(0, toInt(userData.xpBalance ?? userData.xp, 0));

      if (currentXp < xpCost) {
        throw { status: 400, error: 'Insufficient XP balance', needed: xpCost - currentXp };
      }

      const stockValue = itemData.stock;
      const hasLimitedStock = Number.isInteger(stockValue);
      if (hasLimitedStock && Number(stockValue) <= 0) {
        throw { status: 400, error: 'Out of stock' };
      }

      const perUserLimit = itemData.limitPerUser;
      if (Number.isInteger(perUserLimit) && Number(perUserLimit) > 0) {
        const priorRedemptionsQuery = firestore
          .collection('xpRedemptions')
          .where('userId', '==', decoded.uid)
          .where('itemId', '==', itemId);
        const priorRedemptions = await transaction.get(priorRedemptionsQuery);
        const relevantRedemptionCount = priorRedemptions.docs.filter((docSnap) => {
          const redemptionStatus = String(docSnap.data()?.status ?? '');
          return redemptionStatus === 'pending' || redemptionStatus === 'fulfilled';
        }).length;
        if (relevantRedemptionCount >= Number(perUserLimit)) {
          throw { status: 400, error: 'Redemption limit reached for this item' };
        }
      }

      const fulfillmentType = itemData.fulfillmentType ?? 'DIGITAL';
      const metadataRaw = itemData.metadata ?? {};
      const metadataSnapshot = stripUndefinedDeep({
        title: itemData.title ?? 'XP Reward',
        description: itemData.description ?? '',
        category: itemData.category ?? 'General',
        imageUrl: itemData.imageUrl ?? '',
        caseId:
          typeof metadataRaw.caseId === 'string'
            ? metadataRaw.caseId
            : typeof metadataRaw.boxId === 'string'
              ? metadataRaw.boxId
              : typeof itemData.caseId === 'string'
                ? itemData.caseId
                : typeof itemData.boxId === 'string'
                  ? itemData.boxId
                  : undefined,
        xpPriceOverride: metadataRaw.xpPriceOverride == null ? undefined : Math.max(0, toInt(metadataRaw.xpPriceOverride, 0)),
        unlockRakeback: metadataRaw.unlockRakeback === true || itemData.category === 'Rakeback',
        rakebackPercent: metadataRaw.rakebackPercent == null ? undefined : Math.max(0, Number(metadataRaw.rakebackPercent)),
        rakebackTier: metadataRaw.rakebackTier == null ? null : String(metadataRaw.rakebackTier)
      });

      const isDigitalRakebackUnlock = fulfillmentType === 'DIGITAL' && metadataSnapshot.unlockRakeback === true;
      if (isDigitalRakebackUnlock && userData.rakebackUnlocked === true) {
        throw { status: 400, error: 'Rakeback is already unlocked for this account' };
      }

      const { balanceAfter: nextXp } = await recordBalanceChange({
        transaction,
        uid: decoded.uid,
        currency: 'xp',
        amount: -xpCost,
        reason: 'xp_shop_purchase',
        actorType: 'user',
        actorUid: decoded.uid,
        source: 'api/xp/redeem',
        relatedId: itemId,
        metadata: { redemptionRequestId, fulfillmentType: itemData.fulfillmentType ?? 'DIGITAL' }
      });
      const nextStock = hasLimitedStock ? Number(stockValue) - 1 : null;

      transaction.set(userRef, {
        xpSpentLifetime: Math.max(0, toInt(userData.xpSpentLifetime, 0)) + xpCost,
        lastXpRedemptionAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      if (hasLimitedStock) {
        transaction.set(itemRef, { stock: nextStock }, { merge: true });
      }

      if (isDigitalRakebackUnlock) {
        transaction.set(userRef, stripUndefinedDeep({
          rakebackUnlocked: true,
          rakebackPercent: metadataSnapshot.rakebackPercent,
          rakebackTier: metadataSnapshot.rakebackTier
        }), { merge: true });
      }

      if (fulfillmentType === 'XP_BOX') {
        if (!metadataSnapshot.caseId) {
          throw { status: 400, error: 'XP box reward is missing caseId' };
        }

        if (metadataSnapshot.xpPriceOverride != null) {
          const caseRef = firestore.collection('boxes').doc(metadataSnapshot.caseId);
          const caseSnap = await transaction.get(caseRef);
          if (!caseSnap.exists) {
            throw { status: 404, error: 'Referenced XP box not found' };
          }
          const caseData = caseSnap.data() ?? {};
          const inferredXpLegacy = Number.isFinite(Number(caseData.priceXP)) && Number(caseData.priceXP) > 0;
          if ((caseData.currencyType === 'XP' || inferredXpLegacy ? 'XP' : 'COIN') !== 'XP') {
            throw { status: 400, error: 'Referenced case is not configured as XP box' };
          }
          transaction.set(caseRef, { priceXP: metadataSnapshot.xpPriceOverride }, { merge: true });
        }
      }

      const shouldCreateInventoryReward = (fulfillmentType === 'DIGITAL' && !isDigitalRakebackUnlock) || fulfillmentType === 'PHYSICAL_SHIP';
      if (shouldCreateInventoryReward) {
        transaction.set(inventoryRef, stripUndefinedDeep({
          source: 'xpShop',
          sourceItemId: itemId,
          sourceRedemptionId: redemptionRef.id,
          name: String(metadataSnapshot.title ?? itemData.title ?? 'XP Reward'),
          value: 0,
          image: String(itemData.imageUrl ?? ''),
          rarity: 'rare',
          status: 'available',
          obtainedAt: admin.firestore.FieldValue.serverTimestamp(),
          redeemable: true,
          sellBackRate: 0,
          freeShipping: true,
          shippingCostOverrideCoins: 0
        }));
      }

      const status = fulfillmentType === 'PHYSICAL_SHIP' ? 'pending' : 'fulfilled';
      const redemptionPayload = stripUndefinedDeep({
        userId: decoded.uid,
        itemId,
        xpCost,
        status,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        fulfillmentType,
        metadataSnapshot
      });

      transaction.set(redemptionRef, redemptionPayload);
      transaction.set(requestRef, {
        ok: true,
        redemptionId: redemptionRef.id,
        itemId,
        xpCost,
        status,
        fulfillmentType,
        xpBalance: nextXp,
        caseId: metadataSnapshot.caseId ?? null,
        inventoryId: shouldCreateInventoryReward ? inventoryRef.id : null,
        rakebackUnlocked: isDigitalRakebackUnlock ? true : Boolean(userData.rakebackUnlocked),
        rakebackPercent: isDigitalRakebackUnlock ? (metadataSnapshot.rakebackPercent ?? null) : (userData.rakebackPercent ?? null),
        rakebackTier: isDigitalRakebackUnlock ? (metadataSnapshot.rakebackTier ?? null) : (userData.rakebackTier ?? null),
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      responsePayload = {
        ok: true,
        redemptionId: redemptionRef.id,
        itemId,
        xpCost,
        status,
        fulfillmentType,
        newXpBalance: nextXp,
        caseId: metadataSnapshot.caseId,
        inventoryId: shouldCreateInventoryReward ? inventoryRef.id : null,
        rakebackUnlocked: isDigitalRakebackUnlock ? true : Boolean(userData.rakebackUnlocked),
        rakebackPercent: isDigitalRakebackUnlock ? metadataSnapshot.rakebackPercent : userData.rakebackPercent,
        rakebackTier: isDigitalRakebackUnlock ? metadataSnapshot.rakebackTier : userData.rakebackTier,
        message:
          isDigitalRakebackUnlock
            ? 'Rakeback unlocked successfully'
            : fulfillmentType === 'DIGITAL'
            ? 'Added to your inventory'
            : fulfillmentType === 'COUPON'
              ? 'Coupon added to your account'
              : fulfillmentType === 'PHYSICAL_SHIP'
                ? 'Added to shipments / pending fulfillment'
                : 'XP Box added'
      };
    });

    return sendJson(res, 200, responsePayload);
  } catch (error) {
    const status = error?.status;
    if (status) return sendJson(res, status, { error: error.error || 'Unable to redeem XP item', ...error });
    console.error('xp/redeem error', error);
    return sendJson(res, 500, { error: 'Unable to redeem XP item' });
  }
}
