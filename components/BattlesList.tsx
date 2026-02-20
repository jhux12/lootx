import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Clock3, Loader2, Plus, Swords, X } from 'lucide-react';
import { useGame } from '../context/GameContext';
import { collection, limit, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '../firebase';
import { useSound } from '../context/SoundContext';
import { CoinAmount } from './CoinAmount';
import { authedFetch } from '../utils/authedFetch';
import { PRICE_UNIT_MODE, toCoins } from '../utils/coins';

const formatStatus = (battle: any, now: number) => {
  const state = String(battle.state || '').toUpperCase();
  const playerCount = Number(battle.playerCount ?? battle.players?.length ?? 0);
  const maxPlayers = Number(battle.maxPlayers ?? 2);

  if (state === 'COUNTDOWN') {
    const startedAtMs = Number(battle.startedAtMs ?? 0);
    const secondsLeft = Math.max(0, Math.ceil((startedAtMs - now) / 1000));
    return { label: `Starting • ${secondsLeft}s`, intent: 'starting' as const };
  }
  if (state === 'RUNNING' || state === 'FINISHING') {
    return { label: `Live • Round ${Math.max(1, Number(battle.currentRound ?? 1))}/${Math.max(1, Number(battle.rounds ?? 1))}`, intent: 'live' as const };
  }
  if (state === 'COMPLETE') {
    return { label: 'Ended', intent: 'ended' as const };
  }
  return { label: `Waiting • ${playerCount}/${maxPlayers}`, intent: 'waiting' as const };
};

export const BattlesList: React.FC = () => {
  const { joinBattle, createBattle, user, boxes } = useGame();
  const { playSound } = useSound();
  const [battleRows, setBattleRows] = useState<any[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedBoxIds, setSelectedBoxIds] = useState<string[]>([]);
  const [playerCount, setPlayerCount] = useState(2);
  const [mode, setMode] = useState<'REGULAR' | 'CRAZY'>('REGULAR');
  const [format, setFormat] = useState<'1V1' | '2V2'>('1V1');
  const [now, setNow] = useState(Date.now());
  const [tickBusy, setTickBusy] = useState<Record<string, boolean>>({});
  const inFlightRef = useRef<Record<string, boolean>>({});

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const battlesRef = query(collection(db, 'battles'), orderBy('createdAt', 'desc'), limit(10));
    const unsubscribe = onSnapshot(battlesRef, (snapshot) => {
      const next = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        const players = Array.isArray(data.players) ? data.players : [];

        return {
          id: docSnap.id,
          state: String(data.state ?? 'LOBBY'),
          startedAtMs: data.startedAt?.toMillis ? data.startedAt.toMillis() : 0,
          maxPlayers: Number(data.maxPlayers ?? 2),
          playerCount: players.length,
          entryCostCoins: Number(data.entryCostCoins ?? 0),
          rounds: Number(data.roundCount ?? 0),
          currentRound: Number(data.currentRound ?? 0),
          players: players.map((player: any) => ({
            id: player.uid,
            avatar: player.avatar || `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(player.uid || 'player')}`
          })),
          cases: Array.isArray(data.cases)
            ? data.cases.map((entry: any) => {
                const box = boxes.find((candidate) => candidate.id === entry.caseId);
                return box || { id: entry.caseId, name: entry.caseId, image: '' };
              })
            : []
        };
      });
      setBattleRows(next);
    });

    return () => unsubscribe();
  }, [boxes]);

  const battleAvailableBoxes = useMemo(() => boxes.filter((box) => !box.isUserCreated), [boxes]);
  const recentBattles = battleRows.slice(0, 10);

  const tickBattle = async (battleId: string) => {
    if (inFlightRef.current[battleId]) return;
    inFlightRef.current[battleId] = true;
    setTickBusy((prev) => ({ ...prev, [battleId]: true }));
    try {
      await authedFetch('/api/battles/tick', { method: 'POST', body: JSON.stringify({ battleId }) });
    } catch {
      // ignore tick failures client-side
    } finally {
      inFlightRef.current[battleId] = false;
      setTickBusy((prev) => ({ ...prev, [battleId]: false }));
    }
  };

  useEffect(() => {
    const tickable = recentBattles.filter((battle: any) => {
      const state = String((battle as any).state || '').toUpperCase();
      return (state === 'LOBBY' || state === 'COUNTDOWN') && Number(battle.playerCount ?? 0) < Number(battle.maxPlayers ?? 2);
    });

    tickable.forEach((battle) => void tickBattle(battle.id));
    const interval = window.setInterval(() => {
      tickable.forEach((battle) => void tickBattle(battle.id));
    }, 2500);
    return () => window.clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recentBattles.map((battle) => `${battle.id}:${battle.playerCount}:${(battle as any).state}`).join('|')]);

  const handleCreateConfirm = () => {
    if (selectedBoxIds.length === 0) return;
    createBattle(selectedBoxIds, playerCount, { mode, format });
    setShowCreateModal(false);
    setSelectedBoxIds([]);
  };

  const totalCost = selectedBoxIds.reduce((sum, id) => {
    const box = boxes.find((item) => item.id === id);
    return sum + (box ? toCoins(box.price, PRICE_UNIT_MODE) : 0);
  }, 0);

  return (
    <section className="mt-6 mb-20 px-2 sm:px-4 md:px-0">
      <div className="relative overflow-hidden rounded-2xl border border-gray-800 bg-[#0f131b] p-4 sm:p-6 mb-5">
        <Swords className="absolute -right-10 -top-14 w-52 h-52 sm:w-72 sm:h-72 text-brand-purple/25 rotate-[35deg] pointer-events-none" />
        <div className="relative z-10 max-w-xl">
          <p className="text-xs uppercase tracking-[0.2em] text-gray-400">Cravin Arena</p>
          <h2 className="text-3xl sm:text-4xl font-black text-white mt-1">Arena</h2>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
            <button
              onClick={() => {
                playSound('click');
                setShowCreateModal(true);
              }}
              className="text-brand-purple hover:text-white underline underline-offset-4"
            >
              Create Battle
            </button>
            <span className="text-gray-500">•</span>
            <span className="text-gray-400">Sort: newest</span>
          </div>
        </div>
      </div>

      <div className="flex justify-end mb-3">
        <button
          onClick={() => {
            playSound('click');
            setShowCreateModal(true);
          }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-purple text-white text-sm font-semibold hover:opacity-90"
        >
          <Plus className="w-4 h-4" /> Create
        </button>
      </div>

      <div className="space-y-3">
        {recentBattles.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-700 bg-[#0f131b] p-6 text-center text-gray-400">
            No active battles. Create one to get started.
          </div>
        ) : (
          recentBattles.map((battle) => {
            const status = formatStatus(battle, now);
            const rowTicking = !!tickBusy[battle.id];
            const isParticipating = battle.players.some((player: any) => player.id === user.id);
            const isFull = battle.playerCount >= battle.maxPlayers;
            const waiting = status.intent === 'waiting' || status.intent === 'starting';

            return (
              <article key={battle.id} className="rounded-xl border border-gray-800 bg-[#131720] p-3 sm:p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                  <div className="min-w-0 lg:w-56">
                    <div className="text-[11px] uppercase tracking-wide text-gray-500">Battle #{battle.id.slice(0, 6)}</div>
                    <div className={`mt-1 inline-flex text-xs px-2 py-1 rounded-full border ${status.intent === 'live' ? 'border-green-500/40 text-green-300 bg-green-500/10' : status.intent === 'ended' ? 'border-gray-600 text-gray-400 bg-gray-500/10' : 'border-brand-purple/40 text-brand-purple bg-brand-purple/10'}`}>
                      {status.label}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 items-center">
                    {battle.cases.map((box: any, index: number) => (
                      <div key={`${battle.id}-${box.id}-${index}`} className="w-9 h-9 rounded border border-gray-700 bg-[#0b0e14] p-1">
                        <img src={box.image} alt={box.name} className="w-full h-full object-contain" />
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center gap-2">
                    {Array.from({ length: battle.maxPlayers }).map((_, index) => {
                      const player = battle.players[index];
                      return (
                        <div key={`${battle.id}-slot-${index}`} className="w-8 h-8 rounded-md bg-[#0b0e14] border border-gray-700 flex items-center justify-center overflow-hidden">
                          {player ? <img src={player.avatar} alt="Player avatar" className="w-full h-full" /> : <div className="w-2 h-2 rounded-full bg-gray-700" />}
                        </div>
                      );
                    })}
                  </div>

                  <div className="lg:ml-auto flex items-center justify-between lg:justify-end gap-4 w-full lg:w-auto">
                    {waiting && (
                      <div className="flex items-center gap-1 text-xs text-gray-400">
                        {rowTicking ? <Loader2 className="w-3 h-3 animate-spin" /> : <Clock3 className="w-3 h-3" />}
                        <span>{rowTicking ? 'Checking seats…' : 'Waiting for players…'}</span>
                      </div>
                    )}
                    <div className="text-right">
                      <CoinAmount amount={Number(battle.entryCostCoins ?? 0)} formatOptions={{ maximumFractionDigits: 0 }} className="text-green-400 font-bold justify-end" iconClassName="w-3.5 h-3.5" />
                      <div className="text-[10px] uppercase text-gray-500">Entry</div>
                    </div>
                    <button
                      onClick={() => {
                        playSound('click');
                        joinBattle(battle.id);
                      }}
                      disabled={!isParticipating && isFull}
                      className={`px-4 py-2 text-sm font-bold rounded-lg transition-colors ${isParticipating ? 'bg-gray-700 hover:bg-gray-600 text-white' : isFull ? 'bg-gray-800 text-gray-500 cursor-not-allowed' : 'bg-brand-purple hover:opacity-90 text-white'}`}
                    >
                      {isParticipating ? 'Spectate' : isFull ? 'Full' : 'Join'}
                    </button>
                  </div>
                </div>
              </article>
            );
          })
        )}
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowCreateModal(false)} />
          <div className="relative w-full max-w-2xl bg-[#131720] border border-gray-700 rounded-xl shadow-2xl p-4 sm:p-6 flex flex-col max-h-[90vh]">
            <button onClick={() => setShowCreateModal(false)} className="absolute top-4 right-4 text-gray-500 hover:text-white">
              <X className="w-5 h-5" />
            </button>

            <h2 className="text-xl font-bold text-white mb-6">Create Battle</h2>
            <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar">
              <div className="mb-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Mode</label>
                  <div className="grid grid-cols-2 gap-2">
                    {(['REGULAR', 'CRAZY'] as const).map((value) => (
                      <button key={value} onClick={() => setMode(value)} className={`py-3 rounded-lg border font-bold transition-all text-sm ${mode === value ? 'bg-brand-purple border-brand-purple text-white' : 'bg-[#0b0e14] border-gray-800 text-gray-400 hover:border-gray-600'}`}>
                        {value === 'REGULAR' ? 'Regular' : 'Crazy'}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Format</label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: '1V1', value: '1V1', players: 2 },
                      { label: '2V2', value: '2V2', players: 4 }
                    ].map((option) => (
                      <button key={option.value} onClick={() => { setFormat(option.value as '1V1' | '2V2'); setPlayerCount(option.players); }} className={`py-3 rounded-lg border font-bold transition-all text-sm ${format === option.value ? 'bg-brand-purple border-brand-purple text-white' : 'bg-[#0b0e14] border-gray-800 text-gray-400 hover:border-gray-600'}`}>
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Battle Case Sequence</label>
              <div className="min-h-[90px] bg-[#0b0e14] border border-gray-800 rounded-xl p-2 flex gap-2 overflow-x-auto items-center mb-6">
                {selectedBoxIds.length === 0 ? (
                  <div className="w-full text-center text-gray-600 text-sm">Select cases below to add them to the battle</div>
                ) : (
                  selectedBoxIds.map((id, idx) => {
                    const box = boxes.find((item) => item.id === id);
                    if (!box) return null;
                    return (
                      <button key={`${id}-${idx}`} onClick={() => setSelectedBoxIds((prev) => prev.filter((_, pidx) => pidx !== idx))} className="flex-shrink-0 w-20 h-24 bg-[#151a23] rounded border border-gray-700 flex flex-col items-center justify-center p-1">
                        <img src={box.image} className="w-12 h-12 object-contain mb-1" alt={box.name} />
                        <div className="text-[10px] text-gray-400 truncate w-full text-center">{box.name}</div>
                      </button>
                    );
                  })
                )}
              </div>

              <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Available Cases</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {battleAvailableBoxes.map((box) => (
                  <button key={box.id} onClick={() => setSelectedBoxIds((prev) => [...prev, box.id])} className="bg-[#0b0e14] hover:bg-[#151a23] border border-gray-800 hover:border-gray-600 rounded-lg p-2 transition-all flex flex-col items-center text-center">
                    <img src={box.image} className="w-12 h-12 object-contain mb-2" alt={box.name} />
                    <div className="text-xs text-gray-300 font-medium truncate w-full">{box.name}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-gray-800 flex items-center justify-between gap-4">
              <div>
                <div className="text-xs text-gray-500">Entry Cost</div>
                <CoinAmount amount={totalCost} formatOptions={{ maximumFractionDigits: 0 }} className="text-xl font-black text-white" iconClassName="w-4 h-4" />
              </div>
              <button onClick={handleCreateConfirm} disabled={selectedBoxIds.length === 0} className="px-6 py-3 bg-brand-purple hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-lg">
                Create Battle
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
