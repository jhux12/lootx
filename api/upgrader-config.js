import { firestore } from './_lib/firebaseAdmin.js';
import { sendJson } from './_lib/http.js';

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return sendJson(res, 405, { ok: false, error: 'Method Not Allowed' });
  }

  try {
    const [settingsSnap, targetsSnap] = await Promise.all([
      firestore.collection('settings').doc('upgrader').get(),
      firestore.collection('items').where('upgraderEnabled', '==', true).get()
    ]);

    const settings = settingsSnap.exists ? settingsSnap.data() ?? {} : {};
    const targets = targetsSnap.docs.map((docSnap) => {
      const data = docSnap.data() ?? {};
      return {
        id: docSnap.id,
        name: String(data.name ?? 'Unknown target'),
        imageUrl: String(data.imageUrl ?? data.image ?? ''),
        coinValue: toNumber(data.coinValue ?? data.value ?? data.price),
        rarity: String(data.rarity ?? 'common'),
        category: String(data.upgraderCategory ?? ''),
        enabled: data.upgraderEnabled === true,
        featured: data.upgraderFeatured === true,
        upgraderSort: data.upgraderSort == null ? undefined : toNumber(data.upgraderSort),
        weight: toNumber(data.weight, 1),
        minSourceValue: data.minSourceValue == null ? undefined : toNumber(data.minSourceValue),
        maxSourceValue: data.maxSourceValue == null ? undefined : toNumber(data.maxSourceValue)
      };
    });

    return sendJson(res, 200, { ok: true, settings, targets });
  } catch (error) {
    console.error('upgrader-config failed', error);
    return sendJson(res, 500, {
      ok: false,
      error: 'Failed to load upgrader config'
    });
  }
}
