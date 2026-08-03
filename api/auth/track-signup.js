import { db } from '../_lib/firebaseAdmin.js';
import { deny, ok, requireUser } from '../_utils/auth.js';
import { getClientIp } from '../_utils/clientIp.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return deny(res, 405, 'METHOD_NOT_ALLOWED');

  try {
    const decoded = await requireUser(req);
    const signupIp = getClientIp(req);
    if (!signupIp) return deny(res, 400, 'SIGNUP_IP_UNAVAILABLE');

    const userRef = db.collection('users').doc(decoded.uid);
    let recorded = false;
    await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(userRef);
      if (snapshot.data()?.signupIp) return;
      transaction.set(userRef, {
        signupIp,
        signupIpRecordedAt: new Date(),
        updatedAt: new Date()
      }, { merge: true });
      recorded = true;
    });

    return ok(res, { recorded });
  } catch (error) {
    return deny(res, error?.status ?? 500, error?.error ?? error?.message ?? 'SIGNUP_IP_TRACKING_FAILED');
  }
}
