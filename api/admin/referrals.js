import { admin, firestore } from '../_lib/firebaseAdmin.js';
import { readJsonBody, sendJson } from '../_lib/http.js';
import { maybeCompleteReferralReward } from '../_lib/referrals.js';
import { requireAdmin } from '../_utils/auth.js';

const toMillis = (value) => {
  if (!value) return null;
  if (typeof value === 'number') return value;
  if (typeof value?.toMillis === 'function') return value.toMillis();
  return null;
};

export default async function handler(req, res) {
  try {
    await requireAdmin(req);
  } catch (error) {
    const status = error?.status ?? 500;
    return sendJson(res, status, { ok: false, error: error?.error ?? 'Unauthorized' });
  }

  if (req.method === 'GET') {
    const queryRef = firestore.collection('referrals').orderBy('createdAt', 'desc').limit(300);
    const snap = await queryRef.get();
    const rows = snap.docs.map((docSnap) => {
      const data = docSnap.data() ?? {};
      return {
        id: docSnap.id,
        referrerUid: data.referrerUid ?? null,
        referredUid: data.referredUid ?? null,
        referrerDisplayName: data.referrerDisplayName || null,
        referredDisplayName: data.referredDisplayName || null,
        referralCode: data.referralCode || null,
        status: data.status || 'invited',
        depositQualified: data.depositQualified === true,
        firstGameQualified: data.firstGameQualified === true,
        createdAt: toMillis(data.createdAt),
        joinedAt: toMillis(data.joinedAt),
        qualifiedAt: toMillis(data.qualifiedAt),
        rewardedAt: toMillis(data.rewardedAt),
        referrerRewardAmount: Number(data.referrerRewardAmount || 0),
        referredRewardAmount: Number(data.referredRewardAmount || 0),
        notes: data.notes || ''
      };
    });

    const stats = {
      total: rows.length,
      rewarded: rows.filter((row) => row.status === 'rewarded').length,
      pending: rows.filter((row) => ['signed_up', 'pending_qualification', 'completed'].includes(row.status)).length,
      invalid: rows.filter((row) => ['invalid', 'rejected'].includes(row.status)).length
    };

    return sendJson(res, 200, { ok: true, rows, stats });
  }

  if (req.method === 'PATCH') {
    const body = await readJsonBody(req);
    const referralId = typeof body?.referralId === 'string' ? body.referralId : '';
    const action = typeof body?.action === 'string' ? body.action : '';
    if (!referralId || !action) {
      return sendJson(res, 400, { ok: false, error: 'INVALID_REQUEST' });
    }

    const referralRef = firestore.collection('referrals').doc(referralId);
    if (action === 'mark_invalid') {
      await referralRef.set(
        {
          status: 'invalid',
          reviewedAt: admin.firestore.FieldValue.serverTimestamp(),
          notes: typeof body?.notes === 'string' ? body.notes.trim().slice(0, 2000) : 'Marked invalid by admin'
        },
        { merge: true }
      );
      return sendJson(res, 200, { ok: true });
    }

    if (action === 'review') {
      await referralRef.set(
        {
          reviewedAt: admin.firestore.FieldValue.serverTimestamp(),
          notes: typeof body?.notes === 'string' ? body.notes.trim().slice(0, 2000) : 'Reviewed by admin'
        },
        { merge: true }
      );
      return sendJson(res, 200, { ok: true });
    }

    if (action === 'force_qualify') {
      const referralSnap = await referralRef.get();
      if (!referralSnap.exists) return sendJson(res, 404, { ok: false, error: 'REFERRAL_NOT_FOUND' });
      const referral = referralSnap.data() ?? {};
      await referralRef.set({
        depositQualified: true,
        firstGameQualified: true,
        status: 'completed',
        qualifiedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
      const result = await maybeCompleteReferralReward({ referredUid: referral.referredUid });
      return sendJson(res, 200, { ok: true, result });
    }

    return sendJson(res, 400, { ok: false, error: 'UNSUPPORTED_ACTION' });
  }

  res.setHeader('Allow', 'GET, PATCH');
  return sendJson(res, 405, { ok: false, error: 'Method Not Allowed' });
}
