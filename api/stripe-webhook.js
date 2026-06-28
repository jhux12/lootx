import Stripe from 'stripe';
import { admin, firestore } from './_lib/firebaseAdmin.js';
import { sendJson } from './_lib/http.js';
import { appendLedgerEntry } from './_lib/ledger.js';
import { sendMetaEvent } from './_lib/metaCapi.js';
import { markReferralDepositQualified } from './_lib/referrals.js';
import { recordBalanceChange } from './_lib/balanceAudit.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const readRawBody = async (req) => {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
};


const serializeMetaError = (result) => {
  if (!result) return null;
  const error = result.error ?? result.reason ?? result.status ?? null;
  if (!error) return null;
  if (typeof error === 'string') return error.slice(0, 1000);
  try {
    return JSON.stringify(error).slice(0, 1000);
  } catch {
    return String(error).slice(0, 1000);
  }
};

const updateDepositTrackingState = async ({ creditRef, legacyCreditRef, stripePaymentId, patch }) => {
  if (!patch || Object.keys(patch).length === 0) return;
  await firestore.runTransaction(async (transaction) => {
    const creditSnap = await transaction.get(creditRef);
    const shouldReadLegacy = legacyCreditRef && legacyCreditRef.id !== stripePaymentId;
    const legacySnap = shouldReadLegacy ? await transaction.get(legacyCreditRef) : null;

    if (creditSnap.exists) {
      transaction.set(creditRef, patch, { merge: true });
    }
    if (legacySnap?.exists) {
      transaction.set(legacyCreditRef, patch, { merge: true });
    }
  });
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

      try {
        await firestore.runTransaction(async (transaction) => {
          let assignedBatchPayment = false;
          shipmentsSnap.docs.forEach((docSnap) => {
            const shipmentRef = docSnap.ref;
            const shipmentData = docSnap.data() ?? {};
            if (shipmentData.shippingPaid) {
              return;
            }

            const receivesBatchPayment = !assignedBatchPayment;
            assignedBatchPayment = true;

            transaction.set(shipmentRef, {
              shippingPaid: true,
              shippingPaymentMethod: 'cash',
              shippingCashAmountCents: receivesBatchPayment ? totalAmount : 0,
              shippingBatchPaidAmountCents: totalAmount,
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

    if (session.payment_status && session.payment_status !== 'paid') {
      console.warn('stripe-webhook ignoring unpaid checkout session', {
        sessionId: session.id,
        paymentStatus: session.payment_status
      });
      return sendJson(res, 200, { received: true });
    }

    const uid = metadata.uid;
    const fbp = typeof metadata.fbp === 'string' ? metadata.fbp.trim() : '';
    const fbc = typeof metadata.fbc === 'string' ? metadata.fbc.trim() : '';
    const totalCoins = Number(metadata.coins ?? 0);
    let baseCoins = Number(metadata.baseCoins ?? 0);
    let bonusCoins = Number(metadata.bonusCoins ?? 0);
    const packageId = metadata.packageId ?? null;
    const sessionCurrency = typeof session.currency === 'string' ? session.currency.toUpperCase() : 'USD';
    const amountTotalCents = Number(session.amount_total ?? 0);

    let packageName = null;
    let stripePriceId = null;
    if (packageId) {
      try {
        const packageSnap = await firestore.collection('coin_packages').doc(String(packageId)).get();
        if (packageSnap.exists) {
          const packageData = packageSnap.data() ?? {};
          const rawName = packageData.name ?? packageData.title ?? packageData.displayName ?? null;
          packageName = typeof rawName === 'string' && rawName.trim() ? rawName.trim() : null;
          stripePriceId = typeof packageData.stripePriceId === 'string' && packageData.stripePriceId.trim()
            ? packageData.stripePriceId.trim()
            : null;
        }
      } catch (packageError) {
        console.warn('stripe-webhook failed to read package metadata', {
          packageId,
          message: packageError?.message
        });
      }
    }

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

    const stripePaymentId = typeof session.payment_intent === 'string' && session.payment_intent.trim()
      ? session.payment_intent.trim()
      : session.id;
    const creditRef = firestore.collection('stripe_credits').doc(stripePaymentId);
    const legacyCreditRef = firestore.collection('stripe_credits').doc(session.id);
    const userRef = firestore.collection('users').doc(uid);
    let recordedDeposit = null;

    try {
      recordedDeposit = await firestore.runTransaction(async (transaction) => {
        const creditSnap = await transaction.get(creditRef);
        if (creditSnap.exists) {
          return { created: false, data: creditSnap.data() ?? {} };
        }

        const legacyCreditSnap = stripePaymentId === session.id ? null : await transaction.get(legacyCreditRef);
        if (legacyCreditSnap?.exists) {
          const legacyData = legacyCreditSnap.data() ?? {};
          const canonicalData = { ...legacyData, stripePaymentId };
          delete canonicalData.canonicalStripeCreditId;
          transaction.set(creditRef, canonicalData, { merge: true });
          return { created: false, data: canonicalData };
        }

        const userSnap = await transaction.get(userRef);
        const userData = userSnap.exists ? userSnap.data() ?? {} : {};
        const { balanceAfter: nextCoins } = await recordBalanceChange({
          transaction,
          uid,
          userRef,
          userData,
          currency: 'coins',
          amount: totalCoins,
          reason: 'stripe_topup_credit',
          actorType: 'system',
          actorUid: null,
          source: 'api/stripe-webhook',
          relatedId: session.id,
          metadata: { packageId, baseCoins, bonusCoins, paymentIntentId: session.payment_intent ?? null }
        });
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

        const creditedDepositCents = Number.isFinite(amountTotalCents)
          ? Math.max(0, Math.round(amountTotalCents))
          : 0;
        const previousDepositCount = Math.max(0, Number(userData.depositCount ?? 0));
        const depositSequence = previousDepositCount + 1;
        const isFirstDeposit = depositSequence === 1;
        transaction.set(userRef, {
          totalDepositedCents: admin.firestore.FieldValue.increment(creditedDepositCents),
          depositCount: admin.firestore.FieldValue.increment(1),
          lastDepositAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        const completedAt = admin.firestore.FieldValue.serverTimestamp();
        const depositRecord = {
          uid,
          userId: uid,
          email: typeof session.customer_details?.email === 'string' && session.customer_details.email.trim()
            ? session.customer_details.email.trim()
            : (typeof userData.email === 'string' && userData.email.trim() ? userData.email.trim() : null),
          coins: totalCoins,
          baseCoins,
          bonusCoins,
          packageId,
          packageName,
          stripePriceId,
          amountTotalCents: creditedDepositCents,
          currency: sessionCurrency,
          paymentIntentId: typeof session.payment_intent === 'string' ? session.payment_intent : null,
          stripePaymentId,
          stripeCheckoutSessionId: session.id,
          isFirstDeposit,
          depositSequence,
          completedAt,
          amount: creditedDepositCents,
          status: 'completed',
          createdAt: completedAt
        };
        transaction.set(creditRef, depositRecord);
        if (stripePaymentId !== session.id) {
          transaction.set(legacyCreditRef, { ...depositRecord, canonicalStripeCreditId: stripePaymentId }, { merge: true });
        }
        return { created: true, data: { ...depositRecord, completedAt: Date.now(), createdAt: Date.now() } };
      });
    } catch (error) {
      console.error('stripe-webhook failed to credit coins', error);
      return sendJson(res, 500, { error: 'Failed to credit coins' });
    }


    if (recordedDeposit?.created === true) {
      try {
        await markReferralDepositQualified({ referredUid: uid, depositCoins: totalCoins });
      } catch (referralError) {
        console.error('stripe-webhook failed to evaluate referral deposit qualification', referralError);
      }
    }

    const depositData = recordedDeposit?.data ?? {};
    const depositUserId = typeof depositData.userId === 'string' && depositData.userId.trim() ? depositData.userId.trim() : uid;
    const depositEmail = typeof depositData.email === 'string' && depositData.email.trim() ? depositData.email.trim() : null;
    const depositCurrency = typeof depositData.currency === 'string' && depositData.currency.trim()
      ? depositData.currency.trim().toUpperCase()
      : (sessionCurrency || 'USD');
    const depositAmountCents = Number(depositData.amountTotalCents ?? depositData.amount ?? amountTotalCents ?? 0);
    const purchaseValue = Number.isFinite(depositAmountCents) ? Math.max(0, depositAmountCents / 100) : 0;
    const trackedStripePaymentId = typeof depositData.stripePaymentId === 'string' && depositData.stripePaymentId.trim()
      ? depositData.stripePaymentId.trim()
      : stripePaymentId;
    const eventId = `purchase_${trackedStripePaymentId}`;
    const firstDepositEventId = `first_deposit_${trackedStripePaymentId}`;
    const depositSequence = Number(depositData.depositSequence ?? 0);
    const isFirstDeposit = depositData.isFirstDeposit === true;
    const shouldSendPurchase = !depositData.metaPurchaseServerTrackedAt;
    const shouldSendFirstDeposit = isFirstDeposit && !depositData.metaFirstDepositServerTrackedAt;

    if (!shouldSendPurchase && !shouldSendFirstDeposit) {
      return sendJson(res, 200, { received: true });
    }

    const attemptPatch = {};
    if (shouldSendPurchase) attemptPatch.metaPurchaseServerLastAttemptAt = admin.firestore.FieldValue.serverTimestamp();
    if (shouldSendFirstDeposit) attemptPatch.metaFirstDepositServerLastAttemptAt = admin.firestore.FieldValue.serverTimestamp();
    await updateDepositTrackingState({ creditRef, legacyCreditRef, stripePaymentId, patch: attemptPatch });

    const serverPatch = {};
    const failedEvents = [];

    try {
      const userSnap = depositUserId ? await firestore.collection('users').doc(depositUserId).get() : null;
      const userData = userSnap?.exists ? userSnap.data() ?? {} : {};
      const email = depositEmail ?? (typeof userData.email === 'string' && userData.email.trim() ? userData.email.trim() : null);
      const phone = session.customer_details?.phone ?? userData.phone ?? userData.phoneNumber ?? null;
      const contentName = typeof depositData.packageName === 'string' && depositData.packageName.trim()
        ? depositData.packageName.trim()
        : (typeof depositData.packageId === 'string' && depositData.packageId.trim() ? `Package ${depositData.packageId.trim()}` : 'Top Up');
      const contentIds = typeof depositData.stripePriceId === 'string' && depositData.stripePriceId.trim()
        ? [depositData.stripePriceId.trim()]
        : (typeof depositData.packageId === 'string' && depositData.packageId.trim() ? [String(depositData.packageId).trim()] : undefined);

      if (shouldSendPurchase) {
        const metaResult = await sendMetaEvent({
          req,
          event_name: 'Purchase',
          event_id: eventId,
          event_source_url: `${process.env.APP_URL}/top-up`,
          user: { email, phone, external_id: String(depositUserId), fbp, fbc },
          custom_data: {
            currency: depositCurrency,
            value: purchaseValue,
            content_name: contentName,
            content_ids: contentIds,
            content_type: 'product',
            num_items: 1,
            is_first_deposit: isFirstDeposit,
            deposit_sequence: depositSequence,
            stripe_payment_id: trackedStripePaymentId
          },
          test_event_code: process.env.META_TEST_EVENT_CODE
        });

        if (metaResult.ok) {
          serverPatch.metaPurchaseServerTrackedAt = admin.firestore.FieldValue.serverTimestamp();
          serverPatch.metaPurchaseServerLastError = admin.firestore.FieldValue.delete();
        } else if (metaResult.skipped) {
          serverPatch.metaPurchaseServerLastError = serializeMetaError(metaResult) ?? 'Meta CAPI skipped';
        } else {
          const errorMessage = serializeMetaError(metaResult) ?? 'Meta CAPI Purchase failed';
          serverPatch.metaPurchaseServerLastError = errorMessage;
          failedEvents.push({ event: 'Purchase', error: errorMessage });
          console.warn('stripe-webhook meta purchase event failed', { eventId, status: metaResult.status, error: metaResult.error });
        }
      }

      if (shouldSendFirstDeposit) {
        const firstDepositResult = await sendMetaEvent({
          req,
          event_name: 'FirstDeposit',
          event_id: firstDepositEventId,
          event_source_url: `${process.env.APP_URL}/top-up`,
          user: { email, phone, external_id: String(depositUserId), fbp, fbc },
          custom_data: {
            currency: depositCurrency,
            value: purchaseValue,
            deposit_sequence: 1,
            stripe_payment_id: trackedStripePaymentId,
            user_id: String(depositUserId)
          },
          test_event_code: process.env.META_TEST_EVENT_CODE
        });

        if (firstDepositResult.ok) {
          serverPatch.metaFirstDepositServerTrackedAt = admin.firestore.FieldValue.serverTimestamp();
          serverPatch.metaFirstDepositServerLastError = admin.firestore.FieldValue.delete();
        } else if (firstDepositResult.skipped) {
          serverPatch.metaFirstDepositServerLastError = serializeMetaError(firstDepositResult) ?? 'Meta CAPI skipped';
        } else {
          const errorMessage = serializeMetaError(firstDepositResult) ?? 'Meta CAPI FirstDeposit failed';
          serverPatch.metaFirstDepositServerLastError = errorMessage;
          failedEvents.push({ event: 'FirstDeposit', error: errorMessage });
          console.warn('stripe-webhook meta first deposit event failed', { eventId: firstDepositEventId, status: firstDepositResult.status, error: firstDepositResult.error });
        }
      }
    } catch (metaError) {
      const errorMessage = metaError?.message ?? 'Unknown Meta CAPI error';
      if (shouldSendPurchase) serverPatch.metaPurchaseServerLastError = errorMessage;
      if (shouldSendFirstDeposit) serverPatch.metaFirstDepositServerLastError = errorMessage;
      failedEvents.push({ event: 'MetaCapi', error: errorMessage });
      console.error('stripe-webhook meta event error', { eventId, firstDepositEventId, message: errorMessage });
    }

    await updateDepositTrackingState({ creditRef, legacyCreditRef, stripePaymentId, patch: serverPatch });

    if (failedEvents.length > 0) {
      return sendJson(res, 502, { error: 'Meta CAPI delivery failed', failedEvents });
    }

  }

  return sendJson(res, 200, { received: true });
}
