import { admin, adminAuth, firestore } from './_lib/firebaseAdmin.js';
import { getBearerToken, readJsonBody, sendJson } from './_lib/http.js';

const STRIPE_SETTINGS_DOC = 'stripe-settings';

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toString = (value, fallback = '') => (typeof value === 'string' ? value : fallback);

const sanitizeSizes = (sizes) =>
  Array.isArray(sizes) ? sizes.filter((size) => typeof size === 'string' && size.trim().length) : [];

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
    const rawBox = body?.box;

    if (!rawBox || typeof rawBox !== 'object') {
      return sendJson(res, 400, { error: 'Missing box payload' });
    }

    const name = toString(rawBox.name).trim();
    const items = Array.isArray(rawBox.items) ? rawBox.items : [];
    if (!name) {
      return sendJson(res, 400, { error: 'Missing box name' });
    }
    if (items.length === 0) {
      return sendJson(res, 400, { error: 'Missing box items' });
    }

    const settingsSnap = await firestore.collection('settings').doc(STRIPE_SETTINGS_DOC).get();
    const settings = settingsSnap.data() ?? {};
    const caseLabPublishFeeCoins = Math.max(0, Math.round(toNumber(settings.caseLabPublishFeeCoins)));

    const userRef = firestore.collection('users').doc(decoded.uid);
    const boxRef = firestore.collection('boxes').doc();
    let newCoins = null;

    await firestore.runTransaction(async (transaction) => {
      const userSnap = await transaction.get(userRef);
      const userData = userSnap.data() ?? {};
      const currentCoins = toNumber(userData.coins ?? userData.balance, 0);

      if (caseLabPublishFeeCoins > 0 && currentCoins < caseLabPublishFeeCoins) {
        throw { status: 400, error: 'Insufficient coins to publish Case Lab box' };
      }

      if (caseLabPublishFeeCoins > 0) {
        newCoins = currentCoins - caseLabPublishFeeCoins;
        transaction.set(userRef, { coins: newCoins }, { merge: true });
      } else {
        newCoins = currentCoins;
      }

      const sanitizedItems = items.map((item) => ({
        id: typeof item?.id === 'string' ? item.id : null,
        name: toString(item?.name, 'Mystery Item'),
        price: toNumber(item?.price ?? item?.value, 0),
        value: toNumber(item?.value ?? item?.price, 0),
        image: toString(item?.image, ''),
        rarity: toString(item?.rarity, 'common'),
        chance: toNumber(item?.chance ?? item?.weight, 0),
        weight: toNumber(item?.weight ?? item?.chance, 0),
        color: toString(item?.color, '#9ca3af'),
        redeemable: item?.redeemable !== false,
        sizes: sanitizeSizes(item?.sizes)
      }));

      transaction.set(boxRef, {
        name,
        price: toNumber(rawBox.price, 0),
        image: toString(rawBox.image, ''),
        accentColor: toString(rawBox.accentColor, '#8b5cf6'),
        tag: toString(rawBox.tag, ''),
        tags: Array.isArray(rawBox.tags) ? rawBox.tags.filter((tag) => typeof tag === 'string') : [],
        items: sanitizedItems,
        targetEV: toNumber(rawBox.targetEV, 0.85),
        riskLevel: toNumber(rawBox.riskLevel, 50),
        sellBackRate: toNumber(rawBox.sellBackRate, 0.75),
        isUserCreated: true,
        createdBy: decoded.uid,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
    });

    return sendJson(res, 200, { ok: true, boxId: boxRef.id, newCoins });
  } catch (error) {
    const status = error?.status;
    if (status) {
      return sendJson(res, status, { error: error.error || 'Unable to publish Case Lab box' });
    }
    console.error('publish-case-lab-box error', error);
    return sendJson(res, 500, { error: 'Unable to publish Case Lab box' });
  }
}
