import { admin, firestore } from '../_lib/firebaseAdmin.js';
import { readJsonBody, sendJson } from '../_lib/http.js';
import {
  BATTLE_ENGINE_VERSION,
  BATTLE_STATES,
  parseAuth,
  runBattleEngine,
  withHttpError
} from '../_lib/battles.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return sendJson(res, 405, { error: 'METHOD_NOT_ALLOWED', message: 'Only POST is supported.' });
  }

  try {
    const decoded = await parseAuth(req);
    const body = await readJsonBody(req);
    const battleId = typeof body?.battleId === 'string' ? body.battleId : '';
    if (!battleId) {
      return sendJson(res, 400, { error: 'INVALID_REQUEST', message: 'battleId is required.' });
    }

    const battleRef = firestore.collection('battles').doc(battleId);

    await firestore.runTransaction(async (transaction) => {
      const battleSnap = await transaction.get(battleRef);
      if (!battleSnap.exists) {
        throw { status: 404, error: 'BATTLE_NOT_FOUND', message: 'Battle does not exist.' };
      }

      const battle = battleSnap.data() ?? {};
      if (battle.state === BATTLE_STATES.COMPLETE) return;

      const players = Array.isArray(battle.players) ? battle.players : [];
      if (!players.some((player) => player.uid === decoded.uid)) {
        throw { status: 403, error: 'NOT_PARTICIPANT', message: 'Only participants can start the battle.' };
      }

      const startedAtMs = typeof battle.startedAt?.toMillis === 'function'
        ? battle.startedAt.toMillis()
        : 0;

      if (battle.state !== BATTLE_STATES.COUNTDOWN || Date.now() < startedAtMs) {
        throw { status: 409, error: 'NOT_READY', message: 'Battle countdown has not finished yet.' };
      }

      if (battle.engine?.running === true) {
        return;
      }

      transaction.set(battleRef, {
        state: BATTLE_STATES.RUNNING,
        version: Number(battle.version ?? 0) + 1,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        engine: {
          running: true,
          startedRunAt: admin.firestore.FieldValue.serverTimestamp(),
          engineVersion: BATTLE_ENGINE_VERSION
        }
      }, { merge: true });
    });

    const engineResult = await runBattleEngine(battleId);
    return sendJson(res, 200, { ok: true, engineResult });
  } catch (error) {
    const safe = withHttpError(error, 'Failed to start battle.');
    return sendJson(res, safe.status, { error: safe.error, message: safe.message });
  }
}
