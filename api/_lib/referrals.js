import { admin, firestore } from './firebaseAdmin.js';
import { recordBalanceChange } from './balanceAudit.js';

export const REFERRAL_SETTINGS_DOC = 'referral-settings';

export const DEFAULT_REFERRAL_SETTINGS = {
  enabled: true,
  referrerRewardCoins: 1000,
  friendRewardCoins: 1000,
  requiredDepositCoins: 1000,
  requireFirstQualifyingGame: true,
  leaderboardPointsEnabled: false,
  referrerLeaderboardPoints: 0,
  friendLeaderboardPoints: 0,
  heroBadge: 'REFER A FRIEND',
  heroTitle: 'Give 1,000. Get 1,000.',
  heroDescription:
    'Share your referral link. When a friend signs up and qualifies with your code, you both get rewarded.',
  ctaTitle: 'Keep Sharing, Keep Earning',
  ctaDescription: 'Invite more friends and stack up referral rewards every time a referral qualifies.',
  faqItems: [
    {
      id: 'limit',
      question: 'How many friends can I refer?',
      answer: 'You can refer as many eligible new friends as you want while the referral program is active.'
    },
    {
      id: 'completed',
      question: 'What counts as a completed referral?',
      answer:
        'A referral is completed after your friend signs up through your link and meets the current qualification requirements.'
    },
    {
      id: 'timing',
      question: 'When are rewards added?',
      answer: 'Rewards are credited automatically after all qualification checks are satisfied.'
    },
    {
      id: 'existing',
      question: 'Can I refer someone who already has an account?',
      answer: 'No. Only brand-new accounts created through a valid referral link are eligible.'
    }
  ]
};

const toNumber = (value, fallback = 0) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

const normalizeFaqItems = (faqItems) => {
  if (!Array.isArray(faqItems)) return DEFAULT_REFERRAL_SETTINGS.faqItems;
  const normalized = faqItems
    .map((item, idx) => ({
      id: typeof item?.id === 'string' && item.id.trim() ? item.id.trim() : `faq_${idx + 1}`,
      question: typeof item?.question === 'string' ? item.question.trim() : '',
      answer: typeof item?.answer === 'string' ? item.answer.trim() : ''
    }))
    .filter((item) => item.question && item.answer)
    .slice(0, 12);

  return normalized.length ? normalized : DEFAULT_REFERRAL_SETTINGS.faqItems;
};

export const normalizeReferralSettings = (raw = {}) => ({
  enabled: raw.enabled !== false,
  referrerRewardCoins: Math.max(0, Math.floor(toNumber(raw.referrerRewardCoins, DEFAULT_REFERRAL_SETTINGS.referrerRewardCoins))),
  friendRewardCoins: Math.max(0, Math.floor(toNumber(raw.friendRewardCoins, DEFAULT_REFERRAL_SETTINGS.friendRewardCoins))),
  requiredDepositCoins: Math.max(0, Math.floor(toNumber(raw.requiredDepositCoins, DEFAULT_REFERRAL_SETTINGS.requiredDepositCoins))),
  requireFirstQualifyingGame: raw.requireFirstQualifyingGame !== false,
  leaderboardPointsEnabled: raw.leaderboardPointsEnabled === true,
  referrerLeaderboardPoints: Math.max(0, Math.floor(toNumber(raw.referrerLeaderboardPoints, 0))),
  friendLeaderboardPoints: Math.max(0, Math.floor(toNumber(raw.friendLeaderboardPoints, 0))),
  heroBadge: typeof raw.heroBadge === 'string' && raw.heroBadge.trim() ? raw.heroBadge.trim() : DEFAULT_REFERRAL_SETTINGS.heroBadge,
  heroTitle: typeof raw.heroTitle === 'string' && raw.heroTitle.trim() ? raw.heroTitle.trim() : DEFAULT_REFERRAL_SETTINGS.heroTitle,
  heroDescription:
    typeof raw.heroDescription === 'string' && raw.heroDescription.trim()
      ? raw.heroDescription.trim()
      : DEFAULT_REFERRAL_SETTINGS.heroDescription,
  ctaTitle: typeof raw.ctaTitle === 'string' && raw.ctaTitle.trim() ? raw.ctaTitle.trim() : DEFAULT_REFERRAL_SETTINGS.ctaTitle,
  ctaDescription:
    typeof raw.ctaDescription === 'string' && raw.ctaDescription.trim()
      ? raw.ctaDescription.trim()
      : DEFAULT_REFERRAL_SETTINGS.ctaDescription,
  faqItems: normalizeFaqItems(raw.faqItems)
});

