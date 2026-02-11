import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronLeft, Zap, Volume2, Info, X, ShieldCheck } from 'lucide-react';
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
import pullzPattern from '../assets/pullz-p.PNG';
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

interface SpinResolvedItem {
  itemId: string;
  prizeId?: string | null;
  name: string;
  image: string;
  rarity: InventoryItem['rarity'];
  sellValueCoins: number;
  status: 'pending_decision';
}

type ItemDecision = 'kept' | 'sold';

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
  const [spinCount, setSpinCount] = useState<1 | 2 | 3 | 4>(1);
  const [resolvedItems, setResolvedItems] = useState<SpinResolvedItem[]>([]);
  const [laneReels, setLaneReels] = useState<CaseItem[][]>([]);
  const [itemActionLoading, setItemActionLoading] = useState(false);
  const [itemDecisions, setItemDecisions] = useState<Record<string, ItemDecision>>({});
  const [itemPending, setItemPending] = useState<Record<string, boolean>>({});
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
  const [showFairTooltip, setShowFairTooltip] = useState(false);
  const [rewardResolved, setRewardResolved] = useState(false);
  const [selectedCaseItem, setSelectedCaseItem] = useState<CaseItem | null>(null);
  const [spinFeedbackMessage, setSpinFeedbackMessage] = useState<string | null>(null);
  
  // Gold Spin State
  const [isGoldMode, setIsGoldMode] = useState(false);
  const [isBoxPreviewVisible, setIsBoxPreviewVisible] = useState(true);
  const [isBoxPreviewFading, setIsBoxPreviewFading] = useState(false);
  
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const laneRefs = useRef<Array<HTMLDivElement | null>>([]);
  const itemModalRef = useRef<HTMLDivElement>(null);
  const itemModalCloseRef = useRef<HTMLButtonElement>(null);
  const lastFocusedElementRef = useRef<HTMLElement | null>(null);
  const bodyOverflowRef = useRef<string>('');
  const sellOfferTimerRef = useRef<number | null>(null);
  const reviewAutoCloseTimerRef = useRef<number | null>(null);
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
    if (reviewAutoCloseTimerRef.current) {
      window.clearTimeout(reviewAutoCloseTimerRef.current);
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

  const handleSpin = async () => {
    if (isSpinning || !box || items.length === 0) return;
    setSpinFeedbackMessage(null);

    if (!isAuthenticated) {
      openAuthModal('login');
      return;
    }

    const isDailyFreeBox = isFree || box?.isDaily === true || (box as any)?.isDailyFree === true;
    const requestedCount = isDailyFreeBox ? 1 : spinCount;

    if (isDailyFreeBox && !canFreeSpin) {
      setSpinFeedbackMessage('Daily free already claimed. Come back tomorrow.');
      return;
    }

    if (!isDailyFreeBox && caseCurrencyType === 'COIN') {
      const totalCost = toCoins(box.price, PRICE_UNIT_MODE) * requestedCount;
      const availableCoins = Number.isFinite(balance) ? balance : Number(user.balance ?? 0);
      if (!Number.isFinite(availableCoins) || availableCoins < totalCost) {
        setSpinFeedbackMessage('Not enough coins — top up to open this box.');
        return;
      }
    }

    if (isBoxPreviewVisible) {
      setIsBoxPreviewFading(true);
      await new Promise((resolve) => window.setTimeout(resolve, 250));
      setIsBoxPreviewVisible(false);
      setIsBoxPreviewFading(false);
    }

    setIsSpinning(true);
    setShowWinModal(false);
    setWonItem(null);
    setWonInventoryItem(null);
    setResolvedItems([]);
    setItemDecisions({});
    setItemPending({});
    if (reviewAutoCloseTimerRef.current) {
      window.clearTimeout(reviewAutoCloseTimerRef.current);
      reviewAutoCloseTimerRef.current = null;
    }

    try {
      const clientRequestId = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

      const data = await authedFetch<{
        charged: number;
        results: SpinResolvedItem[];
        newBalance: number;
      }>('/api/spins/resolve', {
        method: 'POST',
        body: JSON.stringify({ boxId: box.id, count: requestedCount, clientRequestId })
      });

      const lanes = data.results.map((result) => {
        const winner = items.find((item) => item.id === result.prizeId || item.name === result.name)
          ?? {
            id: result.prizeId ?? result.itemId,
            name: result.name,
            image: result.image,
            rarity: result.rarity,
            price: result.sellValueCoins,
            chance: 0,
            color: '#9ca3af'
          } as CaseItem;
        return generateReel(winner, items, true);
      });

      const safeResults = Array.isArray(data.results) ? data.results : [];
      setResolvedItems(safeResults);
      setLaneReels(lanes);
      setReelItems(lanes[0] ?? reelItems);
      syncBalance(Number(data.newBalance ?? 0));

      const duration = 4200;
      window.setTimeout(() => {
        laneRefs.current.forEach((laneEl, idx) => {
          if (!laneEl || idx >= lanes.length) return;
          const jitter = Math.floor(Math.random() * 80) - 40;
          laneEl.style.transition = `transform ${duration / 1000}s cubic-bezier(0.15,0.85,0.35,1)`;
          laneEl.style.transform = `translate3d(${-(BUFFER_COUNT * ITEM_WIDTH) + jitter}px,0,0)`;
        });
      }, 40);

      window.setTimeout(() => {
        setIsSpinning(false);
        setIsBoxPreviewVisible(true);
        setShowWinModal(true);
      }, duration + 280);

      data.results.forEach((result) => {
        const matched = items.find((item) => item.id === result.prizeId || item.name === result.name);
        const inventoryItem: InventoryItem = {
          id: result.prizeId ?? result.itemId,
          instanceId: result.itemId,
          name: result.name,
          image: result.image,
          rarity: result.rarity,
          chance: 0,
          color: matched?.color ?? '#9ca3af',
          price: result.sellValueCoins,
          obtainedAt: Date.now(),
          status: 'pending_decision',
          redeemable: true,
          sellBackRate: sellBackRate
        };
        addInventoryItemFromServer(inventoryItem);
      });
    } catch (error) {
      const rawMessage = error instanceof Error ? error.message : 'Unable to open box.';
      const readableMessage = rawMessage.includes(':') ? rawMessage.split(':').slice(1).join(':').trim() : rawMessage;
      setIsSpinning(false);
      setIsBoxPreviewVisible(true);
      setSpinFeedbackMessage(readableMessage || 'Unable to open box.');
    }
  };

  const handleTryFree = () => {
    setSpinFeedbackMessage(null);
    void handleSpin();
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
    if (reviewAutoCloseTimerRef.current) {
      window.clearTimeout(reviewAutoCloseTimerRef.current);
      reviewAutoCloseTimerRef.current = null;
    }
    setShowWinModal(false);
    setWonInventoryItem(null);
    setSellOfferGenerated(false);
    setIsGeneratingSellOffer(false);
    setIsSellingItem(false);
    setItemActionLoading(false);
    setItemPending({});
    setItemDecisions({});
  };

  const resolveItems = async (mode: 'keep_all' | 'sell_all' | 'single', targetId?: string, action?: 'keep' | 'sell') => {
    if (itemActionLoading || resolvedItems.length === 0) return;

    const unresolvedItems = resolvedItems.filter((item) => !itemDecisions[item.itemId]);
    const actions = mode === 'single'
      ? (targetId && action && !itemDecisions[targetId] ? [{ itemId: targetId, action }] : [])
      : unresolvedItems.map((item) => ({ itemId: item.itemId, action: mode === 'sell_all' ? 'sell' : 'keep' as 'keep' | 'sell' }));

    if (actions.length === 0) return;

    setItemActionLoading(true);
    setItemPending((prev) => {
      const next = { ...prev };
      actions.forEach((entry) => {
        next[entry.itemId] = true;
      });
      return next;
    });

    try {
      const clientRequestId = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

      const response = await authedFetch<{ credited: number; updatedBalance: number }>('/api/inventory/resolve', {
        method: 'POST',
        body: JSON.stringify({ actions, clientRequestId })
      });

      syncBalance(Number(response.updatedBalance ?? balance));

      const decisionPatch: Record<string, ItemDecision> = {};
      actions.forEach((entry) => {
        decisionPatch[entry.itemId] = entry.action === 'sell' ? 'sold' : 'kept';
      });
      setItemDecisions((prev) => ({ ...prev, ...decisionPatch }));

      const decisionCount = Object.keys({ ...itemDecisions, ...decisionPatch }).length;
      if (decisionCount >= resolvedItems.length) {
        reviewAutoCloseTimerRef.current = window.setTimeout(() => {
          closeWinModal();
        }, 800);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to resolve items.';
      alert(message.includes(':') ? message.split(':').slice(1).join(':').trim() : message);
    } finally {
      setItemPending((prev) => {
        const next = { ...prev };
        actions.forEach((entry) => {
          delete next[entry.itemId];
        });
        return next;
      });
      setItemActionLoading(false);
    }
  };

  const handleSell = () => {
    if (resolvedItems.length > 0) {
      void resolveItems('sell_all');
    }
  };

  const handleKeep = () => {
    if (resolvedItems.length > 0) {
      void resolveItems('keep_all');
    }
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
            <div
              className="relative flex items-center overflow-hidden bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]"
              style={{ minHeight: spinCount === 4 ? '240px' : '256px', maxHeight: spinCount === 4 ? '44vh' : '56vh' }}
            >
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
                {(() => {
                  const laneCount = isSpinning
                    ? Math.max(1, resolvedItems.length || spinCount)
                    : (resolvedItems.length > 0 ? resolvedItems.length : 1);
                  const useFourLaneGrid = laneCount === 4;

                  return (
                    <div
                      className={`w-full px-2 sm:px-4 ${useFourLaneGrid ? 'grid grid-cols-2 sm:grid-cols-1 md:grid-cols-2 gap-2.5 sm:gap-3' : 'space-y-2 sm:space-y-3'}`}
                      style={useFourLaneGrid ? { maxHeight: '44vh' } : undefined}
                    >
                      {Array.from({ length: laneCount }).map((_, laneIndex) => {
                        const laneItems = laneReels[laneIndex] ?? reelItems;

                        return (
                          <div
                            key={`lane-shell-${laneIndex}`}
                            className="relative overflow-hidden rounded-xl border border-gray-800/80 bg-[#0f131d]"
                            style={{ minHeight: useFourLaneGrid ? '96px' : '124px', maxHeight: useFourLaneGrid ? '20vh' : '28vh' }}
                          >
                            <span className="absolute left-2 top-2 z-20 rounded-md border border-white/10 bg-black/40 px-1.5 py-0.5 text-[10px] font-semibold text-gray-200">#{laneIndex + 1}</span>
                            <div className="pointer-events-none absolute inset-y-0 left-1/2 z-20 w-[2px] -translate-x-1/2 bg-cyan-400/70"></div>
                            <div
                              ref={(el) => { laneRefs.current[laneIndex] = el; if (laneIndex === 0) scrollContainerRef.current = el; }}
                              className={`flex px-[50%] will-change-transform ml-[-80px] transition-opacity duration-300 ${isBoxPreviewVisible ? 'opacity-0' : 'opacity-100'}`}
                              style={{ gap: `${GAP_WIDTH}px`, transform: 'translate3d(0,0,0)' }}
                            >
                              {laneItems.map((item, idx) => (
                                <div
                                  key={`${item.id}-${idx}-${laneIndex}`}
                                  className="relative flex-shrink-0 border border-gray-800 rounded-lg bg-[#151a23] p-2 flex items-center justify-center"
                                  style={{ width: `${CARD_WIDTH}px`, height: useFourLaneGrid ? '90px' : '118px' }}
                                >
                                  <img src={item.image} alt={item.name} className="relative z-10 h-12 w-12 sm:h-16 sm:w-16 object-contain" />
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
            </div>

            {/* Action Bar */}
            <div className="bg-[#0b0e14] p-4 flex flex-col sm:flex-row items-center justify-center gap-3 border-t border-gray-800 relative z-20">
              <div className="inline-flex w-full sm:w-auto rounded-lg border border-gray-700 bg-[#131825] p-1">
                {[1,2,3,4].map((value) => {
                  const option = value as 1 | 2 | 3 | 4;
                  const dailyLocked = (isFree || box?.isDaily === true || (box as any)?.isDailyFree === true) && option > 1;
                  return (
                    <button
                      key={option}
                      type="button"
                      disabled={dailyLocked || isSpinning}
                      onClick={() => setSpinCount(option)}
                      className={`min-w-[52px] px-3 py-2 text-xs sm:text-sm font-semibold rounded-md transition ${spinCount === option ? 'bg-cyan-500 text-black' : 'text-gray-300'} disabled:opacity-50`}
                    >
                      x{option}
                    </button>
                  );
                })}
              </div>
                 <button 
                    onClick={() => void handleSpin()}
                    disabled={isSpinning || isSyncingFair || isRotatingSeed || isBalanceLoading}
                    className={`w-full sm:w-auto min-w-[200px] px-8 py-3 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-lg shadow-lg transition-all active:scale-95 flex flex-col items-center leading-tight ${isGoldMode ? 'bg-yellow-500 hover:bg-yellow-400 shadow-yellow-500/20 text-black' : (isFree ? 'bg-green-500 hover:bg-green-400 shadow-green-500/20 text-black' : 'btn-logo-gradient')}`}
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
                            Spin x{(isFree || box?.isDaily === true || (box as any)?.isDailyFree === true) ? 1 : spinCount} for
                            {caseCurrencyType === 'XP' ? (
                              <span className="inline-flex items-center gap-1 text-white">
                                <img src={XP_ICON} alt="XP" className="h-4 w-4 object-contain" />
                                <span>{(currentCaseXpPrice * ((isFree || box?.isDaily === true || (box as any)?.isDailyFree === true) ? 1 : spinCount)).toLocaleString()}</span>
                              </span>
                            ) : (
                              <CoinAmount
                                amount={toCoins(box!.price, PRICE_UNIT_MODE) * ((isFree || box?.isDaily === true || (box as any)?.isDailyFree === true) ? 1 : spinCount)}
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
                     className="w-full sm:w-auto min-w-[200px] px-8 py-3 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-lg shadow-lg transition-all active:scale-95 bg-emerald-500 hover:bg-emerald-400 shadow-emerald-500/20 flex flex-col items-center leading-tight"
                   >
                     <span>Try for Free</span>
                   </button>
                 )}
                 {isAdmin && (
                   <button
                     onClick={handleTryFree}
                     disabled={isSpinning || isSyncingFair || isRotatingSeed}
                     className="w-full sm:w-auto min-w-[200px] px-8 py-3 disabled:opacity-50 disabled:cursor-not-allowed text-black font-bold rounded-lg shadow-lg transition-all active:scale-95 bg-yellow-400 hover:bg-yellow-300 shadow-yellow-500/20 flex flex-col items-center leading-tight"
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

        <div className="flex items-center justify-center mb-10">
            <div 
                className="relative flex items-center gap-2 text-gray-400 cursor-pointer hover:text-white transition-colors"
                onClick={() => { playSound('click'); setShowFairModal(true); }}
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

        {/* Win Modal Overlay */}
        {showWinModal && resolvedItems.length > 0 && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 p-2 sm:p-6">
            <div className="w-full max-w-3xl overflow-hidden rounded-2xl border border-cyan-500/20 bg-gradient-to-b from-[#121a2a] to-[#0b111c] shadow-[0_20px_60px_-30px_rgba(14,165,233,0.45)]">
              <div className="border-b border-white/10 px-4 py-3 sm:px-5 sm:py-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-base sm:text-lg font-bold text-white">Win Review</h3>
                    <p className="text-[11px] sm:text-xs text-gray-400">Choose Keep or Sell for each item.</p>
                  </div>
                  <button type="button" className="rounded-md border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs text-gray-300" onClick={closeWinModal}>Close</button>
                </div>
              </div>

              <div className="max-h-[58vh] overflow-y-auto px-3 py-3 sm:px-5 sm:py-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
                  {resolvedItems.map((item) => {
                    const decision = itemDecisions[item.itemId];
                    const pending = itemPending[item.itemId] || itemActionLoading;
                    return (
                      <article key={item.itemId} className={`rounded-xl border p-2.5 sm:p-3 transition ${decision ? 'border-emerald-400/40 bg-emerald-500/10' : 'border-gray-700 bg-[#131825]'}`}>
                        <div className="relative mx-auto flex h-20 w-20 sm:h-24 sm:w-24 items-center justify-center rounded-lg bg-[#0d1320]">
                          <img src={item.image} alt={item.name} className="h-14 w-14 sm:h-16 sm:w-16 object-contain" />
                          {decision && (
                            <span className={`absolute -top-2 right-[-10px] rounded-full px-2 py-0.5 text-[10px] font-semibold ${decision === 'sold' ? 'bg-emerald-500 text-black' : 'bg-cyan-500 text-black'}`}>
                              {decision === 'sold' ? 'Sold' : 'Saved'}
                            </span>
                          )}
                        </div>
                        <div className="mt-2 text-xs font-semibold text-white truncate">{item.name}</div>
                        <div className="text-[10px] uppercase tracking-wide text-gray-400">{item.rarity}</div>
                        <div className="mt-1 text-[11px] text-emerald-300">Sell: {item.sellValueCoins.toLocaleString()} coins</div>
                        <div className="mt-2 grid grid-cols-2 gap-2">
                          <button
                            disabled={pending || Boolean(decision)}
                            onClick={() => void resolveItems('single', item.itemId, 'keep')}
                            className="rounded-md border border-gray-600 bg-[#1d2433] px-2 py-2 text-[11px] font-semibold text-white disabled:opacity-40"
                          >
                            Keep
                          </button>
                          <button
                            disabled={pending || Boolean(decision)}
                            onClick={() => void resolveItems('single', item.itemId, 'sell')}
                            className="rounded-md bg-emerald-500 px-2 py-2 text-[11px] font-semibold text-black disabled:opacity-40"
                          >
                            {pending ? '...' : 'Sell'}
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>

              <div className="sticky bottom-0 border-t border-white/10 bg-[#0c1322]/95 px-3 py-3 pb-[max(12px,env(safe-area-inset-bottom))] backdrop-blur-sm sm:px-5 sm:py-4">
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    disabled={itemActionLoading}
                    onClick={() => void resolveItems('keep_all')}
                    className="rounded-lg border border-gray-500/70 bg-[#1b2233] px-3 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    {itemActionLoading ? 'Working...' : 'Keep All'}
                  </button>
                  <button
                    disabled={itemActionLoading}
                    onClick={() => void resolveItems('sell_all')}
                    className="rounded-lg bg-emerald-500 px-3 py-2.5 text-sm font-semibold text-black disabled:opacity-50"
                  >
                    {itemActionLoading ? 'Working...' : 'Sell All'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
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
                              amount={toCoins(wonItem.price, PRICE_UNIT_MODE)}
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
                            <div className="w-full">
                                {wonItem.redeemable === false && (
                                  <div className="mb-3 w-full rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-2 text-center text-xs font-semibold uppercase tracking-wide text-amber-200">
                                    Not redeemable for coins
                                  </div>
                                )}
                            <div className="flex w-full flex-col gap-3 sm:flex-row">
                                {wonItem.redeemable !== false && (
                                  <button
                                    onClick={handleSell}
                                    disabled={isGeneratingSellOffer || isSellingItem}
                                    className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-gray-200 transition hover:border-white/20 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-80"
                                  >
                                      <span className="flex flex-col items-center justify-center gap-1">
                                        <span className="flex items-center justify-center gap-2 text-[11px] uppercase tracking-wide text-gray-400">
                                          {(isGeneratingSellOffer || isSellingItem) && (
                                            <span className="h-3 w-3 animate-spin rounded-full border border-gray-400/60 border-t-transparent" aria-hidden="true" />
                                          )}
                                          {isSellingItem
                                            ? 'Selling item...'
                                            : isGeneratingSellOffer
                                            ? 'Generating offer...'
                                            : sellOfferGenerated
                                              ? 'Accept buy back offer'
                                              : 'Generate buy back offer'}
                                        </span>
                                        {sellOfferGenerated && !isGeneratingSellOffer && !isSellingItem && (
                                          <CoinAmount
                                            amount={getSellBackValue(toCoins(wonItem.price, PRICE_UNIT_MODE), sellBackRate)}
                                            formatOptions={{ maximumFractionDigits: 0 }}
                                            className="text-gray-200"
                                            iconClassName="w-4 h-4"
                                          />
                                        )}
                                      </span>
                                  </button>
                                )}
                                <button onClick={handleKeep} className="flex-1 rounded-xl btn-logo-gradient py-3 text-sm font-bold text-white shadow-lg transition">
                                    Keep Item
                                </button>
                            </div>
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
            <div className="-mt-4 mb-6 flex items-center gap-2 text-[11px] text-gray-500">
                <span className="flex h-5 w-5 items-center justify-center rounded-full border border-white/10 bg-black/40 text-amber-200">
                    <Info className="h-3.5 w-3.5" />
                </span>
                <span>Not redeemable for coins.</span>
            </div>
            
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                {displayItems.map((item) => (
                    <button
                        key={item.id} 
                        type="button"
                        onClick={() => setSelectedCaseItem(item)}
                        className="group relative flex flex-col items-center rounded-xl border border-gray-800 bg-[#0f1219] p-3 text-left transition-all hover:border-gray-700 hover:bg-[#151a23]"
                    >
                        <div
                          className="absolute top-2 left-2 rounded border px-1.5 py-0.5 text-[10px] font-bold"
                          style={{
                            color: item.color,
                            borderColor: `${item.color}66`,
                            backgroundColor: `${item.color}1a`,
                          }}
                        >
                            {item.chance}%
                        </div>

                        <div className="relative mb-3 flex w-full aspect-square items-center justify-center">
                            <div 
                                className="absolute inset-4 opacity-0 group-hover:opacity-20 transition-opacity blur-xl rounded-full"
                                style={{ backgroundColor: item.color }}
                            ></div>
                            {item.redeemable === false && (
                              <div className="absolute right-2 top-2 rounded-full border border-white/10 bg-black/50 p-1 text-amber-200">
                                <Info className="h-3.5 w-3.5" />
                              </div>
                            )}
                            <img src={item.image} alt={item.name} className="relative z-10 w-3/4 h-3/4 object-contain group-hover:scale-110 transition-transform duration-300" />
                        </div>

                        <div className="w-full text-left mt-auto">
                            <div className="text-gray-400 text-xs font-medium truncate mb-0.5">{item.name}</div>
                            <CoinAmount
                              amount={toCoins(item.price, PRICE_UNIT_MODE)}
                              formatOptions={{ maximumFractionDigits: 0 }}
                              className="text-white font-bold text-sm"
                              iconClassName="w-3.5 h-3.5"
                            />
                        </div>

                        <div 
                            className="absolute bottom-0 left-0 right-0 h-[2px] rounded-b-xl opacity-50 group-hover:opacity-100 transition-opacity"
                            style={{ backgroundColor: item.color, boxShadow: `0 0 8px ${item.color}` }}
                        ></div>
                    </button>
                ))}
            </div>
        </div>
        {selectedCaseItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
            <button
              type="button"
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
              onClick={() => setSelectedCaseItem(null)}
              aria-label="Close item details"
            />
            <div
              ref={itemModalRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="item-details-title"
              className="relative w-full max-w-[760px] max-h-[88vh] overflow-hidden rounded-[26px] border border-white/10 bg-gradient-to-br from-[#151a23] via-[#111824] to-[#0b0f18] text-gray-200 shadow-[0_25px_80px_-40px_rgba(15,23,42,0.9)] shadow-purple-500/10 animate-item-modal-in"
              style={{
                borderColor: 'rgba(255,255,255,0.08)',
                boxShadow:
                  '0 30px 80px -45px rgba(15,23,42,0.9), 0 0 60px -35px rgba(124,58,237,0.45), 0 0 40px -32px rgba(34,211,238,0.45)',
              }}
            >
              <div
                className="pointer-events-none absolute inset-0 bg-cover bg-center opacity-[0.05]"
                style={{ backgroundImage: `url(${pullzPattern})` }}
              />
              <div className="relative flex max-h-[88vh] flex-col gap-6 overflow-hidden p-5 sm:p-8">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">
                    Item Details
                  </span>
                  <button
                    ref={itemModalCloseRef}
                    type="button"
                    onClick={() => setSelectedCaseItem(null)}
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-gray-300 transition hover:border-white/30 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60"
                    aria-label="Close item details"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto pr-1 md:flex-row md:items-center">
                  <div className="flex w-full items-center justify-center md:w-1/2">
                    <div
                      className="relative flex aspect-square w-full max-w-[280px] items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] shadow-[0_20px_45px_-35px_rgba(34,211,238,0.45)] sm:max-w-[360px] md:max-w-[400px]"
                      style={{ boxShadow: `0 30px 55px -45px ${selectedCaseItem.color}` }}
                    >
                      <img
                        src={selectedCaseItem.image}
                        alt={selectedCaseItem.name}
                        className="h-[78%] w-[78%] object-contain"
                      />
                    </div>
                  </div>
                  <div className="flex min-h-0 flex-1 flex-col gap-4 text-left">
                    <h3
                      id="item-details-title"
                      className="text-2xl font-bold text-white sm:text-3xl"
                    >
                      {selectedCaseItem.name}
                    </h3>
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2">
                        <CoinAmount
                          amount={toCoins(selectedCaseItem.price, PRICE_UNIT_MODE)}
                          formatOptions={{ maximumFractionDigits: 0 }}
                          className="text-base font-semibold text-white"
                          iconClassName="w-4 h-4"
                        />
                      </div>
                      {selectedCaseItem.rarity && (
                        <span
                          className="rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em]"
                          style={{
                            borderColor: selectedCaseItem.color,
                            color: selectedCaseItem.color,
                            backgroundColor: `${selectedCaseItem.color}1a`,
                          }}
                        >
                          {selectedCaseItem.rarity}
                        </span>
                      )}
                      {selectedCaseItem.redeemable === false && (
                        <span className="rounded-full border border-amber-400/30 bg-amber-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-200">
                          Not redeemable
                        </span>
                      )}
                    </div>
                    <div className="grid gap-3 text-[11px] uppercase tracking-[0.18em] text-gray-400">
                      <div className="flex items-center justify-between gap-4">
                        <span>Brand</span>
                        <span className="text-xs font-semibold uppercase tracking-[0.1em] text-gray-200">
                          {selectedCaseItem.brand || 'Unknown'}
                        </span>
                      </div>
                      {selectedCaseItem.category && (
                        <div className="flex items-center justify-between gap-4">
                          <span>Category</span>
                          <span className="text-xs font-semibold uppercase tracking-[0.1em] text-gray-200">
                            {selectedCaseItem.category}
                          </span>
                        </div>
                      )}
                      {typeof selectedCaseItem.chance === 'number' && (
                        <div className="flex items-center justify-between gap-4">
                          <span>Odds</span>
                          <span className="text-xs font-semibold uppercase tracking-[0.1em] text-gray-200">
                            {selectedCaseItem.chance}%
                          </span>
                        </div>
                      )}
                      {selectedCaseItem.tags && selectedCaseItem.tags.length > 0 && (
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <span>Tags</span>
                          <span className="text-xs font-semibold uppercase tracking-[0.08em] text-gray-200">
                            {selectedCaseItem.tags.join(', ')}
                          </span>
                        </div>
                      )}
                      {selectedCaseItem.sizes && selectedCaseItem.sizes.length > 0 && (
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <span>Sizes</span>
                          <span className="text-xs font-semibold uppercase tracking-[0.08em] text-gray-200">
                            {selectedCaseItem.sizes.join(', ')}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-end border-t border-white/5 pt-4">
                  <button
                    type="button"
                    onClick={() => setSelectedCaseItem(null)}
                    className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-purple-500 to-cyan-500 px-6 py-2.5 text-sm font-semibold text-white shadow-[0_12px_30px_-18px_rgba(124,58,237,0.8)] transition hover:shadow-[0_0_24px_rgba(34,211,238,0.35)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60"
                  >
                    Back to Items
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        <style>{`
          @keyframes item-modal-in {
            0% { opacity: 0; transform: scale(0.96) translateY(8px); }
            100% { opacity: 1; transform: scale(1) translateY(0); }
          }
          .animate-item-modal-in {
            animation: item-modal-in 200ms ease-out;
          }
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
