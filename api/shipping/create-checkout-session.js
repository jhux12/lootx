import Stripe from 'stripe';
import { admin, db } from '../_lib/firebaseAdmin.js';
import { finalizeShippingPayment, isValidCents, paymentAttemptIdFor, releaseShippingPaymentAttempt, SHIPPING_LOCK_MS } from '../_lib/shippingPayment.js';
import { deny, ok, requireUser } from '../_utils/auth.js';
import { requireShipmentDeposit } from '../_lib/depositEligibility.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const cleanId = (value) => typeof value === 'string' && /^[A-Za-z0-9_-]{1,150}$/.test(value) ? value : '';

export default async function handler(req, res) {
  if (req.method !== 'POST') return deny(res, 405, 'METHOD_NOT_ALLOWED');
  let attemptId = ''; let createdSessionId = ''; let lockedThisRequest = false;
  try {
    const { uid } = await requireUser(req);
    const userSnap = await db.collection('users').doc(uid).get();
    requireShipmentDeposit(userSnap.data() ?? {});
    const quoteId = cleanId(req.body?.quoteId); const rateId = cleanId(req.body?.rateId);
    if (!quoteId || !rateId) return deny(res, 400, 'INVALID_SHIPPING_CHECKOUT_REQUEST');
    attemptId = paymentAttemptIdFor(uid, quoteId, rateId);
    const attemptRef = db.collection('shippingPaymentAttempts').doc(attemptId);
    const quoteRef = db.collection('users').doc(uid).collection('shippingRateQuotes').doc(quoteId);
    const nowMs = Date.now(); const lockExpiresAt = nowMs + SHIPPING_LOCK_MS;
    let checkout;
    await db.runTransaction(async (transaction) => {
      const quoteSnap = await transaction.get(quoteRef);
      if (!quoteSnap.exists || quoteSnap.data()?.uid !== uid) throw { status: 404, error: 'SHIPPING_QUOTE_NOT_FOUND' };
      const quote = quoteSnap.data() ?? {};
      if (quote.status === 'consumed') throw { status: 409, error: 'SHIPPING_QUOTE_ALREADY_USED' };
      if (!Number.isFinite(Number(quote.expiresAt)) || nowMs >= Number(quote.expiresAt)) throw { status: 409, error: 'SHIPPING_QUOTE_EXPIRED' };
      const rate = (quote.rates ?? []).find((entry) => entry.id === rateId || entry.shippoRateId === rateId);
      if (!rate) throw { status: 400, error: 'SHIPPING_RATE_INVALID' };
      const amount = Number(rate.customerAmountCents);
      if (!isValidCents(amount, { allowZero: true }) || rate.currency !== 'USD') throw { status: 400, error: 'SHIPPING_RATE_INVALID' };
      const itemIds = Array.isArray(quote.itemIds) ? quote.itemIds : [];
      if (itemIds.length < 1 || itemIds.length > 100) throw { status: 409, error: 'SHIPPING_ITEMS_CHANGED' };
      const itemRefs = itemIds.map((id) => db.collection('users').doc(uid).collection('inventory').doc(id));
      const attemptSnap = await transaction.get(attemptRef);
      const itemSnaps = await Promise.all(itemRefs.map((ref) => transaction.get(ref)));
      if (attemptSnap.exists) {
        const existing = attemptSnap.data() ?? {};
        if (existing.status === 'paid') throw { status: 409, error: 'SHIPPING_QUOTE_ALREADY_USED' };
        if (existing.status === 'pending' && existing.stripeCheckoutSessionId && existing.expiresAt > nowMs) {
          checkout = { existing: true, free: amount === 0, sessionId: existing.stripeCheckoutSessionId, shipmentBatchId: existing.shipmentBatchId, rate };
          return;
        }
      }
      if (quote.paymentAttemptId && quote.paymentAttemptId !== attemptId) throw { status: 409, error: 'SHIPPING_QUOTE_ALREADY_USED' };
      itemSnaps.forEach((snapshot) => {
        if (!snapshot.exists) throw { status: 409, error: 'SHIPPING_ITEMS_CHANGED' };
        const item = snapshot.data() ?? {}; const status = item.status ?? 'available';
        const ownLock = status === 'shipping_payment_pending' && item.shippingPaymentAttemptId === attemptId;
        const expiredLock = status === 'shipping_payment_pending' && Number(item.shippingLockExpiresAt ?? 0) <= nowMs;
        if ((!ownLock && !expiredLock && status !== 'available') || item.shipmentId || item.locked === true || item.shippable === false || item.soldAt || item.soldBackAt || (item.uid && item.uid !== uid)) throw { status: 409, error: 'SHIPPING_ITEMS_CHANGED' };
      });
      const shipmentBatchId = `ship_${attemptId.slice(0, 28)}`;
      const shipmentIds = itemIds.map((_, index) => `${shipmentBatchId}_${index}`);
      const attempt = {
        uid, quoteId, shippoRateId: rate.shippoRateId, rateId: rate.id, itemIds,
        parcelSnapshot: quote.parcel, addressSnapshot: quote.destinationSnapshot,
        provider: rate.provider, service: rate.service,
        carrierAmountCents: rate.carrierAmountCents, handlingFeeCents: rate.handlingFeeCents,
        customerAmountCents: amount, currency: 'USD', shipmentBatchId, shipmentIds,
        stripeCheckoutSessionId: null, stripePaymentIntentId: null, status: 'pending',
        createdAt: admin.firestore.FieldValue.serverTimestamp(), updatedAt: admin.firestore.FieldValue.serverTimestamp(), expiresAt: lockExpiresAt
      };
      transaction.set(attemptRef, attempt);
      transaction.set(quoteRef, { status: 'payment_pending', paymentAttemptId: attemptId, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
      itemSnaps.forEach((snapshot) => transaction.set(snapshot.ref, { status: 'shipping_payment_pending', shippingPaymentAttemptId: attemptId, shippingLockExpiresAt: lockExpiresAt, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true }));
      checkout = { existing: false, free: amount === 0, sessionId: null, shipmentBatchId, rate };
    });

    lockedThisRequest = !checkout.existing;
    if (checkout.existing && checkout.sessionId) return ok(res, { sessionId: checkout.sessionId, shipmentBatchId: checkout.shipmentBatchId, reused: true });
    if (checkout.free) {
      const finalized = await finalizeShippingPayment({ attemptId, amountTotal: 0, currency: 'usd', free: true });
      return ok(res, { sessionId: null, shipmentBatchId: finalized.shipmentBatchId, freeShipping: true });
    }
    if (!isValidCents(Number(checkout.rate.customerAmountCents))) throw { status: 400, error: 'SHIPPING_RATE_INVALID' };
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
      success_url: `${process.env.APP_URL}/profile?shipping=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.APP_URL}/profile?shipping=cancelled&attempt_id=${encodeURIComponent(attemptId)}`,
      line_items: [{ price_data: { currency: 'usd', unit_amount: checkout.rate.customerAmountCents, product_data: { name: 'Pullz.gg Shipping', description: `${checkout.rate.provider} ${checkout.rate.service}`.slice(0, 200) } }, quantity: 1 }],
      metadata: { type: 'shipping', paymentType: 'live_shipping', userId: uid, quoteId, shippoRateId: checkout.rate.shippoRateId, shippingBatchId: checkout.shipmentBatchId, paymentAttemptId: attemptId }
    }, { idempotencyKey: `shipping-${attemptId}` });
    createdSessionId = session.id;
    await db.collection('shippingPaymentAttempts').doc(attemptId).set({ stripeCheckoutSessionId: session.id, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
    return ok(res, { sessionId: session.id, shipmentBatchId: checkout.shipmentBatchId });
  } catch (error) {
    if (attemptId && lockedThisRequest && !createdSessionId) await releaseShippingPaymentAttempt(attemptId).catch(() => {});
    return deny(res, error?.status ?? 500, error?.error ?? 'SHIPPING_CHECKOUT_UNAVAILABLE');
  }
}
