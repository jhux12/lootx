import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { ChevronLeft, Volume2, VolumeX, Info, X, ShieldCheck, Check, Backpack, Wallet, Copy, Share2, Zap, Loader2 } from 'lucide-react';
import { GOLDEN_TICKET_ITEM, XP_ICON } from '../constants';
import { CoinAmount } from './CoinAmount';
import { CaseItem, InventoryItem, MysteryBox } from '../types';
import { useGame } from '../context/GameContext';
import { useSound } from '../context/SoundContext';
import { Input } from './ui/Input';
import { getSellBackValue } from '../utils/sellBack';
import { authedFetch } from '../utils/authedFetch';
import { auth, db } from '../firebase';
import { requestPhoneVerification } from '../utils/phoneVerification';
import { PRICE_UNIT_MODE, toCoins } from '../utils/coins';
import { ProvablyFairMiniModal } from './ProvablyFairMiniModal';
import { doc, onSnapshot } from 'firebase/firestore';
import { getBoxDetail, invalidateBoxDetail } from '../utils/boxRepository';
import { DEFAULT_ECONOMY_SETTINGS, getXpCost, normalizeEconomySettings } from '../utils/economy';
import { toast } from '../src/ui/toast/toast';
import { BlurImage } from '../src/ui/images/BlurImage';
import { activityStore } from '../src/lib/activity/activityStore';
import { createMicroConfetti, MicroConfettiParticle } from '../src/ui/feedback/microConfetti';
import { ProvablyFairModal } from '../src/ui/provably/ProvablyFairModal';
import { trackEvent } from '../utils/trackEvent';
import { usePerformanceMode } from '../src/lib/performance';
import pullzLogo from '../assets/png/pullz-icon-color-2048.png';
import pullzHorizontalLogo from '../assets/png/pullz-horizontal-dark-2400.png';
import { lockPageScroll } from '../utils/scrollLock';
import { coinsToUsd, trackBoxOpen, trackBoxOpenStart, trackFreeBoxClaim, trackItemKept, trackItemWon, trackSellBack, trackViewBox } from '../services/analytics';
import { calculateCardCenteredTranslate, createLockedSpinState, getLockedWinningItem } from '../utils/spinnerSpinLock';

interface CaseOpeningProps {
  boxId: string;
  isFree?: boolean;
  inventoryId?: string;
  pullPassClaimTier?: number;
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

const DESKTOP_CARD_WIDTH = 196;
const DESKTOP_CARD_HEIGHT = 232;
const DESKTOP_GAP_WIDTH = 6;
const DESKTOP_SPINNER_VIEWPORT_HEIGHT = 264;

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
  // Keep the idle preview deliberately unhurried; it is ambient anticipation, not a spin.
  previewCycleDurationMs: 30000,
  previewCycleDurationMobileMs: 26000
} as const;

const rarityGlowClass: Record<string, string> = {
  legendary: 'bg-amber-300/35',
  epic: 'bg-purple-400/30',
  rare: 'bg-blue-300/28',
  uncommon: 'bg-green-300/24',
  common: 'bg-gray-300/18'
};


const dropTableRarityAccent: Record<string, string> = {
  common: 'from-slate-700/95 via-slate-800/95 to-slate-950/95',
  uncommon: 'from-emerald-900/95 via-emerald-950/90 to-slate-950/95',
  rare: 'from-sky-900/95 via-blue-950/90 to-slate-950/95',
  epic: 'from-violet-900/95 via-purple-950/90 to-slate-950/95',
  legendary: 'from-yellow-400/90 via-amber-600/90 to-yellow-950/95'
};

const rarityIndicatorStyle: Record<string, { color: string; glow: string; label: string }> = {
  legendary: { color: '#fbbf24', glow: 'rgba(251,191,36,0.95)', label: 'Legendary' },
  epic: { color: '#a855f7', glow: 'rgba(168,85,247,0.9)', label: 'Epic' },
  rare: { color: '#3b82f6', glow: 'rgba(59,130,246,0.9)', label: 'Rare' },
  uncommon: { color: '#22c55e', glow: 'rgba(34,197,94,0.85)', label: 'Uncommon' },
  common: { color: '#9ca3af', glow: 'rgba(156,163,175,0.65)', label: 'Common' }
};

const mapBoxDetail = (id: string, data: Record<string, any>): MysteryBox => {
  const source = Array.isArray(data.items) ? data.items : Array.isArray(data.prizes) ? data.prizes : [];
  const items = source.map((item: Record<string, any>, index: number) => {
    const rarity = (item.rarity ?? 'common') as CaseItem['rarity'];
    return { id: item.id ?? `${id}-${index}`, name: item.name ?? 'Mystery Item', price: Number(item.value ?? item.price ?? 0), image: item.image ?? '', rarity, chance: Number(item.weight ?? item.chance ?? 0), color: item.color ?? '#9ca3af', brand: item.brand ?? '', category: item.category ?? '', tags: Array.isArray(item.tags) ? item.tags : [], sizes: Array.isArray(item.sizes) ? item.sizes : [], redeemable: item.redeemable !== false } as CaseItem;
  });
  return { id, name: data.name ?? 'Mystery Box', price: Number(data.price ?? 0), priceXP: data.priceXP == null ? undefined : Number(data.priceXP), currencyType: data.currencyType === 'XP' ? 'XP' : 'COIN', image: data.image ?? '', accentColor: data.accentColor ?? '#3b82f6', tag: data.tag, tags: Array.isArray(data.tags) ? data.tags : undefined, isDaily: data.isDaily === true, isPullPassBox: data.isPullPassBox === true, items, isUserCreated: data.isUserCreated === true, sellBackRate: data.sellBackRate == null ? undefined : Number(data.sellBackRate) } as MysteryBox;
};

