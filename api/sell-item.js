import { admin, adminAuth, firestore } from './_lib/firebaseAdmin.js';
import { buildIdempotencySuccess, getIdempotencyKey, getIdempotencyRef } from './_lib/idempotency.js';
import { getBearerToken, readJsonBody, sendJson } from './_lib/http.js';

const getSellBackValue = (price, rate) => {
  const rawValue = price * rate;
  if (rawValue <= 0) return 0;
  const roundedValue = Math.round(rawValue);
  return Math.min(price, Math.max(1, roundedValue));
};

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
    const idempotencyKey = getIdempotencyKey(body);

    if (!inventoryId || typeof inventoryId !== 'string') {
      return sendJson(res, 400, { error: 'Missing inventoryId' });
    }

    const userRef = firestore.collection('users').doc(decoded.uid);
    const inventoryRef = userRef.collection('inventory').doc(inventoryId);
    const idempotencyRef = idempotencyKey ? getIdempotencyRef(decoded.uid, idempotencyKey) : null;

    if (idempotencyRef) {
      const existingSnap = await idempotencyRef.get();
      if (existingSnap.exists && existingSnap.data()?.status === 'success') {
        return sendJson(res, 200, existingSnap.data()?.responsePayload ?? { ok: true });
      }
    }

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

      if (!inventorySnap.exists) {
        throw { status: 404, error: 'Inventory item not found' };
      }

      const inventoryItem = inventorySnap.data() ?? {};
      const status = inventoryItem.status ?? 'available';
      const currentCoins = Number(userSnap.data()?.coins ?? 0);
      if (status !== 'available') {
        if (status === 'sold') {
          responsePayload = {
            ok: true,
            alreadyProcessed: true,
            inventoryId,
            soldValue: 0,
            newCoins: currentCoins
          };
          if (idempotencyRef) {
            transaction.set(idempotencyRef, buildIdempotencySuccess(responsePayload), { merge: true });
          }
          return;
        }
        throw { status: 400, error: 'Item is not available for sale' };
      }
      if (inventoryItem.redeemable === false) {
        throw { status: 400, error: 'Item is not redeemable' };
      }

      const sellBackRate = Number(inventoryItem.sellBackRate ?? 0.8);
      const itemValue = Number(inventoryItem.value ?? 0);
      const sellBackValue = getSellBackValue(itemValue, sellBackRate);

      const newCoins = currentCoins + sellBackValue;

      if (!userSnap.exists) {
        transaction.set(userRef, { coins: 0, createdAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
      }

      transaction.set(userRef, { coins: newCoins }, { merge: true });
      transaction.set(inventoryRef, { status: 'sold' }, { merge: true });

      responsePayload = {
        ok: true,
        inventoryId,
        soldValue: sellBackValue,
        newCoins
      };

      if (idempotencyRef) {
        transaction.set(idempotencyRef, buildIdempotencySuccess(responsePayload), { merge: true });
      }
    });

    return sendJson(res, 200, responsePayload);
  } catch (error) {
    const status = error?.status;
    if (status) {
      return sendJson(res, status, { error: error.error || 'Unable to sell item' });
    }
    console.error('sell-item error', error);
    return sendJson(res, 500, { error: 'Unable to sell item' });
  }
}
