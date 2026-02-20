import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ExternalLink, Loader2, ShieldCheck, Swords } from 'lucide-react';
import { collection, doc, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '../firebase';
import { useGame } from '../context/GameContext';
import { CoinAmount } from './CoinAmount';
import { PRICE_UNIT_MODE, toCoins } from '../utils/coins';
import { authedFetch } from '../utils/authedFetch';

interface BattleArenaProps {
  battleId: string;
}

interface RoundDoc {
  index: number;
  revealedAt?: any;
  resultsByUid: Record<string, { itemName: string; value: number; rarity: string; proof: string; roll: number }>;
}

const tsToMs = (value: any) => (value?.toMillis ? value.toMillis() : Number(value ?? 0));
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const BattleArena: React.FC<BattleArenaProps> = ({ battleId }) => {
  const { setView, user, joinBattle } = useGame();
  const [battle, setBattle] = useState<any>(null);
  const [rounds, setRounds] = useState<RoundDoc[]>([]);
  const [now, setNow] = useState(Date.now());
  const [tickLoading, setTickLoading] = useState(false);
  const [showPfModal, setShowPfModal] = useState(false);
  const [displayedRoundIndex, setDisplayedRoundIndex] = useState(-1);
  const startAttemptRef = useRef(false);
  const isPlaybackRunningRef = useRef(false);
  const playbackCursorRef = useRef(-1);

  useEffect(() => {
    const battleRef = doc(db, 'battles', battleId);
    const unsubBattle = onSnapshot(battleRef, (snap) => {
      setBattle(snap.exists() ? { id: snap.id, ...snap.data() } : null);
    });

    const roundsRef = query(collection(db, 'battles', battleId, 'rounds'), orderBy('index', 'asc'));
    const unsubRounds = onSnapshot(roundsRef, (snapshot) => {
      const nextRounds = snapshot.docs
        .map((docSnap) => ({ index: Number(docSnap.data().index ?? 0), ...(docSnap.data() as any) }))
        .sort((a, b) => a.index - b.index);
      setRounds(nextRounds);
    });

    return () => {
      unsubBattle();
      unsubRounds();
    };
  }, [battleId]);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!rounds.length) return;
    if (isPlaybackRunningRef.current) return;

    const roundDurationMs = Math.max(1200, Number(battle?.roundDurationMs ?? 2000));

    const runPlayback = async () => {
      isPlaybackRunningRef.current = true;
      try {
        while (playbackCursorRef.current + 1 < rounds.length) {
          const nextIndex = playbackCursorRef.current + 1;
          playbackCursorRef.current = nextIndex;
          setDisplayedRoundIndex(nextIndex);
          await sleep(roundDurationMs);
        }
      } finally {
        isPlaybackRunningRef.current = false;
      }
    };

    void runPlayback();
  }, [rounds, battle?.roundDurationMs]);

  const players = Array.isArray(battle?.players) ? battle.players : [];
  const isParticipant = players.some((player: any) => player.uid === user.id);
  const startedAtMs = tsToMs(battle?.startedAt);
  const shownRound = Math.max(1, Math.min(Number(battle?.roundCount ?? 1), displayedRoundIndex + 1));

  const runTick = async () => {
    if (!battle || tickLoading) return;
    if (!['LOBBY', 'COUNTDOWN'].includes(String(battle.state))) return;
    if ((battle.players || []).length >= Number(battle.maxPlayers ?? 2)) return;

    setTickLoading(true);
    try {
      await authedFetch('/api/battles/tick', { method: 'POST', body: JSON.stringify({ battleId }) });
    } catch {
      // no-op
    } finally {
      setTickLoading(false);
    }
  };

  useEffect(() => {
    void runTick();
    const interval = window.setInterval(() => void runTick(), 2500);
    return () => window.clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [battle?.id, battle?.state, battle?.players?.length]);

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

  const teamA = useMemo(() => players.filter((player: any) => player.team === 'A'), [players]);
  const teamB = useMemo(() => players.filter((player: any) => player.team === 'B'), [players]);

  if (!battle) return <div className="p-8 text-center text-gray-400">Battle not found.</div>;

  const countdownMs = Math.max(0, startedAtMs - now);
  const displayedRound = displayedRoundIndex >= 0 ? rounds[displayedRoundIndex] : null;
  const fallbackFinalRound = rounds.length ? rounds[rounds.length - 1] : null;

  const resolvePlayerResult = (uid: string) => {
    if (displayedRound?.resultsByUid?.[uid]) return displayedRound.resultsByUid[uid];
    if (battle.state === 'COMPLETE' && fallbackFinalRound?.resultsByUid?.[uid]) return fallbackFinalRound.resultsByUid[uid];
    return null;
  };

  const renderPlayerCard = (player: any) => {
    const total = Number(battle?.totalsByUid?.[player.uid] ?? 0);
    const lastResult = resolvePlayerResult(player.uid);

    return (
      <div key={player.uid} className="bg-[#131720] border border-gray-800 rounded-xl p-3">
        <div className="flex items-center gap-2 mb-2">
          <img src={player.avatar || `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(player.uid)}`} className="w-9 h-9 rounded-md border border-gray-700" />
          <div className="min-w-0">
            <div className="text-sm text-white font-bold truncate">{player.displayName}</div>
            <div className="text-[11px] text-gray-500">{player.isBot ? 'House Bot' : player.uid === user.id ? 'You' : 'Player'}</div>
          </div>
        </div>
        <CoinAmount amount={toCoins(total, PRICE_UNIT_MODE)} className="text-sm font-bold text-green-400" iconClassName="w-3 h-3" />
        <div className="mt-2 rounded-lg border border-gray-800 bg-[#0b0e14] p-2 min-h-[56px]">
          {lastResult ? (
            <>
              <div className="text-xs text-gray-300 truncate">{lastResult.itemName}</div>
              <CoinAmount amount={toCoins(lastResult.value, PRICE_UNIT_MODE)} className="text-xs font-bold text-white mt-1" iconClassName="w-3 h-3" />
            </>
          ) : (
            <div className="text-xs text-gray-600">Waiting for reveal…</div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 pb-8">
      <div className="flex flex-wrap items-center gap-2 py-4">
        <button onClick={() => setView({ type: 'BATTLES' })} className="flex items-center gap-1 px-3 py-2 rounded bg-[#131825] text-gray-300 text-sm hover:text-white">
          <ChevronLeft className="w-4 h-4" /> Exit Battle
        </button>
        {!isParticipant && <span className="text-xs px-2 py-1 rounded bg-blue-500/10 text-blue-300 border border-blue-500/30">Spectating</span>}
        <button onClick={() => setShowPfModal(true)} className="ml-auto text-xs sm:text-sm px-3 py-2 rounded border border-gray-700 text-gray-200 hover:border-brand-purple flex items-center gap-2">
          <ShieldCheck className="w-4 h-4" /> Provably Fair
        </button>
      </div>

      <div className="bg-[#131720] border border-gray-800 rounded-xl p-3 sm:p-4 mb-4">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2"><Swords className="w-5 h-5 text-brand-purple" /> Battle Arena</h2>
          <div className="text-xs px-2 py-1 rounded bg-[#0b0e14] border border-gray-700 text-gray-300">{battle.mode} • {battle.format}</div>
          <div className="text-xs px-2 py-1 rounded bg-[#0b0e14] border border-gray-700 text-gray-300">Round {shownRound}/{Math.max(1, Number(battle.roundCount ?? 1))}</div>
          <div className="text-xs px-2 py-1 rounded bg-[#0b0e14] border border-gray-700 text-gray-300">{battle.state}</div>
        </div>
        {battle.state === 'COUNTDOWN' && <div className="mt-2 text-sm text-yellow-300">Starting in {(countdownMs / 1000).toFixed(1)}s</div>}
        {(battle.state === 'LOBBY' || battle.state === 'COUNTDOWN') && Number(players.length) < Number(battle.maxPlayers ?? 2) && (
          <div className="mt-2 text-xs text-gray-400 flex items-center gap-2">{tickLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : null} Waiting for players and bots…</div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[1fr_minmax(220px,320px)_1fr] gap-3">
        <div className="space-y-2">
          <div className="text-xs text-gray-500 uppercase">Team A</div>
          {teamA.map(renderPlayerCard)}
        </div>

        <div className="bg-[#131720] border border-gray-800 rounded-xl p-4 flex flex-col justify-center items-center text-center min-h-[180px]">
          <div className="text-sm text-gray-400">Current State</div>
          <div className="text-xl font-bold text-white mt-1">{battle.state}</div>
          {battle.state === 'LOBBY' && isParticipant && (
            <button onClick={() => setView({ type: 'BATTLES' })} className="mt-3 text-xs px-3 py-2 rounded border border-gray-700 text-gray-300 hover:text-white">Leave Battle</button>
          )}
          {!isParticipant && (
            <button onClick={() => joinBattle(battleId)} className="mt-3 text-xs px-3 py-2 rounded bg-green-600 text-white">Join if slot opens</button>
          )}
        </div>

        <div className="space-y-2">
          <div className="text-xs text-gray-500 uppercase">Team B</div>
          {teamB.map(renderPlayerCard)}
        </div>
      </div>

      <div className="mt-4 bg-[#131720] border border-gray-800 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-gray-300">Totals</div>
        <div className="flex gap-4 text-sm">
          <div className="text-blue-300">Team A: <span className="font-bold text-white">{toCoins(Number(battle.totalsByTeam?.A ?? 0), PRICE_UNIT_MODE)}</span></div>
          <div className="text-red-300">Team B: <span className="font-bold text-white">{toCoins(Number(battle.totalsByTeam?.B ?? 0), PRICE_UNIT_MODE)}</span></div>
        </div>
      </div>

      {showPfModal && (
        <div className="fixed inset-0 z-[120] bg-black/75 backdrop-blur-sm flex items-center justify-center p-3" onClick={() => setShowPfModal(false)}>
          <div className="w-full max-w-md bg-[#131720] border border-gray-700 rounded-xl p-4" onClick={(event) => event.stopPropagation()}>
            <h3 className="text-lg font-bold text-white mb-2">Provably Fair</h3>
            <p className="text-sm text-gray-300">Battle outcomes are server-generated using commit/reveal with player seeds and per-round proofs.</p>
            <p className="text-xs text-gray-500 mt-2">Use the verify page to inspect server seed hash, reveal value, client seeds, and round proofs.</p>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setShowPfModal(false)} className="px-3 py-2 text-sm rounded border border-gray-700 text-gray-300">Close</button>
              <button
                onClick={() => {
                  setShowPfModal(false);
                  if (typeof window !== 'undefined') {
                    window.history.replaceState({}, '', `/provably-fair/battle/${battleId}`);
                  }
                  setView({ type: 'PROVABLY_FAIR' });
                }}
                className="px-3 py-2 text-sm rounded bg-brand-purple text-white flex items-center gap-2"
              >
                Verify Battle <ExternalLink className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