const normalizeRarityKey = (rarity?: string) => {
  const value = String(rarity ?? 'common').toLowerCase();
  if (value.includes('legend')) return 'legendary';
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

const buildExcitementPreviewReel = (items: CaseItem[]) => {
  const legendaryItems = items.filter((item) => normalizeRarityKey(item.rarity) === 'legendary');
  const epicItems = items.filter((item) => normalizeRarityKey(item.rarity) === 'epic');
  const highRarityItems = [...legendaryItems, ...epicItems];

  if (!highRarityItems.length) return [];

  // Alternate the two premium tiers whenever both are available so the idle reel
  // advertises the box's most exciting possible outcomes without implying a result.
  const cycleLength = Math.max(8, (legendaryItems.length + epicItems.length) * 2);
  const cycle = Array.from({ length: cycleLength }, (_, index) => {
    const preferredPool = index % 2 === 0 ? legendaryItems : epicItems;
    const fallbackPool = preferredPool === legendaryItems ? epicItems : legendaryItems;
    const pool = preferredPool.length ? preferredPool : fallbackPool;
    return pool[index % pool.length];
  });

  // Three identical cycles let the animation loop beyond both viewport edges.
  return [...cycle, ...cycle, ...cycle];
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

// Invert the x curve then evaluate y. This is the same CSS cubic-bezier timing
// function WAAPI uses, without reading composited styles back from the browser.
const cubicBezierProgress = (progress: number, x1: number, y1: number, x2: number, y2: number) => {
  const sample = (t: number, a: number, b: number) => 3 * a * (1 - t) * (1 - t) * t + 3 * b * (1 - t) * t * t + t * t * t;
  let low = 0; let high = 1;
  for (let i = 0; i < 16; i += 1) {
    const mid = (low + high) / 2;
    if (sample(mid, x1, x2) < progress) low = mid; else high = mid;
  }
  return sample((low + high) / 2, y1, y2);
};
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
      loadImageElement(pullzHorizontalLogo)
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

      const logoWidth = 360;
      const logoHeight = 93;
      context.globalAlpha = 0.95;
      context.drawImage(logoImage, canvas.width / 2 - logoWidth / 2, 48, logoWidth, logoHeight);
      context.globalAlpha = 1;

      context.fillStyle = '#a5b4fc';
      context.font = '700 36px Inter, system-ui, sans-serif';
      context.textAlign = 'center';
      context.fillText('UNBOXING', canvas.width / 2, 210);

      context.fillStyle = '#ffffff';
      context.font = '800 62px Inter, system-ui, sans-serif';
      context.fillText(item.name.slice(0, 36), canvas.width / 2, 300);

      context.fillStyle = '#cbd5e1';
      context.font = '500 32px Inter, system-ui, sans-serif';
      context.fillText(`From ${caseName}`, canvas.width / 2, 350);

      const cardWidth = 820;
      const cardHeight = 740;
      const cardX = (canvas.width - cardWidth) / 2;
      const cardY = 410;

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



export const CaseOpening: React.FC<CaseOpeningProps> = ({ boxId, isFree = false, inventoryId, pullPassClaimTier }) => {
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
  const { muted, toggleMute, unlockAudio, playSound, prepareCaseAudio } = useSound();
  const performanceMode = usePerformanceMode();

  useEffect(() => {
    prepareCaseAudio();
  }, [prepareCaseAudio]);

  const matchedBox = boxes.find(b => b.id === boxId);
  const [loadedBox, setLoadedBox] = useState<MysteryBox | null>(null);
  const [boxLoadError, setBoxLoadError] = useState<string | null>(null);
  const [detailReload, setDetailReload] = useState(0);
  const box = loadedBox ?? matchedBox;

  useEffect(() => {
    let cancelled = false;
    // Summaries deliberately omit prize arrays. Resolve a full document only for
    // this route, which also preserves direct URLs outside the first catalog page.
    if (matchedBox?.items?.length) { setLoadedBox(null); setBoxLoadError(null); return; }
    void getBoxDetail(boxId, mapBoxDetail).then((detail) => {
      if (cancelled) return;
      if (!detail) { setBoxLoadError('This case is no longer available.'); return; }
      setLoadedBox(detail); setBoxLoadError(null);
    }).catch(() => { if (!cancelled) setBoxLoadError('Unable to load this case. Please try again.'); });
    return () => { cancelled = true; };
  }, [boxId, detailReload, matchedBox?.id, matchedBox?.items?.length]);


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
  // Daily signup boxes are always free openings, including legacy URLs that may
  // not carry the explicit `isFree` route flag.
  const isFreeOpening = Boolean(isFree || box?.isDaily);
  const hideDropTableOdds = isFreeOpening;
  // Sort items high to low for display purposes
  const displayItems = useMemo(() => [...items].sort(
    (a, b) => toCoins(b.price, PRICE_UNIT_MODE) - toCoins(a.price, PRICE_UNIT_MODE)
  ), [items]);

  const [isSpinning, setIsSpinning] = useState(false);
  const [isSpinnerAssetsLoading, setIsSpinnerAssetsLoading] = useState(true);
  const [reelItems, setReelItems] = useState<CaseItem[]>([]);
  const [isExcitementPreview, setIsExcitementPreview] = useState(true);
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
  const [isItemImageZoomed, setIsItemImageZoomed] = useState(false);
  const [isWinImageZoomed, setIsWinImageZoomed] = useState(false);
  const [animatedModalCoins, setAnimatedModalCoins] = useState(0);
  const [confetti, setConfetti] = useState<MicroConfettiParticle[]>([]);
  const [animationPhase, setAnimationPhase] = useState<'idle' | 'spinning' | 'settling'>('idle');
  const [hasSpinSettled, setHasSpinSettled] = useState(false);
  const [showPostFreeBoxModal, setShowPostFreeBoxModal] = useState(false);
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
  const previewAnimationRef = useRef<Animation | null>(null);
  const tickTimerRef = useRef<number | null>(null);
  const tickFrameRef = useRef<number | null>(null);
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
  const releaseItemModalScrollLockRef = useRef<(() => void) | null>(null);
  const topUpTriggerLockRef = useRef(false);
  const pendingPostFreeBoxFlowRef = useRef(false);
  const hasTrackedFreeBoxViewRef = useRef(false);
  const spinRequestLockRef = useRef(false);
  const isSpinningRef = useRef(false);
  const isSpinSequenceLockedRef = useRef(false);
  const pendingSpinnerLayoutRef = useRef(false);
  const lockedWinnerRef = useRef<{ item: CaseItem; resultId: string; nonce: number } | null>(null);
  const lockedSpinStateRef = useRef<ReturnType<typeof createLockedSpinState> | null>(null);
  const snapActiveSpinRef = useRef<(() => void) | null>(null);
  const rotationSnapRequestedRef = useRef(false);
  const settleSoundPlayedRef = useRef(false);
  const winSoundPlayedRef = useRef(false);
  const winSoundTimerRef = useRef<number | null>(null);
  const confettiTimerRef = useRef<number | null>(null);
  const goldStageTimerRef = useRef<number | null>(null);
  const preloadedSpinnerImagesRef = useRef<Map<string, Promise<void>>>(new Map());
  const topUpLockTimerRef = useRef<number | null>(null);
  const canFreeSpin = !user.lastFreeBoxClaim;
  const prefersReducedMotion = performanceMode.prefersReducedMotion;
  const reduceMobileEffects = performanceMode.isMobile || performanceMode.isLowPower;
  const visibleDropItems = useMemo(() => displayItems.slice(0, visibleDropItemCount), [displayItems, visibleDropItemCount]);
  const hasMoreDropItems = visibleDropItemCount < displayItems.length;
  const caseCurrencyType = box?.currencyType === 'XP' ? 'XP' : 'COIN';
  const isRewardOpen = Boolean(inventoryId || pullPassClaimTier);
  const currentCasePrice = box ? toCoins(box.price, PRICE_UNIT_MODE) : NaN;
  const currentCaseXpPrice = Math.max(0, Math.floor(Number(box?.priceXP ?? 0)));
  const [pullPassCoinsPerXp, setPullPassCoinsPerXp] = useState(10);
  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'settings', 'pullPass'), (snapshot) => {
      const data = snapshot.exists() ? snapshot.data() ?? {} : {};
      setPullPassCoinsPerXp(Math.max(1, Math.floor(Number(data.coinsPerXp ?? 10) || 10)));
    });
    return () => unsubscribe();
  }, []);
  const xpPer100Coins = Math.max(0, Number(bonusSettings?.xpPer100Coins ?? bonusSettings?.xpPer100CoinsWagered ?? 0));
  const xpPerCaseOpened = Math.max(0, Number(bonusSettings?.xpPerCaseOpened ?? bonusSettings?.xpPerCaseOpen ?? 0));
  const xpPreviewCoinsSpent = !isRewardOpen && caseCurrencyType === 'COIN' ? Math.max(0, Number(box?.price ?? 0)) : 0;
  const previewXpFromSpend = Math.floor(xpPreviewCoinsSpent / pullPassCoinsPerXp);
  const previewXpFromOpen = 0;
  const previewTotalXp = Math.max(0, previewXpFromSpend + previewXpFromOpen);
  const currentXpBalance = Math.max(0, Math.floor(Number(user.xpBalance ?? user.xp ?? 0)));
  const [economySettings, setEconomySettings] = useState(DEFAULT_ECONOMY_SETTINGS);
  useEffect(() => {
    if (!box) return;
    const usdValue = coinsToUsd(Number(box.price ?? 0), economySettings);
    trackViewBox({ currency: 'USD', value: usdValue, items: [{ item_id: box.id, item_name: box.name, item_category: box.category ?? 'box', price: usdValue, quantity: 1 }], box_id: box.id, box_name: box.name, box_type: box.category ?? 'box', coin_price: Number(box.price ?? 0), is_free: Boolean(isFree), is_daily: Boolean(box.isDaily), is_user_created: Boolean(box.isUserCreated) }, `${box.id}:${isFree ? 'free' : 'paid'}`);
  }, [box, economySettings, isFree]);
  const isBalanceLoading = isAuthenticated && !authInitialized;
  const xpCostForCoinCase = useMemo(() => getXpCost(currentCasePrice, economySettings), [currentCasePrice, economySettings]);
  const xpProgress = useMemo(() => {
    if (!Number.isFinite(xpCostForCoinCase) || xpCostForCoinCase <= 0) return 0;
    return Math.max(0, Math.min(1, currentXpBalance / xpCostForCoinCase));
  }, [currentXpBalance, xpCostForCoinCase]);
  const showXpOpenUi = false;
  const canOpenMain = isRewardOpen || isFree || balance >= currentCasePrice;
  const canOpenWithXp = showXpOpenUi && currentXpBalance >= xpCostForCoinCase;
  const spinnerCardWidth = DESKTOP_CARD_WIDTH;
  const spinnerCardHeight = DESKTOP_CARD_HEIGHT;
  const spinnerGap = DESKTOP_GAP_WIDTH;
  const spinnerViewportHeight = DESKTOP_SPINNER_VIEWPORT_HEIGHT;
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
      if (isSpinSequenceLockedRef.current) {
        pendingSpinnerLayoutRef.current = true;
        return;
      }
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
    const economyRef = doc(db, 'settings', 'economy');
    const unsubscribe = onSnapshot(economyRef, (snapshot) => {
      const data = snapshot.exists() ? snapshot.data() : {};
      setEconomySettings(normalizeEconomySettings(data));
    }, (error) => {
      console.error('Economy settings snapshot failed', error);
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
    // Before an opening, continuously showcase only the box's epic and legendary
    // outcomes. If a box has neither tier, retain the standard weighted preview.
    if (!items.length) return;
    // Responsive mode can change during phone rotation. Never let that rebuild an
    // active or revealed result reel; defer preview layout until the reveal closes.
    if (isSpinSequenceLockedRef.current) {
      pendingSpinnerLayoutRef.current = true;
      return;
    }

    const excitementItems = buildExcitementPreviewReel(items);
    const staticReelLength = reduceMobileEffects ? 9 : 15;
    const previewItems = excitementItems.length
      ? excitementItems
      : Array.from({ length: staticReelLength }, () => pickWeightedSpinnerItem(items, Math.random));
    const previewCenterIndex = Math.floor(previewItems.length / 2);

    reelItemsRef.current = previewItems;
    setReelItems(previewItems);
    setReelWinnerIndex(previewCenterIndex);
    setCurrentCenterIndex(previewCenterIndex);
    lastCenterIndexRef.current = previewCenterIndex;
    setHasSpinSettled(false);
    setIsExcitementPreview(excitementItems.length > 0);
  }, [items, reduceMobileEffects]);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || !isExcitementPreview || isSpinning || hasSpinSettled || prefersReducedMotion || performanceMode.isHidden) {
      return undefined;
    }

    const cycleItemCount = reelItems.length / 3;
    if (!Number.isInteger(cycleItemCount) || cycleItemCount < 1) return undefined;

    const frame = window.requestAnimationFrame(() => {
      const reel = scrollContainerRef.current;
      if (!reel || isSpinningRef.current) return;

      updateSpinnerMeasurements();
      const { stepWidth } = spinnerMeasurementsRef.current;
      const startTranslate = -(cycleItemCount * stepWidth);
      const endTranslate = -(cycleItemCount * 2 * stepWidth);
      reel.style.transition = 'none';
      reel.style.transform = `translate3d(${startTranslate}px, 0, 0)`;
      reel.style.willChange = 'transform';

      previewAnimationRef.current = reel.animate(
        [
          { transform: `translate3d(${startTranslate}px, 0, 0)` },
          { transform: `translate3d(${endTranslate}px, 0, 0)` }
        ],
        {
          duration: reduceMobileEffects ? SPINNER_MOTION.previewCycleDurationMobileMs : SPINNER_MOTION.previewCycleDurationMs,
          iterations: Infinity,
          easing: 'linear'
        }
      );
    });

    return () => {
      window.cancelAnimationFrame(frame);
      previewAnimationRef.current?.cancel();
      previewAnimationRef.current = null;
      if (container && !isSpinningRef.current) {
        container.style.willChange = 'auto';
      }
    };
  }, [hasSpinSettled, isExcitementPreview, isSpinning, performanceMode.isHidden, prefersReducedMotion, reduceMobileEffects, reelItems.length, updateSpinnerMeasurements]);

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
    releaseItemModalScrollLockRef.current = lockPageScroll({ preserveScrollPosition: true });

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
      releaseItemModalScrollLockRef.current?.();
      releaseItemModalScrollLockRef.current = null;
      document.removeEventListener('keydown', handleKeyDown);
      lastFocusedElementRef.current?.focus();
    };
  }, [selectedCaseItem]);

  useEffect(() => {
    if (!selectedCaseItem) {
      setItemModalActive(false);
      setIsItemImageZoomed(false);
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
    setIsItemImageZoomed(false);
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
    const winnerElement = container.children.item(winnerIndex) as HTMLElement | null;

    // Use the card's real laid-out position whenever possible. Calculating from a
    // nominal card width drifts when a mobile browser rounds card widths or flex
    // gaps differently, which can leave the marker over an adjacent filler item.
    // This only controls presentation: the server-provided winner is still the
    // target inserted into the reel and no outcome/odds logic is involved here.
    const winnerCenterX = winnerElement
      ? winnerElement.offsetLeft + (winnerElement.offsetWidth / 2)
      : (winnerIndex * stepWidth) + (cardWidth / 2);
    return viewportCenterX - winnerCenterX + landingOffset;
  }, [updateSpinnerMeasurements]);

  const getCenteredIndexFromTranslate = useCallback((translateX: number) => {
    const { cardWidth, stepWidth, viewportWidth } = spinnerMeasurementsRef.current;
    const viewportCenter = viewportWidth / 2;
    const renderedChildren = scrollContainerRef.current?.children;
    const renderedItemCount = renderedChildren?.length ?? 0;
    const reelLength = renderedItemCount || reelItemsRef.current.length || reelItems.length;
    if (!Number.isFinite(stepWidth) || stepWidth <= 0 || !Number.isFinite(cardWidth) || viewportCenter <= 0 || reelLength <= 0) {
      return 0;
    }

    if (renderedChildren?.length) {
      const markerPositionInTrack = viewportCenter - translateX;
      let nearestIndex = 0;
      let nearestDistance = Number.POSITIVE_INFINITY;

      for (let index = 0; index < renderedChildren.length; index += 1) {
        const item = renderedChildren.item(index) as HTMLElement | null;
        if (!item) continue;
        const itemCenter = item.offsetLeft + (item.offsetWidth / 2);
        const distance = Math.abs(itemCenter - markerPositionInTrack);
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestIndex = index;
        }
      }

      return nearestIndex;
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

  const resetSpinnerAnimation = useCallback(() => {
    snapActiveSpinRef.current = null;
    if (previewAnimationRef.current) {
      previewAnimationRef.current.cancel();
      previewAnimationRef.current = null;
    }

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

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const snapAfterRotation = () => {
      if (!isSpinSequenceLockedRef.current) return;
      rotationSnapRequestedRef.current = true;
      snapActiveSpinRef.current?.();
    };
    window.addEventListener('orientationchange', snapAfterRotation);
    window.screen.orientation?.addEventListener?.('change', snapAfterRotation);

    return () => {
      window.removeEventListener('orientationchange', snapAfterRotation);
      window.screen.orientation?.removeEventListener?.('change', snapAfterRotation);
    };
  }, []);

  const animateSpin = useCallback(async (
    winnerIndex: number,
    duration: number,
    onComplete: () => void,
    options?: { seed?: string; locksAward?: boolean }
  ) => {
    const container = scrollContainerRef.current;
    if (!container) {
      onComplete();
      return;
    }

    const rng = createSeededRng(options?.seed ?? `${winnerIndex}:${duration}`);
    const approachOffset = getApproachOffset(rng);
    const landingJitterPx = 0;
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

    const centeredTranslateRaw = await resolveCenteredTranslate(winnerIndex, 0);
    const centeredTranslate = centeredTranslateRaw === null ? null : clampTranslate(centeredTranslateRaw);
    const jitterLandingTranslate = centeredTranslate === null ? null : clampTranslate(centeredTranslate + landingJitterPx);
    const approachTranslate = centeredTranslate === null ? null : clampTranslate(centeredTranslate + approachOffset);
    if (centeredTranslate === null || approachTranslate === null || jitterLandingTranslate === null) {
      spinRequestLockRef.current = false;
      setIsSpinning(false);
      return;
    }

    const locksAward = options?.locksAward !== false;
    if (locksAward) {
      const lockedWinner = lockedWinnerRef.current;
      if (!lockedWinner || reelItemsRef.current[winnerIndex]?.id !== lockedWinner.item.id) {
        spinRequestLockRef.current = false;
        setIsSpinning(false);
        throw new Error('Spinner reel no longer matches the locked box-opening result.');
      }
      const frozenMeasurements = spinnerMeasurementsRef.current;
      lockedSpinStateRef.current = createLockedSpinState({
        resultId: lockedWinner.resultId,
        nonce: lockedWinner.nonce,
        winningItemId: lockedWinner.item.id,
        winningIndex: winnerIndex,
        reelItems: reelItemsRef.current,
        startTranslateX: 0,
        finalTranslateX: centeredTranslate,
        cardWidth: frozenMeasurements.cardWidth,
        reelGap: frozenMeasurements.reelGap,
        viewportWidth: frozenMeasurements.viewportWidth
      });
    }

    const overshootDirection = approachOffset >= 0 ? -1 : 1;
    const overshootTarget = clampTranslate(approachTranslate + (SPINNER_MOTION.overshootPx * overshootDirection));
    setAnimationPhase('spinning');

    const animation = container.animate(
      [
        { transform: 'translate3d(0px, 0, 0)', offset: 0, easing: 'cubic-bezier(0.24, 0.62, 0.18, 1)' },
        { transform: `translate3d(${overshootTarget}px, 0, 0)`, offset: overshootOffset, easing: 'cubic-bezier(0.12, 0.82, 0.2, 1)' },
        { transform: `translate3d(${jitterLandingTranslate}px, 0, 0)`, offset: preSettleOffset, easing: 'cubic-bezier(0.16, 0.72, 0.28, 1)' },
        { transform: `translate3d(${centeredTranslate}px, 0, 0)`, offset: 1, easing: 'cubic-bezier(0.18, 0, 0.2, 1)' }
      ],
      {
        duration: resolvedDuration,
        fill: 'forwards',
        composite: 'replace'
      }
    );

    spinnerAnimationRef.current = animation;
    let rotationSnapPending = false;
    snapActiveSpinRef.current = () => {
      if (rotationSnapPending || animation.playState === 'finished' || animation.playState === 'idle') return;
      rotationSnapPending = true;

      // Orientation events can fire before the new visual viewport dimensions
      // are committed. Wait for two paints, then finish the existing immutable
      // animation. Its normal completion path centers the same locked winner.
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          if (animation.playState !== 'finished' && animation.playState !== 'idle') {
            animation.finish();
          }
        });
      });
    };
    if (rotationSnapRequestedRef.current) snapActiveSpinRef.current();
    // The reel itself is animated by WAAPI.  Never read its computed transform here:
    // style reads force a composited animation back onto the main thread.  The known
    // timeline and keyframes let us calculate the approximate centre position instead.
    let frameId: number | null = null;
    let lastSampleAt = -Infinity;
    const sampleIntervalMs = 60; // ~16.7 centre/tick checks per second.
    const translateAt = (elapsed: number) => {
      const progress = clamp(elapsed / resolvedDuration, 0, 1);
      if (progress <= overshootOffset) return overshootTarget * cubicBezierProgress(progress / overshootOffset, 0.24, 0.62, 0.18, 1);
      if (progress <= preSettleOffset) {
        const local = (progress - overshootOffset) / Math.max(0.001, preSettleOffset - overshootOffset);
        return overshootTarget + (jitterLandingTranslate - overshootTarget) * cubicBezierProgress(local, 0.12, 0.82, 0.2, 1);
      }
      const local = (progress - preSettleOffset) / Math.max(0.001, 1 - preSettleOffset);
      return jitterLandingTranslate + (centeredTranslate - jitterLandingTranslate) * cubicBezierProgress(local, 0.16, 0.72, 0.28, 1);
    };
    const syncCenterItem = (now: number) => {
      if (document.visibilityState !== 'hidden' && now - lastSampleAt >= sampleIntervalMs) {
        lastSampleAt = now;
        const elapsed = Number(animation.currentTime ?? Math.max(0, now - (animation.startTime ?? now)));
        const index = getCenteredIndexFromTranslate(translateAt(elapsed));
        const previousIndex = lastCenterIndexRef.current;
        if (index !== previousIndex) {
          lastCenterIndexRef.current = index;
          if (isSpinningRef.current && index !== lastTickedCenterIndexRef.current) {
            playSound('spin-tick');
            lastTickedCenterIndexRef.current = index;
          }
          if (!reduceSpinnerRerenders) setCurrentCenterIndex(index);
        }
      }
      if (isSpinningRef.current) {
        tickFrameRef.current = window.requestAnimationFrame(syncCenterItem);
        frameId = tickFrameRef.current;
      }
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
      const lockedSpin = lockedSpinStateRef.current;
      const lockedCard = lockedSpin
        ? container.children.item(lockedSpin.targetReelIndex) as HTMLElement | null
        : null;
      // The animation target remains frozen during rotation. Once it finishes,
      // align that same locked card to the current viewport without changing it.
      const settledTranslate = lockedCard
        ? calculateCardCenteredTranslate({
            viewportWidth: scrollViewportRef.current?.clientWidth ?? lockedSpin?.geometry.viewportWidth ?? 0,
            cardOffsetLeft: lockedCard.offsetLeft,
            cardWidth: lockedCard.offsetWidth
          })
        : centeredTranslate;
      container.style.transform = `translate3d(${settledTranslate}px, 0, 0)`;
      container.style.willChange = 'auto';
      const settledWinnerIndex = lockedSpin?.winningIndex ?? winnerIndex;
      setCurrentCenterIndex(settledWinnerIndex);
      lastCenterIndexRef.current = settledWinnerIndex;
      setHasSpinSettled(true);
      if (frameId !== null) window.cancelAnimationFrame(frameId);
      tickFrameRef.current = null;

      setAnimationPhase('idle');
      spinnerAnimationRef.current = null;
      snapActiveSpinRef.current = null;
      spinRequestLockRef.current = false;
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
      snapActiveSpinRef.current = null;
      spinRequestLockRef.current = false;
    };
  }, [clampTranslate, getApproachOffset, getCenteredIndexFromTranslate, playSound, reduceSpinnerRerenders, resetSpinnerAnimation, resolveCenteredTranslate, updateSpinnerMeasurements]);

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

  const preloadReelImages = useCallback(async (
    nextReelItems: CaseItem[],
    options: { preloadAll?: boolean; priorityIndex?: number } = {}
  ) => {
    setIsSpinnerAssetsLoading(true);
    // Only warm the images that can be seen first. Rendering the reel starts the
    // remaining lazy requests, so waiting for every possible drop delays the page
    // without improving the first visible frame.
    const preloadLimit = options.preloadAll
      ? (reduceMobileEffects ? 8 : 16)
      : (reduceMobileEffects ? 4 : 6);
    const loadTimeoutMs = options.preloadAll
      ? (reduceMobileEffects ? 1800 : 2500)
      : (reduceMobileEffects ? 500 : 750);
    const priorityItems = typeof options.priorityIndex === 'number'
      ? nextReelItems.slice(Math.max(0, options.priorityIndex - 2), options.priorityIndex + 3)
      : [];
    const uniqueSources = Array.from(new Set(
      [...priorityItems, ...nextReelItems]
        .map((item) => item.image)
        .filter((src): src is string => Boolean(src))
    )).slice(0, preloadLimit);

    const loadSource = (src: string) => {
      const cachedLoad = preloadedSpinnerImagesRef.current.get(src);
      if (cachedLoad) return cachedLoad;

      let timedOut = false;
      const loadPromise = new Promise<void>((resolve) => {
        const img = new Image();
        const timeoutId = window.setTimeout(() => {
          timedOut = true;
          resolve();
        }, loadTimeoutMs);
        const settle = () => {
          window.clearTimeout(timeoutId);
          resolve();
        };

        img.decoding = 'async';
        img.loading = 'eager';
        img.onload = settle;
        img.onerror = settle;
        img.src = src;

        if (img.complete && img.naturalWidth > 0) {
          settle();
        }
      }).then(() => {
        if (timedOut) {
          preloadedSpinnerImagesRef.current.delete(src);
        }
      });

      preloadedSpinnerImagesRef.current.set(src, loadPromise);
      return loadPromise;
    };

    await Promise.all(uniqueSources.map((src) => loadSource(src)));
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
    setIsExcitementPreview(false);
    resetSpinnerAnimation();
    setHasSpinSettled(false);
    setAnimationPhase('idle');
    winningCardRef.current = null;

    if (scrollContainerRef.current) {
      scrollContainerRef.current.style.transform = 'translate3d(0px, 0, 0)';
      scrollContainerRef.current.style.transition = 'none';
    }

    await preloadReelImages(nextReelItems, { preloadAll: true, priorityIndex: winnerIndex });

    reelItemsRef.current = nextReelItems;
    setReelItems(nextReelItems);
    setReelWinnerIndex(winnerIndex);
    await waitForNextPaint();
    await waitForNextPaint();
    updateSpinnerMeasurements();
    const startingCenterIndex = getCenteredIndexFromTranslate(0);
    lastCenterIndexRef.current = startingCenterIndex;
    setCurrentCenterIndex(startingCenterIndex);
  }, [getCenteredIndexFromTranslate, preloadReelImages, resetSpinnerAnimation, updateSpinnerMeasurements]);



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

    if (!isDemo && !isFree && !isRewardOpen) {
      if (isBalanceLoading) {
        spinRequestLockRef.current = false;
        return;
      }

      const usesXpPayment = caseCurrencyType === 'XP' || paymentMethod === 'xp';
      if (usesXpPayment) {
        spinRequestLockRef.current = false;
        setSpinFeedbackMessage('XP opens are not available.');
        return;
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
      if (!auth.currentUser?.phoneNumber) {
        spinRequestLockRef.current = false;
        requestPhoneVerification('free_box');
        return;
      }
    }

    isSpinningRef.current = true;
    isSpinSequenceLockedRef.current = true;
    rotationSnapRequestedRef.current = false;
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
    let spinResultId = `demo:${box.id}:${rollNonce}:${Date.now()}`;

    if (isDemo) {
      winner = getDemoWinningItem(rollValue);
    } else {
      try {
        // Server now authoritatively selects the prize + updates coins/inventory.
        const operationId = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

        trackBoxOpenStart({ box_id: box.id, box_name: box.name, box_type: box.category ?? 'box', coin_price: Number(box.price ?? 0), usd_value: coinsToUsd(Number(box.price ?? 0), economySettings), is_free: Boolean(isFree), balance_before: Number(balance ?? 0), entry_point: 'case_opening' }, operationId);
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
          body: JSON.stringify({ boxId: box.id, isFree, inventoryId, pullPassClaimTier, operationId, paymentMethod })
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
          ? {
              ...matchedPrize,
              ...data.prize,
              price: fallbackPrice,
              redeemable: resolvedRedeemable,
              size: data.prize.size
            }
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
        const analyticsPayload = { box_id: box.id, box_name: box.name, box_type: box.category ?? 'box', coin_price: Number(data.price ?? box.price ?? 0), usd_value: coinsToUsd(Number(data.price ?? box.price ?? 0), economySettings), is_free: Boolean(isFree), item_id: winner.id, item_name: winner.name, item_rarity: winner.rarity, item_value_coins: Number(winner.price ?? 0), item_value_usd: coinsToUsd(Number(winner.price ?? 0), economySettings), balance_before: Number(balance ?? 0), balance_after: Number(data.newCoinBalance ?? data.newCoins ?? balance ?? 0), open_id: data.openId, entry_point: 'case_opening' };
        trackBoxOpen(analyticsPayload, data.openId);
        trackItemWon({ ...analyticsPayload, inventory_instance_id: data.inventoryId }, data.openId);
        if (isFree && Number.isFinite(data.freeBoxClaimedAt)) {
          await claimFreeBox(data.freeBoxClaimedAt, { persist: false });
          trackEvent('free_spin_completed', {
            box_id: box.id,
            value: toCoins(Number(data.prize.price ?? 0), PRICE_UNIT_MODE),
            currency: 'COIN'
          });
          trackFreeBoxClaim({ box_id: box.id, box_name: box.name, item_id: winner.id, item_name: winner.name, item_value_coins: Number(winner.price ?? 0), item_value_usd: coinsToUsd(Number(winner.price ?? 0), economySettings) }, data.openId);
        }
        if ((data.currencyType ?? 'COIN') === 'COIN') {
          const updatedCoinBalance = Number(data.newCoinBalance ?? data.newCoins ?? 0);
          syncBalance(updatedCoinBalance);
          if (isFree) {
            pendingPostFreeBoxFlowRef.current = true;
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
        spinResultId = data.openId;
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
        isSpinningRef.current = false;
        isSpinSequenceLockedRef.current = false;
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

    // From this point through reveal dismissal, the authoritative result cannot
    // be replaced by viewport changes, rerenders, or visually centered cards.
    lockedWinnerRef.current = Object.freeze({
      item: Object.freeze({ ...winner }),
      resultId: spinResultId,
      nonce: rollNonce
    });

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
        }, { locksAward: false });

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
      resetSpinnerAnimation();
    };
  }, [resetSpinnerAnimation]);

  const finishSpin = (item: CaseItem) => {
    const lockedSpin = lockedSpinStateRef.current;
    const lockedResult = lockedWinnerRef.current;
    if (lockedSpin) getLockedWinningItem(lockedSpin); // Throws rather than revealing a mismatched reel.
    const displayedWinner = lockedResult?.item ?? item;
    spinRequestLockRef.current = false;
    isSpinningRef.current = false;
    rotationSnapRequestedRef.current = false;
    setIsSpinning(false);
    setIsBoxPreviewVisible(false);
    setIsBoxPreviewFading(false);

    setShowWinModal(true);
    if (!winSoundPlayedRef.current) {
      const rarity = String(displayedWinner.rarity ?? 'common').toLowerCase();
      winSoundTimerRef.current = window.setTimeout(() => {
        if (winSoundPlayedRef.current) return;
        if (rarity.includes('legend') || rarity.includes('mythic')) playSound('win-gold');
        else if (rarity.includes('epic')) playSound('win-epic');
        else if (rarity.includes('uncommon') || rarity.includes('rare')) playSound('win-rare');
        else playSound('win-common');
        winSoundPlayedRef.current = true;
        winSoundTimerRef.current = null;
      }, 120);
    }
    if (!prefersReducedMotion && ['rare','ultra rare','legendary'].includes(String(displayedWinner.rarity).toLowerCase())) {
      const particles = createMicroConfetti(reduceMobileEffects ? 10 : 18);
      setConfetti(particles);
      if (confettiTimerRef.current !== null) window.clearTimeout(confettiTimerRef.current);
      confettiTimerRef.current = window.setTimeout(() => {
        setConfetti([]);
        confettiTimerRef.current = null;
      }, reduceMobileEffects ? 520 : 720);
    }
    setWonItem(displayedWinner);
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



  const redirectToBoxesCatalog = () => {
    setShowPostFreeBoxModal(false);
    pendingPostFreeBoxFlowRef.current = false;
    setView({ type: 'BOXES' });
    if (typeof window !== 'undefined') {
      window.history.replaceState({}, '', '/boxes');
    }
  };

  const closeWinModal = () => {
    setIsSellingItem(false);
    setIsWinImageZoomed(false);
    if (!rewardResolved) {
      setRewardResolved(true);
    }
    setShowWinModal(false);
    resetReelTrackPosition();
    setWonInventoryItem(null);
    isSpinSequenceLockedRef.current = false;
    lockedSpinStateRef.current = null;
    lockedWinnerRef.current = null;
    if (pendingSpinnerLayoutRef.current) {
      pendingSpinnerLayoutRef.current = false;
      window.requestAnimationFrame(updateSpinnerMeasurements);
    }

    if (pendingPostFreeBoxFlowRef.current) {
      setShowPostFreeBoxModal(true);
      pendingPostFreeBoxFlowRef.current = false;
    }
  };

  const handlePostFreePrimaryAction = () => {
    playSound('click');
    setShowPostFreeBoxModal(false);
    setTopUpModalIntent({
      reason: 'insufficient_balance',
      requiredCoins: 3000,
      currentBalance: Number(balance ?? user.balance ?? 0),
      missingCoins: 3000,
      source: 'post_free_box',
      preferredPackageUsd: 20
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
          trackSellBack({ box_id: box?.id, box_name: box?.name, item_id: wonInventoryItem.id, item_name: wonInventoryItem.name, original_item_value_coins: Number(wonInventoryItem.price ?? 0), sellback_value_coins: getSellBackValue(toCoins(wonInventoryItem.price, PRICE_UNIT_MODE), sellBackRate), sellback_value_usd: coinsToUsd(getSellBackValue(toCoins(wonInventoryItem.price, PRICE_UNIT_MODE), sellBackRate)), sellback_rate: sellBackRate, inventory_instance_id: wonInventoryItem.instanceId }, wonInventoryItem.instanceId);
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
    closeWinModal();
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
        trackItemKept({ box_id: box?.id, box_name: box?.name, item_id: wonItem.id, item_name: wonItem.name, item_value_coins: Number(wonItem.price ?? 0), item_value_usd: coinsToUsd(Number(wonItem.price ?? 0)) }, wonInventoryItem?.instanceId ?? wonItem.id);
        if (isFree) {
          trackEvent('free_box_item_kept', {
            item_id: wonItem.id,
            value: toCoins(wonItem.price, PRICE_UNIT_MODE),
            currency: 'COIN'
          });
        }
      }
      setIsSellingItem(false);
      closeWinModal();
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
            {boxLoadError ? <>
              <p className="text-white text-lg font-semibold">Case unavailable</p>
              <p className="text-gray-400 text-sm mt-2">{boxLoadError}</p>
              <div className="mt-5 flex justify-center gap-3">
                <button type="button" onClick={() => { invalidateBoxDetail(boxId); setBoxLoadError(null); setDetailReload((value) => value + 1); }} className="rounded-lg bg-brand-blue px-4 py-2 text-sm font-semibold text-white">Retry</button>
                <button type="button" onClick={() => setView({ type: 'BOXES' })} className="rounded-lg border border-white/15 px-4 py-2 text-sm font-semibold text-white">Back</button>
              </div>
            </> : <>
              <p className="text-white text-lg font-semibold">Loading box...</p>
              <p className="text-gray-400 text-sm mt-2">We&apos;re syncing the drops and odds for this box.</p>
            </>}
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
                  className={`relative inline-flex min-h-9 items-center overflow-hidden rounded-md p-[1.5px] transition-all disabled:cursor-not-allowed disabled:opacity-60 ${canOpenWithXp ? 'shadow-[0_0_18px_rgba(34,211,238,0.28)] ring-1 ring-cyan-200/30' : ''}`}
                  style={{ background: canOpenWithXp ? 'linear-gradient(135deg, rgba(103, 232, 249, 0.95), rgba(255, 255, 255, 0.28), rgba(34, 211, 238, 0.95))' : `conic-gradient(from -90deg, rgba(34, 211, 238, 0.9) ${xpProgress * 360}deg, rgba(255, 255, 255, 0.18) ${xpProgress * 360}deg 360deg)` }}
                  aria-label={`Open with XP: ${currentXpBalance.toLocaleString()} / ${xpCostForCoinCase.toLocaleString()}`}
                  title={`Open with XP: ${currentXpBalance.toLocaleString()} / ${xpCostForCoinCase.toLocaleString()}`}
                >
                  {canOpenWithXp ? (
                    <span aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[linear-gradient(110deg,transparent_18%,rgba(255,255,255,0.45)_50%,transparent_82%)] motion-safe:animate-[pulse_2.4s_ease-in-out_infinite]" />
                  ) : null}
                  <span className={`relative inline-flex min-h-[32px] items-center rounded-[5px] px-2.5 py-1 text-[10px] font-semibold whitespace-nowrap sm:text-xs ${canOpenWithXp ? 'bg-[#071018]/95 text-cyan-50 hover:bg-[#0a1721]' : 'bg-black/35 text-gray-200'}`}>
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
        <div className="relative mb-3 w-full overflow-visible rounded-3xl border border-white/10 bg-[radial-gradient(circle_at_50%_28%,rgba(111,77,255,0.16),transparent_42%),linear-gradient(180deg,rgba(17,24,39,0.8),rgba(8,12,20,0.35))] p-0 shadow-[0_24px_70px_rgba(0,0,0,0.32)] sm:mb-5">

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
              className="absolute left-1/2 top-1/2 flex h-full w-screen -translate-x-1/2 -translate-y-1/2 items-center overflow-hidden border-y border-white/10 bg-[linear-gradient(180deg,rgba(5,9,17,0.92),rgba(20,27,40,0.82)_50%,rgba(5,9,17,0.92))] shadow-[inset_0_14px_30px_rgba(0,0,0,0.38),inset_0_-14px_30px_rgba(0,0,0,0.38)]"
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

                {/* Center Indicator */}
                <i
                  className="fa-solid fa-caret-down pointer-events-none absolute left-1/2 top-1 z-30 -translate-x-1/2 text-base leading-none transition-[color,filter,text-shadow] duration-150 ease-out motion-reduce:transition-none sm:top-0 sm:text-lg"
                  style={{
                    color: centeredRarityIndicator.color,
                    filter: reduceMobileEffects || isSpinning ? 'none' : `drop-shadow(0 0 8px ${centeredRarityIndicator.glow})`,
                    textShadow: reduceMobileEffects || isSpinning ? `0 0 8px ${centeredRarityIndicator.glow}` : `0 0 10px ${centeredRarityIndicator.glow}, 0 0 20px ${centeredRarityIndicator.glow}`
                  }}
                  title={`${centeredRarityIndicator.label} item passing the spinner`}
                  aria-hidden="true"
                ></i>

                {/* A fixed selection frame makes the winning position unmistakable. */}
                <div className="pointer-events-none absolute bottom-3 left-1/2 top-3 z-30 w-[196px] -translate-x-1/2 rounded-2xl border-2 border-cyan-200/80 bg-cyan-300/[0.025] shadow-[0_0_0_1px_rgba(255,255,255,0.15),0_0_26px_rgba(34,211,238,0.24),inset_0_0_24px_rgba(34,211,238,0.08)]" aria-hidden="true">
                  <span className="absolute -bottom-1 left-1/2 h-2.5 w-10 -translate-x-1/2 rounded-full bg-cyan-300 shadow-[0_0_15px_rgba(34,211,238,0.9)]" />
                </div>

                {/* The Moving Reel */}
                <div
                    ref={scrollContainerRef}
                    className={`pullz-spinner-track flex transition-opacity duration-300 opacity-100 ${isSpinning ? 'will-change-transform' : ''}`}
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
                          const showItemGlow = true;
                          return (
                        <div
                            key={`${item.id}-${idx}`}
                            ref={idx === reelWinnerIndex ? winningCardRef : null}
                            className="pullz-spinner-card group relative flex flex-shrink-0 items-center justify-center overflow-visible px-1"
                            style={{
                                width: `${spinnerCardWidth}px`,
                                height: `${spinnerCardHeight}px`,
                                backfaceVisibility: 'hidden',
                                WebkitBackfaceVisibility: 'hidden',
                                opacity: 1,
                                filter: 'none',
                                zIndex: isFocusedItem ? 4 : 1
                            }}
                            onMouseEnter={() => !isSpinning && playSound('hover')}
                        >
                            <div
                              className={`pullz-spinner-rarity-glow pullz-spinner-glow pointer-events-none absolute inset-x-5 top-6 bottom-6 rounded-[40%] ${showItemGlow ? 'opacity-60 blur-2xl sm:blur-3xl' : 'opacity-0 blur-none'} ${rarityGlow}`}
                              style={{ boxShadow: isFocusedItem && !reduceMobileEffects ? `0 0 20px ${item.color}40` : 'none' }}
                            />
                            <div className="relative z-10 flex min-h-0 flex-1 items-center justify-center self-stretch">
                              <div className={`flex items-center justify-center ${useMobileSpinnerBehavior ? 'h-[154px] w-[154px] sm:h-[170px] sm:w-[170px]' : 'h-[170px] w-[170px]'}`}>
                              <BlurImage
                                  src={item.image}
                                  alt={item.name}
                                  loading={isSpinning || idx < 8 || Math.abs(idx - reelWinnerIndex) <= 2 ? 'eager' : 'lazy'}
                                  fetchPriority={isSpinning || idx < 4 || Math.abs(idx - reelWinnerIndex) <= 1 ? 'high' : 'low'}
                                  showPlaceholder={false}
                                  staticRender={reduceMobileEffects || isSpinning}
                                  retryOnError={!(reduceMobileEffects || isSpinning)}
                                  className={`h-full w-full object-contain ${reduceMobileEffects || isSpinning ? '' : 'drop-shadow-[0_8px_18px_rgba(0,0,0,0.55)]'} ${item.id === 'golden-ticket' && animationPhase === 'idle' && !reduceMobileEffects ? 'animate-pulse' : ''}`}
                              />
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
            <div className="relative z-20 mt-1 flex flex-wrap items-center justify-center gap-2 bg-transparent px-3 pb-4 pt-3 sm:mt-2 sm:gap-3 sm:px-4">
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
                      ) : isRewardOpen ? (
                        'Open Reward Box'
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
                {!isFreeOpening && !isRewardOpen && (
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
                  <div className={`win-rarity-card__inner relative flex w-full flex-col items-center overflow-hidden rounded-[calc(1rem-1px)] border border-white/10 bg-black/40 p-4 transition-all duration-300 ${isWinImageZoomed ? 'py-6 sm:py-8' : ''}`}>
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
                    <button
                      type="button"
                      onClick={() => setIsWinImageZoomed((zoomed) => !zoomed)}
                      className="relative z-10 mx-auto touch-manipulation appearance-none rounded-2xl bg-transparent p-0 transition-transform duration-300 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70 active:scale-[0.98]"
                      aria-label={isWinImageZoomed ? `Shrink ${wonItem.name} image` : `Zoom ${wonItem.name} image`}
                      aria-pressed={isWinImageZoomed}
                    >
                      <img
                        src={wonItem.image || wonInventoryItem?.image || box?.image || ''}
                        alt={wonItem.name}
                        className={`mx-auto shrink-0 object-contain transition-all duration-300 ease-out ${isWinImageZoomed ? 'h-56 w-56 sm:h-72 sm:w-72' : 'h-32 w-32 sm:h-36 sm:w-36'}`}
                        loading="eager"
                        decoding="async"
                        draggable={false}
                      />
                    </button>
                    <div className={`relative z-10 grid transition-all duration-300 ease-out ${isWinImageZoomed ? 'mt-0 grid-rows-[0fr] opacity-0' : 'mt-1 grid-rows-[1fr] opacity-100'}`} aria-hidden={isWinImageZoomed}>
                      <div className="min-h-0 overflow-hidden">
                        <h4 className="text-lg font-bold text-white">{wonItem.name}</h4>
                        <CoinAmount
                          amount={toCoins(wonItem.price, PRICE_UNIT_MODE)}
                          formatOptions={{ maximumFractionDigits: 0 }}
                          className="mt-2 font-semibold text-gray-200"
                          iconClassName="w-4 h-4"
                        />
                      </div>
                    </div>
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
                  <div className="flex flex-col gap-2.5">
                    <button onClick={handleKeep} className="h-14 w-full rounded-xl btn-logo-gradient px-4 text-sm font-bold text-white shadow-[0_12px_30px_rgba(111,77,255,0.28)] transition hover:brightness-110">
                      <span className="inline-flex items-center gap-2"><Backpack className="h-4 w-4 flex-none" />Keep This Card</span>
                    </button>
                    {wonItem.redeemable !== false && (
                      <button
                        onClick={handleSell}
                        disabled={isSellingItem}
                        className="h-12 w-full rounded-xl border border-emerald-400/35 bg-emerald-500/15 px-4 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-500/25 disabled:opacity-60"
                      >
                        <span className="inline-flex flex-wrap items-center justify-center gap-2 rounded-md px-3 py-2 sm:flex-nowrap sm:px-0 sm:py-0">
                          <Wallet className="h-4 w-4 flex-none" />
                          {isSellingItem ? (
                            'Selling item...'
                          ) : (
                            <>
                              <span>Sell for</span>
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
                    <button
                      type="button"
                      onClick={() => void handleShareUnboxing()}
                      className="mx-auto min-h-10 px-4 text-xs font-semibold text-cyan-200 underline decoration-cyan-300/40 underline-offset-4 transition hover:text-cyan-100"
                    >
                      <span className="inline-flex items-center justify-center gap-2"><Share2 className="h-3.5 w-3.5" />Share Pull</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {showPostFreeBoxModal && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center bg-[#070611]/75 p-3 backdrop-blur-sm sm:p-5">
            <div
              className="relative w-full max-w-[28rem] overflow-hidden rounded-[1.35rem] border border-violet-300/20 bg-[radial-gradient(circle_at_50%_-15%,rgba(117,82,255,0.22),transparent_39%),linear-gradient(145deg,#151225_0%,#0c0b17_64%,#11101d_100%)] px-4 pb-5 pt-3 shadow-[0_26px_80px_rgba(0,0,0,0.6)] sm:px-7 sm:pb-7 sm:pt-5"
              role="dialog"
              aria-modal="true"
              aria-labelledby="first-deposit-offer-title"
            >
              <button
                type="button"
                onClick={() => {
                  playSound('click');
                  redirectToBoxesCatalog();
                }}
                className="absolute right-3 top-3 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/[0.08] text-slate-300 transition hover:bg-white/[0.14] hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 sm:right-4 sm:top-4"
                aria-label="Maybe later, return to boxes"
              >
                <X className="h-5 w-5" />
              </button>

              <div className="relative mx-auto flex h-[166px] w-[220px] items-center justify-center sm:h-[178px] sm:w-[240px]" aria-hidden="true">
                <span className="absolute left-6 top-8 h-2 w-2 rounded-sm bg-violet-400 shadow-[0_0_12px_3px_rgba(167,139,250,0.6)]" />
                <span className="absolute right-7 top-6 h-1.5 w-1.5 rounded-full bg-fuchsia-300 shadow-[0_0_12px_3px_rgba(232,121,249,0.5)]" />
                <span className="absolute bottom-7 right-5 h-2 w-2 rounded-sm bg-indigo-300 shadow-[0_0_12px_3px_rgba(129,140,248,0.55)]" />
                <img
                  src={wonItem?.image || pullzLogo}
                  alt=""
                  className="h-[142px] w-[142px] object-contain drop-shadow-[0_16px_22px_rgba(0,0,0,0.6)] sm:h-[154px] sm:w-[154px]"
                />
              </div>

              <div className="text-center">
                <h3 id="first-deposit-offer-title" className="text-[22px] font-black uppercase leading-tight tracking-[-0.035em] text-white sm:text-[26px]">
                  Your first pull was on us
                </h3>
                <p className="mt-1 text-sm font-bold text-[#9ea5ff] sm:text-base">Keep the collection going</p>
                <p className="mt-5 text-sm text-slate-300 sm:text-base">Get a <span className="font-extrabold text-fuchsia-300">50%</span> bonus on your first deposit.</p>
              </div>

              <div className="mt-5 grid grid-cols-[0.85fr_auto_0.8fr_auto_1.2fr] items-center rounded-xl border border-white/10 bg-black/20 px-2 py-3 text-center sm:px-3">
                <div className="min-w-0">
                  <p className="text-[9px] font-bold uppercase tracking-wide text-slate-500">You deposit</p>
                  <p className="mt-1 text-base font-black text-white sm:text-lg">$20</p>
                </div>
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/10 text-xs text-slate-300">›</span>
                <div className="min-w-0">
                  <p className="text-[9px] font-bold uppercase tracking-wide text-slate-500">Bonus</p>
                  <p className="mt-1 whitespace-nowrap text-sm font-black text-fuchsia-300 sm:text-base">+1,000 coins</p>
                </div>
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/10 text-xs text-slate-300">›</span>
                <div className="min-w-0">
                  <p className="text-[9px] font-bold uppercase tracking-wide text-slate-500">You receive</p>
                  <CoinAmount amount={3000} animated={false} className="mt-1 whitespace-nowrap text-sm font-black text-white sm:text-base" iconClassName="h-4 w-4" />
                </div>
              </div>

              <div className="mt-5 flex flex-col gap-2.5">
                <button
                  type="button"
                  onClick={handlePostFreePrimaryAction}
                  className="min-h-[52px] w-full rounded-xl bg-gradient-to-r from-[#4d70ff] via-[#7b55ff] to-[#d63ee9] px-4 py-3 text-sm font-black text-white shadow-[0_10px_26px_rgba(125,71,255,0.38)] transition hover:brightness-110 active:scale-[0.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-200"
                >
                  Deposit $20 + Get 1,000 Bonus Coins&nbsp; ›
                </button>
                <button
                  type="button"
                  onClick={() => {
                    playSound('click');
                    redirectToBoxesCatalog();
                  }}
                  className="min-h-10 w-full rounded-xl px-4 py-2 text-sm font-bold text-slate-300 transition hover:bg-white/[0.06] hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-300"
                >
                  Maybe Later
                </button>
              </div>
              <p className="mt-2 text-center text-[10px] text-slate-500">Offer applies to your first deposit only. Bonus terms apply.</p>
            </div>
          </div>
        )}
        <style>{`
          .ambient-pulse { animation: ambientPulse 3s ease-in-out infinite; }
          @keyframes ambientPulse { 0%,100% { transform: scale(1); box-shadow: 0 0 0 rgba(34,211,238,0.2);} 50% { transform: scale(1.02); box-shadow: 0 0 22px rgba(34,211,238,0.32);} }
          @keyframes fadeOut { from { opacity: 1; } to { opacity: 0; } }
          @media (prefers-reduced-motion: reduce){ .ambient-pulse { animation: none; } }
        `}</style>


        {/* Box Contents */}
        <div className="mt-6 border-t border-white/10 bg-transparent py-8 sm:mt-8 sm:py-10">
            <div className="mb-6 flex items-center gap-3 sm:gap-4">
                <div className="flex h-24 w-24 shrink-0 items-center justify-center sm:h-28 sm:w-28" aria-hidden="true">
                  <BlurImage
                    src={box?.image || pullzLogo}
                    alt=""
                    showPlaceholder={false}
                    className="h-full w-full object-contain drop-shadow-[0_14px_24px_rgba(0,0,0,0.55)]"
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
                  </div>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                {visibleDropItems.map((item) => {
                  const rarityKey = normalizeRarityKey(item.rarity);
                  const rarityAccent = dropTableRarityAccent[rarityKey] ?? dropTableRarityAccent.common;
                  const itemCoinValue = toCoins(item.price, PRICE_UNIT_MODE);
                  return (
                    <button
                        key={item.id}
                        type="button"
                        onClick={() => setSelectedCaseItem(item)}
                        className={`group relative flex min-h-[270px] overflow-hidden rounded-lg border border-white/10 bg-gradient-to-br ${rarityAccent} text-left shadow-[0_18px_34px_rgba(0,0,0,0.32)] transition-all hover:-translate-y-0.5 hover:border-white/20 hover:shadow-[0_20px_40px_rgba(0,0,0,0.38)] active:translate-y-0 sm:min-h-[320px]`}
                        style={{ boxShadow: `0 18px 34px rgba(0,0,0,0.32), inset 0 0 0 1px ${item.color}22` }}
                    >
                        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_15%,rgba(255,255,255,0.12),transparent_18%),radial-gradient(circle_at_88%_24%,rgba(255,255,255,0.16),transparent_14%),linear-gradient(180deg,rgba(255,255,255,0.06)_0%,transparent_46%,rgba(0,0,0,0.18)_100%)]" />
                        <div className="pointer-events-none absolute inset-0 opacity-45" style={{ backgroundImage: `radial-gradient(circle at 94% 28%, ${item.color} 0 1.5px, transparent 2px), radial-gradient(circle at 8% 42%, ${item.color} 0 1px, transparent 1.8px), radial-gradient(circle at 54% 92%, ${item.color} 0 1px, transparent 1.8px)`, backgroundSize: '48px 52px' }} />
                        <div className="relative flex w-full flex-col">
                          <div className="flex h-44 items-center justify-center px-1.5 pb-1 pt-3 sm:h-[248px] sm:px-2 sm:pt-4">
                              <BlurImage src={item.image} alt={item.name} className="h-full max-h-none w-[112%] max-w-none object-contain drop-shadow-[0_12px_18px_rgba(0,0,0,0.48)] transition-transform duration-300 group-hover:scale-[1.06] sm:w-[118%]" loading="lazy" width={240} height={280} staticRender={reduceMobileEffects} retryOnError={!reduceMobileEffects} />
                              {item.redeemable === false && (
                                <span className="absolute right-2 top-2 inline-flex h-5 w-5 items-center justify-center rounded-full border border-amber-300/60 bg-amber-500/20 text-[11px] font-black text-amber-100" aria-label="Special item" title="Special item">
                                  i
                                </span>
                              )}
                          </div>
                          <div className="mt-auto px-3 pb-3 sm:px-4 sm:pb-4">
                              <div className="truncate text-center text-[13px] font-black leading-tight text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.65)] sm:text-sm" title={item.name}>{item.name}</div>
                              <div className="mt-3 border-t border-white/10 pt-2.5">
                                  <div className="flex items-center justify-between gap-2">
                                    <CoinAmount
                                      amount={itemCoinValue}
                                      formatOptions={{ maximumFractionDigits: itemCoinValue >= 1000 ? 1 : 0, notation: itemCoinValue >= 1000 ? 'compact' : 'standard' }}
                                      className="text-sm font-black text-white sm:text-base"
                                      iconClassName="w-3.5 h-3.5 sm:w-4 sm:h-4"
                                    />
                                    {!hideDropTableOdds && (
                                      <span
                                        className="text-xs font-black sm:text-sm"
                                        style={{ color: item.color, textShadow: `0 0 10px ${item.color}55` }}
                                      >
                                        {item.chance}%
                                      </span>
                                    )}
                                  </div>
                              </div>
                          </div>
                        </div>
                    </button>
                  );
                })}
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
              <div className={`item-modal-hero item-modal-hero--${normalizeRarityKey(selectedCaseItem.rarity)} relative flex items-center justify-center overflow-hidden px-3 transition-[height] duration-300 ${isItemImageZoomed ? 'h-[22rem] sm:h-[26rem]' : 'h-64 sm:h-72'}`}>
                <div className={`item-modal-rarity-bg item-modal-rarity-bg--${normalizeRarityKey(selectedCaseItem.rarity)} ${itemModalActive ? 'is-active' : ''}`} aria-hidden="true" />
                <div className={`item-modal-rarity-glow item-modal-rarity-glow--${normalizeRarityKey(selectedCaseItem.rarity)} ${itemModalActive ? 'is-active' : ''}`} aria-hidden="true" />
                <button
                  ref={itemModalCloseRef}
                  type="button"
                  onClick={() => setSelectedCaseItem(null)}
                  className="absolute right-4 top-4 z-20 flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-black/40 text-white"
                  aria-label="Close item details"
                >
                  <X className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setIsItemImageZoomed((zoomed) => !zoomed)}
                  className="relative z-10 touch-manipulation appearance-none rounded-2xl bg-transparent p-0 transition-transform duration-300 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70 active:scale-[0.98]"
                  aria-label={isItemImageZoomed ? `Shrink ${selectedCaseItem.name} image` : `Zoom ${selectedCaseItem.name} image`}
                  aria-pressed={isItemImageZoomed}
                >
                  <img src={selectedCaseItem.image} alt={selectedCaseItem.name} className={`item-modal-image h-48 w-48 object-contain drop-shadow-2xl sm:h-56 sm:w-56 ${isItemImageZoomed ? 'is-zoomed' : ''}`} />
                </button>
              </div>
              <div className={`grid transition-all duration-300 ease-out ${isItemImageZoomed ? 'grid-rows-[0fr] opacity-0' : 'grid-rows-[1fr] opacity-100'}`} aria-hidden={isItemImageZoomed}>
                <div className="min-h-0 overflow-hidden space-y-5 px-5 py-6 sm:px-6">
                <div className="text-center">
                  <h3 id="item-details-title" className="text-balance text-xl font-bold text-white sm:text-2xl">{selectedCaseItem.name}</h3>
                  <div className="mt-2">
                    <span className={`rarity-badge ${String(selectedCaseItem.rarity ?? '').toLowerCase() === 'legendary' ? 'legendary-badge' : ''}`} style={String(selectedCaseItem.rarity ?? '').toLowerCase() === 'legendary' ? undefined : { color: selectedCaseItem.color, borderColor: `${selectedCaseItem.color}66`, backgroundColor: `${selectedCaseItem.color}1a` }}>
                      {selectedCaseItem.rarity ?? 'Item'}
                    </span>
                  </div>
                </div>
                <div className={`grid gap-3 ${hideDropTableOdds ? 'grid-cols-1' : 'grid-cols-2'}`}>
                  <div className="rounded-xl border border-white/10 bg-black/30 p-3 text-center">
                    <span className="block text-[10px] font-bold uppercase tracking-wide text-gray-400">Value</span>
                    <CoinAmount amount={animatedModalCoins} formatOptions={{ maximumFractionDigits: 0 }} className="mt-2 justify-center text-lg font-bold text-white" iconClassName="h-4 w-4" />
                  </div>
                  {!hideDropTableOdds && (
                    <div className="rounded-xl border border-white/10 bg-black/30 p-3 text-center">
                      <span className="text-[10px] font-bold uppercase tracking-wide text-gray-400">Drop Chance</span>
                      <div className="mt-1 text-lg font-bold text-white">{typeof selectedCaseItem.chance === 'number' ? `${selectedCaseItem.chance}%` : '—'}</div>
                    </div>
                  )}
                </div>
                <button type="button" onClick={() => setSelectedCaseItem(null)} className="h-12 w-full rounded-xl bg-white text-sm font-bold text-black transition hover:bg-gray-200">Close</button>
                </div>
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
          .modal-container.active .item-modal-image.is-zoomed {
            transform: scale(1.35);
          }
          @media (max-width: 640px) {
            .modal-container.active .item-modal-image.is-zoomed {
              transform: scale(1.22);
            }
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
          .item-modal-hero--legendary { background: linear-gradient(135deg, rgba(124, 45, 18, 0.92), rgba(69, 26, 3, 0.96)); }
          .item-modal-hero--epic { background: linear-gradient(135deg, rgba(76, 29, 149, 0.92), rgba(46, 16, 101, 0.96)); }
          .item-modal-hero--rare { background: linear-gradient(135deg, rgba(12, 74, 110, 0.92), rgba(23, 37, 84, 0.96)); }
          .item-modal-hero--uncommon { background: linear-gradient(135deg, rgba(6, 78, 59, 0.92), rgba(2, 44, 34, 0.96)); }
          .item-modal-hero--common { background: linear-gradient(135deg, rgba(51, 65, 85, 0.92), rgba(15, 23, 42, 0.96)); }
          .item-modal-rarity-bg--legendary {
            background: radial-gradient(circle at center, rgba(251, 191, 36, 0.52), transparent 66%), radial-gradient(circle at top, rgba(255, 237, 213, 0.18), transparent 40%);
            animation: legendaryPulse 2s ease-in-out infinite;
          }
          .item-modal-rarity-bg--epic {
            background: radial-gradient(circle at center, rgba(168, 85, 247, 0.46), transparent 68%), radial-gradient(circle at top, rgba(216, 180, 254, 0.15), transparent 42%);
          }
          .item-modal-rarity-bg--rare {
            background: radial-gradient(circle at center, rgba(56, 189, 248, 0.44), transparent 68%), radial-gradient(circle at top, rgba(191, 219, 254, 0.14), transparent 42%);
          }
          .item-modal-rarity-bg--uncommon {
            background: radial-gradient(circle at center, rgba(52, 211, 153, 0.38), transparent 70%), radial-gradient(circle at top, rgba(167, 243, 208, 0.13), transparent 42%);
          }
          .item-modal-rarity-bg--common {
            background: radial-gradient(circle at center, rgba(148, 163, 184, 0.28), transparent 72%), radial-gradient(circle at top, rgba(226, 232, 240, 0.10), transparent 44%);
          }
          .item-modal-rarity-glow--legendary { background: radial-gradient(circle at center, rgba(251, 191, 36, 0.34) 0%, transparent 70%); }
          .item-modal-rarity-glow--epic { background: radial-gradient(circle at center, rgba(168, 85, 247, 0.32) 0%, transparent 70%); }
          .item-modal-rarity-glow--rare { background: radial-gradient(circle at center, rgba(56, 189, 248, 0.30) 0%, transparent 70%); }
          .item-modal-rarity-glow--uncommon { background: radial-gradient(circle at center, rgba(52, 211, 153, 0.28) 0%, transparent 70%); }
          .item-modal-rarity-glow--common { background: radial-gradient(circle at center, rgba(148, 163, 184, 0.22) 0%, transparent 70%); }
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
