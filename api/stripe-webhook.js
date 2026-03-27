import Stripe from 'stripe';
import { admin, firestore } from './_lib/firebaseAdmin.js';
import { sendJson } from './_lib/http.js';
import { appendLedgerEntry } from './_lib/ledger.js';
import { sendMetaEvent } from './_lib/metaCapi.js';
import { markReferralDepositQualified } from './_lib/referrals.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const readRawBody = async (req) => {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return sendJson(res, 405, { error: 'Method Not Allowed' });
  }

  const signature = req.headers['stripe-signature'];
  if (!signature) {
    return sendJson(res, 400, { error: 'Missing Stripe signature' });
  }

  let event;
  try {
    const rawBody = await readRawBody(req);
    event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (error) {
    console.error('stripe-webhook signature verification failed', error);
    return sendJson(res, 400, { error: 'Invalid signature' });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const metadata = session.metadata ?? {};
    if (metadata.paymentType === 'shipping') {
      const shipmentBatchId = metadata.shipmentId;
      const uid = metadata.userId;
      if (!shipmentBatchId || !uid) {
        console.warn('stripe-webhook missing shipping metadata', { shipmentBatchId, uid });
        return sendJson(res, 200, { received: true });
      }

      const shipmentsSnap = await firestore
        .collection('shipments')
        .where('shippingBatchId', '==', shipmentBatchId)
        .get();

      if (shipmentsSnap.empty) {
        console.warn('stripe-webhook shipment batch not found', { shipmentBatchId });
        return sendJson(res, 200, { received: true });
      }

      const totalAmount = Number(session.amount_total ?? 0);
      const perItemAmount = shipmentsSnap.size > 0 ? Math.round(totalAmount / shipmentsSnap.size) : 0;

      try {
        await firestore.runTransaction(async (transaction) => {
          shipmentsSnap.docs.forEach((docSnap) => {
            const shipmentRef = docSnap.ref;
            const shipmentData = docSnap.data() ?? {};
            if (shipmentData.shippingPaid) {
              return;
            }

            transaction.set(shipmentRef, {
              shippingPaid: true,
              shippingPaymentMethod: 'cash',
              shippingCashAmountCents: perItemAmount,
              stripeCheckoutSessionId: session.id,
              status: 'shipping_requested',
              updatedAt: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });

            const inventoryId = shipmentData.inventoryId;
            if (inventoryId) {
              const inventoryRef = firestore.collection('users').doc(uid).collection('inventory').doc(inventoryId);
              transaction.set(inventoryRef, { status: 'shipping_requested' }, { merge: true });
            }
          });
        });
      } catch (error) {
        console.error('stripe-webhook failed to mark shipping paid', error);
        return sendJson(res, 500, { error: 'Failed to update shipping payment' });
      }

      return sendJson(res, 200, { received: true });
    }

    const uid = metadata.uid;
    const fbp = typeof metadata.fbp === 'string' ? metadata.fbp.trim() : '';
    const fbc = typeof metadata.fbc === 'string' ? metadata.fbc.trim() : '';
    const totalCoins = Number(metadata.coins ?? 0);
    let baseCoins = Number(metadata.baseCoins ?? 0);
    let bonusCoins = Number(metadata.bonusCoins ?? 0);
    const packageId = metadata.packageId ?? null;

    if (!Number.isFinite(baseCoins)) {
      baseCoins = 0;
    }
    if (!Number.isFinite(bonusCoins)) {
      bonusCoins = 0;
    }

    if (!uid || !Number.isFinite(totalCoins) || totalCoins <= 0) {
      console.warn('stripe-webhook missing metadata', { uid, totalCoins, packageId });
      return sendJson(res, 200, { received: true });
    }

    if (baseCoins <= 0 && bonusCoins <= 0) {
      baseCoins = totalCoins;
      bonusCoins = 0;
    }

    const creditRef = firestore.collection('stripe_credits').doc(session.id);
    const userRef = firestore.collection('users').doc(uid);

    try {
      await firestore.runTransaction(async (transaction) => {
        const creditSnap = await transaction.get(creditRef);
        if (creditSnap.exists) {
          return;
        }

        const userSnap = await transaction.get(userRef);
        const userData = userSnap.exists ? userSnap.data() ?? {} : {};
        const currentCoins = Number(userData.coins ?? userData.balance ?? 0) || 0;
        const nextCoins = currentCoins + totalCoins;

        transaction.set(userRef, {
          coins: admin.firestore.FieldValue.increment(totalCoins),
          balance: admin.firestore.FieldValue.increment(totalCoins)
        }, { merge: true });
        appendLedgerEntry({
          transaction,
          userRef,
          userData,
          entry: {
            id: session.id,
            userId: uid,
            type: 'deposit',
            amount: totalCoins,
            createdAt: Date.now(),
            balanceAfter: nextCoins,
            sourceId: session.id,
            memo: packageId ? `Deposit package ${packageId}` : 'Stripe deposit'
          }
        });

        transaction.set(creditRef, {
          uid,
          coins: totalCoins,
          baseCoins,
          bonusCoins,
          packageId,
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
      });
    } catch (error) {
      console.error('stripe-webhook failed to credit coins', error);
      return sendJson(res, 500, { error: 'Failed to credit coins' });
    }


    try {
      await markReferralDepositQualified({ referredUid: uid, depositCoins: totalCoins });
    } catch (referralError) {
      console.error('stripe-webhook failed to evaluate referral deposit qualification', referralError);
    }
    const amountTotal = Number(session.amount_total ?? 0);
    const purchaseValue = Number.isFinite(amountTotal) ? Math.max(0, amountTotal / 100) : 0;
    const eventId = `purchase_${session.id}`;

    try {
      const userSnap = uid ? await firestore.collection('users').doc(uid).get() : null;
      const userData = userSnap?.exists ? userSnap.data() ?? {} : {};
      const email = session.customer_details?.email ?? userData.email ?? null;
      const phone = session.customer_details?.phone ?? userData.phone ?? userData.phoneNumber ?? null;

      const metaResult = await sendMetaEvent({
        req,
        event_name: 'Purchase',
        event_id: eventId,
        event_source_url: `${process.env.APP_URL}/top-up`,
        user: {
          email,
          phone,
          external_id: uid,
          fbp,
          fbc
        },
        custom_data: {
          currency: 'USD',
          value: purchaseValue
        },
        test_event_code: process.env.META_TEST_EVENT_CODE
      });

      if (!metaResult.ok && !metaResult.skipped) {
        console.warn('stripe-webhook meta purchase event failed', {
          eventId,
          status: metaResult.status,
          error: metaResult.error
        });
      }
    } catch (metaError) {
      console.error('stripe-webhook meta purchase event error', {
        eventId,
        message: metaError?.message
      });
    }
  }

  return sendJson(res, 200, { received: true });
}
