import { admin, firestore } from './firebaseAdmin.js';

export const PROMO_COIN_TTL_MS = 48 * 60 * 60 * 1000;

const toInt = (value, fallback = 0) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.floor(parsed);
};

const toMillis = (value, fallback = 0) => {
  if (value && typeof value.toMillis === 'function') return value.toMillis();
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const getPurchasedCoins = (userData = {}) => Math.max(0, toInt(userData.purchasedCoins ?? userData.coins ?? userData.balance, 0));

export const promoGrantsRef = (uid) => firestore.collection('users').doc(uid).collection('promoCoinGrants');

export const cleanupExpiredPromoGrants = async ({ transaction, uid, now = Date.now() }) => {
  const snapshot = await transaction.get(promoGrantsRef(uid).where('status', '==', 'active'));
  const grants = [];
  snapshot.docs.forEach((docSnap) => {
    const data = docSnap.data() ?? {};
    const remainingAmount = Math.max(0, toInt(data.remainingAmount ?? data.amount, 0));
    const expiresAt = toMillis(data.expiresAt, 0);
    if (remainingAmount <= 0) {
      transaction.set(docSnap.ref, { status: 'used', updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
      return;
    }
    if (expiresAt <= now) {
      transaction.set(docSnap.ref, { status: 'expired', updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
      return;
    }
    grants.push({ id: docSnap.id, ref: docSnap.ref, ...data, remainingAmount, expiresAt });
  });
  return grants.sort((a, b) => a.expiresAt - b.expiresAt);
};

export const calculateAvailableBalance = async ({ transaction, uid, userData, now = Date.now() }) => {
  const grants = await cleanupExpiredPromoGrants({ transaction, uid, now });
  const purchasedCoins = getPurchasedCoins(userData);
  const validPromoCoins = grants.reduce((sum, grant) => sum + Math.max(0, toInt(grant.remainingAmount, 0)), 0);
  return { purchasedCoins, validPromoCoins, promoCoins: validPromoCoins, totalCoins: purchasedCoins + validPromoCoins, activePromoGrants: grants };
};

export const grantPromoCoins = async ({ transaction, uid, amount, source, now = Date.now(), metadata = {} }) => {
  const safeAmount = Math.max(0, toInt(amount, 0));
  if (safeAmount <= 0) throw new Error('Promo grant amount must be positive');
  const ref = promoGrantsRef(uid).doc();
  const expiresAtMs = now + PROMO_COIN_TTL_MS;
  transaction.set(ref, {
    grantId: ref.id,
    source,
    amount: safeAmount,
    remainingAmount: safeAmount,
    createdAt: admin.firestore.Timestamp.fromMillis(now),
    expiresAt: admin.firestore.Timestamp.fromMillis(expiresAtMs),
    status: 'active',
    metadata,
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });
  return { grantId: ref.id, amount: safeAmount, expiresAt: expiresAtMs };
};

export const spendCoinsPromoFirst = async ({ transaction, uid, userRef, userData, amount, relatedId = null, metadata = {} }) => {
  const cost = Math.max(0, toInt(amount, 0));
  const balance = await calculateAvailableBalance({ transaction, uid, userData });
  if (cost <= 0) return { ...balance, spentPromoCoins: 0, spentPurchasedCoins: 0, balanceAfter: balance.totalCoins };
  if (balance.totalCoins < cost) {
    const err = new Error('Not enough coins to open this case.');
    err.status = 402;
    err.error = 'INSUFFICIENT_FUNDS';
    err.details = { coins: balance.totalCoins, price: cost };
    throw err;
  }

  let remainingCost = cost;
  let spentPromoCoins = 0;
  const grantSpends = [];
  for (const grant of balance.activePromoGrants) {
    if (remainingCost <= 0) break;
    const spend = Math.min(remainingCost, grant.remainingAmount);
    if (spend <= 0) continue;
    remainingCost -= spend;
    spentPromoCoins += spend;
    const nextRemaining = grant.remainingAmount - spend;
    transaction.set(grant.ref, {
      remainingAmount: nextRemaining,
      status: nextRemaining > 0 ? 'active' : 'used',
      lastSpentAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    grantSpends.push({ grantId: grant.id, amount: spend, remainingAmount: nextRemaining, expiresAt: grant.expiresAt });
  }

  const spentPurchasedCoins = remainingCost;
  const nextPurchasedCoins = balance.purchasedCoins - spentPurchasedCoins;
  transaction.set(userRef, {
    purchasedCoins: nextPurchasedCoins,
    coins: nextPurchasedCoins,
    balance: nextPurchasedCoins + (balance.validPromoCoins - spentPromoCoins),
    promoCoins: Math.max(0, balance.validPromoCoins - spentPromoCoins),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  }, { merge: true });

  const auditRef = userRef.collection('balanceAudit').doc();
  transaction.set(auditRef, {
    currency: 'coins',
    reason: 'case_open_cost',
    amount: -cost,
    balanceBefore: balance.totalCoins,
    balanceAfter: nextPurchasedCoins + (balance.validPromoCoins - spentPromoCoins),
    actorType: 'user',
    actorUid: uid,
    source: 'api/open-case',
    relatedId,
    metadata: { ...metadata, spentPromoCoins, spentPurchasedCoins, grantSpends },
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });

  return { ...balance, purchasedCoinsAfter: nextPurchasedCoins, spentPromoCoins, spentPurchasedCoins, balanceAfter: nextPurchasedCoins + (balance.validPromoCoins - spentPromoCoins), grantSpends };
};
