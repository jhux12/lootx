import { admin, firestore } from './firebaseAdmin.js';

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const asNullableString = (value) => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

export const buildFinancialTransactionRecord = (input = {}) => {
  const now = Date.now();
  return {
    id: asNullableString(input.id) ?? `fin_${now}_${Math.random().toString(36).slice(2, 8)}`,
    type: asNullableString(input.type) ?? 'unknown',
    status: asNullableString(input.status) ?? 'completed',
    uid: asNullableString(input.uid),
    username: asNullableString(input.username),
    email: asNullableString(input.email),
    stripeSessionId: asNullableString(input.stripeSessionId),
    paymentIntentId: asNullableString(input.paymentIntentId),
    stripeCustomerId: asNullableString(input.stripeCustomerId),
    dollarAmount: toNumber(input.dollarAmount, 0),
    coinAmount: toNumber(input.coinAmount, 0),
    itemId: asNullableString(input.itemId),
    itemName: asNullableString(input.itemName),
    source: asNullableString(input.source),
    boxName: asNullableString(input.boxName),
    notes: asNullableString(input.notes),
    createdAt: input.createdAt ?? admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: input.updatedAt ?? admin.firestore.FieldValue.serverTimestamp()
  };
};

export const logFinancialTransaction = async (input = {}) => {
  const record = buildFinancialTransactionRecord(input);
  const ref = firestore.collection('financial_transactions').doc(record.id);
  await ref.set(record, { merge: true });
  return record.id;
};

export const timestampToMillis = (value) => {
  if (!value) return 0;
  if (typeof value === 'number') return value;
  if (typeof value?.toMillis === 'function') return value.toMillis();
  const parsed = Date.parse(String(value));
  return Number.isFinite(parsed) ? parsed : 0;
};
