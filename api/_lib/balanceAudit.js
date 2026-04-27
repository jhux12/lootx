import { admin, firestore } from './firebaseAdmin.js';

const ALLOWED_CURRENCIES = new Set(['coins', 'xp']);
const ALLOWED_ACTOR_TYPES = new Set(['user', 'admin', 'system']);

const toInt = (value, fallback = 0) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.floor(parsed);
};

const sanitizeMetadata = (metadata) => {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return {};
  return metadata;
};

const writeBalanceChange = async ({ transaction, uid, currency, amount, reason, actorType, actorUid = null, source, relatedId = null, metadata = {} }) => {
  if (!uid || typeof uid !== 'string') throw new Error('uid is required');
  const normalizedCurrency = String(currency ?? '').toLowerCase();
  if (!ALLOWED_CURRENCIES.has(normalizedCurrency)) throw new Error('currency must be coins or xp');

  const normalizedActorType = String(actorType ?? '').toLowerCase();
  if (!ALLOWED_ACTOR_TYPES.has(normalizedActorType)) throw new Error('actorType must be user, admin, or system');

  const delta = toInt(amount, NaN);
  if (!Number.isFinite(delta) || delta === 0) {
    return { balanceBefore: null, balanceAfter: null, skipped: true };
  }

  const userRef = firestore.collection('users').doc(uid);
  const userSnap = await transaction.get(userRef);
  const userData = userSnap.exists ? userSnap.data() ?? {} : {};

  const balanceField = normalizedCurrency === 'xp' ? 'xpBalance' : 'coins';
  const legacyField = normalizedCurrency === 'xp' ? 'xp' : 'balance';
  const currentBalance = Math.max(0, toInt(userData[balanceField] ?? userData[legacyField], 0));
  const nextBalance = currentBalance + delta;

  const safeMetadata = sanitizeMetadata(metadata);
  const adminOverride = safeMetadata?.adminOverride === true;

  if (nextBalance < 0 && !adminOverride) {
    const missing = Math.abs(nextBalance);
    const err = new Error(`Insufficient ${normalizedCurrency}`);
    err.status = 400;
    err.error = 'INSUFFICIENT_BALANCE';
    err.details = {
      currency: normalizedCurrency,
      balanceBefore: currentBalance,
      attemptedAmount: delta,
      missing
    };
    throw err;
  }

  const patch = normalizedCurrency === 'xp'
    ? { xpBalance: nextBalance, xp: nextBalance }
    : { coins: nextBalance, balance: nextBalance };
  transaction.set(userRef, patch, { merge: true });

  const auditRef = userRef.collection('balanceAudit').doc();
  transaction.set(auditRef, {
    currency: normalizedCurrency,
    reason: typeof reason === 'string' ? reason : 'balance_change',
    amount: delta,
    balanceBefore: currentBalance,
    balanceAfter: nextBalance,
    actorType: normalizedActorType,
    actorUid: actorUid ? String(actorUid) : null,
    source: typeof source === 'string' ? source : '',
    relatedId: relatedId ? String(relatedId) : null,
    metadata: safeMetadata,
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });

  return { balanceBefore: currentBalance, balanceAfter: nextBalance, auditId: auditRef.id, userData };
};

export const recordBalanceChange = async (params) => {
  if (params?.transaction) {
    return writeBalanceChange(params);
  }

  return firestore.runTransaction(async (transaction) => writeBalanceChange({ ...params, transaction }));
};
