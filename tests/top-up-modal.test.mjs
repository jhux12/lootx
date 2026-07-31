import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const topUpModal = await readFile(new URL('../components/TopUpModal.tsx', import.meta.url), 'utf8');

test('closing the top-up modal does not show the remaining-coins reminder', () => {
  assert.doesNotMatch(topUpModal, /coins away from your first box/i);
});
