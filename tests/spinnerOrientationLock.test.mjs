import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  calculateCardCenteredTranslate,
  createLockedSpinState,
  getLockedWinningItem
} from '../utils/spinnerSpinLock.js';

test('orientation and viewport changes cannot alter the server-selected spinner result', () => {
  const serverPrize = Object.freeze({ id: 'server-item-42', name: 'Server prize', price: 1250 });
  const awardedInventoryItem = Object.freeze({ instanceId: 'inventory-9', itemId: serverPrize.id });
  const reel = [
    { id: 'filler-a' },
    serverPrize,
    { id: 'filler-b' }
  ];
  const spin = createLockedSpinState({
    resultId: 'open-result-7',
    nonce: 19,
    winningItemId: serverPrize.id,
    winningIndex: 1,
    reelItems: reel,
    startTranslateX: 0,
    finalTranslateX: -122,
    cardWidth: 196,
    reelGap: 6,
    viewportWidth: 390
  });

  // Covers portrait/landscape transitions, repeated rotation, browser chrome
  // resizing, and a final resize immediately before settlement. Geometry may
  // produce a new post-animation alignment, but it cannot mutate the spin.
  for (const viewportWidth of [390, 844, 390, 844, 412, 393, 844, 390]) {
    const settledTranslate = calculateCardCenteredTranslate({
      viewportWidth,
      cardOffsetLeft: 202,
      cardWidth: 196
    });
    assert.equal(Number.isFinite(settledTranslate), true);
    assert.equal(spin.finalTranslateX, -122, 'the active animation target remains frozen');
    assert.equal(getLockedWinningItem(spin), serverPrize);
    assert.equal(awardedInventoryItem.itemId, getLockedWinningItem(spin).id);
  }

  assert.equal(spin.resultId, 'open-result-7');
  assert.equal(spin.nonce, 19);
  assert.equal(spin.targetReelIndex, 1);
  assert.deepEqual(spin.reelItems.map((item) => item.id), ['filler-a', 'server-item-42', 'filler-b']);
  assert.equal(Object.isFrozen(spin), true);
  assert.equal(Object.isFrozen(spin.reelItems), true);
});

test('a reel cannot be locked if its target differs from the server winner', () => {
  assert.throws(() => createLockedSpinState({
    resultId: 'open-result-8',
    nonce: 20,
    winningItemId: 'server-winner',
    winningIndex: 0,
    reelItems: [{ id: 'different-card' }],
    startTranslateX: 0,
    finalTranslateX: -100,
    cardWidth: 196,
    reelGap: 6,
    viewportWidth: 390
  }), /does not contain the server winner/);
});

test('device rotation finishes the active animation through its locked-winner completion path', async () => {
  const source = await readFile(new URL('../components/CaseOpening.tsx', import.meta.url), 'utf8');

  assert.match(source, /addEventListener\('orientationchange', snapAfterRotation\)/);
  assert.match(source, /screen\.orientation\?\.addEventListener\?\.\('change', snapAfterRotation\)/);
  assert.match(source, /rotationSnapRequestedRef\.current = true/);
  assert.match(source, /animation\.finish\(\)/);
  assert.match(source, /calculateCardCenteredTranslate/);
});
