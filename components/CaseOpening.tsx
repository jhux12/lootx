import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { ChevronLeft, Volume2, VolumeX, Info, X, ShieldCheck, Gamepad2, Check, PackageOpen, Wallet, Copy, Share2 } from 'lucide-react';
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
import { db } from '../firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { DEFAULT_ECONOMY_SETTINGS, getXpCost, normalizeEconomySettings } from '../utils/economy';
import { toast } from '../src/ui/toast/toast';
import { BlurImage } from '../src/ui/images/BlurImage';
import { activityStore } from '../src/lib/activity/activityStore';
import { createMicroConfetti, MicroConfettiParticle } from '../src/ui/feedback/microConfetti';
import { ProvablyFairModal } from '../src/ui/provably/ProvablyFairModal';
import { trackEvent } from '../utils/trackEvent';
import pullzLogo from '../assets/pullz-p.PNG';

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

const CARD_WIDTH = 170;
const CARD_HEIGHT = 210;
const GAP_WIDTH = 4;

// Spinner tuning constants (kept centralized so motion can be adjusted safely).
const SPINNER_MOTION = {
  preWinnerItems: 68,
  postWinnerItems: 14,
  spinDurationMs: 4600,
  goldTicketDurationMs: 4200,
  goldFinalDurationMs: 3800,
  settleDurationMs: 360,
  overshootPx: 18,
  approachOffsetSoftMaxPx: 16,
  approachOffsetNearMissMinPx: 34,
  approachOffsetNearMissMaxPx: 58,
  nearMissChance: 0.42,
  durationVarianceMs: 420,
  initialBlurDurationMs: 260
} as const;

