import Stripe from 'stripe';
import { db } from '../_lib/firebaseAdmin.js';
import { releaseShippingPaymentAttempt } from '../_lib/shippingPayment.js';
import { deny, ok, requireUser } from '../_utils/auth.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') return deny(res, 405, 'METHOD_NOT_ALLOWED');
  try {
    const { uid } = await requireUser(req);
    const attemptId = typeof req.body?.attemptId === 'string' && /^[A-Za-z0-9_-]{1,150}$/.test(req.body.attemptId) ? req.body.attemptId : '';
    if (!attemptId) return deny(res, 400, 'INVALID_PAYMENT_ATTEMPT');
    const ref = db.collection('shippingPaymentAttempts').doc(attemptId);
    const snapshot = await ref.get();
    const attempt = snapshot.data() ?? {};
    if (!snapshot.exists || attempt.uid !== uid) return deny(res, 404, 'SHIPPING_PAYMENT_NOT_FOUND');
    if (attempt.status === 'paid') return ok(res, { status: 'paid', shipmentBatchId: attempt.shipmentBatchId });
    if (attempt.status !== 'pending' || !attempt.stripeCheckoutSessionId) return deny(res, 409, 'SHIPPING_PAYMENT_NOT_AVAILABLE');
    const session = await stripe.checkout.sessions.retrieve(attempt.stripeCheckoutSessionId);
    if (session.payment_status === 'paid' || session.status === 'complete') return ok(res, { status: 'confirming' });
    if (session.status !== 'open') {
      await releaseShippingPaymentAttempt(attemptId, attempt.stripeCheckoutSessionId);
      return deny(res, 409, 'SHIPPING_PAYMENT_EXPIRED');
    }
    return ok(res, { status: 'open', sessionId: attempt.stripeCheckoutSessionId });
  } catch (error) {
    return deny(res, error?.status ?? 500, error?.error ?? 'SHIPPING_CHECKOUT_UNAVAILABLE');
  }
}
