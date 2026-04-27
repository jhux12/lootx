import { admin, firestore } from '../_lib/firebaseAdmin.js';
import { applySpendAndRewards, getRewardsSettings } from '../_lib/rewards.js';
import { readJsonBody, sendJson } from '../_lib/http.js';
import { recordBalanceChange } from '../_lib/balanceAudit.js';
import { consumeRateLimit, getRateLimitKey } from '../_utils/ratelimit.js';
import {
  BATTLE_STATES,
  assignTeam,
  battleSummary,
  parseAuth,
  toSafeClientSeed,
  withHttpError
} from '../_lib/battles.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return sendJson(res, 405, { error: 'METHOD_NOT_ALLOWED', message: 'Only POST is supported.' });
  }

  try {
    const decoded = await parseAuth(req);
    const rateLimit = consumeRateLimit({
      key: getRateLimitKey({ req, uid: decoded.uid, prefix: 'battle-join' }),
      limit: 30,
      windowMs: 60_000
    });
    if (!rateLimit.ok) {
      return sendJson(res, 429, { ok: false, error: 'Rate limit' });
    }

    const body = await readJsonBody(req);
    const battleId = typeof body?.battleId === 'string' ? body.battleId : '';
    if (!battleId) {
      return sendJson(res, 400, { error: 'INVALID_REQUEST', message: 'battleId is required.' });
    }

    const battleRef = firestore.collection('battles').doc(battleId);
    const userRef = firestore.collection('users').doc(decoded.uid);
    const userRecord = await userRef.get();
    const userData = userRecord.data() ?? {};
    const displayName = userData.displayName || userData.name || decoded.name || 'Player';

    let summary = null;

    await firestore.runTransaction(async (transaction) => {
      const [battleSnap, userSnap] = await Promise.all([
        transaction.get(battleRef),
        transaction.get(userRef)
      ]);
      const { settings: rewardsSettings } = await getRewardsSettings(transaction);

      if (!battleSnap.exists) {
        throw { status: 404, error: 'BATTLE_NOT_FOUND', message: 'Battle does not exist.' };
      }

      const battle = battleSnap.data() ?? {};
      if (battle.state !== BATTLE_STATES.LOBBY) {
        throw { status: 409, error: 'BATTLE_LOCKED', message: 'Battle is no longer joinable.' };
      }

      const players = Array.isArray(battle.players) ? [...battle.players] : [];
      const maxPlayers = Number(battle.maxPlayers ?? 2);
      const already = players.find((player) => player.uid === decoded.uid);

      if (!already && players.length >= maxPlayers) {
        throw { status: 409, error: 'BATTLE_FULL', message: 'Battle is full.' };
      }

      const entryCostCoins = Number(battle.entryCostCoins ?? 0);
      const coins = Number(userSnap.data()?.coins ?? userSnap.data()?.balance ?? 0);

      if (!already && coins < entryCostCoins) {
        throw { status: 402, error: 'INSUFFICIENT_FUNDS', message: 'Not enough coins to join battle.' };
      }

      if (!already) {
        players.push({
          uid: decoded.uid,
          displayName,
          team: assignTeam(battle.format, players.length),
          clientSeed: toSafeClientSeed(body.clientSeed),
          joinedAt: admin.firestore.Timestamp.now()
        });

        await recordBalanceChange({
          transaction,
          uid: decoded.uid,
          currency: 'coins',
          amount: -entryCostCoins,
          reason: 'battle_entry_fee',
          actorType: 'user',
          actorUid: decoded.uid,
          source: 'api/battles/join',
          relatedId: battleId,
          metadata: { battleId }
        });
        transaction.set(userRef, { coinsLocked: admin.firestore.FieldValue.increment(entryCostCoins) }, { merge: true });

        await applySpendAndRewards({
          transaction,
          uid: decoded.uid,
          userRef,
          coinsSpent: entryCostCoins,
          context: 'battle_join',
          referenceId: battleId,
          userData,
          rewardsSettings
        });
      }

      const isFull = players.length >= maxPlayers;
      const nextState = isFull ? BATTLE_STATES.COUNTDOWN : BATTLE_STATES.LOBBY;
      const countdownSeconds = Number(battle.countdownSeconds ?? 5);
      const startTimestamp = isFull
        ? admin.firestore.Timestamp.fromMillis(Date.now() + Math.max(1, countdownSeconds) * 1000)
        : battle.startedAt ?? null;

      const nextVersion = Number(battle.version ?? 0) + (already ? 0 : 1);
      const patch = {
        players,
        state: nextState,
        startedAt: startTimestamp,
        version: nextVersion,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };
      transaction.set(battleRef, patch, { merge: true });

      summary = battleSummary(battleId, { ...battle, ...patch });
    });

    return sendJson(res, 200, { battle: summary });
  } catch (error) {
    const safe = withHttpError(error, 'Failed to join battle.');
    return sendJson(res, safe.status, { error: safe.error, message: safe.message });
  }
}
