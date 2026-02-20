import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, Crown, ExternalLink, Loader2, ShieldCheck, SkipForward, Swords } from 'lucide-react';
import { collection, doc, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '../firebase';
import { useGame } from '../context/GameContext';
import { CoinAmount } from './CoinAmount';
import { PRICE_UNIT_MODE, toCoins } from '../utils/coins';
import { authedFetch } from '../utils/authedFetch';
import { DeterministicReel, ReelItem } from './battles/DeterministicReel';
import { RoundRecapOverlay } from './battles/RoundRecapOverlay';
import { BattleResultTray } from './battles/BattleResultTray';

type UIPhase = 'LOBBY_VIEW' | 'COUNTDOWN_VIEW' | 'ROUND_INTRO' | 'SPINNING' | 'ROUND_REVEAL' | 'INTERMISSION' | 'FINAL_REVEAL' | 'COMPLETE_VIEW';

interface BattleArenaProps { battleId: string; }
interface RoundDoc { index: number; resultsByUid: Record<string, any>; }

const tsToMs = (value: any) => (value?.toMillis ? value.toMillis() : Number(value ?? 0));

export const BattleArena: React.FC<BattleArenaProps> = ({ battleId }) => {
  const { setView, user, joinBattle, createBattle, items } = useGame();
  const [battle, setBattle] = useState<any>(null);
  const [rounds, setRounds] = useState<RoundDoc[]>([]);
  const [now, setNow] = useState(Date.now());
  const [showPfModal, setShowPfModal] = useState(false);
  const [uiPhase, setUiPhase] = useState<UIPhase>('LOBBY_VIEW');
  const [playheadRound, setPlayheadRound] = useState(-1);
  const [skipPlayback, setSkipPlayback] = useState(false);
  const [showRecap, setShowRecap] = useState(false);
  const [showResultTray, setShowResultTray] = useState(false);
  const [tickLoading, setTickLoading] = useState(false);
  const [progressLoading, setProgressLoading] = useState(false);
  const playbackKeyRef = useRef('');

  useEffect(() => {
    const battleRef = doc(db, 'battles', battleId);
    const unsubBattle = onSnapshot(battleRef, (snap) => setBattle(snap.exists() ? { id: snap.id, ...snap.data() } : null));
    const roundsRef = query(collection(db, 'battles', battleId, 'rounds'), orderBy('index', 'asc'));
    const unsubRounds = onSnapshot(roundsRef, (snapshot) => {
      const parsed = snapshot.docs.map((d) => ({ index: Number(d.data().index ?? 0), ...(d.data() as any) })).sort((a, b) => a.index - b.index);
      setRounds(parsed);
    });
    return () => { unsubBattle(); unsubRounds(); };
  }, [battleId]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 400);
    return () => window.clearInterval(timer);
  }, []);

  const players = Array.isArray(battle?.players) ? battle.players : [];
  const roundCount = Math.max(1, Number(battle?.roundCount ?? 1));
  const roundDurationMs = Math.max(1800, Number(battle?.roundDurationMs ?? 3400));
  const teams = useMemo(() => ({ A: players.filter((p: any) => p.team !== 'B'), B: players.filter((p: any) => p.team === 'B') }), [players]);
  const startedAtMs = tsToMs(battle?.startedAt);
  const countdownMs = Math.max(0, startedAtMs - now);
  const isReplay = battle?.state === 'COMPLETE';
  const isParticipant = players.some((p: any) => p.uid === user.id);

  const normalizeItem = (it: any): ReelItem | null => {
    const itemName = it?.itemName || it?.name;
    if (!itemName) return null;
    return { itemId: it?.itemId || it?.id, itemName: String(itemName), value: Number(it?.value ?? it?.price ?? 0), rarity: it?.rarity, imageUrl: it?.imageUrl || it?.image };
  };

  const fillerPool = useMemo(() => {
    const source = [
      ...(Array.isArray(battle?.cases) ? battle.cases.flatMap((c: any) => (Array.isArray(c?.items) ? c.items : [])) : []),
      ...(Array.isArray(items) ? items.slice(0, 40) : []),
      ...rounds.flatMap((r) => Object.values(r.resultsByUid ?? {}))
    ];
    const dedupe = new Map<string, ReelItem>();
    source.map(normalizeItem).filter(Boolean).forEach((it) => {
      const key = `${(it as ReelItem).itemId ?? (it as ReelItem).itemName}`.toLowerCase();
      if (!dedupe.has(key)) dedupe.set(key, it as ReelItem);
    });
    return Array.from(dedupe.values());
  }, [battle?.cases, items, rounds]);

  useEffect(() => {
    setPlayheadRound(-1);
    setShowResultTray(false);
    setUiPhase(battle?.state === 'COUNTDOWN' ? 'COUNTDOWN_VIEW' : 'LOBBY_VIEW');
  }, [battleId, battle?.state]);

  useEffect(() => {
    if (!battle) return;
    if (skipPlayback) {
      setPlayheadRound(roundCount - 1);
      setUiPhase('COMPLETE_VIEW');
      setShowRecap(false);
      setTimeout(() => setShowResultTray(true), 200);
      return;
    }
    if (battle.state !== 'RUNNING' && battle.state !== 'COMPLETE') return;
    const available = rounds.length;
    if (!available) return;

    const playKey = `${battle.id}:${available}:${roundDurationMs}`;
    if (playKey === playbackKeyRef.current && playheadRound >= available - 1) return;
    playbackKeyRef.current = playKey;

    let cancelled = false;
    const run = async () => {
      for (let i = 0; i < available; i += 1) {
        if (cancelled) return;
        setPlayheadRound(i);
        setUiPhase('ROUND_INTRO');
        await new Promise((r) => setTimeout(r, 600));
        if (cancelled) return;
        setUiPhase('SPINNING');
        await new Promise((r) => setTimeout(r, roundDurationMs));
        if (cancelled) return;
        setUiPhase('ROUND_REVEAL');
        setShowRecap(true);
        await new Promise((r) => setTimeout(r, 900));
        setShowRecap(false);
        if (i < available - 1) {
          setUiPhase('INTERMISSION');
          await new Promise((r) => setTimeout(r, 450));
        }
      }
      setUiPhase('FINAL_REVEAL');
      setTimeout(() => setShowResultTray(true), 1200);
    };

    void run();
    return () => { cancelled = true; };
  }, [battle, rounds.length, roundDurationMs, skipPlayback, roundCount, playheadRound]);

  const callTick = async () => {
    if (!battle || !['LOBBY', 'COUNTDOWN'].includes(String(battle.state))) return;
    setTickLoading(true);
    try { await authedFetch('/api/battles/tick', { method: 'POST', body: JSON.stringify({ battleId }) }); } finally { setTickLoading(false); }
  };
  const callProgress = async () => {
    if (!battle || String(battle.state) !== 'RUNNING') return;
    setProgressLoading(true);
    try { await authedFetch('/api/battles/progress', { method: 'POST', body: JSON.stringify({ battleId }) }); } finally { setProgressLoading(false); }
  };

  useEffect(() => {
    if (!battle) return;
    if (battle.state === 'LOBBY' || battle.state === 'COUNTDOWN') {
      void callTick();
      const t = window.setInterval(() => void callTick(), 2000);
      return () => window.clearInterval(t);
    }
  }, [battle?.id, battle?.state]);

  useEffect(() => {
    if (!battle || battle.state !== 'RUNNING') return;
    void callProgress();
    const t = window.setInterval(() => void callProgress(), 2200);
    return () => window.clearInterval(t);
  }, [battle?.id, battle?.state, roundDurationMs]);

  if (!battle) return <div className="p-8 text-center text-gray-400">Battle not found.</div>;

  const status = battle.state === 'COUNTDOWN' ? `Starting ${Math.ceil(countdownMs / 1000)}s` : battle.state === 'RUNNING' ? `Live • ${Math.max(1, playheadRound + 1)}/${roundCount}` : 'Replay';
  const currentRound = rounds[Math.max(0, playheadRound)];
  const roundItems = players.map((p: any) => {
    const result = currentRound?.resultsByUid?.[p.uid];
    return { uid: p.uid, playerName: p.displayName, itemName: result?.itemName || 'Pending', value: Number(result?.value ?? 0), imageUrl: result?.imageUrl };
  });
  const aRoundTotal = roundItems.filter((r) => teams.A.some((p: any) => p.uid === r.uid)).reduce((sum, r) => sum + r.value, 0);
  const bRoundTotal = roundItems.filter((r) => teams.B.some((p: any) => p.uid === r.uid)).reduce((sum, r) => sum + r.value, 0);
  const roundWinner: 'A' | 'B' | 'TIE' = aRoundTotal === bRoundTotal ? 'TIE' : aRoundTotal > bRoundTotal ? 'A' : 'B';

  const recreateBattle = () => {
    const caseIds = (Array.isArray(battle?.cases) ? battle.cases : []).map((c: any) => c?.caseId).filter(Boolean);
    if (caseIds.length) createBattle(caseIds, Number(battle.maxPlayers ?? 2), { mode: battle.mode, format: battle.format });
  };

  const myTeam = players.find((p: any) => p.uid === user.id)?.team === 'B' ? 'B' : 'A';
  const trayVariant = !isParticipant ? 'SPECTATE' : battle.winnerTeam === myTeam ? 'WIN' : 'LOSE';
  const myItems = rounds.flatMap((r) => {
    const result = r.resultsByUid?.[user.id];
    return result ? [{ id: `${r.index}-${result.itemName}`, itemName: result.itemName, value: Number(result.value ?? 0), imageUrl: result.imageUrl }] : [];
  });
  const bestHit = myItems.sort((a, b) => b.value - a.value)[0] || null;

  return (
    <div className="mx-auto max-w-7xl px-2 pb-28 sm:px-4">
      <RoundRecapOverlay visible={showRecap} roundNumber={Math.max(1, playheadRound + 1)} winningTeam={roundWinner} deltaCoins={Math.max(aRoundTotal, bRoundTotal)} items={roundItems} />

      <section className="sticky top-14 z-40 mb-3 rounded-xl border border-gray-800 bg-[#0d1320]/95 p-2 backdrop-blur sm:p-3">
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => setView({ type: 'BATTLES' })} className="rounded bg-[#161d2c] px-3 py-2 text-xs text-gray-200"><ChevronLeft className="mr-1 inline h-4 w-4" />Back</button>
          <h2 className="text-sm font-black text-white sm:text-base"><Swords className="mr-1 inline h-4 w-4 text-brand-purple" />Box Battle</h2>
          <span className="rounded border border-gray-700 px-2 py-1 text-[11px] text-gray-300">{battle.mode}</span>
          <span className="rounded border border-gray-700 px-2 py-1 text-[11px] text-gray-300">{battle.format}</span>
          <span className="rounded border border-gray-700 px-2 py-1 text-[11px] text-gray-300">{battle.winConditionLabel || 'Highest'}</span>
          <CoinAmount amount={toCoins(Number(battle.entryCostCoins ?? 0), PRICE_UNIT_MODE)} className="ml-auto text-sm font-black text-emerald-300" iconClassName="h-3 w-3" />
          <span className={`rounded px-2 py-1 text-[11px] font-semibold ${battle.state === 'RUNNING' ? 'bg-rose-500/20 text-rose-300' : 'bg-blue-500/20 text-blue-200'}`}>{status}</span>
          <button onClick={() => setShowPfModal(true)} className="rounded border border-gray-700 px-2 py-1 text-[11px] text-gray-200"><ShieldCheck className="mr-1 inline h-3 w-3" />Provably Fair</button>
          <button onClick={recreateBattle} className="rounded bg-brand-purple px-2 py-1 text-[11px] font-semibold text-white">Recreate</button>
          {uiPhase !== 'COMPLETE_VIEW' && <button onClick={() => setSkipPlayback(true)} className="rounded border border-gray-600 px-2 py-1 text-[11px] text-gray-200"><SkipForward className="mr-1 inline h-3 w-3" />Skip</button>}
        </div>
      </section>

      <section className="rounded-2xl border border-gray-800 bg-[#0b111d] p-3 sm:p-4">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_auto_1fr]">
          {(['A', 'B'] as const).map((teamKey) => {
            const isWinningTeam = battle.state === 'COMPLETE' && battle.winnerTeam === teamKey;
            return (
              <div key={teamKey} className={`rounded-xl border p-2 sm:p-3 ${isWinningTeam ? 'border-amber-400/60 shadow-[0_0_30px_rgba(250,204,21,0.2)]' : 'border-gray-700 bg-[#101827]'}`}>
                <div className="mb-2 text-xs uppercase text-gray-400">Team {teamKey}</div>
                <div className="space-y-2">
                  {teams[teamKey].map((player: any) => {
                    const result = rounds[Math.max(0, playheadRound)]?.resultsByUid?.[player.uid];
                    const lanePhase: 'IDLE' | 'SPIN' | 'STOPPED' = !result ? 'IDLE' : uiPhase === 'SPINNING' ? 'SPIN' : 'STOPPED';
                    const total = Number(battle?.totalsByUid?.[player.uid] ?? 0);
                    return (
                      <div key={player.uid} className="rounded-lg border border-gray-700 bg-[#0d1320] p-2">
                        <div className="mb-2 flex items-center gap-2">
                          <img src={player.avatar || `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(player.uid)}`} width={28} height={28} className="h-7 w-7 rounded border border-gray-700" />
                          <div className="truncate text-xs font-semibold text-white">{player.displayName}</div>
                          {isWinningTeam && <Crown className="h-3.5 w-3.5 text-amber-300" />}
                          <CoinAmount amount={toCoins(total, PRICE_UNIT_MODE)} className="ml-auto text-xs font-bold text-emerald-300" iconClassName="h-3 w-3" />
                        </div>
                        <DeterministicReel
                          winningItem={normalizeItem(result)}
                          fillerPool={fillerPool}
                          spinKey={`${battleId}-${playheadRound}-${player.uid}`}
                          phase={lanePhase}
                          durationMs={roundDurationMs}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          <div className="order-first flex items-center justify-center lg:order-none lg:flex-col">
            <div className="mb-2 hidden text-xs text-gray-500 lg:block">Rounds</div>
            <div className="flex gap-1.5">
              {Array.from({ length: roundCount }).map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => isReplay && idx <= playheadRound && setPlayheadRound(idx)}
                  className={`h-2.5 w-2.5 rounded-full ${idx < playheadRound ? 'bg-brand-purple' : idx === playheadRound ? 'animate-pulse bg-emerald-400' : 'bg-gray-600'} ${isReplay && idx <= playheadRound ? 'cursor-pointer' : 'cursor-default'}`}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-gray-800 bg-[#0a0f18]/95 p-2 lg:hidden">
        <div className="mx-auto flex max-w-7xl items-center justify-between text-xs text-gray-300">
          <span>Team A: {toCoins(Number(battle?.teamTotals?.A ?? 0), PRICE_UNIT_MODE).toLocaleString()}</span>
          <span>Team B: {toCoins(Number(battle?.teamTotals?.B ?? 0), PRICE_UNIT_MODE).toLocaleString()}</span>
        </div>
      </div>

      {(tickLoading || progressLoading) && <div className="mt-3 flex items-center gap-1 text-xs text-gray-400"><Loader2 className="h-3 w-3 animate-spin" />Syncing battle…</div>}
      {!isParticipant && battle.state !== 'COMPLETE' && <button onClick={() => joinBattle(battleId)} className="mt-3 rounded bg-emerald-600 px-3 py-2 text-xs font-semibold text-white">Join if slot opens</button>}

      {showPfModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-3" onClick={() => setShowPfModal(false)}>
          <div className="w-full max-w-sm rounded-xl border border-gray-700 bg-[#111827] p-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-white">Provably Fair</h3>
            <p className="mt-2 text-sm text-gray-300">Provably fair & verifiable.</p>
            <p className="text-sm text-gray-300">Every round has stored proof payloads you can audit.</p>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setShowPfModal(false)} className="rounded border border-gray-700 px-3 py-2 text-sm text-gray-300">Close</button>
              <button onClick={() => { setShowPfModal(false); if (typeof window !== 'undefined') window.open(`/fairness/battles/${battleId}`, '_blank'); }} className="rounded bg-brand-purple px-3 py-2 text-sm text-white">Verify Battle <ExternalLink className="ml-1 inline h-3 w-3" /></button>
            </div>
          </div>
        </div>
      )}

      <BattleResultTray
        open={showResultTray}
        variant={trayVariant}
        totalCoins={Number(battle?.totalsByUid?.[user.id] ?? 0)}
        bestHit={bestHit}
        recapItems={isParticipant ? myItems : roundItems.map((r) => ({ id: r.uid, itemName: r.itemName, value: r.value, imageUrl: r.imageUrl }))}
        onRecreate={recreateBattle}
        onReplay={() => setSkipPlayback(false)}
        onClose={() => setShowResultTray(false)}
        isReplay={isReplay}
      />
    </div>
  );
};
