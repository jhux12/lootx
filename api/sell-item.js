import { admin, adminAuth, firestore } from './_lib/firebaseAdmin.js';
import { getBearerToken, readJsonBody, sendJson } from './_lib/http.js';
import { applyXpAwardInTransaction, computeXpAward, getXpSettings } from './_lib/xp.js';

const getSellBackValue = (price, rate) => {
  const rawValue = price * rate;
  if (rawValue <= 0) return 0;
  const roundedValue = Math.round(rawValue);
  return Math.min(price, Math.max(1, roundedValue));
};

const isXpPurchasedInventoryItem = (inventoryItem = {}) => (
  inventoryItem.source === 'xpShop'
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

    if (!inventoryId || typeof inventoryId !== 'string') {
      return sendJson(res, 400, { error: 'Missing inventoryId' });
    }

    const userRef = firestore.collection('users').doc(decoded.uid);
    const inventoryRef = userRef.collection('inventory').doc(inventoryId);

    let responsePayload;

    await firestore.runTransaction(async (transaction) => {
      const [userSnap, inventorySnap] = await Promise.all([
        transaction.get(userRef),
        transaction.get(inventoryRef)
      ]);

      if (!inventorySnap.exists) {
        throw { status: 404, error: 'Inventory item not found' };
      }

      const inventoryItem = inventorySnap.data() ?? {};
      const status = inventoryItem.status ?? 'available';
      if (status !== 'available') {
        throw { status: 400, error: 'Item is not available for sale' };
      }
      if (inventoryItem.redeemable === false) {
        throw { status: 400, error: 'Item is not redeemable' };
      }
      if (isXpPurchasedInventoryItem(inventoryItem)) {
        throw { status: 400, error: 'XP reward items cannot be sold' };
      }

      const sellBackRate = Number(inventoryItem.sellBackRate ?? 0.8);
      const itemValue = Number(inventoryItem.value ?? 0);
      const sellBackValue = getSellBackValue(itemValue, sellBackRate);

      const currentCoins = Number(userSnap.data()?.coins ?? 0);
      const newCoins = currentCoins + sellBackValue;

      if (!userSnap.exists) {
        transaction.set(userRef, { coins: 0, createdAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
      }

      transaction.set(userRef, { coins: newCoins }, { merge: true });
      transaction.set(inventoryRef, { status: 'sold' }, { merge: true });

      const settings = await getXpSettings(transaction);
      if (userSnap.data()?.isAdmin !== true || settings.exclusions?.adminOrTestSpinsEarnXp === true) {
        const xpAmount = computeXpAward({
          rule: settings.earnRules?.sellItem,
          amountCoins: sellBackValue,
          bonusRules: settings.bonusRules
        });
        await applyXpAwardInTransaction({ transaction, userRef, xpAmount, actionKey: 'sellItem' });
      }

      responsePayload = {
        ok: true,
        soldValue: sellBackValue,
        newCoins
      };
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
