import { admin, db } from '../_lib/firebaseAdmin.js';
import { deny, ok, requireAdmin } from '../_utils/auth.js';

const toMillis = (value) => {
  if (typeof value === 'number') return value;
  if (value && typeof value.toMillis === 'function') return value.toMillis();
  if (value && typeof value._seconds === 'number') return value._seconds * 1000;
  return null;
};

const serializeShipment = (docSnap) => {
  const shipment = docSnap.data() ?? {};
  return {
    id: docSnap.id,
    ...shipment,
    createdAt: toMillis(shipment.createdAt),
    updatedAt: toMillis(shipment.updatedAt)
  };
};

export default async function handler(req, res) {
  try {
    await requireAdmin(req);

    if (req.method === 'GET') {
      const snapshot = await db.collection('shipments').orderBy('createdAt', 'desc').limit(500).get();
      return ok(res, { shipments: snapshot.docs.map(serializeShipment) });
    }

    if (req.method !== 'PATCH') {
      res.setHeader('Allow', 'GET, PATCH');
      return deny(res, 405, 'METHOD_NOT_ALLOWED');
    }

    const { shipmentId, status, trackingNumber } = req.body ?? {};
    if (typeof shipmentId !== 'string' || !shipmentId.trim()) {
      return deny(res, 400, 'SHIPMENT_ID_REQUIRED');
    }
    if (status !== 'shipped' && status !== 'cancelled') {
      return deny(res, 400, 'INVALID_SHIPMENT_STATUS');
    }

    const shipmentRef = db.collection('shipments').doc(shipmentId);
    await db.runTransaction(async (transaction) => {
      const shipmentSnap = await transaction.get(shipmentRef);
      if (!shipmentSnap.exists) throw { status: 404, error: 'SHIPMENT_NOT_FOUND' };

      const shipment = shipmentSnap.data() ?? {};
      const inventoryId = typeof shipment.inventoryId === 'string' ? shipment.inventoryId : null;
      const uid = typeof shipment.uid === 'string' ? shipment.uid : null;
      const normalizedTrackingNumber = typeof trackingNumber === 'string' ? trackingNumber.trim() : '';
      const updatedAt = admin.firestore.FieldValue.serverTimestamp();

      transaction.set(shipmentRef, {
        status,
        ...(status === 'shipped' ? { trackingNumber: normalizedTrackingNumber } : {}),
        updatedAt
      }, { merge: true });

      if (uid && inventoryId) {
        const inventoryRef = db.collection('users').doc(uid).collection('inventory').doc(inventoryId);
        if (status === 'cancelled') {
          transaction.set(inventoryRef, {
            status: 'available',
            shipmentId: admin.firestore.FieldValue.delete(),
            shipmentBatchId: admin.firestore.FieldValue.delete(),
            trackingNumber: admin.firestore.FieldValue.delete(),
            updatedAt
          }, { merge: true });
        } else {
          transaction.set(inventoryRef, { status, trackingNumber: normalizedTrackingNumber, updatedAt }, { merge: true });
        }
      }
    });

    return ok(res);
  } catch (error) {
    return deny(res, error?.status ?? 500, error?.error ?? 'FAILED_TO_MANAGE_SHIPMENT');
  }
}
