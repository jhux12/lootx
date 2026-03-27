import Stripe from 'stripe';
import { adminAuth, firestore } from './_lib/firebaseAdmin.js';
import { getBearerToken, readJsonBody, sendJson } from './_lib/http.js';
import { sendMetaEvent } from './_lib/metaCapi.js';
import { logFinancialTransaction } from './_lib/financialTransactions.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return sendJson(res, 405, { error: 'Method Not Allowed' });
  }

  try {
    const token = getBearerToken(req);
    if (!token) {
      return sendJson(res, 401, { error: 'Missing bearer token' });
    }

    const decoded = await adminAuth.verifyIdToken(token);
    const body = await readJsonBody(req);
    const packageId = body?.packageId;
    const eventId = typeof body?.eventId === 'string' ? body.eventId.trim() : '';
    const fbp = typeof body?.fbp === 'string' ? body.fbp.trim() : '';
    const fbc = typeof body?.fbc === 'string' ? body.fbc.trim() : '';
    const normalizedEventId = eventId || `checkout_${Date.now()}_${decoded.uid.slice(0, 8)}`;
    if (!packageId || typeof packageId !== 'string') {
      return sendJson(res, 400, { error: 'Missing packageId' });
    }

    const packageRef = firestore.collection('coin_packages').doc(packageId);
    const packageSnap = await packageRef.get();
    if (!packageSnap.exists) {
      return sendJson(res, 404, { error: 'Package not found' });
    }

    const data = packageSnap.data() ?? {};
    const active = data.active === true;
    const stripePriceId = data.stripePriceId;
    const baseCoins = Number(data.coins ?? 0);
    const bonusCoins = Number(data.bonusCoins ?? 0);
    const totalCoins = baseCoins + bonusCoins;
    const rawPrice = Number(data.price ?? data.amount ?? data.usdAmount ?? 0);
    const displayPrice = typeof data.displayPrice === 'string' ? data.displayPrice : '';
    const parsedDisplayPrice = Number(displayPrice.replace(/[^0-9.]/g, ''));
    const packageValue = Number.isFinite(rawPrice) && rawPrice > 0
      ? rawPrice
      : (Number.isFinite(parsedDisplayPrice) && parsedDisplayPrice > 0 ? parsedDisplayPrice : 0);

    if (!active) {
      return sendJson(res, 400, { error: 'Package is inactive' });
    }

    if (!stripePriceId || typeof stripePriceId !== 'string' || !stripePriceId.startsWith('price_')) {
      return sendJson(res, 400, { error: 'Invalid Stripe price ID' });
    }

    if (!Number.isFinite(baseCoins) || baseCoins <= 0) {
      return sendJson(res, 400, { error: 'Invalid coin amount' });
    }

    if (!Number.isFinite(bonusCoins) || bonusCoins < 0) {
      return sendJson(res, 400, { error: 'Invalid bonus coins' });
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      success_url: `${process.env.APP_URL}/?topup=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.APP_URL}/?topup=cancel`,
      line_items: [{ price: stripePriceId, quantity: 1 }],
      metadata: {
        uid: decoded.uid,
        packageId,
        baseCoins: String(baseCoins),
        bonusCoins: String(bonusCoins),
        coins: String(totalCoins),
        eventId: normalizedEventId.slice(0, 200),
        fbp: fbp.slice(0, 200),
        fbc: fbc.slice(0, 200)
      }
    });


    await logFinancialTransaction({
      id: `topup_attempt_${normalizedEventId}`,
      type: 'stripe_topup_attempt',
      status: 'pending',
      uid: decoded.uid,
      email: decoded.email ?? null,
      stripeSessionId: session.id,
      dollarAmount: packageValue,
      coinAmount: totalCoins,
      source: 'create_checkout_session',
      notes: packageId
    });
    try {
      const metaResult = await sendMetaEvent({
        req,
        event_name: 'InitiateCheckout',
        event_id: normalizedEventId,
        event_source_url: `${process.env.APP_URL}/top-up`,
        user: {
          email: decoded.email ?? null,
          external_id: decoded.uid,
          fbp,
          fbc
        },
        custom_data: {
          currency: 'USD',
          value: packageValue > 0 ? packageValue : undefined
        },
        test_event_code: process.env.META_TEST_EVENT_CODE
      });

      if (!metaResult.ok && !metaResult.skipped) {
        console.warn('create-checkout-session meta initiate event failed', {
          eventId: normalizedEventId,
          status: metaResult.status,
          error: metaResult.error
        });
      }
    } catch (metaError) {
      console.error('create-checkout-session meta initiate event error', {
        eventId: normalizedEventId,
        message: metaError?.message
      });
    }

    return sendJson(res, 200, { sessionId: session.id });
  } catch (error) {
    console.error('create-checkout-session error', error);
    try {
      const body = await readJsonBody(req);
      await logFinancialTransaction({
        id: `topup_attempt_failed_${Date.now()}`,
        type: 'stripe_topup_attempt',
        status: 'failed',
        uid: null,
        dollarAmount: 0,
        coinAmount: 0,
        source: 'create_checkout_session',
        notes: body?.packageId ? `package:${body.packageId}` : 'Checkout creation failed'
      });
    } catch {}
    return sendJson(res, 500, { error: 'Unable to create checkout session' });
  }
}
