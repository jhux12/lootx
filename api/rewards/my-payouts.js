import { sendJson } from '../_lib/http.js';
import { requireUser } from '../_utils/auth.js';
import { firestore } from '../_lib/firebaseAdmin.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return sendJson(res, 405, { ok: false, error: 'METHOD_NOT_ALLOWED' });
  }

  try {
    const decoded = await requireUser(req);
    const snap = await firestore.collection('rewardsPayouts')
      .where('uid', '==', decoded.uid)
      .where('payoutCoins', '>', 0)
      .where('payoutCoinsClaimed', '==', false)
      .orderBy('createdAt', 'desc')
      .limit(10)
      .get();

    const payouts = snap.docs.map((docSnap) => {
      const data = docSnap.data() ?? {};
      return {
        id: docSnap.id,
        seasonId: String(data.seasonId ?? ''),
        rank: Number(data.rank ?? 0),
        points: Number(data.points ?? 0),
        payoutCoins: Number(data.payoutCoins ?? 0)
      };
    });

    const totalUnclaimedCoins = payouts.reduce((sum, payout) => sum + Math.max(0, Math.floor(Number(payout.payoutCoins) || 0)), 0);
    return sendJson(res, 200, {
      ok: true,
      payouts,
      hasUnclaimedCoins: totalUnclaimedCoins > 0,
      totalUnclaimedCoins
    });
  } catch (error) {
    const status = Number(error?.status) || 500;
    const message = error instanceof Error ? error.message : 'Unable to load payout status.';
    const code = typeof error?.error === 'string' ? error.error : 'PAYOUT_STATUS_FAILED';
    return sendJson(res, status, { ok: false, error: code, message });
  }
}
