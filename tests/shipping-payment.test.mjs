import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { isValidCents, paymentAttemptIdFor } from '../api/_lib/shippingPaymentValidation.js';

const checkout = fs.readFileSync('api/shipping/create-checkout-session.js', 'utf8');
const webhook = fs.readFileSync('api/stripe-webhook.js', 'utf8');
const payment = fs.readFileSync('api/_lib/shippingPayment.js', 'utf8');
const statusEndpoint = fs.readFileSync('api/shipping/payment-status.js', 'utf8');
const cancelEndpoint = fs.readFileSync('api/shipping/cancel-checkout-session.js', 'utf8');
const resumeEndpoint = fs.readFileSync('api/shipping/resume-checkout-session.js', 'utf8');
const profile = fs.readFileSync('components/Profile.tsx', 'utf8');
const gameContext = fs.readFileSync('context/GameContext.tsx', 'utf8');
const rules = fs.readFileSync('firestore.rules', 'utf8');

test('checkout authenticates and accepts only quote and rate identifiers', () => {
  assert.match(checkout, /requireUser\(req\)/);
  assert.match(checkout, /req\.body\?\.quoteId/); assert.match(checkout, /req\.body\?\.rateId/);
  assert.doesNotMatch(checkout, /req\.body\?\.(price|shippingAmount|weight|dimensions|destination|packageId)/);
});

test('quote ownership, expiration, consumption, and selected rate are server validated', () => {
  assert.match(checkout, /collection\('users'\)\.doc\(uid\)\.collection\('shippingRateQuotes'\)/);
  for (const code of ['SHIPPING_QUOTE_NOT_FOUND', 'SHIPPING_QUOTE_EXPIRED', 'SHIPPING_QUOTE_ALREADY_USED', 'SHIPPING_RATE_INVALID']) assert.match(checkout, new RegExp(code));
  assert.match(checkout, /quote\.rates/); assert.match(checkout, /customerAmountCents/);
});

test('server-owned cents validation rejects malformed amounts', () => {
  assert.equal(isValidCents(992), true); assert.equal(isValidCents(0), false); assert.equal(isValidCents(0, { allowZero: true }), true);
  for (const invalid of [-1, 1.5, Number.NaN, 1_000_001]) assert.equal(isValidCents(invalid), false);
  assert.match(checkout, /unit_amount: checkout\.rate\.customerAmountCents/); assert.match(checkout, /currency: 'usd'/);
});

test('inventory is revalidated and only temporarily locked before payment', () => {
  assert.match(checkout, /SHIPPING_ITEMS_CHANGED/); assert.match(checkout, /status: 'shipping_payment_pending'/);
  assert.match(checkout, /shippingLockExpiresAt/); assert.match(checkout, /shippingPaymentAttemptId/);
  assert.doesNotMatch(checkout, /status: 'shipping_requested'/); assert.doesNotMatch(checkout, /\.delete\(\)/);
});

test('checkout metadata and deterministic idempotency prevent duplicate payable sessions', () => {
  assert.equal(paymentAttemptIdFor('u', 'q', 'r'), paymentAttemptIdFor('u', 'q', 'r'));
  assert.notEqual(paymentAttemptIdFor('u', 'q', 'r'), paymentAttemptIdFor('u', 'q', 'r2'));
  assert.match(checkout, /idempotencyKey: `shipping-\$\{attemptId\}`/);
  for (const key of ['type: \'shipping\'', 'userId: uid', 'quoteId', 'shippoRateId', 'shippingBatchId', 'paymentAttemptId']) assert.match(checkout, new RegExp(key));
  assert.match(checkout, /existing\.stripeCheckoutSessionId/);
});

test('free shipping finalizes securely without creating a zero-dollar Stripe session', () => {
  assert.match(checkout, /if \(checkout\.free\)/); assert.match(checkout, /finalizeShippingPayment/);
  assert.ok(checkout.indexOf('if (checkout.free)') < checkout.indexOf('stripe.checkout.sessions.create'));
});

test('completed webhook validates session, amount, currency and finalizes idempotently', () => {
  assert.match(webhook, /metadata\.type === 'shipping'/); assert.match(webhook, /session\.payment_status !== 'paid'/);
  assert.match(payment, /SHIPPING_PAYMENT_SESSION_MISMATCH/); assert.match(payment, /SHIPPING_PAYMENT_AMOUNT_MISMATCH/); assert.match(payment, /SHIPPING_PAYMENT_CURRENCY_MISMATCH/);
  assert.match(payment, /if \(attempt\.status === 'paid'\)/); assert.match(payment, /shipmentSnapshots\.some\(\(snapshot\) => snapshot\.exists\)/);
});

