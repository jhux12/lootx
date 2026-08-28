import { admin, adminAuth, firestore } from '../_lib/firebaseAdmin.js';
import { getBearerToken, readJsonBody, sendJson } from '../_lib/http.js';
import { recordBalanceChange } from '../_lib/balanceAudit.js';

const PERIOD_MS = 30 * 24 * 60 * 60 * 1000;
const EPOCH_MS = Date.UTC(2026, 7, 1);
const MISSIONS = Object.freeze({
  deposit_50: { targetCents: 5000, rewardCoins: 250 },
  deposit_250: { targetCents: 25000, rewardCoins: 1000 },
  deposit_500: { targetCents: 50000, rewardCoins: 2500 }
});
const cycleStartFor = (now = Date.now()) => EPOCH_MS + Math.max(0, Math.floor((now - EPOCH_MS) / PERIOD_MS)) * PERIOD_MS;

export default async function handler(req, res) {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'METHOD_NOT_ALLOWED' });
  const token = getBearerToken(req);
  if (!token) return sendJson(res, 401, { error: 'UNAUTHENTICATED' });
  let decoded;
  try { decoded = await adminAuth.verifyIdToken(token); } catch { return sendJson(res, 401, { error: 'UNAUTHENTICATED' }); }
  const body = await readJsonBody(req);
  const missionId = typeof body?.missionId === 'string' ? body.missionId : '';
  const mission = MISSIONS[missionId];
  if (!mission) return sendJson(res, 400, { error: 'INVALID_MISSION' });

  try {
    let payload;
    await firestore.runTransaction(async (transaction) => {
      const cycleStart = cycleStartFor();
      const userRef = firestore.collection('users').doc(decoded.uid);
      const claimRef = userRef.collection('depositMissionClaims').doc(`${cycleStart}__${missionId}`);
      const [userSnap, claimSnap] = await Promise.all([transaction.get(userRef), transaction.get(claimRef)]);
      if (!userSnap.exists) throw new Error('User not found');
      if (claimSnap.exists) throw new Error('Reward already claimed');
      const userData = userSnap.data() ?? {};
      if (Number(userData.depositMissionCycleStart ?? 0) !== cycleStart) throw new Error('Deposit requirement not completed');
      const depositedCents = Math.max(0, Number(userData.depositMissionDepositedCents ?? 0));
      if (depositedCents < mission.targetCents) throw new Error('Deposit requirement not completed');
      if (userData.depositMissionClaims?.[missionId] === cycleStart) throw new Error('Reward already claimed');

      const { balanceAfter: newCoins } = await recordBalanceChange({
        transaction, uid: decoded.uid, userRef, userData, currency: 'coins', amount: mission.rewardCoins,
        reason: 'deposit_mission_reward', actorType: 'system', actorUid: null,
        source: 'api/rewards/claim-deposit-mission', relatedId: `${cycleStart}:${missionId}`,
        metadata: { missionId, cycleStart, targetCents: mission.targetCents }
      });
      transaction.set(userRef, { depositMissionClaims: { [missionId]: cycleStart }, lastDepositMissionClaimAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
      transaction.create(claimRef, { missionId, cycleStart, depositedCents, rewardCoins: mission.rewardCoins, createdAt: admin.firestore.FieldValue.serverTimestamp() });
      payload = { ok: true, newCoins, rewardCoins: mission.rewardCoins, cycleStart };
    });
    return sendJson(res, 200, payload);
  } catch (error) {
    return sendJson(res, 400, { error: 'CLAIM_FAILED', message: error instanceof Error ? error.message : 'Claim failed' });
  }
}
