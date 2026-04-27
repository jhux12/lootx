import { admin, firestore } from '../_lib/firebaseAdmin.js';
import { readJsonBody, sendJson } from '../_lib/http.js';
import { recordBalanceChange } from '../_lib/balanceAudit.js';
import { consumeRateLimit, getRateLimitKey } from '../_utils/ratelimit.js';
import {
  BATTLE_STATES,
  computeBattleRoll,
  parseAuth,
  pickItemByRoll,
  toSafeClientSeed,
  withHttpError
} from '../_lib/battles.js';

const resolveCaseMap = async (cases) => {
  const caseIds = [...new Set((Array.isArray(cases) ? cases : []).map((entry) => entry?.caseId).filter(Boolean))];
  const caseDocs = await Promise.all(caseIds.map((caseId) => firestore.collection('boxes').doc(caseId).get()));
  return new Map(caseDocs.filter((snap) => snap.exists).map((snap) => [snap.id, snap.data() ?? {}]));
};

const computeRoundResults = ({ battle, players, caseMap, battleId, roundIndex }) => {
  const caseId = battle.cases?.[roundIndex]?.caseId;
  const caseData = caseMap.get(caseId) ?? {};
  const items = Array.isArray(caseData.items) ? caseData.items : [];
  const resultsByUid = {};

  players.forEach((player) => {
    const uid = player.uid;
    const clientSeed = toSafeClientSeed(player.clientSeed);
    const nonce = roundIndex;
    const { roll, proof } = computeBattleRoll({
      serverSeed: battle.serverSeedReveal,
      battleId,
      uid,
      clientSeed,
      roundIndex,
      nonce
    });
    const selected = pickItemByRoll(items, roll);
    const value = Number(selected.value ?? selected.price ?? 0);

    resultsByUid[uid] = {
      itemId: selected.id ?? null,
      itemName: selected.name ?? 'Mystery Item',
      imageUrl: selected.image ?? selected.imageUrl ?? '',
      value,
      rarity: selected.rarity ?? 'common',
      roll,
      nonce,
      proof
    };
  });

  return resultsByUid;
};

