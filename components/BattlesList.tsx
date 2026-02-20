import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Swords, X } from 'lucide-react';
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
    const seconds = Math.max(0, Math.ceil((Number(battle.startedAtMs ?? 0) - now) / 1000));
    return { label: `STARTING ${seconds}s`, classes: 'text-amber-300 border-amber-500/30 bg-amber-500/10' };
  }
  if (state === 'RUNNING') {
    return {
      label: `LIVE • ${Math.max(1, Number(battle.currentRound ?? 1))}/${Math.max(1, Number(battle.rounds ?? 1))}`,
      classes: 'text-rose-300 border-rose-500/30 bg-rose-500/10'
    };
  }
  if (state === 'COMPLETE') {
    return { label: 'REPLAY', classes: 'text-sky-300 border-sky-500/30 bg-sky-500/10' };
  }
  return { label: `WAITING • ${battle.playerCount}/${battle.maxPlayers}`, classes: 'text-gray-300 border-white/15 bg-[#121b2b]' };
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
  const inFlightRef = useRef<Record<string, boolean>>({});

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const battlesRef = query(collection(db, 'battles'), orderBy('createdAt', 'desc'), limit(10));
    return onSnapshot(battlesRef, (snapshot) => {
      const mapped = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        const players = Array.isArray(data.players) ? data.players : [];
        return {
          id: docSnap.id,
          state: String(data.state ?? 'LOBBY'),
          startedAtMs: data.startedAt?.toMillis ? data.startedAt.toMillis() : 0,
          maxPlayers: Number(data.maxPlayers ?? 2),
          playerCount: players.length,
          entryCostCoins: Number(data.entryCostCoins ?? 0),
          rounds: Number(data.roundCount ?? 1),
          currentRound: Number(data.currentRound ?? 1),
          mode: String(data.mode ?? 'REGULAR'),
          format: String(data.format ?? '1V1'),
          players
        };
      });
      setRows(mapped);
    });
  }, []);

  const battleBoxes = useMemo(() => boxes.filter((box) => !box.isUserCreated), [boxes]);
  const totalCost = useMemo(() => {
    const total = selectedBoxIds.reduce((sum, id) => sum + Number(boxes.find((box) => box.id === id)?.price ?? 0), 0);
    return toCoins(total, PRICE_UNIT_MODE);
  }, [boxes, selectedBoxIds]);

  const perform = async (battleId: string, action: 'tick' | 'progress') => {
    const key = `${action}:${battleId}`;
    if (inFlightRef.current[key]) return;
    inFlightRef.current[key] = true;
    try {
      await authedFetch(`/api/battles/${action}`, { method: 'POST', body: JSON.stringify({ battleId }) });
    } finally {
      inFlightRef.current[key] = false;
    }
  };

  useEffect(() => {
    const interval = window.setInterval(() => {
      rows.forEach((battle) => {
        const state = String(battle.state || '').toUpperCase();
        if (state === 'LOBBY' || state === 'COUNTDOWN') void perform(battle.id, 'tick');
        if (state === 'RUNNING') void perform(battle.id, 'progress');
      });
    }, 2400);
    return () => window.clearInterval(interval);
  }, [rows]);

  const onCreate = () => {
    if (!selectedBoxIds.length) return;
    createBattle(selectedBoxIds, format === '2V2' ? 4 : 2, { mode, format });
    playSound('click');
    setSelectedBoxIds([]);
    setShowCreateModal(false);
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
          const isParticipating = battle.players.some((player: any) => player.uid === user.id);

          return (
            <article key={battle.id} className="rounded-xl border border-white/10 bg-[#11192a] p-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className={`rounded border px-2 py-1 text-[11px] font-semibold ${status.classes}`}>{status.label}</span>
                    <span className="rounded border border-white/10 px-2 py-1 text-[11px] text-gray-300">{battle.mode}</span>
                    <span className="rounded border border-white/10 px-2 py-1 text-[11px] text-gray-300">{battle.format}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-gray-400">
                    <span>{battle.playerCount}/{battle.maxPlayers} players</span>
                    <span>{battle.rounds} rounds</span>
                    <CoinAmount amount={toCoins(battle.entryCostCoins, PRICE_UNIT_MODE)} className="font-bold text-emerald-300" iconClassName="h-3 w-3" />
                  </div>
                </div>

                <button
                  onClick={() => joinBattle(battle.id)}
                  disabled={!isParticipating && isFull}
                  className={`rounded-lg px-4 py-2 text-sm font-bold ${isFull && !isParticipating ? 'cursor-not-allowed bg-[#1c2638] text-gray-500' : 'bg-[#3d4a61] text-white hover:bg-[#4c5d78]'}`}
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
          <div className="relative z-10 flex max-h-[88vh] w-full max-w-2xl flex-col rounded-xl border border-white/10 bg-[#131c2c] p-4">
            <button onClick={() => setShowCreateModal(false)} className="absolute right-4 top-4 text-gray-500"><X className="h-5 w-5" /></button>
            <h3 className="mb-4 text-lg font-black text-white">Create Battle</h3>

            <div className="mb-4 grid grid-cols-2 gap-2">
              {(['REGULAR', 'CRAZY'] as const).map((value) => (
                <button key={value} onClick={() => setMode(value)} className={`rounded border py-2 text-sm ${mode === value ? 'border-brand-purple bg-brand-purple text-white' : 'border-white/10 text-gray-300'}`}>{value}</button>
              ))}
              {(['1V1', '2V2'] as const).map((value) => (
                <button key={value} onClick={() => setFormat(value)} className={`rounded border py-2 text-sm ${format === value ? 'border-brand-purple bg-brand-purple text-white' : 'border-white/10 text-gray-300'}`}>{value}</button>
              ))}
            </div>

            <div className="grid flex-1 grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-4">
              {battleBoxes.map((box) => (
                <button key={box.id} onClick={() => setSelectedBoxIds((prev) => [...prev, box.id])} className="rounded-lg border border-white/10 bg-[#0d1422] p-2 text-left">
                  <img src={box.image} alt={box.name} width={52} height={52} className="h-12 w-12 object-contain" />
                  <div className="truncate text-xs text-gray-200">{box.name}</div>
                </button>
              ))}
            </div>

            <div className="mt-4 flex items-center justify-between">
              <CoinAmount amount={totalCost} formatOptions={{ maximumFractionDigits: 0 }} className="text-lg font-black text-white" iconClassName="h-4 w-4" />
              <button onClick={onCreate} disabled={!selectedBoxIds.length} className="rounded bg-brand-purple px-4 py-2 text-sm font-bold text-white disabled:opacity-40">Create</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
