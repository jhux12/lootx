import { admin, firestore } from '../_lib/firebaseAdmin.js';
import { readJsonBody, sendJson } from '../_lib/http.js';
import { BATTLE_STATES, assignTeam, battleSummary, parseAuth, withHttpError } from '../_lib/battles.js';
import { consumeRateLimit, getRateLimitKey } from '../_utils/ratelimit.js';

const TICK_MIN_INTERVAL_MS = 2000;
const makeRunId = () => `run_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return sendJson(res, 405, { error: 'METHOD_NOT_ALLOWED', message: 'Only POST is supported.' });
  }

  try {
    const decoded = await parseAuth(req);
    const rateLimit = consumeRateLimit({
      key: getRateLimitKey({ req, uid: decoded.uid, prefix: 'battle-tick' }),
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
    let summary = null;
    let action = 'noop';

    await firestore.runTransaction(async (transaction) => {
      const snap = await transaction.get(battleRef);
      if (!snap.exists) {
        throw { status: 404, error: 'BATTLE_NOT_FOUND', message: 'Battle does not exist.' };
      }

      const battle = snap.data() ?? {};
      const state = battle.state;
      const maxPlayers = Number(battle.maxPlayers ?? 2);
      const players = Array.isArray(battle.players) ? [...battle.players] : [];
      const createdAtMs = typeof battle.createdAt?.toMillis === 'function' ? battle.createdAt.toMillis() : Date.now();
      const botFill = {
        enabled: battle.botFill?.enabled !== false,
        joinAfterMs: Math.max(2000, Number(battle.botFill?.joinAfterMs ?? 12000)),
        lastTickAt: battle.botFill?.lastTickAt ?? null
      };

      const nowMs = Date.now();
      const lastTickAtMs = typeof botFill.lastTickAt?.toMillis === 'function' ? botFill.lastTickAt.toMillis() : 0;

      if (![BATTLE_STATES.LOBBY, BATTLE_STATES.COUNTDOWN, BATTLE_STATES.RUNNING].includes(state)) {
        summary = battleSummary(battleId, battle);
        return;
      }

      if (nowMs - lastTickAtMs < TICK_MIN_INTERVAL_MS) {
        summary = battleSummary(battleId, battle);
        return;
      }

      const patch = {
        botFill: {
          ...botFill,
          lastTickAt: admin.firestore.Timestamp.now()
        },
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };

      if (
        state === BATTLE_STATES.LOBBY &&
        botFill.enabled &&
        players.length < maxPlayers &&
        nowMs >= createdAtMs + botFill.joinAfterMs
      ) {
        let serial = players.filter((player) => String(player.uid || '').startsWith(`bot_${battleId}_`)).length;
        while (players.length < maxPlayers) {
          serial += 1;
          const uid = `bot_${battleId}_${serial}`;
          if (players.some((player) => player.uid === uid)) continue;
          players.push({
            uid,
            displayName: `Bot #${100 + serial}`,
            team: assignTeam(battle.format, players.length),
            clientSeed: `bot-${battleId}-${serial}`,
            joinedAt: admin.firestore.Timestamp.now(),
            isBot: true,
            isHouseBot: true,
            avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(uid)}`
          });
        }
        patch.players = players;
        action = 'filled_bots';
      }

      const nextPlayers = Array.isArray(patch.players) ? patch.players : players;
      const isFull = nextPlayers.length >= maxPlayers;

      if (state === BATTLE_STATES.LOBBY && isFull) {
        patch.state = BATTLE_STATES.COUNTDOWN;
        patch.startedAt = admin.firestore.Timestamp.fromMillis(nowMs + Math.max(1, Number(battle.countdownSeconds ?? 5)) * 1000);
        action = action === 'filled_bots' ? 'filled_bots_countdown' : 'countdown';
      }

      const startedAtMs = typeof battle.startedAt?.toMillis === 'function'
        ? battle.startedAt.toMillis()
        : (typeof patch.startedAt?.toMillis === 'function' ? patch.startedAt.toMillis() : 0);

      if (
        (state === BATTLE_STATES.COUNTDOWN || patch.state === BATTLE_STATES.COUNTDOWN) &&
        isFull &&
        nowMs >= startedAtMs
      ) {
        patch.state = BATTLE_STATES.RUNNING;
        patch.engine = {
          ...(battle.engine ?? {}),
          starting: true,
          running: true,
          runId: battle.engine?.runId || makeRunId(),
          runStartedAt: admin.firestore.FieldValue.serverTimestamp(),
          lastHeartbeatAt: admin.firestore.FieldValue.serverTimestamp()
        };
        action = 'started';
      }

      transaction.set(battleRef, patch, { merge: true });
      summary = battleSummary(battleId, { ...battle, ...patch });
    });

    return sendJson(res, 200, { ok: true, action, state: summary?.state, battle: summary });
  } catch (error) {
    const safe = withHttpError(error, 'Failed to tick battle.');
    return sendJson(res, safe.status, { error: safe.error, message: safe.message });
  }
}
