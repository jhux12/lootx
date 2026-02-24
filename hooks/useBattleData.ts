import { useEffect, useMemo, useState } from 'react';
import { collection, doc, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '../firebase';

export type TeamKey = 'A' | 'B';

export type PlayerSlot = {
  uid: string;
  displayName: string;
  avatar: string;
  team: TeamKey;
  isPlaceholder?: boolean;
};

export type RoundDoc = {
  index: number;
  resultsByUid: Record<string, any>;
};

const toMaxPlayers = (format: any) => {
  if (format === '2v2' || format === 4 || format === 'FOUR') return 4;
  return 2;
};

const seatPlaceholder = (team: TeamKey, idx: number): PlayerSlot => ({
  uid: `placeholder-${team}-${idx}`,
  displayName: 'Empty Seat',
  avatar: '',
  team,
  isPlaceholder: true
});

export const useBattleData = (battleId: string) => {
  const [battle, setBattle] = useState<any | null>(null);
  const [roundDocs, setRoundDocs] = useState<RoundDoc[]>([]);
  const [loadedAtLeastOnce, setLoadedAtLeastOnce] = useState(false);

  useEffect(() => {
    const unsubBattle = onSnapshot(doc(db, 'battles', battleId), (snap) => {
      setLoadedAtLeastOnce(true);
      setBattle(snap.exists() ? { id: snap.id, ...snap.data() } : null);
    });

    const roundsQ = query(collection(db, 'battles', battleId, 'rounds'), orderBy('index', 'asc'));
    const unsubRounds = onSnapshot(roundsQ, (snapshot) => {
      const next = snapshot.docs.map((d) => {
        const data = d.data() as any;
        return {
          index: Number(data.index ?? 0),
          resultsByUid: (data.resultsByUid ?? {}) as Record<string, any>
        };
      }).sort((a, b) => a.index - b.index);
      setRoundDocs(next);
    });

    return () => {
      unsubBattle();
      unsubRounds();
    };
  }, [battleId]);

  const maxPlayers = useMemo(() => toMaxPlayers(battle?.format ?? battle?.maxPlayers), [battle?.format, battle?.maxPlayers]);
  const slotsPerTeam = maxPlayers === 4 ? 2 : 1;

  const playersByTeam = useMemo(() => {
    const players = Array.isArray(battle?.players) ? battle.players : [];
    const teamA = players.filter((p: any) => p?.team !== 'B').map((p: any) => ({
      uid: String(p.uid),
      displayName: String(p.displayName || p.username || p.name || 'Player'),
      avatar: String(p.avatar || p.photoURL || ''),
      team: 'A' as const
    }));
    const teamB = players.filter((p: any) => p?.team === 'B').map((p: any) => ({
      uid: String(p.uid),
      displayName: String(p.displayName || p.username || p.name || 'Player'),
      avatar: String(p.avatar || p.photoURL || ''),
      team: 'B' as const
    }));

    while (teamA.length < slotsPerTeam) teamA.push(seatPlaceholder('A', teamA.length));
    while (teamB.length < slotsPerTeam) teamB.push(seatPlaceholder('B', teamB.length));

    return { A: teamA, B: teamB };
  }, [battle?.players, slotsPerTeam]);

  const rounds = useMemo(() => {
    const declaredCount = Number(battle?.roundCount ?? 0);
    const inferredCount = roundDocs.length ? (Math.max(...roundDocs.map((r) => r.index)) + 1) : 0;
    const size = Math.max(1, declaredCount, inferredCount);
    const arr = Array.from({ length: size }, () => null as RoundDoc | null);
    roundDocs.forEach((round) => {
      if (round.index >= 0 && round.index < arr.length) arr[round.index] = round;
    });
    return arr;
  }, [battle?.roundCount, roundDocs]);

  const lastRoundIndex = useMemo(() => {
    const explicit = Number(battle?.roundCount ?? 0);
    if (explicit > 0) return explicit - 1;
    const highest = roundDocs.length ? Math.max(...roundDocs.map((r) => r.index)) : 0;
    return highest;
  }, [battle?.roundCount, roundDocs]);

  const state = String(battle?.state ?? '');
  const isLive = state === 'LOBBY' || state === 'COUNTDOWN' || state === 'RUNNING';
  const isReplay = state === 'COMPLETE';
  const haveAllRounds = rounds.length > 0 && rounds.every((r) => r !== null);

  return {
    battle,
    rounds,
    playersByTeam,
    isLive,
    isReplay,
    maxPlayers,
    lastRoundIndex,
    haveAllRounds,
    loadedAtLeastOnce
  };
};
