import { admin, adminAuth, firestore } from '../_lib/firebaseAdmin.js';
import { readJsonBody, sendJson } from '../_lib/http.js';
import { requireUser } from '../_utils/auth.js';
import { buildReferralRecordId, getReferralSettings } from '../_lib/referrals.js';

const ACCOUNT_AGE_LIMIT_MS = 1000 * 60 * 60 * 24;

const normalizeCode = (value) =>
  String(value ?? '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');

const resolveReferrerByCode = async (code) => {
  const normalized = normalizeCode(code);
  if (!normalized) return null;

  const [byAffiliate, byUsername] = await Promise.all([
    firestore.collection('users').where('affiliateCode', '==', normalized).limit(1).get(),
    firestore.collection('users').where('usernameLower', '==', normalized.toLowerCase()).limit(1).get()
  ]);

  const first = !byAffiliate.empty ? byAffiliate.docs[0] : !byUsername.empty ? byUsername.docs[0] : null;
  if (!first) return null;

  return {
    uid: first.id,
    data: first.data() ?? {},
    code: normalized
  };
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return sendJson(res, 405, { ok: false, error: 'Method Not Allowed' });
  }

  try {
    const decoded = await requireUser(req);
    const { settings } = await getReferralSettings();
    if (!settings.enabled) {
      return sendJson(res, 200, { ok: true, applied: false, reason: 'program_disabled' });
    }

    const body = await readJsonBody(req);
    const referralCode = normalizeCode(body?.referralCode ?? body?.code);
    if (!referralCode) {
      return sendJson(res, 400, { ok: false, error: 'INVALID_REFERRAL_CODE' });
    }

    const referredUid = decoded.uid;
    const referredAuth = await adminAuth.getUser(referredUid);
    const createdAtMs = referredAuth?.metadata?.creationTime ? Date.parse(referredAuth.metadata.creationTime) : Date.now();

    if (Date.now() - createdAtMs > ACCOUNT_AGE_LIMIT_MS) {
      return sendJson(res, 200, { ok: true, applied: false, reason: 'existing_account' });
    }

    const referrer = await resolveReferrerByCode(referralCode);
    if (!referrer) {
      return sendJson(res, 200, { ok: true, applied: false, reason: 'invalid_code' });
    }

    if (referrer.uid === referredUid) {
      return sendJson(res, 200, { ok: true, applied: false, reason: 'self_referral' });
    }

    const referralRef = firestore.collection('referrals').doc(buildReferralRecordId(referredUid));
    const referredRef = firestore.collection('users').doc(referredUid);

    const result = await firestore.runTransaction(async (tx) => {
      const [existingReferralSnap, referredSnap, referrerSnap] = await Promise.all([
        tx.get(referralRef),
        tx.get(referredRef),
        tx.get(firestore.collection('users').doc(referrer.uid))
      ]);

      if (!referrerSnap.exists || !referredSnap.exists) {
        return { applied: false, reason: 'missing_user' };
      }

      const referredData = referredSnap.data() ?? {};
      if (referredData.referredBy && referredData.referredBy !== referrer.uid) {
        return { applied: false, reason: 'already_referred' };
      }

      if (existingReferralSnap.exists) {
        const existing = existingReferralSnap.data() ?? {};
        if (existing.referrerUid && existing.referrerUid !== referrer.uid) {
          return { applied: false, reason: 'already_linked' };
        }
      }

      tx.set(referredRef, {
        referredBy: referrer.uid,
        referredByCode: referralCode,
        referralLinkedAt: Date.now(),
        updatedAt: Date.now()
      }, { merge: true });

      tx.set(referralRef, {
        referralCode,
        referrerUid: referrer.uid,
        referrerDisplayName: referrer.data.displayName || referrer.data.username || 'Referrer',
        referredUid,
        referredDisplayName: referredData.displayName || referredData.username || 'Friend',
        status: 'signed_up',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        joinedAt: admin.firestore.FieldValue.serverTimestamp(),
        depositQualified: false,
        firstGameQualified: false,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      return { applied: true };
    });

    return sendJson(res, 200, { ok: true, ...result });
  } catch (error) {
    const status = error?.status ?? 500;
    return sendJson(res, status, { ok: false, error: error?.error ?? 'Failed to apply referral attribution' });
  }
}
