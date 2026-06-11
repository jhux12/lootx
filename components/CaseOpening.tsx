import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { ChevronLeft, Volume2, VolumeX, Info, X, ShieldCheck, Check, PackageOpen, Wallet, Copy, Share2, Zap, Loader2 } from 'lucide-react';
import { GOLDEN_TICKET_ITEM, XP_ICON } from '../constants';
import { CoinAmount } from './CoinAmount';
import { CaseItem, InventoryItem } from '../types';
import { useGame } from '../context/GameContext';
import { useSound } from '../context/SoundContext';
import { Input } from './ui/Input';
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
import { usePerformanceMode } from '../src/lib/performance';
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

const DESKTOP_CARD_WIDTH = 186;
const DESKTOP_CARD_HEIGHT = 226;
const DESKTOP_GAP_WIDTH = 8;
const DESKTOP_SPINNER_VIEWPORT_HEIGHT = 260;
const TABLET_CARD_WIDTH = 174;
const TABLET_CARD_HEIGHT = 220;
const TABLET_SPINNER_VIEWPORT_HEIGHT = 252;
const MOBILE_CARD_WIDTH = 138;
const MOBILE_CARD_HEIGHT = 196;
const MOBILE_SPINNER_VIEWPORT_HEIGHT = 220;

// Spinner tuning constants (kept centralized so motion can be adjusted safely).
const SPINNER_MOTION = {
  preWinnerItems: 64,
  postWinnerItems: 14,
  spinDurationMs: 11200,
  quickSpinDurationMs: 900,
  goldTicketDurationMs: 10400,
  quickGoldTicketDurationMs: 650,
  goldFinalDurationMs: 9600,
  quickGoldFinalDurationMs: 800,
  goldStageDelayMs: 700,
  quickGoldStageDelayMs: 120,
  settleDurationMs: 2200,
  minSpinDurationMs: 6200,
  quickMinSpinDurationMs: 550,
  overshootPx: 10,
  approachOffsetSoftMaxPx: 10,
  approachOffsetNearMissMinPx: 20,
  approachOffsetNearMissMaxPx: 34,
  nearMissChance: 0.42,
  durationVarianceMs: 180,
  initialBlurDurationMs: 260,
  revealDelayMs: 760,
  landingOffsetMinPx: 18,
  landingOffsetMaxPx: 68
} as const;

const rarityGlowClass: Record<string, string> = {
  legendary: 'bg-amber-400/20',
  epic: 'bg-purple-500/20',
  ultra: 'bg-purple-500/20',
  rare: 'bg-blue-500/15',
  uncommon: 'bg-emerald-500/12',
  common: 'bg-slate-400/10'
};

const rarityIndicatorStyle: Record<string, { color: string; glow: string; label: string }> = {
  legendary: { color: '#fbbf24', glow: 'rgba(251,191,36,0.95)', label: 'Legendary' },
  epic: { color: '#a855f7', glow: 'rgba(168,85,247,0.9)', label: 'Epic' },
  ultra: { color: '#a855f7', glow: 'rgba(168,85,247,0.9)', label: 'Ultra Rare' },
  rare: { color: '#3b82f6', glow: 'rgba(59,130,246,0.9)', label: 'Rare' },
  uncommon: { color: '#22c55e', glow: 'rgba(34,197,94,0.85)', label: 'Uncommon' },
  common: { color: '#9ca3af', glow: 'rgba(156,163,175,0.65)', label: 'Common' }
};

const normalizeRarityKey = (rarity?: string) => {
  const value = String(rarity ?? 'common').toLowerCase();
  if (value.includes('legend')) return 'legendary';
  if (value.includes('ultra')) return 'ultra';
  if (value.includes('epic')) return 'epic';
  if (value.includes('uncommon')) return 'uncommon';
  if (value.includes('rare')) return 'rare';
  return 'common';
};

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

const SPINNER_RARITY_DISPLAY_WEIGHTS: Record<ReturnType<typeof normalizeRarityKey>, number> = {
  common: 64,
  uncommon: 32,
  rare: 16,
  ultra: 9,
  epic: 7,
  legendary: 3
};

const getSpinnerDisplayWeight = (item: Pick<CaseItem, 'rarity'>) => {
  const rarityKey = normalizeRarityKey(item.rarity);
  return SPINNER_RARITY_DISPLAY_WEIGHTS[rarityKey] ?? SPINNER_RARITY_DISPLAY_WEIGHTS.common;
};

const pickWeightedSpinnerItem = <T extends Pick<CaseItem, 'rarity'>>(pool: T[], rng: () => number): T => {
  if (pool.length === 0) {
    throw new Error('Cannot pick a spinner item from an empty pool.');
  }

  const fallback = pool[0];
  const weightedItems = pool.map((item) => ({ item, weight: getSpinnerDisplayWeight(item) }));
  const totalWeight = weightedItems.reduce((sum, entry) => sum + entry.weight, 0);

  if (!Number.isFinite(totalWeight) || totalWeight <= 0) {
    return fallback;
  }

  let random = rng() * totalWeight;
  for (const entry of weightedItems) {
    if (random < entry.weight) return entry.item;
    random -= entry.weight;
  }

  return weightedItems[weightedItems.length - 1]?.item ?? fallback;
};


const pickPremiumSpinnerItem = <T extends Pick<CaseItem, 'rarity'>>(pool: T[], rng: () => number): T | null => {
  const premiumPool = pool.filter((item) => ['rare', 'ultra', 'epic', 'legendary'].includes(normalizeRarityKey(item.rarity)));
  if (premiumPool.length === 0) return null;
  return premiumPool[Math.floor(rng() * premiumPool.length)] ?? premiumPool[0] ?? null;
};

const pickVisualItemByRarity = <T extends Pick<CaseItem, 'id' | 'rarity'>>(pool: T[], rarityKeys: string[], rng: () => number, excludeId?: string): T | null => {
  const raritySet = new Set(rarityKeys);
  const candidates = pool.filter((item) => normalizeRarityKey(item.rarity) && raritySet.has(normalizeRarityKey(item.rarity)) && item.id !== excludeId);
  if (candidates.length === 0) return null;
  return candidates[Math.floor(rng() * candidates.length)] ?? candidates[0] ?? null;
};

const resolveCenterTickSound = (rarity?: string) => {
  const rarityKey = normalizeRarityKey(rarity);
  if (rarityKey === 'legendary') return 'spin-tick-legendary' as const;
  if (rarityKey === 'epic') return 'spin-tick-epic' as const;
  if (rarityKey === 'ultra') return 'spin-tick-ultra' as const;
  if (rarityKey === 'rare') return 'spin-tick-rare' as const;
  return 'spin-tick' as const;
};

const formatSpinnerCoinValue = (value: number) => {
  const rounded = Math.max(0, Math.round(Number(value) || 0));
  if (rounded >= 1000000) return `${(rounded / 1000000).toFixed(rounded >= 10000000 ? 0 : 1)}M`;
  if (rounded >= 1000) return `${(rounded / 1000).toFixed(rounded >= 10000 ? 0 : 1)}K`;
  return rounded.toLocaleString();
};

const LANDING_ZONE_FACTORS = [-1, -0.76, -0.52, -0.28, 0.28, 0.52, 0.76, 1] as const;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
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
const AUTO_OPEN_BOX_STORAGE_KEY = 'pullz:auto-open-box-id';


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

      context.strokeStyle = 'rgba(32, 93, 215, 0.2)';
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
      context.strokeStyle = 'rgba(32,93,215,0.45)';
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

