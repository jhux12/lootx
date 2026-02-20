import { admin, adminAuth, firestore } from './firebaseAdmin.js';
import { getBearerToken } from './http.js';
import { hmacSha256Hex, randomSeed, sha256 } from './provablyFair.js';

const BATTLE_ENGINE_VERSION = '1.1.0';

export const BATTLE_STATES = {
  LOBBY: 'LOBBY',
  COUNTDOWN: 'COUNTDOWN',
  RUNNING: 'RUNNING',
  FINISHING: 'FINISHING',
  COMPLETE: 'COMPLETE',
  CANCELLED: 'CANCELLED'
};

export const parseAuth = async (req) => {
  const token = getBearerToken(req);
  if (!token) {
    throw { status: 401, error: 'AUTH_REQUIRED', message: 'Authorization bearer token is required.' };
  }

  try {
    return await adminAuth.verifyIdToken(token);
  } catch {
    throw { status: 401, error: 'AUTH_INVALID', message: 'Invalid authentication token.' };
  }
};

export const nowTs = () => admin.firestore.FieldValue.serverTimestamp();

const toTimestampMs = (value) => {
  if (!value) return 0;
  if (typeof value.toMillis === 'function') return value.toMillis();
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
};

export const battleSummary = (battleId, data) => ({
  id: battleId,
  mode: data.mode,
  format: data.format,
  state: data.state,
  version: Number(data.version ?? 0),
  countdownSeconds: Number(data.countdownSeconds ?? 5),
  startedAtMs: toTimestampMs(data.startedAt),
  roundDurationMs: Number(data.roundDurationMs ?? 4500),
  roundCount: Number(data.roundCount ?? 0),
  entryCostCoins: Number(data.entryCostCoins ?? 0),
  maxPlayers: Number(data.maxPlayers ?? 2),
  players: Array.isArray(data.players) ? data.players : [],
  cases: Array.isArray(data.cases) ? data.cases : [],
  botFill: data.botFill ?? null
});

export const assignTeam = (format, playerIndex) => {
  if (format === '1V1') return playerIndex === 0 ? 'A' : 'B';
  return playerIndex % 2 === 0 ? 'A' : 'B';
};

export const toSafeClientSeed = (seed) => {
  if (typeof seed !== 'string') return `seed-${Math.random().toString(36).slice(2, 12)}`;
  const clean = seed.trim().slice(0, 64);
  return clean || `seed-${Math.random().toString(36).slice(2, 12)}`;
};

export const buildBattleCaseSequence = (cases, roundCount) => {
  if (!Array.isArray(cases) || !cases.length) {
    throw { status: 400, error: 'INVALID_CASES', message: 'At least one case is required.' };
  }

  const normalized = [];
  for (const entry of cases) {
    if (typeof entry === 'string' && entry.trim()) {
      normalized.push({ caseId: entry.trim(), repeats: 1 });
      continue;
    }

    const caseId = typeof entry?.caseId === 'string' ? entry.caseId.trim() : '';
    const repeatsRaw = Number(entry?.repeats ?? 1);
    const repeats = Number.isFinite(repeatsRaw) ? Math.max(1, Math.floor(repeatsRaw)) : 1;
    if (!caseId) continue;
    normalized.push({ caseId, repeats });
  }

  if (!normalized.length) {
    throw { status: 400, error: 'INVALID_CASES', message: 'No valid case IDs were provided.' };
  }

  const expanded = [];
  normalized.forEach((entry) => {
    for (let i = 0; i < entry.repeats; i += 1) {
      expanded.push({ caseId: entry.caseId, repeats: 1 });
    }
  });

  const effectiveRounds = Number.isFinite(Number(roundCount))
    ? Math.max(1, Math.floor(Number(roundCount)))
    : expanded.length;

  const roundCases = [];
  for (let i = 0; i < effectiveRounds; i += 1) {
    roundCases.push(expanded[i % expanded.length]);
  }

  return roundCases;
};

export const createServerSeedCommit = () => {
  const serverSeedReveal = randomSeed();
  return { serverSeedReveal, serverSeedHash: sha256(serverSeedReveal) };
};

const rollFromHex = (hex) => {
  const intValue = parseInt(hex.slice(0, 13), 16);
  return intValue / 0x10000000000000;
};

export const computeBattleRoll = ({ serverSeed, battleId, uid, clientSeed, roundIndex, nonce }) => {
  const message = `${battleId}:${uid}:${clientSeed}:${roundIndex}:${nonce}`;
  const proof = hmacSha256Hex(serverSeed, message);
  return {
    roll: rollFromHex(proof),
    nonce,
    proof,
    message
  };
};

