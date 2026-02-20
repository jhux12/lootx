import { admin, firestore } from '../_lib/firebaseAdmin.js';
import { readJsonBody, sendJson } from '../_lib/http.js';
import {
  BATTLE_STATES,
  assignTeam,
  battleSummary,
  maybeStartBattle,
  parseAuth,
  withHttpError
} from '../_lib/battles.js';

const TICK_MIN_INTERVAL_MS = 2000;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return sendJson(res, 405, { error: 'METHOD_NOT_ALLOWED', message: 'Only POST is supported.' });
  }

  try {
    await parseAuth(req);
    const body = await readJsonBody(req);
    const battleId = typeof body?.battleId === 'string' ? body.battleId : '';
    if (!battleId) {
      return sendJson(res, 400, { error: 'INVALID_REQUEST', message: 'battleId is required.' });
    }

    const battleRef = firestore.collection('battles').doc(battleId);
    let summary = null;

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
        lastTickAt: battle.botFill?.lastTickAt ?? null,
        maxBotAddsPerTick: Math.max(1, Math.floor(Number(battle.botFill?.maxBotAddsPerTick ?? 2)))
      };

      const nowMs = Date.now();
      const lastTickAtMs = typeof botFill.lastTickAt?.toMillis === 'function' ? botFill.lastTickAt.toMillis() : 0;

      if (![BATTLE_STATES.LOBBY, BATTLE_STATES.COUNTDOWN].includes(state)) {
        summary = battleSummary(battleId, battle);
        return;
      }

      if (nowMs - lastTickAtMs < TICK_MIN_INTERVAL_MS) {
        summary = battleSummary(battleId, battle);
        return;
      }

      let patch = {
        botFill: {
          ...botFill,
          lastTickAt: admin.firestore.Timestamp.now()
        },
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };

      const shouldAddBots =
        botFill.enabled &&
        players.length < maxPlayers &&
        nowMs >= createdAtMs + botFill.joinAfterMs;

      if (shouldAddBots) {
        const missing = maxPlayers - players.length;
        const adds = Math.min(missing, botFill.maxBotAddsPerTick);
        let serial = players.filter((player) => String(player.uid || '').startsWith(`bot_${battleId}_`)).length;

        for (let i = 0; i < adds; i += 1) {
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

        patch = {
          ...patch,
          players,
          version: Number(battle.version ?? 0) + 1
        };
      }

      const nextPlayers = patch.players || players;
      const isFull = nextPlayers.length >= maxPlayers;
      if (isFull && state === BATTLE_STATES.LOBBY) {
        patch = {
          ...patch,
          state: BATTLE_STATES.COUNTDOWN,
          startedAt: admin.firestore.Timestamp.fromMillis(nowMs + Math.max(1, Number(battle.countdownSeconds ?? 5)) * 1000),
          version: Number((patch.version ?? battle.version) ?? 0) + 1
        };
      }

      transaction.set(battleRef, patch, { merge: true });
      summary = battleSummary(battleId, { ...battle, ...patch });
    });

    const startResult = await maybeStartBattle(battleId);
    const refreshed = await battleRef.get();
    const refreshedData = refreshed.exists ? refreshed.data() ?? {} : {};

    return sendJson(res, 200, {
      ok: true,
      action: startResult.action,
      reason: startResult.reason ?? null,
      battle: refreshed.exists ? battleSummary(battleId, refreshedData) : summary
    });
  } catch (error) {
    const safe = withHttpError(error, 'Failed to tick battle.');
    return sendJson(res, safe.status, { error: safe.error, message: safe.message });
  }
}
