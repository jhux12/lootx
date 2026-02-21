import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, Crown, ExternalLink, Loader2, ShieldCheck, SkipForward, Swords } from 'lucide-react';
import { collection, doc, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '../firebase';
import { useGame } from '../context/GameContext';
import { CoinAmount } from './CoinAmount';
import { PRICE_UNIT_MODE, toCoins } from '../utils/coins';
import { authedFetch } from '../utils/authedFetch';
import { BattleResultTray } from './battles/BattleResultTray';
import { DeterministicReel, DeterministicReelItem } from './battles/DeterministicReel';
import { RoundRecapOverlay } from './battles/RoundRecapOverlay';

interface BattleArenaProps {
  battleId: string;
}

interface RoundDoc {
  index: number;
  resultsByUid: Record<string, any>;
}

type UiPhase =
  | 'UI_LOBBY'
  | 'UI_COUNTDOWN'
  | 'UI_ROUND_INTRO'
  | 'UI_SPINNING'
  | 'UI_ROUND_REVEAL'
  | 'UI_INTERMISSION'
  | 'UI_FINAL_REVEAL'
  | 'UI_COMPLETE';

const introMs = 600;
const revealMs = 950;
const freezeAfterSpinMs = 2200;
const intermissionMs = 450;
const finalRevealMs = 1200;

const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));
const tsToMs = (value: any) => (value?.toMillis ? value.toMillis() : Number(value ?? 0));

const EMPTY_SEAT = (team: 'A' | 'B', idx: number) => ({
  uid: `empty-${team}-${idx}`,
  displayName: 'Waiting for player…',
  avatar: '',
  team,
  isEmptySeat: true
});

