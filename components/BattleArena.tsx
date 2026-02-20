import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, ChevronLeft, ExternalLink, Loader2, ShieldCheck, SkipForward, Swords } from 'lucide-react';
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
  resultsByUid: Record<string, { itemName: string; value: number; rarity: string; proof: string; roll: number; imageUrl?: string }>;
}

interface ProgressResponse {
  action?: string;
}

const tsToMs = (value: any) => (value?.toMillis ? value.toMillis() : Number(value ?? 0));

export const BattleArena: React.FC<BattleArenaProps> = ({ battleId }) => {
  const { setView, user, joinBattle, createBattle } = useGame();
  const [battle, setBattle] = useState<any>(null);
  const [rounds, setRounds] = useState<RoundDoc[]>([]);
  const [now, setNow] = useState(Date.now());
  const [tickLoading, setTickLoading] = useState(false);
  const [progressLoading, setProgressLoading] = useState(false);
  const [showPfModal, setShowPfModal] = useState(false);
  const [playheadRound, setPlayheadRound] = useState(-1);
  const [skipAnimation, setSkipAnimation] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [showForceProgress, setShowForceProgress] = useState(false);
  const progressInFlightRef = useRef(false);
  const noopSinceRef = useRef<number | null>(null);

  useEffect(() => {
    setPlayheadRound(-1);
    setSkipAnimation(false);
    setLastError(null);
    setShowForceProgress(false);
    noopSinceRef.current = null;
  }, [battleId]);

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
    const interval = window.setInterval(() => setNow(Date.now()), 300);
    return () => window.clearInterval(interval);
  }, []);

  const players = Array.isArray(battle?.players) ? battle.players : [];
  const isParticipant = players.some((player: any) => player.uid === user.id);
  const startedAtMs = tsToMs(battle?.startedAt);
  const countdownMs = Math.max(0, startedAtMs - now);
  const roundCount = Math.max(1, Number(battle?.roundCount ?? 1));
  const roundDurationMs = Math.max(1500, Number(battle?.roundDurationMs ?? 3800));
  const shownRound = Math.max(1, Math.min(roundCount, playheadRound + 1));
  const roundsByIndex = useMemo(() => new Map(rounds.map((round) => [round.index, round])), [rounds]);
  const canShowWinner = skipAnimation || playheadRound >= roundCount - 1;

  const callTick = async () => {
    if (!battle || tickLoading) return;
    if (!['LOBBY', 'COUNTDOWN', 'RUNNING'].includes(String(battle.state))) return;

    setTickLoading(true);
    try {
      await authedFetch('/api/battles/tick', { method: 'POST', body: JSON.stringify({ battleId }) });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown tick error';
      console.error('Battle tick failed', { battleId, error });
      setLastError(`Tick failed: ${message}`);
    } finally {
      setTickLoading(false);
    }
  };

  const callProgress = async (forced = false) => {
    if (!battle || progressInFlightRef.current) return;
    if (battle.state !== 'RUNNING') return;

    progressInFlightRef.current = true;
    setProgressLoading(true);
    try {
      const response = await authedFetch<ProgressResponse>('/api/battles/progress', { method: 'POST', body: JSON.stringify({ battleId }) });
      const isNoop = response?.action === 'noop';
      const nowTs = Date.now();

      if (!isNoop || forced) {
        noopSinceRef.current = null;
        setShowForceProgress(false);
        setLastError(null);
        return;
      }

      if (!noopSinceRef.current) {
        noopSinceRef.current = nowTs;
        setShowForceProgress(false);
        return;
      }

      if (nowTs - noopSinceRef.current > 10000) {
        setShowForceProgress(true);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown progress error';
      console.error('Battle progress failed', { battleId, error });
      setLastError(`Progress failed: ${message}`);
    } finally {
      progressInFlightRef.current = false;
      setProgressLoading(false);
    }
  };

  useEffect(() => {
    if (!battle || !['LOBBY', 'COUNTDOWN'].includes(String(battle.state))) return;

    void callTick();
    const interval = window.setInterval(() => void callTick(), 2000);
    return () => window.clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [battle?.id, battle?.state, battle?.players?.length]);

  useEffect(() => {
    if (!battle || battle.state !== 'RUNNING') return;

    noopSinceRef.current = null;
    setShowForceProgress(false);

    void callProgress();
    const interval = window.setInterval(() => void callProgress(), Math.max(2000, roundDurationMs - 250));
    return () => window.clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [battle?.id, battle?.state, roundDurationMs]);

  useEffect(() => {
    if (!battle || skipAnimation) return;
    if (playheadRound >= roundCount - 1) return;

    const nextIndex = playheadRound + 1;
    if (!roundsByIndex.has(nextIndex)) return;

    const timer = window.setTimeout(() => {
      setPlayheadRound(nextIndex);
    }, nextIndex === 0 ? 700 : roundDurationMs);

    return () => window.clearTimeout(timer);
  }, [battle, skipAnimation, playheadRound, roundCount, roundsByIndex, roundDurationMs]);

  if (!battle) return <div className="p-8 text-center text-gray-400">Battle not found.</div>;

  const statusLabel = (() => {
    if (battle.state === 'COUNTDOWN') return `Starting • ${(countdownMs / 1000).toFixed(1)}s`;
    if (battle.state === 'RUNNING') return `Live • Round ${shownRound}/${roundCount}`;
    if (battle.state === 'COMPLETE') return 'Replay';
    return `Waiting • ${players.length}/${Number(battle.maxPlayers ?? 2)}`;
  })();

  const recreateBattle = () => {
    const caseIds = (Array.isArray(battle?.cases) ? battle.cases : [])
      .map((entry: any) => entry?.caseId)
      .filter(Boolean);
    if (!caseIds.length) return;
    createBattle(caseIds, Number(battle.maxPlayers ?? 2), { mode: battle.mode, format: battle.format });
  };

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 pb-10">
      {lastError && (
        <div className="mb-3 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs sm:text-sm text-red-200 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <span className="break-words">{lastError}</span>
        </div>
      )}

      <div className="flex flex-wrap gap-2 py-4 items-center">
        <button onClick={() => setView({ type: 'BATTLES' })} className="flex items-center gap-1 px-3 py-2 rounded bg-[#131825] text-gray-300 text-sm hover:text-white">
          <ChevronLeft className="w-4 h-4" /> Back
        </button>
        <span className="text-xs px-2 py-1 rounded border border-brand-purple/40 bg-brand-purple/10 text-brand-purple">{statusLabel}</span>
        {!isParticipant && <span className="text-xs px-2 py-1 rounded border border-blue-500/30 bg-blue-500/10 text-blue-300">Spectator</span>}
        <button onClick={() => setShowPfModal(true)} className="ml-auto text-xs px-3 py-2 rounded border border-gray-700 text-gray-200 hover:border-brand-purple flex items-center gap-1">
          <ShieldCheck className="w-4 h-4" /> Provably Fair
        </button>
      </div>

      <div className="rounded-2xl border border-gray-800 bg-[#101624] p-4 sm:p-5 mb-4">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <h2 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2"><Swords className="w-5 h-5 text-brand-purple" /> Box Battle</h2>
          <span className="text-xs px-2 py-1 rounded bg-[#0b0e14] border border-gray-700 text-gray-300">{battle.mode}</span>
          <span className="text-xs px-2 py-1 rounded bg-[#0b0e14] border border-gray-700 text-gray-300">{battle.format}</span>
          <span className="text-xs px-2 py-1 rounded bg-[#0b0e14] border border-gray-700 text-gray-300">{battle.winConditionLabel || (battle.mode === 'CRAZY' ? 'Lowest Total' : 'Highest Total')}</span>
          <div className="sm:ml-auto flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <CoinAmount amount={toCoins(Number(battle.entryCostCoins ?? 0), PRICE_UNIT_MODE)} className="text-green-400 font-black" iconClassName="w-4 h-4" />
            <button onClick={recreateBattle} className="px-3 py-2 text-xs sm:text-sm rounded bg-brand-purple text-white font-semibold">Recreate Battle</button>
            {battle.state !== 'COMPLETE' && (
              <button onClick={() => setSkipAnimation(true)} className="px-3 py-2 text-xs sm:text-sm rounded border border-gray-600 text-gray-200 inline-flex items-center gap-1">
                <SkipForward className="w-4 h-4" /> Skip
              </button>
            )}
            {battle.state === 'RUNNING' && showForceProgress && (
              <button onClick={() => void callProgress(true)} className="px-3 py-2 text-xs sm:text-sm rounded border border-amber-500/60 text-amber-200 hover:bg-amber-500/10">
                Force Progress
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {players.map((player: any) => (
          <div key={player.uid} className="rounded-xl border border-gray-800 bg-[#131720] p-3">
            <div className="flex items-center gap-2 mb-3">
              <img src={player.avatar || `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(player.uid)}`} className="w-8 h-8 rounded-md border border-gray-700" />
              <div className="text-sm font-bold text-white truncate">{player.displayName}</div>
              <div className="text-[11px] text-gray-500">{player.team === 'B' ? 'Team B' : 'Team A'}</div>
              <div className="ml-auto">
                <CoinAmount amount={toCoins(Number(battle?.totalsByUid?.[player.uid] ?? 0), PRICE_UNIT_MODE)} className="text-xs sm:text-sm font-bold text-green-400" iconClassName="w-3 h-3" />
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
              {Array.from({ length: roundCount }).map((_, roundIndex) => {
                const round = roundsByIndex.get(roundIndex);
                const result = round?.resultsByUid?.[player.uid];
                const revealed = roundIndex <= playheadRound || skipAnimation;
                const hasData = !!result;
                const isCurrentSpin = roundIndex === playheadRound + 1 && battle.state === 'RUNNING';

                return (
                  <div key={`${player.uid}-r-${roundIndex}`} className="rounded-lg border border-gray-800 bg-[#0b0e14] p-2 min-h-[88px]">
                    <div className="text-[10px] uppercase text-gray-500 mb-1">Round {roundIndex + 1}</div>
                    {!hasData && (
                      <div className="text-xs text-gray-500 flex items-center gap-1">
                        {isCurrentSpin ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                        <span>Loading…</span>
                      </div>
                    )}
                    {hasData && !revealed && (
                      <div className="text-xs text-gray-500 flex items-center gap-1">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        <span>Spinning…</span>
                      </div>
                    )}
                    {hasData && revealed && (
                      <>
                        <div className="text-xs text-gray-300 truncate">{result.itemName}</div>
                        <CoinAmount amount={toCoins(result.value, PRICE_UNIT_MODE)} className="text-xs font-bold text-white mt-1" iconClassName="w-3 h-3" />
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {(battle.state === 'LOBBY' || battle.state === 'COUNTDOWN' || battle.state === 'RUNNING') && (
        <div className="mt-4 text-xs text-gray-400 flex items-center gap-2">
          {(tickLoading || progressLoading) ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
          {battle.state === 'RUNNING' ? 'Streaming live rounds…' : 'Waiting for players and countdown…'}
        </div>
      )}

      {battle.state === 'COMPLETE' && canShowWinner && (
        <div className="mt-4 rounded-xl border border-green-700/40 bg-green-500/10 p-4">
          <div className="text-xs text-green-300 uppercase">Winner</div>
          <div className="text-xl font-black text-white mt-1">{battle.winnerTeam === 'TIE' ? 'Tie' : `Team ${battle.winnerTeam}`}</div>
        </div>
      )}

      {!isParticipant && battle.state !== 'COMPLETE' && (
        <div className="mt-4">
          <button onClick={() => joinBattle(battleId)} className="px-3 py-2 text-xs rounded bg-green-600 text-white">Join if slot opens</button>
        </div>
      )}

      {showPfModal && (
        <div className="fixed inset-0 z-[120] bg-black/75 backdrop-blur-sm flex items-center justify-center p-3" onClick={() => setShowPfModal(false)}>
          <div className="w-full max-w-md bg-[#131720] border border-gray-700 rounded-xl p-4" onClick={(event) => event.stopPropagation()}>
            <h3 className="text-lg font-bold text-white mb-2">Provably Fair</h3>
            <p className="text-sm text-gray-300">Battle results are server-generated and revealed with per-round proofs once rounds are written.</p>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setShowPfModal(false)} className="px-3 py-2 text-sm rounded border border-gray-700 text-gray-300">Close</button>
              <button
                onClick={() => {
                  setShowPfModal(false);
                  if (typeof window !== 'undefined') {
                    window.history.replaceState({}, '', `/fairness/battle/${battleId}`);
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
