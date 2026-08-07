import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { requireVerifiedPhone } from '../api/_utils/phoneVerification.js';

test('verified Firebase phone numbers pass the free reward guard', async () => {
  const phone = await requireVerifiedPhone({
    getUser: async (uid) => ({ uid, phoneNumber: '+15551234567' })
  }, 'user-1');

  assert.equal(phone, '+15551234567');
});

test('unverified users receive a stable phone verification error', async () => {
  await assert.rejects(
    requireVerifiedPhone({ getUser: async () => ({ phoneNumber: null }) }, 'user-2'),
    (error) => error.status === 403
      && error.error === 'PHONE_VERIFICATION_REQUIRED'
      && error.code === 'PHONE_VERIFICATION_REQUIRED'
  );
});

test('daily spin and free box APIs enforce the trusted Firebase phone guard', async () => {
  const [dailySpin, openCase] = await Promise.all([
    readFile(new URL('../api/daily-spin.js', import.meta.url), 'utf8'),
    readFile(new URL('../api/open-case.js', import.meta.url), 'utf8')
  ]);

  assert.match(dailySpin, /await requireVerifiedPhone\(adminAuth, uid\)/);
  assert.match(openCase, /if \(isFree\) await requireVerifiedPhone\(adminAuth, decoded\.uid\)/);
});