const formatUsdValueFromCoins = (coins: number) => `$${(Math.max(0, coins) / 100).toFixed(2)} value`;


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
  const { muted, toggleMute, unlockAudio, playSound } = useSound();
  const performanceMode = usePerformanceMode();

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
  const hideDropTableOdds = Boolean(isFree && box?.isDaily);
  const cheapestPaidBox = useMemo(() => {
    const paidBoxes = boxes.filter((entry) => {
      const coinPrice = toCoins(Number(entry.price ?? 0), PRICE_UNIT_MODE);
      return entry.isDaily !== true && (entry.currencyType ?? 'COIN') !== 'XP' && coinPrice > 0;
    });
    if (!paidBoxes.length) return null;
    return paidBoxes.reduce((lowest, next) => {
      const lowestPrice = toCoins(Number(lowest.price ?? 0), PRICE_UNIT_MODE);
      const nextPrice = toCoins(Number(next.price ?? 0), PRICE_UNIT_MODE);
      return nextPrice < lowestPrice ? next : lowest;
    });
  }, [boxes]);
  const cheapestPaidBoxPrice = useMemo(
    () => (cheapestPaidBox ? toCoins(Number(cheapestPaidBox.price ?? 0), PRICE_UNIT_MODE) : 0),
    [cheapestPaidBox]
  );

  // Sort items high to low for display purposes
  const displayItems = useMemo(() => [...items].sort(
    (a, b) => toCoins(b.price, PRICE_UNIT_MODE) - toCoins(a.price, PRICE_UNIT_MODE)
  ), [items]);

  const [isSpinning, setIsSpinning] = useState(false);
  const [isSpinnerAssetsLoading, setIsSpinnerAssetsLoading] = useState(true);
  const [reelItems, setReelItems] = useState<CaseItem[]>([]);
  const [reelWinnerIndex, setReelWinnerIndex] = useState(SPINNER_MOTION.preWinnerItems);
  const [currentCenterIndex, setCurrentCenterIndex] = useState(SPINNER_MOTION.preWinnerItems);
  const [wonItem, setWonItem] = useState<CaseItem | null>(null);
  const [wonInventoryItem, setWonInventoryItem] = useState<InventoryItem | null>(null);
  const [showWinModal, setShowWinModal] = useState(false);
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
  const [animationPhase, setAnimationPhase] = useState<'idle' | 'spinning' | 'settling'>('idle');
  const [hasSpinSettled, setHasSpinSettled] = useState(false);
  const [rareFlash, setRareFlash] = useState<{ rarity: string; nonce: number } | null>(null);
  const [showPostFreeBoxModal, setShowPostFreeBoxModal] = useState(false);
  const [postFreeBoxCoinsWon, setPostFreeBoxCoinsWon] = useState(0);
  const [postFreeBoxCoinsShort, setPostFreeBoxCoinsShort] = useState(0);
  const [isQuickSpinEnabled, setIsQuickSpinEnabled] = useState(false);
  const [visibleDropItemCount, setVisibleDropItemCount] = useState(() => (typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches ? 12 : 24));

  // Gold Spin State
  const [isGoldMode, setIsGoldMode] = useState(false);
  const [isBoxPreviewVisible, setIsBoxPreviewVisible] = useState(false);
  const [isBoxPreviewFading, setIsBoxPreviewFading] = useState(false);

  const scrollViewportRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const winningCardRef = useRef<HTMLDivElement>(null);
  const reelItemsRef = useRef<CaseItem[]>([]);
  const spinnerAnimationRef = useRef<Animation | null>(null);
  const tickTimerRef = useRef<number | null>(null);
  const tickFrameRef = useRef<number | null>(null);
  const rareFlashTimerRef = useRef<number | null>(null);
  const winRevealTimerRef = useRef<number | null>(null);
  const lastTickedCenterIndexRef = useRef<number>(-1);
  const lastCenterIndexRef = useRef<number>(SPINNER_MOTION.preWinnerItems);
  const spinnerMeasurementsRef = useRef({
    cardWidth: DESKTOP_CARD_WIDTH,
    reelGap: DESKTOP_GAP_WIDTH,
    viewportWidth: 0,
    stepWidth: DESKTOP_CARD_WIDTH + DESKTOP_GAP_WIDTH
  });
  const itemModalRef = useRef<HTMLDivElement>(null);
  const itemModalCloseRef = useRef<HTMLButtonElement>(null);
  const itemModalRevealFrameRef = useRef<number | null>(null);
  const itemModalCoinFrameRef = useRef<number | null>(null);
  const lastFocusedElementRef = useRef<HTMLElement | null>(null);
  const bodyOverflowRef = useRef<string>('');
  const topUpTriggerLockRef = useRef(false);
  const preFreeSpinBalanceRef = useRef<number | null>(null);
  const pendingPostFreeBoxFlowRef = useRef<{ coinsWon: number } | null>(null);
  const hasTrackedFreeBoxViewRef = useRef(false);
  const spinRequestLockRef = useRef(false);
  const isSpinningRef = useRef(false);
  const settleSoundPlayedRef = useRef(false);
  const winSoundPlayedRef = useRef(false);
  const winSoundTimerRef = useRef<number | null>(null);
  const confettiTimerRef = useRef<number | null>(null);
  const goldStageTimerRef = useRef<number | null>(null);
  const topUpLockTimerRef = useRef<number | null>(null);
  const canFreeSpin = !user.lastFreeBoxClaim;
  const prefersReducedMotion = performanceMode.prefersReducedMotion;
  const reduceMobileEffects = performanceMode.isMobile || performanceMode.isLowPower;
  const visibleDropItems = useMemo(() => displayItems.slice(0, visibleDropItemCount), [displayItems, visibleDropItemCount]);
  const hasMoreDropItems = visibleDropItemCount < displayItems.length;
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
  const spinnerCardWidth = performanceMode.isMobile
    ? MOBILE_CARD_WIDTH
    : (typeof window !== 'undefined' && window.innerWidth < 1024 ? TABLET_CARD_WIDTH : DESKTOP_CARD_WIDTH);
  const spinnerCardHeight = performanceMode.isMobile
    ? MOBILE_CARD_HEIGHT
    : (typeof window !== 'undefined' && window.innerWidth < 1024 ? TABLET_CARD_HEIGHT : DESKTOP_CARD_HEIGHT);
  const spinnerGap = DESKTOP_GAP_WIDTH;
  const spinnerViewportHeight = performanceMode.isMobile
    ? MOBILE_SPINNER_VIEWPORT_HEIGHT
    : (typeof window !== 'undefined' && window.innerWidth < 1024 ? TABLET_SPINNER_VIEWPORT_HEIGHT : DESKTOP_SPINNER_VIEWPORT_HEIGHT);
  // Keep desktop spinner behavior aligned with the mobile reel for smoother, sound-free spins.
  const useMobileSpinnerBehavior = true;
  const reduceSpinnerRerenders = reduceMobileEffects || prefersReducedMotion;
  const centeredSpinnerItem = reelItems[currentCenterIndex] ?? reelItems[reelWinnerIndex] ?? null;
  const centeredRarityKey = normalizeRarityKey(centeredSpinnerItem?.rarity);
  const centeredRarityIndicator = rarityIndicatorStyle[centeredRarityKey] ?? rarityIndicatorStyle.common;

  const updateSpinnerMeasurements = useCallback(() => {
    const viewport = scrollViewportRef.current;
    const container = scrollContainerRef.current;
    if (!viewport || !container) return;

    const firstCard = container.firstElementChild as HTMLElement | null;
    const cardWidth = firstCard?.offsetWidth ?? spinnerCardWidth;
    const reelGap = spinnerGap;
    const viewportWidth = viewport.clientWidth;

    spinnerMeasurementsRef.current = {
      cardWidth,
      reelGap,
      viewportWidth,
      stepWidth: Math.max(1, cardWidth + reelGap)
    };
  }, [spinnerCardWidth, spinnerGap]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const viewport = scrollViewportRef.current;
    const container = scrollContainerRef.current;
    if (!viewport || !container) return;

    updateSpinnerMeasurements();

    const observer = new ResizeObserver(() => {
      window.requestAnimationFrame(updateSpinnerMeasurements);
    });
    observer.observe(viewport);

    const firstCard = container.firstElementChild as HTMLElement | null;
    if (firstCard) observer.observe(firstCard);

    return () => observer.disconnect();
  }, [updateSpinnerMeasurements]);

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
        const staticReelLength = reduceMobileEffects ? 9 : 15;
        const staticItems = Array.from({ length: staticReelLength }, () =>
          pickWeightedSpinnerItem(items, Math.random)
        );
        const previewCenterIndex = Math.floor(staticItems.length / 2);
        reelItemsRef.current = staticItems;
        setReelItems(staticItems);
        setReelWinnerIndex(previewCenterIndex);
        setCurrentCenterIndex(previewCenterIndex);
        lastCenterIndexRef.current = previewCenterIndex;
        setHasSpinSettled(false);
    }
  }, [items, reduceMobileEffects]);

  useEffect(() => {
    setVisibleDropItemCount(performanceMode.isMobile ? 12 : 24);
  }, [boxId, performanceMode.isMobile]);

  const shouldHideMobileBottomNav = Boolean((showWinModal && wonItem) || selectedCaseItem || showXpConfirmSheet);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    window.dispatchEvent(new CustomEvent('pullz:mobile-bottom-nav-visibility', { detail: { hidden: shouldHideMobileBottomNav } }));

    return () => {
      window.dispatchEvent(new CustomEvent('pullz:mobile-bottom-nav-visibility', { detail: { hidden: false } }));
    };
  }, [shouldHideMobileBottomNav]);

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
    const preWinnerItems = reduceMobileEffects ? 42 : SPINNER_MOTION.preWinnerItems;
    const postWinnerItems = reduceMobileEffects ? 8 : SPINNER_MOTION.postWinnerItems;
    const winnerIndex = preWinnerItems;
    const reelLength = preWinnerItems + 1 + postWinnerItems;
    const newReel: CaseItem[] = [];

    // Deterministic filler generation preserves visual variety while remaining reproducible.
    for (let i = 0; i < reelLength; i += 1) {
      if (i === winnerIndex) {
        newReel.push(target);
        continue;
      }

      const previous = newReel[newReel.length - 1];
      let next = pickWeightedSpinnerItem(pool, rng);
      if (pool.length > 2 && previous && next.id === previous.id) {
        next = pickWeightedSpinnerItem(pool, rng);
      }
      newReel.push(next);
    }

    const premiumStopOffsets = [-4, -3, -2, 2, 3, 4];
    premiumStopOffsets.forEach((offset) => {
      const index = winnerIndex + offset;
      if (index <= 0 || index >= reelLength || index === winnerIndex) return;
      if (rng() > 0.58) return;
      const premiumItem = pickPremiumSpinnerItem(pool, rng);
      if (!premiumItem || premiumItem.id === target.id) return;
      newReel[index] = premiumItem;
    });

    const applyStopPair = (leftRarities: string[], rightRarities: string[]) => {
      const leftItem = pickVisualItemByRarity(pool, leftRarities, rng, target.id) ?? pickPremiumSpinnerItem(pool, rng);
      const rightItem = pickVisualItemByRarity(pool, rightRarities, rng, target.id) ?? pickPremiumSpinnerItem(pool, rng);
      if (leftItem && leftItem.id !== target.id) newReel[winnerIndex - 1] = leftItem;
      if (rightItem && rightItem.id !== target.id) newReel[winnerIndex + 1] = rightItem;
    };

    const stopCompositionRoll = rng();
    if (stopCompositionRoll < 0.11) {
      applyStopPair(['legendary'], ['legendary']);
    } else if (stopCompositionRoll < 0.22) {
      applyStopPair(['ultra', 'epic'], ['legendary']);
    } else if (stopCompositionRoll < 0.33) {
      applyStopPair(['legendary'], ['ultra', 'epic']);
    }

    if (sprinkleGold) {
      // Sparse deterministic gold inserts keep readability and premium spacing.
      const minSpacing = 14;
      const maxGoldInsertions = Math.max(1, Math.floor(reelLength / 26));
      let insertions = 0;
      let nextGold = Math.floor(rng() * minSpacing) + 8;

      while (nextGold < reelLength && insertions < maxGoldInsertions) {
        const isStopCompositionSlot = Math.abs(nextGold - winnerIndex) <= 4;
        if (!isStopCompositionSlot && nextGold !== winnerIndex && newReel[nextGold]?.id !== target.id && newReel[nextGold]?.rarity !== 'legendary') {
          newReel[nextGold] = GOLDEN_TICKET_ITEM;
          insertions += 1;
        }
        nextGold += minSpacing + Math.floor(rng() * 8);
      }
    }

    return { items: newReel, winnerIndex };
  }, [reduceMobileEffects]);

  const getCenteredTranslate = useCallback((winnerIndex: number, landingOffset = 0) => {
    const viewport = scrollViewportRef.current;
    const container = scrollContainerRef.current;

    if (!viewport || !container) {
      return null;
    }

    updateSpinnerMeasurements();
    const { cardWidth, stepWidth, viewportWidth } = spinnerMeasurementsRef.current;
    const resolvedViewportWidth = viewportWidth || viewport.clientWidth;
    const viewportCenterX = resolvedViewportWidth / 2;
    const winnerCenterX = (winnerIndex * stepWidth) + (cardWidth / 2);
    return viewportCenterX - winnerCenterX + landingOffset;
  }, [updateSpinnerMeasurements]);

  const getCenteredIndexFromTranslate = useCallback((translateX: number) => {
    const { cardWidth, stepWidth, viewportWidth } = spinnerMeasurementsRef.current;
    const viewportCenter = viewportWidth / 2;
    const renderedItemCount = scrollContainerRef.current?.children.length ?? 0;
    const reelLength = renderedItemCount || reelItemsRef.current.length || reelItems.length;
    if (!Number.isFinite(stepWidth) || stepWidth <= 0 || !Number.isFinite(cardWidth) || viewportCenter <= 0 || reelLength <= 0) {
      return 0;
    }
    return Math.max(
      0,
      Math.min(
        reelLength - 1,
        Math.round((viewportCenter - translateX - (cardWidth / 2)) / stepWidth)
      )
    );
  }, [reelItems.length]);

  const resolveCenteredTranslate = useCallback(async (winnerIndex: number, landingOffset = 0) => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const next = getCenteredTranslate(winnerIndex, landingOffset);
      if (next !== null) return next;
      await waitForNextPaint();
    }
    return null;
  }, [getCenteredTranslate]);

  const getTranslateBounds = useCallback(() => {
    const viewport = scrollViewportRef.current;
    const container = scrollContainerRef.current;
    if (!viewport || !container) return null;

    const measuredViewport = spinnerMeasurementsRef.current.viewportWidth || viewport.clientWidth;
    const minTranslate = Math.min(0, measuredViewport - container.scrollWidth);
    return { minTranslate, maxTranslate: 0 };
  }, []);

  const clampTranslate = useCallback((translateX: number) => {
    const bounds = getTranslateBounds();
    if (!bounds) return translateX;
    return clamp(translateX, bounds.minTranslate, bounds.maxTranslate);
  }, [getTranslateBounds]);

  const triggerRareCenterFlash = useCallback((item: CaseItem | undefined) => {
    if (reduceMobileEffects || prefersReducedMotion || !item) return;
    const rarityKey = normalizeRarityKey(item.rarity);
    if (!['rare', 'ultra', 'epic', 'legendary'].includes(rarityKey)) return;

    setRareFlash({ rarity: rarityKey, nonce: Date.now() });
    if (rareFlashTimerRef.current !== null) window.clearTimeout(rareFlashTimerRef.current);
    rareFlashTimerRef.current = window.setTimeout(() => {
      setRareFlash(null);
      rareFlashTimerRef.current = null;
    }, 260);
  }, [prefersReducedMotion, reduceMobileEffects]);

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

    if (tickTimerRef.current !== null) {
      window.clearTimeout(tickTimerRef.current);
      tickTimerRef.current = null;
    }
    if (tickFrameRef.current !== null) {
      window.cancelAnimationFrame(tickFrameRef.current);
      tickFrameRef.current = null;
    }
    lastTickedCenterIndexRef.current = -1;
    if (rareFlashTimerRef.current !== null) {
      window.clearTimeout(rareFlashTimerRef.current);
      rareFlashTimerRef.current = null;
    }
    setRareFlash(null);
    if (goldStageTimerRef.current !== null) {
      window.clearTimeout(goldStageTimerRef.current);
      goldStageTimerRef.current = null;
    }
    if (topUpLockTimerRef.current !== null) {
      window.clearTimeout(topUpLockTimerRef.current);
      topUpLockTimerRef.current = null;
    }
    setAnimationPhase('idle');
  }, []);

  useEffect(() => {
    isSpinningRef.current = isSpinning;
  }, [isSpinning]);

  const animateSpin = useCallback(async (
    winnerIndex: number,
    duration: number,
    onComplete: () => void,
    options?: { seed?: string }
  ) => {
    const container = scrollContainerRef.current;
    if (!container) {
      onComplete();
      return;
    }

    const rng = createSeededRng(options?.seed ?? `${winnerIndex}:${duration}`);
    const approachOffset = getApproachOffset(rng);
    const landingJitterPx = (rng() < 0.5 ? -1 : 1) * (4 + Math.round(rng() * 6));
    const durationVariance = Math.round((rng() - 0.5) * Math.min(180, SPINNER_MOTION.durationVarianceMs) * 2);
    const minDuration = duration < SPINNER_MOTION.minSpinDurationMs ? SPINNER_MOTION.quickMinSpinDurationMs : SPINNER_MOTION.minSpinDurationMs;
    const resolvedDuration = Math.max(minDuration, duration + durationVariance);
    const settlePortion = clamp(SPINNER_MOTION.settleDurationMs / resolvedDuration, 0.18, 0.3);
    const preSettleOffset = clamp(1 - settlePortion, 0.7, 0.82);
    const overshootOffset = clamp(preSettleOffset - 0.16, 0.54, 0.7);

    resetSpinnerAnimation();

    container.style.transition = 'none';
    container.style.transform = 'translate3d(0px, 0, 0)';
    container.style.backfaceVisibility = 'hidden';
    container.style.willChange = 'transform';

    // Two paint frames + layout read prevents mobile browsers from skipping early keyframes.
    await waitForNextPaint();
    await waitForNextPaint();
    // Force style/layout flush before starting WAAPI timeline.
    void container.getBoundingClientRect();
    updateSpinnerMeasurements();
    const startingCenterIndex = getCenteredIndexFromTranslate(0);
    lastCenterIndexRef.current = startingCenterIndex;
    lastTickedCenterIndexRef.current = startingCenterIndex;
    setCurrentCenterIndex(startingCenterIndex);

    const { cardWidth, stepWidth } = spinnerMeasurementsRef.current;
    const maxLandingOffset = Math.max(
      SPINNER_MOTION.landingOffsetMinPx,
      Math.min(
        SPINNER_MOTION.landingOffsetMaxPx,
        Math.round(cardWidth * 0.38),
        Math.max(SPINNER_MOTION.landingOffsetMinPx, Math.floor((stepWidth / 2) - 10))
      )
    );
    const zoneFactor = LANDING_ZONE_FACTORS[Math.floor(rng() * LANDING_ZONE_FACTORS.length)] ?? 1;
    const zoneMicroOffset = Math.round((rng() - 0.5) * 8);
    const landingOffset = clamp(
      Math.round(zoneFactor * maxLandingOffset) + zoneMicroOffset,
      -maxLandingOffset,
      maxLandingOffset
    );
    const landingTranslateRaw = await resolveCenteredTranslate(winnerIndex, landingOffset);
    const landingTranslate = landingTranslateRaw === null ? null : clampTranslate(landingTranslateRaw);
    const jitterLandingTranslate = landingTranslate === null ? null : clampTranslate(landingTranslate + landingJitterPx);
    const approachTranslate = landingTranslate === null ? null : clampTranslate(landingTranslate + approachOffset);
    if (landingTranslate === null || approachTranslate === null || jitterLandingTranslate === null) {
      spinRequestLockRef.current = false;
      setIsSpinning(false);
      return;
    }

    const overshootDirection = approachOffset >= 0 ? -1 : 1;
    const overshootTarget = clampTranslate(approachTranslate + (SPINNER_MOTION.overshootPx * overshootDirection));
    setAnimationPhase('spinning');

    const spinKeyframes: Keyframe[] = [
      { transform: 'translate3d(0px, 0, 0)', offset: 0, easing: 'cubic-bezier(0.24, 0.62, 0.18, 1)' },
      { transform: `translate3d(${overshootTarget}px, 0, 0)`, offset: overshootOffset, easing: 'cubic-bezier(0.12, 0.82, 0.2, 1)' },
      { transform: `translate3d(${jitterLandingTranslate}px, 0, 0)`, offset: preSettleOffset, easing: 'cubic-bezier(0.16, 0.72, 0.28, 1)' },
      { transform: `translate3d(${landingTranslate}px, 0, 0)`, offset: 1, easing: 'cubic-bezier(0.18, 0, 0.2, 1)' }
    ];

    const animation = container.animate(
      spinKeyframes,
      {
        duration: resolvedDuration,
        fill: 'forwards',
        composite: 'replace'
      }
    );

    spinnerAnimationRef.current = animation;
    let frameId: number | null = null;
    const syncCenterItem = () => {
      if (document.visibilityState === 'hidden') return;
      const transform = window.getComputedStyle(container).transform;
      const matrix = transform && transform !== 'none' ? new DOMMatrixReadOnly(transform) : null;
      const x = matrix ? matrix.m41 : 0;
      const index = getCenteredIndexFromTranslate(x);
      const previousIndex = lastCenterIndexRef.current;
      if (index !== previousIndex) {
        lastCenterIndexRef.current = index;
        if (isSpinningRef.current && index !== lastTickedCenterIndexRef.current) {
          playSound(resolveCenterTickSound(reelItemsRef.current[index]?.rarity));
          lastTickedCenterIndexRef.current = index;
        }
        triggerRareCenterFlash(reelItemsRef.current[index]);
        if (!reduceSpinnerRerenders) {
          setCurrentCenterIndex(index);
        }
      }
      tickFrameRef.current = window.requestAnimationFrame(syncCenterItem);
      frameId = tickFrameRef.current;
    };
    tickFrameRef.current = window.requestAnimationFrame(syncCenterItem);
    frameId = tickFrameRef.current;
    const decelerationTimer = window.setTimeout(
      () => setAnimationPhase('settling'),
      Math.max(0, resolvedDuration - SPINNER_MOTION.settleDurationMs)
    );

    animation.onfinish = () => {
      window.clearTimeout(decelerationTimer);
      if (tickTimerRef.current !== null) {
        window.clearTimeout(tickTimerRef.current);
        tickTimerRef.current = null;
      }

      if (typeof animation.commitStyles === 'function') {
        animation.commitStyles();
      }
      animation.cancel();
      container.style.transition = 'none';
      container.style.transform = `translate3d(${landingTranslate}px, 0, 0)`;
      container.style.willChange = 'auto';
      setCurrentCenterIndex(winnerIndex);
      lastCenterIndexRef.current = winnerIndex;
      setHasSpinSettled(true);
      if (frameId !== null) window.cancelAnimationFrame(frameId);
      tickFrameRef.current = null;

      setAnimationPhase('idle');
      spinnerAnimationRef.current = null;
      onComplete();
    };

    animation.oncancel = () => {
      window.clearTimeout(decelerationTimer);
      if (tickTimerRef.current !== null) {
        window.clearTimeout(tickTimerRef.current);
        tickTimerRef.current = null;
      }
      if (frameId !== null) window.cancelAnimationFrame(frameId);
      tickFrameRef.current = null;
      setAnimationPhase('idle');
      container.style.willChange = 'auto';
      spinnerAnimationRef.current = null;
      spinRequestLockRef.current = false;
    };
  }, [clampTranslate, getApproachOffset, getCenteredIndexFromTranslate, playSound, reduceSpinnerRerenders, resetSpinnerAnimation, resolveCenteredTranslate, triggerRareCenterFlash, updateSpinnerMeasurements]);

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
    setIsSpinnerAssetsLoading(true);
    const preloadLimit = reduceMobileEffects ? 10 : 28;
    const uniqueSources = Array.from(new Set(nextReelItems.map((item) => item.image).filter(Boolean))).slice(0, preloadLimit);

    await Promise.all(uniqueSources.map(async (src) => {
      const img = new Image();
      img.decoding = 'async';
      img.loading = 'eager';
      img.src = src;

      if (!img.complete) {
        await new Promise<void>((resolve) => {
          const timeoutId = window.setTimeout(resolve, reduceMobileEffects ? 650 : 1100);
          const settle = () => {
            window.clearTimeout(timeoutId);
            resolve();
          };
          img.onload = settle;
          img.onerror = settle;
        });
      }

      if (typeof img.decode === 'function') {
        await Promise.race([
          img.decode().catch(() => undefined),
          new Promise<void>((resolve) => window.setTimeout(resolve, reduceMobileEffects ? 450 : 850))
        ]);
      }
    }));
    setIsSpinnerAssetsLoading(false);
  }, [reduceMobileEffects]);

  useEffect(() => {
    if (!items.length) return;
    let isMounted = true;
    setIsSpinnerAssetsLoading(true);
    void preloadReelImages(items).finally(() => {
      if (!isMounted) return;
      setIsSpinnerAssetsLoading(false);
    });
    return () => {
      isMounted = false;
    };
  }, [items, preloadReelImages]);

  const waitForNextPaint = () => new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => resolve());
    });
  });

  const prepareReelForSpin = useCallback(async (nextReelItems: CaseItem[], winnerIndex: number) => {
    resetSpinnerAnimation();
    setHasSpinSettled(false);
    setAnimationPhase('idle');
    winningCardRef.current = null;

    if (scrollContainerRef.current) {
      scrollContainerRef.current.style.transform = 'translate3d(0px, 0, 0)';
      scrollContainerRef.current.style.transition = 'none';
    }

    reelItemsRef.current = nextReelItems;
    setReelItems(nextReelItems);
    setReelWinnerIndex(winnerIndex);
    await waitForNextPaint();
    await waitForNextPaint();
    updateSpinnerMeasurements();
    const startingCenterIndex = getCenteredIndexFromTranslate(0);
    lastCenterIndexRef.current = startingCenterIndex;
    setCurrentCenterIndex(startingCenterIndex);
  }, [getCenteredIndexFromTranslate, resetSpinnerAnimation, updateSpinnerMeasurements]);



  const handleSpin = async ({ isDemo = false, forceGold = false, paymentMethod = 'coins', isQuick = false }: { isDemo?: boolean; forceGold?: boolean; paymentMethod?: 'coins' | 'xp'; isQuick?: boolean } = {}) => {
    if (isSpinning || spinRequestLockRef.current) {
      if (isFree) {
        trackEvent('free_spin_duplicate_click_blocked', { box_id: box?.id ?? boxId });
      }
      return;
    }
    if (!box || items.length === 0) return;

    spinRequestLockRef.current = true;
    unlockAudio();
    settleSoundPlayedRef.current = false;
    winSoundPlayedRef.current = false;
    if (winSoundTimerRef.current !== null) {
      window.clearTimeout(winSoundTimerRef.current);
      winSoundTimerRef.current = null;
    }
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
            if (topUpLockTimerRef.current !== null) window.clearTimeout(topUpLockTimerRef.current);
            topUpLockTimerRef.current = window.setTimeout(() => {
              topUpTriggerLockRef.current = false;
              topUpLockTimerRef.current = null;
            }, 350);
          }
          return;
        }
      }
    }

    if (!isDemo && isFree) {
      trackEvent('free_spin_clicked', { box_id: box.id });
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
      preFreeSpinBalanceRef.current = Number.isFinite(balance) ? balance : Number(user.balance ?? 0);
    }

    setIsSpinning(true);
    if (!isDemo && isFree) {
      trackEvent('free_spin_started', { box_id: box.id });
    }
    setShowWinModal(false);
    setIsGoldMode(false);
    setWonItem(null);
    setWonInventoryItem(null);
    setRewardResolved(false);
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
          trackEvent('free_spin_completed', {
            box_id: box.id,
            value: toCoins(Number(data.prize.price ?? 0), PRICE_UNIT_MODE),
            currency: 'COIN'
          });
        }
        if ((data.currencyType ?? 'COIN') === 'COIN') {
          const updatedCoinBalance = Number(data.newCoinBalance ?? data.newCoins ?? 0);
          syncBalance(updatedCoinBalance);
          if (isFree) {
            const baselineBalance = Number(preFreeSpinBalanceRef.current ?? balance ?? user.balance ?? 0);
            const coinsWon = Math.max(0, Math.floor(updatedCoinBalance - baselineBalance));
            pendingPostFreeBoxFlowRef.current = { coinsWon };
          }
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
        setIsBoxPreviewVisible(false);
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
        await prepareReelForSpin(ticketReelResult.items, ticketReelResult.winnerIndex);

        const goldTicketDuration = isQuick ? SPINNER_MOTION.quickGoldTicketDurationMs : SPINNER_MOTION.goldTicketDurationMs;
        const goldFinalDuration = isQuick ? SPINNER_MOTION.quickGoldFinalDurationMs : SPINNER_MOTION.goldFinalDurationMs;
        const goldStageDelay = isQuick ? SPINNER_MOTION.quickGoldStageDelayMs : SPINNER_MOTION.goldStageDelayMs;
        animateSpin(ticketReelResult.winnerIndex, goldTicketDuration, () => {
            // Stage 1 Complete: Activate Gold Mode
            playSound('gold-mode');
            setIsGoldMode(true);

            // Wait a moment to see the ticket
            goldStageTimerRef.current = window.setTimeout(() => {
                // Stage 2: Spin to Actual Winner (using only legendary items in reel)
                const pool = legendaryPool.length > 0 ? legendaryPool : items;
                const goldSeed = getSpinSeedBase({ rollHash, rollValue, nonce: rollNonce }, 'gold-final');
                const goldReelResult = generateReel(winner, pool, { sprinkleGold: true, seed: goldSeed });
                void prepareReelForSpin(goldReelResult.items, goldReelResult.winnerIndex).then(() => {
                  animateSpin(goldReelResult.winnerIndex, goldFinalDuration, () => {
                    // Stage 2 Complete
                    finishSpin(winner);
                  });
                });
              goldStageTimerRef.current = null;
            }, goldStageDelay);
        });

    } else {
        // --- NORMAL SPIN FLOW ---
        const mainSeed = getSpinSeedBase({ rollHash, rollValue, nonce: rollNonce }, 'main');
        const normalReelResult = generateReel(winner, items, { sprinkleGold: true, seed: mainSeed });
        await prepareReelForSpin(normalReelResult.items, normalReelResult.winnerIndex);

        animateSpin(normalReelResult.winnerIndex, isQuick ? SPINNER_MOTION.quickSpinDurationMs : SPINNER_MOTION.spinDurationMs, () => {
            finishSpin(winner);
        });
    }
  };

  const handleTryFree = () => {
    setSpinFeedbackMessage(null);
    handleSpin({ isDemo: true, isQuick: isQuickSpinEnabled });
  };

  useEffect(() => {
    if (spinFeedbackMessage && showTopUpModal) {
      topUpTriggerLockRef.current = false;
    }
  }, [showTopUpModal, spinFeedbackMessage]);

  useEffect(() => {
    setIsBoxPreviewVisible(false);
    setIsBoxPreviewFading(false);
  }, [boxId]);

  useEffect(() => {
    if (!isFree || !box || hasTrackedFreeBoxViewRef.current) return;
    hasTrackedFreeBoxViewRef.current = true;
    trackEvent('free_box_page_viewed', { box_id: box.id, box_name: box.name });
  }, [box, isFree]);

  useEffect(() => {
    if (!showXpOpenUi) {
      setShowXpConfirmSheet(false);
    }
  }, [showXpOpenUi]);

  useEffect(() => {
    if (typeof document === 'undefined') return;

    const handleVisibilityChange = () => {
      const animation = spinnerAnimationRef.current;
      if (!animation) return;
      if (document.visibilityState === 'hidden') animation.pause();
      else animation.play();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  useEffect(() => {
    if (!hasSpinSettled || !isSpinning || settleSoundPlayedRef.current) return;
    settleSoundPlayedRef.current = true;
    playSound('spin-start');
  }, [hasSpinSettled, isSpinning, playSound]);

  useEffect(() => {
    return () => {
      if (confettiTimerRef.current !== null) {
        window.clearTimeout(confettiTimerRef.current);
        confettiTimerRef.current = null;
      }
      if (topUpLockTimerRef.current !== null) {
        window.clearTimeout(topUpLockTimerRef.current);
        topUpLockTimerRef.current = null;
      }
      if (winSoundTimerRef.current !== null) {
        window.clearTimeout(winSoundTimerRef.current);
        winSoundTimerRef.current = null;
      }
      if (winRevealTimerRef.current !== null) {
        window.clearTimeout(winRevealTimerRef.current);
        winRevealTimerRef.current = null;
      }
      if (rareFlashTimerRef.current !== null) {
        window.clearTimeout(rareFlashTimerRef.current);
        rareFlashTimerRef.current = null;
      }
      resetSpinnerAnimation();
    };
  }, [resetSpinnerAnimation]);

  const finishSpin = (item: CaseItem) => {
    setIsSpinning(false);
    setIsBoxPreviewVisible(false);
    setIsBoxPreviewFading(false);
    setWonItem(item);
    setRewardResolved(false);

    if (winRevealTimerRef.current !== null) window.clearTimeout(winRevealTimerRef.current);
    winRevealTimerRef.current = window.setTimeout(() => {
      setShowWinModal(true);
      spinRequestLockRef.current = false;
      winRevealTimerRef.current = null;
    }, SPINNER_MOTION.revealDelayMs);

    if (!winSoundPlayedRef.current) {
      const rarity = String(item.rarity ?? 'common').toLowerCase();
      winSoundTimerRef.current = window.setTimeout(() => {
        if (winSoundPlayedRef.current) return;
        if (rarity.includes('legend') || rarity.includes('mythic')) playSound('win-gold');
        else if (rarity.includes('epic')) playSound('win-epic');
        else if (rarity.includes('uncommon') || rarity.includes('rare')) playSound('win-rare');
        else playSound('win-common');
        winSoundPlayedRef.current = true;
        winSoundTimerRef.current = null;
      }, SPINNER_MOTION.revealDelayMs + 120);
    }
    if (!prefersReducedMotion && ['rare','ultra rare','legendary'].includes(String(item.rarity).toLowerCase())) {
      const particles = createMicroConfetti(reduceMobileEffects ? 10 : 18);
      setConfetti(particles);
      if (confettiTimerRef.current !== null) window.clearTimeout(confettiTimerRef.current);
      confettiTimerRef.current = window.setTimeout(() => {
        setConfetti([]);
        confettiTimerRef.current = null;
      }, reduceMobileEffects ? 520 : 720);
    }
  };

  const resetReelTrackPosition = useCallback(() => {
    window.requestAnimationFrame(() => {
      if (!scrollContainerRef.current) return;
      scrollContainerRef.current.style.transition = 'none';
      scrollContainerRef.current.style.transform = 'translate3d(0px, 0, 0)';
      scrollContainerRef.current.getAnimations().forEach((animation) => animation.cancel());
    });
  }, []);



  const closeWinModal = ({ redirectToBoxesCatalog = false }: { redirectToBoxesCatalog?: boolean } = {}) => {
    setIsSellingItem(false);
    if (!rewardResolved) {
      setRewardResolved(true);
    }
    setShowWinModal(false);
    resetReelTrackPosition();
    setWonInventoryItem(null);

    const shouldRedirectToCatalog = redirectToBoxesCatalog && isFree;
    if (shouldRedirectToCatalog) {
      setShowPostFreeBoxModal(false);
      pendingPostFreeBoxFlowRef.current = null;
      setView({ type: 'BOXES' });
      if (typeof window !== 'undefined') {
        window.history.replaceState({}, '', '/boxes');
      }
      return;
    }

    const pendingPostFreeBoxFlow = pendingPostFreeBoxFlowRef.current;
    if (pendingPostFreeBoxFlow) {
      const availableCoins = Number.isFinite(balance) ? balance : Number(user.balance ?? 0);
      setPostFreeBoxCoinsWon(pendingPostFreeBoxFlow.coinsWon);
      setPostFreeBoxCoinsShort(Math.max(0, Math.ceil(cheapestPaidBoxPrice - availableCoins)));
      setShowPostFreeBoxModal(true);
      pendingPostFreeBoxFlowRef.current = null;
    }
  };

  const handlePostFreePrimaryAction = () => {
    playSound('click');
    setShowPostFreeBoxModal(false);
    const availableCoins = Number.isFinite(balance) ? balance : Number(user.balance ?? 0);
    if (cheapestPaidBox && availableCoins >= cheapestPaidBoxPrice) {
      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem(AUTO_OPEN_BOX_STORAGE_KEY, cheapestPaidBox.id);
      }
      setView({ type: 'CASE_OPENING', boxId: cheapestPaidBox.id });
      return;
    }

    setTopUpModalIntent({
      reason: 'insufficient_balance',
      requiredCoins: cheapestPaidBoxPrice,
      currentBalance: availableCoins,
      missingCoins: Math.max(0, cheapestPaidBoxPrice - availableCoins),
      source: 'post_free_box',
      preferredPackageUsd: 50
    });
    setShowTopUpModal(true);
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!isReady || isSpinning || isFree || !box) return;
    const queuedBoxId = window.sessionStorage.getItem(AUTO_OPEN_BOX_STORAGE_KEY);
    if (!queuedBoxId || queuedBoxId !== box.id) return;
    window.sessionStorage.removeItem(AUTO_OPEN_BOX_STORAGE_KEY);
    void handleSpin();
  }, [box, handleSpin, isFree, isReady, isSpinning]);

  const handleSell = async () => {
    playSound('click');
    if (wonItem?.redeemable === false) {
        toast.error('This item is not redeemable and cannot be sold back.');
        return;
    }
    if (isDemoSpin || isSellingItem) {
        if (isDemoSpin) {
          closeWinModal();
        }
        return;
    }
    if (wonInventoryItem && !rewardResolved) {
        setIsSellingItem(true);
        try {
          await sellItem(wonInventoryItem.instanceId);
          setRewardResolved(true);
          if (isFree) {
            trackEvent('free_box_item_sold_back', {
              item_id: wonInventoryItem.id,
              value: getSellBackValue(toCoins(wonInventoryItem.price, PRICE_UNIT_MODE), sellBackRate),
              currency: 'COIN'
            });
          }
        } finally {
          setIsSellingItem(false);
        }
    }
    closeWinModal({ redirectToBoxesCatalog: true });
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
      if (wonItem && !rewardResolved) {
        setRewardResolved(true);
        if (isFree) {
          trackEvent('free_box_item_kept', {
            item_id: wonItem.id,
            value: toCoins(wonItem.price, PRICE_UNIT_MODE),
            currency: 'COIN'
          });
        }
      }
      setIsSellingItem(false);
      closeWinModal({ redirectToBoxesCatalog: true });
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
        <div className="mb-6 flex items-center justify-between gap-3">
            <div className="flex items-center gap-4">
                <button
                    onClick={() => { playSound('click'); setView({ type: 'BOXES' }); }}
                    className="min-h-11 flex items-center gap-2 rounded px-3 py-1.5 text-gray-400 text-sm font-medium transition-colors hover:text-white"
                >
                    <ChevronLeft className="w-4 h-4" /> All boxes
                </button>
                <div className="flex items-center gap-3">
                    {isFree && <span className="bg-yellow-500 text-black text-xs font-bold px-2 py-0.5 rounded">FREE SPIN</span>}
                </div>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-1.5">
              {showXpOpenUi && (
                <button
                  type="button"
                  onClick={() => {
                    if (isSpinning || spinRequestLockRef.current || isSyncingFair || isRotatingSeed || isBalanceLoading || isSpinnerAssetsLoading) return;
                    playSound('click');
                    setShowXpConfirmSheet(true);
                  }}
                  disabled={isSpinning || spinRequestLockRef.current || isSyncingFair || isRotatingSeed || isBalanceLoading || isSpinnerAssetsLoading}
                  className="inline-flex min-h-9 items-center rounded-md p-[1.5px] transition-all disabled:cursor-not-allowed disabled:opacity-60"
                  style={{ background: `conic-gradient(from -90deg, rgba(34, 211, 238, 0.9) ${xpProgress * 360}deg, rgba(255, 255, 255, 0.18) ${xpProgress * 360}deg 360deg)` }}
                  aria-label={`Open with XP: ${currentXpBalance.toLocaleString()} / ${xpCostForCoinCase.toLocaleString()}`}
                  title={`Open with XP: ${currentXpBalance.toLocaleString()} / ${xpCostForCoinCase.toLocaleString()}`}
                >
                  <span className={`inline-flex min-h-[32px] items-center rounded-[5px] px-2.5 py-1 text-[10px] font-semibold whitespace-nowrap sm:text-xs ${canOpenWithXp ? 'bg-cyan-400/10 text-cyan-100 hover:bg-cyan-400/15' : 'bg-black/35 text-gray-200'}`}>
                    XP
                  </span>
                </button>
              )}
              <button type="button" onClick={() => { playSound('click'); setShowFairModal(true); }} className="group flex h-9 w-9 items-center justify-center rounded-md border border-white/15 bg-black/65 text-emerald-300 transition duration-200 hover:scale-105 hover:border-emerald-300/60 hover:text-emerald-200 hover:shadow-[0_0_14px_rgba(52,211,153,0.45)] sm:h-9 sm:w-9" aria-label="Open provably fair details" title="View fairness verification"><ShieldCheck className="h-3.5 w-3.5 sm:h-4 sm:w-4" /></button>
              <button type="button" onClick={() => { playSound('click'); void handleCopyPageLink(); }} className="group flex h-9 w-9 items-center justify-center rounded-md border border-white/15 bg-black/65 text-gray-200 transition duration-200 hover:scale-105 hover:border-cyan-300/60 hover:text-cyan-200 hover:shadow-[0_0_14px_rgba(34,211,238,0.45)] sm:h-9 sm:w-9" aria-label="Copy server seed" title="Copy server seed"><Copy className="h-3.5 w-3.5 sm:h-4 sm:w-4" /></button>
              <button type="button" onClick={() => { playSound('click'); setShowInfoModal(true); }} className="group flex h-9 w-9 items-center justify-center rounded-md border border-white/15 bg-black/65 text-gray-200 transition duration-200 hover:scale-105 hover:border-amber-300/60 hover:text-amber-200 hover:shadow-[0_0_14px_rgba(252,211,77,0.4)] sm:h-9 sm:w-9" aria-label="Open item availability disclaimer" title="View case details"><Info className="h-3.5 w-3.5 sm:h-4 sm:w-4" /></button>
              <button type="button" onClick={() => { playSound('click'); toggleMute(); }} className="group flex h-9 w-9 items-center justify-center rounded-md border border-white/15 bg-black/65 text-gray-200 transition duration-200 hover:scale-105 hover:border-blue-300/60 hover:text-blue-200 hover:shadow-[0_0_14px_rgba(196,181,253,0.45)] sm:h-9 sm:w-9" aria-label={muted ? 'Unmute sounds' : 'Mute sounds'} title="Toggle sound effects">{muted ? <VolumeX className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> : <Volume2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}</button>
            </div>
    </div>

        {/* SPINNER AREA */}
        <div className="relative mb-8 w-full overflow-visible p-0">

            {/* Gold Mode Overlay Effect */}
            {isGoldMode && <div className="absolute inset-0 bg-yellow-500/5 animate-pulse pointer-events-none z-10"></div>}

            <div className="relative z-20 px-2 pb-3 pt-2 text-center sm:px-3 sm:pb-4 sm:pt-3">
              <h1 className="mx-auto max-w-[min(92vw,48rem)] truncate px-2 text-2xl font-black leading-tight tracking-tight text-white sm:text-4xl">
                {box?.name ?? 'Mystery Box'}
              </h1>
              {copyStatusMessage && (
                <p className="mx-auto mt-2 max-w-[92vw] text-center text-[10px] text-cyan-200 sm:text-xs" role="status" aria-live="polite">
                  {copyStatusMessage}
                </p>
              )}
            </div>

            {/* Spinner Window */}
            <div className="relative left-1/2 w-screen -translate-x-1/2" style={{ height: `${spinnerViewportHeight}px` }}>
            <div
              ref={scrollViewportRef}
              className="absolute left-1/2 top-1/2 flex h-full w-screen -translate-x-1/2 -translate-y-1/2 items-center overflow-hidden"
              style={{ height: `${spinnerViewportHeight}px` }}
            >
                {isSpinnerAssetsLoading && (
                  <div className="absolute inset-0 z-40 flex items-center justify-center bg-[#0a0f19]/75 px-4">
                    <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-black/40 px-4 py-2 text-xs font-semibold text-white sm:text-sm">
                      <Loader2 className="h-4 w-4 animate-spin text-cyan-300" />
                      Loading spinner items...
                    </div>
                  </div>
                )}



                {/* Fade Gradients */}
                <div className="pointer-events-none absolute bottom-0 left-0 top-0 z-20 w-10 bg-gradient-to-r from-[#1b2024] via-[#1b2024]/75 to-transparent sm:w-14"></div>
                <div className="pointer-events-none absolute bottom-0 right-0 top-0 z-20 w-10 bg-gradient-to-l from-[#1b2024] via-[#1b2024]/75 to-transparent sm:w-14"></div>

                {/* Premium Center Indicator */}
                <div
                  className="pointer-events-none absolute inset-y-0 left-1/2 z-30 -translate-x-1/2 motion-reduce:transition-none"
                  title={`${centeredRarityIndicator.label} item passing the spinner`}
                  aria-hidden="true"
                  style={{ ['--marker-color' as string]: centeredRarityIndicator.color, ['--marker-glow' as string]: centeredRarityIndicator.glow }}
                >
                  <div className="pullz-center-focus absolute left-1/2 top-1/2 h-[96%] w-52 -translate-x-1/2 -translate-y-1/2 rounded-full sm:w-64" />
                  {rareFlash && (
                    <div
                      key={rareFlash.nonce}
                      className={`pullz-rare-center-flash pullz-rare-center-flash-${rareFlash.rarity} absolute left-1/2 top-1/2 h-[86%] w-28 -translate-x-1/2 -translate-y-1/2 rounded-full sm:w-36`}
                    />
                  )}
                  <i className="fa-solid fa-caret-down pullz-marker-arrow pullz-marker-arrow-top absolute left-1/2 top-1 -translate-x-1/2 text-base leading-none sm:top-0 sm:text-lg" />
                  <span className="pullz-marker-beam absolute left-1/2 top-4 h-[calc(100%-2rem)] w-[3px] -translate-x-1/2 rounded-full sm:top-5 sm:h-[calc(100%-2.5rem)]" />
                  <i className="fa-solid fa-caret-up pullz-marker-arrow pullz-marker-arrow-bottom absolute bottom-1 left-1/2 -translate-x-1/2 text-base leading-none sm:bottom-0 sm:text-lg" />
                </div>

                {/* The Moving Reel */}
                <div
                    ref={scrollContainerRef}
                    className="pullz-spinner-track flex will-change-transform transition-opacity duration-300 opacity-100"
                    style={{
                      gap: `${spinnerGap}px`,
                      transform: 'translate3d(0,0,0)',
                      backfaceVisibility: 'hidden',
                      WebkitBackfaceVisibility: 'hidden',
                      transformStyle: 'flat',
                      WebkitTransformStyle: 'flat'
                    }}
                >
                    {reelItems.map((item, idx) => (
                        (() => {
                          const rarityValue = normalizeRarityKey(item.rarity);
                          const rarityGlow = rarityGlowClass[rarityValue] ?? rarityGlowClass.common;
                          const isSettledWinner = hasSpinSettled && animationPhase === 'idle' && idx === reelWinnerIndex;
                          const isCenteredItem = idx === currentCenterIndex;
                          const isFocusedItem = hasSpinSettled ? isSettledWinner : isCenteredItem;
                          const isUltraSmoothSpin = isSpinning;
                          const showItemGlow = !isUltraSmoothSpin && (!useMobileSpinnerBehavior || !reduceMobileEffects);
                          const allowHeavyHighlight = !isUltraSmoothSpin;
                          const spinnerValue = toCoins(Number(item.price ?? 0), PRICE_UNIT_MODE);
                          const imageBoxSize = Math.round(spinnerCardWidth * (performanceMode.isMobile ? 0.78 : 0.74));
                          const winnerSettleScale = performanceMode.isMobile ? 1.06 : 1.08;
                          const winnerPeakScale = performanceMode.isMobile ? 1.08 : 1.115;
                          const isLegendaryWinner = isSettledWinner && normalizeRarityKey(item.rarity) === 'legendary';
                          return (
                        <div
                            key={`${item.id}-${idx}`}
                            ref={idx === reelWinnerIndex ? winningCardRef : null}
                            className={`pullz-spinner-card group relative flex flex-shrink-0 items-center justify-center overflow-visible px-1 ${isSpinning ? 'is-spinning' : ''} ${isSettledWinner ? 'pullz-winner-settled' : ''} ${isLegendaryWinner ? 'pullz-winner-legendary' : ''}`}
                            style={{
                                width: `${spinnerCardWidth}px`,
                                height: `${spinnerCardHeight}px`,
                                backfaceVisibility: 'hidden',
                                WebkitBackfaceVisibility: 'hidden',
                                boxShadow: isFocusedItem && allowHeavyHighlight
                                  ? (reduceMobileEffects ? `0 0 0 1px ${item.color}66, 0 0 20px ${item.color}42` : `0 0 0 1px ${item.color}aa, 0 0 44px ${item.color}78, 0 0 92px ${item.color}34`)
                                  : 'none',
                                opacity: 1,
                                filter: isSettledWinner ? 'brightness(1.16) contrast(1.05)' : 'none',
                                transform: isSettledWinner ? `translateZ(0) scale(${winnerSettleScale})` : 'translateZ(0)',
                                zIndex: isFocusedItem ? 4 : 1,
                                ['--winner-settle-scale' as string]: winnerSettleScale,
                                ['--winner-peak-scale' as string]: winnerPeakScale
                            }}
                            onMouseEnter={() => !isSpinning && playSound('hover')}
                        >
                            <div
                              className={`pullz-spinner-glow pointer-events-none absolute inset-x-5 top-6 bottom-6 rounded-[40%] ${showItemGlow ? 'opacity-65 blur-3xl' : 'opacity-0 blur-none'} ${rarityGlow}`}
                              style={{ boxShadow: isFocusedItem && !reduceMobileEffects ? `0 0 20px ${item.color}40` : 'none' }}
                            />
                            <div className="relative z-10 flex min-h-0 flex-1 items-center justify-center self-stretch">
                              <div className="flex items-center justify-center" style={{ width: `${imageBoxSize}px`, height: `${imageBoxSize}px` }}>
                              <BlurImage
                                  src={item.image}
                                  alt={item.name}
                                  loading={idx < 8 || Math.abs(idx - reelWinnerIndex) <= 2 ? 'eager' : 'lazy'}
                                  fetchPriority={idx < 4 || Math.abs(idx - reelWinnerIndex) <= 1 ? 'high' : 'low'}
                                  showPlaceholder={false}
                                  staticRender={reduceMobileEffects || isSpinning}
                                  retryOnError={!(reduceMobileEffects || isSpinning)}
                                  className={`h-full w-full object-contain ${reduceMobileEffects || isSpinning ? '' : 'drop-shadow-[0_8px_18px_rgba(0,0,0,0.55)]'} ${item.id === 'golden-ticket' && animationPhase === 'idle' && !reduceMobileEffects ? 'animate-pulse' : ''}`}
                              />
                              </div>
                            </div>
                            <div className="pointer-events-none absolute inset-x-2 bottom-2 z-20 rounded-xl border border-white/10 bg-[#0b1020]/88 px-2 py-1.5 text-center shadow-[0_8px_18px_rgba(0,0,0,0.28)] backdrop-blur-sm sm:bottom-3 sm:px-2.5">
                              <p className="truncate text-[10px] font-semibold leading-tight text-slate-200/90 sm:text-[11px]">{item.name}</p>
                              <div className="mt-0.5 flex items-center justify-center gap-1 text-[12px] font-black leading-none text-white sm:text-[13px]" style={{ textShadow: '0 1px 8px rgba(0,0,0,0.85)' }}>
                                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: item.color, boxShadow: `0 0 8px ${item.color}` }} />
                                <span>{formatSpinnerCoinValue(spinnerValue)}</span>
                              </div>
                            </div>
                        </div>
                          );
                        })()
                    ))}
                </div>
            </div>
            </div>

            {/* Action Bar */}
            <div className="relative z-20 mt-4 flex items-center justify-center gap-3 bg-transparent px-3 pb-4 pt-3 sm:mt-6 sm:px-4">
                 <button
                    onClick={() => handleSpin({ isQuick: isQuickSpinEnabled })}
                    disabled={isSpinning || spinRequestLockRef.current || isSyncingFair || isRotatingSeed || isBalanceLoading || isSpinnerAssetsLoading}
                    className={`min-w-[220px] px-8 py-3 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-lg shadow-lg transition-all active:scale-95 flex flex-col items-center leading-tight ${!isSpinning && canOpenMain ? 'ambient-pulse' : ''} ${isGoldMode ? 'bg-yellow-500 hover:bg-yellow-400 shadow-yellow-500/20 text-black' : (isFree ? 'bg-green-500 hover:bg-green-400 shadow-green-500/20 text-black' : 'bg-gradient-to-r from-[#6f4dff] to-[#4f63ff] hover:brightness-110 shadow-[#6f4dff]/25')}`}
                >
                    <span>
                      {isSyncingFair ? (
                        'Syncing server...'
                      ) : isSpinning ? (
                        <span className="inline-flex items-center gap-2"><span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-transparent" />Spinning...</span>
                      ) : isBalanceLoading ? (
                        'Loading balance...'
                      ) : isFree ? (
                        'Free Spin'
                      ) : (
                    <span className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap text-[11px] sm:gap-3 sm:text-sm">
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
                            <span className="inline-flex items-center text-[10px] font-semibold text-emerald-300 sm:rounded-full sm:border sm:border-emerald-300/40 sm:bg-emerald-500/15 sm:px-2 sm:py-0.5 sm:text-xs sm:text-emerald-200">
                              +{previewTotalXp.toLocaleString()} XP
                            </span>
                          )}
                        </span>
                      )}
                    </span>
                 </button>
                {!isFree && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleTryFree}
                      disabled={isSpinning || spinRequestLockRef.current || isSyncingFair || isRotatingSeed || isSpinnerAssetsLoading}
                      className="inline-flex items-center justify-center whitespace-nowrap rounded-lg border border-white/10 bg-[#303741] px-3 py-3 text-[11px] font-semibold text-white transition hover:bg-[#39424d] disabled:cursor-not-allowed disabled:opacity-50 sm:px-4 sm:text-sm"
                    >
                      Demo Spin
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        playSound('click');
                        setIsQuickSpinEnabled((prev) => !prev);
                      }}
                      className={`inline-flex h-[46px] w-[46px] items-center justify-center rounded-lg border text-white transition-colors ${isQuickSpinEnabled ? 'border-[#8a6cff] bg-[#6f4dff]/25 text-[#c8bcff]' : 'border-white/10 bg-[#303741] text-white/80 hover:bg-[#39424d]'}`}
                      aria-label={isQuickSpinEnabled ? 'Disable quick spin' : 'Enable quick spin'}
                      title={isQuickSpinEnabled ? 'Quick spin enabled' : 'Quick spin disabled'}
                    >
                      <Zap className="h-4 w-4" />
                    </button>
                  </div>
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
            <div className="absolute inset-x-0 bottom-0 rounded-t-2xl border border-white/10 bg-[#1a1f26] p-4 shadow-2xl backdrop-blur-sm animate-in slide-in-from-bottom duration-300 sm:mx-auto sm:mb-6 sm:max-w-md sm:rounded-2xl">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-semibold text-white">Open this box with XP?</p>
                <button
                  type="button"
                  onClick={() => setShowXpConfirmSheet(false)}
                  className="flex h-9 w-9 items-center justify-center rounded-md border border-white/15 bg-[#2a313b] text-gray-200"
                  aria-label="Close XP confirmation"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <p className="text-xs text-gray-300">Open with XP: <span className="font-semibold text-gray-100">{currentXpBalance.toLocaleString()} / {xpCostForCoinCase.toLocaleString()}</span></p>
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
                  disabled={!canOpenWithXp || isSpinning || spinRequestLockRef.current || isSyncingFair || isRotatingSeed || isBalanceLoading || isSpinnerAssetsLoading}
                  className="rounded-lg border border-white/15 bg-[#2f3742] px-3 py-2 text-sm font-semibold text-gray-100 disabled:cursor-not-allowed disabled:opacity-45"
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
            <div className="mx-auto relative flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-3xl border-x border-t border-white/10 bg-[#1b2028]/95 backdrop-blur-xl shadow-[0_-10px_50px_rgba(0,0,0,0.75)] sm:max-h-[86vh]">
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
                <div
                  className="win-rarity-card relative mx-auto flex max-w-sm flex-col items-center rounded-2xl p-[2px] text-center"
                  style={{ '--rarity-color': wonItem.color } as React.CSSProperties}
                >
                  <div className="win-rarity-card__inner relative flex w-full flex-col items-center overflow-hidden rounded-[calc(1rem-1px)] border border-white/10 bg-black/40 p-4">
                    <div className="absolute inset-0 rounded-2xl opacity-25" style={{ background: `radial-gradient(circle at top, ${wonItem.color}88 0%, transparent 72%)` }} />
                    <button
                      type="button"
                      onClick={() => setVerifyModalOpen(true)}
                      className="absolute right-3 top-3 z-20 flex h-8 w-8 items-center justify-center rounded-full border border-emerald-300/25 bg-emerald-500/10 text-emerald-200 transition hover:border-emerald-300/45 hover:bg-emerald-500/15"
                      aria-label="View fairness proof"
                      title="View fairness proof"
                    >
                      <ShieldCheck className="h-4 w-4" />
                    </button>
                    <img
                      src={wonItem.image || wonInventoryItem?.image || box?.image || ''}
                      alt={wonItem.name}
                      className="relative z-10 mb-3 mx-auto h-32 w-32 shrink-0 object-contain sm:h-36 sm:w-36"
                      loading="eager"
                      decoding="async"
                      draggable={false}
                    />
                    <h4 className="relative z-10 text-lg font-bold text-white">{wonItem.name}</h4>
                    <CoinAmount
                      amount={toCoins(wonItem.price, PRICE_UNIT_MODE)}
                      formatOptions={{ maximumFractionDigits: 0 }}
                      className="relative z-10 mt-2 font-semibold text-gray-200"
                      iconClassName="w-4 h-4"
                    />
                  </div>
                </div>
              </div>

              <div className="border-t border-white/10 bg-black/20 p-4 sm:p-6">
                {isDemoSpin ? (
                  <div className="flex flex-col gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        closeWinModal();
                        void handleSpin({ isQuick: isQuickSpinEnabled });
                      }}
                      disabled={isSpinning || spinRequestLockRef.current || isSyncingFair || isRotatingSeed || isBalanceLoading || isSpinnerAssetsLoading}
                      className="h-12 w-full rounded-xl bg-gradient-to-r from-[#6f4dff] to-[#4f63ff] px-4 text-sm font-bold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <span className="inline-flex items-center justify-center gap-2">
                        Open for
                        <CoinAmount
                          amount={toCoins(box?.price ?? 0, PRICE_UNIT_MODE)}
                          formatOptions={{ maximumFractionDigits: 0 }}
                          className="text-white"
                          iconClassName="h-4 w-4"
                        />
                      </span>
                    </button>
                    <button onClick={closeWinModal} className="h-12 w-full rounded-xl border border-white/10 bg-white/5 text-sm font-bold text-white transition hover:bg-white/10">Close</button>
                  </div>
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
                        disabled={isSellingItem}
                        className="h-16 flex-1 rounded-lg border border-emerald-400/40 bg-emerald-500/20 px-4 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-500/30 disabled:opacity-60 sm:h-14 sm:rounded-xl"
                      >
                        <span className="inline-flex flex-wrap items-center justify-center gap-2 rounded-md px-3 py-2 sm:flex-nowrap sm:px-0 sm:py-0">
                          <Wallet className="h-4 w-4 flex-none" />
                          {isSellingItem ? (
                            'Selling item...'
                          ) : (
                            <>
                              <span>Quick Sell</span>
                              <CoinAmount
                                amount={getSellBackValue(toCoins(wonItem.price, PRICE_UNIT_MODE), sellBackRate)}
                                formatOptions={{ maximumFractionDigits: 0 }}
                                className="text-emerald-50"
                                iconClassName="h-4 w-4"
                              />
                            </>
                          )}
                        </span>
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

        {showPostFreeBoxModal && (
          <div className="fixed inset-0 z-[125] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
            <div className="relative w-full max-w-md rounded-2xl border border-white/10 bg-[#111725] p-5 shadow-2xl sm:p-6">
              <h3 className="text-xl font-black text-white sm:text-2xl">
                You got {postFreeBoxCoinsWon.toLocaleString()} coins 🎉
              </h3>
              <p className="mt-2 text-sm text-slate-300">
                {postFreeBoxCoinsShort > 0
                  ? `You’re only ${postFreeBoxCoinsShort.toLocaleString()} coins away from your first box`
                  : 'You have enough to open your first box'}
              </p>
              <div className="mt-5 flex flex-col gap-3">
                <button
                  type="button"
                  onClick={handlePostFreePrimaryAction}
                  className="min-h-12 w-full rounded-xl bg-gradient-to-r from-emerald-400 to-cyan-400 px-4 py-3 text-sm font-black uppercase tracking-[0.08em] text-[#03131a] transition hover:brightness-110 active:scale-[0.99]"
                >
                  Unlock your first box
                </button>
                <button
                  type="button"
                  onClick={() => {
                    playSound('click');
                    setShowPostFreeBoxModal(false);
                  }}
                  className="mx-auto text-xs font-semibold text-slate-400 transition hover:text-slate-200"
                >
                  Maybe later
                </button>
              </div>
            </div>
          </div>
        )}
        <style>{`
          .ambient-pulse { animation: ambientPulse 3s ease-in-out infinite; }
          .pullz-center-focus {
            background: radial-gradient(ellipse at center, rgba(98, 127, 255, 0.22) 0%, rgba(34, 211, 238, 0.115) 34%, rgba(111, 77, 255, 0.06) 52%, transparent 76%);
            filter: blur(12px);
            opacity: .7;
            animation: pullzCenterFocusPulse 3.8s ease-in-out infinite;
            transform: translate3d(-50%, -50%, 0);
            will-change: opacity, transform;
          }
          .pullz-marker-beam {
            background: linear-gradient(180deg, transparent 0%, color-mix(in srgb, var(--marker-color) 45%, transparent) 13%, #ffffff 48%, color-mix(in srgb, var(--marker-color) 56%, transparent) 87%, transparent 100%);
            box-shadow: 0 0 16px var(--marker-glow), 0 0 44px color-mix(in srgb, var(--marker-color) 54%, transparent);
            opacity: 1;
            animation: pullzMarkerBeamPulse 1.9s ease-in-out infinite;
            transform: translate3d(-50%, 0, 0);
            will-change: opacity, box-shadow;
          }
          .pullz-marker-beam::before {
            content: '';
            position: absolute;
            inset: 0 -9px;
            border-radius: 9999px;
            background: linear-gradient(180deg, transparent, color-mix(in srgb, var(--marker-color) 18%, transparent), transparent);
            filter: blur(8px);
            opacity: .78;
          }
          .pullz-marker-arrow {
            color: var(--marker-color);
            text-shadow: 0 0 12px var(--marker-glow), 0 0 26px color-mix(in srgb, var(--marker-color) 66%, transparent);
            filter: drop-shadow(0 0 9px var(--marker-glow));
            animation: pullzMarkerArrowPulse 1.9s ease-in-out infinite;
            will-change: opacity, transform;
          }
          .pullz-marker-arrow-top { transform: translate3d(-50%, 0, 0); }
          .pullz-marker-arrow-bottom { transform: translate3d(-50%, 0, 0); }
          .pullz-rare-center-flash {
            background: radial-gradient(ellipse at center, var(--flash-color) 0%, color-mix(in srgb, var(--flash-color) 32%, transparent) 34%, transparent 72%);
            filter: blur(11px);
            opacity: 0;
            animation: pullzRareCenterFlash 260ms ease-out both;
            will-change: opacity, transform;
          }
          .pullz-rare-center-flash-rare { --flash-color: rgba(59, 130, 246, .34); }
          .pullz-rare-center-flash-epic,
          .pullz-rare-center-flash-ultra { --flash-color: rgba(168, 85, 247, .34); }
          .pullz-rare-center-flash-legendary { --flash-color: rgba(251, 191, 36, .42); }
          .pullz-spinner-card {
            border-radius: 1.35rem;
            transition: transform 420ms cubic-bezier(.16, 1, .3, 1), filter 360ms ease, box-shadow 360ms ease;
            will-change: transform;
          }
          .pullz-winner-settled {
            animation: pullzWinnerSettlePulse 760ms cubic-bezier(.2, .9, .2, 1) 1 both;
          }
          .pullz-winner-settled.pullz-winner-legendary {
            animation: pullzLegendaryWinnerSettle 860ms cubic-bezier(.2, .9, .2, 1) 1 both;
          }
          @keyframes ambientPulse { 0%,100% { transform: scale(1); box-shadow: 0 0 0 rgba(34,211,238,0.2);} 50% { transform: scale(1.02); box-shadow: 0 0 22px rgba(34,211,238,0.32);} }
          @keyframes pullzCenterFocusPulse { 0%, 100% { opacity: .52; transform: translate3d(-50%, -50%, 0) scale(.98); } 50% { opacity: .78; transform: translate3d(-50%, -50%, 0) scale(1.08); } }
          @keyframes pullzMarkerBeamPulse { 0%, 100% { opacity: .82; } 50% { opacity: 1; } }
          @keyframes pullzMarkerArrowPulse { 0%, 100% { opacity: .84; } 50% { opacity: 1; } }
          @keyframes pullzRareCenterFlash { 0% { opacity: 0; transform: translate3d(-50%, -50%, 0) scale(.86); } 35% { opacity: 1; } 100% { opacity: 0; transform: translate3d(-50%, -50%, 0) scale(1.16); } }
          @keyframes pullzWinnerSettlePulse { 0% { transform: translateZ(0) scale(1.02); filter: brightness(1.08) contrast(1.02); } 38% { transform: translateZ(0) scale(var(--winner-peak-scale)); filter: brightness(1.28) contrast(1.1); } 100% { transform: translateZ(0) scale(var(--winner-settle-scale)); filter: brightness(1.16) contrast(1.05); } }
          @keyframes pullzLegendaryWinnerSettle { 0% { transform: translate3d(0,0,0) scale(1.02); filter: brightness(1.1) contrast(1.03); } 36% { transform: translate3d(0,0,0) scale(var(--winner-peak-scale)); filter: brightness(1.34) contrast(1.12); } 62% { transform: translate3d(0,0,0) scale(var(--winner-settle-scale)); filter: brightness(1.2) contrast(1.07); } 72% { transform: translate3d(-2px,0,0) scale(var(--winner-settle-scale)); } 82% { transform: translate3d(2px,0,0) scale(var(--winner-settle-scale)); } 91% { transform: translate3d(-1px,0,0) scale(var(--winner-settle-scale)); } 100% { transform: translate3d(0,0,0) scale(var(--winner-settle-scale)); filter: brightness(1.16) contrast(1.05); } }
          @keyframes fadeOut { from { opacity: 1; } to { opacity: 0; } }
          @media (max-width: 640px) {
            .pullz-spinner-card { border-radius: 1.1rem; }
            .pullz-center-focus { filter: blur(9px); opacity: .56; }
            .pullz-marker-beam { width: 2px; }
          }
          @media (prefers-reduced-motion: reduce){ .ambient-pulse, .pullz-center-focus, .pullz-marker-beam, .pullz-marker-arrow, .pullz-rare-center-flash, .pullz-winner-settled, .pullz-winner-settled.pullz-winner-legendary { animation: none; } }
        `}</style>


        {/* Box Contents */}
        <div className="mt-12 border-t border-white/10 bg-transparent py-8 sm:py-10">
            <div className="mb-6 flex items-center gap-3 sm:gap-4">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center sm:h-20 sm:w-20" aria-hidden="true">
                  <BlurImage
                    src={box?.image || pullzLogo}
                    alt=""
                    showPlaceholder={false}
                    className="h-full w-full object-contain drop-shadow-[0_10px_18px_rgba(0,0,0,0.5)]"
                  />
                </div>
                <div className="min-w-0">
                  <h3 className="text-xl font-bold text-white">Drop Table</h3>
                  <p className="text-xs text-gray-400">Tap an item to inspect details.</p>
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-[10px] font-medium text-gray-400">
                    {!hideDropTableOdds && (
                      <span className="inline-flex items-center gap-1.5">
                        <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-white/20 bg-white/10 text-[9px] font-bold text-gray-200">%</span>
                        Drop rate
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1.5">
                      <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-amber-300/60 bg-amber-500/20 text-[9px] font-black text-amber-100">i</span>
                      Not redeemable for coins
                    </span>
                  </div>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                {visibleDropItems.map((item) => (
                    <button
                        key={item.id}
                        type="button"
                        onClick={() => setSelectedCaseItem(item)}
                        className="group relative overflow-hidden rounded-xl border border-white/10 bg-transparent text-left transition-all hover:border-white/20"
                    >
                        <div className="absolute inset-0 opacity-25" style={{ background: `radial-gradient(circle at top, ${item.color}88 0%, transparent 70%)` }} />
                        <div className="relative flex h-36 items-center justify-center p-3 sm:h-40">
                            <BlurImage src={item.image} alt={item.name} className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-105" loading="lazy" width={160} height={160} staticRender={reduceMobileEffects} retryOnError={!reduceMobileEffects} />
                            {item.redeemable === false && (
                              <span className="absolute right-2 top-2 inline-flex h-5 w-5 items-center justify-center rounded-full border border-amber-300/60 bg-amber-500/20 text-[11px] font-black text-amber-100" aria-label="Not redeemable for coins" title="Not redeemable for coins">
                                i
                              </span>
                            )}
                        </div>
                        <div className="relative border-t border-white/10 bg-transparent p-3">
                            <div className="mb-1 truncate text-xs font-bold text-white" title={item.name}>{item.name}</div>
                            <div className="flex items-center justify-between gap-2">
                                <div className="min-w-0">
                                  <CoinAmount
                                    amount={toCoins(item.price, PRICE_UNIT_MODE)}
                                    formatOptions={{ maximumFractionDigits: 0 }}
                                    className="text-sm font-bold text-gray-200"
                                    iconClassName="w-3.5 h-3.5"
                                  />
                                  <p className="mt-0.5 text-[9px] leading-tight text-gray-400">{formatUsdValueFromCoins(toCoins(item.price, PRICE_UNIT_MODE))}</p>
                                </div>
                                {!hideDropTableOdds && (
                                  <span
                                    className="rounded border px-1.5 py-0.5 text-[10px] font-bold"
                                    style={{ color: item.color, borderColor: `${item.color}66`, backgroundColor: `${item.color}1a` }}
                                  >
                                    {item.chance}%
                                  </span>
                                )}
                            </div>
                        </div>
                    </button>
                ))}
            </div>
            {hasMoreDropItems && (
              <div className="mt-5 flex justify-center">
                <button
                  type="button"
                  onClick={() => setVisibleDropItemCount((count) => count + (performanceMode.isMobile ? 12 : 24))}
                  className="min-h-11 rounded-xl border border-white/10 bg-white/[0.04] px-5 py-2.5 text-sm font-bold text-white transition hover:border-white/20 hover:bg-white/[0.08] active:scale-[0.98]"
                >
                  Load more items
                </button>
              </div>
            )}
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
            background: radial-gradient(circle at center, rgba(59, 130, 246, 0.28), transparent 72%);
          }
          .item-modal-rarity-bg--epic {
            background: radial-gradient(circle at center, rgba(168, 85, 247, 0.28), transparent 72%);
          }
          .item-modal-rarity-bg--uncommon {
            background: radial-gradient(circle at center, rgba(34, 197, 94, 0.22), transparent 74%);
          }
          .item-modal-rarity-bg--common,
          .item-modal-rarity-bg--ultra-rare {
            background: radial-gradient(circle at center, rgba(156, 163, 175, 0.18), transparent 74%);
          }
          .item-modal-rarity-glow.is-active {
            animation: raritySinglePulse 600ms ease-out 1;
          }
          .win-rarity-card {
            --rarity-color: #38bdf8;
            background: rgba(255,255,255,0.08);
            isolation: isolate;
            overflow: hidden;
            box-shadow: 0 0 0 1px var(--rarity-color), 0 14px 38px rgba(0,0,0,0.34);
          }
          .win-rarity-card::before {
            content: '';
            position: absolute;
            inset: -45%;
            z-index: 0;
            background: conic-gradient(
              from 0deg,
              transparent 0deg,
              var(--rarity-color) 58deg,
              rgba(255,255,255,0.95) 82deg,
              var(--rarity-color) 116deg,
              transparent 152deg,
              transparent 360deg
            );
            animation: winRarityBorderSpin 4.8s linear infinite;
            opacity: 0.82;
            will-change: transform;
          }
          .win-rarity-card__inner {
            z-index: 1;
          }
          @keyframes winRarityBorderSpin {
            to { transform: rotate(1turn); }
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
            .win-rarity-card::before,
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
