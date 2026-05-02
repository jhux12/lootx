import { admin, adminAuth, firestore } from './_lib/firebaseAdmin.js';
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
    const shipmentBatchId = typeof body?.shipmentBatchId === 'string' ? body.shipmentBatchId.trim() : '';

    let shipmentsQuery = firestore
      .collection('shipments')
      .where('uid', '==', decoded.uid)
      .where('shippingPaid', '==', false);

    if (shipmentBatchId) {
      shipmentsQuery = shipmentsQuery.where('shippingBatchId', '==', shipmentBatchId);
    } else {
      shipmentsQuery = shipmentsQuery.where('status', '==', 'pending_payment');
    }

    const shipmentsSnap = await shipmentsQuery.get();

    if (shipmentsSnap.empty) {
      return sendJson(res, 200, { released: false, releasedCount: 0, message: 'No pending shipments found' });
    }

    await firestore.runTransaction(async (transaction) => {
      shipmentsSnap.docs.forEach((docSnap) => {
        const shipmentData = docSnap.data() ?? {};
        transaction.set(docSnap.ref, {
          status: 'cancelled',
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        const inventoryId = shipmentData.inventoryId;
        if (inventoryId) {
          const inventoryRef = firestore
            .collection('users')
            .doc(decoded.uid)
            .collection('inventory')
            .doc(inventoryId);
          transaction.set(inventoryRef, {
            status: 'available',
            shipmentId: admin.firestore.FieldValue.delete(),
            shipmentBatchId: admin.firestore.FieldValue.delete(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          }, { merge: true });
        }
      });
    });

    return sendJson(res, 200, { released: true, releasedCount: shipmentsSnap.size, shipmentBatchId: shipmentBatchId || null });
  } catch (error) {
    const status = error?.status;
    if (status) {
      return sendJson(res, status, { error: error.error || 'Unable to cancel shipment' });
    }
    console.error('cancel-shipping-checkout-session error', error);
    return sendJson(res, 500, { error: 'Unable to cancel shipment' });
  }
}
