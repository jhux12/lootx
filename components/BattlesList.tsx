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
    return { label: `STARTING • ${secondsLeft}s`, intent: 'starting' as const };
  }
  if (state === 'RUNNING' || state === 'FINISHING') {
    return { label: `LIVE • Round ${Math.max(1, Number(battle.currentRound ?? 1))}/${Math.max(1, Number(battle.rounds ?? 1))}`, intent: 'live' as const };
  }
  if (state === 'COMPLETE') {
    return { label: 'ENDED', intent: 'ended' as const };
  }
  return { label: `WAITING • ${playerCount}/${maxPlayers}`, intent: 'waiting' as const };
};

export const BattlesList: React.FC = () => {
  const { joinBattle, createBattle, user, boxes } = useGame();
  const [battleRows, setBattleRows] = useState<any[]>([]);
  const { playSound } = useSound();
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
      // Ignore tick failures client-side; battle remains readable.
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
    <section className="mt-8 mb-20 px-2 sm:px-4 md:px-0">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h3 className="text-lg font-bold text-gray-200 flex items-center gap-2">
          <Swords className="w-5 h-5 text-brand-purple" /> Active Battles
        </h3>
        <div className="flex flex-wrap gap-2 items-center text-xs text-gray-400 justify-end">
          <button
            onClick={() => {
              playSound('click');
              setShowCreateModal(true);
            }}
            className="px-4 py-2 bg-green-600 hover:bg-green-500 rounded-lg text-sm font-bold text-white transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Create Battle
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-3 max-h-[550px] overflow-y-auto pr-1 custom-scrollbar">
        {recentBattles.length === 0 ? (
          <div className="text-center py-10 bg-[#131720] rounded-xl border border-gray-800 text-gray-500">No active battles. Create one!</div>
        ) : (
          recentBattles.map((battle: any) => {
            const isFull = battle.playerCount >= battle.maxPlayers;
            const isParticipating = battle.players.some((player: any) => player.id === user.id);
            const status = formatStatus(battle, now);
            const waiting = status.intent === 'waiting';
            const rowTicking = Boolean(tickBusy[battle.id]);

            return (
              <div key={battle.id} className="flex flex-col md:flex-row items-stretch md:items-center bg-[#131720] border border-gray-800 rounded-xl p-2 hover:border-gray-600 transition-colors">
                <div className="flex items-center gap-4 w-full md:w-auto p-2 border-b md:border-b-0 md:border-r border-gray-800 md:pr-6 md:mr-6">
                  <div className={`text-xs font-bold uppercase tracking-wider min-w-[120px] ${status.intent === 'live' ? 'text-green-500' : status.intent === 'starting' ? 'text-yellow-400' : 'text-gray-400'}`}>
                    {status.label}
                  </div>
                  <div className="flex gap-1 overflow-x-auto max-w-[160px] md:max-w-none no-scrollbar">
                    {battle.cases.slice(0, 4).map((item: any, index: number) => (
                      <img key={`${battle.id}-${index}`} src={item.image} className="w-8 h-8 object-contain bg-[#0b0e14] rounded p-0.5 border border-gray-800" />
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2 px-4 py-2">
                  {Array.from({ length: battle.maxPlayers }).map((_, index) => {
                    const player = battle.players[index];
                    return (
                      <div key={`${battle.id}-slot-${index}`} className="w-8 h-8 rounded bg-[#0b0e14] border border-gray-700 flex items-center justify-center overflow-hidden">
                        {player ? (
                          <img src={player.avatar} className="w-full h-full" />
                        ) : (
                          <div className="w-2 h-2 rounded-full bg-gray-800" />
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="ml-auto flex items-center gap-4 p-2 w-full md:w-auto justify-between md:justify-end">
                  {waiting && (
                    <div className="flex items-center gap-1 text-xs text-gray-400 min-w-[140px] justify-end">
                      {rowTicking ? <Loader2 className="w-3 h-3 animate-spin" /> : <Clock3 className="w-3 h-3" />}
                      <span>{rowTicking ? 'Checking seats…' : 'Waiting for players…'}</span>
                    </div>
                  )}
                  <div className="text-right">
                    <CoinAmount
                      amount={Number(battle.entryCostCoins ?? toCoins(battle.cost ?? 0, PRICE_UNIT_MODE))}
                      formatOptions={{ maximumFractionDigits: 0 }}
                      className="text-green-500 font-bold justify-end"
                      iconClassName="w-3.5 h-3.5"
                    />
                    <div className="text-[10px] text-gray-500 uppercase font-bold">Entry</div>
                  </div>
                  <button
                    onClick={() => {
                      playSound('click');
                      joinBattle(battle.id);
                    }}
                    disabled={!isParticipating && isFull}
                    className={`px-5 py-2 text-sm font-bold rounded-lg transition-colors ${isParticipating ? 'bg-gray-700 hover:bg-gray-600 text-white' : isFull ? 'bg-gray-800 text-gray-500 cursor-not-allowed' : 'bg-green-600 hover:bg-green-500 text-white'}`}
                  >
                    {isParticipating ? 'Spectate' : isFull ? 'Full' : 'Join'}
                  </button>
                </div>
              </div>
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
                        <img src={box.image} className="w-12 h-12 object-contain mb-1" />
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
                    <img src={box.image} className="w-12 h-12 object-contain mb-2" />
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
              <button onClick={handleCreateConfirm} disabled={selectedBoxIds.length === 0} className="px-6 py-3 bg-green-600 hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-lg">
                Create Battle
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
