import { requireUser } from '../_utils/auth.js';
import { sendJson } from '../_lib/http.js';
import { ensureUserReferralCode, getReferralSettings } from '../_lib/referrals.js';
import { firestore } from '../_lib/firebaseAdmin.js';

const toMillis = (value) => {
  if (!value) return null;
  if (typeof value === 'number') return value;
  if (typeof value?.toMillis === 'function') return value.toMillis();
  return null;
};

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return sendJson(res, 405, { ok: false, error: 'Method Not Allowed' });
  }

  try {
    const decoded = await requireUser(req);
    const uid = decoded.uid;
    const [userSnap, settingsResult, referralsSnap] = await Promise.all([
      firestore.collection('users').doc(uid).get(),
      getReferralSettings(),
      firestore.collection('referrals').where('referrerUid', '==', uid).limit(100).get()
    ]);

    const userData = userSnap.exists ? userSnap.data() ?? {} : {};
    const referralCode = await ensureUserReferralCode(uid, userData.username || userData.displayName || 'PLAYER');

    const records = referralsSnap.docs.map((docSnap) => {
      const data = docSnap.data() ?? {};
      return {
        id: docSnap.id,
        friendLabel: data.referredDisplayName || data.referredUsername || data.referredUid || 'Friend',
        referredUid: data.referredUid || null,
        joinedAt: toMillis(data.joinedAt) || toMillis(data.createdAt),
        status: data.status || 'invited',
        youEarned: Number(data.referrerRewardAmount || 0),
        createdAt: toMillis(data.createdAt),
        updatedAt: toMillis(data.updatedAt),
        depositQualified: data.depositQualified === true,
        firstGameQualified: data.firstGameQualified === true
      };
    });

    const completed = records.filter((entry) => entry.status === 'completed' || entry.status === 'rewarded').length;
    const rewarded = records.filter((entry) => entry.status === 'rewarded');
    const pending = records.filter((entry) => ['signed_up', 'pending_qualification'].includes(entry.status)).length;

    const creditsEarned = rewarded.reduce((sum, entry) => sum + Number(entry.youEarned || 0), 0);

    return sendJson(res, 200, {
      ok: true,
      referralCode,
      stats: {
        referrals: completed,
        creditsEarned,
        pending,
        leaderboardPts: Number(userData.rewardPointsBalance ?? 0)
      },
      settings: settingsResult.settings,
      records
    });
  } catch (error) {
    const status = error?.status ?? 500;
    return sendJson(res, status, { ok: false, error: error?.error ?? 'Failed to load referral data' });
  }
}
