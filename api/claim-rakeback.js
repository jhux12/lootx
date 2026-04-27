import { admin, adminAuth, firestore } from './_lib/firebaseAdmin.js';
import { getBearerToken, sendJson } from './_lib/http.js';
import { recordBalanceChange } from './_lib/balanceAudit.js';

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
    const userRef = firestore.collection('users').doc(decoded.uid);
    const bonusSettingsRef = firestore.collection('settings').doc('bonus-settings');

    let responsePayload;

    await firestore.runTransaction(async (transaction) => {
      const [userSnap, bonusSnap] = await Promise.all([
        transaction.get(userRef),
        transaction.get(bonusSettingsRef)
      ]);

      if (!userSnap.exists) {
        throw { status: 404, error: 'User not found' };
      }

      const userData = userSnap.data() ?? {};
      const available = Number(userData.rakebackBalance ?? 0);
      if (available <= 0) {
        throw { status: 400, error: 'No rakeback available' };
      }

      const bonusData = bonusSnap.data() ?? {};
      const capAmount = Number(bonusData.rakebackDailyCapCoins ?? 0);
      const payout = capAmount > 0 ? Math.min(available, capAmount) : available;
      if (payout <= 0) {
        throw { status: 400, error: 'No rakeback available' };
      }

      const { balanceAfter: newCoins } = await recordBalanceChange({
        transaction,
        uid: decoded.uid,
        currency: 'coins',
        amount: payout,
        reason: 'rakeback_reward',
        actorType: 'system',
        actorUid: null,
        source: 'api/claim-rakeback',
        relatedId: null,
        metadata: { capAmount, available, payout }
      });
      const remainingRakeback = Math.max(0, available - payout);

      transaction.set(
        userRef,
        {
          rakebackBalance: remainingRakeback,
          lastRakebackClaimAt: admin.firestore.FieldValue.serverTimestamp()
        },
        { merge: true }
      );

      responsePayload = {
        ok: true,
        credited: payout,
        newCoins,
        remainingRakeback
      };
    });

    return sendJson(res, 200, responsePayload);
  } catch (error) {
    const status = error?.status;
    if (status) {
      return sendJson(res, status, { error: error.error || 'Unable to claim rakeback' });
    }
    console.error('claim-rakeback error', error);
    return sendJson(res, 500, { error: 'Unable to claim rakeback' });
  }
}
