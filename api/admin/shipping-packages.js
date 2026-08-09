import { admin, db } from '../_lib/firebaseAdmin.js';
import { calculateShipmentParcel } from '../_lib/parcelCalculator.js';
import { deny, ok, requireAdmin } from '../_utils/auth.js';

const slugify = (name) => name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 60);
const number = (value, { optional = false, integer = false, max = 100000 } = {}) => { if (optional && (value === '' || value == null)) return undefined; const parsed = Number(value); if (!Number.isFinite(parsed) || parsed < 0 || parsed > max || (integer && !Number.isInteger(parsed))) throw { status: 400, error: 'INVALID_PACKAGE_NUMBER' }; return parsed; };
const sanitize = (raw, existing) => {
  const name = typeof raw?.name === 'string' ? raw.name.trim().slice(0, 100) : ''; if (!name || (!existing?.slug && !slugify(name))) throw { status: 400, error: 'PACKAGE_NAME_REQUIRED' };
  const capacityByProfileId = {}; Object.entries(raw?.capacityByProfileId ?? {}).slice(0, 100).forEach(([id, capacity]) => { if (/^[\w-]{1,120}$/.test(id) && capacity !== '' && capacity != null) capacityByProfileId[id] = number(capacity, { integer: true, max: 10000 }); });
  const maxWeightOz = number(raw.maxWeightOz, { optional: true });
  const maxItemCount = number(raw.maxItemCount, { optional: true, integer: true, max: 10000 });
  return { name, slug: existing?.slug || slugify(name), description: typeof raw.description === 'string' ? raw.description.trim().slice(0, 500) : '', lengthIn: number(raw.lengthIn), widthIn: number(raw.widthIn), heightIn: number(raw.heightIn), emptyWeightOz: number(raw.emptyWeightOz), ...(maxWeightOz == null ? {} : { maxWeightOz }), ...(maxItemCount == null ? {} : { maxItemCount }), priority: number(raw.priority, { integer: true }), capacityByProfileId, active: raw.active !== false };
};
const loadProfiles = async () => (await db.collection('shippingProfiles').get()).docs.map((doc) => ({ id: doc.id, ...doc.data() }));
const loadPackages = async () => (await db.collection('shippingPackages').orderBy('priority').get()).docs.map((doc) => ({ id: doc.id, ...doc.data() }));

export default async function handler(req, res) {
  try {
    await requireAdmin(req); const collection = db.collection('shippingPackages');
    if (req.method === 'GET') return ok(res, { packages: await loadPackages() });
    if (req.method === 'POST' && req.body?.action === 'seed') {
      if (!(await collection.limit(1).get()).empty) return deny(res, 409, 'PACKAGES_ALREADY_EXIST');
      const now = admin.firestore.FieldValue.serverTimestamp(); const presets = [['Small Package',10,8,4,3,5,32,10],['Medium Package',12,10,6,5,12,80,20],['Large Package',16,12,8,8,30,320,30]];
      const batch = db.batch(); presets.forEach(([name,lengthIn,widthIn,heightIn,emptyWeightOz,maxItemCount,maxWeightOz,priority]) => { const ref = collection.doc(); batch.set(ref, { name, slug: slugify(name), description: '', lengthIn, widthIn, heightIn, emptyWeightOz, maxItemCount, maxWeightOz, priority, capacityByProfileId: {}, active: true, createdAt: now, updatedAt: now }); }); await batch.commit(); return ok(res);
    }
    if (req.method === 'POST' && req.body?.action === 'preview') {
      const [profiles, packages] = await Promise.all([loadProfiles(), loadPackages()]); const items = [];
      Object.entries(req.body?.profileCounts ?? {}).slice(0, 100).forEach(([shippingProfileId, count]) => { const safeCount = number(count === '' ? 0 : count, { integer: true, max: 1000 }); for (let index = 0; index < safeCount; index += 1) items.push({ id: `preview-${shippingProfileId}-${index}`, shippingProfileId }); });
      return ok(res, { result: calculateShipmentParcel({ items, shippingProfiles: profiles, shippingPackages: packages }) });
    }
    if (req.method === 'PUT') { const id = typeof req.body?.id === 'string' ? req.body.id.trim().slice(0, 100) : ''; const ref = id ? collection.doc(id) : collection.doc(); const snap = await ref.get(); const now = admin.firestore.FieldValue.serverTimestamp(); await ref.set({ ...sanitize(req.body?.package, snap.data()), ...(snap.exists ? {} : { createdAt: now }), updatedAt: now }, { merge: true }); return ok(res, { id: ref.id }); }
    if (req.method === 'DELETE') { const id = typeof req.query?.id === 'string' ? req.query.id.trim() : ''; if (!id) return deny(res, 400, 'PACKAGE_ID_REQUIRED'); const used = await db.collection('shipments').where('parcel.packageId', '==', id).limit(1).get(); if (!used.empty) return deny(res, 409, 'PACKAGE_IN_USE'); await collection.doc(id).delete(); return ok(res); }
    return deny(res, 405, 'METHOD_NOT_ALLOWED');
  } catch (error) { return deny(res, error?.status ?? 500, error?.error ?? 'SHIPPING_PACKAGE_REQUEST_FAILED'); }
}
