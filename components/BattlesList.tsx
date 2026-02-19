import React, { useState, useEffect } from 'react';
import { Swords, Plus, X, Trash2, Clock } from 'lucide-react';
import { useGame } from '../context/GameContext';
import { useSound } from '../context/SoundContext';
import { CoinAmount } from './CoinAmount';
import { PRICE_UNIT_MODE, toCoins } from '../utils/coins';

// Sub-component for countdown
const BattleTimer: React.FC<{ createdAt: number }> = ({ createdAt }) => {
    const [timeLeft, setTimeLeft] = useState(60);

    useEffect(() => {
        const timer = setInterval(() => {
            const secondsPassed = (Date.now() - createdAt) / 1000;
            const remaining = Math.max(0, 60 - Math.floor(secondsPassed));
            setTimeLeft(remaining);
        }, 1000);
        return () => clearInterval(timer);
    }, [createdAt]);

    if (timeLeft === 0) return <span className="text-xs font-bold text-orange-500">Bots joining...</span>;

    return (
        <div className="flex items-center gap-1 text-xs font-mono text-gray-400">
            <Clock className="w-3 h-3" />
            <span>Join window: {timeLeft}s</span>
        </div>
    );
};

export const BattlesList: React.FC = () => {
  const { battles, joinBattle, createBattle, user, boxes } = useGame();
  const { playSound } = useSound();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const recentBattles = battles.slice(0, 10);
  
  // Create Battle State
  const [selectedBoxIds, setSelectedBoxIds] = useState<string[]>([]);
  const [playerCount, setPlayerCount] = useState(2);

  // Filter boxes for battle creation (exclude user-created private boxes)
  const battleAvailableBoxes = boxes.filter(b => !b.isUserCreated);

  const handleAddBox = (boxId: string) => {
    playSound('click');
    setSelectedBoxIds([...selectedBoxIds, boxId]);
  };

  const handleRemoveBox = (index: number) => {
    playSound('click');
    const newBoxes = [...selectedBoxIds];
    newBoxes.splice(index, 1);
    setSelectedBoxIds(newBoxes);
  };

  const calculateTotalCost = () => {
    return selectedBoxIds.reduce((sum, id) => {
        const box = boxes.find(b => b.id === id);
        return sum + (box ? toCoins(box.price, PRICE_UNIT_MODE) : 0);
    }, 0);
  };

  const handleCreateConfirm = () => {
    if (selectedBoxIds.length === 0) return;
    createBattle(selectedBoxIds, playerCount);
    setShowCreateModal(false);
    setSelectedBoxIds([]);
  };

  return (
    <section className="mt-12 mb-20 px-4 md:px-0">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-bold text-gray-200 flex items-center gap-2">
          <Swords className="w-5 h-5 text-brand-purple" /> Active Battles
        </h3>
        <div className="flex gap-2 items-center text-xs text-gray-400">
          <span>Showing up to 10 recent battles (scroll for more)</span>
           <button 
             onClick={() => { playSound('click'); setShowCreateModal(true); }}
             className="px-4 py-2 bg-green-600 hover:bg-green-500 rounded-lg text-sm font-bold text-white transition-colors flex items-center gap-2"
           >
             <Plus className="w-4 h-4" /> Create Battle
           </button>
           <button className="px-4 py-2 bg-brand-card hover:bg-gray-700 rounded-lg text-sm font-bold text-gray-300 transition-colors" onClick={() => playSound('click')}>
             View all
           </button>
        </div>
      </div>

      <div className="flex flex-col gap-3 max-h-[550px] overflow-y-auto pr-1 custom-scrollbar">
        {recentBattles.length === 0 ? (
          <div className="text-center py-10 bg-[#131720] rounded-xl border border-gray-800 text-gray-500">
            No active battles. Create one!
          </div>
        ) : (
          recentBattles.map((battle) => {
            const isFull = battle.playerCount >= battle.maxPlayers;
            const isParticipating = battle.players.some(p => p.id === user.id);
            const statusText = battle.status === 'active' ? 'Running' : (isFull ? 'Starting' : 'Waiting');
            
            return (
              <div 
                key={battle.id} 
                className="flex flex-col md:flex-row items-center bg-[#131720] border border-gray-800 rounded-xl p-2 hover:border-gray-600 transition-colors"
                onMouseEnter={() => playSound('hover')}
              >
                 {/* Left Info */}
                 <div className="flex items-center gap-4 w-full md:w-auto p-2 border-b md:border-b-0 md:border-r border-gray-800 md:pr-6 md:mr-6">
                     <div className={`text-xs font-bold uppercase tracking-wider w-16 ${battle.status === 'active' ? 'text-green-500 animate-pulse' : 'text-gray-500'}`}>
                         {statusText}
                     </div>
                     <div className="flex gap-1 overflow-x-auto max-w-[150px] md:max-w-none no-scrollbar">
                         {battle.cases.map((c, i) => (
                             <img key={i} src={c.image} className="w-8 h-8 object-contain bg-[#0b0e14] rounded p-0.5 border border-gray-800" />
                         ))}
                     </div>
                 </div>

                 {/* Players */}
                 <div className="flex items-center gap-2 px-4 py-2">
                    {Array.from({length: battle.maxPlayers}).map((_, i) => {
                        const player = battle.players[i];
                        return (
                            <div key={i} className="w-8 h-8 rounded bg-[#0b0e14] border border-gray-700 flex items-center justify-center overflow-hidden">
                                {player ? (
                                    <img src={player.avatar} className="w-full h-full" />
                                ) : (
                                    <div className="w-2 h-2 rounded-full bg-gray-800"></div>
                                )}
                            </div>
                        );
                    })}
                 </div>

                 {/* Actions */}
                 <div className="ml-auto flex items-center gap-4 p-2 w-full md:w-auto justify-between md:justify-end">
                     {battle.status === 'waiting' && <BattleTimer createdAt={battle.createdAt} />}
                     <div className="text-right">
                         <CoinAmount
                           amount={toCoins(battle.cost, PRICE_UNIT_MODE)}
                           formatOptions={{ maximumFractionDigits: 0 }}
                           className="text-green-500 font-bold justify-end"
                           iconClassName="w-3.5 h-3.5"
                         />
                         <div className="text-[10px] text-gray-500 uppercase font-bold">Cost</div>
                     </div>
                     
                     {isParticipating ? (
                        <button 
                            onClick={() => { playSound('click'); joinBattle(battle.id); }}
                            className="px-6 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm font-bold rounded-lg transition-colors"
                        >
                            Spectate
                        </button>
                     ) : (
                        <button 
                            onClick={() => { playSound('click'); joinBattle(battle.id); }}
                            disabled={isFull}
                            className={`px-6 py-2 text-sm font-bold rounded-lg transition-colors ${isFull ? 'bg-gray-800 text-gray-500 cursor-not-allowed' : 'bg-green-600 hover:bg-green-500 text-white shadow-lg shadow-green-900/20'}`}
                        >
                            {isFull ? 'Full' : 'Join'}
                        </button>
                     )}
                 </div>
              </div>
            );
          })
        )}
      </div>

      {/* CREATE BATTLE MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-in fade-in" onClick={() => setShowCreateModal(false)}></div>
            <div className="relative w-full max-w-2xl bg-[#131720] border border-gray-700 rounded-xl shadow-2xl p-6 animate-in zoom-in-95 flex flex-col max-h-[90vh]">
                <button 
                    onClick={() => setShowCreateModal(false)} 
                    className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors"
                >
                    <X className="w-5 h-5" />
                </button>
                
                <h2 className="text-xl font-bold text-white mb-6">Create Battle</h2>

                <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                    {/* Settings */}
                    <div className="mb-6">
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Players</label>
                        <div className="flex gap-2">
                            {[2, 3, 4].map(num => (
                                <button
                                    key={num}
                                    onClick={() => { playSound('click'); setPlayerCount(num); }}
                                    className={`flex-1 py-3 rounded-lg border font-bold transition-all ${playerCount === num ? 'bg-brand-purple border-brand-purple text-white' : 'bg-[#0b0e14] border-gray-800 text-gray-400 hover:border-gray-600'}`}
                                >
                                    {num} Players
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Selected Boxes */}
                    <div className="mb-6">
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Battle Case Sequence</label>
                        <div className="min-h-[100px] bg-[#0b0e14] border border-gray-800 rounded-xl p-2 flex gap-2 overflow-x-auto items-center">
                            {selectedBoxIds.length === 0 ? (
                                <div className="w-full text-center text-gray-600 text-sm">Select cases below to add them to the battle</div>
                            ) : (
                                selectedBoxIds.map((id, idx) => {
                                    const box = boxes.find(b => b.id === id);
                                    if (!box) return null;
                                    return (
                                        <div key={idx} className="relative group flex-shrink-0 w-20 h-24 bg-[#151a23] rounded border border-gray-700 flex flex-col items-center justify-center p-1">
                                            <button 
                                                onClick={() => handleRemoveBox(idx)}
                                                className="absolute -top-2 -right-2 bg-red-500 rounded-full p-1 text-white opacity-0 group-hover:opacity-100 transition-opacity z-10"
                                            >
                                                <X className="w-3 h-3" />
                                            </button>
                                            <img src={box.image} className="w-12 h-12 object-contain mb-1" />
                                            <div className="text-[10px] text-gray-400 truncate w-full text-center">{box.name}</div>
                                            <CoinAmount
                                              amount={toCoins(box.price, PRICE_UNIT_MODE)}
                                              formatOptions={{ maximumFractionDigits: 0 }}
                                              className="text-[10px] text-green-500 font-bold justify-center"
                                              iconClassName="w-3 h-3"
                                            />
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>

                    {/* Box Selection Grid */}
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Available Cases</label>
                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                            {battleAvailableBoxes.map(box => (
                                <div 
                                    key={box.id} 
                                    onClick={() => handleAddBox(box.id)}
                                    className="bg-[#0b0e14] hover:bg-[#151a23] border border-gray-800 hover:border-gray-600 rounded-lg p-2 cursor-pointer transition-all flex flex-col items-center text-center"
                                >
                                    <img src={box.image} className="w-12 h-12 object-contain mb-2" />
                                    <div className="text-xs text-gray-300 font-medium truncate w-full">{box.name}</div>
                                    <CoinAmount
                                      amount={toCoins(box.price, PRICE_UNIT_MODE)}
                                      formatOptions={{ maximumFractionDigits: 0 }}
                                      className="text-xs text-green-500 font-bold justify-center"
                                      iconClassName="w-3 h-3"
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="mt-6 pt-4 border-t border-gray-800 flex items-center justify-between">
                    <div>
                        <div className="text-xs text-gray-500">Total Cost</div>
                        <CoinAmount
                          amount={calculateTotalCost()}
                          formatOptions={{ maximumFractionDigits: 0 }}
                          className="text-xl font-black text-white"
                          iconClassName="w-4 h-4"
                        />
                    </div>
                    <button 
                        onClick={handleCreateConfirm}
                        disabled={selectedBoxIds.length === 0}
                        className="px-8 py-3 bg-green-600 hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-lg shadow-lg shadow-green-900/20 transition-all active:scale-95"
                    >
                        Create Battle
                    </button>
                </div>
            </div>
        </div>
      )}
    </section>
  );
};
