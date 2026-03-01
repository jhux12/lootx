import { admin, firestore } from '../_lib/firebaseAdmin.js';
import { readJsonBody, sendJson } from '../_lib/http.js';
import { consumeRateLimit, getRateLimitKey } from '../_utils/ratelimit.js';
import {
  BATTLE_ENGINE_VERSION,
  BATTLE_STATES,
  parseAuth,
  runBattleEngine,
  withHttpError
} from '../_lib/battles.js';

const makeRunId = () => `run_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return sendJson(res, 405, { error: 'METHOD_NOT_ALLOWED', message: 'Only POST is supported.' });
  }

  try {
    const decoded = await parseAuth(req);
    const rateLimit = consumeRateLimit({
      key: getRateLimitKey({ req, uid: decoded.uid, prefix: 'battle-start' }),
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
    let shouldRunEngine = false;

    await firestore.runTransaction(async (transaction) => {
      const battleSnap = await transaction.get(battleRef);
      if (!battleSnap.exists) {
        throw { status: 404, error: 'BATTLE_NOT_FOUND', message: 'Battle does not exist.' };
      }

      const battle = battleSnap.data() ?? {};
      const players = Array.isArray(battle.players) ? battle.players : [];

      if (!players.some((player) => player.uid === decoded.uid)) {
        throw { status: 403, error: 'NOT_PARTICIPANT', message: 'Only participants can start the battle.' };
      }

      if ([BATTLE_STATES.COMPLETE, BATTLE_STATES.FINISHING].includes(battle.state)) {
        shouldRunEngine = false;
        return;
      }

      if (battle.state === BATTLE_STATES.RUNNING) {
        shouldRunEngine = true;
        return;
      }

      const startedAtMs = typeof battle.startedAt?.toMillis === 'function' ? battle.startedAt.toMillis() : 0;
      if (battle.state !== BATTLE_STATES.COUNTDOWN || Date.now() < startedAtMs) {
        throw { status: 409, error: 'NOT_READY', message: 'Battle countdown has not finished yet.' };
      }

      const runId = typeof battle.runId === 'string' && battle.runId ? battle.runId : makeRunId();

      transaction.set(battleRef, {
        runId,
        runStartedAt: admin.firestore.FieldValue.serverTimestamp(),
        state: BATTLE_STATES.RUNNING,
        version: Number(battle.version ?? 0) + 1,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        currentRound: Number(battle.currentRound ?? 0),
        engine: {
          ...(battle.engine ?? {}),
          running: true,
          runStartedAt: admin.firestore.FieldValue.serverTimestamp(),
          lastHeartbeatAt: admin.firestore.FieldValue.serverTimestamp(),
          engineVersion: BATTLE_ENGINE_VERSION
        }
      }, { merge: true });

      shouldRunEngine = true;
    });

    if (!shouldRunEngine) {
      return sendJson(res, 200, { ok: true, status: 'noop' });
    }

    const engineResult = await runBattleEngine(battleId);
    return sendJson(res, 200, { ok: true, engineResult });
  } catch (error) {
    const safe = withHttpError(error, 'Failed to start battle.');
    return sendJson(res, safe.status, { error: safe.error, message: safe.message });
  }
}
