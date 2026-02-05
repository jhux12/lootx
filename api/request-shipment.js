import { admin, adminAuth, firestore } from './_lib/firebaseAdmin.js';
import { buildIdempotencySuccess, getIdempotencyKey, getIdempotencyRef } from './_lib/idempotency.js';
import { getBearerToken, readJsonBody, sendJson } from './_lib/http.js';

const STRIPE_SETTINGS_DOC = 'stripe-settings';

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
    const idempotencyKey = getIdempotencyKey(body);

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

    if (!shippingCoinEnabled) {
      return sendJson(res, 400, { error: 'Coin shipping is disabled' });
    }

    const userRef = firestore.collection('users').doc(decoded.uid);
    const inventoryRef = userRef.collection('inventory').doc(inventoryId);
    const shipmentRef = firestore.collection('shipments').doc();
    const idempotencyRef = idempotencyKey ? getIdempotencyRef(decoded.uid, idempotencyKey) : null;

    if (idempotencyRef) {
      const existingSnap = await idempotencyRef.get();
      if (existingSnap.exists && existingSnap.data()?.status === 'success') {
        return sendJson(res, 200, existingSnap.data()?.responsePayload ?? { ok: true });
      }
    }

    let updatedCoins = null;
    let responsePayload;
    await firestore.runTransaction(async (transaction) => {
      const [idempotencySnap, userSnap, inventorySnap] = await Promise.all([
        idempotencyRef ? transaction.get(idempotencyRef) : Promise.resolve(null),
        transaction.get(userRef),
        transaction.get(inventoryRef)
      ]);

      if (idempotencySnap?.exists) {
        responsePayload = idempotencySnap.data()?.responsePayload ?? { ok: true };
        return;
      }

      const userData = userSnap.data() ?? {};
      const currentCoins = Number(userData.coins ?? userData.balance ?? 0);

      if (shippingCoinCostCoins > 0 && currentCoins < shippingCoinCostCoins) {
        throw { status: 400, error: 'Insufficient coins for shipping' };
      }

      if (!inventorySnap.exists) {
        throw { status: 404, error: 'Inventory item not found' };
      }

      const inventoryItem = inventorySnap.data() ?? {};
      const status = inventoryItem.status ?? 'available';
      const alreadyShippingStatuses = new Set([
        'shipping_requested',
        'shipping',
        'pending_shipment',
        'shipped'
      ]);
      const isAlreadyShipping = Boolean(inventoryItem.shipmentId) || alreadyShippingStatuses.has(status);
      if (status !== 'available' || inventoryItem.shipmentId) {
        if (isAlreadyShipping) {
          responsePayload = {
            ok: true,
            alreadyProcessed: true,
            inventoryId,
            shipmentId: inventoryItem.shipmentId ?? null,
            newCoins: currentCoins
          };
          if (idempotencyRef) {
            transaction.set(idempotencyRef, buildIdempotencySuccess(responsePayload), { merge: true });
          }
          return;
        }
        throw { status: 400, error: 'Item is not available for shipping' };
      }

      if (shippingCoinCostCoins > 0) {
        updatedCoins = currentCoins - shippingCoinCostCoins;
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
        shippingCost: shippingCoinCostCoins,
        shippingPaid: true,
        shippingPaymentMethod: 'coins',
        status: 'shipping_requested',
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      responsePayload = { ok: true, shipmentId: shipmentRef.id, newCoins: updatedCoins };

      if (idempotencyRef) {
        transaction.set(idempotencyRef, buildIdempotencySuccess(responsePayload), { merge: true });
      }
    });

    return sendJson(res, 200, responsePayload ?? { ok: true, shipmentId: shipmentRef.id, newCoins: updatedCoins });
  } catch (error) {
    const status = error?.status;
    if (status) {
      return sendJson(res, status, { error: error.error || 'Unable to request shipment' });
    }
    console.error('request-shipment error', error);
    return sendJson(res, 500, { error: 'Unable to request shipment' });
  }
}
