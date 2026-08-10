import { admin, db } from '../_lib/firebaseAdmin.js';
import { loadShippingOrigin, toShippingOriginSettings, validateShippingOrigin } from '../_lib/shippingOrigin.js';
import { normalizeAddress } from '../_lib/shippingAddress.js';
import { deny, ok, requireAdmin } from '../_utils/auth.js';

export default async function handler(req, res) {
  if (!['GET', 'PUT'].includes(req.method)) return deny(res, 405, 'METHOD_NOT_ALLOWED');
  try {
    await requireAdmin(req);
    if (req.method === 'GET') return ok(res, { origin: toShippingOriginSettings(await loadShippingOrigin()) });
    const raw = req.body?.origin ?? {}; const address = normalizeAddress({ fullName: raw.shipFromName, street1: raw.shipFromStreet1, street2: raw.shipFromStreet2, city: raw.shipFromCity, state: raw.shipFromState, postalCode: raw.shipFromPostalCode, countryCode: raw.shipFromCountry, phone: raw.shipFromPhone });
    const messages = validateShippingOrigin(address); if (messages.length) return deny(res, 400, messages[0]);
    await db.collection('settings').doc('shipping').set({ ...toShippingOriginSettings(address), updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
    return ok(res, { origin: toShippingOriginSettings(address) });
  } catch (error) { return deny(res, error?.status ?? 500, error?.error ?? 'SHIPPING_ORIGIN_SAVE_FAILED'); }
}
