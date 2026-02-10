import { admin, adminAuth, firestore } from '../_lib/firebaseAdmin.js';
import { getBearerToken, readJsonBody, sendJson } from '../_lib/http.js';

const toInt = (value, fallback = 0) => {
  const num = Math.floor(Number(value));
  return Number.isFinite(num) ? num : fallback;
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
          .where('itemId', '==', itemId)
          .where('status', 'in', ['pending', 'fulfilled']);
        const priorRedemptions = await transaction.get(priorRedemptionsQuery);
        if (priorRedemptions.size >= Number(perUserLimit)) {
          throw { status: 400, error: 'Redemption limit reached for this item' };
        }
      }

      const fulfillmentType = itemData.fulfillmentType ?? 'DIGITAL';
      const metadataRaw = itemData.metadata ?? {};
      const metadataSnapshot = {
        title: itemData.title ?? 'XP Reward',
        description: itemData.description ?? '',
        category: itemData.category ?? 'General',
        imageUrl: itemData.imageUrl ?? '',
        caseId: typeof metadataRaw.caseId === 'string' ? metadataRaw.caseId : undefined,
        xpPriceOverride: metadataRaw.xpPriceOverride == null ? undefined : Math.max(0, toInt(metadataRaw.xpPriceOverride, 0))
      };

      const nextXp = currentXp - xpCost;
      const nextStock = hasLimitedStock ? Number(stockValue) - 1 : null;

      transaction.set(userRef, {
        xpBalance: nextXp,
        xp: nextXp,
        xpSpentLifetime: Math.max(0, toInt(userData.xpSpentLifetime, 0)) + xpCost,
        lastXpRedemptionAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      if (hasLimitedStock) {
        transaction.set(itemRef, { stock: nextStock }, { merge: true });
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
          if ((caseData.currencyType ?? 'COIN') !== 'XP') {
            throw { status: 400, error: 'Referenced case is not configured as XP box' };
          }
          transaction.set(caseRef, { priceXP: metadataSnapshot.xpPriceOverride }, { merge: true });
        }
      }

      const status = fulfillmentType === 'PHYSICAL_SHIP' ? 'pending' : 'fulfilled';
      const redemptionPayload = {
        userId: decoded.uid,
        itemId,
        xpCost,
        status,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        fulfillmentType,
        metadataSnapshot
      };

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
        message:
          fulfillmentType === 'DIGITAL'
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
