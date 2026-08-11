import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const contextSource = readFile(new URL('../context/GameContext.tsx', import.meta.url), 'utf8');

test('admin catalogue reloads every persisted item without an arbitrary query limit', async () => {
  const source = await contextSource;

  assert.match(source, /onSnapshot\(collection\(db, 'items'\)/);
  assert.doesNotMatch(source, /collection\(db, 'items'\), limit\(500\)/);
});

test('catalogue reload preserves item shipping configuration', async () => {
  const source = await contextSource;

  assert.match(source, /shippingProfileId: typeof data\.shippingProfileId/);
  assert.match(source, /shippingOverride: data\.shippingOverride/);
});
