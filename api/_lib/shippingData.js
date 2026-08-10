import { db } from './firebaseAdmin.js';

let configCache = null;
export const loadShippingConfig = async () => {
  if (configCache && Date.now() - configCache.loadedAt < 60_000) return configCache;
  const [profiles, packages] = await Promise.all([db.collection('shippingProfiles').get(), db.collection('shippingPackages').get()]);
  configCache = { loadedAt: Date.now(), shippingProfiles: profiles.docs.map((doc) => ({ id: doc.id, ...doc.data() })), shippingPackages: packages.docs.map((doc) => ({ id: doc.id, ...doc.data() })) }; return configCache;
};
export const loadOwnedShippingItems = async (uid, rawIds) => {
  if (!Array.isArray(rawIds) || rawIds.length < 1 || rawIds.length > 100 || rawIds.some((id) => typeof id !== 'string' || !id.trim())) throw { status: 400, error: 'INVALID_ITEM_IDS' };
  const itemIds = [...new Set(rawIds.map((id) => id.trim()))];
  const refs = itemIds.map((id) => db.collection('users').doc(uid).collection('inventory').doc(id));
  const snapshots = await db.getAll(...refs); if (snapshots.some((snapshot) => !snapshot.exists)) throw { status: 404, error: 'INVENTORY_ITEM_NOT_FOUND' };
  const items = snapshots.map((snapshot) => ({ id: snapshot.id, ...snapshot.data() }));
  if (items.some((item) => (item.status ?? 'available') !== 'available')) throw { status: 400, error: 'ITEM_NOT_ELIGIBLE_FOR_SHIPPING' };
  return { itemIds, items };
};
