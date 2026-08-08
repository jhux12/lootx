import { admin, db } from '../_lib/firebaseAdmin.js';
import { deny, ok, requireAdmin } from '../_utils/auth.js';

const defaults = [
  ['Raw Card', 3, 7, 5, 1, 'card_mailer'], ['Graded Slab', 7, 8, 6, 2, 'slab_small_box'],
  ['Small Sealed', 12, 8, 6, 4, 'small_box'], ['Large Sealed', 32, null, null, null, 'large_box']
];
const slugify = (name) => name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 60);
const finiteNonnegative = (value, optional = false) => {
  if (optional && (value === '' || value === null || value === undefined)) return undefined;
  const number = Number(value); if (!Number.isFinite(number) || number < 0 || number > 10000) throw { status: 400, error: 'INVALID_SHIPPING_MEASUREMENT' };
  return number;
};
const sanitize = (raw, existing) => {
  const name = typeof raw?.name === 'string' ? raw.name.trim().slice(0, 100) : '';
  if (!name) throw { status: 400, error: 'PROFILE_NAME_REQUIRED' };
  if (!existing?.slug && !slugify(name)) throw { status: 400, error: 'PROFILE_NAME_INVALID' };
  const dimensions = { defaultLengthIn: finiteNonnegative(raw.defaultLengthIn, true), defaultWidthIn: finiteNonnegative(raw.defaultWidthIn, true), defaultHeightIn: finiteNonnegative(raw.defaultHeightIn, true) };
  return { name, slug: existing?.slug || slugify(name), description: typeof raw.description === 'string' ? raw.description.trim().slice(0, 500) : '', defaultWeightOz: finiteNonnegative(raw.defaultWeightOz), ...Object.fromEntries(Object.entries(dimensions).filter(([, value]) => value !== undefined)), packageType: typeof raw.packageType === 'string' ? raw.packageType.trim().slice(0, 80) : '', active: raw.active !== false };
};
const getUsage = async () => {
  const [boxes, items] = await Promise.all([db.collection('boxes').get(), db.collection('items').get()]); const usage = new Map();
  const add = (item) => { const id = item?.shippingProfileId; if (typeof id === 'string' && id) usage.set(id, (usage.get(id) ?? 0) + 1); };
  boxes.forEach((snap) => (snap.data()?.items ?? []).forEach(add)); items.forEach((snap) => add(snap.data())); return usage;
};

export default async function handler(req, res) {
  try {
    await requireAdmin(req); const collection = db.collection('shippingProfiles');
    if (req.method === 'GET') {
      const [snapshot, usage] = await Promise.all([collection.orderBy('name').get(), getUsage()]);
      return ok(res, { profiles: snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data(), usageCount: usage.get(doc.id) ?? 0 })) });
    }
    if (req.method === 'POST' && req.body?.action === 'seed') {
      const existing = await collection.limit(1).get(); if (!existing.empty) return deny(res, 409, 'PROFILES_ALREADY_EXIST');
      const batch = db.batch(); const now = admin.firestore.FieldValue.serverTimestamp(); defaults.forEach(([name, weight, length, width, height, packageType]) => { const ref = collection.doc(); batch.set(ref, { ...sanitize({ name, defaultWeightOz: weight, defaultLengthIn: length, defaultWidthIn: width, defaultHeightIn: height, packageType, active: true }), createdAt: now, updatedAt: now }); }); await batch.commit(); return ok(res);
    }
    if (req.method === 'PUT') {
      const id = typeof req.body?.id === 'string' ? req.body.id.trim().slice(0, 100) : ''; const ref = id ? collection.doc(id) : collection.doc(); const snap = await ref.get();
      const data = sanitize(req.body?.profile, snap.data()); const now = admin.firestore.FieldValue.serverTimestamp();
      await ref.set({ ...data, ...(snap.exists ? {} : { createdAt: now }), updatedAt: now }, { merge: true }); return ok(res, { id: ref.id });
    }
    if (req.method === 'DELETE') {
      const id = typeof req.query?.id === 'string' ? req.query.id.trim() : ''; if (!id) return deny(res, 400, 'PROFILE_ID_REQUIRED');
      const usage = await getUsage(); if ((usage.get(id) ?? 0) > 0) return deny(res, 409, `PROFILE_IN_USE:${usage.get(id)}`);
      await collection.doc(id).delete(); return ok(res);
    }
    return deny(res, 405, 'METHOD_NOT_ALLOWED');
  } catch (error) { return deny(res, error?.status ?? 500, error?.error ?? 'SHIPPING_PROFILE_REQUEST_FAILED'); }
}
