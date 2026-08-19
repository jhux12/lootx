import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

test('customer shipment records preserve all tracking numbers and refresh in real time', async () => {
  const context = await readFile(new URL('../context/GameContext.tsx', import.meta.url), 'utf8');
  const profile = await readFile(new URL('../components/Profile.tsx', import.meta.url), 'utf8');

  assert.match(context, /trackingNumbers: normalizeTrackingNumbers\(data\.trackingNumbers, data\.trackingNumber\)/);
  assert.match(context, /return onSnapshot\(shipmentsQuery/);
  assert.match(profile, /trackingNumbers\.map\(\(trackingNumber, index\)/);
  assert.match(profile, /break-all text-xs/);
});
