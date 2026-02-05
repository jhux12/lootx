import Stripe from 'stripe';
import { adminAuth, firestore } from './_lib/firebaseAdmin.js';
import { buildIdempotencySuccess, getIdempotencyKey, getIdempotencyRef } from './_lib/idempotency.js';
import { getBearerToken, readJsonBody, sendJson } from './_lib/http.js';

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
    const idempotencyKey = getIdempotencyKey(body);
    if (!packageId || typeof packageId !== 'string') {
      return sendJson(res, 400, { error: 'Missing packageId' });
    }

    const idempotencyRef = idempotencyKey ? getIdempotencyRef(decoded.uid, idempotencyKey) : null;
    if (idempotencyRef) {
      const existingSnap = await idempotencyRef.get();
      if (existingSnap.exists && existingSnap.data()?.status === 'success') {
        return sendJson(res, 200, existingSnap.data()?.responsePayload ?? { ok: true });
      }
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
      }
    });

    const responsePayload = { sessionId: session.id };
    if (idempotencyRef) {
      await idempotencyRef.set(buildIdempotencySuccess(responsePayload), { merge: true });
    }

    return sendJson(res, 200, responsePayload);
  } catch (error) {
    console.error('create-checkout-session error', error);
    return sendJson(res, 500, { error: 'Unable to create checkout session' });
  }
}
