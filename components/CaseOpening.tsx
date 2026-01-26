import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronLeft, Zap, Volume2, Info, Plus, X, ShieldCheck, RefreshCcw } from 'lucide-react';
import { GOLDEN_TICKET_ITEM } from '../constants';
import { CoinAmount } from './CoinAmount';
import { CaseItem, InventoryItem } from '../types';
import { useGame } from '../context/GameContext';
import { useSound } from '../context/SoundContext';
import { getRiskLabel } from '../utils/caseOdds';
import { getSellBackValue } from '../utils/sellBack';
import { auth } from '../firebase';

interface CaseOpeningProps {
  boxId: string;
  isFree?: boolean;
}

interface RollData {
  nonce: number;
  rollValue: number;
  serverSeedHash: string;
  clientSeed: string;
  outcome?: string;
}

interface RevealData {
  serverSeed: string;
  serverSeedHash: string;
  rotatedAt: number;
}

const CARD_WIDTH = 160;
const GAP_WIDTH = 16;
const ITEM_WIDTH = CARD_WIDTH + GAP_WIDTH;
const BUFFER_COUNT = 45; // Items before winner
const getRarityColor = (rarity: CaseItem['rarity']) => {
  switch (rarity) {
    case 'legendary':
      return '#facc15';
    case 'epic':
      return '#c084fc';
    case 'rare':
      return '#38bdf8';
    case 'uncommon':
      return '#4ade80';
    default:
      return '#9ca3af';
  }
};

