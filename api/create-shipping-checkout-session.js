import Stripe from 'stripe';
import { admin, adminAuth, firestore } from './_lib/firebaseAdmin.js';
import { getBearerToken, readJsonBody, sendJson } from './_lib/http.js';
import { SIGNATURE_REQUIRED_CENTS, getShipmentShippingRate, getShippingProtectionRate } from './_lib/shippingRates.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const STRIPE_SETTINGS_DOC = 'stripe-settings';

const isXpShopInventoryItem = (inventoryItem = {}) => (
  inventoryItem.source === 'xpShop'
  || inventoryItem.acquisitionCurrencyType === 'XP'
  || inventoryItem.openCurrencyType === 'XP'
);

const getInventoryValueCoins = (inventoryItem = {}) => Math.max(
  0,
  Math.round(Number(inventoryItem.price ?? inventoryItem.value ?? inventoryItem.valueCoins ?? 0) || 0)
);

const isFreeShippingInventoryItem = (inventoryItem = {}) => (
  inventoryItem.freeShipping === true
  || Number(inventoryItem.shippingCostOverrideCents ?? NaN) === 0
  || Number(inventoryItem.shippingCostOverrideCoins ?? NaN) === 0
  || isXpShopInventoryItem(inventoryItem)
);

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
    const authUser = await adminAuth.getUser(decoded.uid);
    if (!authUser.email || authUser.emailVerified !== true) {
      return sendJson(res, 403, {
        error: 'EMAIL_VERIFICATION_REQUIRED',
        message: authUser.email
          ? 'Verify your email before requesting shipment.'
          : 'Add and verify an email address before requesting shipment.'
      });
    }

    const body = await readJsonBody(req);
    const inventoryIds = Array.isArray(body?.inventoryIds)
      ? Array.from(new Set(body.inventoryIds.filter((id) => typeof id === 'string' && id.trim()).map((id) => id.trim())))
      : typeof body?.inventoryId === 'string' && body.inventoryId.trim()
        ? [body.inventoryId.trim()]
        : [];
    const wantsShippingProtection = body?.shippingProtection === true;
    const wantsSignatureRequired = body?.signatureRequired === true;

    if (inventoryIds.length === 0) {
      return sendJson(res, 400, { error: 'No items selected' });
    }

    const settingsSnap = await firestore.collection('settings').doc(STRIPE_SETTINGS_DOC).get();
    const settings = settingsSnap.data() ?? {};
    const shippingCashEnabled = settings.shippingCashEnabled === true;
    const stripeShippingProductId =
      typeof settings.stripeShippingProductId === 'string' ? settings.stripeShippingProductId : '';
    const usesProductId = stripeShippingProductId.startsWith('prod_');

    if (!shippingCashEnabled) {
      return sendJson(res, 400, { error: 'Cash shipping is disabled' });
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

    let shippingTotalCents = 0;
    let paidShipmentValueCoins = 0;
    let shippingRateTier = 'Free';

    await firestore.runTransaction(async (transaction) => {
      const [transactionUserSnap, ...inventorySnaps] = await Promise.all([
        transaction.get(userRef),
        ...inventoryRefs.map((inventoryRef) => transaction.get(inventoryRef))
      ]);

      if (!transactionUserSnap.exists) {
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

        return {
          inventoryItem,
          inventoryId: inventoryIds[index],
          inventoryRef: inventoryRefs[index],
          shipmentRef: shipmentRefs[index],
          freeShipping: isFreeShippingInventoryItem(inventoryItem)
        };
      });

      const paidShipmentItems = shipmentItems.filter((item) => !item.freeShipping);
      paidShipmentValueCoins = paidShipmentItems.reduce((sum, item) => sum + getInventoryValueCoins(item.inventoryItem), 0);
      const rate = getShipmentShippingRate(paidShipmentValueCoins);
      const protectionRate = getShippingProtectionRate(paidShipmentValueCoins);
      const shippingProtectionCostCents = paidShipmentItems.length > 0 && wantsShippingProtection ? protectionRate.cashCents : 0;
      const signatureRequiredCostCents = paidShipmentItems.length > 0 && wantsSignatureRequired ? SIGNATURE_REQUIRED_CENTS : 0;
      shippingTotalCents = paidShipmentItems.length > 0 ? rate.cashCents + shippingProtectionCostCents + signatureRequiredCostCents : 0;
      shippingRateTier = paidShipmentItems.length > 0 ? rate.tierLabel : 'Free';
      const firstPaidShipmentId = paidShipmentItems[0]?.shipmentRef.id ?? shipmentRefs[0]?.id;

      const now = admin.firestore.FieldValue.serverTimestamp();
      shipmentItems.forEach(({ inventoryItem, inventoryId, inventoryRef, shipmentRef, freeShipping }) => {
        const hasOutstandingPayment = shippingTotalCents > 0;
        const receivesBatchCharge = hasOutstandingPayment && shipmentRef.id === firstPaidShipmentId;
        transaction.set(shipmentRef, {
          uid: decoded.uid,
          inventoryId,
          item: {
            boxId: inventoryItem.boxId ?? null,
            prizeId: inventoryItem.prizeId ?? null,
            name: inventoryItem.name ?? 'Mystery Item',
            value: Number(inventoryItem.value ?? inventoryItem.price ?? 0),
            image: inventoryItem.image ?? '',
            rarity: inventoryItem.rarity ?? 'common',
            sellBackRate: Number(inventoryItem.sellBackRate ?? 0.8),
            size: inventoryItem.size ?? null
          },
          shippingInfo,
          shippingCost: receivesBatchCharge ? shippingTotalCents : 0,
          shippingBatchCostCents: shippingTotalCents,
          shippingBatchValueCoins: paidShipmentValueCoins,
          shippingProtection: wantsShippingProtection && paidShipmentItems.length > 0,
          shippingProtectionCostCents: receivesBatchCharge ? shippingProtectionCostCents : 0,
          shippingProtectionBatchCostCents: shippingProtectionCostCents,
          shippingProtectionRateTier: shippingProtectionCostCents > 0 ? protectionRate.tierLabel : null,
          signatureRequired: wantsSignatureRequired && paidShipmentItems.length > 0,
          signatureRequiredCostCents: receivesBatchCharge ? signatureRequiredCostCents : 0,
          signatureRequiredBatchCostCents: signatureRequiredCostCents,
          baseShippingCostCents: receivesBatchCharge ? rate.cashCents : 0,
          shippingRateTier,
          shippingPaid: !hasOutstandingPayment,
          shippingPaymentMethod: hasOutstandingPayment ? 'cash' : 'FREE_XP',
          paidAt: hasOutstandingPayment ? null : now,
          shippingBatchId: shipmentBatchId,
          status: hasOutstandingPayment ? 'pending_payment' : 'shipping_requested',
          createdAt: now
        });

        transaction.set(inventoryRef, {
          status: hasOutstandingPayment ? 'pending_shipment' : 'shipping_requested',
          shipmentId: shipmentRef.id,
          shipmentBatchId,
          updatedAt: now
        }, { merge: true });
      });
    });

    console.info('create-shipping-checkout-session', {
      selectedCount: inventoryIds.length,
      shipmentBatchId,
      paidShipmentValueCoins,
      shippingRateTier,
      shippingTotalCents
    });

    if (shippingTotalCents <= 0) {
      return sendJson(res, 200, { ok: true, shipmentBatchId, sessionId: null, fullyCoveredByFreeShipping: true });
    }

    const lineItems = [
      {
        price_data: {
          currency: 'usd',
          ...(usesProductId
            ? { product: stripeShippingProductId }
            : { product_data: { name: `Shipping & Handling${wantsShippingProtection ? ' + Protection' : ''}${wantsSignatureRequired ? ' + Signature' : ''} (${shippingRateTier})` } }),
          unit_amount: shippingTotalCents
        },
        quantity: 1
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
        shipmentCount: '1',
        itemCount: String(inventoryIds.length),
        shippingRateTier,
        paidShipmentValueCoins: String(paidShipmentValueCoins),
        shippingProtection: String(wantsShippingProtection),
        signatureRequired: String(wantsSignatureRequired)
      }
    });

    return sendJson(res, 200, { sessionId: session.id, shipmentBatchId });
  } catch (error) {
    const status = error?.status;
    if (status) {
      return sendJson(res, status, { error: error.error || 'Unable to create checkout session' });
    }
    console.error('create-shipping-checkout-session error', error);
    return sendJson(res, 500, { error: 'Unable to create checkout session' });
  }
}
