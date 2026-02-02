import Stripe from 'stripe';
import { admin, adminAuth, firestore } from './_lib/firebaseAdmin.js';
import { getBearerToken, readJsonBody, sendJson } from './_lib/http.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const STRIPE_SETTINGS_DOC = 'stripe-settings';

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
    const inventoryIds = Array.isArray(body?.inventoryIds)
      ? body.inventoryIds.filter((id) => typeof id === 'string')
      : typeof body?.inventoryId === 'string'
        ? [body.inventoryId]
        : [];

    if (inventoryIds.length === 0) {
      return sendJson(res, 400, { error: 'Missing inventoryId' });
    }

    const settingsSnap = await firestore.collection('settings').doc(STRIPE_SETTINGS_DOC).get();
    const settings = settingsSnap.data() ?? {};
    const shippingCashEnabled = settings.shippingCashEnabled === true;
    const shippingFlatRateCents = Math.max(0, Math.round(Number(settings.shippingFlatRateCents) || 0));

    if (!shippingCashEnabled) {
      return sendJson(res, 400, { error: 'Cash shipping is disabled' });
    }

    if (!Number.isFinite(shippingFlatRateCents) || shippingFlatRateCents <= 0) {
      return sendJson(res, 400, { error: 'Invalid shipping amount' });
    }

    const userRef = firestore.collection('users').doc(decoded.uid);
    const userSnap = await userRef.get();
    const userData = userSnap.data() ?? {};
    const shippingInfo = userData.shippingAddress;

    if (!shippingInfo || typeof shippingInfo !== 'object') {
      return sendJson(res, 400, { error: 'Missing shipping address' });
    }

    const shipmentBatchId = firestore.collection('shipments').doc().id;
    const shipmentRefs = inventoryIds.map(() => firestore.collection('shipments').doc());
    const inventoryRefs = inventoryIds.map((inventoryId) =>
      userRef.collection('inventory').doc(inventoryId)
    );

    await firestore.runTransaction(async (transaction) => {
      for (let index = 0; index < inventoryRefs.length; index += 1) {
        const inventoryRef = inventoryRefs[index];
        const inventorySnap = await transaction.get(inventoryRef);
        if (!inventorySnap.exists) {
          throw { status: 404, error: 'Inventory item not found' };
        }

        const inventoryItem = inventorySnap.data() ?? {};
        const status = inventoryItem.status ?? 'available';
        if (status !== 'available') {
          throw { status: 400, error: 'Item is not available for shipping' };
        }

        const shipmentRef = shipmentRefs[index];
        transaction.set(shipmentRef, {
          uid: decoded.uid,
          inventoryId: inventoryIds[index],
          item: {
            boxId: inventoryItem.boxId ?? null,
            prizeId: inventoryItem.prizeId ?? null,
            name: inventoryItem.name ?? 'Mystery Item',
            value: Number(inventoryItem.value ?? 0),
            image: inventoryItem.image ?? '',
            rarity: inventoryItem.rarity ?? 'common',
            sellBackRate: Number(inventoryItem.sellBackRate ?? 0.8),
            size: inventoryItem.size ?? null
          },
          shippingInfo,
          shippingPaid: false,
          shippingBatchId,
          status: 'payment_pending',
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }
    });

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      success_url: `${process.env.APP_URL}/inventory?shipping=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.APP_URL}/inventory?shipping=cancel`,
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: { name: 'Shipping & Handling' },
            unit_amount: shippingFlatRateCents
          },
          quantity: inventoryIds.length
        }
      ],
      metadata: {
        userId: decoded.uid,
        shipmentId: shipmentBatchId,
        paymentType: 'shipping',
        shipmentCount: String(inventoryIds.length)
      }
    });

    return sendJson(res, 200, { sessionId: session.id });
  } catch (error) {
    const status = error?.status;
    if (status) {
      return sendJson(res, status, { error: error.error || 'Unable to create checkout session' });
    }
    console.error('create-shipping-checkout-session error', error);
    return sendJson(res, 500, { error: 'Unable to create checkout session' });
  }
}
