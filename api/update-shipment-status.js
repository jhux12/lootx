import { admin, adminAuth, firestore } from './_lib/firebaseAdmin.js';
import { getBearerToken, readJsonBody, sendJson } from './_lib/http.js';

const SHIPMENT_STATUSES = new Set(['shipping_requested', 'shipping', 'shipped']);

const normalizeText = (value) => (typeof value === 'string' ? value.trim() : '');

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return sendJson(res, 405, { error: 'Method Not Allowed' });
  }

  try {
    const token = getBearerToken(req);
    if (!token) {
      return sendJson(res, 401, { error: 'Missing bearer token' });
    }

    const decoded = await adminAuth.verifyIdToken(token);
    const actorRef = firestore.collection('users').doc(decoded.uid);
    const actorSnap = await actorRef.get();
    const actor = actorSnap.data() ?? {};
    const canManageShipments = actor.isAdmin === true || decoded.admin === true;

    if (!canManageShipments) {
      return sendJson(res, 403, { error: 'Forbidden' });
    }

    const body = await readJsonBody(req);
    if (!body || typeof body !== 'object') {
      return sendJson(res, 400, { error: 'Invalid JSON body' });
    }

    const shipmentId = normalizeText(body.shipmentId);
    const userId = normalizeText(body.userId);
    const inventoryId = normalizeText(body.inventoryId);
    const status = normalizeText(body.status);
    const trackingNumber = normalizeText(body.trackingNumber);

    if (!shipmentId || !userId || !status || !SHIPMENT_STATUSES.has(status)) {
      return sendJson(res, 400, { error: 'Missing or invalid shipment fields' });
    }

    const shipmentRef = firestore.collection('shipments').doc(shipmentId);
    const notificationRef = firestore.collection('users').doc(userId).collection('notifications').doc();

    await firestore.runTransaction(async (tx) => {
      const shipmentSnap = await tx.get(shipmentRef);
      if (!shipmentSnap.exists) {
        const error = new Error('Shipment not found');
        error.status = 404;
        throw error;
      }

      const shipmentData = shipmentSnap.data() ?? {};
      const shipmentItem = shipmentData.item ?? {};
      const itemName = typeof shipmentItem.name === 'string' && shipmentItem.name.trim()
        ? shipmentItem.name.trim()
        : 'your item';

      const shipmentUpdates = {
        status,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        ...(trackingNumber ? { trackingNumber } : {})
      };
      tx.set(shipmentRef, shipmentUpdates, { merge: true });

      if (inventoryId) {
        const inventoryRef = firestore.collection('users').doc(userId).collection('inventory').doc(inventoryId);
        tx.set(
          inventoryRef,
          {
            status,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            ...(trackingNumber ? { trackingNumber } : {})
          },
          { merge: true }
        );
      }

      if (status === 'shipped') {
        const bodyText = trackingNumber
          ? `${itemName} has shipped. Tracking #: ${trackingNumber}`
          : `${itemName} has shipped.`;

        tx.set(notificationRef, {
          type: 'shipping',
          title: 'Item shipped',
          body: bodyText,
          link: '/profile',
          shipmentId,
          inventoryId: inventoryId || null,
          trackingNumber: trackingNumber || null,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          readAt: null,
          seenAt: null
        });
      }
    });

    return sendJson(res, 200, { ok: true });
  } catch (error) {
    const status = Number.isInteger(error?.status) ? error.status : 500;
    const message = typeof error?.message === 'string' ? error.message : 'Unable to update shipment';
    console.error('update-shipment-status error', error);
    return sendJson(res, status, { error: message });
  }
}
