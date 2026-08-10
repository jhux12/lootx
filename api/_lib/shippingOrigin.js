import { admin, db } from './firebaseAdmin.js';
import { normalizeAddress, validateLocalAddress } from './shippingAddress.js';

const DEFAULT_ORIGIN = { fullName: 'Pullz.gg', street1: '320 N Meridian St', street2: 'Ste 823 #122', city: 'Indianapolis', state: 'IN', postalCode: '46204-1731', countryCode: 'US', phone: '' };
const fromSettings = (data = {}) => normalizeAddress({ fullName: data.shipFromName, street1: data.shipFromStreet1, street2: data.shipFromStreet2, city: data.shipFromCity, state: data.shipFromState, postalCode: data.shipFromPostalCode, countryCode: data.shipFromCountry, phone: data.shipFromPhone });
const fromEnvironment = () => normalizeAddress({ fullName: process.env.SHIP_FROM_NAME, street1: process.env.SHIP_FROM_STREET1, street2: process.env.SHIP_FROM_STREET2, city: process.env.SHIP_FROM_CITY, state: process.env.SHIP_FROM_STATE, postalCode: process.env.SHIP_FROM_POSTAL_CODE, countryCode: process.env.SHIP_FROM_COUNTRY, phone: process.env.SHIP_FROM_PHONE });
export const validateShippingOrigin = (address) => {
  const messages = validateLocalAddress(address);
  if (address.countryCode === 'US' && !/^[A-Z]{2}$/.test(address.state)) messages.push('A two-letter US state code is required.');
  return messages;
};
export const toShippingOriginSettings = (address) => ({ shipFromName: address.fullName, shipFromStreet1: address.street1, shipFromStreet2: address.street2 || '', shipFromCity: address.city, shipFromState: address.state || '', shipFromPostalCode: address.postalCode, shipFromCountry: address.countryCode, shipFromPhone: address.phone || '' });
export const loadShippingOrigin = async ({ seedDefault = true } = {}) => {
  const ref = db.collection('settings').doc('shipping'); const snapshot = await ref.get();
  if (snapshot.exists) { const address = fromSettings(snapshot.data()); if (validateShippingOrigin(address).length) throw { status: 503, error: 'SHIPPING_ORIGIN_NOT_CONFIGURED' }; return address; }
  const environment = fromEnvironment(); const address = validateShippingOrigin(environment).length === 0 ? environment : DEFAULT_ORIGIN;
  if (seedDefault) await ref.set({ ...toShippingOriginSettings(address), createdAt: admin.firestore.FieldValue.serverTimestamp(), updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: false });
  return address;
};
export { DEFAULT_ORIGIN };
