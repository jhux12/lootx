import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, Swords, Trophy } from 'lucide-react';
import { collection, doc, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '../firebase';
import { useGame } from '../context/GameContext';
import { CoinAmount } from './CoinAmount';
import { PRICE_UNIT_MODE, toCoins } from '../utils/coins';
import { authedFetch } from '../utils/authedFetch';

interface BattleArenaProps {
  battleId: string;
}

type BattleState = 'LOBBY' | 'COUNTDOWN' | 'RUNNING' | 'FINISHING' | 'COMPLETE' | 'CANCELLED';

interface RoundDoc {
  index: number;
  resultsByUid: Record<string, { itemName: string; value: number; rarity: string; proof: string; roll: number; nonce: number }>;
}

const tsToMs = (value: any) => (value?.toMillis ? value.toMillis() : Number(value ?? 0));

export const BattleArena: React.FC<BattleArenaProps> = ({ battleId }) => {
  const { setView, user } = useGame();
  const [battle, setBattle] = useState<any>(null);
  const [rounds, setRounds] = useState<RoundDoc[]>([]);
  const [now, setNow] = useState(Date.now());
  const [clientSeed, setClientSeed] = useState('');
  const [seedSaving, setSeedSaving] = useState(false);
  const startAttemptRef = useRef(false);

  useEffect(() => {
    const battleRef = doc(db, 'battles', battleId);
    const unsubBattle = onSnapshot(battleRef, (snap) => {
      if (!snap.exists()) {
        setBattle(null);
        return;
      }
      const data = snap.data();
      setBattle({ id: snap.id, ...data });
      const me = (data.players || []).find((player: any) => player.uid === user.id);
      if (me?.clientSeed) setClientSeed(me.clientSeed);
    });

    const roundsRef = query(collection(db, 'battles', battleId, 'rounds'), orderBy('index', 'asc'));
    const unsubRounds = onSnapshot(roundsRef, (snapshot) => {
      setRounds(snapshot.docs.map((docSnap) => ({ index: Number(docSnap.data().index ?? 0), ...(docSnap.data() as any) })));
    });

    return () => {
      unsubBattle();
      unsubRounds();
    };
  }, [battleId, user.id]);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 150);
    return () => clearInterval(interval);
  }, []);

  const startedAtMs = tsToMs(battle?.startedAt);
  const roundDurationMs = Number(battle?.roundDurationMs ?? 4500);
  const timelineRound = Math.max(0, Math.floor((now - startedAtMs) / Math.max(1, roundDurationMs)));
  const currentRound = Math.min(Number(battle?.roundCount ?? 0), timelineRound + 1);
  const players = Array.isArray(battle?.players) ? battle.players : [];
  const isParticipant = players.some((p: any) => p.uid === user.id);

  useEffect(() => {
    if (!battle || !isParticipant) return;
    if (battle.state !== 'COUNTDOWN') {
      startAttemptRef.current = false;
      return;
    }

    if (Date.now() < startedAtMs || startAttemptRef.current) return;
    startAttemptRef.current = true;
    void authedFetch('/api/battles/start', {
      method: 'POST',
      body: JSON.stringify({ battleId })
    }).catch(() => {
      startAttemptRef.current = false;
    });
  }, [battle, battleId, isParticipant, startedAtMs]);

  const winnerBadgeByUid = useMemo(() => {
    const winnerTeam = battle?.winnerTeam;
    const map: Record<string, boolean> = {};
    if (!winnerTeam || winnerTeam === 'TIE') return map;
    players.forEach((player: any) => {
      map[player.uid] = player.team === winnerTeam;
    });
    return map;
  }, [battle?.winnerTeam, players]);

  const saveSeed = async () => {
    setSeedSaving(true);
    try {
      await authedFetch('/api/battles/set-seed', {
        method: 'POST',
        body: JSON.stringify({ battleId, clientSeed })
      });
    } finally {
      setSeedSaving(false);
    }
  };

  if (!battle) return <div className="p-10 text-center text-gray-400">Battle not found</div>;

  const countdownMs = Math.max(0, startedAtMs - now);

  return (
    <div className="max-w-7xl mx-auto p-3 sm:p-4 md:p-6 animate-in fade-in duration-300">
      <div className="flex flex-col gap-4 mb-6">
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => setView({ type: 'BATTLES' })}
            className="flex items-center gap-2 px-3 py-2 bg-[#131825] rounded text-gray-400 hover:text-white text-sm font-medium transition-colors"
          >
            <ChevronLeft className="w-4 h-4" /> Exit Battle
          </button>
          <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
            <Swords className="w-5 h-5 text-brand-purple" /> Battle Arena
          </h2>
          <div className="text-xs text-gray-300 px-2 py-1 rounded bg-[#131720] border border-gray-800">
            {battle.mode} • {battle.format} • Round {currentRound}/{battle.roundCount}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="bg-[#131720] border border-gray-800 rounded-lg p-3">
            <div className="text-xs text-gray-500 uppercase">State</div>
            <div className="text-sm font-bold text-white">{battle.state}</div>
            {battle.state === 'COUNTDOWN' && <div className="text-xs text-yellow-400 mt-1">Starts in {(countdownMs / 1000).toFixed(1)}s</div>}
          </div>
          <div className="bg-[#131720] border border-gray-800 rounded-lg p-3">
            <div className="text-xs text-gray-500 uppercase">Entry</div>
            <CoinAmount amount={toCoins(battle.entryCostCoins || 0, PRICE_UNIT_MODE)} className="text-sm font-bold text-green-400" iconClassName="w-3.5 h-3.5" />
          </div>
          <div className="bg-[#131720] border border-gray-800 rounded-lg p-3">
            <div className="text-xs text-gray-500 uppercase">Provably Fair</div>
            <div className="text-[11px] text-gray-300 break-all">Hash: {battle.serverSeedHash}</div>
            {battle.serverSeedReveal && <div className="text-[11px] text-green-400 break-all mt-1">Reveal: {battle.serverSeedReveal}</div>}
          </div>
        </div>

        {isParticipant && (battle.state === 'LOBBY' || battle.state === 'COUNTDOWN') && (
          <div className="bg-[#131720] border border-gray-800 rounded-lg p-3 flex flex-col sm:flex-row gap-2 sm:items-center">
            <input
              value={clientSeed}
              onChange={(event) => setClientSeed(event.target.value)}
              className="flex-1 bg-[#0b0e14] border border-gray-700 rounded px-3 py-2 text-sm text-white"
              placeholder="Your client seed"
              maxLength={64}
            />
            <button
              onClick={saveSeed}
              disabled={seedSaving}
              className="px-4 py-2 bg-brand-purple hover:bg-purple-600 disabled:opacity-60 text-white rounded text-sm"
            >
              {seedSaving ? 'Saving...' : 'Save Seed'}
            </button>
          </div>
        )}
      </div>

      <div className={`grid gap-3 grid-cols-2 ${players.length > 2 ? 'md:grid-cols-4' : 'md:grid-cols-2'}`}>
        {players.map((player: any) => {
          const total = Number(battle?.totalsByUid?.[player.uid] ?? 0);
          const latest = rounds[Math.min(rounds.length - 1, Math.max(0, timelineRound))]?.resultsByUid?.[player.uid];
          return (
            <div key={player.uid} className={`bg-[#131720] border rounded-xl p-3 ${winnerBadgeByUid[player.uid] ? 'border-yellow-500' : 'border-gray-800'}`}>
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-bold text-white truncate">{player.displayName}</div>
                {winnerBadgeByUid[player.uid] && <Trophy className="w-4 h-4 text-yellow-500" />}
              </div>
              <div className="text-[11px] text-gray-500">Team {player.team}</div>
              <CoinAmount amount={toCoins(total, PRICE_UNIT_MODE)} className="text-sm font-bold text-green-400 mt-1" iconClassName="w-3 h-3" />
              <div className="mt-3 bg-[#0b0e14] border border-gray-800 rounded p-2 min-h-[74px]">
                {latest ? (
                  <>
                    <div className="text-xs text-gray-300 truncate">{latest.itemName}</div>
                    <CoinAmount amount={toCoins(latest.value, PRICE_UNIT_MODE)} className="text-xs font-bold text-white mt-1" iconClassName="w-3 h-3" />
                    <div className="text-[10px] text-gray-500 mt-1">Roll {latest.roll.toFixed(6)}</div>
                  </>
                ) : (
                  <div className="text-xs text-gray-600">Waiting for reveal…</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
