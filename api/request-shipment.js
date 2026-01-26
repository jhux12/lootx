import { adminAuth, rtdb } from './_lib/firebaseAdmin.js';
import { getBearerToken, readJsonBody, sendJson } from './_lib/http.js';

const isNonEmptyString = (value) => typeof value === 'string' && value.trim().length > 0;

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
    const address = body?.address;

    if (!inventoryId || typeof inventoryId !== 'string') {
      return sendJson(res, 400, { error: 'Missing inventoryId' });
    }

    const checkedPath = `users/${decoded.uid}/inventory/${inventoryId}`;
    const inventoryRef = rtdb.ref(checkedPath);
    const inventorySnap = await inventoryRef.get();
    const inventoryItem = inventorySnap.val();

    console.info('request-shipment', { uid: decoded.uid, inventoryId, checkedPath });

    if (!inventoryItem) {
      return sendJson(res, 404, { error: 'Inventory item not found', inventoryId, checkedPath });
    }

    if (!address || typeof address !== 'object') {
      return sendJson(res, 400, { error: 'Missing shipping address' });
    }

    const normalizedAddress = {
      fullName: isNonEmptyString(address.fullName) ? address.fullName.trim() : '',
      street: isNonEmptyString(address.street) ? address.street.trim() : '',
      city: isNonEmptyString(address.city) ? address.city.trim() : '',
      state: isNonEmptyString(address.state) ? address.state.trim() : '',
      zipCode: isNonEmptyString(address.zipCode) ? address.zipCode.trim() : '',
      country: isNonEmptyString(address.country) ? address.country.trim() : ''
    };

    if (!Object.values(normalizedAddress).every(isNonEmptyString)) {
      return sendJson(res, 400, { error: 'Incomplete shipping address' });
    }

    const shipmentRef = rtdb.ref('shipments').push();
    const shipmentId = shipmentRef.key;
    const createdAt = Date.now();

    await rtdb.ref().update({
      [`users/${decoded.uid}/inventory/${inventoryId}/status`]: 'shipping',
      [`shipments/${shipmentId}`]: {
        id: shipmentId,
        uid: decoded.uid,
        inventoryId,
        address: normalizedAddress,
        status: 'shipping',
        createdAt
      }
    });

    return sendJson(res, 200, { ok: true, shipmentId });
  } catch (error) {
    console.error('request-shipment error', error);
    return sendJson(res, 500, { error: 'Unable to request shipment' });
  }
}
