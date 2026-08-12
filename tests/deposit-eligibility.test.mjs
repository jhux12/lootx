import assert from 'node:assert/strict';
import test from 'node:test';

import { hasUserMadeDeposit, requireShipmentDeposit } from '../api/_lib/depositEligibility.js';

test('shipment deposit eligibility accepts each trusted historical deposit signal', () => {
  assert.equal(hasUserMadeDeposit({ depositCount: 1 }), true);
  assert.equal(hasUserMadeDeposit({ totalDepositedCents: 1 }), true);
  assert.equal(hasUserMadeDeposit({ totalSpent: 1 }), true);
});

test('shipment deposit eligibility rejects missing, invalid, and non-positive signals', () => {
  assert.equal(hasUserMadeDeposit({}), false);
  assert.equal(hasUserMadeDeposit({ depositCount: -1, totalDepositedCents: 'invalid', totalSpent: 0 }), false);
  assert.throws(() => requireShipmentDeposit({}), (error) => error.status === 403 && error.error === 'DEPOSIT_REQUIRED');
});