export const BattleArena: React.FC<BattleArenaProps> = ({ battleId }) => {
  const { setView, user, joinBattle, createBattle, items } = useGame();
  const [battle, setBattle] = useState<any>(null);
  const [rounds, setRounds] = useState<RoundDoc[]>([]);
  const [now, setNow] = useState(Date.now());
  const [showFairModal, setShowFairModal] = useState(false);
  const [uiPhase, setUiPhase] = useState<UiPhase>('UI_LOBBY');
  const [activeRoundIndex, setActiveRoundIndex] = useState(-1);
  const [revealedRounds, setRevealedRounds] = useState<Set<number>>(new Set());
  const [skipRequested, setSkipRequested] = useState(false);
  const [trayOpen, setTrayOpen] = useState(false);
  const [displayTotals, setDisplayTotals] = useState({ A: 0, B: 0 });
  const [tickLoading, setTickLoading] = useState(false);
  const [progressLoading, setProgressLoading] = useState(false);

  const runningPlaybackRef = useRef(false);
  const onRoundDoneRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    const battleRef = doc(db, 'battles', battleId);
    const unsubBattle = onSnapshot(battleRef, (snap) => setBattle(snap.exists() ? { id: snap.id, ...snap.data() } : null));

    const roundsRef = query(collection(db, 'battles', battleId, 'rounds'), orderBy('index', 'asc'));
    const unsubRounds = onSnapshot(roundsRef, (snapshot) => {
      const parsed = snapshot.docs
        .map((docSnap) => ({ index: Number(docSnap.data().index ?? 0), ...(docSnap.data() as any) }))
        .sort((a, b) => a.index - b.index);
      setRounds(parsed);
    });

    return () => {
      unsubBattle();
      unsubRounds();
    };
  }, [battleId]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 300);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    setUiPhase('UI_LOBBY');
    setActiveRoundIndex(-1);
    setRevealedRounds(new Set());
    setSkipRequested(false);
    setTrayOpen(false);
    onRoundDoneRef.current = new Set();
  }, [battleId]);

  const players = Array.isArray(battle?.players) ? battle.players : [];
  const roundCount = Math.max(1, Number(battle?.roundCount ?? 1));
  const maxPlayers = Math.max(2, Number(battle?.maxPlayers ?? 2));
  const slotsPerTeam = Math.max(1, Math.floor(maxPlayers / 2));
  const spinMs = Math.min(Math.max(1800, Number(battle?.roundDurationMs ?? 3600)), 4200);
  const isParticipant = players.some((p: any) => p.uid === user.id);

  const teams = useMemo(() => {
    const actualA = players.filter((p: any) => p.team !== 'B');
    const actualB = players.filter((p: any) => p.team === 'B');
    const filledA = [...actualA];
    const filledB = [...actualB];

    while (filledA.length < slotsPerTeam) filledA.push(EMPTY_SEAT('A', filledA.length));
    while (filledB.length < slotsPerTeam) filledB.push(EMPTY_SEAT('B', filledB.length));

    return { A: filledA, B: filledB };
  }, [players, slotsPerTeam]);

  const normalizeItem = (entry: any): DeterministicReelItem | null => {
    if (!entry) return null;
    const name = entry.name || entry.itemName;
    const id = entry.id || entry.itemId || entry.name || entry.itemName;
    if (!name || !id) return null;
    return {
      id: String(id),
      name: String(name),
      imageUrl: String(entry.imageUrl || entry.image || ''),
      value: Number(entry.value ?? entry.price ?? 0),
      rarity: entry.rarity
    };
  };

  const fillerPool = useMemo(() => {
    const fromCases = (Array.isArray(battle?.cases) ? battle.cases : []).flatMap((battleCase: any) => Array.isArray(battleCase?.items) ? battleCase.items : []);
    const fromGlobal = Array.isArray(items) ? items.slice(0, 60) : [];
    const fromRounds = rounds.flatMap((round) => Object.values(round.resultsByUid ?? {}));

    const dedupe = new Map<string, DeterministicReelItem>();
    [...fromCases, ...fromGlobal, ...fromRounds].forEach((entry) => {
      const item = normalizeItem(entry);
      if (!item) return;
      if (!dedupe.has(item.id)) dedupe.set(item.id, item);
    });

    const pool = Array.from(dedupe.values());
    if (!pool.length) {
      return [{ id: 'seed-default', name: 'Mystery Item', imageUrl: '', value: 0, rarity: 'common' }];
    }

    while (pool.length < 20) {
      pool.push(...pool.slice(0, Math.max(1, Math.min(10, pool.length))));
    }

    return pool.slice(0, 120);
  }, [battle?.cases, items, rounds]);

  const roundsMap = useMemo(() => new Map(rounds.map((round) => [round.index, round])), [rounds]);
  const roundOrder = useMemo(() => rounds.map((round) => round.index).sort((a, b) => a - b), [rounds]);

  const calculateTeamTotalsUntil = (lastRoundIndex: number) => {
    const totals = { A: 0, B: 0 };
    for (let idx = 0; idx <= lastRoundIndex; idx += 1) {
      const round = roundsMap.get(idx);
      if (!round) continue;
      players.forEach((player: any) => {
        const value = Number(round.resultsByUid?.[player.uid]?.value ?? 0);
        if (player.team === 'B') totals.B += value;
        else totals.A += value;
      });
    }
    return totals;
  };

  const targetTotals = useMemo(() => {
    if (activeRoundIndex < 0) return { A: 0, B: 0 };
    return calculateTeamTotalsUntil(activeRoundIndex);
  }, [activeRoundIndex, roundsMap, players]);

  useEffect(() => {
    const startA = displayTotals.A;
    const startB = displayTotals.B;
    const deltaA = targetTotals.A - startA;
    const deltaB = targetTotals.B - startB;
    const started = performance.now();
    const duration = 420;

    let raf = 0;
    const tick = (ts: number) => {
      const progress = Math.min(1, (ts - started) / duration);
      setDisplayTotals({
        A: Math.round(startA + deltaA * progress),
        B: Math.round(startB + deltaB * progress)
      });
      if (progress < 1) raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [targetTotals.A, targetTotals.B]);

  const callTick = async () => {
    if (!battle || !['LOBBY', 'COUNTDOWN'].includes(String(battle.state))) return;
    setTickLoading(true);
    try {
      await authedFetch('/api/battles/tick', { method: 'POST', body: JSON.stringify({ battleId }) });
    } finally {
      setTickLoading(false);
    }
  };

  const callProgress = async () => {
    if (!battle || String(battle.state) !== 'RUNNING') return;
    setProgressLoading(true);
    try {
      await authedFetch('/api/battles/progress', { method: 'POST', body: JSON.stringify({ battleId }) });
    } finally {
      setProgressLoading(false);
    }
  };

  useEffect(() => {
    if (!battle) return;
    if (battle.state === 'LOBBY' || battle.state === 'COUNTDOWN') {
      void callTick();
      const interval = window.setInterval(() => void callTick(), 2000);
      return () => window.clearInterval(interval);
    }
  }, [battle?.id, battle?.state]);

  useEffect(() => {
    if (!battle || battle.state !== 'RUNNING') return;
    void callProgress();
    const interval = window.setInterval(() => void callProgress(), Math.max(2200, spinMs - 300));
    return () => window.clearInterval(interval);
  }, [battle?.id, battle?.state, spinMs]);

  useEffect(() => {
    if (!battle) return;

    if (skipRequested) {
      setActiveRoundIndex(roundCount - 1);
      setRevealedRounds(new Set(Array.from({ length: roundCount }).map((_, index) => index)));
      setUiPhase('UI_COMPLETE');
      setTrayOpen(true);
      runningPlaybackRef.current = false;
      return;
    }

    if (battle.state === 'LOBBY') {
      setUiPhase('UI_LOBBY');
      return;
    }

    if (battle.state === 'COUNTDOWN') {
      setUiPhase('UI_COUNTDOWN');
      return;
    }

    if (battle.state !== 'RUNNING' && battle.state !== 'COMPLETE') return;
    if (runningPlaybackRef.current) return;

    const queue = roundOrder.filter((index) => !onRoundDoneRef.current.has(index));
    if (!queue.length) {
      if ((battle.state === 'COMPLETE' || revealedRounds.size >= roundCount) && uiPhase !== 'UI_COMPLETE') {
        setUiPhase('UI_FINAL_REVEAL');
        const finalTimer = window.setTimeout(() => {
          setTrayOpen(true);
          setUiPhase('UI_COMPLETE');
        }, finalRevealMs);
        return () => window.clearTimeout(finalTimer);
      }
      return;
    }

    runningPlaybackRef.current = true;
    let cancelled = false;

    const runQueue = async () => {
      for (const roundIndex of queue) {
        if (cancelled || skipRequested) break;
        setActiveRoundIndex(roundIndex);
        setUiPhase('UI_ROUND_INTRO');
        await wait(introMs);

        if (cancelled || skipRequested) break;
        setUiPhase('UI_SPINNING');
        await wait(spinMs);

        if (cancelled || skipRequested) break;
        setUiPhase('UI_ROUND_REVEAL');
        setRevealedRounds((prev) => {
          const next = new Set(prev);
          next.add(roundIndex);
          return next;
        });
        onRoundDoneRef.current.add(roundIndex);
        await wait(revealMs + freezeAfterSpinMs);

        if (cancelled || skipRequested) break;
        setUiPhase('UI_INTERMISSION');
        await wait(intermissionMs);
      }

      runningPlaybackRef.current = false;

      if (!cancelled && !skipRequested && (battle.state === 'COMPLETE' || onRoundDoneRef.current.size >= roundCount)) {
        setUiPhase('UI_FINAL_REVEAL');
        await wait(finalRevealMs);
        if (!cancelled) {
          setTrayOpen(true);
          setUiPhase('UI_COMPLETE');
        }
      }
    };

    void runQueue();

    return () => {
      cancelled = true;
      runningPlaybackRef.current = false;
    };
  }, [battle, roundOrder, roundCount, revealedRounds.size, skipRequested, spinMs, uiPhase]);

  if (!battle) {
    return <div className="p-8 text-center text-gray-400">Battle not found.</div>;
  }

  const startedAtMs = tsToMs(battle?.startedAt);
  const countdownMs = Math.max(0, startedAtMs - now);
  const statusLabel =
    battle.state === 'COUNTDOWN'
      ? `Starting • ${(countdownMs / 1000).toFixed(1)}s`
      : battle.state === 'RUNNING'
        ? `Live • Round ${Math.max(1, activeRoundIndex + 1)}/${roundCount}`
        : battle.state === 'COMPLETE'
          ? 'Replay'
          : `Waiting • ${players.length}/${maxPlayers}`;

  const roundResult = roundsMap.get(Math.max(0, activeRoundIndex));
  const roundCards = players.map((player: any) => {
    const item = roundResult?.resultsByUid?.[player.uid];
    return {
      uid: player.uid,
      playerName: player.displayName,
      itemName: item?.itemName || 'Pending',
      value: Number(item?.value ?? 0),
      imageUrl: item?.imageUrl || ''
    };
  });

  const roundTeamTotals = roundCards.reduce(
    (acc, card) => {
      const player = players.find((p: any) => p.uid === card.uid);
      if (!player) return acc;
      if (player.team === 'B') acc.B += card.value;
      else acc.A += card.value;
      return acc;
    },
    { A: 0, B: 0 }
  );

  const roundWinnerTeam: 'A' | 'B' | 'TIE' =
    roundTeamTotals.A === roundTeamTotals.B ? 'TIE' : roundTeamTotals.A > roundTeamTotals.B ? 'A' : 'B';

  const finalWinnerTeam = String(battle?.winnerTeam || 'TIE');
  const myTeam = players.find((p: any) => p.uid === user.id)?.team === 'B' ? 'B' : 'A';
  const trayVariant = !isParticipant ? 'SPECTATE' : finalWinnerTeam === myTeam ? 'WIN' : 'LOSE';

  const myItems = rounds.flatMap((round) => {
    const item = round.resultsByUid?.[user.id];
    if (!item) return [];
    return [{ id: `${round.index}-${item.itemId || item.itemName}`, itemName: String(item.itemName), value: Number(item.value ?? 0), imageUrl: String(item.imageUrl || '') }];
  });

  const bestHit = [...myItems].sort((a, b) => b.value - a.value)[0] || null;

  const recreateBattle = () => {
    const caseIds = (Array.isArray(battle?.cases) ? battle.cases : []).map((entry: any) => entry?.caseId).filter(Boolean);
    if (!caseIds.length) return;
    createBattle(caseIds, Number(battle.maxPlayers ?? 2), { mode: battle.mode, format: battle.format });
  };

  const totalRange = Math.max(1, displayTotals.A + displayTotals.B);
  const aPercent = (displayTotals.A / totalRange) * 100;

  const teamColumn = (teamKey: 'A' | 'B') => {
    const isWinning = uiPhase !== 'UI_LOBBY' && uiPhase !== 'UI_COUNTDOWN' && finalWinnerTeam === teamKey;

    return (
      <div className={`rounded-xl border p-3 ${isWinning ? 'border-amber-400/40 shadow-[0_0_32px_rgba(251,191,36,0.18)]' : 'border-white/10 bg-[#11192a]'}`}>
        <div className="mb-2 flex items-center justify-between">
          <div className="text-xs font-bold uppercase tracking-wide text-gray-400">Team {teamKey}</div>
          <CoinAmount amount={toCoins(teamKey === 'A' ? displayTotals.A : displayTotals.B, PRICE_UNIT_MODE)} className="text-xs font-black text-emerald-300" iconClassName="h-3 w-3" />
        </div>

        <div className="space-y-2">
          {teams[teamKey].map((player: any, slotIndex) => {
            const roundItem = roundsMap.get(Math.max(0, activeRoundIndex))?.resultsByUid?.[player.uid];
            const winnerItem = normalizeItem(roundItem);
            const spinPhase: 'IDLE' | 'SPIN' | 'STOPPED' =
              player.isEmptySeat || !winnerItem ? 'IDLE' : uiPhase === 'UI_SPINNING' ? 'SPIN' : 'STOPPED';

            return (
              <div key={`${teamKey}-${player.uid}-${slotIndex}`} className="rounded-lg border border-white/10 bg-[#0f1726] p-2">
                <div className="mb-2 flex min-h-[32px] items-center gap-2">
                  {player.isEmptySeat ? (
                    <div className="h-7 w-7 rounded bg-[#1f2a3f]" />
                  ) : (
                    <img src={player.avatar || `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(player.uid)}`} alt={player.displayName} width={28} height={28} className="h-7 w-7 rounded border border-white/10 object-cover" />
                  )}
                  <div className="min-w-0 truncate text-xs font-semibold text-gray-100">{player.displayName}</div>
                  {!player.isEmptySeat && isWinning && <Crown className="h-3.5 w-3.5 text-amber-300" />}
                  <div className="ml-auto text-[10px] text-gray-400">{player.isEmptySeat ? 'Empty Seat' : `R${Math.max(1, activeRoundIndex + 1)}`}</div>
                </div>

                <DeterministicReel
                  spinKey={`${battleId}-${Math.max(0, activeRoundIndex)}-${player.uid}`}
                  winningItem={winnerItem}
                  fillerPool={fillerPool}
                  phase={spinPhase}
                  durationMs={spinMs}
                />
                <div className="mt-2 min-h-[48px] rounded border border-white/10 bg-[#0b1322] px-2 py-1.5">
                  {winnerItem && revealedRounds.has(Math.max(0, activeRoundIndex)) ? (
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <div className="min-w-0 truncate text-gray-200">{winnerItem.name}</div>
                      <div className="font-black text-emerald-300">{winnerItem.value.toLocaleString()}</div>
                    </div>
                  ) : (
                    <div className="text-[11px] text-gray-500">{player.isEmptySeat ? 'Awaiting player…' : 'Result after spin…'}</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="mx-auto max-w-6xl px-2 pb-28 sm:px-4">
      <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-[#101827] to-[#0c1320] p-3 sm:p-4">
        <div className="sticky top-14 z-40 mb-3 rounded-xl border border-white/10 bg-[#0b1220]/95 p-2 backdrop-blur sm:p-3">
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => setView({ type: 'BATTLES' })} className="rounded bg-[#162238] px-3 py-2 text-xs text-gray-200"><ChevronLeft className="mr-1 inline h-4 w-4" />Back</button>
            <h2 className="text-sm font-black text-white sm:text-base"><Swords className="mr-1 inline h-4 w-4 text-brand-purple" />Box Battle</h2>
            <span className="rounded border border-white/10 px-2 py-1 text-[11px] text-gray-300">{battle.mode || 'REGULAR'}</span>
            <span className="rounded border border-white/10 px-2 py-1 text-[11px] text-gray-300">{battle.format || '1V1'}</span>
            <span className="rounded border border-white/10 px-2 py-1 text-[11px] text-gray-300">{battle.winConditionLabel || (battle.mode === 'CRAZY' ? 'Lowest Total' : 'Highest Total')}</span>
            <CoinAmount amount={toCoins(Number(battle.entryCostCoins ?? 0), PRICE_UNIT_MODE)} className="ml-auto text-sm font-black text-emerald-300" iconClassName="h-3 w-3" />
            <span className={`rounded px-2 py-1 text-[11px] font-semibold ${battle.state === 'RUNNING' ? 'bg-rose-500/20 text-rose-300' : battle.state === 'COUNTDOWN' ? 'bg-amber-500/20 text-amber-300' : 'bg-sky-500/20 text-sky-300'}`}>{statusLabel}</span>
            <button onClick={() => setShowFairModal(true)} className="rounded border border-white/15 px-2 py-1 text-[11px] text-gray-200"><ShieldCheck className="mr-1 inline h-3 w-3" />Provably Fair</button>
            <button onClick={recreateBattle} className="rounded bg-brand-purple px-2 py-1 text-[11px] font-semibold text-white">Recreate</button>
            {(uiPhase === 'UI_ROUND_INTRO' || uiPhase === 'UI_SPINNING' || uiPhase === 'UI_ROUND_REVEAL' || uiPhase === 'UI_INTERMISSION') && (
              <button onClick={() => setSkipRequested(true)} className="rounded border border-white/20 px-2 py-1 text-[11px] text-gray-100"><SkipForward className="mr-1 inline h-3 w-3" />Skip</button>
            )}
          </div>
        </div>

        <div className="relative min-h-[640px]">
          <RoundRecapOverlay
            open={uiPhase === 'UI_ROUND_REVEAL' && !skipRequested}
            roundIndex={Math.max(0, activeRoundIndex)}
            winnerTeam={roundWinnerTeam}
            deltaValue={Math.max(roundTeamTotals.A, roundTeamTotals.B)}
            items={roundCards}
          />

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_180px_1fr]">
            {teamColumn('A')}

            <div className="order-first lg:order-none">
              <div className="rounded-xl border border-white/10 bg-[#111a2a] p-3 lg:sticky lg:top-[138px]">
                <div className="mb-2 text-center text-xs font-semibold uppercase tracking-wide text-gray-400">VS</div>
                <div className="mb-3 h-2 overflow-hidden rounded bg-[#1b2740]">
                  <div className="h-full bg-gradient-to-r from-brand-purple to-emerald-400 transition-all duration-300" style={{ width: `${aPercent}%` }} />
                </div>
                <div className="text-center text-[11px] text-gray-400">Round Timeline</div>
                <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5">
                  {Array.from({ length: roundCount }).map((_, idx) => {
                    const isDone = revealedRounds.has(idx);
                    const isCurrent = idx === activeRoundIndex;
                    return (
                      <button
                        key={`dot-${idx}`}
                        onClick={() => {
                          if (battle.state !== 'COMPLETE') return;
                          if (!revealedRounds.has(idx)) return;
                          setActiveRoundIndex(idx);
                        }}
                        className={`h-2.5 w-2.5 rounded-full ${isDone ? 'bg-brand-purple' : isCurrent ? 'animate-pulse bg-emerald-400' : 'bg-gray-600'} ${battle.state === 'COMPLETE' && isDone ? 'cursor-pointer' : 'cursor-default'}`}
                      />
                    );
                  })}
                </div>
              </div>
            </div>

            {teamColumn('B')}
          </div>
        </div>

        {(tickLoading || progressLoading) && (
          <div className="mt-3 flex items-center gap-1 text-xs text-gray-400">
            <Loader2 className="h-3 w-3 animate-spin" /> Syncing battle…
          </div>
        )}

        {!isParticipant && battle.state !== 'COMPLETE' && (
          <div className="mt-3">
            <button onClick={() => joinBattle(battleId)} className="rounded bg-emerald-600 px-3 py-2 text-xs font-semibold text-white">Join if slot opens</button>
          </div>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-white/10 bg-[#0a101b]/95 p-2 lg:hidden">
        <div className="mx-auto flex max-w-6xl items-center justify-between text-xs text-gray-300">
          <span>Team A: {toCoins(displayTotals.A, PRICE_UNIT_MODE).toLocaleString()}</span>
          <span>Team B: {toCoins(displayTotals.B, PRICE_UNIT_MODE).toLocaleString()}</span>
        </div>
      </div>

      {showFairModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-3" onClick={() => setShowFairModal(false)}>
          <div className="w-full max-w-sm rounded-xl border border-white/10 bg-[#111a2a] p-4" onClick={(event) => event.stopPropagation()}>
            <h3 className="text-lg font-bold text-white">Provably Fair</h3>
            <p className="mt-2 text-sm text-gray-300">Provably fair & verifiable.</p>
            <p className="text-sm text-gray-300">Every round can be validated against stored proof payloads.</p>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setShowFairModal(false)} className="rounded border border-white/15 px-3 py-2 text-sm text-gray-300">Close</button>
              <button
                onClick={() => {
                  setShowFairModal(false);
                  if (typeof window !== 'undefined') window.open(`/fairness/battles/${battleId}`, '_blank');
                }}
                className="rounded bg-brand-purple px-3 py-2 text-sm text-white"
              >
                Verify Battle <ExternalLink className="ml-1 inline h-3 w-3" />
              </button>
            </div>
          </div>
        </div>
      )}

      <BattleResultTray
        open={trayOpen}
        variant={trayVariant}
        totalValue={Number(battle?.totalsByUid?.[user.id] ?? 0)}
        bestHit={bestHit}
        items={isParticipant ? myItems : roundCards.map((entry) => ({ id: entry.uid, itemName: entry.itemName, value: entry.value, imageUrl: entry.imageUrl }))}
        isReplay={battle.state === 'COMPLETE'}
        onRecreate={recreateBattle}
        onClose={() => setTrayOpen(false)}
        onReplay={() => {
          setTrayOpen(false);
          setSkipRequested(false);
          setActiveRoundIndex(0);
        }}
      />
    </div>
  );
};
