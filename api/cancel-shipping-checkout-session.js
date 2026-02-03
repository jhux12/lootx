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
    const shipmentBatchId = typeof body?.shipmentBatchId === 'string' ? body.shipmentBatchId : '';

    if (!shipmentBatchId) {
      return sendJson(res, 400, { error: 'Missing shipment batch ID' });
    }

    const shipmentsSnap = await firestore
      .collection('shipments')
      .where('shippingBatchId', '==', shipmentBatchId)
      .where('uid', '==', decoded.uid)
      .get();

    if (shipmentsSnap.empty) {
      return sendJson(res, 200, { released: false, message: 'No pending shipments found' });
    }

    await firestore.runTransaction(async (transaction) => {
      shipmentsSnap.docs.forEach((docSnap) => {
        const shipmentData = docSnap.data() ?? {};
        if (shipmentData.shippingPaid) {
          throw { status: 409, error: 'Shipment already paid' };
        }

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

    return sendJson(res, 200, { released: true });
  } catch (error) {
    const status = error?.status;
    if (status) {
      return sendJson(res, status, { error: error.error || 'Unable to cancel shipment' });
    }
    console.error('cancel-shipping-checkout-session error', error);
    return sendJson(res, 500, { error: 'Unable to cancel shipment' });
  }
}
