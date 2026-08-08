import { db } from '../_lib/firebaseAdmin.js';
import { calculateShipmentParcel } from '../_lib/parcelCalculator.js';
import { deny, ok, requireUser } from '../_utils/auth.js';

let configCache = null;
const loadConfig = async () => {
  if (configCache && Date.now() - configCache.loadedAt < 60_000) return configCache;
  const [profiles, packages] = await Promise.all([db.collection('shippingProfiles').get(), db.collection('shippingPackages').get()]);
  configCache = { loadedAt: Date.now(), shippingProfiles: profiles.docs.map((doc) => ({ id: doc.id, ...doc.data() })), shippingPackages: packages.docs.map((doc) => ({ id: doc.id, ...doc.data() })) }; return configCache;
};
export default async function handler(req, res) {
  if (req.method !== 'POST') return deny(res, 405, 'METHOD_NOT_ALLOWED');
  try {
    const { uid } = await requireUser(req); const rawIds = req.body?.itemIds;
    if (!Array.isArray(rawIds) || rawIds.length < 1 || rawIds.length > 100 || rawIds.some((id) => typeof id !== 'string' || !id.trim())) return deny(res, 400, 'INVALID_ITEM_IDS');
    const itemIds = [...new Set(rawIds.map((id) => id.trim()))]; const refs = itemIds.map((id) => db.collection('users').doc(uid).collection('inventory').doc(id));
    const snapshots = await db.getAll(...refs); if (snapshots.some((snapshot) => !snapshot.exists)) return deny(res, 404, 'INVENTORY_ITEM_NOT_FOUND');
    const items = snapshots.map((snapshot) => ({ id: snapshot.id, ...snapshot.data() }));
    if (items.some((item) => (item.status ?? 'available') !== 'available')) return deny(res, 400, 'ITEM_NOT_ELIGIBLE_FOR_SHIPPING');
    const config = await loadConfig(); return ok(res, { result: calculateShipmentParcel({ items, ...config }) });
  } catch (error) { return deny(res, error?.status ?? 500, error?.error ?? 'PARCEL_CALCULATION_FAILED'); }
}
