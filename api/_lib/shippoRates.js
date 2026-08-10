const handlingFee = () => { const value = Number(process.env.SHIPPING_HANDLING_FEE_CENTS ?? 150); return Number.isInteger(value) && value >= 0 && value <= 100000 ? value : 150; };
export const toShippoParcel = (parcel) => ({ length: String(parcel.lengthIn), width: String(parcel.widthIn), height: String(parcel.heightIn), distance_unit: 'in', weight: String(parcel.totalWeightOz), mass_unit: 'oz' });
export const normalizeShippoRates = (rates, feeCents = handlingFee()) => (Array.isArray(rates) ? rates : []).flatMap((rate) => {
  const amount = Number(rate?.amount); const id = typeof rate?.object_id === 'string' ? rate.object_id : ''; const currency = String(rate?.currency ?? '').toUpperCase(); const provider = typeof rate?.provider === 'string' ? rate.provider.trim() : ''; const serviceLevelToken = String(rate?.servicelevel?.token ?? '').trim().toLowerCase(); const service = String(rate?.servicelevel?.name ?? serviceLevelToken).trim();
  if (!id || !provider || !service || !Number.isFinite(amount) || amount < 0 || currency !== 'USD' || rate?.object_state === 'INVALID' || rate?.status === 'unavailable' || rate?.active === false) return [];
  const carrierAmountCents = Math.round(amount * 100); const estimatedDays = Number(rate?.estimated_days);
  return [{ id, shippoRateId: id, provider: provider.slice(0, 80), service: service.slice(0, 120), serviceLevelToken: serviceLevelToken.slice(0, 120), carrierAmountCents, handlingFeeCents: feeCents, customerAmountCents: carrierAmountCents + feeCents, currency, ...(Number.isFinite(estimatedDays) && estimatedDays >= 0 ? { estimatedDays } : {}), ...(typeof rate?.duration_terms === 'string' ? { durationTerms: rate.duration_terms.slice(0, 200) } : {}), ...(typeof rate?.provider_image_75 === 'string' ? { providerImage: rate.provider_image_75 } : {}), attributes: Array.isArray(rate?.attributes) ? rate.attributes.filter((value) => typeof value === 'string').slice(0, 10) : [] }];
}).sort((a, b) => a.customerAmountCents - b.customerAmountCents);
const domesticGroundRate = (rate) => {
  const provider = rate.provider.toLowerCase(); const token = rate.serviceLevelToken.toLowerCase(); const name = rate.service.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  if (provider.includes('usps')) return token === 'usps_ground_advantage' || token === 'ground_advantage' || name === 'ground advantage' || name === 'usps ground advantage';
  if (provider.includes('ups')) return token === 'ups_ground' || token === 'ground' || name === 'ground' || name === 'ups ground';
  return false;
};
export const selectCustomerRates = (rates, destinationCountryCode) => {
  const sorted = [...rates].sort((a, b) => a.customerAmountCents - b.customerAmountCents);
  if (String(destinationCountryCode).toUpperCase() !== 'US') return sorted;
  const cheapestGround = sorted.find(domesticGroundRate); return cheapestGround ? [cheapestGround] : [];
};
export const requestShippoRates = async ({ fromAddress, toAddress, parcel, fetchImpl = fetch }) => {
  const token = process.env.SHIPPO_API_TOKEN; if (!token) throw { status: 503, error: 'SHIPPO_NOT_CONFIGURED' };
  let response;
  try {
    response = await fetchImpl('https://api.goshippo.com/shipments', { method: 'POST', headers: { Authorization: `ShippoToken ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ address_from: fromAddress, address_to: toAddress, parcels: [toShippoParcel(parcel)], async: false }), signal: AbortSignal.timeout(10000) });
  } catch { throw { status: 503, error: 'SHIPPO_UNAVAILABLE' }; }
  if (!response.ok) {
    const details = await response.json().catch(() => ({})); const summary = JSON.stringify(details).toLowerCase();
    const error = response.status === 401 || response.status === 403 ? 'SHIPPO_AUTH_FAILED' : response.status === 400 && summary.includes('custom') ? 'CUSTOMS_DATA_REQUIRED' : response.status === 400 ? 'SHIPPO_RATE_REQUEST_REJECTED' : 'SHIPPO_UNAVAILABLE';
    throw { status: response.status === 400 ? 422 : 503, error };
  }
  const shipment = await response.json(); return normalizeShippoRates(shipment?.rates);
};