export const pickItemByRoll = (items, roll) => {
  const weighted = (Array.isArray(items) ? items : [])
    .map((item) => ({
      ...item,
      weight: Number(item.weight ?? item.chance ?? 0)
    }))
    .filter((item) => item.weight > 0);

  if (!weighted.length) {
    throw new Error('Case has no weighted items. TODO: hook battle selector to canonical prize odds source.');
  }

  const totalWeight = weighted.reduce((sum, item) => sum + item.weight, 0);
  let cursor = roll * totalWeight;
  for (const item of weighted) {
    if (cursor < item.weight) return item;
    cursor -= item.weight;
  }

  return weighted[weighted.length - 1];
};

export const withHttpError = (error, fallbackMessage) => {
  if (error && typeof error.status === 'number') return error;
  return {
    status: 500,
    error: 'INTERNAL_ERROR',
    message: fallbackMessage
  };
};

export const runBattleEngine = async (battleId) => {
  const battleRef = firestore.collection('battles').doc(battleId);
  const roundsRef = battleRef.collection('rounds');

  const battleSnap = await battleRef.get();
  if (!battleSnap.exists) {
    throw { status: 404, error: 'BATTLE_NOT_FOUND', message: 'Battle does not exist.' };
  }

  const battle = battleSnap.data() ?? {};
  if (battle.state === BATTLE_STATES.COMPLETE) {
    return { status: 'already-complete' };
  }

  const existingRoundsSnap = await roundsRef.get();
  if (existingRoundsSnap.size > 0) {
    return { status: 'rounds-exist' };
  }

  const players = Array.isArray(battle.players) ? battle.players : [];
  const cases = Array.isArray(battle.cases) ? battle.cases : [];
  const roundCount = Number(battle.roundCount ?? cases.length ?? 0);

  if (!players.length || !roundCount || !battle.serverSeedReveal) {
    throw { status: 400, error: 'INVALID_BATTLE_STATE', message: 'Battle missing players, rounds, or provably fair seed.' };
  }

  const caseIds = [...new Set(cases.map((entry) => entry?.caseId).filter(Boolean))];
  const caseDocs = await Promise.all(caseIds.map((caseId) => firestore.collection('boxes').doc(caseId).get()));
  const caseMap = new Map(caseDocs.filter((snap) => snap.exists).map((snap) => [snap.id, snap.data() ?? {}]));

  const totalsByUid = {};
  const totalsByTeam = { A: 0, B: 0 };
  const roundsPayload = [];

  for (let roundIndex = 0; roundIndex < roundCount; roundIndex += 1) {
    const caseId = cases[roundIndex]?.caseId;
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
        value,
        rarity: selected.rarity ?? 'common',
        roll,
        nonce,
        proof
      };

      totalsByUid[uid] = Number(totalsByUid[uid] ?? 0) + value;
      const team = player.team === 'B' ? 'B' : 'A';
      totalsByTeam[team] += value;
    });

    roundsPayload.push({
      index: roundIndex,
      createdAt: nowTs(),
      resultsByUid,
      revealedAt: nowTs()
    });
  }

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

  await firestore.runTransaction(async (transaction) => {
    const freshBattleSnap = await transaction.get(battleRef);
    if (!freshBattleSnap.exists) return;
    const fresh = freshBattleSnap.data() ?? {};

    if (fresh.state === BATTLE_STATES.COMPLETE) return;

    const freshRounds = await roundsRef.get();
    if (freshRounds.size === 0) {
      roundsPayload.forEach((round) => {
        const ref = roundsRef.doc(String(round.index));
        transaction.set(ref, round, { merge: false });
      });
    }

    const entryCostCoins = Number(fresh.entryCostCoins ?? 0);
    const freshPlayers = Array.isArray(fresh.players) ? fresh.players : [];

    freshPlayers
      .filter((player) => player.isHouseBot !== true)
      .forEach((player) => {
        const userRef = firestore.collection('users').doc(player.uid);
        transaction.set(
          userRef,
          {
            coinsLocked: admin.firestore.FieldValue.increment(-entryCostCoins),
            coins: admin.firestore.FieldValue.increment(Number(payoutsByUid[player.uid] ?? 0))
          },
          { merge: true }
        );
      });

    transaction.set(
      battleRef,
      {
        totalsByUid,
        totalsByTeam,
        winnerTeam,
        payoutsByUid,
        state: BATTLE_STATES.COMPLETE,
        serverSeedReveal: fresh.serverSeedReveal,
        version: Number(fresh.version ?? 0) + 1,
        updatedAt: nowTs(),
        engine: {
          running: false,
          startedRunAt: fresh.engine?.startedRunAt ?? nowTs(),
          engineVersion: fresh.engine?.engineVersion ?? BATTLE_ENGINE_VERSION
        }
      },
      { merge: true }
    );
  });

  return {
    status: 'complete',
    totalsByUid,
    totalsByTeam,
    winnerTeam,
    payoutsByUid
  };
};

export { BATTLE_ENGINE_VERSION };
