import Stripe from 'stripe';
import { admin, adminAuth, firestore } from './_lib/firebaseAdmin.js';
import { buildIdempotencyPending, buildIdempotencySuccess, getIdempotencyKey, getIdempotencyRef } from './_lib/idempotency.js';
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
    const idempotencyKey = getIdempotencyKey(body);
    const inventoryIds = Array.isArray(body?.inventoryIds)
      ? body.inventoryIds.filter((id) => typeof id === 'string')
      : typeof body?.inventoryId === 'string'
        ? [body.inventoryId]
        : [];

    if (inventoryIds.length === 0) {
      return sendJson(res, 400, { error: 'No items selected' });
    }

    const idempotencyRef = idempotencyKey ? getIdempotencyRef(decoded.uid, idempotencyKey) : null;
    if (idempotencyRef) {
      const existingSnap = await idempotencyRef.get();
      if (existingSnap.exists) {
        const existingData = existingSnap.data() ?? {};
        const existingPayload = existingData.responsePayload ?? { ok: true };
        if (existingData.status === 'success' || existingData.status === 'pending') {
          return sendJson(res, 200, existingPayload);
        }
      }
    }

    const settingsSnap = await firestore.collection('settings').doc(STRIPE_SETTINGS_DOC).get();
    const settings = settingsSnap.data() ?? {};
    const shippingCashEnabled = settings.shippingCashEnabled === true;
    const shippingFlatRateCents = Math.max(0, Math.round(Number(settings.shippingFlatRateCents) || 0));
    const stripeShippingProductId =
      typeof settings.stripeShippingProductId === 'string' ? settings.stripeShippingProductId : '';
    const usesPriceId = stripeShippingProductId.startsWith('price_');
    const usesProductId = stripeShippingProductId.startsWith('prod_');

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

    // Firestore requires all reads to complete before any writes in a transaction.
    let responsePayload;
    let usedExistingIdempotency = false;
    await firestore.runTransaction(async (transaction) => {
      const [idempotencySnap, userSnap, ...inventorySnaps] = await Promise.all([
        idempotencyRef ? transaction.get(idempotencyRef) : Promise.resolve(null),
        transaction.get(userRef),
        ...inventoryRefs.map((inventoryRef) => transaction.get(inventoryRef))
      ]);

      if (idempotencySnap?.exists) {
        responsePayload = idempotencySnap.data()?.responsePayload ?? { ok: true };
        usedExistingIdempotency = true;
        return;
      }

      if (!userSnap.exists) {
        throw { status: 403, error: 'Unauthorized' };
      }

      const shipmentItems = inventorySnaps.map((inventorySnap, index) => {
        if (!inventorySnap.exists) {
          throw { status: 404, error: 'Item not found' };
        }

        const inventoryItem = inventorySnap.data() ?? {};
        if (inventoryItem.uid && inventoryItem.uid !== decoded.uid) {
          throw { status: 403, error: 'Unauthorized' };
        }

        const status = inventoryItem.status ?? 'available';
        if (status !== 'available' || inventoryItem.shipmentId) {
          throw { status: 400, error: 'Item already in shipment' };
        }

        return { inventoryItem, inventoryId: inventoryIds[index], inventoryRef: inventoryRefs[index] };
      });

      const now = admin.firestore.FieldValue.serverTimestamp();
      shipmentItems.forEach(({ inventoryItem, inventoryId, inventoryRef }, index) => {
        const shipmentRef = shipmentRefs[index];
        transaction.set(shipmentRef, {
          uid: decoded.uid,
          inventoryId,
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
          shippingBatchId: shipmentBatchId,
          status: 'pending_payment',
          createdAt: now
        });

        transaction.set(inventoryRef, {
          status: 'pending_shipment',
          shipmentId: shipmentRef.id,
          shipmentBatchId,
          updatedAt: now
        }, { merge: true });
      });

      responsePayload = {
        ok: true,
        pending: true,
        shipmentBatchId
      };

      if (idempotencyRef) {
        transaction.set(idempotencyRef, buildIdempotencyPending(responsePayload), { merge: true });
      }
    });

    if (usedExistingIdempotency) {
      return sendJson(res, 200, responsePayload);
    }

    console.info('create-shipping-checkout-session', {
      selectedCount: inventoryIds.length,
      shipmentBatchId,
      shippingFlatRateCents,
      shippingTotalCents: shippingFlatRateCents * inventoryIds.length
    });

    const lineItems = usesPriceId
      ? [{ price: stripeShippingProductId, quantity: inventoryIds.length }]
      : [
          {
            price_data: {
              currency: 'usd',
              ...(usesProductId
                ? { product: stripeShippingProductId }
                : { product_data: { name: 'Shipping & Handling' } }),
              unit_amount: shippingFlatRateCents
            },
            quantity: inventoryIds.length
          }
        ];

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      success_url: `${process.env.APP_URL}/inventory?shipping=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.APP_URL}/inventory?shipping=cancel`,
      line_items: lineItems,
      metadata: {
        userId: decoded.uid,
        shipmentId: shipmentBatchId,
        paymentType: 'shipping',
        shipmentCount: String(inventoryIds.length)
      }
    });

    const successPayload = { sessionId: session.id, shipmentBatchId };
    if (idempotencyRef) {
      await idempotencyRef.set(buildIdempotencySuccess(successPayload), { merge: true });
    }

    return sendJson(res, 200, successPayload);
  } catch (error) {
    const status = error?.status;
    if (status) {
      return sendJson(res, status, { error: error.error || 'Unable to create checkout session' });
    }
    console.error('create-shipping-checkout-session error', error);
    return sendJson(res, 500, { error: 'Unable to create checkout session' });
  }
}