const settleBattle = ({ battle, players, allRoundResults }) => {
  const totalsByUid = {};
  const totalsByTeam = { A: 0, B: 0 };

  allRoundResults.forEach((roundResult) => {
    players.forEach((player) => {
      const uid = player.uid;
      const value = Number(roundResult?.[uid]?.value ?? 0);
      totalsByUid[uid] = Number(totalsByUid[uid] ?? 0) + value;
      const team = player.team === 'B' ? 'B' : 'A';
      totalsByTeam[team] += value;
    });
  });

  let winnerTeam = 'TIE';
  if (battle.mode === 'CRAZY') {
    if (totalsByTeam.A < totalsByTeam.B) winnerTeam = 'A';
    if (totalsByTeam.B < totalsByTeam.A) winnerTeam = 'B';
  } else {
    if (totalsByTeam.A > totalsByTeam.B) winnerTeam = 'A';
    if (totalsByTeam.B > totalsByTeam.A) winnerTeam = 'B';
  }

  const realPlayers = players.filter((player) => player.isHouseBot !== true);
  const pot = Number(battle.entryCostCoins ?? 0) * realPlayers.length;
  const payoutsByUid = {};

  if (winnerTeam === 'TIE') {
    const share = players.length ? Math.floor(pot / players.length) : 0;
    players.forEach((player) => {
      payoutsByUid[player.uid] = share;
    });
  } else {
    const winners = players.filter((player) => player.team === winnerTeam);
    const share = winners.length ? Math.floor(pot / winners.length) : 0;
    players.forEach((player) => {
      payoutsByUid[player.uid] = player.team === winnerTeam ? share : 0;
    });
  }

  return { totalsByUid, totalsByTeam, winnerTeam, payoutsByUid };
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return sendJson(res, 405, { error: 'METHOD_NOT_ALLOWED', message: 'Only POST is supported.' });
  }

  try {
    const decoded = await parseAuth(req);
    const rateLimit = consumeRateLimit({
      key: getRateLimitKey({ req, uid: decoded.uid, prefix: 'battle-progress' }),
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
    const roundsRef = battleRef.collection('rounds');

    const battleSnap = await battleRef.get();
    if (!battleSnap.exists) {
      return sendJson(res, 404, { error: 'BATTLE_NOT_FOUND', message: 'Battle does not exist.' });
    }

    const battle = battleSnap.data() ?? {};
    if (battle.state !== BATTLE_STATES.RUNNING) {
      return sendJson(res, 200, { ok: true, action: 'noop', state: battle.state });
    }

    const players = Array.isArray(battle.players) ? battle.players : [];
    const roundCount = Math.max(0, Number(battle.roundCount ?? 0));

    const roundsSnap = await roundsRef.orderBy('index', 'asc').get();
    const existingIndexes = new Set(roundsSnap.docs.map((docSnap) => Number(docSnap.data().index ?? docSnap.id)));

    let nextRound = -1;
    for (let i = 0; i < roundCount; i += 1) {
      if (!existingIndexes.has(i)) {
        nextRound = i;
        break;
      }
    }

    if (nextRound < 0 || nextRound >= roundCount) {
      const allRoundResults = roundsSnap.docs
        .map((docSnap) => ({ index: Number(docSnap.data().index ?? docSnap.id), resultsByUid: docSnap.data().resultsByUid ?? {} }))
        .sort((a, b) => a.index - b.index)
        .map((entry) => entry.resultsByUid);

      const settlement = settleBattle({ battle, players, allRoundResults });

      await firestore.runTransaction(async (transaction) => {
        const freshBattleSnap = await transaction.get(battleRef);
        if (!freshBattleSnap.exists) return;
        const fresh = freshBattleSnap.data() ?? {};
        if (fresh.state === BATTLE_STATES.COMPLETE) return;

        const entryCostCoins = Number(fresh.entryCostCoins ?? 0);
        const freshPlayers = Array.isArray(fresh.players) ? fresh.players : [];

        for (const player of freshPlayers.filter((entry) => entry.isHouseBot !== true)) {
          const userRef = firestore.collection('users').doc(player.uid);
          transaction.set(userRef, { coinsLocked: admin.firestore.FieldValue.increment(-entryCostCoins) }, { merge: true });
          await recordBalanceChange({
            transaction,
            uid: player.uid,
            currency: 'coins',
            amount: Number(settlement.payoutsByUid[player.uid] ?? 0),
            reason: 'battle_payout',
            actorType: 'system',
            actorUid: null,
            source: 'api/battles/progress',
            relatedId: battleId,
            metadata: { winnerTeam: settlement.winnerTeam, mode: fresh.mode, format: fresh.format }
          });
        }

        transaction.set(battleRef, {
          totalsByUid: settlement.totalsByUid,
          totalsByTeam: settlement.totalsByTeam,
          winnerTeam: settlement.winnerTeam,
          payoutsByUid: settlement.payoutsByUid,
          state: BATTLE_STATES.COMPLETE,
          currentRound: roundCount,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          engine: {
            ...(fresh.engine ?? {}),
            starting: false,
            running: false,
            lastHeartbeatAt: admin.firestore.FieldValue.serverTimestamp()
          }
        }, { merge: true });
      });

      return sendJson(res, 200, { ok: true, action: 'complete' });
    }

    const caseMap = await resolveCaseMap(Array.isArray(battle.cases) ? battle.cases : []);
    const resultsByUid = computeRoundResults({ battle, players, caseMap, battleId, roundIndex: nextRound });

    await firestore.runTransaction(async (transaction) => {
      const freshBattleSnap = await transaction.get(battleRef);
      if (!freshBattleSnap.exists) {
        throw { status: 404, error: 'BATTLE_NOT_FOUND', message: 'Battle does not exist.' };
      }
      const fresh = freshBattleSnap.data() ?? {};
      if (fresh.state !== BATTLE_STATES.RUNNING) return;

      const roundRef = roundsRef.doc(String(nextRound));
      const existingRound = await transaction.get(roundRef);
      if (!existingRound.exists) {
        transaction.set(roundRef, {
          index: nextRound,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          revealedAt: admin.firestore.FieldValue.serverTimestamp(),
          resultsByUid
        }, { merge: true });
      }

      transaction.set(battleRef, {
        currentRound: nextRound,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        engine: {
          ...(fresh.engine ?? {}),
          running: true,
          starting: false,
          lastHeartbeatAt: admin.firestore.FieldValue.serverTimestamp()
        }
      }, { merge: true });
    });

    return sendJson(res, 200, { ok: true, action: 'wrote_round', round: nextRound });
  } catch (error) {
    const safe = withHttpError(error, 'Failed to progress battle.');
    return sendJson(res, safe.status, { error: safe.error, message: safe.message });
  }
}
