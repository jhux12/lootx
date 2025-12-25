import React, { useEffect, useState, useRef } from 'react';
import { useGame } from '../context/GameContext';
import { GOLDEN_TICKET_ITEM } from '../constants';
import { ChevronLeft, Swords, Trophy, User, Zap, ToggleLeft, ToggleRight } from 'lucide-react';
import { CaseItem, BattleRound } from '../types';

interface BattleArenaProps {
  battleId: string;
}

// Sub-component for the visual vertical spinner
const BattleSpinner: React.FC<{ 
  winningItem: CaseItem | null, 
  spinning: boolean,
  isGoldMode: boolean,
  pool: CaseItem[] 
}> = ({ winningItem, spinning, isGoldMode, pool }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [items, setItems] = useState<CaseItem[]>([]);
  
  // Height of one item in the strip
  const ITEM_HEIGHT = 80; // h-20
  
  useEffect(() => {
    // Generate random strip
    const bufferCount = 30;
    const strip: CaseItem[] = [];
    
    // Pool filter based on mode
    const activePool = isGoldMode 
        ? pool.filter(i => i.rarity === 'legendary' || i.rarity === 'gold' || i.rarity === 'rare') 
        : pool;

    // Fallback if pool empty after filter
    const finalPool = activePool.length > 0 ? activePool : pool;
    
    // Fill random
    for (let i = 0; i < bufferCount + 5; i++) {
        strip.push(finalPool[Math.floor(Math.random() * finalPool.length)]);
    }
    
    // Insert winner at fixed position if known (e.g. index 28)
    if (winningItem) {
       strip[28] = winningItem;
    }
    
    setItems(strip);
  }, [winningItem, isGoldMode, pool]);

  useEffect(() => {
    if (spinning && containerRef.current) {
        // Reset (instant)
        containerRef.current.style.transition = 'none';
        containerRef.current.style.transform = 'translateY(0)';

        // Animate
        setTimeout(() => {
           if (containerRef.current) {
               // Calculate Target Y
               const targetY = -(28 * ITEM_HEIGHT + (ITEM_HEIGHT/2) - (128/2));
               const jitter = (Math.random() * 20) - 10;
               
               containerRef.current.style.transition = 'transform 3.5s cubic-bezier(0.15, 0.85, 0.35, 1.0)';
               containerRef.current.style.transform = `translateY(${targetY + jitter}px)`;
           }
        }, 50);
    }
  }, [spinning]); // Trigger on spinning true

  return (
    <div className={`h-32 bg-[#0b0e14] border border-gray-800 rounded-xl relative overflow-hidden flex justify-center transition-all duration-500 ${isGoldMode ? 'border-yellow-400 shadow-[0_0_15px_rgba(250,204,21,0.3)]' : ''}`}>
       {/* Center Line */}
       <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-yellow-500/30 z-20 -translate-y-1/2"></div>
       <div className="absolute top-0 left-0 right-0 h-8 bg-gradient-to-b from-[#0b0e14] to-transparent z-10"></div>
       <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-[#0b0e14] to-transparent z-10"></div>
       
       {isGoldMode && <div className="absolute inset-0 bg-yellow-500/5 pointer-events-none z-0 animate-pulse"></div>}

       <div 
         ref={containerRef}
         className="flex flex-col items-center w-full will-change-transform"
       >
         {items.map((item, i) => (
             <div key={i} className="flex-shrink-0 w-full h-20 flex items-center justify-center p-2 relative">
                 {/* Special Glow for Gold items in strip */}
                 {item.rarity === 'gold' && <div className="absolute inset-0 bg-yellow-500/10 blur-xl"></div>}
                 <img src={item.image} className="h-14 w-14 object-contain relative z-10" />
             </div>
         ))}
       </div>
    </div>
  );
};

export const BattleArena: React.FC<BattleArenaProps> = ({ battleId }) => {
  const { battles, updateBattle, setView, addToInventory, user } = useGame();
  const battle = battles.find(b => b.id === battleId);
  
  const [spinning, setSpinning] = useState(false);
  const [roundItems, setRoundItems] = useState<{ [playerId: string]: CaseItem }>({});
  
  // State to track if a specific player is in "Gold Mode" for this round
  const [goldModePlayers, setGoldModePlayers] = useState<Set<string>>(new Set());
  
  // DEBUG STATE
  const [forceGoldDebug, setForceGoldDebug] = useState(false);
  
  // Ref to handle the sequence steps without re-renders breaking logic
  const processingRound = useRef(false);

  // Helper to get random item from a specific pool
  const getRandomItem = (pool: CaseItem[]) => {
    const totalWeight = pool.reduce((sum, item) => sum + item.chance, 0);
    let random = Math.random() * totalWeight;
    for (const item of pool) {
      if (random < item.chance) return item;
      random -= item.chance;
    }
    return pool[pool.length - 1];
  };

  useEffect(() => {
    if (!battle) return;

    if (battle.status === 'active' && !spinning && !processingRound.current) {
      if (battle.currentRound < battle.rounds) {
        startRound();
      } else {
        finishBattle();
      }
    }
  }, [battle, spinning]);

  const startRound = () => {
    if (!battle) return;
    processingRound.current = true;
    
    // Get Items for Current Box
    const currentBox = battle.cases[battle.currentRound] || battle.cases[battle.cases.length - 1];
    const pool = currentBox.items || [];

    if (pool.length === 0) {
        console.error("Box has no items!");
        processingRound.current = false;
        return;
    }

    // 1. Determine FINAL results for this round
    const finalResults: { [key: string]: CaseItem } = {};
    const playersGettingGold: string[] = [];

    battle.players.forEach(p => {
      let item = getRandomItem(pool);
      
      // DEBUG: Force high tier item for user if debug is on
      if (p.id === user.id && forceGoldDebug) {
           const highTierItems = pool.filter(i => ['legendary', 'gold', 'rare'].includes(i.rarity));
           item = highTierItems[Math.floor(Math.random() * highTierItems.length)] || item;
      }

      finalResults[p.id] = item;
      
      // Check eligibility
      const isEligible = ['legendary', 'gold', 'rare'].includes(item.rarity);
      
      // 20% Chance for Gold Upgrade if item is Epic/Legendary/Gold
      // OR if DEBUG is on for user
      if ((isEligible && Math.random() < 0.2) || (p.id === user.id && forceGoldDebug)) {
          playersGettingGold.push(p.id);
      }
    });

    // 2. Start First Spin
    // If getting gold, show Gold Ticket first. Else show final result.
    const firstSpinTargets: { [key: string]: CaseItem } = {};
    
    battle.players.forEach(p => {
        if (playersGettingGold.includes(p.id)) {
            firstSpinTargets[p.id] = GOLDEN_TICKET_ITEM;
        } else {
            firstSpinTargets[p.id] = finalResults[p.id];
        }
    });

    setRoundItems(firstSpinTargets);
    setGoldModePlayers(new Set()); // Reset gold mode
    setSpinning(true);

    // 3. Handle Sequence
    if (playersGettingGold.length > 0) {
        // Multi-stage spin
        setTimeout(() => {
            // Stage 1 ends: Landed on Gold Ticket
            setSpinning(false);
            
            setTimeout(() => {
                // Trigger Gold Mode & Second Spin
                setGoldModePlayers(new Set(playersGettingGold));
                setRoundItems(finalResults); // Update targets to real items
                setSpinning(true); // Spin again
                
                setTimeout(() => {
                   // Stage 2 ends
                   setSpinning(false);
                   completeRound(finalResults);
                   // Cleanup visual state after small delay
                   setTimeout(() => setGoldModePlayers(new Set()), 2000);
                }, 4000);
            }, 1000); // Wait 1s looking at the ticket
        }, 4000);
    } else {
        // Normal single spin
        setTimeout(() => {
            setSpinning(false);
            completeRound(finalResults);
        }, 4000); 
    }
  };

  const completeRound = (results: { [key: string]: CaseItem }) => {
    if (!battle) return;

    const roundData: BattleRound = {
      roundNumber: battle.currentRound + 1,
      drops: battle.players.map(p => ({ playerId: p.id, item: results[p.id] }))
    };

    const updatedPlayers = battle.players.map(p => ({
      ...p,
      totalWin: p.totalWin + results[p.id].price
    }));

    const userDrop = results[user.id];
    if (userDrop) {
      addToInventory(userDrop);
    }

    updateBattle({
      ...battle,
      currentRound: battle.currentRound + 1,
      history: [...battle.history, roundData],
      players: updatedPlayers,
      status: battle.currentRound + 1 >= battle.rounds ? 'finished' : 'active'
    });
    
    processingRound.current = false;
  };

  const finishBattle = () => {
    // Handled in updateBattle status check
  };

  if (!battle) return <div className="p-10 text-center">Battle not found</div>;

  const winnerId = battle.status === 'finished' 
    ? battle.players.reduce((prev, current) => (prev.totalWin > current.totalWin) ? prev : current).id
    : null;
    
  const currentCase = battle.cases[battle.currentRound] || battle.cases[battle.cases.length - 1];

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center gap-4 mb-8">
        <div className="flex items-center gap-4">
            <button 
                onClick={() => setView({ type: 'HOME' })}
                className="flex items-center gap-2 px-3 py-1.5 bg-[#131825] rounded text-gray-400 hover:text-white text-sm font-medium transition-colors"
            >
                <ChevronLeft className="w-4 h-4" /> Exit Battle
            </button>
            <div className="h-8 w-px bg-gray-800"></div>
            <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Swords className="w-5 h-5 text-brand-purple" /> Case Battle
                <span className="text-sm font-normal text-gray-500 bg-[#131720] px-2 py-0.5 rounded border border-gray-800">
                Round {battle.currentRound + 1} / {battle.rounds}
                </span>
            </h2>
            </div>
        </div>
        
        <div className="flex items-center gap-2 px-4 py-1 bg-[#131720] rounded border border-gray-800 md:ml-4 hidden sm:flex">
             <span className="text-xs text-gray-400">Opening:</span>
             <img src={currentCase?.image} className="w-6 h-6 object-contain" />
             <span className="text-sm font-bold text-white">{currentCase?.name}</span>
        </div>

        <div className="md:ml-auto flex items-center gap-4 justify-between md:justify-end w-full md:w-auto">
           
           {/* DEBUG TOGGLE */}
           <div 
             className="flex items-center gap-2 cursor-pointer bg-[#131825] px-3 py-1.5 rounded border border-gray-800/50 hover:border-yellow-500/50 transition-colors"
             onClick={() => setForceGoldDebug(!forceGoldDebug)}
           >
               <span className={`text-xs font-bold ${forceGoldDebug ? 'text-yellow-500' : 'text-gray-500'}`}>TEST: Gold Spin</span>
               {forceGoldDebug 
                 ? <ToggleRight className="w-5 h-5 text-yellow-500" /> 
                 : <ToggleLeft className="w-5 h-5 text-gray-600" />
               }
           </div>

           <div className="text-right">
             <div className="text-xs text-gray-500">Battle Cost</div>
             <div className="font-bold text-white">${battle.cost.toFixed(2)}</div>
           </div>
        </div>
      </div>

      {/* Arena Grid - Forced 2 columns minimum on mobile to avoid stacking */}
      <div className={`grid gap-4 grid-cols-2 ${battle.maxPlayers > 2 ? 'md:grid-cols-4' : 'md:grid-cols-2'}`}>
        {Array.from({ length: battle.maxPlayers }).map((_, index) => {
          const player = battle.players[index];
          const isWinner = winnerId === player?.id;
          const isGold = player && goldModePlayers.has(player.id);
          
          return (
            <div key={index} className="flex flex-col gap-4">
              {/* Player Card */}
              <div className={`
                bg-[#131720] border rounded-xl p-4 flex flex-col items-center relative overflow-hidden transition-all duration-300
                ${isWinner ? 'border-yellow-500 shadow-[0_0_20px_rgba(234,179,8,0.2)]' : 'border-gray-800'}
                ${isGold ? 'border-yellow-400 ring-1 ring-yellow-400 shadow-[0_0_30px_rgba(250,204,21,0.2)]' : ''}
              `}>
                {player ? (
                  <>
                    <img src={player.avatar} className="w-16 h-16 rounded-xl border-4 border-[#0b0e14] shadow-lg z-10" />
                    <div className="text-center mt-3 z-10">
                      <div className="font-bold text-white truncate max-w-[120px]">{player.name}</div>
                      <div className={`text-sm font-bold ${isWinner ? 'text-yellow-500' : 'text-gray-400'}`}>
                        ${player.totalWin.toFixed(2)}
                      </div>
                    </div>
                    {isWinner && <Trophy className="absolute top-2 right-2 w-5 h-5 text-yellow-500 animate-bounce" />}
                    {isGold && <Zap className="absolute top-2 left-2 w-5 h-5 text-yellow-400 animate-pulse" />}
                    {isGold && <div className="absolute inset-0 bg-yellow-500/10 animate-pulse z-0"></div>}
                  </>
                ) : (
                  <div className="w-16 h-16 rounded-xl border-2 border-dashed border-gray-700 flex items-center justify-center opacity-50">
                    <User className="w-6 h-6 text-gray-500" />
                  </div>
                )}
              </div>

              {/* Active Spinner Row */}
              <div className="relative">
                 {player && (spinning || (battle.status === 'active' && !roundItems[player.id])) ? (
                   <BattleSpinner 
                        winningItem={roundItems[player.id]} 
                        spinning={spinning} 
                        isGoldMode={isGold || false}
                        pool={currentCase?.items || []}
                   />
                 ) : (
                    <div className={`h-32 bg-[#0b0e14] border border-gray-800 rounded-xl flex flex-col items-center justify-center p-2 relative overflow-hidden transition-all ${isGold ? 'border-yellow-500 shadow-lg shadow-yellow-500/10' : ''}`}>
                        {player && roundItems[player.id] ? (
                            <>
                                <div className="absolute inset-0 opacity-10 bg-current" style={{ color: roundItems[player.id].color }}></div>
                                <img src={roundItems[player.id].image} className={`w-16 h-16 object-contain mb-1 relative z-10 ${roundItems[player.id].id === 'golden-ticket' ? 'animate-bounce' : ''}`} />
                                <div className="text-center relative z-10">
                                    <div className="text-[10px] text-gray-400 truncate w-full">{roundItems[player.id].name}</div>
                                    <div className="text-sm font-bold text-white">${roundItems[player.id].price.toFixed(2)}</div>
                                </div>
                            </>
                        ) : (
                            <div className="text-gray-700 text-xs font-bold">WAITING</div>
                        )}
                    </div>
                 )}
              </div>

              {/* History Rows */}
              <div className="flex flex-col gap-2">
                {battle.history.slice().reverse().map((round, rIdx) => {
                  const drop = round.drops.find(d => d.playerId === player?.id);
                  if (!drop) return null;
                  return (
                    <div key={rIdx} className="flex items-center gap-3 bg-[#131720] p-2 rounded-lg border border-gray-800/50 opacity-60 hover:opacity-100 transition-opacity">
                       <img src={drop.item.image} className="w-10 h-10 object-contain" />
                       <div className="min-w-0">
                          <div className="text-[10px] text-gray-400 truncate">{drop.item.name}</div>
                          <div className="text-xs font-bold text-gray-200" style={{ color: drop.item.color }}>${drop.item.price.toFixed(2)}</div>
                       </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};