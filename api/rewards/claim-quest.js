import { admin, adminAuth, firestore } from '../_lib/firebaseAdmin.js';
import { getBearerToken, readJsonBody, sendJson } from '../_lib/http.js';

const dayKey = () => new Date().toISOString().slice(0, 10);
const COOLDOWN_MS = 24 * 60 * 60 * 1000;

const getCycleAnchor = (userData = {}) => {
  const lastDailyClaim = Number(userData.lastDailyClaim ?? 0);
  if (Number.isFinite(lastDailyClaim) && lastDailyClaim > 0) return lastDailyClaim;
  const questCycleStartedAt = Number(userData.questCycleStartedAt ?? 0);
  return Number.isFinite(questCycleStartedAt) && questCycleStartedAt > 0 ? questCycleStartedAt : 0;
};

const getProgress = (rule, stats = {}) => {
  if (rule.type === 'unboxing_count') return Number(stats.boxesOpened ?? 0);
  if (rule.type === 'sell_back_count') return Number(stats.sellBackItems ?? 0);
  if (rule.type === 'sell_back_value') return Number(stats.sellBackCoins ?? 0);
  if (rule.type === 'upgrader_uses') return Number(stats.upgraderUses ?? 0);
  if (rule.type === 'unbox_rarity') return Number(stats.rarityUnboxed?.[rule.rarity ?? 'rare'] ?? 0);
  return 0;
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'METHOD_NOT_ALLOWED' });
  const token = getBearerToken(req);
  if (!token) return sendJson(res, 401, { error: 'UNAUTHENTICATED' });

  let decoded;
  try {
    decoded = await adminAuth.verifyIdToken(token);
  } catch {
    return sendJson(res, 401, { error: 'UNAUTHENTICATED' });
  }

  const body = await readJsonBody(req);
  const questId = typeof body?.questId === 'string' ? body.questId : '';
  if (!questId) return sendJson(res, 400, { error: 'INVALID_QUEST' });

  try {
    let payload = null;
    await firestore.runTransaction(async (tx) => {
      const userRef = firestore.collection('users').doc(decoded.uid);
      const settingsRef = firestore.collection('settings').doc('bonus-settings');
      const legacyRewardsRef = firestore.collection('settings').doc('rewards');
      const [userSnap, settingsSnap, legacyRewardsSnap] = await Promise.all([tx.get(userRef), tx.get(settingsRef), tx.get(legacyRewardsRef)]);
      if (!userSnap.exists) throw new Error('User not found');
      const userData = userSnap.data() ?? {};
      const settings = settingsSnap.exists ? settingsSnap.data() ?? {} : {};
      const legacyRewards = legacyRewardsSnap.exists ? legacyRewardsSnap.data() ?? {} : {};
      const rules = Array.isArray(settings.questRules)
        ? settings.questRules
        : (Array.isArray(legacyRewards.questRules) ? legacyRewards.questRules : []);
      const quest = rules.find((entry) => entry && String(entry.id) === questId && entry.enabled !== false);
      if (!quest) throw new Error('Quest unavailable');

      const now = Date.now();
      const anchor = getCycleAnchor(userData);
      const cycleExpired = anchor > 0 && now - anchor >= COOLDOWN_MS;
      const stats = cycleExpired ? {} : (userData.challengeStats ?? {});

      const progress = getProgress(quest, stats);
      if (progress < Number(quest.target ?? 1)) throw new Error('Quest not completed');

      const claimToken = String(anchor || now || dayKey());
      const claimMap = cycleExpired ? {} : (userData.questClaims ?? {});
      if (claimMap?.[questId] === claimToken) throw new Error('Already claimed');

      const rewardCoins = Math.max(0, Math.floor(Number(quest.rewardCoins ?? 0)));
      const currentCoins = Number(userData.coins ?? userData.balance ?? 0);
      const newCoins = currentCoins + rewardCoins;

      tx.set(userRef, {
        coins: newCoins,
        [`questClaims.${questId}`]: claimToken,
        questCycleStartedAt: anchor || now,
        lastQuestClaimAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      payload = { ok: true, rewardCoins, newCoins };
    });

    return sendJson(res, 200, payload ?? { ok: true });
  } catch (error) {
    return sendJson(res, 400, { error: 'CLAIM_FAILED', message: error instanceof Error ? error.message : 'Claim failed' });
  }
}
