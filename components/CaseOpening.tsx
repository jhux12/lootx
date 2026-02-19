import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronLeft, Volume2, VolumeX, Info, X, ShieldCheck, Gamepad2, Check, PackageOpen, Wallet, Copy } from 'lucide-react';
import { GOLDEN_TICKET_ITEM, XP_ICON } from '../constants';
import { CoinAmount } from './CoinAmount';
import { CaseItem, InventoryItem } from '../types';
import { useGame } from '../context/GameContext';
import { useSound } from '../context/SoundContext';
import { Input } from './ui/Input';
import { getRiskLabel } from '../utils/caseOdds';
import { getSellBackValue } from '../utils/sellBack';
import { authedFetch } from '../utils/authedFetch';
import { PRICE_UNIT_MODE, toCoins } from '../utils/coins';
import { ProvablyFairMiniModal } from './ProvablyFairMiniModal';

interface CaseOpeningProps {
  boxId: string;
  isFree?: boolean;
}

interface RollData {
  nonce: number;
  rollHash: string;
  rollValue: number;
  message: string;
  boxId: string;
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

const LAST_ROLL_STORAGE_KEY = 'pullz:last-provably-fair-roll';
const LAST_REVEAL_STORAGE_KEY = 'pullz:last-provably-fair-reveal';


export const CaseOpening: React.FC<CaseOpeningProps> = ({ boxId, isFree = false }) => {
  const {
    user,
    balance,
    authInitialized,
    showTopUpModal,
    setShowTopUpModal,
    setTopUpModalIntent,
    addInventoryItemFromServer,
    syncBalance,
    sellItem,
    setView,
    boxes,
    bonusSettings,
    isAuthenticated,
    openAuthModal,
    claimDaily,
    registerSpend
  } = useGame();
  const { muted, toggleMute, playSound } = useSound();
  
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
  const rawSellBackRate = Number(
    box?.sellBackRate ?? (box?.isUserCreated ? 0.75 : 0.82)
  );
  const sellBackRate = isFree
    ? 1
    : (Number.isFinite(rawSellBackRate)
      ? Math.min(1, Math.max(0, rawSellBackRate))
      : 0.82);
  const isReady = Boolean(box) && hasItems;
  const isAdmin = Boolean(user?.isAdmin);

  // Sort items high to low for display purposes
  const displayItems = [...items].sort(
    (a, b) => toCoins(b.price, PRICE_UNIT_MODE) - toCoins(a.price, PRICE_UNIT_MODE)
  );
  
  const [isSpinning, setIsSpinning] = useState(false);
  const [reelItems, setReelItems] = useState<CaseItem[]>([]);
  const [wonItem, setWonItem] = useState<CaseItem | null>(null);
  const [wonInventoryItem, setWonInventoryItem] = useState<InventoryItem | null>(null);
  const [showWinModal, setShowWinModal] = useState(false);
  const [sellOfferGenerated, setSellOfferGenerated] = useState(false);
  const [isGeneratingSellOffer, setIsGeneratingSellOffer] = useState(false);
  const [isSellingItem, setIsSellingItem] = useState(false);
  const [isDemoSpin, setIsDemoSpin] = useState(false);
  const [serverSeedHash, setServerSeedHash] = useState('');
  const [clientSeed, setClientSeed] = useState('lootx-player');
  const [clientSeedInput, setClientSeedInput] = useState('lootx-player');
  const [nonce, setNonce] = useState(0);
  const [lastRoll, setLastRoll] = useState<RollData | null>(null);
  const [lastReveal, setLastReveal] = useState<RevealData | null>(null);
  const [isSyncingFair, setIsSyncingFair] = useState(false);
  const [isUpdatingClientSeed, setIsUpdatingClientSeed] = useState(false);
  const [isRotatingSeed, setIsRotatingSeed] = useState(false);
  const [showFairModal, setShowFairModal] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [copyStatusMessage, setCopyStatusMessage] = useState<string | null>(null);
  const [rewardResolved, setRewardResolved] = useState(false);
  const [selectedCaseItem, setSelectedCaseItem] = useState<CaseItem | null>(null);
  const [spinFeedbackMessage, setSpinFeedbackMessage] = useState<string | null>(null);
  
  // Gold Spin State
  const [isGoldMode, setIsGoldMode] = useState(false);
  const [isBoxPreviewVisible, setIsBoxPreviewVisible] = useState(true);
  const [isBoxPreviewFading, setIsBoxPreviewFading] = useState(false);
  
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const itemModalRef = useRef<HTMLDivElement>(null);
  const itemModalCloseRef = useRef<HTMLButtonElement>(null);
  const lastFocusedElementRef = useRef<HTMLElement | null>(null);
  const bodyOverflowRef = useRef<string>('');
  const sellOfferTimerRef = useRef<number | null>(null);
  const topUpTriggerLockRef = useRef(false);
  const canFreeSpin = !user.lastDailyClaim || (Date.now() - user.lastDailyClaim > 24 * 60 * 60 * 1000);
  const caseCurrencyType = box?.currencyType === 'XP' ? 'XP' : 'COIN';
  const currentCasePrice = box ? toCoins(box.price, PRICE_UNIT_MODE) : NaN;
  const currentCaseXpPrice = Math.max(0, Math.floor(Number(box?.priceXP ?? 0)));
  const xpPer100Coins = Math.max(0, Number(bonusSettings?.xpPer100Coins ?? bonusSettings?.xpPer100CoinsWagered ?? 0));
  const xpPerCaseOpened = Math.max(0, Number(bonusSettings?.xpPerCaseOpened ?? bonusSettings?.xpPerCaseOpen ?? 0));
  const xpPreviewCoinsSpent = caseCurrencyType === 'COIN' ? Math.max(0, Number(box?.price ?? 0)) : 0;
  const previewXpFromSpend = Math.floor((xpPreviewCoinsSpent / 100) * xpPer100Coins);
  const previewXpFromOpen = isFree ? 0 : xpPerCaseOpened;
  const previewTotalXp = Math.max(0, previewXpFromSpend + previewXpFromOpen);
  const currentXpBalance = Math.max(0, Math.floor(Number(user.xpBalance ?? user.xp ?? 0)));
  const isBalanceLoading = isAuthenticated && !authInitialized;

  const handleCopyPageLink = useCallback(async () => {
    if (typeof window === 'undefined') return;

    const url = window.location.href;

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = url;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }

      setCopyStatusMessage('Page link copied.');
      playSound('success');
    } catch (error) {
      console.error('Failed to copy case link', error);
      setCopyStatusMessage('Could not copy link.');
      playSound('error');
    }

    window.setTimeout(() => setCopyStatusMessage(null), 2500);
  }, [playSound]);

  const loadProvablyFairState = useCallback(async () => {
    if (!isAuthenticated) return;
    setIsSyncingFair(true);
    try {
      const data = await authedFetch<{ serverSeedHash: string; clientSeed: string; nonce: number }>('/api/provably-fair');
      setServerSeedHash(data.serverSeedHash);
      setClientSeed(data.clientSeed);
      setClientSeedInput(data.clientSeed);
      setNonce(data.nonce);
    } catch (error) {
      console.error('Failed to load provably fair state', error);
    } finally {
      setIsSyncingFair(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    loadProvablyFairState();
  }, [loadProvablyFairState]);

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

  useEffect(() => {
    if (!selectedCaseItem) return;

    lastFocusedElementRef.current = document.activeElement as HTMLElement | null;
    bodyOverflowRef.current = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const focusableSelectors = [
      'button',
      '[href]',
      'input',
      'select',
      'textarea',
      '[tabindex]:not([tabindex="-1"])',
    ].join(',');

    const focusFirstElement = () => {
      const focusable = itemModalRef.current?.querySelectorAll<HTMLElement>(focusableSelectors);
      const firstFocusable = focusable && focusable.length > 0 ? focusable[0] : itemModalCloseRef.current;
      firstFocusable?.focus();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setSelectedCaseItem(null);
        return;
      }

      if (event.key !== 'Tab') return;
      const focusable = itemModalRef.current?.querySelectorAll<HTMLElement>(focusableSelectors);
      if (!focusable || focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const isShift = event.shiftKey;
      const activeElement = document.activeElement as HTMLElement | null;

      if (isShift && activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!isShift && activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    const focusTimer = window.setTimeout(focusFirstElement, 0);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      window.clearTimeout(focusTimer);
      document.body.style.overflow = bodyOverflowRef.current;
      document.removeEventListener('keydown', handleKeyDown);
      lastFocusedElementRef.current?.focus();
    };
  }, [selectedCaseItem]);

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

  const updateClientSeed = useCallback(async () => {
    const nextSeed = clientSeedInput.trim();
    if (!isAuthenticated) {
      openAuthModal('login');
      return;
    }
    if (nextSeed.length < 1 || nextSeed.length > 64) {
      alert('Client seed must be between 1 and 64 characters.');
      return;
    }

    setIsUpdatingClientSeed(true);
    try {
      const data = await authedFetch<{ serverSeedHash: string; clientSeed: string; nonce: number }>(
        '/api/provably-fair/client-seed',
        {
          method: 'POST',
          body: JSON.stringify({ clientSeed: nextSeed })
        }
      );
      setServerSeedHash(data.serverSeedHash);
      setClientSeed(data.clientSeed);
      setClientSeedInput(data.clientSeed);
      setNonce(data.nonce);
      setLastRoll(null);
    } catch (error) {
      console.error('Failed to update client seed', error);
      alert('Unable to update client seed. Please try again.');
    } finally {
      setIsUpdatingClientSeed(false);
    }
  }, [clientSeedInput, isAuthenticated, openAuthModal]);

  const rotateServerSeed = useCallback(async () => {
    if (!isAuthenticated) {
      openAuthModal('login');
      return;
    }

    setIsRotatingSeed(true);
    try {
      const data = await authedFetch<{
        revealed: RevealData;
        current: { serverSeedHash: string; clientSeed: string; nonce: number };
      }>('/api/provably-fair/rotate', { method: 'POST' });

      setLastReveal(data.revealed);
      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem(LAST_REVEAL_STORAGE_KEY, JSON.stringify(data.revealed));
      }
      setServerSeedHash(data.current.serverSeedHash);
      setClientSeed(data.current.clientSeed);
      setClientSeedInput(data.current.clientSeed);
      setNonce(data.current.nonce);
      setLastRoll(null);
    } catch (error) {
      console.error('Failed to rotate server seed', error);
      alert('Unable to rotate server seed. Please try again.');
    } finally {
      setIsRotatingSeed(false);
    }
  }, [isAuthenticated, openAuthModal]);

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

    setSpinFeedbackMessage(null);

    if (forceGold) {
      isDemo = true;
    }

    if (isDemo) {
      setIsDemoSpin(true);
    } else {
      setIsDemoSpin(false);
    }

    if (!isDemo && !isAuthenticated) {
      openAuthModal('login');
      return;
    }

    if (!isDemo && !isFree) {
      if (isBalanceLoading) {
        return;
      }

      if (caseCurrencyType === 'XP') {
        if (currentCaseXpPrice <= 0 || currentXpBalance < currentCaseXpPrice) {
          setSpinFeedbackMessage('Not enough XP to open this box.');
          return;
        }
      } else {
        if (!Number.isFinite(currentCasePrice) || currentCasePrice <= 0) {
          return;
        }

        const availableCoins = Number.isFinite(balance) ? balance : Number(user.balance ?? 0);
        if (!Number.isFinite(availableCoins)) {
          return;
        }

        if (availableCoins < currentCasePrice) {
          setSpinFeedbackMessage('Not enough coins — top up to open this box.');

          if (!showTopUpModal && !topUpTriggerLockRef.current) {
            topUpTriggerLockRef.current = true;
            setTopUpModalIntent({
              reason: 'insufficient_balance',
              requiredCoins: currentCasePrice,
              currentBalance: availableCoins,
              missingCoins: currentCasePrice - availableCoins
            });
            setShowTopUpModal(true);
            window.setTimeout(() => {
              topUpTriggerLockRef.current = false;
            }, 350);
          }
          return;
        }
      }
    }

    if (!isDemo && isFree) {
      if (!isAuthenticated) {
        openAuthModal('login');
        return;
      }
      if (!canFreeSpin) {
        alert("Free case already claimed. Come back in 24 hours.");
        return;
      }
      claimDaily();
    }

    if (isBoxPreviewVisible) {
      setIsBoxPreviewFading(true);
      await new Promise((resolve) => window.setTimeout(resolve, 450));
      setIsBoxPreviewVisible(false);
      setIsBoxPreviewFading(false);
    }
    
    setIsSpinning(true);
    setShowWinModal(false);
    setIsGoldMode(false);
    setWonItem(null);
    setWonInventoryItem(null);
    setRewardResolved(false);
    setSellOfferGenerated(false);
    playSound('click');
    
    let winner: CaseItem;
    let rollValue = Math.random();
    let rollHash = '';
    let rollMessage = '';
    let rollNonce = nonce;
    let rollServerHash = serverSeedHash;
    let rollClientSeed = clientSeed;

    if (isDemo) {
      winner = getWinningItem(rollValue);
    } else {
      try {
        // Server now authoritatively selects the prize + updates coins/inventory.
        const operationId = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

        const data = await authedFetch<{
          ok: boolean;
          price: number;
          prize: CaseItem & { price?: number; size?: string };
          xpAwarded?: number;
          xpSettingsUsed?: {
            xpPer100?: number;
            xpPerOpen?: number;
            baseXpBonus?: number;
            xpMultiplier?: number;
            enabled?: boolean;
          };
          newCoinBalance?: number;
          newCoins?: number;
          newXpBalance?: number;
          currencyType?: 'COIN' | 'XP';
          inventoryId: string;
          openId: string;
          sellBackRate?: number;
          provablyFair: {
            serverSeedHash: string;
            clientSeed: string;
            nonce: number;
            roll: number;
            rollHash: string;
            message: string;
          };
        }>('/api/open-case', {
          method: 'POST',
          body: JSON.stringify({ boxId: box.id, isFree, operationId })
        });

        const matchedPrize = items.find((item) => item.id === data.prize.id || item.name === data.prize.name);
        const fallbackPrice = Number(
          (data.prize as { value?: number }).value ?? data.prize.price ?? 0
        );
        const resolvedRedeemable = data.prize.redeemable ?? matchedPrize?.redeemable ?? true;
        winner = matchedPrize
          ? { ...matchedPrize, redeemable: resolvedRedeemable, price: matchedPrize.price ?? fallbackPrice, size: data.prize.size }
          : {
              ...data.prize,
              price: fallbackPrice,
              chance: 0,
              color: '#9ca3af',
              redeemable: resolvedRedeemable,
              size: data.prize.size
            };

        const inventoryItem: InventoryItem = {
          ...(winner as CaseItem),
          instanceId: data.inventoryId,
          obtainedAt: Date.now(),
          status: 'available',
          size: data.prize.size,
          provenance: { sourceType: 'case_open', sourceId: box.id },
          sellBackRate: data.sellBackRate
        };

        addInventoryItemFromServer(inventoryItem);
        if ((data.currencyType ?? 'COIN') === 'COIN') {
          syncBalance(Number(data.newCoinBalance ?? data.newCoins ?? 0));
          if (!isFree) {
            const spentAmount = toCoins(Number(data.price ?? box?.price ?? 0), PRICE_UNIT_MODE);
            registerSpend(spentAmount);
          }
        }
        console.info('Case-open XP debug', {
          caseId: box.id,
          xpAwarded: Number(data.xpAwarded ?? 0),
          newXpBalance: Number(data.newXpBalance ?? 0),
          currencyType: data.currencyType ?? 'COIN',
          xpSettingsUsed: data.xpSettingsUsed ?? null
        });
        setWonInventoryItem(inventoryItem);
        rollValue = data.provablyFair.roll;
        rollHash = data.provablyFair.rollHash;
        rollMessage = data.provablyFair.message;
        rollNonce = data.provablyFair.nonce;
        rollServerHash = data.provablyFair.serverSeedHash;
        rollClientSeed = data.provablyFair.clientSeed;

        setServerSeedHash(data.provablyFair.serverSeedHash);
        setClientSeed(data.provablyFair.clientSeed);
        setClientSeedInput(data.provablyFair.clientSeed);
        setNonce(data.provablyFair.nonce + 1);
      } catch (error) {
        const status = typeof (error as { status?: unknown })?.status === 'number'
          ? (error as { status: number }).status
          : 'unknown';
        const rawMessage = error instanceof Error ? error.message : 'OPEN_FAILED: Unable to open case.';
        const readableMessage = rawMessage.includes(':') ? rawMessage.split(':').slice(1).join(':').trim() : rawMessage;
        const errorCode = rawMessage.includes(':') ? rawMessage.split(':')[0] : 'OPEN_FAILED';

        console.error('Failed to open case', {
          status,
          code: errorCode,
          message: readableMessage,
          boxId: box.id
        });
        setIsSpinning(false);
        setIsBoxPreviewVisible(true);
        setIsBoxPreviewFading(false);
        setSpinFeedbackMessage(readableMessage || 'Unable to open case.');
        alert(readableMessage || 'Unable to open case.');
        return;
      }
    }

    const legendaryPool = items.filter((item) => item.rarity === 'legendary');
    if (forceGold && legendaryPool.length > 0) {
      winner = legendaryPool[Math.floor(rollValue * legendaryPool.length)];
    }

    if (!isDemo) {
      const latestRoll = {
        nonce: rollNonce,
        rollHash,
        rollValue,
        message: rollMessage,
        boxId: box.id,
        serverSeedHash: rollServerHash,
        clientSeed: rollClientSeed,
        outcome: winner.name
      };
      setLastRoll(latestRoll);
      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem(LAST_ROLL_STORAGE_KEY, JSON.stringify(latestRoll));
      }
    } else {
      setLastRoll(null);
    }

    // 2. Gold spin only triggers when the winner is guaranteed legendary
    const isGoldEligible = winner.rarity === 'legendary';
    const goldRollHash = rollHash ? await hashString(`${rollHash}:gold`) : await hashString(`${rollValue}:gold`);
    const goldRollValue = deriveRollValue(goldRollHash);
    const triggerGold = (forceGold && isGoldEligible) || (isGoldEligible && goldRollValue < 0.5);

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
    setSpinFeedbackMessage(null);
    handleSpin({ isDemo: true });
  };

  useEffect(() => {
    if (spinFeedbackMessage && showTopUpModal) {
      topUpTriggerLockRef.current = false;
    }
  }, [showTopUpModal, spinFeedbackMessage]);

  useEffect(() => {
    setIsBoxPreviewVisible(true);
    setIsBoxPreviewFading(false);
  }, [boxId]);

  const finishSpin = (item: CaseItem) => {
    setIsSpinning(false);
    setIsBoxPreviewVisible(true);
    setIsBoxPreviewFading(false);

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
    setIsSellingItem(false);
    if (!rewardResolved) {
      setRewardResolved(true);
    }
    setShowWinModal(false);
    setWonInventoryItem(null);
    setSellOfferGenerated(false);
  };

  const handleSell = async () => {
    playSound('click');
    if (wonItem?.redeemable === false) {
        alert('This item is not redeemable and cannot be sold back.');
        return;
    }
    if (isDemoSpin || isGeneratingSellOffer || isSellingItem) {
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
        setIsSellingItem(true);
        try {
          await sellItem(wonInventoryItem.instanceId);
          setRewardResolved(true);
        } finally {
          setIsSellingItem(false);
        }
    }
    if (sellOfferTimerRef.current) {
      window.clearTimeout(sellOfferTimerRef.current);
      sellOfferTimerRef.current = null;
    }
    setShowWinModal(false);
    setWonInventoryItem(null);
    setSellOfferGenerated(false);
    setIsGeneratingSellOffer(false);
    setIsSellingItem(false);
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
      setIsSellingItem(false);
  };

  const handleCopyProof = useCallback(async () => {
    playSound('click');
    
    if (!lastRoll) return;

    const proof = [
      `Server Seed (revealed): ${lastReveal?.serverSeed ?? 'Not revealed yet'}`,
      `Server Seed Hash (committed): ${lastRoll.serverSeedHash}`,
      `Client Seed: ${lastRoll.clientSeed}`,
      `Nonce: ${lastRoll.nonce}`,
      `Box ID: ${lastRoll.boxId}`,
      `HMAC Message (clientSeed:nonce:boxId): ${lastRoll.message}`,
      `Roll Hash (HMAC): ${lastRoll.rollHash}`,
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
                    onClick={() => { playSound('click'); setView({ type: 'BOXES' }); }}
                    className="min-h-11 flex items-center gap-2 px-3 py-1.5 bg-[#131825] rounded text-gray-400 hover:text-white text-sm font-medium transition-colors"
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

            <div className="relative z-20 flex justify-end px-2 pt-2 sm:px-3 sm:pt-3">
              <div>
                <div className="flex items-center gap-1 rounded-xl border border-white/20 bg-black/55 p-1 shadow-xl backdrop-blur-sm">
                  <button
                    type="button"
                    onClick={() => {
                      playSound('click');
                      setShowFairModal(true);
                    }}
                    className="group flex h-8 w-8 items-center justify-center rounded-md border border-white/15 bg-black/65 text-emerald-300 transition hover:border-emerald-300/60 hover:text-emerald-200 sm:h-9 sm:w-9"
                    aria-label="Open provably fair details"
                  >
                    <ShieldCheck className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      playSound('click');
                      void handleCopyPageLink();
                    }}
                    className="group flex h-8 w-8 items-center justify-center rounded-md border border-white/15 bg-black/65 text-gray-200 transition hover:border-cyan-300/60 hover:text-cyan-200 sm:h-9 sm:w-9"
                    aria-label="Copy page link"
                  >
                    <Copy className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      playSound('click');
                      setShowInfoModal(true);
                    }}
                    className="group flex h-8 w-8 items-center justify-center rounded-md border border-white/15 bg-black/65 text-gray-200 transition hover:border-amber-300/60 hover:text-amber-200 sm:h-9 sm:w-9"
                    aria-label="Open item availability disclaimer"
                  >
                    <Info className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      playSound('click');
                      toggleMute();
                    }}
                    className="group flex h-8 w-8 items-center justify-center rounded-md border border-white/15 bg-black/65 text-gray-200 transition hover:border-violet-300/60 hover:text-violet-200 sm:h-9 sm:w-9"
                    aria-label={muted ? 'Unmute sounds' : 'Mute sounds'}
                  >
                    {muted ? <VolumeX className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> : <Volume2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
                  </button>
                </div>
                {copyStatusMessage && (
                  <p className="mt-1 text-right text-[10px] text-cyan-200 sm:text-xs" role="status" aria-live="polite">
                    {copyStatusMessage}
                  </p>
                )}
              </div>
            </div>

            {/* Spinner Window */}
            <div className="relative h-64 flex items-center overflow-hidden bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]">
                {isBoxPreviewVisible && (
                  <div
                    className={`absolute inset-0 z-30 flex items-center justify-center px-6 transition-opacity duration-500 ${isBoxPreviewFading ? 'opacity-0' : 'opacity-100'}`}
                    aria-live="polite"
                  >
                    <div className={`lootx-box-preview relative w-full max-w-[280px] sm:max-w-[320px] rounded-2xl border p-4 sm:p-5 backdrop-blur-sm ${isGoldMode ? 'border-yellow-400/50 bg-yellow-500/10' : 'border-cyan-400/40 bg-cyan-500/10'}`}>
                      <div className="lootx-box-preview__shimmer" aria-hidden="true"></div>
                      <img
                        src={box!.image}
                        alt={`${box!.name} box`}
                        className="relative z-10 mx-auto h-28 w-auto max-w-full object-contain sm:h-32"
                      />
                      <p className="relative z-10 mt-3 text-center text-xs font-semibold uppercase tracking-[0.2em] text-gray-200 sm:text-sm">
                        Ready to open
                      </p>
                    </div>
                  </div>
                )}

                {isSpinning && (
                  <div
                    className={`absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-0.5 z-[26] pointer-events-none ${isGoldMode ? 'bg-yellow-400/50' : 'bg-cyan-400/35'}`}
                    aria-hidden="true"
                  ></div>
                )}
                
                {/* Fade Gradients */}
                <div className="absolute left-0 top-0 bottom-0 w-32 bg-gradient-to-r from-[#0b0e14] to-transparent z-20 pointer-events-none"></div>
                <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-[#0b0e14] to-transparent z-20 pointer-events-none"></div>

                {/* The Moving Reel */}
                <div 
                    ref={scrollContainerRef}
                    className={`flex px-[50%] will-change-transform ml-[-80px] transition-opacity duration-300 ${isBoxPreviewVisible ? 'opacity-0' : 'opacity-100'}`} 
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
                                className="absolute inset-4 rounded-full opacity-90"
                                style={{
                                  background: `radial-gradient(circle, ${item.color}75 0%, ${item.color}2d 45%, ${item.color}00 78%)`
                                }}
                            ></div>
                            <img loading="lazy" decoding="async" 
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
            <div className="bg-[#0b0e14] p-4 flex flex-col items-center justify-center gap-3 border-t border-gray-800 relative z-20">
                 <button 
                    onClick={() => handleSpin()}
                    disabled={isSpinning || isSyncingFair || isRotatingSeed || isBalanceLoading}
                    className={`w-full sm:w-auto min-w-[220px] px-8 py-3 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-lg shadow-lg transition-all active:scale-95 flex flex-col items-center leading-tight ${isGoldMode ? 'bg-yellow-500 hover:bg-yellow-400 shadow-yellow-500/20 text-black' : (isFree ? 'bg-green-500 hover:bg-green-400 shadow-green-500/20 text-black' : 'btn-logo-gradient')}`}
                >
                    <span>
                      {isSyncingFair ? (
                        'Syncing server...'
                      ) : isSpinning ? (
                        'Spinning...'
                      ) : isBalanceLoading ? (
                        'Loading balance...'
                      ) : isFree ? (
                        'Free Spin'
                      ) : (
                        <span className="inline-flex items-center justify-center gap-2 sm:gap-3 flex-wrap">
                          <span className="inline-flex items-center gap-2">
                            Open for
                            {caseCurrencyType === 'XP' ? (
                              <span className="inline-flex items-center gap-1 text-white">
                                <img loading="lazy" decoding="async" src={XP_ICON} alt="XP" className="h-4 w-4 object-contain" />
                                <span>{currentCaseXpPrice.toLocaleString()}</span>
                              </span>
                            ) : (
                              <CoinAmount
                                amount={toCoins(box!.price, PRICE_UNIT_MODE)}
                                formatOptions={{ maximumFractionDigits: 0 }}
                                className="text-white"
                                iconClassName="w-4 h-4"
                              />
                            )}
                          </span>
                          {previewTotalXp > 0 && (
                            <span className="inline-flex items-center rounded-full border border-emerald-300/40 bg-emerald-500/15 px-2 py-0.5 text-[10px] sm:text-xs font-semibold text-emerald-200">
                              +{previewTotalXp.toLocaleString()} XP
                            </span>
                          )}
                        </span>
                      )}
                    </span>
                 </button>
                 {!isFree && (
                   <button
                     onClick={handleTryFree}
                     disabled={isSpinning || isSyncingFair || isRotatingSeed}
                     className="w-full sm:w-auto min-w-[220px] px-8 py-3 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-lg shadow-lg transition-all active:scale-95 bg-emerald-500 hover:bg-emerald-400 shadow-emerald-500/20 flex flex-col items-center leading-tight"
                   >
                     <span>Demo Spin</span>
                   </button>
                 )}
                 {isAdmin && (
                   <button
                     onClick={() => handleSpin({ isDemo: true, forceGold: true })}
                     disabled={isSpinning || isSyncingFair || isRotatingSeed}
                     className="w-full sm:w-auto min-w-[220px] px-8 py-3 disabled:opacity-50 disabled:cursor-not-allowed text-black font-bold rounded-lg shadow-lg transition-all active:scale-95 bg-yellow-400 hover:bg-yellow-300 shadow-yellow-500/20 flex flex-col items-center leading-tight"
                   >
                     <span>Test Gold Spin</span>
                   </button>
                 )}
            </div>
            {spinFeedbackMessage && (
              <div className="px-2 pb-4">
                <div
                  role="status"
                  aria-live="polite"
                  className="mx-auto w-full max-w-xl rounded-lg border border-amber-400/30 bg-amber-500/10 px-4 py-2 text-center text-xs sm:text-sm text-amber-200"
                >
                  {spinFeedbackMessage}
                </div>
              </div>
            )}
        </div>


        <ProvablyFairMiniModal
          isOpen={showFairModal}
          onClose={() => setShowFairModal(false)}
          onVerifySpin={() => {
            playSound('click');
            setShowFairModal(false);
            setView({ type: 'PROVABLY_FAIR' });
            if (typeof window !== 'undefined') {
              window.history.replaceState({}, '', '/provably-fair#verify');
            }
          }}
        />

        {showInfoModal && (
          <div
            className="fixed inset-0 z-[95] flex items-center justify-center bg-black/70 p-4"
            onClick={() => setShowInfoModal(false)}
          >
            <div
              className="w-full max-w-lg rounded-2xl border border-white/20 bg-[#121722] p-4 text-gray-200 shadow-2xl sm:p-6"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mb-3 flex items-start justify-between gap-4">
                <h3 className="text-base font-bold text-white sm:text-lg">Item Availability Disclaimer</h3>
                <button
                  type="button"
                  onClick={() => {
                    playSound('click');
                    setShowInfoModal(false);
                  }}
                  className="rounded-full border border-white/20 p-1 text-gray-300 transition hover:text-white"
                  aria-label="Close disclaimer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <p className="text-sm leading-relaxed text-gray-300">
                Specific items shown or opened may be subject to availability and may not always be available for withdrawal. Certain items are sourced from third-party retailers or marketplaces and availability cannot be guaranteed. If an item becomes unavailable, you may receive a comparable item of equal or greater value or an equivalent amount of Credits, in accordance with our Terms &amp; Conditions.
              </p>
            </div>
          </div>
        )}

        {/* Slide Up Win Sheet */}
        <div className={`fixed inset-0 z-[90] bg-black/80 backdrop-blur-sm transition-opacity duration-500 ${showWinModal && wonItem ? 'opacity-100' : 'pointer-events-none opacity-0'}`} onClick={closeWinModal} />
        <div className={`fixed bottom-0 left-0 right-0 z-[100] transform transition-transform duration-500 ${showWinModal && wonItem ? 'translate-y-0' : 'translate-y-full'}`}>
          {wonItem && (
            <div className="mx-auto flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-3xl border-x border-t border-white/10 bg-[#131722]/95 backdrop-blur-xl shadow-[0_-10px_50px_rgba(0,0,0,0.75)] sm:max-h-[86vh]">
              <div className="flex items-center justify-between border-b border-white/10 bg-black/25 px-4 py-4 sm:px-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full border border-emerald-400/40 bg-emerald-500/15">
                    <Check className="h-5 w-5 text-emerald-400" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white sm:text-lg">{isDemoSpin ? 'Demo Spin Result' : 'Item Unboxed'}</h3>
                    <p className="text-xs text-gray-400">{isDemoSpin ? 'Rewards are not granted in demo mode.' : 'Choose what to do with your item.'}</p>
                  </div>
                </div>
                <button type="button" onClick={closeWinModal} className="rounded-full border border-white/10 bg-white/5 p-2 text-gray-300 transition hover:text-white">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="overflow-y-auto p-5 sm:p-6">
                <div className="relative mx-auto flex max-w-sm flex-col items-center rounded-2xl border border-white/10 bg-black/25 p-4 text-center">
                  <div className="absolute inset-0 rounded-2xl opacity-30" style={{ background: `radial-gradient(circle at top, ${wonItem.color}99 0%, transparent 70%)` }} />
                  <img loading="lazy" decoding="async" src={wonItem.image} alt={wonItem.name} className="relative z-10 mb-3 h-36 w-36 object-contain" />
                  <h4 className="relative z-10 text-lg font-bold text-white">{wonItem.name}</h4>
                  <CoinAmount
                    amount={toCoins(wonItem.price, PRICE_UNIT_MODE)}
                    formatOptions={{ maximumFractionDigits: 0 }}
                    className="relative z-10 mt-2 font-semibold text-gray-200"
                    iconClassName="w-4 h-4"
                  />
                </div>
              </div>

              <div className="border-t border-white/10 bg-black/20 p-4 sm:p-6">
                {isDemoSpin ? (
                  <button onClick={closeWinModal} className="h-12 w-full rounded-xl border border-white/10 bg-white/5 text-sm font-bold text-white transition hover:bg-white/10">Close</button>
                ) : (
                  <div className="flex flex-col gap-3 sm:flex-row">
                    {wonItem.redeemable !== false && (
                      <button
                        onClick={handleSell}
                        disabled={isGeneratingSellOffer || isSellingItem}
                        className={`h-16 rounded-lg sm:h-14 sm:rounded-xl flex-1 border px-4 text-sm font-semibold transition disabled:opacity-60 ${
                          sellOfferGenerated
                            ? 'border-emerald-400/40 bg-emerald-500/20 text-emerald-100 hover:bg-emerald-500/30'
                            : 'border-white/10 bg-white/5 text-gray-100 hover:bg-white/10'
                        }`}
                      >
                        {isSellingItem ? (
                          <span className="inline-flex items-center justify-center gap-2">
                            <Wallet className="h-4 w-4" />
                            Selling item...
                          </span>
                        ) : isGeneratingSellOffer ? (
                          <span className="inline-flex items-center justify-center gap-2">
                            <Wallet className="h-4 w-4" />
                            Generating offer...
                          </span>
                        ) : sellOfferGenerated ? (
                          <span className="inline-flex items-center justify-center gap-2">
                            <Wallet className="h-4 w-4" />
                            Trade for
                            <CoinAmount
                              amount={getSellBackValue(toCoins(wonItem.price, PRICE_UNIT_MODE), sellBackRate)}
                              formatOptions={{ maximumFractionDigits: 0 }}
                              className="text-emerald-50"
                              iconClassName="h-4 w-4"
                            />
                          </span>
                        ) : (
                          <span className="inline-flex items-center justify-center gap-2">
                            <Wallet className="h-4 w-4" />
                            Generate buy back offer
                          </span>
                        )}
                      </button>
                    )}
                    <button onClick={handleKeep} className="h-16 rounded-lg sm:h-14 sm:rounded-xl flex-1 btn-logo-gradient px-4 text-sm font-bold text-white"> 
                      <span className="inline-flex items-center gap-2"><PackageOpen className="h-4 w-4" />Keep Item</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>


        {/* Case Contents */}
        <div className="mt-12 border-t border-white/10 bg-[#0d1118] py-8 sm:py-10">
            <div className="mb-6 flex items-center gap-3">
                <div className="rounded-lg border border-white/10 bg-white/5 p-2">
                  <Gamepad2 className="h-5 w-5 text-indigo-300" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">Drop Table</h3>
                  <p className="text-xs text-gray-400">Tap an item to inspect details.</p>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                {displayItems.map((item) => (
                    <button
                        key={item.id}
                        type="button"
                        onClick={() => setSelectedCaseItem(item)}
                        className="group relative overflow-hidden rounded-xl border border-white/10 bg-[#131722] text-left transition-all hover:border-white/20 hover:bg-[#171d2a]"
                    >
                        <div className="absolute inset-0 opacity-25" style={{ background: `radial-gradient(circle at top, ${item.color}88 0%, transparent 70%)` }} />
                        <div className="relative flex h-36 items-center justify-center p-3 sm:h-40">
                            <img loading="lazy" decoding="async" src={item.image} alt={item.name} className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-105" />
                        </div>
                        <div className="relative border-t border-white/10 bg-black/30 p-3">
                            <div className="mb-1 truncate text-xs font-bold text-white" title={item.name}>{item.name}</div>
                            <div className="flex items-center justify-between gap-2">
                                <CoinAmount
                                  amount={toCoins(item.price, PRICE_UNIT_MODE)}
                                  formatOptions={{ maximumFractionDigits: 0 }}
                                  className="text-sm font-bold text-gray-200"
                                  iconClassName="w-3.5 h-3.5"
                                />
                                <span
                                  className="rounded border px-1.5 py-0.5 text-[10px] font-bold"
                                  style={{ color: item.color, borderColor: `${item.color}66`, backgroundColor: `${item.color}1a` }}
                                >
                                  {item.chance}%
                                </span>
                            </div>
                        </div>
                    </button>
                ))}
            </div>
        </div>
        {/* Slide Up Item Sheet */}
        <div className={`fixed inset-0 z-[110] bg-black/80 backdrop-blur-sm transition-opacity duration-500 ${selectedCaseItem ? 'opacity-100' : 'pointer-events-none opacity-0'}`} onClick={() => setSelectedCaseItem(null)} />
        <div className={`fixed bottom-0 left-0 right-0 z-[120] transform transition-transform duration-500 ${selectedCaseItem ? 'translate-y-0' : 'translate-y-full'}`}>
          {selectedCaseItem && (
            <div ref={itemModalRef} role="dialog" aria-modal="true" aria-labelledby="item-details-title" className="mx-auto w-full max-w-lg overflow-hidden rounded-t-3xl border-x border-t border-white/10 bg-[#131722]/95 backdrop-blur-xl shadow-[0_-10px_50px_rgba(0,0,0,0.75)]">
              <div className="relative flex h-64 items-center justify-center overflow-hidden" style={{ background: `radial-gradient(circle at top, ${selectedCaseItem.color}99 0%, transparent 72%)` }}>
                <button
                  ref={itemModalCloseRef}
                  type="button"
                  onClick={() => setSelectedCaseItem(null)}
                  className="absolute right-4 top-4 z-20 flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-black/40 text-white"
                  aria-label="Close item details"
                >
                  <X className="h-4 w-4" />
                </button>
                <img src={selectedCaseItem.image} alt={selectedCaseItem.name} className="relative z-10 h-44 w-44 object-contain drop-shadow-2xl" />
              </div>
              <div className="space-y-5 px-5 py-6 sm:px-6">
                <div className="text-center">
                  <h3 id="item-details-title" className="text-2xl font-bold text-white">{selectedCaseItem.name}</h3>
                  <div className="mt-2 inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase" style={{ color: selectedCaseItem.color, borderColor: `${selectedCaseItem.color}66`, backgroundColor: `${selectedCaseItem.color}1a` }}>
                    {selectedCaseItem.rarity ?? 'Item'}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-white/10 bg-black/30 p-3 text-center">
                    <span className="block text-[10px] font-bold uppercase tracking-wide text-gray-400">Value</span>
                    <CoinAmount amount={toCoins(selectedCaseItem.price, PRICE_UNIT_MODE)} formatOptions={{ maximumFractionDigits: 0 }} className="mt-2 justify-center text-lg font-bold text-white" iconClassName="h-4 w-4" />
                  </div>
                  <div className="rounded-xl border border-white/10 bg-black/30 p-3 text-center">
                    <span className="text-[10px] font-bold uppercase tracking-wide text-gray-400">Drop Chance</span>
                    <div className="mt-1 text-lg font-bold text-white">{typeof selectedCaseItem.chance === 'number' ? `${selectedCaseItem.chance}%` : '—'}</div>
                  </div>
                </div>
                <button type="button" onClick={() => setSelectedCaseItem(null)} className="h-12 w-full rounded-xl bg-white text-sm font-bold text-black transition hover:bg-gray-200">Close</button>
              </div>
            </div>
          )}
        </div>
        <style>{`
          @keyframes box-shimmer {
            0% { transform: translateX(-150%); }
            100% { transform: translateX(150%); }
          }
          @keyframes box-glow {
            0%, 100% { box-shadow: 0 0 0 rgba(34, 211, 238, 0.2), 0 0 18px rgba(34, 211, 238, 0.2); }
            50% { box-shadow: 0 0 0 rgba(34, 211, 238, 0.35), 0 0 30px rgba(34, 211, 238, 0.35); }
          }
          .lootx-box-preview {
            overflow: hidden;
            animation: box-glow 2.1s ease-in-out infinite;
          }
          .lootx-box-preview__shimmer {
            position: absolute;
            inset: -20%;
            background: linear-gradient(110deg, transparent 30%, rgba(255, 255, 255, 0.35) 50%, transparent 70%);
            animation: box-shimmer 2s ease-in-out infinite;
          }
        `}</style>
        </>
      )}
    </div>
  );
};
