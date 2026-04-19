import { admin } from './_lib/firebaseAdmin.js';
import { adminAuth, firestore } from './_lib/firebaseAdmin.js';
import { getBearerToken, readJsonBody, sendJson } from './_lib/http.js';

const normalizeCurrency = (value) => {
  if (typeof value !== 'string') return 'USD';
  const normalized = value.trim().toUpperCase();
  return normalized || 'USD';
};

export default async function handler(req, res) {
  if (req.method !== 'POST' && req.method !== 'PATCH') {
    res.setHeader('Allow', 'POST, PATCH');
    return sendJson(res, 405, { error: 'Method Not Allowed' });
  }

  try {
    const token = getBearerToken(req);
    if (!token) {
      return sendJson(res, 401, { error: 'Missing bearer token' });
    }

    const decoded = await adminAuth.verifyIdToken(token);
    const body = await readJsonBody(req);
    const sessionId = typeof body?.sessionId === 'string' ? body.sessionId.trim() : '';

    if (!sessionId) {
      return sendJson(res, 400, { error: 'Missing sessionId' });
    }

    const creditRef = firestore.collection('stripe_credits').doc(sessionId);
    const creditSnap = await creditRef.get();

    if (!creditSnap.exists) {
      return sendJson(res, 200, { status: 'pending' });
    }

    const creditData = creditSnap.data() ?? {};
    if (creditData.uid !== decoded.uid) {
      return sendJson(res, 403, { error: 'Forbidden' });
    }

    const amountCents = Number(creditData.amountTotalCents ?? 0);
    const purchaseValue = Number.isFinite(amountCents) ? Math.max(0, amountCents / 100) : 0;
    const packageName = typeof creditData.packageName === 'string' && creditData.packageName.trim()
      ? creditData.packageName.trim()
      : (typeof creditData.packageId === 'string' && creditData.packageId.trim() ? `Package ${creditData.packageId.trim()}` : 'Top Up');
    const contentId = typeof creditData.stripePriceId === 'string' && creditData.stripePriceId.trim()
      ? creditData.stripePriceId.trim()
      : (typeof creditData.packageId === 'string' && creditData.packageId.trim() ? creditData.packageId.trim() : sessionId);

    if (req.method === 'PATCH') {
      await firestore.runTransaction(async (transaction) => {
        const latest = await transaction.get(creditRef);
        const latestData = latest.exists ? latest.data() ?? {} : {};
        if (!latest.exists || latestData.uid !== decoded.uid || latestData.metaPurchasePixelTrackedAt) {
          return;
        }

        transaction.set(creditRef, {
          metaPurchasePixelTrackedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
      });

      return sendJson(res, 200, { ok: true });
    }

    return sendJson(res, 200, {
      status: 'ready',
      purchase: {
        alreadyTracked: Boolean(creditData.metaPurchasePixelTrackedAt),
        eventID: `purchase_${sessionId}`,
        currency: normalizeCurrency(creditData.currency),
        value: purchaseValue,
        content_name: packageName,
        content_ids: [contentId]
      }
    });
  } catch (error) {
    console.error('topup-purchase handler error', error);
    return sendJson(res, 500, { error: 'Unable to process top-up purchase state' });
  }
}
