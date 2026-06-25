import { firestore } from './_lib/firebaseAdmin.js';
import { sendJson } from './_lib/http.js';

const toSafeLimit = (value, fallback = 120, max = 250) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(1, Math.min(max, Math.floor(numeric)));
};

const normalizeTimestamp = (value) => {
  if (!value) return undefined;
  if (typeof value.toMillis === 'function') return value.toMillis();
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : undefined;
};

const mapSummary = (doc) => {
  const data = doc.data() || {};
  return {
    id: doc.id,
    name: data.name ?? 'Mystery Box',
    price: Number(data.price ?? 0),
    priceXP: data.priceXP != null ? Number(data.priceXP) : undefined,
    currencyType: data.currencyType,
    image: data.image ?? 'https://picsum.photos/300',
    spinnerBackgroundImage: typeof data.spinnerBackgroundImage === 'string' ? data.spinnerBackgroundImage : undefined,
    accentColor: data.accentColor ?? '#3b82f6',
    tag: data.tag,
    tags: Array.isArray(data.tags) ? data.tags.filter((tag) => typeof tag === 'string') : undefined,
    isDaily: data.isDaily === true,
    isPullPassBox: data.isPullPassBox === true,
    pullPassBoxType: typeof data.pullPassBoxType === 'string' ? data.pullPassBoxType : undefined,
    targetEV: data.targetEV !== undefined ? Number(data.targetEV) : undefined,
    riskLevel: data.riskLevel !== undefined ? Number(data.riskLevel) : undefined,
    isUserCreated: data.isUserCreated === true,
    sellBackRate: data.sellBackRate !== undefined ? Number(data.sellBackRate) : undefined,
    createdAt: normalizeTimestamp(data.createdAt)
  };
};

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return sendJson(res, 405, { error: 'INVALID_REQUEST', message: 'Only GET is allowed for this endpoint.' });
  }

  try {
    const limit = toSafeLimit(req.query?.limit);
    const snapshot = await firestore
      .collection('boxes')
      .orderBy('price', 'asc')
      .limit(limit)
      .select(
        'name',
        'price',
        'priceXP',
        'currencyType',
        'image',
        'spinnerBackgroundImage',
        'accentColor',
        'tag',
        'tags',
        'isDaily',
        'isPullPassBox',
        'pullPassBoxType',
        'targetEV',
        'riskLevel',
        'isUserCreated',
        'sellBackRate',
        'createdAt'
      )
      .get();

    return sendJson(res, 200, { boxes: snapshot.docs.map(mapSummary), limit });
  } catch (error) {
    console.error('Failed to load box summaries', error);
    return sendJson(res, 500, { error: 'BOX_SUMMARIES_FAILED', message: 'Unable to load box summaries.' });
  }
}
