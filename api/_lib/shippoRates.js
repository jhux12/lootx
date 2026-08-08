const handlingFee = () => { const value = Number(process.env.SHIPPING_HANDLING_FEE_CENTS ?? 150); return Number.isInteger(value) && value >= 0 && value <= 100000 ? value : 150; };
export const toShippoParcel = (parcel) => ({ length: String(parcel.lengthIn), width: String(parcel.widthIn), height: String(parcel.heightIn), distance_unit: 'in', weight: String(parcel.totalWeightOz), mass_unit: 'oz' });
export const normalizeShippoRates = (rates, feeCents = handlingFee()) => (Array.isArray(rates) ? rates : []).flatMap((rate) => {
  const amount = Number(rate?.amount); const id = typeof rate?.object_id === 'string' ? rate.object_id : ''; const currency = String(rate?.currency ?? '').toUpperCase(); const provider = typeof rate?.provider === 'string' ? rate.provider.trim() : ''; const service = String(rate?.servicelevel?.name ?? rate?.servicelevel?.token ?? '').trim();
  if (!id || !provider || !service || !Number.isFinite(amount) || amount < 0 || currency !== 'USD' || rate?.object_state === 'INVALID' || rate?.status === 'unavailable' || rate?.active === false) return [];
  const carrierAmountCents = Math.round(amount * 100); const estimatedDays = Number(rate?.estimated_days);
  return [{ id, shippoRateId: id, provider: provider.slice(0, 80), service: service.slice(0, 120), carrierAmountCents, handlingFeeCents: feeCents, customerAmountCents: carrierAmountCents + feeCents, currency, ...(Number.isFinite(estimatedDays) && estimatedDays >= 0 ? { estimatedDays } : {}), ...(typeof rate?.duration_terms === 'string' ? { durationTerms: rate.duration_terms.slice(0, 200) } : {}), ...(typeof rate?.provider_image_75 === 'string' ? { providerImage: rate.provider_image_75 } : {}), attributes: Array.isArray(rate?.attributes) ? rate.attributes.filter((value) => typeof value === 'string').slice(0, 10) : [] }];
}).sort((a, b) => a.customerAmountCents - b.customerAmountCents);
export const requestShippoRates = async ({ fromAddress, toAddress, parcel, fetchImpl = fetch }) => {
  const token = process.env.SHIPPO_API_TOKEN; if (!token) throw { status: 503, error: 'SHIPPING_RATES_UNAVAILABLE' };
  const response = await fetchImpl('https://api.goshippo.com/shipments', { method: 'POST', headers: { Authorization: `ShippoToken ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ address_from: fromAddress, address_to: toAddress, parcels: [toShippoParcel(parcel)], async: false }), signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw { status: 503, error: response.status === 400 ? 'CUSTOMS_DATA_REQUIRED' : 'SHIPPING_RATES_UNAVAILABLE' };
  const shipment = await response.json(); return normalizeShippoRates(shipment?.rates);
};
