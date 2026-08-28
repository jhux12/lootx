import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('deposit mission rewards are credited only after server-verified cycle progress', async () => {
  const [claimSource, webhookSource] = await Promise.all([
    readFile(new URL('../api/rewards/claim-deposit-mission.js', import.meta.url), 'utf8'),
    readFile(new URL('../api/stripe-webhook.js', import.meta.url), 'utf8')
  ]);
  assert.match(claimSource, /verifyIdToken/);
  assert.match(claimSource, /depositMissionDepositedCents/);
  assert.match(claimSource, /depositedCents < mission\.targetCents/);
  assert.match(claimSource, /transaction\.create\(claimRef/);
  assert.match(claimSource, /recordBalanceChange/);
  assert.match(webhookSource, /depositMissionDepositedCents/);
  assert.match(webhookSource, /creditedDepositCents/);
});
