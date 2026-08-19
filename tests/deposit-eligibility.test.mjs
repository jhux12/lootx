import test from 'node:test';
import assert from 'node:assert/strict';
import { hasUserMadeDeposit } from '../api/_lib/depositEligibility.js';

test('shipping deposit eligibility recognizes every first-deposit offer signal', () => {
  assert.equal(hasUserMadeDeposit({ depositCount: 1 }), true);
  assert.equal(hasUserMadeDeposit({ totalDepositedCents: 100 }), true);
  assert.equal(hasUserMadeDeposit({ totalSpent: 20 }), true);
});

test('shipping remains locked without a valid deposit signal', () => {
  assert.equal(hasUserMadeDeposit({}), false);
  assert.equal(hasUserMadeDeposit({ depositCount: -1, totalDepositedCents: 'invalid', totalSpent: 0 }), false);
});
