import Stripe from 'stripe';
import { admin, firestore } from './_lib/firebaseAdmin.js';
import { sendJson } from './_lib/http.js';

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
    const uid = metadata.uid;
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

        transaction.set(userRef, {
          coins: admin.firestore.FieldValue.increment(totalCoins)
        }, { merge: true });

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
  }

  return sendJson(res, 200, { received: true });
}
