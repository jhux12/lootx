import { admin, firestore } from './firebaseAdmin.js';

export const getIdempotencyKey = (body) => {
  if (!body || typeof body !== 'object') return '';
  const key = body.idempotencyKey;
  if (typeof key !== 'string') return '';
  return key.trim();
};

export const getIdempotencyRef = (uid, key) => firestore.collection('idempotency').doc(`${uid}_${key}`);

export const buildIdempotencySuccess = (payload, extra = {}) => ({
  status: 'success',
  responsePayload: payload,
  createdAt: admin.firestore.FieldValue.serverTimestamp(),
  ...extra
});

export const buildIdempotencyPending = (payload, extra = {}) => ({
  status: 'pending',
  responsePayload: payload,
  createdAt: admin.firestore.FieldValue.serverTimestamp(),
  ...extra
});
