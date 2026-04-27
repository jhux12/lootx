import { admin, adminAuth, firestore } from '../_lib/firebaseAdmin.js';
import { getBearerToken, readJsonBody, sendJson } from '../_lib/http.js';
import { recordBalanceChange } from '../_lib/balanceAudit.js';

const dayKey = () => new Date().toISOString().slice(0, 10);
const toClaimDocId = (today, questId) => {
  const encodedQuestId = encodeURIComponent(String(questId).trim());
  return `${today}__${encodedQuestId}`;
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
  const questId = typeof body?.questId === 'string' ? body.questId.trim() : '';
  if (!questId) return sendJson(res, 400, { error: 'INVALID_QUEST' });

  try {
    let payload = null;
    await firestore.runTransaction(async (tx) => {
      const userRef = firestore.collection('users').doc(decoded.uid);
      const settingsRef = firestore.collection('settings').doc('rewards');
      const today = dayKey();
      const claimRef = userRef.collection('questClaims').doc(toClaimDocId(today, questId));
      const [userSnap, settingsSnap, claimSnap] = await Promise.all([tx.get(userRef), tx.get(settingsRef), tx.get(claimRef)]);
      if (!userSnap.exists) throw new Error('User not found');
      if (claimSnap.exists) throw new Error('Already claimed');
      const userData = userSnap.data() ?? {};
      const settings = settingsSnap.exists ? settingsSnap.data() ?? {} : {};
      const rules = Array.isArray(settings.questRules) ? settings.questRules : [];
      const quest = rules.find((entry) => entry && String(entry.id) === questId && entry.enabled !== false);
      if (!quest) throw new Error('Quest unavailable');

      if (userData.challengeStatsDay !== today) throw new Error('Quest not completed');
      const progress = getProgress(quest, userData.challengeStats ?? {});
      if (progress < Number(quest.target ?? 1)) throw new Error('Quest not completed');

      const claimMap = userData.questClaims ?? {};
      if (claimMap?.[questId] === today) throw new Error('Already claimed');

      const rewardCoins = Math.max(0, Math.floor(Number(quest.rewardCoins ?? 0)));
      const { balanceAfter: newCoins } = await recordBalanceChange({
        transaction: tx,
        uid: decoded.uid,
        currency: 'coins',
        amount: rewardCoins,
        reason: 'quest_reward',
        actorType: 'system',
        actorUid: null,
        source: 'api/rewards/claim-quest',
        relatedId: questId,
        metadata: { questId, day: today }
      });

      tx.set(userRef, {
        questClaims: {
          [questId]: today
        },
        lastQuestClaimAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
      tx.set(claimRef, {
        questId,
        day: today,
        rewardCoins,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      payload = { ok: true, rewardCoins, newCoins };
    });

    return sendJson(res, 200, payload ?? { ok: true });
  } catch (error) {
    return sendJson(res, 400, { error: 'CLAIM_FAILED', message: error instanceof Error ? error.message : 'Claim failed' });
  }
}
