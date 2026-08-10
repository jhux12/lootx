import { db } from '../_lib/firebaseAdmin.js';
import { deny, ok, requireUser } from '../_utils/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return deny(res, 405, 'METHOD_NOT_ALLOWED');
  try {
    const { uid } = await requireUser(req);
    const sessionId = typeof req.query?.session_id === 'string' ? req.query.session_id.trim().slice(0, 200) : '';
    if (!sessionId) return deny(res, 400, 'INVALID_SESSION_ID');
    const snapshot = await db.collection('shippingPaymentAttempts').where('stripeCheckoutSessionId', '==', sessionId).limit(1).get();
    if (snapshot.empty) return deny(res, 404, 'SHIPPING_PAYMENT_NOT_FOUND');
    const attempt = snapshot.docs[0].data() ?? {};
    if (attempt.uid !== uid) return deny(res, 404, 'SHIPPING_PAYMENT_NOT_FOUND');
    return ok(res, { status: ['pending', 'paid', 'expired', 'failed'].includes(attempt.status) ? attempt.status : 'failed', ...(attempt.status === 'paid' ? { shipmentBatchId: attempt.shipmentBatchId } : {}) });
  } catch (error) { return deny(res, error?.status ?? 500, error?.error ?? 'SHIPPING_PAYMENT_STATUS_UNAVAILABLE'); }
}
