import { adminAuth, firestore } from './_lib/firebaseAdmin.js';
import { getBearerToken, readJsonBody, sendJson } from './_lib/http.js';

const STRIPE_SETTINGS_DOC = 'stripe-settings';

const isXpShopInventoryItem = (inventoryItem = {}) => (
  inventoryItem.source === 'xpShop'
  || Boolean(inventoryItem.sourceItemId)
  || Boolean(inventoryItem.sourceRedemptionId)
  || inventoryItem.acquisitionCurrencyType === 'XP'
  || inventoryItem.openCurrencyType === 'XP'
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
    const body = await readJsonBody(req);
    const inventoryId = body?.inventoryId;
    const shippingInfo = body?.shippingInfo;

    if (!inventoryId || typeof inventoryId !== 'string') {
      return sendJson(res, 400, { error: 'Missing inventoryId' });
    }

    if (!shippingInfo || typeof shippingInfo !== 'object') {
      return sendJson(res, 400, { error: 'Missing shippingInfo' });
    }

    const settingsSnap = await firestore.collection('settings').doc(STRIPE_SETTINGS_DOC).get();
    const settings = settingsSnap.data() ?? {};
    const shippingCoinEnabled = settings.shippingCoinEnabled === true;
    const shippingCoinCostCoins = Math.max(0, Math.round(Number(settings.shippingCoinCostCoins) || 0));

    const userRef = firestore.collection('users').doc(decoded.uid);
    const inventoryRef = userRef.collection('inventory').doc(inventoryId);
    const shipmentRef = firestore.collection('shipments').doc();

    let updatedCoins = null;
    await firestore.runTransaction(async (transaction) => {
      const userSnap = await transaction.get(userRef);
      const userData = userSnap.data() ?? {};
      const currentCoins = Number(userData.coins ?? userData.balance ?? 0);

      const inventorySnap = await transaction.get(inventoryRef);
      if (!inventorySnap.exists) {
        throw { status: 404, error: 'Inventory item not found' };
      }

      const inventoryItem = inventorySnap.data() ?? {};
      const status = inventoryItem.status ?? 'available';
      if (status !== 'available') {
        throw { status: 400, error: 'Item is not available for shipping' };
      }

      const hasFreeShipping =
        inventoryItem.freeShipping === true
        || Number(inventoryItem.shippingCostOverrideCoins ?? NaN) === 0
        || isXpShopInventoryItem(inventoryItem);
      const effectiveShippingCost = hasFreeShipping ? 0 : shippingCoinCostCoins;
      const shippingPaymentMethod = effectiveShippingCost > 0 ? 'coins' : 'FREE_XP';

      if (!hasFreeShipping && !shippingCoinEnabled) {
        throw { status: 400, error: 'Coin shipping is disabled' };
      }

      if (effectiveShippingCost > 0 && currentCoins < effectiveShippingCost) {
        throw { status: 400, error: 'Insufficient coins for shipping' };
      }

      if (effectiveShippingCost > 0) {
        updatedCoins = currentCoins - effectiveShippingCost;
        transaction.set(userRef, { coins: updatedCoins }, { merge: true });
      } else {
        updatedCoins = currentCoins;
      }

      transaction.set(inventoryRef, { status: 'shipping_requested' }, { merge: true });
      transaction.set(shipmentRef, {
        uid: decoded.uid,
        inventoryId,
        item: {
          boxId: inventoryItem.boxId ?? null,
          prizeId: inventoryItem.prizeId ?? null,
          name: inventoryItem.name ?? 'Mystery Item',
          value: Number(inventoryItem.value ?? 0),
          image: inventoryItem.image ?? '',
          rarity: inventoryItem.rarity ?? 'common',
          sellBackRate: Number(inventoryItem.sellBackRate ?? 0.8),
          size: inventoryItem.size ?? null
        },
        shippingInfo,
        shippingCost: effectiveShippingCost,
        shippingPaid: true,
        shippingPaymentMethod,
        paidAt: new Date(),
        status: 'shipping_requested',
        createdAt: new Date()
      });
    });

    return sendJson(res, 200, { ok: true, shipmentId: shipmentRef.id, newCoins: updatedCoins });
  } catch (error) {
    const status = error?.status;
    if (status) {
      return sendJson(res, status, { error: error.error || 'Unable to request shipment' });
    }
    console.error('request-shipment error', error);
    return sendJson(res, 500, { error: 'Unable to request shipment' });
  }
}
