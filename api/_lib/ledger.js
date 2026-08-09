const MAX_LEDGER_ENTRIES = 250;

const toFiniteNumber = (value, fallback = 0) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
};

const normalizeLedgerEntry = (entry = {}) => ({
  id: String(entry.id ?? `ledger-${Date.now()}`),
  userId: String(entry.userId ?? ''),
  type: String(entry.type ?? 'admin_adjustment'),
  amount: toFiniteNumber(entry.amount, 0),
  createdAt: toFiniteNumber(entry.createdAt, Date.now()),
  balanceAfter: entry.balanceAfter == null ? undefined : toFiniteNumber(entry.balanceAfter, 0),
  sourceId: entry.sourceId ? String(entry.sourceId) : undefined,
  memo: entry.memo ? String(entry.memo) : undefined,
  prizeName: entry.prizeName ? String(entry.prizeName) : undefined,
  prizeImage: entry.prizeImage ? String(entry.prizeImage) : undefined
});

export const appendLedgerEntry = ({ transaction, userRef, userData, entry, maxEntries = MAX_LEDGER_ENTRIES }) => {
  const existingEntries = Array.isArray(userData?.ledger) ? userData.ledger : [];
  const nextEntries = [normalizeLedgerEntry(entry), ...existingEntries]
    .sort((a, b) => {
      const createdDiff = toFiniteNumber(b.createdAt, 0) - toFiniteNumber(a.createdAt, 0);
      if (createdDiff !== 0) return createdDiff;
      return String(b.id ?? '').localeCompare(String(a.id ?? ''));
    })
    .slice(0, maxEntries);

  transaction.set(userRef, { ledger: nextEntries }, { merge: true });
  return nextEntries;
};
