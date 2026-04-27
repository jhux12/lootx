import { admin, firestore } from '../_lib/firebaseAdmin.js';
import { readJsonBody, sendJson } from '../_lib/http.js';
import { requireUser } from '../_utils/auth.js';
import { recordBalanceChange } from '../_lib/balanceAudit.js';

const SAFE_ACTION_XP = {
  DAILY_LOGIN: 25,
  CLAIM_QUEST: 50
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return sendJson(res, 405, { error: 'Method Not Allowed' });
  }

  try {
    const decoded = await requireUser(req);
    const body = await readJsonBody(req);
    const action = typeof body?.action === 'string' ? body.action.trim().toUpperCase() : '';

    if (!action || !Object.prototype.hasOwnProperty.call(SAFE_ACTION_XP, action)) {
      return sendJson(res, 400, { ok: false, error: 'Unsupported action' });
    }

    if (body?.xpAmount != null || body?.coinsSpent != null) {
      return sendJson(res, 400, { ok: false, error: 'Client-controlled XP amounts are not allowed' });
    }

    const awarded = SAFE_ACTION_XP[action];
    const userRef = firestore.collection('users').doc(decoded.uid);
    const dateKey = new Date().toISOString().slice(0, 10);

    await firestore.runTransaction(async (transaction) => {
      const userSnap = await transaction.get(userRef);
      const userData = userSnap.exists ? userSnap.data() ?? {} : {};
      await recordBalanceChange({
        transaction,
        uid: decoded.uid,
        userRef,
        userData,
        currency: 'xp',
        amount: awarded,
        reason: 'xp_award',
        actorType: 'system',
        actorUid: null,
        source: 'api/xp/award',
        relatedId: action,
        metadata: { action }
      });
      transaction.set(userRef, {
        xpEarnedLifetime: admin.firestore.FieldValue.increment(awarded),
        [`xpDailyEarned.${dateKey}`]: admin.firestore.FieldValue.increment(awarded),
        lastXpAwardAction: action,
        lastXpAwardAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    });

    return sendJson(res, 200, { ok: true, action, awarded });
  } catch (error) {
    const status = error?.status;
    if (status) return sendJson(res, status, { ok: false, error: error.error || 'Unable to award XP' });
    console.error('xp/award error', error);
    return sendJson(res, 500, { ok: false, error: 'Unable to award XP' });
  }
}