export const CaseOpening: React.FC<CaseOpeningProps> = ({ boxId, isFree = false }) => {
  const { user, setView, boxes, isAuthenticated, setShowLoginModal, claimDaily, syncBalance, syncInventoryItem } = useGame();
  const { playSound } = useSound();
  
  const matchedBox = boxes.find(b => b.id === boxId);
  const box = matchedBox ?? boxes[0];

  useEffect(() => {
    if (boxes.length === 0) return;
    if (!matchedBox) {
      setView({ type: 'HOME' });
    }
  }, [boxes.length, matchedBox, setView]);

  const items = box?.items ?? [];
  const hasItems = items.length > 0;
  const sellBackRate = box?.isUserCreated ? 0.75 : 0.82;
  const isReady = Boolean(box) && hasItems;
  const isAdmin = Boolean(user?.isAdmin);

  // Sort items high to low for display purposes
  const displayItems = [...items].sort((a, b) => b.price - a.price);
  
  const [isSpinning, setIsSpinning] = useState(false);
  const [reelItems, setReelItems] = useState<CaseItem[]>([]);
  const [wonItem, setWonItem] = useState<CaseItem | null>(null);
  const [wonInventoryItem, setWonInventoryItem] = useState<InventoryItem | null>(null);
  const [showWinModal, setShowWinModal] = useState(false);
  const [sellOfferGenerated, setSellOfferGenerated] = useState(false);
  const [isGeneratingSellOffer, setIsGeneratingSellOffer] = useState(false);
  const [isDemoSpin, setIsDemoSpin] = useState(false);
  const [serverSeedHash, setServerSeedHash] = useState('');
  const [clientSeed, setClientSeed] = useState('lootx-player');
  const [nonce, setNonce] = useState(0);
  const [lastRoll, setLastRoll] = useState<RollData | null>(null);
  const [isGeneratingSeed, setIsGeneratingSeed] = useState(false);
  const [lastReveal, setLastReveal] = useState<RevealData | null>(null);
  const [isSeedSaving, setIsSeedSaving] = useState(false);
  const [seedSaveMessage, setSeedSaveMessage] = useState('');
  const [showFairModal, setShowFairModal] = useState(false);
  const [fairTab, setFairTab] = useState<'active' | 'verify'>('active');
  const [showFairTooltip, setShowFairTooltip] = useState(false);
  const [rewardResolved, setRewardResolved] = useState(false);
  
  // Gold Spin State
  const [isGoldMode, setIsGoldMode] = useState(false);
  
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const sellOfferTimerRef = useRef<number | null>(null);
  const canFreeSpin = !user.lastDailyClaim || (Date.now() - user.lastDailyClaim > 24 * 60 * 60 * 1000);

  const fetchProvablyFairState = useCallback(async () => {
    if (!auth.currentUser) return;
    const token = await auth.currentUser.getIdToken();
    const response = await fetch('/api/provably-fair', {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    if (!response.ok) {
      throw new Error('Failed to load provably fair state.');
    }
    const data = await response.json();
    setServerSeedHash(data.serverSeedHash ?? '');
    setClientSeed(data.clientSeed ?? 'lootx-player');
    setNonce(Number(data.nonce ?? 0));
  }, []);

  const rotateServerSeed = useCallback(async () => {
    if (!auth.currentUser) return;
    setIsGeneratingSeed(true);
    try {
      const token = await auth.currentUser.getIdToken();
      const response = await fetch('/api/provably-fair/rotate', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Unable to rotate server seed.');
      }

      const data = await response.json();
      if (data.revealed) {
        setLastReveal(data.revealed);
      }
      if (data.current) {
        setServerSeedHash(data.current.serverSeedHash ?? '');
        setClientSeed(data.current.clientSeed ?? 'lootx-player');
        setNonce(Number(data.current.nonce ?? 0));
      }
      setLastRoll(null);
    } finally {
      setIsGeneratingSeed(false);
    }
  }, []);

  const saveClientSeed = useCallback(async () => {
    if (!auth.currentUser) return;
    setIsSeedSaving(true);
    setSeedSaveMessage('');
    try {
      const token = await auth.currentUser.getIdToken();
      const response = await fetch('/api/provably-fair/client-seed', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ clientSeed })
      });

      if (!response.ok) {
        throw new Error('Unable to update client seed.');
      }

      const data = await response.json();
      setClientSeed(data.clientSeed ?? clientSeed);
      setNonce(Number(data.nonce ?? 0));
      setServerSeedHash(data.serverSeedHash ?? serverSeedHash);
      setSeedSaveMessage('Client seed updated (nonce reset).');
    } catch (error) {
      setSeedSaveMessage('Unable to save client seed.');
      console.error(error);
    } finally {
      setIsSeedSaving(false);
    }
  }, [clientSeed, serverSeedHash]);

  useEffect(() => {
    if (!isAuthenticated) {
      setServerSeedHash('');
      setClientSeed('lootx-player');
      setNonce(0);
      return;
    }

    fetchProvablyFairState().catch((error) => {
      console.error(error);
    });
  }, [fetchProvablyFairState, isAuthenticated]);

  useEffect(() => () => {
    if (sellOfferTimerRef.current) {
      window.clearTimeout(sellOfferTimerRef.current);
    }
  }, []);
  
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

  const generateReel = (target: CaseItem, pool: CaseItem[], sprinkleGold: boolean) => {
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

    if (sprinkleGold) {
      const goldInterval = 9;
      const goldOffset = Math.floor(Math.random() * goldInterval);
      for (let i = goldOffset; i < newReel.length; i += goldInterval) {
        if (i !== BUFFER_COUNT) {
          newReel[i] = GOLDEN_TICKET_ITEM;
        }
      }
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

  const handleSpin = async ({ isDemo = false, forceGold = false }: { isDemo?: boolean; forceGold?: boolean } = {}) => {
    if (isSpinning) return;
    if (!box || items.length === 0) return;

    if (forceGold) {
      isDemo = true;
    }

    if (isDemo) {
      setIsDemoSpin(true);
    } else {
      setIsDemoSpin(false);
    }

    if (!isDemo && isFree) {
      if (!isAuthenticated) {
        setShowLoginModal(true);
        return;
      }
      if (!canFreeSpin) {
        alert("Free case already claimed. Come back in 24 hours.");
        return;
      }
      claimDaily();
    }
    
    setIsSpinning(true);
    setShowWinModal(false);
    setIsGoldMode(false);
    setWonItem(null);
    setWonInventoryItem(null);
    setRewardResolved(false);
    setSellOfferGenerated(false);
    playSound('click');

    const legendaryPool = items.filter((item) => item.rarity === 'legendary');
    let winner: CaseItem | null = null;
    let triggerGold = false;

    if (isDemo) {
      const rollValue = Math.random();
      const demoWinner = getWinningItem(rollValue);
      winner = demoWinner;
      triggerGold = demoWinner.rarity === 'legendary' && (forceGold || Math.random() < 0.5);
    } else {
      try {
        if (!auth.currentUser) {
          throw new Error('Please sign in to open a case.');
        }

        // Server-side open handles coins, inventory, and prize selection.
        const token = await auth.currentUser.getIdToken();
        const response = await fetch('/api/open-case', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ caseId: box.id })
        });

        if (!response.ok) {
          const errorBody = await response.json().catch(() => ({}));
          throw new Error(errorBody.error || 'Unable to open case.');
        }

        const data = await response.json();
        const prizeId = data.prize?.id;
        const matchedPrize = items.find((item) => item.id === prizeId);
        const fallbackPrize = {
          id: data.prize?.id ?? `server-${Date.now()}`,
          name: data.prize?.name ?? 'Mystery Item',
          price: Number(data.prize?.value ?? data.prize?.price ?? 0),
          image: data.prize?.image ?? 'https://picsum.photos/200',
          rarity: data.prize?.rarity ?? 'common',
          chance: Number(data.prize?.weight ?? 0),
          color: getRarityColor(data.prize?.rarity ?? 'common')
        } as CaseItem;

        winner = matchedPrize ?? fallbackPrize;
        setLastRoll({
          nonce: Number(data.provablyFair?.nonce ?? 0),
          rollValue: Number(data.provablyFair?.roll ?? 0),
          serverSeedHash: data.provablyFair?.serverSeedHash ?? '',
          clientSeed: data.provablyFair?.clientSeed ?? ''
        });
        setServerSeedHash(data.provablyFair?.serverSeedHash ?? serverSeedHash);
        setClientSeed(data.provablyFair?.clientSeed ?? clientSeed);
        setNonce(Number(data.provablyFair?.nonce ?? 0) + 1);

        if (typeof data.newCoins === 'number') {
          syncBalance(data.newCoins);
        }

        if (data.inventoryId) {
          const inventoryItem: InventoryItem = {
            ...winner,
            instanceId: data.inventoryId,
            obtainedAt: Date.now(),
            status: 'available',
            provenance: { sourceType: 'case_open', sourceId: box.id }
          };
          syncInventoryItem(inventoryItem);
          setWonInventoryItem(inventoryItem);
        }
      } catch (error) {
        setIsSpinning(false);
        alert(error instanceof Error ? error.message : 'Unable to open case.');
        return;
      }
    }

    if (!winner) {
      setIsSpinning(false);
      return;
    }

    if (!isDemo) {
      setLastRoll((prev) =>
        prev
          ? { ...prev, outcome: winner?.name }
          : {
              nonce,
              rollValue: 0,
              serverSeedHash,
              clientSeed,
              outcome: winner?.name
            }
      );
    }

    if (triggerGold) {
        // --- GOLD SPIN FLOW ---
        
        // Stage 1: Spin to Golden Ticket
        // Note: We use global items pool for buffer if box items are too few, or just box items. 
        // Ideally Golden Ticket should come from box items if possible, but Golden Ticket is special.
        const ticketReel = generateReel(GOLDEN_TICKET_ITEM, items, true);
        setReelItems(ticketReel);
        
        animateSpin(4500, () => {
            // Stage 1 Complete: Activate Gold Mode
            playSound('gold-mode');
            setIsGoldMode(true);
            
            // Wait a moment to see the ticket
            setTimeout(() => {
                // Stage 2: Spin to Actual Winner (using only legendary items in reel)
                const pool = legendaryPool.length > 0 ? legendaryPool : items;
                const goldReel = generateReel(winner, pool, true);
                setReelItems(goldReel);
                
                animateSpin(4000, () => {
                    // Stage 2 Complete
                    finishSpin(winner);
                });
            }, 1000);
        });

    } else {
        // --- NORMAL SPIN FLOW ---
        const normalReel = generateReel(winner, items, true);
        setReelItems(normalReel);
        
        animateSpin(5000, () => {
            finishSpin(winner);
        });
    }
  };

  const handleTryFree = () => {
    handleSpin({ isDemo: true });
  };

  const finishSpin = (item: CaseItem) => {
    setIsSpinning(false);
    setShowWinModal(true);
    setWonItem(item);
    setRewardResolved(false);
    
    // Play appropriate win sound
    if (item.rarity === 'legendary') playSound('win-gold');
    else if (item.rarity === 'epic' || item.rarity === 'rare') playSound('win-rare');
    else playSound('win-common');
  };

  const closeWinModal = () => {
    if (sellOfferTimerRef.current) {
      window.clearTimeout(sellOfferTimerRef.current);
      sellOfferTimerRef.current = null;
    }
    setIsGeneratingSellOffer(false);
    if (!rewardResolved) {
      setRewardResolved(true);
    }
    setShowWinModal(false);
    setWonInventoryItem(null);
    setSellOfferGenerated(false);
  };

  const handleSell = () => {
    playSound('click');
    if (isDemoSpin || isGeneratingSellOffer) {
        if (isDemoSpin) {
          setShowWinModal(false);
        }
        return;
    }
    if (!sellOfferGenerated) {
        setIsGeneratingSellOffer(true);
        sellOfferTimerRef.current = window.setTimeout(() => {
          setSellOfferGenerated(true);
          setIsGeneratingSellOffer(false);
          sellOfferTimerRef.current = null;
        }, 900);
        return;
    }
    if (wonInventoryItem && !rewardResolved) {
        // Server-side sell flow should be handled via secure endpoints.
        setRewardResolved(true);
        alert('Sell requests are handled server-side. Please use the inventory screen.');
    }
    if (sellOfferTimerRef.current) {
      window.clearTimeout(sellOfferTimerRef.current);
      sellOfferTimerRef.current = null;
    }
    setShowWinModal(false);
    setWonInventoryItem(null);
    setSellOfferGenerated(false);
    setIsGeneratingSellOffer(false);
  };

  const handleKeep = () => {
      playSound('click');
      if (sellOfferTimerRef.current) {
        window.clearTimeout(sellOfferTimerRef.current);
        sellOfferTimerRef.current = null;
      }
      if (wonItem && !rewardResolved) {
        setRewardResolved(true);
      }
      setShowWinModal(false);
      setWonInventoryItem(null);
      setSellOfferGenerated(false);
      setIsGeneratingSellOffer(false);
  };

  const handleCopyProof = useCallback(async () => {
    playSound('click');
    
    if (!lastRoll) return;

    const proof = [
      `Server Seed: ${lastReveal?.serverSeed ?? 'Rotate to reveal'}`,
      `Server Seed Hash: ${lastRoll.serverSeedHash}`,
      `Client Seed: ${lastRoll.clientSeed}`,
      `Nonce: ${lastRoll.nonce}`,
      `Roll Value: ${lastRoll.rollValue}`,
      `Outcome: ${lastRoll.outcome ?? 'N/A'}`
    ].join('\n');

    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(proof);
      alert('Provably fair proof copied to clipboard.');
    } else {
      alert(proof);
    }
  }, [lastReveal?.serverSeed, lastRoll, playSound]);

  return (
    <div className="w-full max-w-7xl mx-auto p-4 sm:p-6 animate-in fade-in zoom-in-95 duration-300">
      {!isReady ? (
        <div className="min-h-[60vh] flex items-center justify-center px-4">
          <div className="text-center max-w-sm">
            <p className="text-white text-lg font-semibold">Loading case...</p>
            <p className="text-gray-400 text-sm mt-2">We&apos;re syncing the drops and odds for this case.</p>
          </div>
        </div>
      ) : (
        <>
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
                    <h2 className="text-2xl font-bold text-white">{box!.name}</h2>
                    {isFree && <span className="bg-yellow-500 text-black text-xs font-bold px-2 py-0.5 rounded">FREE SPIN</span>}
                    <span className="bg-[#131825] text-gray-300 text-xs font-semibold px-2 py-0.5 rounded border border-gray-700">
                      {getRiskLabel(box!.riskLevel ?? 50)}
                    </span>
                </div>
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
            <div className="bg-[#0b0e14] p-4 flex flex-col sm:flex-row items-center justify-center gap-3 border-t border-gray-800 relative z-20">
                 <button 
                    onClick={() => handleSpin()}
                    disabled={isSpinning || isGeneratingSeed}
                    className={`w-full sm:w-auto min-w-[200px] px-8 py-3 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-lg shadow-lg transition-all active:scale-95 flex flex-col items-center leading-tight ${isGoldMode ? 'bg-yellow-500 hover:bg-yellow-400 shadow-yellow-500/20 text-black' : (isFree ? 'bg-green-500 hover:bg-green-400 shadow-green-500/20 text-black' : 'bg-blue-600 hover:bg-blue-500 shadow-blue-600/20')}`}
                >
                    <span>
                      {isGeneratingSeed ? (
                        'Preparing seed...'
                      ) : isSpinning ? (
                        'Spinning...'
                      ) : isFree ? (
                        'Free Spin'
                      ) : (
                        <span className="inline-flex items-center gap-2">
                          Open for
                          <CoinAmount
                            amount={box!.price}
                            formatOptions={{ maximumFractionDigits: 0 }}
                            className="text-white"
                            iconClassName="w-4 h-4"
                          />
                        </span>
                      )}
                    </span>
                 </button>
                 {!isFree && (
                   <button
                     onClick={handleTryFree}
                     disabled={isSpinning || isGeneratingSeed}
                     className="w-full sm:w-auto min-w-[200px] px-8 py-3 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-lg shadow-lg transition-all active:scale-95 bg-emerald-500 hover:bg-emerald-400 shadow-emerald-500/20 flex flex-col items-center leading-tight"
                   >
                     <span>Try for Free</span>
                   </button>
                 )}
                 {isAdmin && (
                   <button
                     onClick={() => handleSpin({ isDemo: true, forceGold: true })}
                     disabled={isSpinning || isGeneratingSeed}
                     className="w-full sm:w-auto min-w-[200px] px-8 py-3 disabled:opacity-50 disabled:cursor-not-allowed text-black font-bold rounded-lg shadow-lg transition-all active:scale-95 bg-yellow-400 hover:bg-yellow-300 shadow-yellow-500/20 flex flex-col items-center leading-tight"
                   >
                     <span>Test Gold Spin</span>
                   </button>
                 )}
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
                                                onClick={async () => { playSound('click'); await rotateServerSeed(); }}
                                                disabled={isGeneratingSeed || isSpinning}
                                                className="text-xs px-3 py-1.5 bg-[#131825] border border-gray-700 rounded-lg text-gray-200 hover:border-yellow-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                {isGeneratingSeed ? 'Rotating...' : 'Rotate Seed'}
                                            </button>
                                        </div>
                                        <div className="space-y-2">
                                            <div>
                                                <div className="text-xs text-gray-500 mb-1">Server seed hash (committed)</div>
                                                <div className="font-mono text-xs text-white bg-black/30 rounded p-2 break-all border border-gray-800">{serverSeedHash || 'Loading...'}</div>
                                            </div>
                                            <div>
                                                <div className="text-xs text-gray-500 mb-1">Last revealed server seed</div>
                                                <div className="font-mono text-xs text-gray-300 bg-black/20 rounded p-2 break-all border border-gray-800">
                                                  {lastReveal?.serverSeed || 'Rotate to reveal'}
                                                </div>
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
                                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                                            <input 
                                                value={clientSeed}
                                                onChange={(e) => setClientSeed(e.target.value)}
                                                className="w-full bg-[#0b0e14] border border-gray-800 rounded-lg px-3 py-2 text-sm text-white focus:border-cyan-400 focus:outline-none"
                                                placeholder="Enter your own client seed"
                                                disabled={isSpinning || isSeedSaving}
                                                maxLength={64}
                                            />
                                            <button
                                                onClick={async () => { playSound('click'); await saveClientSeed(); }}
                                                disabled={isSpinning || isSeedSaving}
                                                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg border border-gray-700 bg-[#131825] text-gray-200 hover:border-cyan-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                <RefreshCcw className="w-3.5 h-3.5" />
                                                Save
                                            </button>
                                        </div>
                                        {seedSaveMessage && (
                                            <div className="text-[11px] text-gray-400 mt-2">{seedSaveMessage}</div>
                                        )}
                                        <p className="text-xs text-gray-500 mt-3 leading-relaxed">
                                            Each roll combines the hashed server seed, your client seed, and the nonce on the server. Updating the client seed resets the nonce to 0.
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
                                        <p className="text-blue-100/90">Use the values below with the revealed server seed to recompute the HMAC roll and verify the outcome.</p>
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
                                            <div className="font-mono text-xs text-gray-300 bg-black/20 rounded p-2 break-all border border-gray-800">{lastReveal?.serverSeed || 'Rotate to reveal'}</div>
                                        </div>
                                        <div>
                                            <div className="text-xs text-gray-500 mb-1">Committed server hash</div>
                                            <div className="font-mono text-xs text-gray-300 bg-black/20 rounded p-2 break-all border border-gray-800">{lastRoll?.serverSeedHash || serverSeedHash || 'Spin to reveal'}</div>
                                        </div>
                                    </div>

                                    {lastRoll ? (
                                        <div className="space-y-2 font-mono text-xs text-gray-300">
                                            <div className="flex items-center justify-between"><span className="text-gray-500">Outcome</span><span className="text-white">{lastRoll.outcome}</span></div>
                                            <div className="flex items-center justify-between"><span className="text-gray-500">Nonce</span><span>{lastRoll.nonce}</span></div>
                                            <div className="flex items-center justify-between"><span className="text-gray-500">Roll Value</span><span>{lastRoll.rollValue.toFixed(6)}</span></div>
                                            <div className="flex items-center justify-between"><span className="text-gray-500">Client Seed</span><span>{lastRoll.clientSeed}</span></div>
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
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
                <div className="absolute inset-0 bg-black/80 backdrop-blur-md animate-in fade-in duration-200" onClick={closeWinModal}></div>
                <div className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-[#151a23] via-[#111722] to-[#0b0f18] shadow-[0_30px_80px_-40px_rgba(0,0,0,0.9)] animate-in zoom-in-95 duration-300">
                     <div className="absolute inset-0 opacity-60" style={{ background: `radial-gradient(circle at top, ${wonItem.color}22, transparent 60%)` }}></div>
                     <button onClick={closeWinModal} className="absolute right-4 top-4 rounded-full border border-white/10 bg-black/30 p-2 text-gray-300 transition hover:border-white/30 hover:text-white">
                        <X className="w-4 h-4" />
                     </button>

                     <div className="relative flex flex-col items-center px-5 pb-6 pt-10 sm:px-8 sm:pb-8">
                        <div className="flex flex-col items-center gap-2 text-center">
                            <div className="text-xs uppercase tracking-[0.3em] text-gray-400">Case result</div>
                            <div className="text-2xl sm:text-3xl font-black text-white uppercase tracking-wider">You Won</div>
                            {isDemoSpin && (
                                <div className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-200">
                                    Demo spin — rewards not granted
                                </div>
                            )}
                        </div>

                        <div className={`relative mt-6 flex h-52 w-52 items-center justify-center sm:h-60 sm:w-60 ${isDemoSpin ? 'mb-4' : 'mb-6'}`}>
                            <div className="absolute inset-0 rounded-full border border-white/10 bg-white/5"></div>
                            <div className="absolute inset-6 rounded-full blur-3xl opacity-50" style={{ backgroundColor: wonItem.color }}></div>
                            <div className="absolute inset-4 rounded-full bg-gradient-to-br from-white/10 to-transparent"></div>
                            <img src={wonItem.image} alt={wonItem.name} className="relative z-10 h-36 w-36 object-contain drop-shadow-2xl sm:h-44 sm:w-44" />
                        </div>

                        <div className={`w-full text-center ${isDemoSpin ? 'mb-6' : 'mb-7'}`}>
                            <h3 className="text-xl sm:text-2xl font-bold text-white">{wonItem.name}</h3>
                            <CoinAmount
                              amount={wonItem.price}
                              formatOptions={{ maximumFractionDigits: 0 }}
                              className="mt-2 text-gray-300 font-semibold justify-center"
                              iconClassName="w-4 h-4"
                            />
                        </div>

                        {isDemoSpin ? (
                            <button onClick={closeWinModal} className="w-full rounded-xl border border-white/10 bg-white/5 py-3 text-sm font-semibold text-gray-200 transition hover:border-white/20 hover:bg-white/10">
                                Close
                            </button>
                        ) : (
                            <div className="flex w-full flex-col gap-3 sm:flex-row">
                                <button
                                  onClick={handleSell}
                                  disabled={isGeneratingSellOffer}
                                  className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-gray-200 transition hover:border-white/20 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-80"
                                >
                                    <span className="flex flex-col items-center justify-center gap-1">
                                      <span className="flex items-center justify-center gap-2 text-[11px] uppercase tracking-wide text-gray-400">
                                        {isGeneratingSellOffer && (
                                          <span className="h-3 w-3 animate-spin rounded-full border border-gray-400/60 border-t-transparent" aria-hidden="true" />
                                        )}
                                        {isGeneratingSellOffer
                                          ? 'Generating offer...'
                                          : sellOfferGenerated
                                            ? 'Accept buy back offer'
                                            : 'Generate buy back offer'}
                                      </span>
                                      {sellOfferGenerated && !isGeneratingSellOffer && (
                                        <CoinAmount
                                          amount={getSellBackValue(wonItem.price, sellBackRate)}
                                          formatOptions={{ maximumFractionDigits: 0 }}
                                          className="text-gray-200"
                                          iconClassName="w-4 h-4"
                                        />
                                      )}
                                    </span>
                                </button>
                                <button onClick={handleKeep} className="flex-1 rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 py-3 text-sm font-bold text-white shadow-lg shadow-blue-600/30 transition hover:from-blue-500 hover:to-blue-400">
                                    Keep Item
                                </button>
                            </div>
                        )}
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
                            <CoinAmount
                              amount={item.price}
                              formatOptions={{ maximumFractionDigits: 0 }}
                              className="text-white font-bold text-sm"
                              iconClassName="w-3.5 h-3.5"
                            />
                        </div>

                        <div 
                            className="absolute bottom-0 left-0 right-0 h-[2px] rounded-b-xl opacity-50 group-hover:opacity-100 transition-opacity"
                            style={{ backgroundColor: item.color, boxShadow: `0 0 8px ${item.color}` }}
                        ></div>
                    </div>
                ))}
            </div>
        </div>
        </>
      )}
    </div>
  );
};
