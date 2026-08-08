import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { normalizeAddress, toShippoAddress, validateLocalAddress } from '../api/_lib/shippingAddress.js';

test('migrates legacy address fields', () => {
  const address = normalizeAddress({ fullName: ' Test User ', street: ' 123 Main St ', city: 'Lafayette', state: 'IN', zipCode: '47905', country: 'United States' });
  assert.equal(address.street1, '123 Main St'); assert.equal(address.postalCode, '47905'); assert.equal(address.countryCode, 'US');
});
test('validates US and Canadian formats', () => {
  assert.deepEqual(validateLocalAddress(normalizeAddress({ fullName:'A', street1:'1 Main', city:'Austin', state:'TX', postalCode:'78701', countryCode:'US' })), []);
  assert.deepEqual(validateLocalAddress(normalizeAddress({ fullName:'A', street1:'1 Main', city:'Toronto', state:'ON', postalCode:'M5V 3A8', countryCode:'CA' })), []);
  assert.ok(validateLocalAddress(normalizeAddress({ fullName:'A', street1:'1 Main', city:'Toronto', state:'ON', postalCode:'wrong', countryCode:'CA' })).length);
});
test('international address does not require a US state', () => {
  assert.deepEqual(validateLocalAddress(normalizeAddress({ fullName:'A', street1:'1 Karl Johans gate', city:'Oslo', postalCode:'0154', countryCode:'NO' })), []);
});
test('central Shippo mapper omits empty optional values', () => {
  const mapped = toShippoAddress(normalizeAddress({ fullName:'A', street1:'1 Main', city:'Oslo', postalCode:'0154', countryCode:'NO' }));
  assert.equal(mapped.zip, '0154'); assert.equal(mapped.country, 'NO'); assert.equal('state' in mapped, false);
});
test('shipment address normalization creates an independent snapshot', () => {
  const profile = { fullName:'A', street1:'Old St', city:'Oslo', postalCode:'0154', countryCode:'NO' };
  const snapshot = normalizeAddress(profile); profile.street1 = 'New St'; assert.equal(snapshot.street1, 'Old St');
});
test('address autocomplete stays authenticated, server-side, and mobile friendly', async () => {
  const [endpoint, form] = await Promise.all([
    readFile(new URL('../api/shipping/address-suggestions.js', import.meta.url), 'utf8'),
    readFile(new URL('../components/profile/AccountView.tsx', import.meta.url), 'utf8')
  ]);
  assert.match(endpoint, /verifyIdToken/); assert.match(endpoint, /process\.env\.GEOAPIFY_API_KEY/);
  assert.doesNotMatch(form, /GEOAPIFY_API_KEY/); assert.match(form, /350/);
  assert.match(form, /Use Suggested Address/); assert.match(form, /min-h-12/); assert.match(form, /role="tablist"/);
});
