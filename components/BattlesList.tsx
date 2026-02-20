import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Plus, Swords, X } from 'lucide-react';
import { collection, limit, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '../firebase';
import { useGame } from '../context/GameContext';
import { useSound } from '../context/SoundContext';
import { CoinAmount } from './CoinAmount';
import { authedFetch } from '../utils/authedFetch';
import { PRICE_UNIT_MODE, toCoins } from '../utils/coins';

const formatStatus = (battle: any, now: number) => {
  const state = String(battle.state || '').toUpperCase();
  if (state === 'COUNTDOWN') {
    const secondsLeft = Math.max(0, Math.ceil((Number(battle.startedAtMs ?? 0) - now) / 1000));
    return { label: `STARTING ${secondsLeft}s`, tone: 'text-amber-300 border-amber-500/40 bg-amber-500/10' };
  }
  if (state === 'RUNNING') {
    return { label: `LIVE • ${Math.max(1, Number(battle.currentRound ?? 1))}/${Math.max(1, Number(battle.rounds ?? 1))}`, tone: 'text-rose-300 border-rose-500/40 bg-rose-500/10' };
  }
  if (state === 'COMPLETE') {
    return { label: 'REPLAY', tone: 'text-sky-300 border-sky-500/40 bg-sky-500/10' };
  }
  return { label: `WAITING • ${battle.playerCount}/${battle.maxPlayers}`, tone: 'text-gray-300 border-gray-600 bg-[#101726]' };
};

export const BattlesList: React.FC = () => {
  const { joinBattle, createBattle, boxes, user } = useGame();
  const { playSound } = useSound();
  const [rows, setRows] = useState<any[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedBoxIds, setSelectedBoxIds] = useState<string[]>([]);
  const [mode, setMode] = useState<'REGULAR' | 'CRAZY'>('REGULAR');
  const [format, setFormat] = useState<'1V1' | '2V2'>('1V1');
  const [now, setNow] = useState(Date.now());
  const busyRef = useRef<Record<string, boolean>>({});

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const battlesRef = query(collection(db, 'battles'), orderBy('createdAt', 'desc'), limit(10));
    return onSnapshot(battlesRef, (snapshot) => {
      const nextRows = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        const players = Array.isArray(data.players) ? data.players : [];
        return {
          id: docSnap.id,
          state: data.state,
          startedAtMs: data.startedAt?.toMillis ? data.startedAt.toMillis() : 0,
          maxPlayers: Number(data.maxPlayers ?? 2),
          playerCount: players.length,
          entryCostCoins: Number(data.entryCostCoins ?? 0),
          rounds: Number(data.roundCount ?? 1),
          currentRound: Number(data.currentRound ?? 1),
          mode: String(data.mode ?? 'REGULAR'),
          format: String(data.format ?? '1V1'),
          players: players,
          cases: Array.isArray(data.cases) ? data.cases : []
        };
      });
      setRows(nextRows);
    });
  }, []);

  const battleAvailableBoxes = useMemo(() => boxes.filter((box) => !box.isUserCreated), [boxes]);
  const totalCost = useMemo(() => {
    const cost = selectedBoxIds.reduce((sum, id) => sum + Number(boxes.find((b) => b.id === id)?.price || 0), 0);
    return toCoins(cost, PRICE_UNIT_MODE);
  }, [selectedBoxIds, boxes]);

  const performBattleCall = async (battleId: string, action: 'tick' | 'progress') => {
    const key = `${action}:${battleId}`;
    if (busyRef.current[key]) return;
    busyRef.current[key] = true;
    try { await authedFetch(`/api/battles/${action}`, { method: 'POST', body: JSON.stringify({ battleId }) }); } finally { busyRef.current[key] = false; }
  };

  useEffect(() => {
    const interval = window.setInterval(() => {
      rows.forEach((battle) => {
        const state = String(battle.state).toUpperCase();
        if (state === 'LOBBY' || state === 'COUNTDOWN') void performBattleCall(battle.id, 'tick');
        if (state === 'RUNNING') void performBattleCall(battle.id, 'progress');
      });
    }, 2400);
    return () => window.clearInterval(interval);
  }, [rows]);

  const handleCreate = () => {
    if (!selectedBoxIds.length) return;
    createBattle(selectedBoxIds, format === '2V2' ? 4 : 2, { mode, format });
    setShowCreateModal(false);
    setSelectedBoxIds([]);
    playSound('click');
  };

  return (
    <section className="mx-auto w-full max-w-6xl px-2 pb-8 sm:px-4">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-black text-white"><Swords className="mr-2 inline h-5 w-5 text-brand-purple" />Battles</h2>
        <button onClick={() => setShowCreateModal(true)} className="rounded-lg bg-brand-purple px-3 py-2 text-sm font-bold text-white"><Plus className="mr-1 inline h-4 w-4" />Create</button>
      </div>

      <div className="space-y-2">
        {rows.map((battle) => {
          const status = formatStatus(battle, now);
          const isFull = battle.playerCount >= battle.maxPlayers;
          const isParticipating = battle.players.some((p: any) => p.uid === user.id);
          return (
            <article key={battle.id} className="rounded-xl border border-gray-800 bg-[#101726] p-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className={`rounded border px-2 py-1 text-[11px] font-semibold ${status.tone}`}>{status.label}</span>
                    <span className="rounded border border-gray-700 px-2 py-1 text-[11px] text-gray-300">{battle.mode}</span>
                    <span className="rounded border border-gray-700 px-2 py-1 text-[11px] text-gray-300">{battle.format}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-gray-400">
                    <span>{battle.playerCount}/{battle.maxPlayers} players</span>
                    <span>{battle.rounds} rounds</span>
                    <CoinAmount amount={toCoins(battle.entryCostCoins, PRICE_UNIT_MODE)} className="font-bold text-emerald-300" iconClassName="w-3 h-3" />
                  </div>
                </div>
                <button
                  onClick={() => joinBattle(battle.id)}
                  disabled={!isParticipating && isFull}
                  className={`rounded-lg px-4 py-2 text-sm font-bold ${isFull && !isParticipating ? 'cursor-not-allowed bg-[#1b2436] text-gray-500' : 'bg-[#3d4a61] text-white hover:bg-[#4c5d78]'}`}
                >
                  {battle.state === 'COMPLETE' ? 'View Replay' : isParticipating ? 'Spectate' : isFull ? 'Full' : 'Join'}
                </button>
              </div>
            </article>
          );
        })}
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-3">
          <div className="absolute inset-0 bg-black/80" onClick={() => setShowCreateModal(false)} />
          <div className="relative z-10 flex max-h-[88vh] w-full max-w-2xl flex-col rounded-xl border border-gray-700 bg-[#131720] p-4">
            <button onClick={() => setShowCreateModal(false)} className="absolute right-4 top-4 text-gray-500"><X className="h-5 w-5" /></button>
            <h3 className="mb-4 text-lg font-black text-white">Create Battle</h3>
            <div className="mb-4 grid grid-cols-2 gap-2">
              {(['REGULAR', 'CRAZY'] as const).map((v) => <button key={v} onClick={() => setMode(v)} className={`rounded border py-2 text-sm ${mode === v ? 'border-brand-purple bg-brand-purple text-white' : 'border-gray-700 text-gray-300'}`}>{v}</button>)}
              {(['1V1', '2V2'] as const).map((v) => <button key={v} onClick={() => setFormat(v)} className={`rounded border py-2 text-sm ${format === v ? 'border-brand-purple bg-brand-purple text-white' : 'border-gray-700 text-gray-300'}`}>{v}</button>)}
            </div>
            <div className="grid flex-1 grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-4">
              {battleAvailableBoxes.map((box) => (
                <button key={box.id} onClick={() => setSelectedBoxIds((prev) => [...prev, box.id])} className="rounded-lg border border-gray-700 bg-[#0b0f18] p-2 text-left">
                  <img src={box.image} width={52} height={52} className="h-12 w-12 object-contain" />
                  <div className="truncate text-xs text-gray-200">{box.name}</div>
                </button>
              ))}
            </div>
            <div className="mt-4 flex items-center justify-between">
              <CoinAmount amount={totalCost} formatOptions={{ maximumFractionDigits: 0 }} className="text-lg font-black text-white" iconClassName="h-4 w-4" />
              <button onClick={handleCreate} disabled={!selectedBoxIds.length} className="rounded bg-brand-purple px-4 py-2 text-sm font-bold text-white disabled:opacity-40">Create</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