test('successful payment snapshots shipment and consumes quote without labels or tracking', () => {
  for (const field of ['shippingInfo', 'parcel', 'provider', 'service', 'shippoRateId', 'carrierAmountCents', 'handlingFeeCents', 'shippingCashAmountCents', "shippingPaid: true", "status: 'shipping_requested'"]) assert.match(payment, new RegExp(field));
  assert.match(payment, /status: 'consumed'/); assert.match(payment, /status: 'paid'/);
  assert.doesNotMatch(payment + checkout + webhook, /transactions\.create|purchaseLabel|trackingNumber:/);
});

test('expired Stripe sessions release only matching temporary locks', () => {
  assert.match(webhook, /checkout\.session\.expired/); assert.match(webhook, /releaseShippingPaymentAttempt/);
  assert.match(payment, /item\.shippingPaymentAttemptId === attemptId/); assert.match(payment, /status: 'available'/); assert.match(payment, /status: 'expired'/);
});

test('cancelled checkout is authenticated, expires Stripe session, and releases item locks', () => {
  assert.match(cancelEndpoint, /requireUser\(req\)/); assert.match(cancelEndpoint, /attempt\.uid !== uid/);
  assert.match(cancelEndpoint, /checkout\.sessions\.retrieve/); assert.match(cancelEndpoint, /checkout\.sessions\.expire/);
  assert.match(cancelEndpoint, /releaseShippingPaymentAttempt/); assert.match(profile, /SHIPPING_SESSION_STORAGE_KEY/);
  assert.match(profile, /\/api\/shipping\/cancel-checkout-session/);
});

test('pending inventory exposes mobile-friendly complete payment and cancel shipment actions', () => {
  assert.match(gameContext, /shippingPaymentAttemptId: typeof data\.shippingPaymentAttemptId === 'string'/);
  assert.match(gameContext, /shippingLockExpiresAt: data\.shippingLockExpiresAt/);
  assert.match(profile, /item\.status === 'shipping_payment_pending'/);
  assert.match(profile, /Complete Payment/);
  assert.match(profile, /Cancel Shipment/);
  assert.match(profile, /handlePendingCheckout\(item, 'resume'\)/);
  assert.match(profile, /handlePendingCheckout\(item, 'cancel'\)/);
  assert.match(resumeEndpoint, /requireUser\(req\)/);
  assert.match(resumeEndpoint, /attempt\.uid !== uid/);
  assert.match(resumeEndpoint, /checkout\.sessions\.retrieve/);
});

test('Stripe cancel return carries a server-verifiable attempt and releases it', () => {
  assert.match(checkout, /cancel_url:.*attempt_id=/);
  assert.match(cancelEndpoint, /req\.body\?\.attemptId/);
  assert.match(profile, /params\.get\('attempt_id'\)/);
});

test('payment status is authenticated and owner scoped', () => {
  assert.match(statusEndpoint, /requireUser\(req\)/); assert.match(statusEndpoint, /attempt\.uid !== uid/);
  assert.doesNotMatch(statusEndpoint, /customerAmountCents|addressSnapshot|shippoRateId/);
});

test('client displays USD checkout CTA, pending and paid states without coins', () => {
  assert.doesNotMatch(profile, /Payment will be enabled after live-rate verification/);
  assert.match(profile, /Pay \$\$\{/); assert.match(profile, /Creating secure checkout/);
  assert.match(profile, /Confirming payment/); assert.match(profile, /Payment received/);
  assert.doesNotMatch(profile, /liveRateQuote\.parcel\.packageName|liveRateQuote\.parcel\.lengthIn/);
  const liveCheckout = profile.slice(profile.indexOf('const handleLiveShippingCheckout'), profile.indexOf("const joinedDate"));
  assert.doesNotMatch(liveCheckout, /coin|balance/i); assert.match(liveCheckout, /quoteId: liveRateQuote\.quoteId, rateId: selectedRate\.id/);
});

test('payment records are inaccessible to Firestore clients and legacy Stripe flows remain', () => {
  assert.match(rules, /match \/shippingPaymentAttempts\/\{attemptId\}[\s\S]*allow read, write: if false/);
  assert.match(webhook, /metadata\.paymentType === 'shipping'/); assert.match(webhook, /const totalCoins/);
});
