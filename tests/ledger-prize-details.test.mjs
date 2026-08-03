import assert from 'node:assert/strict';
import test from 'node:test';

import { appendLedgerEntry } from '../api/_lib/ledger.js';

test('case-open ledger entries preserve the won item details', () => {
  let persistedLedger;
  const transaction = {
    set: (_ref, data) => {
      persistedLedger = data.ledger;
    }
  };

  appendLedgerEntry({
    transaction,
    userRef: {},
    userData: { ledger: [] },
    entry: {
      id: 'open-123',
      userId: 'user-123',
      type: 'case_open',
      amount: -100,
      createdAt: 123,
      prizeName: 'Winning Item',
      prizeImage: 'https://example.com/item.png'
    }
  });

  assert.equal(persistedLedger[0].prizeName, 'Winning Item');
  assert.equal(persistedLedger[0].prizeImage, 'https://example.com/item.png');
});
