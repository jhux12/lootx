import { admin, db } from '../_lib/firebaseAdmin.js';
import { calculateShipmentParcel } from '../_lib/parcelCalculator.js';
import { requestShippoRates } from '../_lib/shippoRates.js';
import { loadOwnedShippingItems, loadShippingConfig } from '../_lib/shippingData.js';
import { normalizeAddress, toShippoAddress, validateLocalAddress } from '../_lib/shippingAddress.js';
import { loadShippingOrigin } from '../_lib/shippingOrigin.js';
import { deny, ok, requireUser } from '../_utils/auth.js';

const isFree = (item) => item.freeShipping === true || Number(item.shippingCostOverrideCoins ?? Number.NaN) === 0 || item.source === 'xpShop' || item.acquisitionCurrencyType === 'XP' || item.openCurrencyType === 'XP';

export default async function handler(req, res) {
  if (req.method !== 'POST') return deny(res, 405, 'METHOD_NOT_ALLOWED');
  try {
    const { uid } = await requireUser(req); const userRef = db.collection('users').doc(uid); const userSnap = await userRef.get(); const storedAddress = userSnap.data()?.shippingAddress;
    if (!storedAddress || storedAddress.validated !== true || !['valid', 'corrected'].includes(storedAddress.validationStatus)) return deny(res, 409, 'ADDRESS_VERIFICATION_REQUIRED');
    const destination = normalizeAddress(storedAddress); if (validateLocalAddress(destination).length) return deny(res, 409, 'ADDRESS_VERIFICATION_REQUIRED');
    const { itemIds, items } = await loadOwnedShippingItems(uid, req.body?.itemIds); const config = await loadShippingConfig();
    const parcel = calculateShipmentParcel({ items, ...config });
    const allFree = items.every(isFree);
    if (!allFree && parcel.status === 'invalid_items') return deny(res, 422, 'SHIPPING_PROFILE_REQUIRED');
    if (!allFree && parcel.status === 'no_package') {
      const activePackageCount = config.shippingPackages.filter((entry) => entry.active !== false).length;
      return deny(res, 422, activePackageCount === 0 ? 'SHIPPING_PACKAGES_NOT_CONFIGURED' : 'NO_SHIPPING_PACKAGE');
    }
    const origin = allFree ? null : await loadShippingOrigin();
    const rates = allFree ? [{ id: 'free', shippoRateId: 'free', provider: 'Pullz', service: 'Standard Shipping', carrierAmountCents: 0, handlingFeeCents: 0, customerAmountCents: 0, currency: 'USD', attributes: [] }] : await requestShippoRates({ fromAddress: toShippoAddress(origin), toAddress: toShippoAddress(destination), parcel });
    if (!rates.length) return deny(res, 404, 'NO_SHIPPING_RATES');
    const quotedAt = Date.now(); const expiresAt = quotedAt + 15 * 60_000; const quoteRef = userRef.collection('shippingRateQuotes').doc();
    const parcelSnapshot = parcel.status === 'ready' ? { packageId: parcel.packageId, packageName: parcel.packageName, lengthIn: parcel.lengthIn, widthIn: parcel.widthIn, heightIn: parcel.heightIn, itemWeightOz: parcel.itemWeightOz, packagingWeightOz: parcel.packagingWeightOz, totalWeightOz: parcel.totalWeightOz } : null;
    await quoteRef.set({ uid, itemIds, parcel: parcelSnapshot, destinationSnapshot: destination, rates, status: allFree ? 'free_shipping' : 'quoted', createdAt: admin.firestore.FieldValue.serverTimestamp(), quotedAt, expiresAt });
    return ok(res, { status: allFree ? 'free_shipping' : 'quoted', quoteId: quoteRef.id, parcel: parcelSnapshot, destination: { city: destination.city, state: destination.state, postalCode: destination.postalCode, countryCode: destination.countryCode }, rates, quotedAt, expiresAt });
  } catch (error) { return deny(res, error?.status ?? 500, error?.error ?? 'SHIPPING_RATES_UNAVAILABLE'); }
}
