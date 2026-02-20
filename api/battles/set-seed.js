import { admin, firestore } from '../_lib/firebaseAdmin.js';
import { readJsonBody, sendJson } from '../_lib/http.js';
import { BATTLE_STATES, parseAuth, toSafeClientSeed, withHttpError } from '../_lib/battles.js';

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
    const clientSeed = toSafeClientSeed(body?.clientSeed);

    await firestore.runTransaction(async (transaction) => {
      const battleSnap = await transaction.get(battleRef);
      if (!battleSnap.exists) {
        throw { status: 404, error: 'BATTLE_NOT_FOUND', message: 'Battle does not exist.' };
      }

      const battle = battleSnap.data() ?? {};
      const state = battle.state;
      if (state !== BATTLE_STATES.LOBBY && state !== BATTLE_STATES.COUNTDOWN) {
        throw { status: 409, error: 'BATTLE_LOCKED', message: 'Cannot update seed once battle is running.' };
      }

      const startedAtMs = typeof battle.startedAt?.toMillis === 'function'
        ? battle.startedAt.toMillis()
        : Number.MAX_SAFE_INTEGER;

      if (state === BATTLE_STATES.COUNTDOWN && Date.now() >= startedAtMs) {
        throw { status: 409, error: 'SEED_LOCKED', message: 'Client seed lock time has passed.' };
      }

      const players = Array.isArray(battle.players) ? [...battle.players] : [];
      const index = players.findIndex((player) => player.uid === decoded.uid);
      if (index < 0) {
        throw { status: 403, error: 'NOT_PARTICIPANT', message: 'Only battle participants can set a seed.' };
      }

      players[index] = {
        ...players[index],
        clientSeed,
        joinedAt: players[index].joinedAt || admin.firestore.FieldValue.serverTimestamp()
      };

      transaction.set(battleRef, {
        players,
        version: Number(battle.version ?? 0) + 1,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    });

    return sendJson(res, 200, { ok: true });
  } catch (error) {
    const safe = withHttpError(error, 'Failed to update seed.');
    return sendJson(res, safe.status, { error: safe.error, message: safe.message });
  }
}
