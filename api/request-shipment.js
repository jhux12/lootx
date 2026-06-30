import { admin, adminAuth, firestore } from './_lib/firebaseAdmin.js';
import { applySpendAndRewards, getRewardsSettings } from './_lib/rewards.js';
import { getBearerToken, readJsonBody, sendJson } from './_lib/http.js';
import { SIGNATURE_REQUIRED_CENTS, getShipmentShippingRate, getShippingProtectionRate } from './_lib/shippingRates.js';

const STRIPE_SETTINGS_DOC = 'stripe-settings';

const isXpShopInventoryItem = (inventoryItem = {}) => (
  inventoryItem.source === 'xpShop'
  || inventoryItem.acquisitionCurrencyType === 'XP'
  || inventoryItem.openCurrencyType === 'XP'
);

const getInventoryValueCoins = (inventoryItem = {}) => Math.max(
  0,
  Math.round(Number(inventoryItem.price ?? inventoryItem.value ?? inventoryItem.valueCoins ?? 0) || 0)
);

const isFreeShippingInventoryItem = (inventoryItem = {}) => (
  inventoryItem.freeShipping === true
  || Number(inventoryItem.shippingCostOverrideCoins ?? NaN) === 0
  || isXpShopInventoryItem(inventoryItem)
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return sendJson(res, 405, { error: 'Method Not Allowed' });
  }

  try {
    const token = getBearerToken(req);
    if (!token) {
      return sendJson(res, 401, { error: 'Missing bearer token' });
    }

    const decoded = await adminAuth.verifyIdToken(token);
    const authUser = await adminAuth.getUser(decoded.uid);
    if (!authUser.email || authUser.emailVerified !== true) {
      return sendJson(res, 403, {
        error: 'EMAIL_VERIFICATION_REQUIRED',
        message: authUser.email
          ? 'Verify your email before requesting shipment.'
          : 'Add and verify an email address before requesting shipment.'
      });
    }

    const body = await readJsonBody(req);
    const inventoryIds = Array.isArray(body?.inventoryIds)
      ? Array.from(new Set(body.inventoryIds.filter((id) => typeof id === 'string' && id.trim()).map((id) => id.trim())))
      : typeof body?.inventoryId === 'string' && body.inventoryId.trim()
        ? [body.inventoryId.trim()]
        : [];
    const shippingInfo = body?.shippingInfo;
    const wantsShippingProtection = body?.shippingProtection === true;
    const wantsSignatureRequired = body?.signatureRequired === true;

    if (inventoryIds.length === 0) {
      return sendJson(res, 400, { error: 'No items selected' });
    }

    if (!shippingInfo || typeof shippingInfo !== 'object') {
      return sendJson(res, 400, { error: 'Missing shippingInfo' });
    }

    const settingsSnap = await firestore.collection('settings').doc(STRIPE_SETTINGS_DOC).get();
    const settings = settingsSnap.data() ?? {};
    const shippingCoinEnabled = settings.shippingCoinEnabled === true;

    const userRef = firestore.collection('users').doc(decoded.uid);
    const inventoryRefs = inventoryIds.map((inventoryId) => userRef.collection('inventory').doc(inventoryId));
    const shipmentBatchId = firestore.collection('shipments').doc().id;
    const shipmentRefs = inventoryIds.map(() => firestore.collection('shipments').doc());

    let updatedCoins = null;
    let primaryShipmentId = shipmentRefs[0]?.id ?? null;
    await firestore.runTransaction(async (transaction) => {
      const [userSnap, ...inventorySnaps] = await Promise.all([
        transaction.get(userRef),
        ...inventoryRefs.map((inventoryRef) => transaction.get(inventoryRef))
      ]);
      const { settings: rewardsSettings } = await getRewardsSettings(transaction);
      const userData = userSnap.data() ?? {};
      const currentCoins = Number(userData.coins ?? userData.balance ?? 0);

      if (!userSnap.exists) {
        throw { status: 403, error: 'Unauthorized' };
      }

      const shipmentItems = inventorySnaps.map((inventorySnap, index) => {
        if (!inventorySnap.exists) {
          throw { status: 404, error: 'Inventory item not found' };
        }

        const inventoryItem = inventorySnap.data() ?? {};
        const status = inventoryItem.status ?? 'available';
        if (status !== 'available') {
          throw { status: 400, error: 'Item is not available for shipping' };
        }

        return {
          inventoryItem,
          inventoryId: inventoryIds[index],
          inventoryRef: inventoryRefs[index],
          shipmentRef: shipmentRefs[index],
          freeShipping: isFreeShippingInventoryItem(inventoryItem)
        };
      });

      const paidShipmentItems = shipmentItems.filter((item) => !item.freeShipping);
      const paidShipmentValueCoins = paidShipmentItems.reduce((sum, item) => sum + getInventoryValueCoins(item.inventoryItem), 0);
      const rate = getShipmentShippingRate(paidShipmentValueCoins);
      const protectionRate = getShippingProtectionRate(paidShipmentValueCoins);
      const shippingProtectionCost = paidShipmentItems.length > 0 && wantsShippingProtection ? protectionRate.coinCost : 0;
      const signatureRequiredCost = paidShipmentItems.length > 0 && wantsSignatureRequired ? SIGNATURE_REQUIRED_CENTS : 0;
      const effectiveShippingCost = paidShipmentItems.length > 0 ? rate.coinCost + shippingProtectionCost + signatureRequiredCost : 0;
      const shippingPaymentMethod = effectiveShippingCost > 0 ? 'coins' : 'FREE_XP';
      const firstPaidShipmentId = paidShipmentItems[0]?.shipmentRef.id ?? primaryShipmentId;
      primaryShipmentId = firstPaidShipmentId;

      if (paidShipmentItems.length > 0 && !shippingCoinEnabled) {
        throw { status: 400, error: 'Coin shipping is disabled' };
      }

      if (effectiveShippingCost > 0 && currentCoins < effectiveShippingCost) {
        throw { status: 400, error: 'Insufficient coins for shipping' };
      }

      if (effectiveShippingCost > 0) {
        updatedCoins = currentCoins - effectiveShippingCost;
        transaction.set(userRef, { coins: updatedCoins }, { merge: true });

        await applySpendAndRewards({
          transaction,
          uid: decoded.uid,
          userRef,
          coinsSpent: effectiveShippingCost,
          context: 'shipping_request',
          referenceId: shipmentBatchId,
          userData,
          rewardsSettings
        });
      } else {
        updatedCoins = currentCoins;
      }

      const now = admin.firestore.FieldValue.serverTimestamp();
      shipmentItems.forEach(({ inventoryItem, inventoryId, inventoryRef, shipmentRef, freeShipping }) => {
        const receivesBatchCharge = effectiveShippingCost > 0 && shipmentRef.id === firstPaidShipmentId;
        transaction.set(inventoryRef, {
          status: 'shipping_requested',
          shipmentId: shipmentRef.id,
          shipmentBatchId,
          updatedAt: now
        }, { merge: true });
        transaction.set(shipmentRef, {
          uid: decoded.uid,
          inventoryId,
          item: {
            boxId: inventoryItem.boxId ?? null,
            prizeId: inventoryItem.prizeId ?? null,
            name: inventoryItem.name ?? 'Mystery Item',
            value: Number(inventoryItem.value ?? inventoryItem.price ?? 0),
            image: inventoryItem.image ?? '',
            rarity: inventoryItem.rarity ?? 'common',
            sellBackRate: Number(inventoryItem.sellBackRate ?? 0.8),
            size: inventoryItem.size ?? null
          },
          shippingInfo,
          shippingCost: receivesBatchCharge ? effectiveShippingCost : 0,
          shippingBatchCost: effectiveShippingCost,
          shippingBatchValueCoins: paidShipmentValueCoins,
          shippingProtection: wantsShippingProtection && paidShipmentItems.length > 0,
          shippingProtectionCost: receivesBatchCharge ? shippingProtectionCost : 0,
          shippingProtectionBatchCost: shippingProtectionCost,
          shippingProtectionRateTier: shippingProtectionCost > 0 ? protectionRate.tierLabel : null,
          signatureRequired: wantsSignatureRequired && paidShipmentItems.length > 0,
          signatureRequiredCost: receivesBatchCharge ? signatureRequiredCost : 0,
          signatureRequiredBatchCost: signatureRequiredCost,
          baseShippingCost: receivesBatchCharge ? rate.coinCost : 0,
          shippingRateTier: paidShipmentItems.length > 0 ? rate.tierLabel : 'Free',
          shippingPaid: true,
          shippingPaymentMethod: freeShipping && effectiveShippingCost === 0 ? 'FREE_XP' : shippingPaymentMethod,
          paidAt: now,
          shippingBatchId: shipmentBatchId,
          status: 'shipping_requested',
          createdAt: now
        });
      });
    });

    return sendJson(res, 200, { ok: true, shipmentId: primaryShipmentId, shipmentBatchId, newCoins: updatedCoins });
  } catch (error) {
    const status = error?.status;
    if (status) {
      return sendJson(res, status, { error: error.error || 'Unable to request shipment' });
    }
    console.error('request-shipment error', error);
    return sendJson(res, 500, { error: 'Unable to request shipment' });
  }
}
