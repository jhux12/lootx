import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronLeft, Zap, Volume2, Info, Plus, X, ToggleLeft, ToggleRight, ShieldCheck } from 'lucide-react';
import { GOLDEN_TICKET_ITEM } from '../constants';
import { CaseItem } from '../types';
import { useGame } from '../context/GameContext';
import { useSound } from '../context/SoundContext';

interface CaseOpeningProps {
  boxId: string;
  isFree?: boolean;
}

interface RollData {
  nonce: number;
  rollHash: string;
  rollValue: number;
  combinedSeed: string;
  outcome?: string;
}

const CARD_WIDTH = 160;
const GAP_WIDTH = 16;
const ITEM_WIDTH = CARD_WIDTH + GAP_WIDTH;
const BUFFER_COUNT = 45; // Items before winner
const CLIENT_SEED_KEY = 'lootx_client_seed';
const SERVER_SEED_KEY = 'lootx_server_seed';

const toHex = (buffer: ArrayBuffer) =>
  Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

const hashString = async (value: string) => {
  const encoder = new TextEncoder();
  const data = encoder.encode(value);
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    const fallback = data.reduce((acc, byte, idx) => acc + byte * (idx + 1), 0);
    return fallback.toString(16).padStart(64, '0').slice(0, 64);
  }

  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return toHex(hashBuffer);
};

const deriveRollValue = (hash: string) => {
  const significantPart = hash.slice(0, 13); // 52 bits
  const intValue = parseInt(significantPart, 16);
  return intValue / 0x10000000000000; // 2^52
};

const generateServerSeed = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const bytes = new Uint32Array(8);
    crypto.getRandomValues(bytes);
    return Array.from(bytes).map((b) => b.toString(16).padStart(8, '0')).join('');
  }

  return Array.from({ length: 8 })
    .map(() => Math.random().toString(16).slice(2, 10))
    .join('')
    .slice(0, 64);
};

