import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('registration captures a referral code without the old free-box promo panel', async () => {
  const source = await read('components/LoginModal.tsx');
  assert.match(source, /Referral code/);
  assert.match(source, /pullz_pending_referral_code/);
  assert.doesNotMatch(source, /Create your account to open your free box/);
});

test('referral rewards are deposit-only and fixed at 1,000 coins per account', async () => {
  const source = await read('api/_lib/referrals.js');
  assert.match(source, /const completed = depositQualified;/);
  assert.match(source, /const referrerRewardCoins = 1000;/);
  assert.match(source, /const friendRewardCoins = 1000;/);
  assert.match(source, /const meets = nextTotal > 0;/);
});

test('recent pulls exclude items below 500 coins', async () => {
  const source = await read('src/lib/pulls/useRecentPulls.ts');
  assert.match(source, /entry\.value >= 500/);
});
