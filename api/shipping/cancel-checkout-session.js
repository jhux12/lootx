import Stripe from 'stripe';
import { db } from '../_lib/firebaseAdmin.js';
import { releaseShippingPaymentAttempt } from '../_lib/shippingPayment.js';
import { deny, ok, requireUser } from '../_utils/auth.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') return deny(res, 405, 'METHOD_NOT_ALLOWED');
  try {
    const { uid } = await requireUser(req);
    const sessionId = typeof req.body?.sessionId === 'string' && /^cs_[A-Za-z0-9_]+$/.test(req.body.sessionId) ? req.body.sessionId : '';
    if (!sessionId) return deny(res, 400, 'INVALID_SESSION_ID');
    const snapshot = await db.collection('shippingPaymentAttempts').where('stripeCheckoutSessionId', '==', sessionId).limit(1).get();
    if (snapshot.empty) return deny(res, 404, 'SHIPPING_PAYMENT_NOT_FOUND');
    const attempt = snapshot.docs[0].data() ?? {};
    if (attempt.uid !== uid) return deny(res, 404, 'SHIPPING_PAYMENT_NOT_FOUND');
    if (attempt.status === 'paid') return deny(res, 409, 'SHIPPING_PAYMENT_ALREADY_COMPLETED');
    if (attempt.status !== 'pending') return ok(res, { released: true });

    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.payment_status === 'paid') return deny(res, 409, 'SHIPPING_PAYMENT_ALREADY_COMPLETED');
    if (session.status === 'complete') return deny(res, 409, 'SHIPPING_PAYMENT_CONFIRMING');
    if (session.status === 'open') await stripe.checkout.sessions.expire(sessionId);
    const released = await releaseShippingPaymentAttempt(snapshot.docs[0].id, sessionId);
    return ok(res, { released });
  } catch (error) { return deny(res, error?.status ?? 500, error?.error ?? 'SHIPPING_CHECKOUT_CANCEL_FAILED'); }
}

