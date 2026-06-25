import { firestore } from './_lib/firebaseAdmin.js';
import { sendJson } from './_lib/http.js';
import { normalizeTimestamp, toSafeLimit } from './_lib/boxesPublic.js';

const DEFAULT_LIMIT = 16;
const MAX_LIMIT = 24;
const PUBLIC_RARITIES = new Set(['common', 'uncommon', 'rare', 'epic', 'legendary']);

const toSafeString = (value, fallback = '') => (typeof value === 'string' ? value.trim() : fallback);

const toPublicDisplayName = (data = {}) => {
  if (!data || data.hiddenFromPublicDisplay === true) return 'Player';
  return toSafeString(data.displayName)
    || toSafeString(data.username)
    || toSafeString(data.name)
    || 'Player';
};

const mapOpenDocument = (doc, displayNameByUid) => {
  const data = doc.data() || {};
  const prize = data.prize && typeof data.prize === 'object' ? data.prize : {};
  const rarity = PUBLIC_RARITIES.has(String(prize.rarity || '').toLowerCase())
    ? String(prize.rarity).toLowerCase()
    : 'common';
  const image = toSafeString(prize.image || prize.imageUrl);

  return {
    id: doc.id,
    itemName: toSafeString(prize.name, 'Mystery Item'),
    itemImage: image,
    itemValue: Number(prize.value ?? prize.price ?? 0) || 0,
    rarity,
    boxId: toSafeString(data.boxId),
    boxName: toSafeString(data.boxName, 'Mystery Box'),
    createdAt: normalizeTimestamp(data.createdAt) ?? null,
    displayName: displayNameByUid.get(toSafeString(data.uid)) || 'Player'
  };
};

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return sendJson(res, 405, { error: 'INVALID_REQUEST', message: 'Only GET is allowed for this endpoint.' });
  }

  try {
    const limit = toSafeLimit(req.query?.limit, DEFAULT_LIMIT, MAX_LIMIT);
    const snapshot = await firestore
      .collection('opens')
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get();

    const uids = Array.from(new Set(snapshot.docs
      .map((doc) => toSafeString(doc.data()?.uid))
      .filter(Boolean)));
    const displayNameByUid = new Map();

    if (uids.length) {
      const userSnapshots = await firestore.getAll(...uids.map((uid) => firestore.collection('users').doc(uid)));
      userSnapshots.forEach((userSnapshot) => {
        if (!userSnapshot.exists) return;
        displayNameByUid.set(userSnapshot.id, toPublicDisplayName(userSnapshot.data() || {}));
      });
    }

    const wins = snapshot.docs
      .map((doc) => mapOpenDocument(doc, displayNameByUid))
      .filter((win) => win.itemName && win.boxId && win.createdAt !== null);

    return sendJson(res, 200, { wins });
  } catch (error) {
    console.error('Failed to load public recent wins', error?.message || error);
    return sendJson(res, 500, { error: 'RECENT_WINS_FAILED', message: 'Unable to load recent wins.' });
  }
}
