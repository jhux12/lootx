import { admin, adminAuth, firestore } from '../_lib/firebaseAdmin.js';
import { getBearerToken, readJsonBody, sendJson } from '../_lib/http.js';
import { applyXpAwardInTransaction, computeXpAward, getXpSettings } from '../_lib/xp.js';

const INTERNAL_SECRET = process.env.XP_AWARD_INTERNAL_SECRET || '';

const isInternalRequest = (req) => {
  const incoming = req.headers['x-internal-award-secret'];
  return Boolean(INTERNAL_SECRET) && typeof incoming === 'string' && incoming === INTERNAL_SECRET;
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return sendJson(res, 405, { error: 'Method Not Allowed' });
  }

  try {
    const internal = isInternalRequest(req);
    let uid;

    if (internal) {
      const body = await readJsonBody(req);
      uid = typeof body?.userId === 'string' ? body.userId : null;
      if (!uid) return sendJson(res, 400, { error: 'Missing userId' });

      const action = typeof body?.action === 'string' ? body.action : 'openCase';
      const amountCoins = Number(body?.amountCoins ?? 0);
      const requestId = typeof body?.requestId === 'string' ? body.requestId : null;

      const userRef = firestore.collection('users').doc(uid);
      const idempotencyRef = requestId ? firestore.collection('xpAwardRequests').doc(requestId) : null;

      let responsePayload = { ok: true, awardedXp: 0 };
      await firestore.runTransaction(async (transaction) => {
        if (idempotencyRef) {
          const existing = await transaction.get(idempotencyRef);
          if (existing.exists) {
            responsePayload = { ok: true, ...(existing.data() ?? {}), idempotent: true };
            return;
          }
        }

        const settings = await getXpSettings(transaction);
        const rule = settings.earnRules?.[action] ?? null;

        if (!rule?.enabled) {
          responsePayload = { ok: true, awardedXp: 0, disabled: true };
          return;
        }

        const xpAmount = computeXpAward({
          rule,
          amountCoins,
          bonusRules: settings.bonusRules
        });

        const applied = await applyXpAwardInTransaction({ transaction, userRef, xpAmount, actionKey: action });

        responsePayload = {
          ok: true,
          action,
          awardedXp: applied.awardedXp,
          xpBalance: applied.xpBalance
        };

        if (idempotencyRef) {
          transaction.set(idempotencyRef, {
            ...responsePayload,
            uid,
            requestId,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
          });
        }
      });

      return sendJson(res, 200, responsePayload);
    }

    const token = getBearerToken(req);
    if (!token) return sendJson(res, 401, { error: 'Missing bearer token' });

    const decoded = await adminAuth.verifyIdToken(token);
    uid = decoded.uid;

    const body = await readJsonBody(req);
    const action = typeof body?.action === 'string' ? body.action : null;
    const manualAmount = Number(body?.xpAmount ?? 0);

    if (!action) return sendJson(res, 400, { error: 'Missing action' });

    const userRef = firestore.collection('users').doc(uid);
    let responsePayload;

    await firestore.runTransaction(async (transaction) => {
      const settings = await getXpSettings(transaction);
      const rule = settings.earnRules?.[action] ?? null;
      const xpAmount = manualAmount > 0 ? manualAmount : computeXpAward({ rule, bonusRules: settings.bonusRules });
      const applied = await applyXpAwardInTransaction({ transaction, userRef, xpAmount, actionKey: action });
      responsePayload = { ok: true, action, ...applied };
    });

    return sendJson(res, 200, responsePayload);
  } catch (error) {
    const status = error?.status;
    if (status) return sendJson(res, status, { error: error.error || 'Unable to award XP' });
    console.error('xp/award error', error);
    return sendJson(res, 500, { error: 'Unable to award XP' });
  }
}
