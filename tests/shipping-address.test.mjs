import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { interpretShippoValidation, normalizeAddress, normalizeCountryCode, toShippoAddress, validateLocalAddress } from '../api/_lib/shippingAddress.js';

const address = (overrides = {}) => normalizeAddress({ fullName: 'Test Recipient', street1: '1 Main Street', city: 'Test City', postalCode: '10115', countryCode: 'DE', ...overrides });

test('normalizes legacy country names to ISO 3166-1 alpha-2 without rewriting postal formatting', () => {
  const normalized = normalizeAddress({ fullName: ' Test User ', street: ' 123 Main St ', city: 'Lafayette', state: 'IN', zipCode: ' 47905-1234 ', country: 'United States' });
  assert.equal(normalized.street1, '123 Main St'); assert.equal(normalized.postalCode, '47905-1234'); assert.equal(normalized.countryCode, 'US');
  assert.equal(normalizeCountryCode('UK'), 'GB'); assert.equal(normalizeCountryCode('United Kingdom'), 'GB');
});

test('accepts representative US and worldwide shipping addresses', () => {
  const cases = [
    { street1:'1600 Pennsylvania Avenue NW', city:'Washington', state:'DC', postalCode:'20500', countryCode:'US' },
    { street1:'1027 Sauchiehall Street', street2:'Flat 1/2', city:'Glasgow', state:'Scotland', postalCode:'G3 7TZ', countryCode:'GB' },
    { street1:'111 Wellington Street', city:'Ottawa', state:'Ontario', postalCode:'K1A 0A9', countryCode:'CA' },
    { street1:'1 Macquarie Street', city:'Sydney', state:'NSW', postalCode:'2000', countryCode:'AU' },
    { street1:'Pariser Platz 1', city:'Berlin', state:'', postalCode:'10117', countryCode:'DE' },
    { street1:'1-1 Chiyoda', city:'Chiyoda City', state:'Tokyo', postalCode:'100-8111', countryCode:'JP' }
  ];
  for (const value of cases) assert.deepEqual(validateLocalAddress(address(value)), [], value.countryCode);
});

test('UK regression preserves Glasgow fields and sends GB to Shippo', () => {
  const glasgow = address({ street1:'1027 Sauchiehall Street', street2:'Flat 1/2', city:'Glasgow', state:'Scotland', postalCode:'G3 7TZ', countryCode:'UK' });
  assert.deepEqual(validateLocalAddress(glasgow), []);
  assert.deepEqual(toShippoAddress(glasgow), { name:'Test Recipient', street1:'1027 Sauchiehall Street', street2:'Flat 1/2', city:'Glasgow', state:'Scotland', zip:'G3 7TZ', country:'GB' });
});

test('country rules allow omitted optional lines and regions but require destination essentials', () => {
  assert.deepEqual(validateLocalAddress(address({ countryCode:'DE', state:'', street2:'' })), []);
  assert.match(validateLocalAddress(address({ countryCode:'AU', state:'' })).join(' '), /State or province is required/);
  assert.match(validateLocalAddress(address({ countryCode:'CA', state:'' })).join(' '), /State or province is required/);
  assert.match(validateLocalAddress(address({ countryCode:'DE', postalCode:'' })).join(' '), /postal code/);
  assert.match(validateLocalAddress(address({ city:'' })).join(' '), /city or locality/);
  assert.match(validateLocalAddress(address({ street1:'' })).join(' '), /Enter an address/);
  assert.match(validateLocalAddress(address({ countryCode:'' })).join(' '), /Select a country/);
});

test('international postal spaces, hyphens, characters, and optional international phones are preserved', () => {
  for (const value of [
    address({ countryCode:'GB', postalCode:'G3 7TZ', street1:'10 Rue de l’Église', street2:'2e verdieping' }),
    address({ countryCode:'JP', postalCode:'100-8111', street1:'東京都千代田区千代田1-1', phone:'+81 3-3213-1111' }),
    address({ countryCode:'DE', phone:'' })
  ]) assert.deepEqual(validateLocalAddress(value), []);
  assert.equal(toShippoAddress(address({ postalCode:' 10115 ', phone:'+49 30 1234-5678' })).zip, '10115');
  assert.equal(toShippoAddress(address({ phone:'+49 30 1234-5678' })).phone, '+49 30 1234-5678');
});

