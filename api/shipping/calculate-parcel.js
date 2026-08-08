import { calculateShipmentParcel } from '../_lib/parcelCalculator.js';
import { loadOwnedShippingItems, loadShippingConfig } from '../_lib/shippingData.js';
import { deny, ok, requireUser } from '../_utils/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return deny(res, 405, 'METHOD_NOT_ALLOWED');
  try {
    const { uid } = await requireUser(req); const { items } = await loadOwnedShippingItems(uid, req.body?.itemIds);
    const config = await loadShippingConfig(); return ok(res, { result: calculateShipmentParcel({ items, ...config }) });
  } catch (error) { return deny(res, error?.status ?? 500, error?.error ?? 'PARCEL_CALCULATION_FAILED'); }
}
