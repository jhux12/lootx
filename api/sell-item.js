import { adminAuth, rtdb } from './_lib/firebaseAdmin.js';
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

    if (!inventoryId || typeof inventoryId !== 'string') {
      return sendJson(res, 400, { error: 'Missing inventoryId' });
    }

    const inventoryRef = rtdb.ref(`users/${decoded.uid}/inventory/${inventoryId}`);
    const inventorySnap = await inventoryRef.get();
    const inventoryItem = inventorySnap.val();

    if (!inventoryItem) {
      return sendJson(res, 404, { error: 'Inventory item not found' });
    }

    let sellBackRate = 0.82;
    if (inventoryItem.provenance?.sourceType === 'case_open' && inventoryItem.provenance?.sourceId) {
      const caseSnap = await rtdb.ref(`cases/${inventoryItem.provenance.sourceId}`).get();
      const caseData = caseSnap.val();
      if (caseData?.isUserCreated) {
        sellBackRate = 0.75;
      }
    }

    const itemValue = Number(inventoryItem.value ?? inventoryItem.price ?? 0);
    const sellBackValue = getSellBackValue(itemValue, sellBackRate);

    const coinsRef = rtdb.ref(`users/${decoded.uid}/coins`);
    const coinsResult = await coinsRef.transaction((current) => Number(current ?? 0) + sellBackValue);

    if (!coinsResult.committed) {
      return sendJson(res, 500, { error: 'Unable to apply sell back value' });
    }

    await inventoryRef.remove();

    return sendJson(res, 200, {
      ok: true,
      soldValue: sellBackValue,
      newCoins: coinsResult.snapshot.val()
    });
  } catch (error) {
    console.error('sell-item error', error);
    return sendJson(res, 500, { error: 'Unable to sell item' });
  }
}