export const CaseOpening: React.FC<CaseOpeningProps> = ({ boxId, isFree = false }) => {
  const { user, balance, deductBalance, addBalance, addToInventory, setView, boxes, isAuthenticated, setShowLoginModal } = useGame();
  const { playSound } = useSound();
  
  const box = boxes.find(b => b.id === boxId) || boxes[0];
  const items = box.items || [];

  // Sort items high to low for display purposes
  const displayItems = [...items].sort((a, b) => b.price - a.price);
  
  const [isSpinning, setIsSpinning] = useState(false);
  const [reelItems, setReelItems] = useState<CaseItem[]>([]);
  const [wonItem, setWonItem] = useState<CaseItem | null>(null);
  const [showWinModal, setShowWinModal] = useState(false);
  const [serverSeed, setServerSeed] = useState(() => {
    if (typeof window === 'undefined') return '';
    return localStorage.getItem(SERVER_SEED_KEY) || '';
  });
  const [serverSeedHash, setServerSeedHash] = useState('');
  const [clientSeed, setClientSeed] = useState(() => {
    if (typeof window === 'undefined') return 'lootx-player';
    return localStorage.getItem(CLIENT_SEED_KEY) || 'lootx-player';
  });
  const [nonce, setNonce] = useState(0);
  const [lastRoll, setLastRoll] = useState<RollData | null>(null);
  const [isGeneratingSeed, setIsGeneratingSeed] = useState(false);
  const [showFairModal, setShowFairModal] = useState(false);
  const [fairTab, setFairTab] = useState<'active' | 'verify'>('active');
  const [showFairTooltip, setShowFairTooltip] = useState(false);
  
  // Gold Spin State
  const [isGoldMode, setIsGoldMode] = useState(false);
  const [forceGoldDebug, setForceGoldDebug] = useState(false);
  const [hasUsedFreeSpin, setHasUsedFreeSpin] = useState(false);
  
  const nonceRef = useRef(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const canFreeSpin = !user.lastDailyClaim || (Date.now() - user.lastDailyClaim > 24 * 60 * 60 * 1000);
  const recentClaim = !!user.lastDailyClaim && (Date.now() - user.lastDailyClaim < 2 * 60 * 1000);

  const setNewServerSeed = useCallback(async (seedOverride?: string) => {
    setIsGeneratingSeed(true);
    const nextSeed = seedOverride || generateServerSeed();

    try {
      const hash = await hashString(nextSeed);

      setServerSeed(nextSeed);
      setServerSeedHash(hash);
      nonceRef.current = 0;
      setNonce(0);
      setLastRoll(null);

      if (typeof window !== 'undefined') {
        localStorage.setItem(SERVER_SEED_KEY, nextSeed);
      }

      return nextSeed;
    } finally {
      setIsGeneratingSeed(false);
    }
  }, []);

  const ensureSeedReady = useCallback(async (): Promise<string> => {
    if (!serverSeed) {
      return setNewServerSeed();
    }

    if (!serverSeedHash) {
      const hash = await hashString(serverSeed);
      setServerSeedHash(hash);
    }

    return serverSeed;
  }, [serverSeed, serverSeedHash, setNewServerSeed]);

  const getNextFairRoll = useCallback(async (): Promise<RollData> => {
    const activeSeed = await ensureSeedReady();
    const currentNonce = nonceRef.current;
    const combinedSeed = `${activeSeed}:${clientSeed}:${currentNonce}`;
    const rollHash = await hashString(combinedSeed);
    const rollValue = deriveRollValue(rollHash);

    nonceRef.current = currentNonce + 1;
    setNonce(nonceRef.current);

    return {
      nonce: currentNonce,
      rollHash,
      rollValue,
      combinedSeed
    };
  }, [clientSeed, ensureSeedReady]);
  
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(CLIENT_SEED_KEY, clientSeed);
    }
  }, [clientSeed]);

  useEffect(() => {
    ensureSeedReady();
  }, [ensureSeedReady]);
  
  useEffect(() => {
    // Fill the static view with random items from the specific box
    if (items.length > 0) {
        const staticItems = Array.from({ length: 15 }, () => 
          items[Math.floor(Math.random() * items.length)]
        );
        setReelItems(staticItems);
    }
  }, [items]);

  const getWinningItem = (randomValue: number) => {
    // Weighted Randomness
    const totalWeight = items.reduce((sum, item) => sum + item.chance, 0);
    let random = randomValue * totalWeight;
    
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

  const handleSpin = async () => {
    if (isSpinning) return;

    if (isFree) {
      if (!isAuthenticated) {
        setShowLoginModal(true);
        return;
      }
      if (!canFreeSpin && (!recentClaim || hasUsedFreeSpin)) {
        alert("Free case already claimed. Come back in 24 hours.");
        return;
      }
      setHasUsedFreeSpin(true);
    }
    
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
    const winningRoll = await getNextFairRoll();
    let winner = getWinningItem(winningRoll.rollValue);

    // DEBUG: Force High Tier if toggle is on
    if (forceGoldDebug) {
        const highTier = items.filter(i => ['legendary', 'epic', 'rare'].includes(i.rarity));
        winner = highTier[Math.floor(Math.random() * highTier.length)] || winner;
    }

    setLastRoll({
        ...winningRoll,
        outcome: winner.name
    });

    // 2. Check for Gold Spin Eligibility
    const isHighTier = ['legendary', 'epic', 'rare'].includes(winner.rarity);
    const goldRoll = await getNextFairRoll();
    const triggerGold = (isHighTier && goldRoll.rollValue < 0.2) || forceGoldDebug;

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

  const handleCopyProof = useCallback(async () => {
    playSound('click');
    
    if (!lastRoll) return;

    const proof = [
      `Server Seed: ${serverSeed}`,
      `Server Seed Hash: ${serverSeedHash}`,
      `Client Seed: ${clientSeed}`,
      `Nonce: ${lastRoll.nonce}`,
      `Combined Seed: ${lastRoll.combinedSeed}`,
      `Roll Hash: ${lastRoll.rollHash}`,
      `Roll Value: ${lastRoll.rollValue}`,
      `Outcome: ${lastRoll.outcome ?? 'N/A'}`
    ].join('\n');

    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(proof);
      alert('Provably fair proof copied to clipboard.');
    } else {
      alert(proof);
    }
  }, [clientSeed, lastRoll, playSound, serverSeed, serverSeedHash]);

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
                    disabled={isSpinning || isGeneratingSeed}
                    className={`min-w-[200px] px-8 py-3 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-lg shadow-lg transition-all active:scale-95 flex flex-col items-center leading-tight ${isGoldMode ? 'bg-yellow-500 hover:bg-yellow-400 shadow-yellow-500/20 text-black' : (isFree ? 'bg-green-500 hover:bg-green-400 shadow-green-500/20 text-black' : 'bg-blue-600 hover:bg-blue-500 shadow-blue-600/20')}`}
                >
                    <span>{isGeneratingSeed ? 'Preparing seed...' : (isSpinning ? 'Spinning...' : (isFree ? 'Free Spin' : `Open for $${box.price}`))}</span>
                 </button>
            </div>
        </div>

        <div className="flex items-center justify-center mb-10">
            <div 
                className="relative flex items-center gap-2 text-gray-400 cursor-pointer hover:text-white transition-colors"
                onClick={() => { playSound('click'); setShowFairModal(true); setFairTab('active'); }}
                onMouseEnter={() => setShowFairTooltip(true)}
                onMouseLeave={() => setShowFairTooltip(false)}
            >
                <ShieldCheck className="w-5 h-5" />
                <span className="text-sm font-semibold">Provably Fair</span>
                {showFairTooltip && (
                    <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-black/80 border border-gray-700 text-xs text-gray-200 px-3 py-2 rounded-lg shadow-lg w-56 text-center z-30">
                        Click to view seed commitments and verify your last spin.
                    </div>
                )}
            </div>
        </div>

        {showFairModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowFairModal(false)}></div>
                <div className="relative bg-[#0f1219] border border-gray-800 rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden animate-in fade-in">
                    <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
                        <div className="flex items-center gap-2 text-white font-bold text-xl">
                            <ShieldCheck className="w-6 h-6 text-green-400" />
                            Provably Fair
                        </div>
                        <button onClick={() => { playSound('click'); setShowFairModal(false); }} className="text-gray-500 hover:text-white">
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="px-6 pt-4">
                        <div className="flex gap-6 border-b border-gray-800 mb-4">
                            <button
                                className={`py-3 text-sm font-semibold border-b-2 transition-colors ${fairTab === 'active' ? 'text-white border-green-400' : 'text-gray-500 border-transparent hover:text-white'}`}
                                onClick={() => { playSound('click'); setFairTab('active'); }}
                            >
                                Active Seeds
                            </button>
                            <button
                                className={`py-3 text-sm font-semibold border-b-2 transition-colors ${fairTab === 'verify' ? 'text-white border-blue-400' : 'text-gray-500 border-transparent hover:text-white'}`}
                                onClick={() => { playSound('click'); setFairTab('verify'); }}
                            >
                                Verify Last Spin
                            </button>
                        </div>
                    </div>

                    <div className="px-6 pb-6 max-h-[70vh] overflow-y-auto">
                        {fairTab === 'active' && (
                            <div className="space-y-4">
                                <div className="bg-green-500/10 border border-green-600/40 rounded-xl p-4 text-green-200 text-sm">
                                    We commit to a hashed server seed before your spin. After the spin, the server seed is revealed so you can verify your outcome.
                                </div>
                                <div className="grid md:grid-cols-2 gap-4">
                                    <div className="bg-[#0b0e14] border border-gray-800 rounded-xl p-4">
                                        <div className="flex items-center justify-between mb-3">
                                            <div className="flex items-center gap-2 text-white font-semibold">
                                                <Zap className="w-5 h-5 text-yellow-400" />
                                                Server Seed
                                            </div>
                                            <button
                                                onClick={async () => { playSound('click'); await setNewServerSeed(); }}
                                                disabled={isGeneratingSeed || isSpinning}
                                                className="text-xs px-3 py-1.5 bg-[#131825] border border-gray-700 rounded-lg text-gray-200 hover:border-yellow-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                {isGeneratingSeed ? 'Generating...' : 'New Server Seed'}
                                            </button>
                                        </div>
                                        <div className="space-y-2">
                                            <div>
                                                <div className="text-xs text-gray-500 mb-1">Server seed hash (committed)</div>
                                                <div className="font-mono text-xs text-white bg-black/30 rounded p-2 break-all border border-gray-800">{serverSeedHash || 'Generating hash...'}</div>
                                            </div>
                                            <div>
                                                <div className="text-xs text-gray-500 mb-1">Revealed server seed</div>
                                                <div className="font-mono text-xs text-gray-300 bg-black/20 rounded p-2 break-all border border-gray-800">{serverSeed || 'Generating...'}</div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="bg-[#0b0e14] border border-gray-800 rounded-xl p-4">
                                        <div className="flex items-center justify-between mb-3">
                                            <div className="flex items-center gap-2 text-white font-semibold">
                                                <Volume2 className="w-5 h-5 text-cyan-400" />
                                                Client Seed
                                            </div>
                                            <div className="text-[10px] uppercase font-semibold text-gray-500 bg-black/20 px-2 py-1 rounded border border-gray-800">Nonce {nonce}</div>
                                        </div>
                                        <label className="text-xs text-gray-400 mb-2 block">Customize your seed to verify rolls independently</label>
                                        <input 
                                            value={clientSeed}
                                            onChange={(e) => setClientSeed(e.target.value)}
                                            className="w-full bg-[#0b0e14] border border-gray-800 rounded-lg px-3 py-2 text-sm text-white focus:border-cyan-400 focus:outline-none"
                                            placeholder="Enter your own client seed"
                                            disabled={isSpinning}
                                        />
                                        <p className="text-xs text-gray-500 mt-3 leading-relaxed">
                                            Each roll combines the hashed server seed, your client seed, and the nonce to generate a deterministic SHA-256 hash. Changing the client seed gives you a new set of verifiable outcomes.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {fairTab === 'verify' && (
                            <div className="space-y-4">
                                <div className="bg-blue-500/10 border border-blue-600/40 rounded-xl p-4 text-blue-200 text-sm flex items-start gap-3">
                                    <Info className="w-5 h-5 mt-0.5" />
                                    <div>
                                        <div className="font-semibold text-white">Previous Seeds Revealed</div>
                                        <p className="text-blue-100/90">Use the values below to re-hash the combined seed (server + client + nonce) and confirm it matches the roll hash shown.</p>
                                    </div>
                                </div>
                                <div className="bg-[#0b0e14] border border-gray-800 rounded-xl p-4 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2 text-white font-semibold">
                                            <Info className="w-5 h-5 text-blue-400" />
                                            Last Roll Proof
                                        </div>
                                        <button
                                            onClick={handleCopyProof}
                                            disabled={!lastRoll}
                                            className="text-xs px-3 py-1.5 bg-[#131825] border border-gray-700 rounded-lg text-gray-200 hover:border-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            Copy Proof
                                        </button>
                                    </div>
                                    
                                    <div className="grid md:grid-cols-2 gap-3">
                                        <div>
                                            <div className="text-xs text-gray-500 mb-1">Revealed server seed</div>
                                            <div className="font-mono text-xs text-gray-300 bg-black/20 rounded p-2 break-all border border-gray-800">{serverSeed || 'Spin to reveal'}</div>
                                        </div>
                                        <div>
                                            <div className="text-xs text-gray-500 mb-1">Committed server hash</div>
                                            <div className="font-mono text-xs text-gray-300 bg-black/20 rounded p-2 break-all border border-gray-800">{serverSeedHash || 'Spin to reveal'}</div>
                                        </div>
                                    </div>

                                    {lastRoll ? (
                                        <div className="space-y-2 font-mono text-xs text-gray-300">
                                            <div className="flex items-center justify-between"><span className="text-gray-500">Outcome</span><span className="text-white">{lastRoll.outcome}</span></div>
                                            <div className="flex items-center justify-between"><span className="text-gray-500">Nonce</span><span>{lastRoll.nonce}</span></div>
                                            <div className="flex items-center justify-between"><span className="text-gray-500">Roll Value</span><span>{lastRoll.rollValue.toFixed(6)}</span></div>
                                            <div>
                                                <div className="text-gray-500">Roll Hash</div>
                                                <div className="break-all text-gray-200">{lastRoll.rollHash}</div>
                                            </div>
                                            <div>
                                                <div className="text-gray-500">Combined Seed (server:client:nonce)</div>
                                                <div className="break-all text-gray-400">{lastRoll.combinedSeed}</div>
                                            </div>
                                        </div>
                                    ) : (
                                        <p className="text-sm text-gray-500">Spin the case to generate verifiable proof data for your result.</p>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        )}
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
