import crypto from 'node:crypto';

export const paymentAttemptIdFor = (uid, quoteId, rateId) => crypto.createHash('sha256').update(`${uid}:${quoteId}:${rateId}`).digest('hex');
export const isValidCents = (value, { allowZero = false } = {}) => Number.isInteger(value) && value >= (allowZero ? 0 : 1) && value <= 1_000_000;

