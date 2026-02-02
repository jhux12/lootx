import { adminAuth, firestore } from './_lib/firebaseAdmin.js';
import { getBearerToken, readJsonBody, sendJson } from './_lib/http.js';

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
    const shippingCost = Number(body?.shippingCost ?? 0);

    if (!inventoryId || typeof inventoryId !== 'string') {
      return sendJson(res, 400, { error: 'Missing inventoryId' });
    }

    if (!shippingInfo || typeof shippingInfo !== 'object') {
      return sendJson(res, 400, { error: 'Missing shippingInfo' });
    }

    const userRef = firestore.collection('users').doc(decoded.uid);
    const inventoryRef = userRef.collection('inventory').doc(inventoryId);
    const shipmentRef = firestore.collection('shipments').doc();

    await firestore.runTransaction(async (transaction) => {
      const inventorySnap = await transaction.get(inventoryRef);
      if (!inventorySnap.exists) {
        throw { status: 404, error: 'Inventory item not found' };
      }

      const inventoryItem = inventorySnap.data() ?? {};
      const status = inventoryItem.status ?? 'available';
      if (status !== 'available') {
        throw { status: 400, error: 'Item is not available for shipping' };
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
        shippingCost: Number.isFinite(shippingCost) ? Math.max(0, shippingCost) : 0,
        shippingPaid: true,
        shippingPaymentMethod: 'coins',
        status: 'shipping_requested',
        createdAt: new Date()
      });
    });

    return sendJson(res, 200, { ok: true, shipmentId: shipmentRef.id });
  } catch (error) {
    const status = error?.status;
    if (status) {
      return sendJson(res, status, { error: error.error || 'Unable to request shipment' });
    }
    console.error('request-shipment error', error);
    return sendJson(res, 500, { error: 'Unable to request shipment' });
  }
}