test('central Shippo mapper supports optional email and omits empty optional fields', () => {
  const mapped = toShippoAddress(address({ state:'', street2:'', phone:'', email:'buyer@example.com' }));
  assert.equal(mapped.zip, '10115'); assert.equal(mapped.country, 'DE'); assert.equal(mapped.email, 'buyer@example.com');
  assert.equal('state' in mapped, false); assert.equal('street2' in mapped, false); assert.equal('phone' in mapped, false);
});

test('Shippo normalized, inconclusive, and explicitly invalid results are distinguished', () => {
  assert.equal(interpretShippoValidation({ validation:{ is_valid:true, messages:[] }, countryCode:'GB', changed:true }).status, 'corrected');
  assert.equal(interpretShippoValidation({ validation:{ is_valid:false, messages:[{ text:'Validation is not supported for this destination.' }] }, countryCode:'GB' }).status, 'inconclusive');
  assert.equal(interpretShippoValidation({ validation:{ is_valid:false, messages:[] }, countryCode:'JP' }).status, 'inconclusive');
  assert.equal(interpretShippoValidation({ validation:{ is_valid:false, messages:[{ code:'invalid_zip', text:'Postal code is invalid.' }] }, countryCode:'GB' }).status, 'invalid');
  assert.equal(interpretShippoValidation({ validation:{ is_valid:false, messages:[] }, countryCode:'US' }).status, 'invalid');
});

test('accepted inconclusive addresses use the same Shippo mapper in the shipping-rate flow', async () => {
  const [rates, save, form] = await Promise.all([
    readFile(new URL('../api/shipping/rates.js', import.meta.url), 'utf8'),
    readFile(new URL('../api/shipping/save-address.js', import.meta.url), 'utf8'),
    readFile(new URL('../components/profile/AccountView.tsx', import.meta.url), 'utf8')
  ]);
  assert.match(save, /attempt\.status === 'inconclusive'/); assert.match(rates, /'corrected', 'inconclusive'/); assert.match(rates, /toShippoAddress\(destination\)/);
  assert.match(form, /Confirm Address/); assert.match(form, /min-h-11 w-full/);
});

test('carrier-invalid addresses can be deliberately saved as unverified', async () => {
  const [save, profile, form] = await Promise.all([
    readFile(new URL('../api/shipping/save-address.js', import.meta.url), 'utf8'),
    readFile(new URL('../components/Profile.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../components/profile/AccountView.tsx', import.meta.url), 'utf8')
  ]);
  assert.doesNotMatch(save, /attempt\.status === 'invalid'\) return/);
  assert.match(save, /attempt\.status === 'invalid' \? 'invalid'/);
  assert.match(profile, /result\.status === 'invalid'/);
  assert.match(form, /validationResult\.attemptId/);
  assert.match(form, /Save Anyway/);
  assert.match(form, /min-h-11 w-full/);
});

test('address autocomplete stays authenticated and shipping secrets remain server-only', async () => {
  const [endpoint, validationEndpoint, form] = await Promise.all([
    readFile(new URL('../api/shipping/address-suggestions.js', import.meta.url), 'utf8'),
    readFile(new URL('../api/shipping/validate-address.js', import.meta.url), 'utf8'),
    readFile(new URL('../components/profile/AccountView.tsx', import.meta.url), 'utf8')
  ]);
  assert.match(endpoint, /verifyIdToken/); assert.match(endpoint, /process\.env\.GEOAPIFY_API_KEY/);
  assert.match(validationEndpoint, /process\.env\.SHIPPO_API_TOKEN/); assert.doesNotMatch(form, /SHIPPO_API_TOKEN|GEOAPIFY_API_KEY/);
  assert.match(form, /Use Suggested Address/); assert.match(form, /min-h-12/); assert.match(form, /role="tablist"/);
});