const createSeededRng = (seed: string) => {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }

  return () => {
    h += 0x6D2B79F5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const pickFromPool = <T,>(pool: T[], rng: () => number): T => pool[Math.floor(rng() * pool.length)];
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


const loadImageElement = (src: string): Promise<HTMLImageElement> => new Promise((resolve, reject) => {
  const image = new Image();
  image.onload = () => resolve(image);
  image.onerror = () => reject(new Error('Failed to load share image.'));
  image.src = src;
});

const createShareImageFile = async (item: CaseItem, caseName: string): Promise<File | null> => {
  if (typeof window === 'undefined') return null;

  try {
    const [itemResponse, logoImage] = await Promise.all([
      fetch(item.image, { mode: 'cors' }),
      loadImageElement(pullzLogo)
    ]);
    if (!itemResponse.ok) return null;

    const imageBlob = await itemResponse.blob();
    const objectUrl = URL.createObjectURL(imageBlob);

    try {
      const itemImage = await loadImageElement(objectUrl);
      const canvas = document.createElement('canvas');
      canvas.width = 1080;
      canvas.height = 1350;
      const context = canvas.getContext('2d');
      if (!context) return null;

      const gradient = context.createLinearGradient(0, 0, canvas.width, canvas.height);
      gradient.addColorStop(0, '#070b12');
      gradient.addColorStop(0.55, '#111827');
      gradient.addColorStop(1, '#0f172a');
      context.fillStyle = gradient;
      context.fillRect(0, 0, canvas.width, canvas.height);

      context.strokeStyle = 'rgba(99, 102, 241, 0.2)';
      context.lineWidth = 2;
      const patternSize = 84;
      for (let x = -patternSize; x < canvas.width + patternSize; x += patternSize) {
        for (let y = -patternSize; y < canvas.height + patternSize; y += patternSize) {
          context.beginPath();
          context.arc(x + (y % (patternSize * 2) === 0 ? 16 : 42), y, 8, 0, Math.PI * 2);
          context.stroke();
        }
      }

      const glow = context.createRadialGradient(canvas.width / 2, 470, 140, canvas.width / 2, 470, 600);
      glow.addColorStop(0, `${item.color}B0`);
      glow.addColorStop(1, 'transparent');
      context.fillStyle = glow;
      context.fillRect(0, 0, canvas.width, canvas.height);

      const logoWidth = 200;
      const logoHeight = 200;
      context.globalAlpha = 0.95;
      context.drawImage(logoImage, canvas.width / 2 - logoWidth / 2, 48, logoWidth, logoHeight);
      context.globalAlpha = 1;

      context.fillStyle = '#a5b4fc';
      context.font = '700 36px Inter, system-ui, sans-serif';
      context.textAlign = 'center';
      context.fillText('PULLZ.GG UNBOXING', canvas.width / 2, 280);

      context.fillStyle = '#ffffff';
      context.font = '800 62px Inter, system-ui, sans-serif';
      context.fillText(item.name.slice(0, 36), canvas.width / 2, 360);

      context.fillStyle = '#cbd5e1';
      context.font = '500 32px Inter, system-ui, sans-serif';
      context.fillText(`From ${caseName}`, canvas.width / 2, 410);

      const cardWidth = 820;
      const cardHeight = 740;
      const cardX = (canvas.width - cardWidth) / 2;
      const cardY = 470;

      context.fillStyle = 'rgba(10, 14, 22, 0.7)';
      context.strokeStyle = 'rgba(99,102,241,0.45)';
      context.lineWidth = 3;
      context.beginPath();
      context.roundRect(cardX, cardY, cardWidth, cardHeight, 44);
      context.fill();
      context.stroke();

      const maxImageSize = 540;
      const scale = Math.min(maxImageSize / itemImage.width, maxImageSize / itemImage.height, 1);
      const drawWidth = itemImage.width * scale;
      const drawHeight = itemImage.height * scale;
      const drawX = canvas.width / 2 - drawWidth / 2;
      const drawY = cardY + cardHeight / 2 - drawHeight / 2;
      context.drawImage(itemImage, drawX, drawY, drawWidth, drawHeight);

      context.fillStyle = '#e2e8f0';
      context.font = '600 34px Inter, system-ui, sans-serif';
      context.fillText('Open your own case at pullz.gg', canvas.width / 2, 1270);

      const resultBlob = await new Promise<Blob | null>((resolve) => canvas.toBlob((blob) => resolve(blob), 'image/png', 0.92));
      if (!resultBlob) return null;

      return new File([resultBlob], 'pullzgg-unboxing.png', { type: 'image/png' });
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  } catch {
    return null;
  }
};


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
    claimFreeBox,
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
  const spinnerBackgroundImage = (box?.spinnerBackgroundImage ?? '').trim();

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
  const [clientSeed, setClientSeed] = useState('pullz-player');
  const [clientSeedInput, setClientSeedInput] = useState('pullz-player');
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
  const [showXpConfirmSheet, setShowXpConfirmSheet] = useState(false);
  const [verifyModalOpen, setVerifyModalOpen] = useState(false);
  const [itemModalActive, setItemModalActive] = useState(false);
  const [animatedModalCoins, setAnimatedModalCoins] = useState(0);
  const [confetti, setConfetti] = useState<MicroConfettiParticle[]>([]);
  const [isReelInFastMotion, setIsReelInFastMotion] = useState(false);
  const [isInitialMotionBlurActive, setIsInitialMotionBlurActive] = useState(false);
  const [isReelDecelerating, setIsReelDecelerating] = useState(false);
  const [isLandingFlashActive, setIsLandingFlashActive] = useState(false);
  
  // Gold Spin State
  const [isGoldMode, setIsGoldMode] = useState(false);
  const [isBoxPreviewVisible, setIsBoxPreviewVisible] = useState(true);
  const [isBoxPreviewFading, setIsBoxPreviewFading] = useState(false);
  
  const scrollViewportRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const winningCardRef = useRef<HTMLDivElement>(null);
  const spinnerAnimationRef = useRef<Animation | null>(null);
  const initialBlurTimerRef = useRef<number | null>(null);
  const itemModalRef = useRef<HTMLDivElement>(null);
  const itemModalCloseRef = useRef<HTMLButtonElement>(null);
  const itemModalRevealFrameRef = useRef<number | null>(null);
  const itemModalCoinFrameRef = useRef<number | null>(null);
  const lastFocusedElementRef = useRef<HTMLElement | null>(null);
  const bodyOverflowRef = useRef<string>('');
  const sellOfferTimerRef = useRef<number | null>(null);
  const topUpTriggerLockRef = useRef(false);
  const spinRequestLockRef = useRef(false);
  const canFreeSpin = !user.lastFreeBoxClaim;
  const prefersReducedMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
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
  const [economySettings, setEconomySettings] = useState(DEFAULT_ECONOMY_SETTINGS);
  const isBalanceLoading = isAuthenticated && !authInitialized;
  const xpCostForCoinCase = useMemo(() => getXpCost(currentCasePrice, economySettings), [currentCasePrice, economySettings]);
  const xpProgress = useMemo(() => {
    if (!Number.isFinite(xpCostForCoinCase) || xpCostForCoinCase <= 0) return 0;
    return Math.max(0, Math.min(1, currentXpBalance / xpCostForCoinCase));
  }, [currentXpBalance, xpCostForCoinCase]);
  const showXpOpenUi = economySettings.xpOpenEnabled && caseCurrencyType === 'COIN' && !isFree && (currentXpBalance > 0 || xpProgress > 0);
  const canOpenMain = isFree || caseCurrencyType === 'XP' || balance >= currentCasePrice;
  const canOpenWithXp = showXpOpenUi && currentXpBalance >= xpCostForCoinCase;
  const xpRingRadius = 14;
  const xpRingCircumference = 2 * Math.PI * xpRingRadius;
  const xpRingOffset = xpRingCircumference * (1 - xpProgress);

  const handleCopyPageLink = useCallback(async () => {
    if (typeof window === 'undefined') return;

    const copyValue = serverSeedHash || window.location.href;
    const copiedLabel = serverSeedHash ? 'Server seed hash copied.' : 'Page link copied.';

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(copyValue);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = copyValue;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }

      setCopyStatusMessage(copiedLabel);
    } catch (error) {
      console.error('Failed to copy seed or box link', error);
      setCopyStatusMessage('Could not copy right now.');
    }

    window.setTimeout(() => setCopyStatusMessage(null), 2500);
  }, [serverSeedHash]);

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

  useEffect(() => {
    const pathLabel = 'settings/economy';
    console.log('READING FIRESTORE PATH', pathLabel);
    const economyRef = doc(db, 'settings', 'economy');
    const unsubscribe = onSnapshot(economyRef, (snapshot) => {
      console.log('SNAPSHOT OK', {
        path: pathLabel,
        size: 'size' in snapshot ? snapshot.size : undefined
      });
      const data = snapshot.exists() ? snapshot.data() : {};
      setEconomySettings(normalizeEconomySettings(data));
    }, (error) => {
      console.error('SNAPSHOT FAILED', {
        path: pathLabel,
        code: error?.code,
        message: error?.message,
        error
      });
      setEconomySettings(DEFAULT_ECONOMY_SETTINGS);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => () => {
    if (sellOfferTimerRef.current) {
      window.clearTimeout(sellOfferTimerRef.current);
    }
    if (itemModalRevealFrameRef.current) {
      window.cancelAnimationFrame(itemModalRevealFrameRef.current);
    }
    if (itemModalCoinFrameRef.current) {
      window.cancelAnimationFrame(itemModalCoinFrameRef.current);
    }
  }, []);

  const animateCoinValue = useCallback((value: number) => {
    if (itemModalCoinFrameRef.current) {
      window.cancelAnimationFrame(itemModalCoinFrameRef.current);
      itemModalCoinFrameRef.current = null;
    }

    const safeValue = Math.max(0, Math.floor(Number(value) || 0));
    if (prefersReducedMotion || safeValue === 0) {
      setAnimatedModalCoins(safeValue);
      return;
    }

    const duration = 700;
    const startAt = performance.now();

    const tick = (timestamp: number) => {
      const elapsed = timestamp - startAt;
      const progress = Math.min(1, elapsed / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setAnimatedModalCoins(Math.floor(safeValue * eased));

      if (progress < 1) {
        itemModalCoinFrameRef.current = window.requestAnimationFrame(tick);
      } else {
        itemModalCoinFrameRef.current = null;
        setAnimatedModalCoins(safeValue);
      }
    };

    itemModalCoinFrameRef.current = window.requestAnimationFrame(tick);
  }, [prefersReducedMotion]);
  
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

  useEffect(() => {
    if (!selectedCaseItem) {
      setItemModalActive(false);
      setAnimatedModalCoins(0);
      if (itemModalRevealFrameRef.current) {
        window.cancelAnimationFrame(itemModalRevealFrameRef.current);
        itemModalRevealFrameRef.current = null;
      }
      if (itemModalCoinFrameRef.current) {
        window.cancelAnimationFrame(itemModalCoinFrameRef.current);
        itemModalCoinFrameRef.current = null;
      }
      return;
    }

    setItemModalActive(false);
    setAnimatedModalCoins(0);
    itemModalRevealFrameRef.current = window.requestAnimationFrame(() => {
      setItemModalActive(true);
    });

    animateCoinValue(toCoins(selectedCaseItem.price, PRICE_UNIT_MODE));

    return () => {
      if (itemModalRevealFrameRef.current) {
        window.cancelAnimationFrame(itemModalRevealFrameRef.current);
        itemModalRevealFrameRef.current = null;
      }
    };
  }, [animateCoinValue, selectedCaseItem]);

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

  const getDemoWinningItem = useCallback((randomValue: number) => {
    const validItems = items.filter((item) => Number.isFinite(item.chance) && item.chance > 0);

    if (validItems.length === 0) {
      return getWinningItem(randomValue);
    }

    const baseTotalWeight = validItems.reduce((sum, item) => sum + item.chance, 0);
    const baseExpectedValue = validItems.reduce((sum, item) => sum + item.chance * Math.max(0, Number(item.price ?? 0)), 0) / baseTotalWeight;
    const positiveValues = validItems
      .map((item) => Math.max(0, Number(item.price ?? 0)))
      .filter((value) => value > 0);

    if (!Number.isFinite(baseExpectedValue) || baseExpectedValue <= 0 || positiveValues.length === 0) {
      return getWinningItem(randomValue);
    }

    const minPositiveValue = Math.min(...positiveValues);
    const maxValue = Math.max(...positiveValues);
    const maxAchievableExpectedValue = maxValue;
    const targetExpectedValue = Math.min(
      baseExpectedValue * 1.1,
      maxAchievableExpectedValue
    );

    let low = 0;
    let high = 2;
    let exponent = 0;

    for (let i = 0; i < 14; i += 1) {
      const mid = (low + high) / 2;
      const adjustedTotalWeight = validItems.reduce((sum, item) => {
        const value = Math.max(0, Number(item.price ?? 0));
        const valueFactor = value > 0 ? Math.pow(value / minPositiveValue, mid) : 1;
        return sum + item.chance * valueFactor;
      }, 0);

      const adjustedExpectedValue = validItems.reduce((sum, item) => {
        const value = Math.max(0, Number(item.price ?? 0));
        const valueFactor = value > 0 ? Math.pow(value / minPositiveValue, mid) : 1;
        return sum + item.chance * valueFactor * value;
      }, 0) / adjustedTotalWeight;

      if (adjustedExpectedValue >= targetExpectedValue) {
        exponent = mid;
        high = mid;
      } else {
        low = mid;
      }
    }

    const adjustedWeights = validItems.map((item) => {
      const value = Math.max(0, Number(item.price ?? 0));
      const valueFactor = value > 0 ? Math.pow(value / minPositiveValue, exponent) : 1;
      return {
        item,
        weight: item.chance * valueFactor
      };
    });

    const adjustedTotalWeight = adjustedWeights.reduce((sum, entry) => sum + entry.weight, 0);
    let random = randomValue * adjustedTotalWeight;

    for (const entry of adjustedWeights) {
      if (random < entry.weight) return entry.item;
      random -= entry.weight;
    }

    return adjustedWeights[adjustedWeights.length - 1]?.item ?? validItems[validItems.length - 1];
  }, [items]);

  const getSpinSeedBase = useCallback((rollData?: { rollHash: string; rollValue: number; nonce: number }, stageTag = 'main') => {
    if (rollData?.rollHash) {
      return `${rollData.rollHash}:${rollData.nonce}:${stageTag}`;
    }
    return `${rollData?.rollValue ?? 0}:${rollData?.nonce ?? nonce}:${stageTag}`;
  }, [nonce]);

  const getApproachOffset = useCallback((rng: () => number) => {
    const direction = rng() < 0.5 ? -1 : 1;

    if (rng() < SPINNER_MOTION.nearMissChance) {
      const min = SPINNER_MOTION.approachOffsetNearMissMinPx;
      const max = SPINNER_MOTION.approachOffsetNearMissMaxPx;
      const magnitude = min + Math.round(rng() * (max - min));
      return direction * magnitude;
    }

    const softMagnitude = Math.round(rng() * SPINNER_MOTION.approachOffsetSoftMaxPx);
    return direction * softMagnitude;
  }, []);

  const generateReel = useCallback((target: CaseItem, pool: CaseItem[], options: { sprinkleGold: boolean; seed: string }) => {
    const { sprinkleGold, seed } = options;
    const rng = createSeededRng(seed);
    const winnerIndex = SPINNER_MOTION.preWinnerItems;
    const reelLength = SPINNER_MOTION.preWinnerItems + 1 + SPINNER_MOTION.postWinnerItems;
    const newReel: CaseItem[] = [];

    // Deterministic filler generation preserves visual variety while remaining reproducible.
    for (let i = 0; i < reelLength; i += 1) {
      if (i === winnerIndex) {
        newReel.push(target);
        continue;
      }

      const previous = newReel[newReel.length - 1];
      let next = pickFromPool(pool, rng);
      if (pool.length > 2 && previous && next.id === previous.id) {
        next = pickFromPool(pool, rng);
      }
      newReel.push(next);
    }

    if (sprinkleGold) {
      // Sparse deterministic gold inserts keep readability and premium spacing.
      const minSpacing = 14;
      const maxGoldInsertions = Math.max(1, Math.floor(reelLength / 26));
      let insertions = 0;
      let nextGold = Math.floor(rng() * minSpacing) + 8;

      while (nextGold < reelLength && insertions < maxGoldInsertions) {
        if (nextGold !== winnerIndex && newReel[nextGold]?.id !== target.id && newReel[nextGold]?.rarity !== 'legendary') {
          newReel[nextGold] = GOLDEN_TICKET_ITEM;
          insertions += 1;
        }
        nextGold += minSpacing + Math.floor(rng() * 8);
      }
    }

    return { items: newReel, winnerIndex };
  }, []);

  const getCenteredTranslate = useCallback((winnerIndex: number, landingOffset = 0) => {
    const viewport = scrollViewportRef.current;
    const container = scrollContainerRef.current;
    const winnerCard = winningCardRef.current;

    if (!viewport || !container) {
      return null;
    }

    // Fallback for first-frame races: compute center using known card geometry.
    if (!winnerCard) {
      const viewportCenterX = viewport.clientWidth / 2;
      const winnerCenterX = (winnerIndex * (CARD_WIDTH + GAP_WIDTH)) + (CARD_WIDTH / 2);
      return viewportCenterX - winnerCenterX + landingOffset;
    }

    const viewportRect = viewport.getBoundingClientRect();
    const cardRect = winnerCard.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();

    const viewportCenterX = viewportRect.left + (viewportRect.width / 2);
    const winnerCenterX = cardRect.left + (cardRect.width / 2);
    const delta = viewportCenterX - winnerCenterX;

    return containerRect.left + delta - viewportRect.left + landingOffset;
  }, []);

  const resolveCenteredTranslate = useCallback(async (winnerIndex: number, landingOffset = 0) => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const next = getCenteredTranslate(winnerIndex, landingOffset);
      if (next !== null) return next;
      await waitForNextPaint();
    }
    return null;
  }, [getCenteredTranslate]);

  const resetSpinnerAnimation = useCallback(() => {
    if (spinnerAnimationRef.current) {
      spinnerAnimationRef.current.cancel();
      spinnerAnimationRef.current = null;
    }

    if (scrollContainerRef.current) {
      scrollContainerRef.current.getAnimations().forEach((animation) => animation.cancel());
      scrollContainerRef.current.style.transition = 'none';
      scrollContainerRef.current.style.transform = 'translate3d(0px, 0, 0)';
    }

    if (initialBlurTimerRef.current) {
      window.clearTimeout(initialBlurTimerRef.current);
      initialBlurTimerRef.current = null;
    }

    setIsInitialMotionBlurActive(false);
    setIsReelInFastMotion(false);
    setIsReelDecelerating(false);
  }, []);

  const animateSpin = useCallback(async (
    winnerIndex: number,
    duration: number,
    onComplete: () => void,
    options?: { playStartSound?: boolean; seed?: string }
  ) => {
    const container = scrollContainerRef.current;
    if (!container) {
      onComplete();
      return;
    }

    const shouldPlayStartSound = options?.playStartSound ?? true;
    const rng = createSeededRng(options?.seed ?? `${winnerIndex}:${duration}`);
    const approachOffset = getApproachOffset(rng);
    const durationVariance = Math.round((rng() - 0.5) * SPINNER_MOTION.durationVarianceMs * 2);
    const resolvedDuration = Math.max(3000, duration + durationVariance);

    if (shouldPlayStartSound) {
      playSound('spin-start');
    }

    resetSpinnerAnimation();

    container.style.transition = 'none';
    container.style.transform = 'translate3d(0px, 0, 0)';
    container.style.backfaceVisibility = 'hidden';

    await waitForNextPaint();

    const centeredTranslate = await resolveCenteredTranslate(winnerIndex, 0);
    const approachTranslate = centeredTranslate === null ? null : centeredTranslate + approachOffset;
    if (centeredTranslate === null || approachTranslate === null) {
      spinRequestLockRef.current = false;
      setIsSpinning(false);
      return;
    }

    const overshootDirection = approachOffset >= 0 ? -1 : 1;
    const overshootTarget = approachTranslate + (SPINNER_MOTION.overshootPx * overshootDirection);

    setIsReelInFastMotion(true);
    setIsInitialMotionBlurActive(true);
    setIsReelDecelerating(false);

    initialBlurTimerRef.current = window.setTimeout(() => {
      setIsInitialMotionBlurActive(false);
      initialBlurTimerRef.current = null;
    }, SPINNER_MOTION.initialBlurDurationMs);

    const animation = container.animate(
      [
        { transform: 'translate3d(0px, 0, 0)', offset: 0, easing: 'cubic-bezier(0.1, 0.9, 0.25, 1)' },
        { transform: `translate3d(${overshootTarget}px, 0, 0)`, offset: 0.8, easing: 'cubic-bezier(0.2, 1, 0.18, 1)' },
        { transform: `translate3d(${centeredTranslate}px, 0, 0)`, offset: 1, easing: 'cubic-bezier(0.14, 0.9, 0.22, 1)' }
      ],
      {
        duration: resolvedDuration,
        fill: 'forwards',
        composite: 'replace'
      }
    );

    spinnerAnimationRef.current = animation;

    const decelerationTimer = window.setTimeout(() => {
      setIsReelDecelerating(true);
    }, Math.max(0, resolvedDuration - 1500));

    animation.onfinish = () => {
      window.clearTimeout(decelerationTimer);
      if (initialBlurTimerRef.current) {
        window.clearTimeout(initialBlurTimerRef.current);
        initialBlurTimerRef.current = null;
      }
      setIsInitialMotionBlurActive(false);

      if (typeof animation.commitStyles === 'function') {
        animation.commitStyles();
      }
      animation.cancel();
      container.style.transition = 'none';
      container.style.transform = `translate3d(${centeredTranslate}px, 0, 0)`;

      setIsReelInFastMotion(false);
      setIsReelDecelerating(false);
      setIsLandingFlashActive(true);
      window.setTimeout(() => setIsLandingFlashActive(false), SPINNER_MOTION.settleDurationMs);
      spinnerAnimationRef.current = null;
      spinRequestLockRef.current = false;
      onComplete();
    };

    animation.oncancel = () => {
      window.clearTimeout(decelerationTimer);
      if (initialBlurTimerRef.current) {
        window.clearTimeout(initialBlurTimerRef.current);
        initialBlurTimerRef.current = null;
      }
      setIsInitialMotionBlurActive(false);
      setIsReelInFastMotion(false);
      setIsReelDecelerating(false);
      spinnerAnimationRef.current = null;
      spinRequestLockRef.current = false;
    };
  }, [getApproachOffset, playSound, resetSpinnerAnimation, resolveCenteredTranslate]);

  const updateClientSeed = useCallback(async () => {
    const nextSeed = clientSeedInput.trim();
    if (!isAuthenticated) {
      openAuthModal('login');
      return;
    }
    if (nextSeed.length < 1 || nextSeed.length > 64) {
      toast.error('Client seed must be between 1 and 64 characters.');
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
      toast.error('Unable to update client seed. Please try again.');
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
      toast.error('Unable to rotate server seed. Please try again.');
    } finally {
      setIsRotatingSeed(false);
    }
  }, [isAuthenticated, openAuthModal]);

  const preloadReelImages = useCallback(async (nextReelItems: CaseItem[]) => {
    const uniqueSources = Array.from(new Set(nextReelItems.map((item) => item.image).filter(Boolean)));

    await Promise.all(uniqueSources.map(async (src) => {
      const img = new Image();
      img.decoding = 'async';
      img.loading = 'eager';
      img.src = src;

      if (!img.complete) {
        await new Promise<void>((resolve) => {
          const settle = () => resolve();
          img.onload = settle;
          img.onerror = settle;
        });
      }

      if (typeof img.decode === 'function') {
        await img.decode().catch(() => undefined);
      }
    }));
  }, []);

  const waitForNextPaint = () => new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => resolve());
    });
  });

  const prepareReelForSpin = useCallback(async (nextReelItems: CaseItem[]) => {
    resetSpinnerAnimation();
    setIsReelInFastMotion(false);
    setIsReelDecelerating(false);
    setIsLandingFlashActive(false);
    winningCardRef.current = null;

    if (scrollContainerRef.current) {
      scrollContainerRef.current.style.transform = 'translate3d(0px, 0, 0)';
      scrollContainerRef.current.style.transition = 'none';
    }

    await preloadReelImages(nextReelItems);
    setReelItems(nextReelItems);
    await waitForNextPaint();
  }, [preloadReelImages, resetSpinnerAnimation]);



  const handleSpin = async ({ isDemo = false, forceGold = false, paymentMethod = 'coins' }: { isDemo?: boolean; forceGold?: boolean; paymentMethod?: 'coins' | 'xp' } = {}) => {
    if (isSpinning || spinRequestLockRef.current) return;
    if (!box || items.length === 0) return;

    spinRequestLockRef.current = true;
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
      spinRequestLockRef.current = false;
      openAuthModal('login');
      return;
    }

    if (!isDemo && !isFree) {
      if (isBalanceLoading) {
        spinRequestLockRef.current = false;
        return;
      }

      const usesXpPayment = caseCurrencyType === 'XP' || paymentMethod === 'xp';
      if (usesXpPayment) {
        const requiredXp = caseCurrencyType === 'XP' ? currentCaseXpPrice : xpCostForCoinCase;
        if (!Number.isFinite(requiredXp) || requiredXp <= 0 || currentXpBalance < requiredXp) {
          spinRequestLockRef.current = false;
          setSpinFeedbackMessage('Not enough XP to open this box.');
          return;
        }
      } else {
        if (!Number.isFinite(currentCasePrice) || currentCasePrice <= 0) {
          spinRequestLockRef.current = false;
          return;
        }

        const availableCoins = Number.isFinite(balance) ? balance : Number(user.balance ?? 0);
        if (!Number.isFinite(availableCoins)) {
          spinRequestLockRef.current = false;
          return;
        }

        if (availableCoins < currentCasePrice) {
          spinRequestLockRef.current = false;
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
        spinRequestLockRef.current = false;
        openAuthModal('login');
        return;
      }
      if (!canFreeSpin) {
        spinRequestLockRef.current = false;
        toast.info("Free signup box already claimed.");
        return;
      }
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
      winner = getDemoWinningItem(rollValue);
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
          freeBoxClaimedAt?: number;
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
          body: JSON.stringify({ boxId: box.id, isFree, operationId, paymentMethod })
        });

        trackEvent('OpenBox', {
          box_id: box.id,
          box_name: box.name,
          box_price: Number(data.price ?? box.price ?? 0),
          currency_type: data.currencyType ?? (paymentMethod === 'xp' ? 'XP' : 'COIN'),
          is_free: Boolean(isFree)
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
        if (isFree && Number.isFinite(data.freeBoxClaimedAt)) {
          await claimFreeBox(data.freeBoxClaimedAt, { persist: false });
        }
        if ((data.currencyType ?? 'COIN') === 'COIN') {
          syncBalance(Number(data.newCoinBalance ?? data.newCoins ?? 0));
          if (!isFree) {
            const spentAmount = toCoins(Number(data.price ?? box?.price ?? 0), PRICE_UNIT_MODE);
            registerSpend(spentAmount);
          }
        }
        if (import.meta.env.DEV) {
          console.info('Case-open XP debug', {
            caseId: box.id,
            xpAwarded: Number(data.xpAwarded ?? 0),
            newXpBalance: Number(data.newXpBalance ?? 0),
            currencyType: data.currencyType ?? 'COIN',
            xpSettingsUsed: data.xpSettingsUsed ?? null
          });
        }
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
        const rawMessage = error instanceof Error ? error.message : 'OPEN_FAILED: Unable to open box.';
        const readableMessage = rawMessage.includes(':') ? rawMessage.split(':').slice(1).join(':').trim() : rawMessage;
        const errorCode = rawMessage.includes(':') ? rawMessage.split(':')[0] : 'OPEN_FAILED';

        console.error('Failed to open box', {
          status,
          code: errorCode,
          message: readableMessage,
          boxId: box.id
        });
        setIsSpinning(false);
        setIsBoxPreviewVisible(true);
        setIsBoxPreviewFading(false);
        setSpinFeedbackMessage(readableMessage || 'Unable to open box.');
        toast.error(readableMessage || 'Unable to open box.');
        spinRequestLockRef.current = false;
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
      activityStore.add({
        userId: user.id,
        type: 'open',
        title: `Opened ${box.name} → ${winner.name}`,
        value: toCoins(Number(winner.price ?? 0), PRICE_UNIT_MODE),
        provablyFairData: {
          serverSeedHash: rollServerHash,
          clientSeed: rollClientSeed,
          nonce: rollNonce,
          winningItem: winner.name,
          resultIndex: Math.floor(rollValue * 1000000)
        },
        meta: { boxId: box.id }
      });
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
        const ticketSeed = getSpinSeedBase({ rollHash, rollValue, nonce: rollNonce }, 'gold-ticket');
        const ticketReelResult = generateReel(GOLDEN_TICKET_ITEM, items, { sprinkleGold: true, seed: ticketSeed });
        await prepareReelForSpin(ticketReelResult.items);

        animateSpin(ticketReelResult.winnerIndex, SPINNER_MOTION.goldTicketDurationMs, () => {
            // Stage 1 Complete: Activate Gold Mode
            playSound('gold-mode');
            setIsGoldMode(true);
            
            // Wait a moment to see the ticket
            window.setTimeout(() => {
                // Stage 2: Spin to Actual Winner (using only legendary items in reel)
                const pool = legendaryPool.length > 0 ? legendaryPool : items;
                const goldSeed = getSpinSeedBase({ rollHash, rollValue, nonce: rollNonce }, 'gold-final');
                const goldReelResult = generateReel(winner, pool, { sprinkleGold: true, seed: goldSeed });
                void prepareReelForSpin(goldReelResult.items).then(() => {
                  animateSpin(goldReelResult.winnerIndex, SPINNER_MOTION.goldFinalDurationMs, () => {
                    // Stage 2 Complete
                    finishSpin(winner);
                  }, { playStartSound: false });
                });
            }, 700);
        });

    } else {
        // --- NORMAL SPIN FLOW ---
        const mainSeed = getSpinSeedBase({ rollHash, rollValue, nonce: rollNonce }, 'main');
        const normalReelResult = generateReel(winner, items, { sprinkleGold: true, seed: mainSeed });
        await prepareReelForSpin(normalReelResult.items);

        animateSpin(normalReelResult.winnerIndex, SPINNER_MOTION.spinDurationMs, () => {
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

  useEffect(() => {
    if (!showXpOpenUi) {
      setShowXpConfirmSheet(false);
    }
  }, [showXpOpenUi]);

  useEffect(() => {
    return () => {
      resetSpinnerAnimation();
    };
  }, [resetSpinnerAnimation]);

  const finishSpin = (item: CaseItem) => {
    spinRequestLockRef.current = false;
    setIsSpinning(false);
    setIsBoxPreviewVisible(true);
    setIsBoxPreviewFading(false);

    setShowWinModal(true);
    if (!prefersReducedMotion && ['rare','ultra rare','legendary'].includes(String(item.rarity).toLowerCase())) {
      const particles = createMicroConfetti(18);
      setConfetti(particles);
      window.setTimeout(() => setConfetti([]), 720);
    }
    setWonItem(item);
    setRewardResolved(false);
  };

  const resetReelTrackPosition = useCallback(() => {
    window.requestAnimationFrame(() => {
      if (!scrollContainerRef.current) return;
      scrollContainerRef.current.style.transition = 'none';
      scrollContainerRef.current.style.transform = 'translate3d(0px, 0, 0)';
      scrollContainerRef.current.getAnimations().forEach((animation) => animation.cancel());
    });
  }, []);



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
    resetReelTrackPosition();
    setWonInventoryItem(null);
    setSellOfferGenerated(false);
  };

  const handleSell = async () => {
    playSound('click');
    if (wonItem?.redeemable === false) {
        toast.error('This item is not redeemable and cannot be sold back.');
        return;
    }
    if (isDemoSpin || isGeneratingSellOffer || isSellingItem) {
        if (isDemoSpin) {
          closeWinModal();
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
    closeWinModal();
    setIsGeneratingSellOffer(false);
    setIsSellingItem(false);
  };


  const handleShareUnboxing = useCallback(async () => {
    playSound('click');

    if (typeof window === 'undefined' || !wonItem) return;

    const caseName = box?.name ?? 'Mystery Box';
    const shareText = `I just unboxed ${wonItem.name} from ${caseName} on pullz.gg!`;
    const shareUrl = window.location.href;

    try {
      const shareImage = await createShareImageFile(wonItem, caseName);
      const supportsFileShare = Boolean(
        shareImage
        && navigator.canShare
        && navigator.canShare({ files: [shareImage] })
      );

      if (navigator.share) {
        await navigator.share({
          title: 'pullz.gg Unboxing',
          text: shareText,
          url: shareUrl,
          ...(supportsFileShare ? { files: [shareImage] } : {})
        });
        toast.success(supportsFileShare ? 'Shared with image.' : 'Shared successfully.');
        return;
      }

      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(`${shareText} ${shareUrl}`);
        toast.success('Share text copied to clipboard.');
        return;
      }

      toast.info('Sharing is not supported on this device.');
    } catch (error) {
      if ((error as Error)?.name === 'AbortError') return;
      toast.error('Unable to share right now. Please try again.');
    }
  }, [box?.name, playSound, wonItem]);

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
      toast.success('Provably fair proof copied to clipboard.');
    } else {
      toast.info(proof);
    }
  }, [lastReveal?.serverSeed, lastRoll, playSound]);

  return (
    <div className="w-full max-w-7xl mx-auto p-4 sm:p-6 animate-in fade-in zoom-in-95 duration-300">
      {!isReady ? (
        <div className="min-h-[60vh] flex items-center justify-center px-4">
          <div className="text-center max-w-sm">
            <p className="text-white text-lg font-semibold">Loading box...</p>
            <p className="text-gray-400 text-sm mt-2">We&apos;re syncing the drops and odds for this box.</p>
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
                    <ChevronLeft className="w-4 h-4" /> All boxes
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

            <div className="relative z-20 px-2 pt-2 pb-3 sm:px-3 sm:pt-3 sm:pb-3">
              <div className="flex flex-wrap items-center gap-1.5 rounded-2xl border border-white/15 bg-black/50 p-1.5 shadow-[0_0_24px_rgba(45,212,191,0.12)] backdrop-blur-md sm:gap-2 sm:p-2">
                <div className="flex min-w-0 flex-1 items-center">
                  {showXpOpenUi && (
                    <button
                      type="button"
                      onClick={() => {
                        if (isSpinning || spinRequestLockRef.current || isSyncingFair || isRotatingSeed || isBalanceLoading) return;
                        playSound('click');
                        setShowXpConfirmSheet(true);
                      }}
                      disabled={isSpinning || spinRequestLockRef.current || isSyncingFair || isRotatingSeed || isBalanceLoading}
                      className={`group inline-flex items-center gap-2 rounded-lg border bg-black/55 px-2 py-1 shadow-xl backdrop-blur-sm transition-all disabled:cursor-not-allowed disabled:opacity-60 ${canOpenWithXp ? 'border-cyan-300/45 shadow-[0_0_16px_rgba(34,211,238,0.3)] hover:shadow-[0_0_20px_rgba(34,211,238,0.45)]' : 'border-white/20 hover:border-cyan-300/45'}`}
                      aria-label={`Open with XP: ${currentXpBalance.toLocaleString()} / ${xpCostForCoinCase.toLocaleString()}`}
                      title={`Open with XP: ${currentXpBalance.toLocaleString()} / ${xpCostForCoinCase.toLocaleString()}`}
                    >
                      <div className="relative h-7 w-7 shrink-0 sm:h-8 sm:w-8">
                        <svg className="absolute inset-0 -rotate-90" width="28" height="28" viewBox="0 0 32 32" aria-hidden="true">
                          <circle cx="16" cy="16" r={xpRingRadius} fill="none" stroke="rgba(148,163,184,0.28)" strokeWidth="2.5" />
                          <circle
                            cx="16"
                            cy="16"
                            r={xpRingRadius}
                            fill="none"
                            stroke="rgba(34,211,238,0.95)"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeDasharray={xpRingCircumference}
                            strokeDashoffset={xpRingOffset}
                            className="transition-all duration-300 ease-out"
                          />
                        </svg>
                        <div className="absolute inset-[4px] grid place-items-center rounded-full border border-cyan-300/25 bg-[#111827]">
                          <img
                            loading="lazy"
                            decoding="async"
                            src={XP_ICON}
                            alt="XP"
                            className="block h-3.5 w-3.5 object-contain object-center sm:h-4 sm:w-4"
                          />
                        </div>
                      </div>
                      <span className="text-[9px] text-cyan-100/85 whitespace-nowrap sm:text-[10px]">{currentXpBalance.toLocaleString()} / {xpCostForCoinCase.toLocaleString()}</span>
                    </button>
                  )}
                </div>

                <div className="ml-auto">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        playSound('click');
                        setShowFairModal(true);
                      }}
                      className="group flex h-9 w-9 items-center justify-center rounded-md border border-white/15 bg-black/65 text-emerald-300 transition duration-200 hover:scale-105 hover:border-emerald-300/60 hover:text-emerald-200 hover:shadow-[0_0_14px_rgba(52,211,153,0.45)] sm:h-9 sm:w-9"
                      aria-label="Open provably fair details"
                      title="View fairness verification"
                    >
                      <ShieldCheck className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        playSound('click');
                        void handleCopyPageLink();
                      }}
                      className="group flex h-9 w-9 items-center justify-center rounded-md border border-white/15 bg-black/65 text-gray-200 transition duration-200 hover:scale-105 hover:border-cyan-300/60 hover:text-cyan-200 hover:shadow-[0_0_14px_rgba(34,211,238,0.45)] sm:h-9 sm:w-9"
                      aria-label="Copy server seed"
                      title="Copy server seed"
                    >
                      <Copy className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        playSound('click');
                        setShowInfoModal(true);
                      }}
                      className="group flex h-9 w-9 items-center justify-center rounded-md border border-white/15 bg-black/65 text-gray-200 transition duration-200 hover:scale-105 hover:border-amber-300/60 hover:text-amber-200 hover:shadow-[0_0_14px_rgba(252,211,77,0.4)] sm:h-9 sm:w-9"
                      aria-label="Open item availability disclaimer"
                      title="View case details"
                    >
                      <Info className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        playSound('click');
                        toggleMute();
                      }}
                      className="group flex h-9 w-9 items-center justify-center rounded-md border border-white/15 bg-black/65 text-gray-200 transition duration-200 hover:scale-105 hover:border-violet-300/60 hover:text-violet-200 hover:shadow-[0_0_14px_rgba(196,181,253,0.45)] sm:h-9 sm:w-9"
                      aria-label={muted ? 'Unmute sounds' : 'Mute sounds'}
                      title="Toggle sound effects"
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
            </div>

            {/* Spinner Window */}
            <div
              ref={scrollViewportRef}
              className="relative mx-auto flex h-[240px] w-full max-w-[1000px] items-center overflow-hidden rounded-2xl border border-white/5 bg-[rgba(255,255,255,0.02)] shadow-[inset_0_0_30px_rgba(0,0,0,0.5)]"
            >
                {spinnerBackgroundImage && (
                  <>
                    <img
                      src={spinnerBackgroundImage}
                      alt=""
                      aria-hidden="true"
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/45" aria-hidden="true" />
                  </>
                )}
                {isBoxPreviewVisible && (
                  <div
                    className={`absolute inset-0 z-30 flex items-start justify-center px-3 pt-3 transition-opacity duration-500 sm:items-center sm:px-6 sm:pt-0 ${isBoxPreviewFading ? 'opacity-0' : 'opacity-100'}`}
                    aria-live="polite"
                  >
                    <div className={`pullz-box-preview relative w-full max-w-[320px] sm:max-w-[380px] rounded-2xl border p-4 sm:p-5 backdrop-blur-sm ${isGoldMode ? 'border-yellow-400/50 bg-yellow-500/10' : 'border-cyan-400/40 bg-cyan-500/10'}`}>
                      <div className="pullz-box-preview__shimmer" aria-hidden="true"></div>
                      <div className="pullz-box-preview__image-wrap relative z-10 mx-auto w-full max-w-[240px] sm:max-w-[280px]">
                        <span className="pullz-box-spark pullz-box-spark--one" aria-hidden="true" />
                        <span className="pullz-box-spark pullz-box-spark--two" aria-hidden="true" />
                        <span className="pullz-box-spark pullz-box-spark--three" aria-hidden="true" />
                        <span className="pullz-box-spark pullz-box-spark--four" aria-hidden="true" />
                        <img
                          src={box!.image}
                          alt={`${box!.name} box`}
                          className="pullz-box-preview__image mx-auto h-40 w-auto max-w-full object-contain sm:h-44"
                        />
                      </div>
                    </div>
                  </div>
                )}

                <div
                  className={`absolute inset-y-0 left-1/2 z-[26] w-[2px] -translate-x-1/2 pointer-events-none ${isGoldMode ? 'bg-gradient-to-b from-transparent via-yellow-300/80 to-transparent' : 'bg-gradient-to-b from-transparent via-cyan-300/80 to-transparent'}`}
                  style={{ boxShadow: isGoldMode ? '0 0 14px rgba(250,204,21,0.55)' : '0 0 14px rgba(0,234,255,0.55)' }}
                  aria-hidden="true"
                />
                <div
                  className={`absolute inset-y-0 left-1/2 z-[24] w-14 -translate-x-1/2 pointer-events-none transition-opacity duration-500 sm:w-20 ${isSpinning ? (isReelDecelerating ? 'opacity-85' : 'opacity-55') : 'opacity-35'}`}
                  style={{
                    background: isGoldMode
                      ? 'radial-gradient(ellipse at center, rgba(250,204,21,0.24) 0%, rgba(250,204,21,0.08) 42%, rgba(250,204,21,0) 75%)'
                      : 'radial-gradient(ellipse at center, rgba(34,211,238,0.24) 0%, rgba(34,211,238,0.08) 42%, rgba(34,211,238,0) 75%)'
                  }}
                  aria-hidden="true"
                />
                
                {/* Fade Gradients */}
                <div className="pointer-events-none absolute bottom-0 left-0 top-0 z-20 w-20 bg-gradient-to-r from-[#070b12] via-[#070b12]/85 to-transparent sm:w-28"></div>
                <div className="pointer-events-none absolute bottom-0 right-0 top-0 z-20 w-20 bg-gradient-to-l from-[#070b12] via-[#070b12]/85 to-transparent sm:w-28"></div>

                <div
                  className={`absolute inset-0 z-[21] pointer-events-none transition-opacity duration-200 ${isInitialMotionBlurActive ? 'opacity-100' : 'opacity-0'}`}
                  style={{
                    background: isGoldMode
                      ? 'linear-gradient(100deg, rgba(0,0,0,0) 0%, rgba(250,204,21,0.08) 35%, rgba(255,255,255,0.14) 50%, rgba(250,204,21,0.08) 65%, rgba(0,0,0,0) 100%)'
                      : 'linear-gradient(100deg, rgba(0,0,0,0) 0%, rgba(34,211,238,0.06) 35%, rgba(255,255,255,0.12) 50%, rgba(34,211,238,0.06) 65%, rgba(0,0,0,0) 100%)',
                    backdropFilter: 'blur(1.5px)'
                  }}
                  aria-hidden="true"
                />

                {/* The Moving Reel */}
                <div 
                    ref={scrollContainerRef}
                    className={`flex will-change-transform transition-opacity duration-300 ${isBoxPreviewVisible ? 'opacity-0' : 'opacity-100'}`} 
                    style={{ gap: `${GAP_WIDTH}px`, transform: 'translate3d(0,0,0)', backfaceVisibility: 'hidden' }}
                >
                    {reelItems.map((item, idx) => (
                        <div 
                            key={`${item.id}-${idx}`}
                            ref={idx === SPINNER_MOTION.preWinnerItems ? winningCardRef : null}
                            className={`group relative flex h-[168px] w-[132px] flex-shrink-0 flex-col items-center justify-center overflow-hidden rounded-2xl border border-white/5 bg-[rgba(255,255,255,0.03)] p-2 transition-all duration-300 hover:border-cyan-200/35 hover:shadow-[0_0_18px_rgba(0,234,255,0.22)] sm:h-[210px] sm:w-[170px] sm:p-2.5 ${item.id === 'golden-ticket' ? 'border-yellow-500/60 shadow-[0_0_20px_rgba(234,179,8,0.35)]' : ''} ${isLandingFlashActive && idx === SPINNER_MOTION.preWinnerItems ? 'ring-2 ring-white/50' : ''}`}
                            style={{ 
                                boxShadow: item.id === 'golden-ticket'
                                  ? undefined
                                  : `${isLandingFlashActive && idx === SPINNER_MOTION.preWinnerItems ? `0 0 26px ${item.color}88, ` : ''}0 8px 24px rgba(0,0,0,0.45)`
                            }}
                            onMouseEnter={() => !isSpinning && playSound('hover')}
                        >
                            <div
                                className="pointer-events-none absolute left-1/2 top-1/2 h-20 w-16 -translate-x-1/2 -translate-y-1/2 rounded-[999px] opacity-90 blur-xl sm:h-28 sm:w-24"
                                style={{
                                  background: `${item.color}66`,
                                  boxShadow: `0 0 38px ${item.color}88`
                                }}
                            ></div>
                            <img loading="eager" decoding="async" 
                                src={item.image} 
                                alt={item.name} 
                                className={`relative z-10 mb-1 h-[6.4rem] w-[6.4rem] object-contain sm:h-32 sm:w-32 ${item.id === 'golden-ticket' ? 'animate-pulse scale-110' : ''}`} 
                            />
                            <div 
                                className="absolute bottom-0 left-0 right-0 h-[2px] opacity-60 rounded-b-2xl"
                                style={{ backgroundColor: item.color }}
                            ></div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Action Bar */}
            <div className="bg-[#0b0e14] px-3 pb-4 pt-3 sm:p-4 flex flex-col items-center justify-center gap-2.5 border-t border-gray-800 relative z-20">
                 <button 
                    onClick={() => handleSpin()}
                    disabled={isSpinning || spinRequestLockRef.current || isSyncingFair || isRotatingSeed || isBalanceLoading}
                    className={`w-full sm:w-auto min-w-[220px] px-8 py-3 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-lg shadow-lg transition-all active:scale-95 flex flex-col items-center leading-tight ${!isSpinning && canOpenMain ? 'ambient-pulse' : ''} ${isGoldMode ? 'bg-yellow-500 hover:bg-yellow-400 shadow-yellow-500/20 text-black' : (isFree ? 'bg-green-500 hover:bg-green-400 shadow-green-500/20 text-black' : 'btn-logo-gradient')}`}
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
                     disabled={isSpinning || spinRequestLockRef.current || isSyncingFair || isRotatingSeed}
                     className="inline-flex max-w-full items-center justify-center px-2 py-1 text-xs sm:text-sm font-semibold text-white transition hover:text-gray-200 disabled:cursor-not-allowed disabled:opacity-50"
                   >
                     Demo Spin
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


        {showXpConfirmSheet && showXpOpenUi && (
          <div className="fixed inset-0 z-[120]" role="dialog" aria-modal="true" aria-label="Use XP to open box">
            <button
              type="button"
              className="absolute inset-0 bg-black/55"
              onClick={() => setShowXpConfirmSheet(false)}
              aria-label="Close XP confirmation"
            />
            <div className="absolute inset-x-0 bottom-0 rounded-t-2xl border border-cyan-300/20 bg-[#0b0e14] p-4 shadow-2xl backdrop-blur-sm animate-in slide-in-from-bottom duration-300 sm:mx-auto sm:mb-6 sm:max-w-md sm:rounded-2xl">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-semibold text-white">Open this box with XP?</p>
                <button
                  type="button"
                  onClick={() => setShowXpConfirmSheet(false)}
                  className="flex h-9 w-9 items-center justify-center rounded-md border border-white/15 bg-black/50 text-gray-200"
                  aria-label="Close XP confirmation"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <p className="text-xs text-gray-300">Open with XP: <span className="font-semibold text-cyan-200">{currentXpBalance.toLocaleString()} / {xpCostForCoinCase.toLocaleString()}</span></p>
              {!canOpenWithXp && (
                <p className="mt-2 text-xs text-amber-300">You need more XP to open this box.</p>
              )}
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setShowXpConfirmSheet(false)}
                  className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm font-semibold text-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowXpConfirmSheet(false);
                    void handleSpin({ paymentMethod: 'xp' });
                  }}
                  disabled={!canOpenWithXp || isSpinning || spinRequestLockRef.current || isSyncingFair || isRotatingSeed || isBalanceLoading}
                  className="rounded-lg border border-cyan-300/35 bg-cyan-400/15 px-3 py-2 text-sm font-semibold text-cyan-100 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  Use XP
                </button>
              </div>
            </div>
          </div>
        )}

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
            <div className="mx-auto relative flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-3xl border-x border-t border-white/10 bg-[#131722]/95 backdrop-blur-xl shadow-[0_-10px_50px_rgba(0,0,0,0.75)] sm:max-h-[86vh]">
              {confetti.map((piece) => (
                <span
                  key={piece.id}
                  className="pointer-events-none absolute rounded-full"
                  style={{ left: `${piece.x}%`, top: `${piece.y}%`, width: piece.size, height: piece.size, background: piece.color, transform: `translate(${piece.dx}px, ${piece.dy}px)`, opacity: 0, animation: `fadeOut ${piece.life}ms ease-out forwards` }}
                />
              ))}
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
                  <BlurImage
                    src={wonItem.image}
                    alt={wonItem.name}
                    ratioClassName="relative z-10 mb-3 mx-auto h-32 w-32 shrink-0 sm:h-36 sm:w-36"
                    className="object-contain"
                  />
                  <h4 className="relative z-10 text-lg font-bold text-white">{wonItem.name}</h4>
                  <CoinAmount
                    amount={toCoins(wonItem.price, PRICE_UNIT_MODE)}
                    formatOptions={{ maximumFractionDigits: 0 }}
                    className="relative z-10 mt-2 font-semibold text-gray-200"
                    iconClassName="w-4 h-4"
                  />
                  <button type="button" onClick={() => setVerifyModalOpen(true)} className="relative z-10 mt-2 rounded-md border border-emerald-300/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-200">Verified ✓</button>
                </div>
              </div>

              <div className="border-t border-white/10 bg-black/20 p-4 sm:p-6">
                {isDemoSpin ? (
                  <button onClick={closeWinModal} className="h-12 w-full rounded-xl border border-white/10 bg-white/5 text-sm font-bold text-white transition hover:bg-white/10">Close</button>
                ) : (
                  <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                    <button
                      type="button"
                      onClick={() => void handleShareUnboxing()}
                      className="h-12 rounded-lg border border-cyan-300/35 bg-cyan-400/10 px-4 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-400/20 sm:h-14 sm:min-w-[160px] sm:flex-none"
                    >
                      <span className="inline-flex items-center justify-center gap-2">
                        <Share2 className="h-4 w-4" />
                        Share
                      </span>
                    </button>
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
                          <span className="inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 sm:px-0 sm:py-0">
                            <Wallet className="h-4 w-4" />
                            Selling item...
                          </span>
                        ) : isGeneratingSellOffer ? (
                          <span className="inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 sm:px-0 sm:py-0">
                            <Wallet className="h-4 w-4" />
                            Generating offer...
                          </span>
                        ) : sellOfferGenerated ? (
                          <span className="inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 sm:px-0 sm:py-0">
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
                          <span className="inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 sm:px-0 sm:py-0">
                            <Wallet className="h-4 w-4" />
                            Generate buy back offer
                          </span>
                        )}
                      </button>
                    )}
                    <button onClick={handleKeep} className="h-16 rounded-lg sm:h-14 sm:rounded-xl flex-1 btn-logo-gradient px-4 text-sm font-bold text-white"> 
                      <span className="inline-flex items-center gap-2 rounded-md px-3 py-2 sm:px-0 sm:py-0"><PackageOpen className="h-4 w-4" />Keep Item</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        <style>{`
          .ambient-pulse { animation: ambientPulse 3s ease-in-out infinite; }
          @keyframes ambientPulse { 0%,100% { transform: scale(1); box-shadow: 0 0 0 rgba(34,211,238,0.2);} 50% { transform: scale(1.02); box-shadow: 0 0 22px rgba(34,211,238,0.32);} }
          @keyframes fadeOut { from { opacity: 1; } to { opacity: 0; } }
          @media (prefers-reduced-motion: reduce){ .ambient-pulse { animation: none; } }
        `}</style>


        {/* Box Contents */}
        <div className="mt-12 border-t border-white/10 bg-[#0d1118] py-8 sm:py-10">
            <div className="mb-6 flex items-center gap-3">
                <div className="rounded-lg border border-white/10 bg-white/5 p-2">
                  <Gamepad2 className="h-5 w-5 text-indigo-300" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">Drop Table</h3>
                  <p className="text-xs text-gray-400">Tap an item to inspect details.</p>
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-[10px] font-medium text-gray-400">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-white/20 bg-white/10 text-[9px] font-bold text-gray-200">%</span>
                      Drop rate
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-amber-300/60 bg-amber-500/20 text-[9px] font-black text-amber-100">i</span>
                      Not redeemable for coins
                    </span>
                  </div>
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
                            <BlurImage src={item.image} alt={item.name} className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-105" />
                            {item.redeemable === false && (
                              <span className="absolute right-2 top-2 inline-flex h-5 w-5 items-center justify-center rounded-full border border-amber-300/60 bg-amber-500/20 text-[11px] font-black text-amber-100" aria-label="Not redeemable for coins" title="Not redeemable for coins">
                                i
                              </span>
                            )}
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
        <div className={`item-modal-overlay fixed inset-0 z-[110] bg-black/80 backdrop-blur-sm ${selectedCaseItem ? '' : 'pointer-events-none'} ${itemModalActive ? 'active' : ''}`} onClick={() => setSelectedCaseItem(null)} />
        <div className={`item-modal-sheet fixed bottom-0 left-0 right-0 z-[120] transform ${itemModalActive ? 'active' : ''}`}>
          <ProvablyFairModal isOpen={verifyModalOpen} onClose={() => setVerifyModalOpen(false)} data={{ serverSeedHash: lastRoll?.serverSeedHash, clientSeed: lastRoll?.clientSeed, nonce: lastRoll?.nonce, winningItem: wonItem?.name, resultIndex: lastRoll ? Math.floor(lastRoll.rollValue * 1000000) : undefined }} />

        {selectedCaseItem && (
            <div ref={itemModalRef} role="dialog" aria-modal="true" aria-labelledby="item-details-title" className={`modal-container mx-auto w-full max-w-lg overflow-hidden rounded-t-3xl border-x border-t border-white/10 bg-[#131722]/95 backdrop-blur-xl shadow-[0_-10px_50px_rgba(0,0,0,0.75)] ${itemModalActive ? 'active' : ''}`}>
              <div className="item-modal-hero relative flex h-64 sm:h-72 items-center justify-center overflow-hidden px-3" style={{ background: `radial-gradient(circle at top, ${selectedCaseItem.color}80 0%, transparent 72%)` }}>
                <div className={`item-modal-rarity-bg item-modal-rarity-bg--${String(selectedCaseItem.rarity ?? 'common').toLowerCase().replace(/\s+/g, '-')} ${itemModalActive ? 'is-active' : ''}`} aria-hidden="true" />
                <div className={`item-modal-rarity-glow ${itemModalActive ? 'is-active' : ''}`} aria-hidden="true" style={{ background: `radial-gradient(circle at center, ${selectedCaseItem.color}55 0%, transparent 70%)` }} />
                <button
                  ref={itemModalCloseRef}
                  type="button"
                  onClick={() => setSelectedCaseItem(null)}
                  className="absolute right-4 top-4 z-20 flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-black/40 text-white"
                  aria-label="Close item details"
                >
                  <X className="h-4 w-4" />
                </button>
                <img src={selectedCaseItem.image} alt={selectedCaseItem.name} className="item-modal-image relative z-10 h-48 w-48 object-contain drop-shadow-2xl sm:h-56 sm:w-56" />
              </div>
              <div className="space-y-5 px-5 py-6 sm:px-6">
                <div className="text-center">
                  <h3 id="item-details-title" className="text-balance text-xl font-bold text-white sm:text-2xl">{selectedCaseItem.name}</h3>
                  <div className="mt-2">
                    <span className={`rarity-badge ${String(selectedCaseItem.rarity ?? '').toLowerCase() === 'legendary' ? 'legendary-badge' : ''}`} style={String(selectedCaseItem.rarity ?? '').toLowerCase() === 'legendary' ? undefined : { color: selectedCaseItem.color, borderColor: `${selectedCaseItem.color}66`, backgroundColor: `${selectedCaseItem.color}1a` }}>
                      {selectedCaseItem.rarity ?? 'Item'}
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-white/10 bg-black/30 p-3 text-center">
                    <span className="block text-[10px] font-bold uppercase tracking-wide text-gray-400">Value</span>
                    <CoinAmount amount={animatedModalCoins} formatOptions={{ maximumFractionDigits: 0 }} className="mt-2 justify-center text-lg font-bold text-white" iconClassName="h-4 w-4" />
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
          .pullz-box-preview {
            overflow: hidden;
            animation: box-glow 2.1s ease-in-out infinite;
            transition: transform 260ms ease, box-shadow 260ms ease;
          }
          .pullz-box-preview::after {
            content: '';
            position: absolute;
            left: 50%;
            bottom: 26px;
            width: 70%;
            height: 26px;
            transform: translateX(-50%);
            border-radius: 999px;
            background: radial-gradient(circle, rgba(56, 189, 248, 0.44) 0%, rgba(56, 189, 248, 0.08) 55%, transparent 85%);
            filter: blur(6px);
            pointer-events: none;
          }
          .pullz-box-preview:hover {
            transform: translateY(-6px);
            box-shadow: 0 0 0 rgba(34, 211, 238, 0.35), 0 0 36px rgba(34, 211, 238, 0.38);
          }
          .pullz-box-preview__shimmer {
            position: absolute;
            inset: -20%;
            background: linear-gradient(110deg, transparent 30%, rgba(255, 255, 255, 0.35) 50%, transparent 70%);
            animation: box-shimmer 2s ease-in-out infinite;
          }
          .pullz-box-preview__image {
            transition: transform 260ms ease;
            will-change: transform;
          }
          .pullz-box-preview:hover .pullz-box-preview__image {
            transform: translateY(-4px);
          }
          .pullz-box-spark {
            position: absolute;
            width: 6px;
            height: 6px;
            border-radius: 999px;
            background: radial-gradient(circle, rgba(255,255,255,0.95), rgba(56,189,248,0.55) 55%, rgba(56,189,248,0) 100%);
            box-shadow: 0 0 12px rgba(56, 189, 248, 0.8);
            animation: boxSparkFloat 2.4s ease-in-out infinite;
            pointer-events: none;
          }
          .pullz-box-spark--one { top: 16%; left: 14%; animation-delay: 0s; }
          .pullz-box-spark--two { top: 30%; right: 12%; animation-delay: 0.45s; }
          .pullz-box-spark--three { bottom: 20%; left: 20%; animation-delay: 0.9s; }
          .pullz-box-spark--four { bottom: 14%; right: 18%; animation-delay: 1.2s; }
          @keyframes boxSparkFloat {
            0%, 100% { transform: translateY(0) scale(0.85); opacity: 0.45; }
            50% { transform: translateY(-10px) scale(1.1); opacity: 1; }
          }
          .item-modal-overlay {
            opacity: 0;
            transition: opacity 150ms ease;
          }
          .item-modal-overlay.active {
            opacity: 1;
          }
          .item-modal-sheet {
            transform: translateY(100%);
            transition: transform 250ms ease;
            will-change: transform;
          }
          .item-modal-sheet.active {
            transform: translateY(0);
          }
          .modal-container {
            transform: translateY(20px);
            opacity: 0;
            transition: transform 250ms ease, opacity 250ms ease;
          }
          .modal-container.active {
            transform: translateY(0);
            opacity: 1;
          }
          .item-modal-image {
            transform: scale(0.9);
            transition: transform 300ms ease;
            will-change: transform;
          }
          .modal-container.active .item-modal-image {
            transform: scale(1);
          }
          .item-modal-rarity-bg,
          .item-modal-rarity-glow {
            position: absolute;
            inset: 0;
            pointer-events: none;
            opacity: 0;
          }
          .item-modal-rarity-bg.is-active {
            opacity: 1;
          }
          .item-modal-rarity-bg--legendary {
            background: radial-gradient(circle at center, rgba(255, 215, 0, 0.35), transparent 70%);
            animation: legendaryPulse 2s ease-in-out infinite;
          }
          .item-modal-rarity-bg--rare {
            background: radial-gradient(circle at center, rgba(168, 85, 247, 0.28), transparent 72%);
          }
          .item-modal-rarity-bg--common,
          .item-modal-rarity-bg--uncommon,
          .item-modal-rarity-bg--epic,
          .item-modal-rarity-bg--ultra-rare {
            background: radial-gradient(circle at center, rgba(148, 163, 184, 0.18), transparent 74%);
          }
          .item-modal-rarity-glow.is-active {
            animation: raritySinglePulse 600ms ease-out 1;
          }
          .rarity-badge {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            border-radius: 999px;
            border: 1px solid;
            padding: 6px 14px;
            font-size: 11px;
            font-weight: 700;
            letter-spacing: 0.03em;
            text-transform: uppercase;
            line-height: 1;
          }
          .legendary-badge {
            background: linear-gradient(90deg, #ffd700, #ffb300, #ffd700);
            background-size: 220% 100%;
            color: #0b0f15;
            font-weight: 700;
            padding: 6px 14px;
            border-radius: 999px;
            box-shadow: 0 0 12px rgba(255, 215, 0, 0.6);
            animation: badgeShimmer 3s linear infinite;
            font-size: 11px;
            letter-spacing: 0.03em;
            text-transform: uppercase;
          }
          @keyframes legendaryPulse {
            0% { opacity: 0.5; }
            50% { opacity: 1; }
            100% { opacity: 0.5; }
          }
          @keyframes raritySinglePulse {
            0% { opacity: 0.3; transform: scale(0.95); }
            70% { opacity: 1; transform: scale(1.02); }
            100% { opacity: 0; transform: scale(1); }
          }
          @keyframes badgeShimmer {
            0% { background-position: -200px 0; }
            100% { background-position: 200px 0; }
          }
          @media (max-width: 640px) {
            .rarity-badge,
            .legendary-badge {
              padding: 5px 12px;
              font-size: 10px;
            }
            .pullz-box-preview::after {
              width: 78%;
              bottom: 22px;
            }
          }
          @media (prefers-reduced-motion: reduce) {
            .item-modal-overlay,
            .item-modal-sheet,
            .modal-container,
            .item-modal-image,
            .item-modal-rarity-bg--legendary,
            .item-modal-rarity-glow,
            .legendary-badge,
            .pullz-box-preview,
            .pullz-box-preview__image,
            .pullz-box-spark {
              animation: none !important;
              transition: none !important;
            }
            .pullz-box-preview:hover,
            .pullz-box-preview:hover .pullz-box-preview__image {
              transform: none !important;
            }
          }
        `}</style>
        </>
      )}
    </div>
  );
};
