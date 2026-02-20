import { admin, firestore } from '../_lib/firebaseAdmin.js';
import { readJsonBody, sendJson } from '../_lib/http.js';
import {
  BATTLE_ENGINE_VERSION,
  BATTLE_STATES,
  assignTeam,
  battleSummary,
  buildBattleCaseSequence,
  createServerSeedCommit,
  parseAuth,
  toSafeClientSeed,
  withHttpError
} from '../_lib/battles.js';

const VALID_MODES = new Set(['REGULAR', 'CRAZY']);
const VALID_FORMATS = new Set(['1V1', '2V2']);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return sendJson(res, 405, { error: 'METHOD_NOT_ALLOWED', message: 'Only POST is supported.' });
  }

  try {
    const decoded = await parseAuth(req);
    const body = await readJsonBody(req);
    if (!body || typeof body !== 'object') {
      return sendJson(res, 400, { error: 'INVALID_REQUEST', message: 'Request body must be valid JSON.' });
    }

    const mode = typeof body.mode === 'string' ? body.mode.toUpperCase() : '';
    const format = typeof body.format === 'string' ? body.format.toUpperCase() : '';
    if (!VALID_MODES.has(mode)) {
      return sendJson(res, 400, { error: 'INVALID_MODE', message: 'mode must be REGULAR or CRAZY.' });
    }
    if (!VALID_FORMATS.has(format)) {
      return sendJson(res, 400, { error: 'INVALID_FORMAT', message: 'format must be 1V1 or 2V2.' });
    }

    const roundDurationMs = Number(body.roundDurationMs ?? 4500);
    const countdownSeconds = Number(body.countdownSeconds ?? 5);
    const entryCostCoins = Math.max(0, Math.floor(Number(body.entryCostCoins ?? 0)));

    if (!Number.isFinite(roundDurationMs) || roundDurationMs < 1200) {
      return sendJson(res, 400, { error: 'INVALID_ROUND_DURATION', message: 'roundDurationMs must be at least 1200.' });
    }

    const roundCases = buildBattleCaseSequence(body.cases, body.roundCount);
    const roundCount = roundCases.length;
    const maxPlayers = format === '2V2' ? 4 : 2;

    const userRef = firestore.collection('users').doc(decoded.uid);
    const battleRef = firestore.collection('battles').doc();
    const userRecord = await firestore.collection('users').doc(decoded.uid).get();
    const displayName = userRecord.data()?.displayName || userRecord.data()?.name || decoded.name || 'Player';
    const { serverSeedHash, serverSeedReveal } = createServerSeedCommit();

    await firestore.runTransaction(async (transaction) => {
      const userSnap = await transaction.get(userRef);
      const userData = userSnap.data() ?? {};
      const coins = Number(userData.coins ?? userData.balance ?? 0);
      if (coins < entryCostCoins) {
        throw { status: 402, error: 'INSUFFICIENT_FUNDS', message: 'Not enough coins for battle entry.' };
      }

      transaction.set(userRef, {
        coins: admin.firestore.FieldValue.increment(-entryCostCoins),
        coinsLocked: admin.firestore.FieldValue.increment(entryCostCoins)
      }, { merge: true });

      transaction.set(battleRef, {
        mode,
        format,
        state: BATTLE_STATES.LOBBY,
        version: 1,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        startedAt: null,
        countdownSeconds: Math.max(1, Math.floor(countdownSeconds)),
        roundDurationMs: Math.floor(roundDurationMs),
        roundCount,
        entryCostCoins,
        maxPlayers,
        cases: roundCases,
        players: [{
          uid: decoded.uid,
          displayName,
          team: assignTeam(format, 0),
          clientSeed: toSafeClientSeed(body.clientSeed),
          joinedAt: admin.firestore.Timestamp.now()
        }],
        serverSeedHash,
        serverSeedReveal,
        totalsByUid: {},
        totalsByTeam: { A: 0, B: 0 },
        winnerTeam: null,
        payoutsByUid: {},
        engine: {
          running: false,
          startedRunAt: null,
          engineVersion: BATTLE_ENGINE_VERSION
        }
      });
    });

    return sendJson(res, 200, { battleId: battleRef.id });
  } catch (error) {
    const safe = withHttpError(error, 'Failed to create battle.');
    return sendJson(res, safe.status, { error: safe.error, message: safe.message });
  }
}