export const getReferralSettingsRef = () => firestore.collection('settings').doc(REFERRAL_SETTINGS_DOC);

export const getReferralSettings = async () => {
  const ref = getReferralSettingsRef();
  const snap = await ref.get();
  const settings = normalizeReferralSettings(snap.exists ? snap.data() ?? {} : DEFAULT_REFERRAL_SETTINGS);
  if (!snap.exists) {
    await ref.set(settings, { merge: true });
  }
  return { settings, ref, exists: snap.exists };
};

const normalizeCodeBase = (value) =>
  String(value ?? '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 12);

const randomSuffix = () => Math.random().toString(36).slice(2, 6).toUpperCase();

const codeExists = async (code) => {
  const snap = await firestore.collection('users').where('affiliateCode', '==', code).limit(1).get();
  return !snap.empty;
};

export const ensureUserReferralCode = async (uid, preferredBase = 'PLAYER') => {
  const userRef = firestore.collection('users').doc(uid);
  const userSnap = await userRef.get();
  const data = userSnap.exists ? userSnap.data() ?? {} : {};
  if (typeof data.affiliateCode === 'string' && data.affiliateCode.trim()) {
    return data.affiliateCode.trim().toUpperCase();
  }

  const base = normalizeCodeBase(data.username || data.displayName || preferredBase || 'PLAYER') || 'PLAYER';
  let candidate = `${base.slice(0, 8)}${randomSuffix()}`;
  let attempts = 0;
  while (attempts < 8) {
    // eslint-disable-next-line no-await-in-loop
    const exists = await codeExists(candidate);
    if (!exists) break;
    candidate = `${base.slice(0, 8)}${randomSuffix()}`;
    attempts += 1;
  }

  await userRef.set(
    {
      affiliateCode: candidate,
      updatedAt: Date.now()
    },
    { merge: true }
  );

  return candidate;
};

export const buildReferralRecordId = (referredUid) => `referred_${referredUid}`;

export const evaluateReferralStatus = ({ referral = {}, settings }) => {
  const depositQualified = referral.depositQualified === true;
  const firstGameQualified = referral.firstGameQualified === true;
  const gameRequirementMet = settings.requireFirstQualifyingGame ? firstGameQualified : true;
  const completed = depositQualified && gameRequirementMet;
  return {
    depositQualified,
    firstGameQualified,
    completed
  };
};

export const maybeCompleteReferralReward = async ({ referredUid }) => {
  if (!referredUid) return { updated: false, reason: 'missing_referred_uid' };

  const { settings } = await getReferralSettings();
  if (!settings.enabled) return { updated: false, reason: 'program_disabled' };

  const referralRef = firestore.collection('referrals').doc(buildReferralRecordId(referredUid));

  return firestore.runTransaction(async (tx) => {
    const [referralSnap, settingsSnap] = await Promise.all([
      tx.get(referralRef),
      tx.get(getReferralSettingsRef())
    ]);

    if (!referralSnap.exists) return { updated: false, reason: 'missing_referral' };

    const liveSettings = normalizeReferralSettings(settingsSnap.exists ? settingsSnap.data() ?? {} : settings);
    if (!liveSettings.enabled) return { updated: false, reason: 'program_disabled' };

    const referralData = referralSnap.data() ?? {};
    if (referralData.status === 'rewarded' || referralData.rewardedAt) {
      return { updated: false, reason: 'already_rewarded' };
    }

    if (!referralData.referrerUid || !referralData.referredUid) {
      tx.set(referralRef, {
        status: 'invalid',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        notes: 'Missing referrer or referred UID'
      }, { merge: true });
      return { updated: false, reason: 'invalid' };
    }

    const statusEval = evaluateReferralStatus({ referral: referralData, settings: liveSettings });
    if (!statusEval.completed) {
      tx.set(referralRef, {
        status: 'pending_qualification',
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
      return { updated: false, reason: 'pending_qualification' };
    }

    const referrerRef = firestore.collection('users').doc(referralData.referrerUid);
    const referredRef = firestore.collection('users').doc(referralData.referredUid);
    const [referrerSnap, referredSnap] = await Promise.all([tx.get(referrerRef), tx.get(referredRef)]);
    if (!referrerSnap.exists || !referredSnap.exists) {
      tx.set(referralRef, {
        status: 'invalid',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        notes: 'Missing user docs'
      }, { merge: true });
      return { updated: false, reason: 'invalid_users' };
    }

    const referrerRewardCoins = liveSettings.referrerRewardCoins;
    const friendRewardCoins = liveSettings.friendRewardCoins;
    const rewardPatch = {
      referralRewardsEarned: admin.firestore.FieldValue.increment(referrerRewardCoins),
      updatedAt: Date.now()
    };
    const friendPatch = {
      referralRewardsReceived: admin.firestore.FieldValue.increment(friendRewardCoins),
      updatedAt: Date.now()
    };

    if (liveSettings.leaderboardPointsEnabled) {
      rewardPatch.rewardPointsBalance = admin.firestore.FieldValue.increment(liveSettings.referrerLeaderboardPoints);
      friendPatch.rewardPointsBalance = admin.firestore.FieldValue.increment(liveSettings.friendLeaderboardPoints);
    }

    await recordBalanceChange({
      transaction: tx,
      uid: referralData.referrerUid,
      currency: 'coins',
      amount: referrerRewardCoins,
      reason: 'referral_reward',
      actorType: 'system',
      actorUid: null,
      source: 'api/_lib/referrals',
      relatedId: referralRef.id,
      metadata: { role: 'referrer' }
    });
    await recordBalanceChange({
      transaction: tx,
      uid: referralData.referredUid,
      currency: 'coins',
      amount: friendRewardCoins,
      reason: 'referral_reward',
      actorType: 'system',
      actorUid: null,
      source: 'api/_lib/referrals',
      relatedId: referralRef.id,
      metadata: { role: 'friend' }
    });
    tx.set(referrerRef, rewardPatch, { merge: true });
    tx.set(referredRef, friendPatch, { merge: true });

    tx.set(referralRef, {
      status: 'rewarded',
      completedAt: referralData.completedAt || admin.firestore.FieldValue.serverTimestamp(),
      rewardedAt: admin.firestore.FieldValue.serverTimestamp(),
      referrerRewardAmount: referrerRewardCoins,
      referredRewardAmount: friendRewardCoins,
      referrerRewardLeaderboardPoints: liveSettings.leaderboardPointsEnabled ? liveSettings.referrerLeaderboardPoints : 0,
      referredRewardLeaderboardPoints: liveSettings.leaderboardPointsEnabled ? liveSettings.friendLeaderboardPoints : 0,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    return { updated: true, reason: 'rewarded' };
  });
};


export const markReferralDepositQualified = async ({ referredUid, depositCoins = 0 }) => {
  if (!referredUid) return { updated: false, reason: 'missing_referred_uid' };
  const { settings } = await getReferralSettings();
  const amount = Math.max(0, Math.floor(Number(depositCoins) || 0));
  const referralRef = firestore.collection('referrals').doc(buildReferralRecordId(referredUid));

  await firestore.runTransaction(async (tx) => {
    const referralSnap = await tx.get(referralRef);
    if (!referralSnap.exists) return;
    const referral = referralSnap.data() ?? {};
    const priorTotal = Math.max(0, Math.floor(Number(referral.depositQualifiedAmount || 0)));
    const nextTotal = priorTotal + amount;
    const meets = nextTotal >= settings.requiredDepositCoins;
    tx.set(referralRef, {
      depositQualifiedAmount: nextTotal,
      depositQualified: meets || referral.depositQualified === true,
      status: (meets || referral.firstGameQualified === true && !settings.requireFirstQualifyingGame) ? 'completed' : 'pending_qualification',
      qualifiedAt: meets && (!settings.requireFirstQualifyingGame || referral.firstGameQualified === true)
        ? admin.firestore.FieldValue.serverTimestamp()
        : referral.qualifiedAt || null,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
  });

  return maybeCompleteReferralReward({ referredUid });
};

export const markReferralFirstGameQualified = async ({ referredUid }) => {
  if (!referredUid) return { updated: false, reason: 'missing_referred_uid' };
  const { settings } = await getReferralSettings();
  const referralRef = firestore.collection('referrals').doc(buildReferralRecordId(referredUid));

  await firestore.runTransaction(async (tx) => {
    const referralSnap = await tx.get(referralRef);
    if (!referralSnap.exists) return;
    const referral = referralSnap.data() ?? {};
    const meets = referral.depositQualified === true;
    tx.set(referralRef, {
      firstGameQualified: true,
      status: meets ? 'completed' : 'pending_qualification',
      qualifiedAt: meets ? admin.firestore.FieldValue.serverTimestamp() : referral.qualifiedAt || null,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
  });

  if (!settings.requireFirstQualifyingGame) {
    return { updated: false, reason: 'first_game_not_required' };
  }

  return maybeCompleteReferralReward({ referredUid });
};
