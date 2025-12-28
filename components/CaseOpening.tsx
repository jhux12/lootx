import React, { useState, useRef, useEffect } from 'react';
import { ChevronLeft, Zap, Volume2, Info, Plus, X, ToggleLeft, ToggleRight } from 'lucide-react';
import { GOLDEN_TICKET_ITEM } from '../constants';
import { CaseItem } from '../types';
import { useGame } from '../context/GameContext';
import { useSound } from '../context/SoundContext';

interface CaseOpeningProps {
  boxId: string;
  isFree?: boolean;
}

const CARD_WIDTH = 160;
const GAP_WIDTH = 16;
const ITEM_WIDTH = CARD_WIDTH + GAP_WIDTH;
const BUFFER_COUNT = 45; // Items before winner

export const CaseOpening: React.FC<CaseOpeningProps> = ({ boxId, isFree = false }) => {
  const { balance, deductBalance, addBalance, addToInventory, setView, boxes } = useGame();
  const { playSound } = useSound();
  
  const box = boxes.find(b => b.id === boxId) || boxes[0];
  const items = box.items || [];

  // Sort items high to low for display purposes
  const displayItems = [...items].sort((a, b) => b.price - a.price);
  
  const [isSpinning, setIsSpinning] = useState(false);
  const [reelItems, setReelItems] = useState<CaseItem[]>([]);
  const [wonItem, setWonItem] = useState<CaseItem | null>(null);
  const [showWinModal, setShowWinModal] = useState(false);
  
  // Gold Spin State
  const [isGoldMode, setIsGoldMode] = useState(false);
  const [forceGoldDebug, setForceGoldDebug] = useState(false);
  
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    // Fill the static view with random items from the specific box
    if (items.length > 0) {
        const staticItems = Array.from({ length: 15 }, () => 
          items[Math.floor(Math.random() * items.length)]
        );
        setReelItems(staticItems);
    }
  }, [items]);

  const getWinningItem = () => {
    // Weighted Randomness
    const totalWeight = items.reduce((sum, item) => sum + item.chance, 0);
    let random = Math.random() * totalWeight;
    
    for (const item of items) {
      if (random < item.chance) return item;
      random -= item.chance;
    }
    return items[items.length - 1];
  };

  const generateReel = (target: CaseItem, pool: CaseItem[]) => {
    const endBuffer = 5; 
    const newReel: CaseItem[] = [];
    
    // Add buffer items
    for (let i = 0; i < BUFFER_COUNT; i++) {
        newReel.push(pool[Math.floor(Math.random() * pool.length)]);
    }
    
    // Add winner at exactly BUFFER_COUNT index
    newReel.push(target);
    
    // Add end buffer
    for (let i = 0; i < endBuffer; i++) {
        newReel.push(pool[Math.floor(Math.random() * pool.length)]);
    }
    
    return newReel;
  };

  const animateSpin = (duration: number, onComplete: () => void) => {
    playSound('spin-start');

    // Reset scroll position immediately
    if (scrollContainerRef.current) {
        scrollContainerRef.current.style.transition = 'none';
        scrollContainerRef.current.style.transform = 'translateX(0)';
    }

    // Trigger animation next tick
    // We use a slight delay to ensure React has painted the new items to the DOM
    setTimeout(() => {
        if (scrollContainerRef.current) {
            // Exact center position of the winning item
            const winnerLeft = BUFFER_COUNT * ITEM_WIDTH;
            
            // ORGANIC JITTER
            // Card width is 160px.
            // Center is 0 relative to the calculation logic.
            // +/- 80px hits the border.
            // +/- 65px is the "safe zone" that stays on the card but looks random.
            // We want it to land ANYWHERE in this safe zone, not just near the center.
            const maxOffset = 65;
            const jitter = Math.floor(Math.random() * (maxOffset * 2)) - maxOffset; // -65 to +65
            
            const finalTranslate = -(winnerLeft) + jitter;

            scrollContainerRef.current.style.transition = `transform ${duration/1000}s cubic-bezier(0.15, 0.85, 0.35, 1.0)`;
            scrollContainerRef.current.style.transform = `translateX(${finalTranslate}px)`;
        }
    }, 50);

    // Completion callback
    setTimeout(onComplete, duration + 200);
  };

  const handleSpin = () => {
    if (isSpinning) return;
    
    if (!isFree && !deductBalance(box.price)) {
        alert("Insufficient funds! Click the + button in header to add test money.");
        return;
    }

    setIsSpinning(true);
    setShowWinModal(false);
    setIsGoldMode(false);
    setWonItem(null);
    playSound('click');
    
    // 1. Determine final winner
    let winner = getWinningItem();

    // DEBUG: Force High Tier if toggle is on
    if (forceGoldDebug) {
        const highTier = items.filter(i => ['legendary', 'epic', 'rare'].includes(i.rarity));
        winner = highTier[Math.floor(Math.random() * highTier.length)] || winner;
    }

    // 2. Check for Gold Spin Eligibility
    const isHighTier = ['legendary', 'epic', 'rare'].includes(winner.rarity);
    const triggerGold = (isHighTier && Math.random() < 0.2) || forceGoldDebug;

    if (triggerGold) {
        // --- GOLD SPIN FLOW ---
        
        // Stage 1: Spin to Golden Ticket
        // Note: We use global items pool for buffer if box items are too few, or just box items. 
        // Ideally Golden Ticket should come from box items if possible, but Golden Ticket is special.
        const ticketReel = generateReel(GOLDEN_TICKET_ITEM, items);
        setReelItems(ticketReel);
        
        animateSpin(4500, () => {
            // Stage 1 Complete: Activate Gold Mode
            playSound('gold-mode');
            setIsGoldMode(true);
            
            // Wait a moment to see the ticket
            setTimeout(() => {
                // Stage 2: Spin to Actual Winner (using only High Tier items in reel)
                const highTierPool = items.filter(i => ['legendary', 'epic', 'rare'].includes(i.rarity));
                // Fallback if no high tier items exist in box
                const pool = highTierPool.length > 0 ? highTierPool : items;
                const goldReel = generateReel(winner, pool);
                setReelItems(goldReel);
                
                animateSpin(4000, () => {
                    // Stage 2 Complete
                    finishSpin(winner);
                });
            }, 1000);
        });

    } else {
        // --- NORMAL SPIN FLOW ---
        const normalReel = generateReel(winner, items);
        setReelItems(normalReel);
        
        animateSpin(5000, () => {
            finishSpin(winner);
        });
    }
  };

  const finishSpin = (item: CaseItem) => {
    setIsSpinning(false);
    setShowWinModal(true);
    setWonItem(item);
    addToInventory(item);
    
    // Play appropriate win sound
    if (item.rarity === 'legendary') playSound('win-gold');
    else if (item.rarity === 'epic' || item.rarity === 'rare') playSound('win-rare');
    else playSound('win-common');
  };

  const handleSell = () => {
    playSound('click');
    if (wonItem) {
        addBalance(wonItem.price);
    }
    setShowWinModal(false);
  };

  const handleKeep = () => {
      playSound('click');
      setShowWinModal(false);
  }

  return (
    <div className="w-full max-w-7xl mx-auto p-6 animate-in fade-in zoom-in-95 duration-300">
        {/* Breadcrumb */}
        <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
                <button 
                    onClick={() => { playSound('click'); setView({ type: 'HOME' }); }}
                    className="flex items-center gap-2 px-3 py-1.5 bg-[#131825] rounded text-gray-400 hover:text-white text-sm font-medium transition-colors"
                >
                    <ChevronLeft className="w-4 h-4" /> All cases
                </button>
                <div className="flex items-center gap-3">
                    <h2 className="text-2xl font-bold text-white">{box.name}</h2>
                    {isFree && <span className="bg-yellow-500 text-black text-xs font-bold px-2 py-0.5 rounded">FREE SPIN</span>}
                </div>
            </div>
            
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
        </div>

        {/* SPINNER AREA */}
        <div className={`relative w-full bg-[#0b0e14] border rounded-2xl p-1 mb-8 overflow-hidden shadow-2xl transition-all duration-700 ${isGoldMode ? 'border-yellow-500 shadow-yellow-500/20' : 'border-gray-800'}`}>
            
            {/* Gold Mode Overlay Effect */}
            {isGoldMode && <div className="absolute inset-0 bg-yellow-500/5 animate-pulse pointer-events-none z-10"></div>}

            {/* Spinner Window */}
            <div className="relative h-64 flex items-center overflow-hidden bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]">
                {/* Center Markers */}
                <div className={`absolute top-4 left-1/2 -translate-x-1/2 z-30 drop-shadow-[0_0_10px_rgba(0,0,0,0.5)] transition-colors duration-300`}>
                    <div className={`w-0 h-0 border-l-[10px] border-l-transparent border-r-[10px] border-r-transparent border-t-[14px] ${isGoldMode ? 'border-t-yellow-400' : 'border-t-cyan-400'}`}></div>
                </div>
                <div className={`absolute bottom-4 left-1/2 -translate-x-1/2 z-30 drop-shadow-[0_0_10px_rgba(0,0,0,0.5)] transition-colors duration-300`}>
                    <div className={`w-0 h-0 border-l-[10px] border-l-transparent border-r-[10px] border-r-transparent border-b-[14px] ${isGoldMode ? 'border-b-yellow-400' : 'border-b-cyan-400'}`}></div>
                </div>
                <div className={`absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-0.5 z-10 ${isGoldMode ? 'bg-yellow-400/50' : 'bg-cyan-400/30'}`}></div>
                
                {/* Fade Gradients */}
                <div className="absolute left-0 top-0 bottom-0 w-32 bg-gradient-to-r from-[#0b0e14] to-transparent z-20 pointer-events-none"></div>
                <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-[#0b0e14] to-transparent z-20 pointer-events-none"></div>

                {/* The Moving Reel */}
                <div 
                    ref={scrollContainerRef}
                    className="flex px-[50%] will-change-transform ml-[-80px]" 
                    style={{ gap: `${GAP_WIDTH}px` }}
                >
                    {reelItems.map((item, idx) => (
                        <div 
                            key={`${item.id}-${idx}`}
                            className={`relative flex-shrink-0 bg-[#151a23] border border-gray-800 rounded-xl p-3 flex flex-col items-center justify-center group ${item.id === 'golden-ticket' ? 'border-yellow-500 shadow-[0_0_15px_rgba(234,179,8,0.3)]' : ''}`}
                            style={{ 
                                width: `${CARD_WIDTH}px`, 
                                height: `${CARD_WIDTH}px`,
                                boxShadow: item.id === 'golden-ticket' ? undefined : `0 4px 0 0 ${item.color}20` 
                            }}
                            onMouseEnter={() => !isSpinning && playSound('hover')}
                        >
                            <div 
                                className="absolute inset-4 rounded-full opacity-20 blur-xl"
                                style={{ backgroundColor: item.color }}
                            ></div>
                            <img 
                                src={item.image} 
                                alt={item.name} 
                                className={`relative z-10 w-24 h-24 object-contain mb-2 ${item.id === 'golden-ticket' ? 'animate-pulse scale-110' : ''}`} 
                            />
                            <div 
                                className="absolute bottom-0 left-0 right-0 h-1 opacity-50 rounded-b-xl"
                                style={{ backgroundColor: item.color }}
                            ></div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Action Bar */}
            <div className="bg-[#0b0e14] p-4 flex items-center justify-center border-t border-gray-800 relative z-20">
                 <button 
                    onClick={handleSpin}
                    disabled={isSpinning}
                    className={`min-w-[200px] px-8 py-3 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-lg shadow-lg transition-all active:scale-95 flex flex-col items-center leading-tight ${isGoldMode ? 'bg-yellow-500 hover:bg-yellow-400 shadow-yellow-500/20 text-black' : (isFree ? 'bg-green-500 hover:bg-green-400 shadow-green-500/20 text-black' : 'bg-blue-600 hover:bg-blue-500 shadow-blue-600/20')}`}
                >
                    <span>{isSpinning ? 'Spinning...' : (isFree ? 'Free Spin' : `Open for $${box.price}`)}</span>
                 </button>
            </div>
        </div>

        {/* Win Modal Overlay */}
        {showWinModal && wonItem && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <div className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setShowWinModal(false)}></div>
                <div className="relative bg-[#151a23] border border-gray-700 p-8 rounded-2xl max-w-md w-full flex flex-col items-center animate-in zoom-in-95 duration-300 shadow-2xl">
                     <button onClick={() => setShowWinModal(false)} className="absolute top-4 right-4 text-gray-500 hover:text-white"><X className="w-5 h-5" /></button>
                     
                     <div className="text-2xl font-black italic text-white mb-2 uppercase tracking-wider">
                         You Won!
                     </div>
                     
                     <div className="relative w-64 h-64 flex items-center justify-center mb-6">
                         <div className="absolute inset-0 bg-gradient-to-tr from-transparent to-white/5 rounded-full animate-pulse"></div>
                         <div className="absolute inset-10 blur-3xl opacity-40 rounded-full" style={{ backgroundColor: wonItem.color }}></div>
                         <img src={wonItem.image} alt={wonItem.name} className="relative z-10 w-48 h-48 object-contain drop-shadow-2xl scale-110" />
                     </div>

                     <div className="text-center mb-8">
                         <h3 className="text-xl font-bold text-white mb-1">{wonItem.name}</h3>
                         <p className="text-gray-400 font-medium">${wonItem.price.toFixed(2)}</p>
                     </div>

                     <div className="flex gap-3 w-full">
                        <button onClick={handleSell} className="flex-1 py-3 bg-[#1a2130] hover:bg-gray-700 text-gray-300 font-bold rounded-lg transition-colors border border-gray-700">
                            Sell for ${wonItem.price.toFixed(2)}
                        </button>
                        <button onClick={handleKeep} className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg shadow-lg shadow-blue-600/20 transition-colors">
                            Keep Item
                        </button>
                     </div>
                </div>
            </div>
        )}

        {/* Case Contents */}
        <div className="mt-12">
            <div className="flex items-center gap-2 mb-6 text-gray-400 text-sm font-bold">
                <div className="w-1 h-4 bg-gray-600 rounded-full"></div>
                Case contains
            </div>
            
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                {displayItems.map((item) => (
                    <div 
                        key={item.id} 
                        className="group relative bg-[#0f1219] hover:bg-[#151a23] border border-gray-800 hover:border-gray-700 rounded-xl p-3 flex flex-col items-center transition-all"
                    >
                        <div className="absolute top-2 left-2 px-1.5 py-0.5 bg-[#1a2130] rounded border border-gray-700 text-[10px] font-bold text-yellow-500">
                            {item.chance}%
                        </div>

                        <div className="relative w-full aspect-square flex items-center justify-center mb-3">
                            <div 
                                className="absolute inset-4 opacity-0 group-hover:opacity-20 transition-opacity blur-xl rounded-full"
                                style={{ backgroundColor: item.color }}
                            ></div>
                            <img src={item.image} alt={item.name} className="relative z-10 w-3/4 h-3/4 object-contain group-hover:scale-110 transition-transform duration-300" />
                        </div>

                        <div className="w-full text-left mt-auto">
                            <div className="text-gray-400 text-xs font-medium truncate mb-0.5">{item.name}</div>
                            <div className="text-white font-bold text-sm">${item.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                        </div>

                        <div 
                            className="absolute bottom-0 left-0 right-0 h-[2px] rounded-b-xl opacity-50 group-hover:opacity-100 transition-opacity"
                            style={{ backgroundColor: item.color, boxShadow: `0 0 8px ${item.color}` }}
                        ></div>
                    </div>
                ))}
            </div>
        </div>
    </div>
  );
};
