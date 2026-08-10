import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { calculateShipmentParcel } from '../api/_lib/parcelCalculator.js';

const profiles = [
  { id: 'raw', slug: 'raw_card', name: 'Raw Card', defaultWeightOz: 1, active: true },
  { id: 'slab', slug: 'graded_slab', name: 'Graded Slab', defaultWeightOz: 5, active: true },
  { id: 'etb', slug: 'etb', name: 'ETB', defaultWeightOz: 32, requiresCustomDimensions: true, active: true }
];
const packages = [
  { id: 'small', name: 'Small Package', lengthIn: 10, widthIn: 8, heightIn: 4, emptyWeightOz: 3, maxItemCount: 5, maxWeightOz: 32, priority: 10, active: true },
  { id: 'medium', name: 'Medium Package', lengthIn: 12, widthIn: 10, heightIn: 6, emptyWeightOz: 5, maxItemCount: 12, maxWeightOz: 80, priority: 20, active: true },
  { id: 'large', name: 'Large Package', lengthIn: 16, widthIn: 12, heightIn: 8, emptyWeightOz: 8, maxItemCount: 30, maxWeightOz: 320, priority: 30, active: true }
];
const items = (profile, count, extra = {}) => Array.from({ length: count }, (_, index) => ({ id: `${profile}-${index}`, shippingProfileId: profile, ...extra }));
const calculate = (selected, packageList = packages, profileList = profiles) => calculateShipmentParcel({ items: selected, shippingProfiles: profileList, shippingPackages: packageList });

test('weight-only raw cards and slabs calculate without profile dimensions', () => {
  const raw = calculate(items('raw', 1));
  assert.equal(raw.status, 'ready'); assert.equal(raw.packageId, 'small'); assert.equal(raw.itemWeightOz, 1); assert.equal(raw.totalWeightOz, 4);
  const slab = calculate(items('slab', 1));
  assert.equal(slab.status, 'ready'); assert.equal(slab.totalWeightOz, 8);
});

test('multiple slabs choose generic packages by count and final weight', () => {
  assert.equal(calculate(items('slab', 3)).packageId, 'small');
  const four = calculate(items('slab', 4));
  assert.equal(four.packageId, 'small'); assert.equal(four.itemWeightOz, 20); assert.equal(four.packagingWeightOz, 3); assert.equal(four.totalWeightOz, 23);
  const six = calculate(items('slab', 6));
  assert.equal(six.packageId, 'medium'); assert.equal(six.totalWeightOz, 35);
  const ten = calculate(items('slab', 10));
  assert.equal(ten.packageId, 'medium'); assert.equal(ten.totalWeightOz, 55);
});

test('package max weight is enforced independently of item count', () => {
  const weightLimited = packages.map((pkg) => pkg.id === 'small' ? { ...pkg, maxItemCount: 10 } : pkg);
  assert.equal(calculate(items('slab', 6), weightLimited).packageId, 'medium');
});

test('raw cards and mixed ordinary profiles use combined weight and count', () => {
  const tenCards = calculate(items('raw', 10));
  assert.equal(tenCards.packageId, 'medium'); assert.equal(tenCards.itemWeightOz, 10); assert.equal(tenCards.totalWeightOz, 15);
  const mixed = calculate([...items('slab', 2), ...items('raw', 5)]);
  assert.equal(mixed.packageId, 'medium'); assert.equal(mixed.itemWeightOz, 15); assert.equal(mixed.totalWeightOz, 20);
});

test('dimension-required items fail cleanly without complete individual dimensions', () => {
  const result = calculate(items('etb', 1));
  assert.equal(result.status, 'invalid_items'); assert.equal(result.errorCode, 'ITEM_DIMENSIONS_REQUIRED');
});

test('dimension-required item with custom dimensions selects a fitting package', () => {
  const result = calculate(items('etb', 1, { shippingOverride: { lengthIn: 11, widthIn: 9, heightIn: 5 } }));
  assert.equal(result.status, 'ready'); assert.equal(result.packageId, 'medium'); assert.equal(result.totalWeightOz, 37);
});

test('dimension-required sealed items can share a fitting package with ordinary items', () => {
  const selected = [...items('etb', 1, { shippingOverride: { lengthIn: 11, widthIn: 9, heightIn: 5 } }), ...items('slab', 2)];
  const result = calculate(selected);
  assert.equal(result.status, 'ready'); assert.equal(result.packageId, 'medium'); assert.equal(result.itemWeightOz, 42); assert.equal(result.totalWeightOz, 47);
});

test('custom weight overrides profile and custom dimensions reject undersized packages', () => {
  const result = calculate(items('slab', 1, { shippingOverride: { weightOz: 9, lengthIn: 14, widthIn: 10, heightIn: 5 } }));
  assert.equal(result.status, 'ready'); assert.equal(result.packageId, 'large'); assert.equal(result.itemWeightOz, 9); assert.equal(result.totalWeightOz, 17);
});

test('explicit profile capacity remains an optional backward-compatible restriction', () => {
  const restricted = packages.map((pkg) => pkg.id === 'small' ? { ...pkg, capacityByProfileId: { slab: 3 } } : pkg);
  assert.equal(calculate(items('slab', 4), restricted).packageId, 'medium');
  const legacySlug = packages.map((pkg) => pkg.id === 'small' ? { ...pkg, capacity: { graded_slab: 3 } } : pkg);
  assert.equal(calculate(items('slab', 4), legacySlug).packageId, 'medium');
});

test('missing profile capacity entry does not reject normal weight-based items', () => {
  const configuredForRawOnly = packages.map((pkg) => pkg.id === 'small' ? { ...pkg, capacityByProfileId: { raw: 5 } } : pkg);
  assert.equal(calculate(items('slab', 1), configuredForRawOnly).packageId, 'small');
});

test('inactive and overweight packages are ignored and no fitting package is controlled', () => {
  const inactiveSmall = packages.map((pkg) => pkg.id === 'small' ? { ...pkg, active: false } : pkg);
  assert.equal(calculate(items('slab', 1), inactiveSmall).packageId, 'medium');
  const noFit = calculate(items('slab', 31));
  assert.equal(noFit.status, 'no_package'); assert.equal(noFit.errorCode, 'NO_PACKAGE_AVAILABLE');
});

test('optional packing buffer is added without changing package dimensions', () => {
  const previous = process.env.PACKING_WEIGHT_BUFFER_OZ; process.env.PACKING_WEIGHT_BUFFER_OZ = '2';
  try { const result = calculate(items('slab', 1)); assert.equal(result.totalWeightOz, 10); assert.equal(result.bufferWeightOz, 2); assert.deepEqual([result.lengthIn, result.widthIn, result.heightIn], [10, 8, 4]); }
  finally { if (previous == null) delete process.env.PACKING_WEIGHT_BUFFER_OZ; else process.env.PACKING_WEIGHT_BUFFER_OZ = previous; }
});

test('server endpoint remains authoritative and Shippo maps calculator parcel dimensions', () => {
  const endpoint = fs.readFileSync('api/shipping/calculate-parcel.js', 'utf8');
  const rates = fs.readFileSync('api/shipping/rates.js', 'utf8');
  const shippo = fs.readFileSync('api/_lib/shippoRates.js', 'utf8');
  assert.match(endpoint, /loadOwnedShippingItems/); assert.match(endpoint, /calculateShipmentParcel/);
  assert.match(rates, /calculateShipmentParcel/); assert.match(shippo, /length: String\(parcel\.lengthIn\)/);
  assert.doesNotMatch(endpoint, /req\.body\?\.(weight|dimensions|packageId)/);
});
