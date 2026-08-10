import { admin, db } from './firebaseAdmin.js';
export { isValidCents, paymentAttemptIdFor } from './shippingPaymentValidation.js';

export const SHIPPING_LOCK_MS = 31 * 60_000;

const inventoryRef = (uid, id) => db.collection('users').doc(uid).collection('inventory').doc(id);
const attemptRef = (attemptId) => db.collection('shippingPaymentAttempts').doc(attemptId);

export async function releaseShippingPaymentAttempt(attemptId, expectedSessionId = null) {
  const ref = attemptRef(attemptId);
  return db.runTransaction(async (transaction) => {
    const attemptSnap = await transaction.get(ref);
    if (!attemptSnap.exists) return false;
    const attempt = attemptSnap.data() ?? {};
    if (expectedSessionId && attempt.stripeCheckoutSessionId !== expectedSessionId) return false;
    if (attempt.status !== 'pending') return false;
    const refs = (attempt.itemIds ?? []).map((id) => inventoryRef(attempt.uid, id));
    const quoteRef = db.collection('users').doc(attempt.uid).collection('shippingRateQuotes').doc(attempt.quoteId);
    const [quoteSnap, ...snapshots] = await Promise.all([transaction.get(quoteRef), ...refs.map((itemRef) => transaction.get(itemRef))]);
    snapshots.forEach((snapshot) => {
      const item = snapshot.data() ?? {};
      if (item.shippingPaymentAttemptId === attemptId && item.status === 'shipping_payment_pending') {
        transaction.set(snapshot.ref, {
          status: 'available',
          shippingPaymentAttemptId: admin.firestore.FieldValue.delete(),
          shippingLockExpiresAt: admin.firestore.FieldValue.delete(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
      }
    });
    if (quoteSnap.exists && quoteSnap.data()?.paymentAttemptId === attemptId) {
      transaction.set(quoteRef, {
        status: Number(quoteSnap.data()?.expiresAt ?? 0) > Date.now() ? (quoteSnap.data()?.rates?.[0]?.id === 'free' ? 'free_shipping' : 'quoted') : 'expired',
        paymentAttemptId: admin.firestore.FieldValue.delete(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    }
    transaction.set(ref, { status: 'expired', expiredAt: admin.firestore.FieldValue.serverTimestamp(), updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
    return true;
  });
}

export async function finalizeShippingPayment({ attemptId, sessionId = null, paymentIntentId = null, amountTotal, currency, free = false }) {
  const ref = attemptRef(attemptId);
  return db.runTransaction(async (transaction) => {
    const attemptSnap = await transaction.get(ref);
    if (!attemptSnap.exists) throw { status: 404, error: 'SHIPPING_PAYMENT_ATTEMPT_NOT_FOUND' };
    const attempt = attemptSnap.data() ?? {};
    if (attempt.status === 'paid') return { shipmentBatchId: attempt.shipmentBatchId, alreadyProcessed: true };
    if (attempt.status !== 'pending') throw { status: 409, error: 'SHIPPING_PAYMENT_ATTEMPT_INVALID' };
    if (!free) {
      if (attempt.stripeCheckoutSessionId !== sessionId) throw { status: 409, error: 'SHIPPING_PAYMENT_SESSION_MISMATCH' };
      if (Number(amountTotal) !== Number(attempt.customerAmountCents)) throw { status: 409, error: 'SHIPPING_PAYMENT_AMOUNT_MISMATCH' };
      if (String(currency).toLowerCase() !== 'usd' || attempt.currency !== 'USD') throw { status: 409, error: 'SHIPPING_PAYMENT_CURRENCY_MISMATCH' };
    } else if (attempt.customerAmountCents !== 0) throw { status: 409, error: 'SHIPPING_RATE_INVALID' };

    const quoteRef = db.collection('users').doc(attempt.uid).collection('shippingRateQuotes').doc(attempt.quoteId);
    const itemRefs = attempt.itemIds.map((id) => inventoryRef(attempt.uid, id));
    const shipmentRefs = attempt.shipmentIds.map((id) => db.collection('shipments').doc(id));
    const [quoteSnap, ...snapshots] = await Promise.all([
      transaction.get(quoteRef),
      ...itemRefs.map((itemRef) => transaction.get(itemRef)),
      ...shipmentRefs.map((shipmentRef) => transaction.get(shipmentRef))
    ]);
    const itemSnapshots = snapshots.slice(0, itemRefs.length);
    const shipmentSnapshots = snapshots.slice(itemRefs.length);
    if (!quoteSnap.exists) throw { status: 404, error: 'SHIPPING_QUOTE_NOT_FOUND' };
    if (itemSnapshots.some((snapshot) => !snapshot.exists)) throw { status: 409, error: 'SHIPPING_ITEMS_CHANGED' };
    if (shipmentSnapshots.some((snapshot) => snapshot.exists)) {
      if (!shipmentSnapshots.every((snapshot) => snapshot.exists && snapshot.data()?.paymentAttemptId === attemptId)) throw { status: 409, error: 'SHIPPING_SHIPMENT_CONFLICT' };
      transaction.set(quoteRef, { status: 'consumed', consumedAt: admin.firestore.FieldValue.serverTimestamp(), paymentAttemptId: attemptId }, { merge: true });
      transaction.set(ref, { status: 'paid', paidAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
      return { shipmentBatchId: attempt.shipmentBatchId, alreadyProcessed: true };
    }

    const now = admin.firestore.FieldValue.serverTimestamp();
    itemSnapshots.forEach((snapshot, index) => {
      const item = snapshot.data() ?? {};
      if (item.shippingPaymentAttemptId !== attemptId || item.status !== 'shipping_payment_pending') throw { status: 409, error: 'SHIPPING_ITEMS_CHANGED' };
      const shipmentRef = shipmentRefs[index];
      transaction.set(shipmentRef, {
        uid: attempt.uid,
        inventoryId: snapshot.id,
        item: {
          boxId: item.boxId ?? null, prizeId: item.prizeId ?? null, name: item.name ?? 'Mystery Item',
          value: Number(item.value ?? item.price ?? 0), image: item.image ?? '', rarity: item.rarity ?? 'common',
          sellBackRate: Number(item.sellBackRate ?? 0.8), size: item.size ?? null
        },
        shippingInfo: attempt.addressSnapshot,
        parcel: attempt.parcelSnapshot,
        provider: attempt.provider,
        service: attempt.service,
        shippoRateId: attempt.shippoRateId,
        carrierAmountCents: attempt.carrierAmountCents,
        handlingFeeCents: attempt.handlingFeeCents,
        shippingCost: index === 0 ? attempt.customerAmountCents : 0,
        shippingBatchCostCents: attempt.customerAmountCents,
        shippingCashAmountCents: index === 0 ? attempt.customerAmountCents : 0,
        shippingPaymentMethod: free ? 'FREE_XP' : 'cash',
        shippingPaid: true,
        stripeCheckoutSessionId: sessionId,
        stripePaymentIntentId: paymentIntentId,
        shippingBatchId: attempt.shipmentBatchId,
        quoteId: attempt.quoteId,
        paymentAttemptId: attemptId,
        status: 'shipping_requested',
        paidAt: now,
        createdAt: now,
        updatedAt: now
      });
      transaction.set(snapshot.ref, {
        status: 'shipping_requested',
        shipmentId: shipmentRef.id,
        shipmentBatchId: attempt.shipmentBatchId,
        shippingPaymentAttemptId: admin.firestore.FieldValue.delete(),
        shippingLockExpiresAt: admin.firestore.FieldValue.delete(),
        updatedAt: now
      }, { merge: true });
    });
    transaction.set(quoteRef, { status: 'consumed', consumedAt: now, paymentAttemptId: attemptId, updatedAt: now }, { merge: true });
    transaction.set(ref, { status: 'paid', stripePaymentIntentId: paymentIntentId, paidAt: now, updatedAt: now }, { merge: true });
    return { shipmentBatchId: attempt.shipmentBatchId, alreadyProcessed: false };
  });
}
