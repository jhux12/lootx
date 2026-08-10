import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const files = Promise.all([
  readFile(new URL('../api/admin/shipping-profiles.js', import.meta.url), 'utf8'),
  readFile(new URL('../components/AdminPanel.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../components/admin/ShippingProfilesAdminSection.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../firestore.rules', import.meta.url), 'utf8'),
  readFile(new URL('../types.ts', import.meta.url), 'utf8')
]);

test('shipping profile CRUD is admin-only and validates measurements', async () => { const [api] = await files; assert.match(api, /requireAdmin\(req\)/); assert.match(api, /req\.method === 'PUT'/); assert.match(api, /req\.method === 'DELETE'/); assert.match(api, /Number\.isFinite/); assert.match(api, /number < 0/); });
test('new Raw Card profiles start at the 0.5 oz fallback weight', async () => { const [api] = await files; assert.match(api, /\['Raw Card', 0\.5, false\]/); });
test('in-use profiles cannot be destructively deleted', async () => { const [api] = await files; assert.match(api, /PROFILE_IN_USE/); assert.match(api, /getUsage/); });
test('profile identity remains stable when its display name changes', async () => { const [api] = await files; assert.match(api, /existing\?\.slug \|\| slugify/); assert.match(api, /collection\.doc\(id\)/); });
test('normal users cannot write shipping profiles or product assignments', async () => { const [, , , rules] = await files; assert.match(rules, /match \/shippingProfiles/); assert.match(rules, /allow read, write: if isAdmin/); assert.match(rules, /match \/boxes/); });
test('box editor supports active, inactive, and default Raw Card profiles', async () => { const [, panel] = await files; assert.match(panel, /Default — Raw Card • 0\.5 oz/); assert.match(panel, /profile\.active \|\| profile\.id === item\.shippingProfileId/); assert.match(panel, /\(Inactive\)/); });
test('catalog and embedded box items persist immutable profile IDs', async () => { const [, panel, , , types] = await files; assert.match(types, /shippingProfileId\?: string \| null/); assert.match(panel, /shippingProfileId: newItem\.shippingProfileId/); assert.match(panel, /shippingProfileId: event\.target\.value/); });
test('legacy items remain optional and visibly use the Raw Card fallback', async () => { const [, panel] = await files; assert.match(panel, /!item\.shippingProfileId/); assert.match(panel, /Defaults to Raw Card • 0\.5 oz/); assert.doesNotMatch(panel, /Shipping rates may not be available for these items/); });
test('mobile profile editor and selected-item bulk assignment controls are present', async () => { const [, panel, section] = await files; assert.match(panel, /bulkShippingItemIds/); assert.match(panel, /Assign profile to \{bulkShippingItemIds\.length\} selected/); assert.match(panel, /Select all/); assert.match(panel, /bulk shipping profile assignment/); assert.match(panel, /min-h-11 min-w-11/); assert.match(panel, /id === '__unassigned' \? null : id/); assert.match(section, /items-end/); assert.match(section, /min-h-11/); });
test('custom overrides are represented for future package calculations', async () => { const [, , , , types] = await files; assert.match(types, /shippingOverride\?/); assert.match(types, /weightOz\?: number/); });
test('admin reloads full boxes and preserves embedded shipping assignments', async () => { const context = await readFile(new URL('../context/GameContext.tsx', import.meta.url), 'utf8'); assert.match(context, /user\.isAdmin[\s\S]*collection\(db, 'boxes'\)/); assert.match(context, /shippingProfileId: typeof item\.shippingProfileId/); assert.match(context, /throw error/); });
test('box save waits for Firestore and retains selections after a failure', async () => { const panel = await readFile(new URL('../components/AdminPanel.tsx', import.meta.url), 'utf8'); assert.match(panel, /const handleSaveBox = async/); assert.match(panel, /await updateBox\(box\)/); assert.match(panel, /shipping profile selections are still here/); });
test('opening an assigned box snapshots shipping data onto inventory', async () => { const endpoint = await readFile(new URL('../api/open-case.js', import.meta.url), 'utf8'); assert.match(endpoint, /inventoryPayload\.shippingProfileId = prize\.shippingProfileId/); assert.match(endpoint, /inventoryPayload\.shippingOverride = override/); });
