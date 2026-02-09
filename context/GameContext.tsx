import React, { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react';
import { AppNotification, User, InventoryItem, CaseItem, InventoryProvenance, ViewState, Battle, MysteryBox, ShippingAddress, UserLocks, CoinPackage, StripeSettings, Shipment, ShipmentStatus } from '../types';
import { CASE_ITEMS } from '../constants';
import { auth, db } from '../firebase';
import { authedFetch } from '../utils/authedFetch';
import { PRICE_UNIT_MODE, toCoins } from '../utils/coins';
import { 
  User as FirebaseUser,
  AuthCredential,
  EmailAuthProvider,
  GoogleAuthProvider,
  browserLocalPersistence,
  browserSessionPersistence,
  applyActionCode,
  onAuthStateChanged,
  setPersistence,
  signInWithCredential,
  signInWithEmailAndPassword,
  signInWithPopup,
  createUserWithEmailAndPassword,
  fetchSignInMethodsForEmail,
  linkWithCredential,
  sendEmailVerification,
  sendPasswordResetEmail,
  signOut
} from 'firebase/auth';
import { 
  addDoc,
  collection,
  collectionGroup,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  QueryDocumentSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  Timestamp,
  where
} from 'firebase/firestore';

const sanitizeData = <T extends Record<string, any>>(data: T): T => {
  return Object.fromEntries(
    Object.entries(data).filter(([, value]) => value !== undefined)
  ) as T;
};

const sanitizeDeep = (value: any): any => {
  if (Array.isArray(value)) return value.map(sanitizeDeep);
  if (value && typeof value === 'object') {
    const cleaned: Record<string, any> = {};
    Object.entries(value).forEach(([k, v]) => {
      if (v !== undefined) cleaned[k] = sanitizeDeep(v);
    });
    return cleaned;
  }
  return value;
};

const buildFallbackInstanceId = (item: Partial<InventoryItem>, fallbackId: string) => {
  const obtainedAt = Number(item.obtainedAt ?? 0);
  const price = Number(item.price ?? 0);
  const name = item.name ?? 'Mystery Item';
  return `${fallbackId}-${obtainedAt}-${price}-${name}`;
};

const normalizeInventoryItems = (items: unknown): InventoryItem[] => {
  if (!Array.isArray(items)) return [];
  return items.map((item, index) => {
    const typed = item as Partial<InventoryItem>;
    const fallbackId = typeof typed.id === 'string' ? typed.id : `item-${index}`;
      return {
      ...(typed as InventoryItem),
      id: fallbackId,
      instanceId: typed.instanceId || buildFallbackInstanceId(typed, fallbackId),
      obtainedAt: Number(typed.obtainedAt ?? 0),
      status: (typed.status ?? 'available') as InventoryItem['status'],
      rarity: (typed.rarity ?? 'common') as InventoryItem['rarity'],
      price: Number(typed.price ?? 0),
      name: typed.name ?? 'Mystery Item',
      image: typed.image ?? 'https://picsum.photos/200',
      chance: Number(typed.chance ?? 0),
      color: typed.color ?? '#9ca3af',
      brand: typeof typed.brand === 'string' ? typed.brand : '',
      category: typeof typed.category === 'string' ? typed.category : '',
      tags: Array.isArray(typed.tags) ? typed.tags : [],
      sizes: Array.isArray(typed.sizes) ? typed.sizes.filter((size) => typeof size === 'string') : [],
      size: typeof typed.size === 'string' ? typed.size : undefined,
      trackingNumber: typeof typed.trackingNumber === 'string' ? typed.trackingNumber : undefined,
      redeemable: typed.redeemable ?? true,
      sellBackRate: Number(typed.sellBackRate ?? 0)
    };
  });
};

const RARITY_COLORS: Record<InventoryItem['rarity'], string> = {
  common: '#9ca3af',
  uncommon: '#22c55e',
  rare: '#3b82f6',
  epic: '#a855f7',
  legendary: '#fbbf24'
};

const inventorySignature = (items: InventoryItem[]) =>
  items
    .map((item) => `${item.instanceId}:${item.price}:${item.rarity}:${item.obtainedAt}`)
    .join('|');

const rankTopPullsByValue = (items: InventoryItem[], limit = 6) =>
  [...items]
    .sort((a, b) => {
      const priceDiff = b.price - a.price;
      if (priceDiff !== 0) return priceDiff;
      return b.obtainedAt - a.obtainedAt;
    })
    .slice(0, limit);

const DEFAULT_LOCKS: UserLocks = {
  openCases: false,
  deposits: false,
  withdraws: false,
  marketplace: false,
  shipments: false
};

const EMAIL_VERIFICATION_PENDING_KEY = 'pendingEmailVerification';
const EMAIL_VERIFICATION_REDIRECT_KEY = 'pendingEmailRedirect';
const EMAIL_VERIFICATION_COMPLETED_KEY = 'emailVerificationCompleted';

const hasPendingEmailVerification = () => {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(EMAIL_VERIFICATION_PENDING_KEY) === 'true';
};

const setPendingEmailVerification = (redirectPath?: string) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(EMAIL_VERIFICATION_PENDING_KEY, 'true');
  if (redirectPath) {
    window.localStorage.setItem(EMAIL_VERIFICATION_REDIRECT_KEY, redirectPath);
  }
};

const getCurrentPath = () => {
  if (typeof window === 'undefined') return '/';
  return `${window.location.pathname}${window.location.search}`;
};

const setEmailVerificationCompleted = () => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(EMAIL_VERIFICATION_COMPLETED_KEY, 'true');
};

const hasEmailVerificationCompleted = () => {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(EMAIL_VERIFICATION_COMPLETED_KEY) === 'true';
};

const getPendingEmailRedirect = () => {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(EMAIL_VERIFICATION_REDIRECT_KEY);
};

const clearPendingEmailVerification = () => {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(EMAIL_VERIFICATION_PENDING_KEY);
  window.localStorage.removeItem(EMAIL_VERIFICATION_REDIRECT_KEY);
  window.localStorage.removeItem(EMAIL_VERIFICATION_COMPLETED_KEY);
};

interface BonusSettings {
  xpPer100Coins: number;
  xpPerCaseOpen: number;
  levelBaseXp: number;
  levelXpMultiplier: number;
  rakebackUnlockLevel: number;
  rakebackBasePercent: number;
  rakebackBonusCoins: number;
  rakebackDailyCapCoins: number;
}

const DEFAULT_BONUS_SETTINGS: BonusSettings = {
  xpPer100Coins: 25,
  xpPerCaseOpen: 15,
  levelBaseXp: 200,
  levelXpMultiplier: 1.12,
  rakebackUnlockLevel: 6,
  rakebackBasePercent: 5,
  rakebackBonusCoins: 2500,
  rakebackDailyCapCoins: 15000
};

const getStoredBonusSettings = (): BonusSettings => DEFAULT_BONUS_SETTINGS;

const DEFAULT_STRIPE_SETTINGS: StripeSettings = {
  shippingCashEnabled: false,
  shippingFlatRateCents: 0,
  shippingCoinEnabled: false,
  shippingCoinCostCoins: 0,
  stripeShippingProductId: '',
  caseLabPublishFeeCoins: 0,
  caseLabSellBackPercent: 75
};

const normalizeStripeSettings = (settings: Partial<StripeSettings>): StripeSettings => {
  const legacyProductId =
    typeof (settings as { stripeShippingKeyOrId?: string }).stripeShippingKeyOrId === 'string'
      ? (settings as { stripeShippingKeyOrId?: string }).stripeShippingKeyOrId
      : '';

  return {
    shippingCashEnabled: settings.shippingCashEnabled === true,
    shippingFlatRateCents: Math.max(0, Math.round(Number(settings.shippingFlatRateCents) || 0)),
    shippingCoinEnabled: settings.shippingCoinEnabled === true,
    shippingCoinCostCoins: Math.max(0, Math.round(Number(settings.shippingCoinCostCoins) || 0)),
    stripeShippingProductId:
      typeof settings.stripeShippingProductId === 'string' ? settings.stripeShippingProductId : legacyProductId,
    caseLabPublishFeeCoins: Math.max(0, Math.round(Number(settings.caseLabPublishFeeCoins) || 0)),
    caseLabSellBackPercent: Math.min(100, Math.max(0, Math.round(Number(settings.caseLabSellBackPercent) || 0)))
  };
};

const normalizeBonusSettings = (settings: Partial<BonusSettings>): BonusSettings => ({
  xpPer100Coins: Math.max(0, Number(settings.xpPer100Coins) || 0),
  xpPerCaseOpen: Math.max(0, Number(settings.xpPerCaseOpen) || 0),
  levelBaseXp: Math.max(1, Number(settings.levelBaseXp) || DEFAULT_BONUS_SETTINGS.levelBaseXp),
  levelXpMultiplier: Math.max(1, Number(settings.levelXpMultiplier) || DEFAULT_BONUS_SETTINGS.levelXpMultiplier),
  rakebackUnlockLevel: Math.max(1, Number(settings.rakebackUnlockLevel) || DEFAULT_BONUS_SETTINGS.rakebackUnlockLevel),
  rakebackBasePercent: Math.max(0, Number(settings.rakebackBasePercent) || 0),
  rakebackBonusCoins: Math.max(0, Number(settings.rakebackBonusCoins) || 0),
  rakebackDailyCapCoins: Math.max(0, Number(settings.rakebackDailyCapCoins) || 0)
});

const BONUS_SETTINGS_DOC = 'bonus-settings';
const STRIPE_SETTINGS_DOC = 'stripe-settings';
const USER_BOX_EXPIRY_MS = 24 * 60 * 60 * 1000;
const SIGNUP_CREDIT_COINS = 0.05;

export const calculateLevelProgress = (totalXp: number, overrides?: Partial<BonusSettings>) => {
  const settings = { ...DEFAULT_BONUS_SETTINGS, ...(overrides ?? {}) };
  let level = 1;
  let xpRemaining = Math.max(0, totalXp);
  let xpForNextLevel = Math.max(1, Math.floor(settings.levelBaseXp));

  while (xpRemaining >= xpForNextLevel) {
    xpRemaining -= xpForNextLevel;
    level += 1;
    xpForNextLevel = Math.floor(xpForNextLevel * settings.levelXpMultiplier + 50);
  }

  return {
    level,
    xpIntoLevel: xpRemaining,
    xpForNextLevel,
    xpToNextLevel: xpForNextLevel - xpRemaining
  };
};

const parseBooleanSearchParam = (value: string | null) => {
  if (!value) return false;
  return value === '1' || value.toLowerCase() === 'true';
};

const getViewFromLocation = (pathname: string, search: string): ViewState => {
  const trimmed = pathname.replace(/^\/+|\/+$/g, '');
  const segments = trimmed ? trimmed.split('/') : [];
  const [primary, secondary] = segments;
  const params = new URLSearchParams(search);

  if (!primary || primary === 'home') {
    return { type: 'HOME' };
  }

  if (primary === 'cases') {
    if (secondary) {
      return {
        type: 'CASE_OPENING',
        boxId: secondary,
        isFree: parseBooleanSearchParam(params.get('free'))
      };
    }
    return { type: 'HOME' };
  }

  if (primary === 'battles') {
    if (secondary) {
      return { type: 'BATTLE_ARENA', battleId: secondary };
    }
    return { type: 'BATTLES' };
  }

  if (primary === 'boxes') {
    return { type: 'BOXES' };
  }

  if (primary === 'profile') {
    if (secondary) {
      return { type: 'PROFILE', userId: secondary };
    }
    return { type: 'PROFILE' };
  }

  if (primary === 'inventory') {
    return { type: 'INVENTORY' };
  }

  if (primary === 'bonuses') {
    return { type: 'BONUSES' };
  }

  if (primary === 'contact') {
    return { type: 'CONTACT' };
  }

  if (primary === 'terms') {
    return { type: 'TERMS' };
  }

  if (primary === 'privacy') {
    return { type: 'PRIVACY' };
  }

  if (primary === 'leaderboard') {
    return { type: 'LEADERBOARD' };
  }

  if (primary === 'admin') {
    return { type: 'ADMIN' };
  }

  if (primary === 'case-lab' || primary === 'caselab') {
    return { type: 'CUSTOM_CREATOR' };
  }

  return { type: 'HOME' };
};

const getPathFromView = (view: ViewState): string => {
  switch (view.type) {
    case 'HOME':
      return '/';
    case 'BOXES':
      return '/boxes';
    case 'PROFILE':
      return view.userId ? `/profile/${view.userId}` : '/profile';
    case 'INVENTORY':
      return '/inventory';
    case 'BONUSES':
      return '/bonuses';
    case 'CONTACT':
      return '/contact';
    case 'TERMS':
      return '/terms';
    case 'PRIVACY':
      return '/privacy';
    case 'ADMIN':
      return '/admin';
    case 'LEADERBOARD':
      return '/leaderboard';
    case 'CUSTOM_CREATOR':
      return '/case-lab';
    case 'CASE_OPENING': {
      const search = view.isFree ? '?free=true' : '';
      return `/cases/${view.boxId}${search}`;
    }
    case 'BATTLE_ARENA':
      return `/battles/${view.battleId}`;
    case 'BATTLES':
      return '/battles';
    default:
      return '/';
  }
};

type PersistUserData = Partial<{
  balance: number;
  inventory: InventoryItem[];
  topPulls: InventoryItem[];
  xp: number;
  level: number;
  followers: string[];
  totalSpent: number;
  rakebackBalance: number;
  rakebackEarnedToday: number;
  rakebackEarnedAt: number;
  affiliateCode?: string;
  referredBy?: string;
  shippingAddress: ShippingAddress;
  name: string;
  avatar: string;
  lastDailyClaim: number;
  isAdmin: boolean;
}>;

type GoogleAuthResult =
  | { status: 'success' }
  | { status: 'link-required'; email: string; credential: AuthCredential }
  | { status: 'error'; message: string };

type AuthModalMode = 'login' | 'register';

type EmailVerificationStatus = 'idle' | 'pending' | 'checking' | 'verified-no-session';

interface GameContextType {
  user: User;
  isAuthenticated: boolean;
  balance: number;
  inventory: InventoryItem[];
  shipments: Shipment[];
  users: User[];
  notifications: AppNotification[];
  view: ViewState;
  battles: Battle[];
  boxes: MysteryBox[];
  items: CaseItem[];
  coinPackages: CoinPackage[];
  bonusSettings: BonusSettings;
  stripeSettings: StripeSettings;
  showLoginModal: boolean;
  showTopUpModal: boolean;
  authModalMode: AuthModalMode;
  showEmailVerificationModal: boolean;
  showEmailVerifiedModal: boolean;
  emailVerificationStatus: EmailVerificationStatus;
  authInitialized: boolean;
  
  // Actions
  login: (email: string, pass: string, remember?: boolean) => Promise<void>;
  loginWithGoogle: (remember?: boolean) => Promise<GoogleAuthResult>;
  linkGoogleAccount: (email: string, password: string, credential: AuthCredential) => Promise<GoogleAuthResult>;
  register: (name: string, email: string, pass: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  logout: () => void;
  setShowLoginModal: (show: boolean) => void;
  setShowTopUpModal: (show: boolean) => void;
  setAuthModalMode: (mode: AuthModalMode) => void;
  openAuthModal: (mode?: AuthModalMode) => void;
  resendEmailVerification: () => Promise<void>;
  refreshEmailVerification: () => Promise<void>;
  setShowEmailVerifiedModal: (show: boolean) => void;
  setShowEmailVerificationModal: (show: boolean) => void;
  setView: (view: ViewState) => void;
  addBalance: (amount: number) => void;
  syncBalance: (amount: number) => void;
  deductBalance: (amount: number, options?: { trackRewards?: boolean }) => boolean;
  addToInventory: (item: CaseItem, provenance?: InventoryProvenance) => InventoryItem;
  addInventoryItemFromServer: (item: InventoryItem) => void;
  followUser: (targetUserId: string) => Promise<void>;
  unfollowUser: (targetUserId: string) => Promise<void>;
  sellItem: (instanceId: string) => Promise<void>;
  shipItem: (instanceId: string) => Promise<void>;
  updateAddress: (address: ShippingAddress) => void;
  updateUserInfo: (name: string, avatar: string) => Promise<void>;
  addNotification: (notification: Omit<AppNotification, 'id' | 'createdAt'> & Partial<Pick<AppNotification, 'id' | 'createdAt'>>) => void;
  dismissNotification: (id: string) => void;
  clearNotifications: () => void;
  sendAdminNotification: (message: string) => void;
  createBattle: (boxIds: string[], maxPlayers: number) => Promise<void>;
  joinBattle: (battleId: string) => Promise<void>;
  updateBattle: (updatedBattle: Battle) => void;
  createItem: (item: CaseItem) => Promise<void>;
  updateItem: (item: CaseItem) => Promise<void>;
  deleteItem: (itemId: string) => Promise<void>;
  createCoinPackage: (pkg: Omit<CoinPackage, 'id'> & { id?: string }) => Promise<void>;
  updateCoinPackage: (id: string, updates: Partial<CoinPackage>) => Promise<void>;
  deleteCoinPackage: (id: string) => Promise<void>;
  updateUserFlags: (updates: Partial<User>) => Promise<void>;
  updateUserAdminData: (userId: string, updates: Partial<User>) => Promise<void>;
  updateUserBalance: (userId: string, balance: number) => Promise<void>;
  createBox: (box: MysteryBox) => void; // Admin
  createUserBox: (box: MysteryBox) => Promise<string>; // User Custom
  updateBox: (box: MysteryBox) => void;
  deleteBox: (boxId: string) => Promise<void>;
  claimDaily: () => void;
  claimRakeback: () => Promise<void>;
  updateBonusSettings: (settings: BonusSettings) => void;
  updateStripeSettings: (settings: StripeSettings) => void;
  awardCaseOpenXp: () => void;
  registerSpend: (amount: number) => void;
  generateAffiliateCode: () => Promise<string | undefined>;
  updateUserProgress: (userId: string, xp: number) => Promise<void>;
  updateShipmentStatus: (shipmentId: string, userId: string, inventoryId: string | undefined, status: ShipmentStatus, trackingNumber?: string) => Promise<void>;
}

const getDayStart = (timestamp: number = Date.now()) => {
  const date = new Date(timestamp);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
};

const GameContext = createContext<GameContextType | undefined>(undefined);

// Guest / Loading User
const GUEST_USER: User = {
  id: 'guest',
  name: 'Guest',
  avatar: 'https://picsum.photos/id/64/100/100',
  balance: 0,
  level: 0,
  xp: 0,
  totalSpent: 0,
  rakebackBalance: 0,
  rakebackEarnedToday: 0,
  rakebackEarnedAt: getDayStart(),
  followers: [],
  isAdmin: false,
  chatWarnings: 0,
  chatDisabled: false,
  emailManuallyVerified: false,
  termsFlagged: false
};

const ADMIN_EMAIL = 'jhuxf12@outlook.com';

const getUserRef = (uid: string) => doc(db, 'users', uid);

const normalizeTimestamp = (value: unknown, fallback: number) => {
  if (value instanceof Timestamp) return value.toMillis();
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  if (value && typeof value === 'object' && 'toMillis' in value && typeof (value as { toMillis: () => number }).toMillis === 'function') {
    return (value as { toMillis: () => number }).toMillis();
  }
  return fallback;
};

const buildUserDocument = (user: User) => {
  const payload: Record<string, unknown> = { ...user };
  delete payload.balance;
  delete payload.inventory;

  if (payload.shippingAddress === undefined) {
    delete payload.shippingAddress;
  }

  return sanitizeDeep(payload);
};

const normalizeUsername = (value: string) =>
  value
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .replace(/^_+|_+$/g, '');

const buildBaseUsername = (displayName: string | null | undefined, email: string | null | undefined) => {
  const fromDisplayName = normalizeUsername(displayName ?? '');
  if (fromDisplayName) return fromDisplayName;
  const emailPrefix = (email ?? '').split('@')[0] ?? '';
  const fromEmail = normalizeUsername(emailPrefix);
  return fromEmail || 'player';
};

const ensureUniqueUsername = async (base: string) => {
  const usersRef = collection(db, 'users');
  let attempt = 1;
  let candidate = base;

  while (true) {
    const [usernameSnapshot, nameSnapshot] = await Promise.all([
      getDocs(query(usersRef, where('username', '==', candidate), limit(1))),
      getDocs(query(usersRef, where('name', '==', candidate), limit(1)))
    ]);

    if (usernameSnapshot.empty && nameSnapshot.empty) return candidate;
    attempt += 1;
    candidate = `${base}_${attempt}`;
  }
};

const buildUserProfile = (firebaseUser: FirebaseUser, data: Record<string, any> = {}) => {
  const now = Date.now();
  const metadataCreatedAt = firebaseUser.metadata.creationTime ? Date.parse(firebaseUser.metadata.creationTime) : NaN;
  const fallbackCreatedAt = Number.isFinite(metadataCreatedAt) ? metadataCreatedAt : now;
  const createdAt = normalizeTimestamp(data.createdAt, fallbackCreatedAt);
  const lastChatAt = data.lastChatAt === undefined ? undefined : normalizeTimestamp(data.lastChatAt, now);
  const xp = Number(data.xp ?? 0);
  const progress = calculateLevelProgress(xp);
  const lastDailyClaim = data.lastDailyClaim === undefined ? undefined : normalizeTimestamp(data.lastDailyClaim, 0);
  const followerIds = Array.isArray(data.followers)
    ? data.followers
    : Array.isArray(data.friends)
      ? data.friends
      : [];
  const balance = Number(data.coins ?? data.balance ?? 0);

  return {
    id: firebaseUser.uid,
    createdAt,
    lastChatAt,
    name: data.name || firebaseUser.email?.split('@')[0] || 'Player',
    username: data.username ?? data.name,
    displayName: data.displayName ?? firebaseUser.displayName ?? undefined,
    email: data.email || firebaseUser.email || '',
    avatar: data.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(firebaseUser.email || 'Player')}&background=111827&color=10b981`,
    photoURL: data.photoURL ?? firebaseUser.photoURL ?? undefined,
    provider: data.provider,
    balance,
    level: data.level ?? progress.level,
    xp,
    lastDailyClaim,
    totalSpent: Number(data.totalSpent ?? 0),
    rakebackBalance: Number(data.rakebackBalance ?? 0),
    rakebackEarnedToday: Number(data.rakebackEarnedToday ?? 0),
    rakebackEarnedAt: Number(data.rakebackEarnedAt ?? 0),
    affiliateCode: data.affiliateCode,
    referredBy: data.referredBy,
    followers: followerIds,
    shippingAddress: data.shippingAddress,
    isAdmin: data.isAdmin ?? false,
    chatWarnings: data.chatWarnings ?? 0,
    chatDisabled: data.chatDisabled ?? false,
    chatDisabledAt: data.chatDisabledAt,
    emailManuallyVerified: data.emailManuallyVerified ?? false,
    termsFlagged: data.termsFlagged ?? false,
    status: data.status ?? 'active',
    locks: data.locks ?? DEFAULT_LOCKS,
    ledger: Array.isArray(data.ledger) ? data.ledger : undefined,
    adminLogs: Array.isArray(data.adminLogs) ? data.adminLogs : undefined,
    topPullsPublic: data.topPullsPublic ?? false,
    topPulls: normalizeInventoryItems(data.topPulls)
  } as User;
};

const buildUserProfileFromDoc = (userId: string, data: Record<string, any> = {}) => {
  const now = Date.now();
  const createdAt = normalizeTimestamp(data.createdAt, now);
  const lastChatAt = data.lastChatAt === undefined ? undefined : normalizeTimestamp(data.lastChatAt, now);
  const xp = Number(data.xp ?? 0);
  const progress = calculateLevelProgress(xp);
  const lastDailyClaim = data.lastDailyClaim === undefined ? undefined : normalizeTimestamp(data.lastDailyClaim, 0);
  const followerIds = Array.isArray(data.followers)
    ? data.followers
    : Array.isArray(data.friends)
      ? data.friends
      : [];
  const balance = Number(data.coins ?? data.balance ?? 0);
  const name = data.name || (data.email ? data.email.split('@')[0] : 'Player');

  return {
    id: userId,
    createdAt,
    lastChatAt,
    name,
    username: data.username ?? name,
    displayName: data.displayName,
    email: data.email || '',
    avatar: data.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=111827&color=10b981`,
    photoURL: data.photoURL,
    provider: data.provider,
    balance,
    level: data.level ?? progress.level,
    xp,
    lastDailyClaim,
    totalSpent: Number(data.totalSpent ?? 0),
    rakebackBalance: Number(data.rakebackBalance ?? 0),
    rakebackEarnedToday: Number(data.rakebackEarnedToday ?? 0),
    rakebackEarnedAt: Number(data.rakebackEarnedAt ?? 0),
    affiliateCode: data.affiliateCode,
    referredBy: data.referredBy,
    followers: followerIds,
    shippingAddress: data.shippingAddress,
    isAdmin: data.isAdmin ?? false,
    chatWarnings: data.chatWarnings ?? 0,
    chatDisabled: data.chatDisabled ?? false,
    chatDisabledAt: data.chatDisabledAt,
    emailManuallyVerified: data.emailManuallyVerified ?? false,
    termsFlagged: data.termsFlagged ?? false,
    status: data.status ?? 'active',
    locks: data.locks ?? DEFAULT_LOCKS,
    ledger: Array.isArray(data.ledger) ? data.ledger : undefined,
    adminLogs: Array.isArray(data.adminLogs) ? data.adminLogs : undefined,
    topPullsPublic: data.topPullsPublic ?? false,
    topPulls: normalizeInventoryItems(data.topPulls),
    inventory: normalizeInventoryItems(data.inventory)
  } as User;
};

const mapInventoryDoc = (docSnap: QueryDocumentSnapshot) => {
  const data = docSnap.data() as Record<string, any>;
  const rarity = (data.rarity ?? 'common') as InventoryItem['rarity'];
  const value = Number(data.value ?? data.price ?? 0);
  const obtainedAt = normalizeTimestamp(data.obtainedAt, Date.now());
  const status = (data.status ?? 'available') as InventoryItem['status'];
  const history = Array.isArray(data.history) ? data.history : undefined;

  return {
    id: data.prizeId ?? docSnap.id,
    instanceId: docSnap.id,
    name: data.name ?? 'Mystery Item',
    price: value,
    image: data.image ?? 'https://picsum.photos/200',
    rarity,
    chance: 0,
    color: RARITY_COLORS[rarity] ?? '#9ca3af',
    obtainedAt,
    status,
    size: typeof data.size === 'string' ? data.size : undefined,
    trackingNumber: typeof data.trackingNumber === 'string' ? data.trackingNumber : undefined,
    provenance: data.provenance ?? (data.boxId ? { sourceType: 'case_open', sourceId: data.boxId } : undefined),
    redeemable: data.redeemable ?? true,
    sellBackRate: Number(data.sellBackRate ?? 0),
    locked: data.locked ?? false,
    history
  } as InventoryItem;
};

const mapShipmentDoc = (docSnap: QueryDocumentSnapshot) => {
  const data = docSnap.data() as Record<string, any>;
  const itemData = data.item ?? {};
  const status = (data.status ?? 'shipping_requested') as Shipment['status'];
  const createdAt = data.createdAt ? normalizeTimestamp(data.createdAt, Date.now()) : undefined;
  const updatedAt = data.updatedAt ? normalizeTimestamp(data.updatedAt, 0) : undefined;

  return {
    id: docSnap.id,
    uid: String(data.uid ?? ''),
    inventoryId: typeof data.inventoryId === 'string' ? data.inventoryId : undefined,
    item: {
      name: itemData.name ?? 'Mystery Item',
      value: Number(itemData.value ?? 0),
      image: itemData.image ?? 'https://picsum.photos/200',
      rarity: (itemData.rarity ?? 'common') as Shipment['item']['rarity'],
      sellBackRate: Number(itemData.sellBackRate ?? 0),
      size: itemData.size ?? null,
      boxId: itemData.boxId ?? null,
      prizeId: itemData.prizeId ?? null
    },
    shippingInfo: data.shippingInfo as ShippingAddress | undefined,
    shippingCost: Number(data.shippingCost ?? 0),
    shippingPaid: data.shippingPaid ?? false,
    shippingPaymentMethod: data.shippingPaymentMethod ?? undefined,
    shippingCashAmountCents: Number(data.shippingCashAmountCents ?? 0),
    status,
    trackingNumber: typeof data.trackingNumber === 'string' ? data.trackingNumber : undefined,
    createdAt,
    updatedAt
  } as Shipment;
};

const persistUserData = async (payload: PersistUserData) => {
  const currentUser = auth.currentUser;
  if (!currentUser) return;
  const userRef = getUserRef(currentUser.uid);
  const sanitized = sanitizeDeep(payload);
  delete sanitized.balance;
  delete sanitized.inventory;
  delete sanitized.coins;
  await setDoc(userRef, sanitized, { merge: true });
};

export const GameProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showTopUpModal, setShowTopUpModal] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<AuthModalMode>('login');
  const [showEmailVerificationModal, setShowEmailVerificationModal] = useState(false);
  const [showEmailVerifiedModal, setShowEmailVerifiedModal] = useState(false);
  const [emailVerificationStatus, setEmailVerificationStatus] = useState<EmailVerificationStatus>('idle');
  const [authInitialized, setAuthInitialized] = useState(false);
  const hasInventorySubcollectionRef = useRef(false);
  const pendingSoldIdsRef = useRef<Set<string>>(new Set());
  const pendingBalanceRef = useRef<number | null>(null);
  const activeUserIdRef = useRef<string | null>(null);
  const userUnsubscribeRef = useRef<(() => void) | null>(null);
  const inventoryUnsubscribeRef = useRef<(() => void) | null>(null);

  const setAuthPersistence = async (remember: boolean) => {
    const persistence = remember ? browserLocalPersistence : browserSessionPersistence;
    await setPersistence(auth, persistence);
  };
  
  // -- PERSISTENT STATE INITIALIZATION --
  
  // 1. Initialize User State
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [user, setUser] = useState<User>(GUEST_USER);
  const [users, setUsers] = useState<User[]>([]);
  const [balance, setBalance] = useState<number>(0);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  
  const [view, setViewState] = useState<ViewState>(() => {
    if (typeof window === 'undefined') {
      return { type: 'HOME' };
    }
    return getViewFromLocation(window.location.pathname, window.location.search);
  });

  const scrollToTop = () => {
    if (typeof window === 'undefined') return;
    const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, left: 0, behavior: prefersReducedMotion ? 'auto' : 'smooth' });
  };

  useEffect(() => {
    if (!isAuthenticated) return;
    const nextBalance = Number(user.balance ?? 0);
    if (Number.isFinite(nextBalance) && nextBalance !== balance) {
      setBalance(nextBalance);
    }
  }, [balance, isAuthenticated, user.balance]);

  const setView = (nextView: ViewState) => {
    setViewState(nextView);
    if (typeof window !== 'undefined') {
      scrollToTop();
      const nextPath = getPathFromView(nextView);
      const currentPath = `${window.location.pathname}${window.location.search}`;
      if (nextPath !== currentPath) {
        window.history.pushState({}, '', nextPath);
      }
    }
  };

  const openAuthModal = (mode: AuthModalMode = 'login') => {
    setAuthModalMode(mode);
    setShowLoginModal(true);
  };

  const resolveEmailRedirect = (targetPath?: string | null) => {
    if (typeof window === 'undefined') return;
    const resolvedPath = targetPath || '/';
    const url = new URL(resolvedPath, window.location.origin);
    const nextPath = `${url.pathname}${url.search}`;
    const currentPath = `${window.location.pathname}${window.location.search}`;
    if (nextPath !== currentPath) {
      window.history.replaceState({}, '', nextPath);
    }
    scrollToTop();
    setViewState(getViewFromLocation(url.pathname, url.search));
  };

  const clearUserSubscriptions = () => {
    if (userUnsubscribeRef.current) {
      userUnsubscribeRef.current();
      userUnsubscribeRef.current = null;
    }
    if (inventoryUnsubscribeRef.current) {
      inventoryUnsubscribeRef.current();
      inventoryUnsubscribeRef.current = null;
    }
  };

  const startAuthenticatedSession = (firebaseUser: FirebaseUser) => {
    if (activeUserIdRef.current === firebaseUser.uid) return;
    clearUserSubscriptions();
    activeUserIdRef.current = firebaseUser.uid;
    setIsAuthenticated(true);

    const userRef = getUserRef(firebaseUser.uid);
    userUnsubscribeRef.current = onSnapshot(userRef, (snapshot) => {
      if (!snapshot.exists()) {
        const profile = buildUserProfile(firebaseUser);
        setUser(profile);
        setBalance(0);
        return;
      }

      const data = snapshot.data();
      const profile = buildUserProfile(firebaseUser, data);
      const shouldBeAdmin = profile.email?.toLowerCase() === ADMIN_EMAIL;
      if (shouldBeAdmin && !profile.isAdmin) {
        void setDoc(userRef, { isAdmin: true }, { merge: true }).catch((error) => {
          console.error('Failed to backfill admin flag', error);
        });
        profile.isAdmin = true;
      }

      const incomingBalance = profile.balance ?? 0;
      const pendingBalance = pendingBalanceRef.current;
      const resolvedBalance = pendingBalance !== null && incomingBalance < pendingBalance
        ? pendingBalance
        : incomingBalance;

      if (pendingBalance !== null && incomingBalance >= pendingBalance) {
        pendingBalanceRef.current = null;
      }

      setUser((prev) => ({
        ...prev,
        ...profile,
        balance: resolvedBalance,
        topPulls: hasInventorySubcollectionRef.current ? prev.topPulls : profile.topPulls
      }));
      setBalance(resolvedBalance);
      if (!hasInventorySubcollectionRef.current && Array.isArray(data.inventory)) {
        const legacyInventory = normalizeInventoryItems(data.inventory);
        setInventory(legacyInventory);
        const nextTopPulls = rankTopPullsByValue(legacyInventory);
        setUser((prev) => ({ ...prev, topPulls: nextTopPulls }));
      }
    }, (error) => {
      console.error('Failed to load user profile from Firebase', error);
    });

    const inventoryRef = collection(db, 'users', firebaseUser.uid, 'inventory');
    inventoryUnsubscribeRef.current = onSnapshot(inventoryRef, (snapshot) => {
      hasInventorySubcollectionRef.current = snapshot.size > 0;
      const loaded = snapshot.docs
        .map(mapInventoryDoc)
        .sort((a, b) => b.obtainedAt - a.obtainedAt);
      const pendingIds = pendingSoldIdsRef.current;
      const filtered = loaded.filter((item) => !pendingIds.has(item.instanceId));
      if (pendingIds.size > 0) {
        const nextPending = new Set<string>();
        pendingIds.forEach((id) => {
          if (loaded.some((item) => item.instanceId === id)) {
            nextPending.add(id);
          }
        });
        pendingSoldIdsRef.current = nextPending;
      }
      setInventory(filtered);
      const nextTopPulls = rankTopPullsByValue(filtered);
      setUser((prev) => ({ ...prev, topPulls: nextTopPulls }));
    }, (error) => {
      console.error('Failed to load inventory from Firebase', error);
    });
  };

  const getManualEmailVerificationStatus = async (userId?: string | null) => {
    if (!userId) return false;
    try {
      const userSnapshot = await getDoc(getUserRef(userId));
      return Boolean(userSnapshot.data()?.emailManuallyVerified);
    } catch (error) {
      console.error('Failed to load manual email verification status', error);
      return false;
    }
  };

  const checkEmailVerificationStatus = async (firebaseUser?: FirebaseUser | null, manualOverride = false) => {
    if (manualOverride) {
      clearPendingEmailVerification();
      setEmailVerificationStatus('idle');
      setShowEmailVerificationModal(false);
      setShowEmailVerifiedModal(false);
      return;
    }
    if (!hasPendingEmailVerification()) {
      setEmailVerificationStatus('idle');
      setShowEmailVerificationModal(false);
      setShowEmailVerifiedModal(false);
      return;
    }

    if (!firebaseUser) {
      if (hasEmailVerificationCompleted()) {
        setEmailVerificationStatus('verified-no-session');
        setShowEmailVerificationModal(false);
        setShowEmailVerifiedModal(true);
        return;
      }

      setEmailVerificationStatus('pending');
      setShowEmailVerificationModal(false);
      setShowEmailVerifiedModal(false);
      return;
    }

    const isPasswordProvider = firebaseUser.providerData.some((provider) => provider.providerId === 'password');
    if (!isPasswordProvider) {
      clearPendingEmailVerification();
      setEmailVerificationStatus('idle');
      setShowEmailVerificationModal(false);
      setShowEmailVerifiedModal(false);
      return;
    }

    setEmailVerificationStatus('checking');
    try {
      await firebaseUser.reload();
    } catch (error) {
      console.error('Failed to reload Firebase user for verification check', error);
    }

    if (firebaseUser.emailVerified) {
      clearPendingEmailVerification();
      setEmailVerificationStatus('idle');
      setShowEmailVerificationModal(false);
      setShowEmailVerifiedModal(false);
      resolveEmailRedirect(getPendingEmailRedirect());
      if (firebaseUser) {
        startAuthenticatedSession(firebaseUser);
      }
      return;
    }

    setEmailVerificationStatus('pending');
    setShowEmailVerificationModal(true);
    setShowEmailVerifiedModal(false);
  };

  const handleEmailVerificationLink = async () => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    const mode = url.searchParams.get('mode');
    const oobCode = url.searchParams.get('oobCode');

    if (mode !== 'verifyEmail' || !oobCode) return;

    try {
      const cleanedUrl = new URL(window.location.href);
      ['mode', 'oobCode', 'apiKey', 'lang', 'continueUrl'].forEach((param) => {
        cleanedUrl.searchParams.delete(param);
      });
      if (!hasPendingEmailVerification()) {
        setPendingEmailVerification(`${cleanedUrl.pathname}${cleanedUrl.search}`);
      }
      setEmailVerificationStatus('checking');
      await applyActionCode(auth, oobCode);
      setEmailVerificationCompleted();
    } catch (error) {
      console.error('Failed to apply email verification code', error);
    } finally {
      ['mode', 'oobCode', 'apiKey', 'lang', 'continueUrl'].forEach((param) => {
        url.searchParams.delete(param);
      });
      window.history.replaceState({}, '', `${url.pathname}${url.search}`);
      const manualOverride = await getManualEmailVerificationStatus(auth.currentUser?.uid);
      await checkEmailVerificationStatus(auth.currentUser, manualOverride);
    }
  };
  
  // Initialize Items
  const [items, setItems] = useState<CaseItem[]>(() => CASE_ITEMS);

  const [bonusSettings, setBonusSettings] = useState<BonusSettings>(() => getStoredBonusSettings());

  useEffect(() => {
    const bonusSettingsRef = doc(db, 'settings', BONUS_SETTINGS_DOC);
    const unsubscribe = onSnapshot(bonusSettingsRef, (snapshot) => {
      if (!snapshot.exists()) return;
      const normalized = normalizeBonusSettings(snapshot.data() as Partial<BonusSettings>);
      setBonusSettings(normalized);
    }, (error) => {
      console.error('Failed to load bonus settings from Firebase', error);
    });

    return () => unsubscribe();
  }, []);

  const [stripeSettings, setStripeSettings] = useState<StripeSettings>(() => DEFAULT_STRIPE_SETTINGS);

  useEffect(() => {
    const stripeSettingsRef = doc(db, 'settings', STRIPE_SETTINGS_DOC);
    const unsubscribe = onSnapshot(stripeSettingsRef, (snapshot) => {
      const data = snapshot.data() ?? {};
      setStripeSettings(normalizeStripeSettings(data));
    }, (error) => {
      console.error('Failed to load stripe settings from Firebase', error);
    });

    return () => unsubscribe();
  }, []);
  
  // 2. Initialize Boxes
  const [boxes, setBoxes] = useState<MysteryBox[]>([]);
  const upsertAdminBox = (box: MysteryBox) => {
    setBoxes(prev => {
      const userCreated = prev.filter(b => b.isUserCreated);
      const adminBoxes = prev.filter(b => !b.isUserCreated);
      const filtered = adminBoxes.filter(b => b.id !== box.id);
      const nextAdminBoxes = [...filtered, { ...box, isUserCreated: box.isUserCreated ?? false }].sort((a, b) => a.price - b.price);
      return [...userCreated, ...nextAdminBoxes];
    });
  };

  const removeAdminBox = (boxId: string) => {
    setBoxes(prev => prev.filter((box) => box.id !== boxId));
  };

  const [coinPackages, setCoinPackages] = useState<CoinPackage[]>([]);

  const [battles, setBattles] = useState<Battle[]>([]);

  // -- FIREBASE SYNC --
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handlePopState = () => {
      setViewState(getViewFromLocation(window.location.pathname, window.location.search));
      scrollToTop();
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    const handleAuthChange = async (firebaseUser: FirebaseUser | null) => {
      setAuthInitialized(true);
      const isPasswordProvider = firebaseUser?.providerData.some((provider) => provider.providerId === 'password') ?? false;
      const manualOverride =
        firebaseUser && isPasswordProvider && !firebaseUser.emailVerified
          ? await getManualEmailVerificationStatus(firebaseUser.uid)
          : false;
      const requiresVerification = Boolean(firebaseUser && isPasswordProvider && !firebaseUser.emailVerified && !manualOverride);
      if (requiresVerification && !hasPendingEmailVerification()) {
        setPendingEmailVerification(getCurrentPath());
      }

      await checkEmailVerificationStatus(firebaseUser, manualOverride);
      clearUserSubscriptions();

      if (!firebaseUser) {
        setIsAuthenticated(false);
        setUser(GUEST_USER);
        setBalance(0);
        setInventory([]);
        setNotifications([]);
        hasInventorySubcollectionRef.current = false;
        activeUserIdRef.current = null;
        return;
      }

      if (requiresVerification) {
        setIsAuthenticated(false);
        setUser(GUEST_USER);
        setBalance(0);
        setInventory([]);
        setNotifications([]);
        hasInventorySubcollectionRef.current = false;
        activeUserIdRef.current = null;
        return;
      }

      startAuthenticatedSession(firebaseUser);
    };

    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      void handleAuthChange(firebaseUser);
    });

    return () => {
      unsubscribe();
      clearUserSubscriptions();
      activeUserIdRef.current = null;
    };
  }, []);

  useEffect(() => {
    const runCheck = async () => {
      const manualOverride = await getManualEmailVerificationStatus(auth.currentUser?.uid);
      await checkEmailVerificationStatus(auth.currentUser, manualOverride);
    };
    void runCheck();
  }, []);

  useEffect(() => {
    void handleEmailVerificationLink();
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      setUsers([]);
      return;
    }

    if (!user.isAdmin) {
      setUsers([user]);
      return;
    }

    const usersRef = collection(db, 'users');
    const unsubscribe = onSnapshot(usersRef, (snapshot) => {
      const loaded = snapshot.docs.map((docSnap) => buildUserProfileFromDoc(docSnap.id, docSnap.data()));
      setUsers(loaded.length ? loaded : [user]);
    }, (error) => {
      console.error('Failed to load users from Firebase', error);
      setUsers([user]);
    });

    return () => unsubscribe();
  }, [isAuthenticated, user.id, user.isAdmin]);

  useEffect(() => {
    if (!isAuthenticated || !user.isAdmin) {
      setShipments([]);
      return;
    }

    const shipmentsRef = collection(db, 'shipments');
    const unsubscribe = onSnapshot(shipmentsRef, (snapshot) => {
      const loaded = snapshot.docs
        .map(mapShipmentDoc)
        .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
      setShipments(loaded);
    }, (error) => {
      console.error('Failed to load shipments from Firebase', error);
      setShipments([]);
    });

    return () => unsubscribe();
  }, [isAuthenticated, user.isAdmin]);

  useEffect(() => {
    if (!isAuthenticated) return;

    const latestUser = users.find((entry) => entry.id === user.id);
    if (!latestUser) return;

    const needsCreatedAtUpdate = !user.createdAt && !!latestUser.createdAt;
    const needsLastChatUpdate = latestUser.lastChatAt !== undefined && latestUser.lastChatAt !== user.lastChatAt;
    const nextTopPullsPublic = latestUser.topPullsPublic ?? false;
    const needsTopPullsPublicUpdate = nextTopPullsPublic !== (user.topPullsPublic ?? false);
    if (!needsCreatedAtUpdate && !needsLastChatUpdate && !needsTopPullsPublicUpdate) return;

    const updates: Partial<User> = {};
    if (needsCreatedAtUpdate) updates.createdAt = latestUser.createdAt;
    if (needsLastChatUpdate) updates.lastChatAt = latestUser.lastChatAt;
    if (needsTopPullsPublicUpdate) updates.topPullsPublic = nextTopPullsPublic;

    setUser((prev) => ({ ...prev, ...updates }));
  }, [users, isAuthenticated, user.id, user.createdAt, user.lastChatAt, user.topPullsPublic]);

  useEffect(() => {
    const itemsRef = collection(db, 'items');
    const unsubscribe = onSnapshot(itemsRef, (snapshot) => {
      const loaded: CaseItem[] = snapshot.docs
        .map((docSnap, index) => {
          const data = docSnap.data();
          const rarity = (data.rarity ?? 'common') as CaseItem['rarity'];

          return {
            id: docSnap.id || `item-${index}`,
            name: data.name ?? 'Mystery Item',
            price: Number(data.price ?? 0),
            image: data.image ?? 'https://picsum.photos/200',
            rarity,
            chance: Number(data.chance ?? 0),
            color: data.color ?? '#9ca3af',
            brand: typeof data.brand === 'string' ? data.brand : '',
            category: typeof data.category === 'string' ? data.category : '',
            tags: Array.isArray(data.tags) ? (data.tags as CaseItem['tags']) : [],
            sizes: Array.isArray(data.sizes) ? data.sizes.filter((size: unknown) => typeof size === 'string') : [],
            redeemable: data.redeemable ?? true
          } as CaseItem;
        })
        .sort((a, b) => a.price - b.price);

      const fallbackItems = CASE_ITEMS.map((item) => ({
        ...item,
        brand: item.brand ?? '',
        category: item.category ?? '',
        tags: Array.isArray(item.tags) ? item.tags : []
      }));
      setItems(loaded.length ? loaded : fallbackItems);
    }, (error) => {
      console.error('Failed to load items from Firebase', error);
    });

    return () => unsubscribe();
  }, []);

  const expiredUserBoxDeletesRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const boxesRef = collection(db, 'boxes');
    const unsubscribe = onSnapshot(boxesRef, (snapshot) => {
      const expiredUserBoxIds: string[] = [];
      const firebaseBoxes = snapshot.docs
        .map((docSnap) => {
          const data = docSnap.data();
          const prizeSource = Array.isArray(data.items) ? data.items : data.prizes;
          const items = Array.isArray(prizeSource) ? prizeSource.map((item: any, index: number) => {
            const rarity = (item.rarity ?? 'common') as CaseItem['rarity'];
            const price = Number(item.value ?? item.price ?? 0);
            return {
              id: item.id ?? `${docSnap.id}-item-${index}`,
              name: item.name ?? 'Mystery Item',
              price,
              image: item.image ?? 'https://picsum.photos/300',
              rarity,
              chance: Number(item.weight ?? item.chance ?? 0),
              color: item.color ?? RARITY_COLORS[rarity] ?? '#9ca3af',
              brand: typeof item.brand === 'string' ? item.brand : '',
              category: typeof item.category === 'string' ? item.category : '',
              tags: Array.isArray(item.tags) ? (item.tags as CaseItem['tags']) : [],
              sizes: Array.isArray(item.sizes) ? item.sizes.filter((size: unknown) => typeof size === 'string') : [],
              redeemable: item.redeemable ?? true
            };
          }) : [];
          const createdAt = data.createdAt ? normalizeTimestamp(data.createdAt, Date.now()) : undefined;
          if (
            data.isUserCreated &&
            createdAt &&
            Date.now() - createdAt >= USER_BOX_EXPIRY_MS
          ) {
            expiredUserBoxIds.push(docSnap.id);
          }

          return {
            id: docSnap.id,
            name: data.name ?? 'Mystery Box',
            price: Number(data.price ?? 0),
            image: data.image ?? 'https://picsum.photos/300',
            accentColor: data.accentColor ?? '#3b82f6',
            tag: data.tag as MysteryBox['tag'],
            tags: Array.isArray(data.tags) ? (data.tags as MysteryBox['tags']) : undefined,
            isDaily: data.isDaily ?? false,
            targetEV: data.targetEV !== undefined ? Number(data.targetEV) : undefined,
            riskLevel: data.riskLevel !== undefined ? Number(data.riskLevel) : undefined,
            items,
            isUserCreated: data.isUserCreated ?? false,
            sellBackRate: data.sellBackRate !== undefined ? Number(data.sellBackRate) : undefined,
            createdAt
          } as MysteryBox;
        })
        .filter((box) => !box.isUserCreated || (box.createdAt && Date.now() - box.createdAt < USER_BOX_EXPIRY_MS))
        .sort((a, b) => a.price - b.price);

      if (isAuthenticated && user.isAdmin && expiredUserBoxIds.length > 0) {
        expiredUserBoxIds.forEach((boxId) => {
          if (expiredUserBoxDeletesRef.current.has(boxId)) return;
          expiredUserBoxDeletesRef.current.add(boxId);
          void deleteBox(boxId);
        });
      }

      setBoxes(prev => {
        const pendingUserCreated = prev.filter(
          (box) =>
            box.isUserCreated &&
            !firebaseBoxes.some((firebaseBox) => firebaseBox.id === box.id) &&
            !!box.createdAt &&
            Date.now() - box.createdAt < USER_BOX_EXPIRY_MS
        );
        return [...pendingUserCreated, ...firebaseBoxes].sort((a, b) => a.price - b.price);
      });
    }, (error) => {
      console.error('Failed to load boxes from Firebase', error);
    });

    return () => unsubscribe();
  }, [isAuthenticated, user.isAdmin]);

  useEffect(() => {
    const interval = setInterval(() => {
      setBoxes((prev) => {
        const now = Date.now();
        const next = prev.filter(
          (box) =>
            !box.isUserCreated ||
            (box.createdAt !== undefined && now - box.createdAt < USER_BOX_EXPIRY_MS)
        );
        return next.length === prev.length ? prev : next;
      });
    }, 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const packagesRef = query(collection(db, 'coin_packages'), orderBy('sortOrder', 'asc'));
    const unsubscribe = onSnapshot(packagesRef, (snapshot) => {
      const loaded = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        const coins = Number(data.coins ?? 0);
        const bonusCoins = Number(data.bonusCoins ?? 0);
        return {
          id: docSnap.id,
          name: data.name ?? 'Coin Package',
          coins,
          bonusCoins,
          totalCoins: coins + bonusCoins,
          displayPrice: data.displayPrice ?? '',
          stripePriceId: data.stripePriceId ?? '',
          badge: data.badge ?? undefined,
          active: data.active ?? false,
          sortOrder: Number(data.sortOrder ?? 0),
          createdAt: normalizeTimestamp(data.createdAt, 0),
          updatedAt: normalizeTimestamp(data.updatedAt, 0)
        } as CoinPackage;
      });
      setCoinPackages(loaded);
    }, (error) => {
      console.error('Failed to load coin packages from Firebase', error);
    });

    return () => unsubscribe();
  }, []);


  // Battles Realtime Sync
  useEffect(() => {
    const battlesRef = collection(db, 'battles');
    const unsubscribe = onSnapshot(battlesRef, (snapshot) => {
      const firebaseBattles = snapshot.docs
        .map((docSnap) => {
          const data = docSnap.data();
          const createdAt = data.createdAt?.toMillis
            ? data.createdAt.toMillis()
            : Number(data.createdAt ?? Date.now());

          const players = Array.isArray(data.players)
            ? data.players.map((p: any) => ({
                ...p,
                totalWin: Number(p.totalWin ?? 0)
              }))
            : [];

          const history = Array.isArray(data.history)
            ? data.history.map((round: any) => ({
                roundNumber: Number(round.roundNumber ?? 0),
                drops: Array.isArray(round.drops)
                  ? round.drops.map((drop: any) => ({
                      playerId: drop.playerId ?? '',
                      item: drop.item
                    }))
                  : []
              }))
            : [];

          return {
            id: docSnap.id,
            mode: data.mode ?? 'Normal',
            players,
            playerCount: Number(data.playerCount ?? players.length),
            maxPlayers: Number(data.maxPlayers ?? 2),
            cost: Number(data.cost ?? 0),
            cases: Array.isArray(data.cases) ? data.cases : [],
            rounds: Number(data.rounds ?? (Array.isArray(data.cases) ? data.cases.length : 0)),
            currentRound: Number(data.currentRound ?? 0),
            status: data.status ?? 'waiting',
            history,
            createdAt,
            rewardsDistributed: data.rewardsDistributed ?? false,
            botsAdded: data.botsAdded ?? false
          } as Battle;
        })
        .sort((a, b) => b.createdAt - a.createdAt);

      setBattles(firebaseBattles);
    }, (error) => {
      console.error('Failed to load battles from Firebase', error);
    });

    return () => unsubscribe();
  }, []);

  // Auto-fill with bots if countdown expires without enough real players
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      battles
        .filter(b => b.status === 'waiting' && !b.botsAdded && now - b.createdAt >= 60000)
        .forEach(battle => {
          const battleRef = doc(db, 'battles', battle.id);
          runTransaction(db, async (transaction) => {
            const snap = await transaction.get(battleRef);
            if (!snap.exists()) return;
            const data = snap.data() as Battle;
            if (data.status !== 'waiting') return;

            const players = Array.isArray(data.players) ? data.players : [];
            const playerCount = Number(data.playerCount ?? players.length ?? 0);
            const maxPlayers = Number(data.maxPlayers ?? 2);
            const remaining = maxPlayers - playerCount;

            if (remaining <= 0) {
              transaction.set(battleRef, { ...data, status: 'active' as Battle['status'] }, { merge: true });
              return;
            }

            const bots = Array.from({ length: remaining }).map(() => {
              const botId = Math.floor(Math.random() * 10000);
              return {
                id: `bot-${data.id}-${botId}`,
                name: `BotUser${botId}`,
                avatar: `https://picsum.photos/seed/${botId}/100/100`,
                level: Math.floor(Math.random() * 50) + 1,
                xp: Math.floor(Math.random() * 5000),
                totalWin: 0,
                isBot: true
              };
            });

            transaction.set(battleRef, sanitizeDeep({
              ...data,
              players: [...players, ...bots],
              playerCount: maxPlayers,
              status: 'active' as Battle['status'],
              botsAdded: true
            }));
          }).catch((error) => console.error('Failed to auto-fill bots for battle', battle.id, error));
        });
    }, 1000);

    return () => clearInterval(interval);
  }, [battles]);

  // --- ACTIONS ---

  const updateBonusSettings = (settings: BonusSettings) => {
    const normalized = normalizeBonusSettings(settings);

    setBonusSettings(normalized);
    const bonusSettingsRef = doc(db, 'settings', BONUS_SETTINGS_DOC);
    void setDoc(bonusSettingsRef, normalized, { merge: true }).catch((error) => {
      console.error('Failed to save bonus settings to Firebase', error);
    });
  };

  const updateStripeSettings = (settings: StripeSettings) => {
    const normalized = normalizeStripeSettings(settings);
    setStripeSettings(normalized);
    const stripeSettingsRef = doc(db, 'settings', STRIPE_SETTINGS_DOC);
    void setDoc(stripeSettingsRef, normalized, { merge: true }).catch((error) => {
      console.error('Failed to save stripe settings to Firebase', error);
    });
  };

  const ensureGoogleUserProfile = async (firebaseUser: FirebaseUser) => {
    const userRef = getUserRef(firebaseUser.uid);
    const userSnapshot = await getDoc(userRef);
    const email = firebaseUser.email ?? '';
    const displayName = firebaseUser.displayName ?? '';
    const photoURL = firebaseUser.photoURL ?? undefined;

    if (!userSnapshot.exists()) {
      const baseUsername = buildBaseUsername(displayName, email);
      const username = await ensureUniqueUsername(baseUsername);
      const createdAt = Date.now();
      const avatarName = displayName || username;
      const avatar = photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(avatarName)}&background=111827&color=10b981`;
      const newUser: User = {
        id: firebaseUser.uid,
        createdAt,
        name: username,
        username,
        displayName: displayName || undefined,
        email,
        avatar,
        photoURL,
        provider: 'google',
        level: 1,
        xp: 0,
        lastDailyClaim: undefined,
        totalSpent: 0,
        rakebackBalance: 0,
        rakebackEarnedToday: 0,
        rakebackEarnedAt: getDayStart(),
        followers: [],
        shippingAddress: undefined,
        isAdmin: email.toLowerCase() === ADMIN_EMAIL,
        chatWarnings: 0,
        chatDisabled: false,
        emailManuallyVerified: false,
        termsFlagged: false
      };

      await setDoc(userRef, { ...buildUserDocument(newUser), coins: SIGNUP_CREDIT_COINS });
      return;
    }

    const data = userSnapshot.data() as Record<string, any>;
    const updates: Record<string, unknown> = {};

    if (!data.email && email) updates.email = email;
    if (!data.displayName && displayName) updates.displayName = displayName;
    if (!data.photoURL && photoURL) updates.photoURL = photoURL;
    if (!data.avatar && photoURL) updates.avatar = photoURL;
    if (!data.provider) updates.provider = 'google';

    if (Object.keys(updates).length > 0) {
      await setDoc(userRef, updates, { merge: true });
    }
  };

  const resendEmailVerification = async () => {
    if (!auth.currentUser) {
      throw new Error('Please sign in to resend the verification email.');
    }
    await sendEmailVerification(auth.currentUser, {
      url: window.location.origin,
      handleCodeInApp: true
    });
  };

  const refreshEmailVerification = async () => {
    const manualOverride = await getManualEmailVerificationStatus(auth.currentUser?.uid);
    await checkEmailVerificationStatus(auth.currentUser, manualOverride);
  };

  const login = async (email: string, pass: string, remember: boolean = true) => {
      await setAuthPersistence(remember);
      const credential = await signInWithEmailAndPassword(auth, email, pass);
      if (!credential.user.emailVerified) {
        const manualOverride = await getManualEmailVerificationStatus(credential.user.uid);
        if (manualOverride) {
          clearPendingEmailVerification();
          setEmailVerificationStatus('idle');
          setShowEmailVerificationModal(false);
          setShowLoginModal(false);
          return;
        }
        const redirectPath = getCurrentPath();
        setPendingEmailVerification(redirectPath);
        await sendEmailVerification(credential.user, {
          url: window.location.origin,
          handleCodeInApp: true
        });
        setEmailVerificationStatus('pending');
        setShowEmailVerificationModal(true);
        setShowLoginModal(false);
        return;
      }
      setShowLoginModal(false);
  };

  const loginWithGoogle = async (remember: boolean = true): Promise<GoogleAuthResult> => {
    const provider = new GoogleAuthProvider();

    try {
      await setAuthPersistence(remember);
      const credential = await signInWithPopup(auth, provider);
      await ensureGoogleUserProfile(credential.user);
      setShowLoginModal(false);
      return { status: 'success' };
    } catch (error: any) {
      const errorCode = error?.code;
      if (errorCode === 'auth/account-exists-with-different-credential') {
        const pendingCredential = GoogleAuthProvider.credentialFromError(error);
        const email = error?.customData?.email ?? error?.email;

        if (pendingCredential && email) {
          const methods = await fetchSignInMethodsForEmail(auth, email);
          if (methods.includes('password')) {
            // Account linking: prompt for password before linking Google.
            return { status: 'link-required', email, credential: pendingCredential };
          }
        }

        return {
          status: 'error',
          message: 'That email already has an account. Please sign in using the original provider to link Google.'
        };
      }

      return { status: 'error', message: error?.message || 'Google sign-in failed.' };
    }
  };

  const linkGoogleAccount = async (
    email: string,
    password: string,
    credential: AuthCredential
  ): Promise<GoogleAuthResult> => {
    try {
      const emailCredential = EmailAuthProvider.credential(email, password);
      const signInResult = await signInWithCredential(auth, emailCredential);
      // Account linking happens here after password authentication succeeds.
      await linkWithCredential(signInResult.user, credential);
      await ensureGoogleUserProfile(signInResult.user);
      setShowLoginModal(false);
      return { status: 'success' };
    } catch (error: any) {
      return { status: 'error', message: error?.message || 'Unable to link Google account.' };
    }
  };

  const register = async (name: string, email: string, pass: string) => {
    try {
      const credential = await createUserWithEmailAndPassword(auth, email, pass);
      const redirectPath = getCurrentPath();
      setPendingEmailVerification(redirectPath);
      await sendEmailVerification(credential.user, {
        url: window.location.origin,
        handleCodeInApp: true
      });
      const createdAt = Date.now();
      const newUser: User = {
        id: credential.user.uid,
        createdAt,
        name,
        username: name,
        displayName: name,
        email,
        avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=111827&color=10b981`,
        provider: 'password',
        level: 1,
        xp: 0,
        balance: SIGNUP_CREDIT_COINS,
        lastDailyClaim: undefined,
        totalSpent: 0,
        rakebackBalance: 0,
        rakebackEarnedToday: 0,
        rakebackEarnedAt: getDayStart(),
        followers: [],
        shippingAddress: undefined,
        isAdmin: email.toLowerCase() === ADMIN_EMAIL,
        chatWarnings: 0,
        chatDisabled: false,
        emailManuallyVerified: false,
        termsFlagged: false
      };

      await setDoc(doc(db, 'users', newUser.id), { ...buildUserDocument(newUser), coins: SIGNUP_CREDIT_COINS });
      setShowLoginModal(false);
      setEmailVerificationStatus('pending');
      setShowEmailVerificationModal(true);
    } catch (error: any) {
      if (error?.code === 'auth/email-already-in-use') {
        try {
          const signInCredential = await signInWithEmailAndPassword(auth, email, pass);
          if (!signInCredential.user.emailVerified) {
            const redirectPath = getCurrentPath();
            setPendingEmailVerification(redirectPath);
            await sendEmailVerification(signInCredential.user, {
              url: window.location.origin,
              handleCodeInApp: true
            });
            setEmailVerificationStatus('pending');
            setShowEmailVerificationModal(true);
            setShowLoginModal(false);
            return;
          }
          throw new Error('That email is already registered. Please sign in.');
        } catch (signInError: any) {
          const signInCode = signInError?.code;
          if (signInCode === 'auth/wrong-password' || signInCode === 'auth/invalid-credential') {
            throw new Error('That email is already registered. Please sign in or reset your password.');
          }
          throw signInError;
        }
      }
      throw error;
    }
  };

  const resetPassword = async (email: string) => {
      const actionCodeSettings = {
          url: window.location.origin,
          handleCodeInApp: true
      };
      await sendPasswordResetEmail(auth, email, actionCodeSettings);
  };

  const logout = () => {
      signOut(auth);
      setIsAuthenticated(false);
      setUser(GUEST_USER);
      setBalance(0);
      setInventory([]);
      setNotifications([]);
      setView({ type: 'HOME' });
  };

  const registerSpend = (amount: number) => {
    if (!isAuthenticated || amount <= 0) return;

    setUser(prev => {
      const xpGain = Math.max(0, Math.floor((amount / 100) * bonusSettings.xpPer100Coins));
      const nextXp = Math.max(0, prev.xp + xpGain);
      const progress = calculateLevelProgress(nextXp, bonusSettings);
      const totalSpent = Math.max(0, (prev.totalSpent ?? 0) + amount);
      const rakebackRate = Math.max(0, bonusSettings.rakebackBasePercent) / 100;
      const today = getDayStart();
      const earnedAt = Number(prev.rakebackEarnedAt ?? 0);
      const earnedToday = earnedAt === today ? Number(prev.rakebackEarnedToday ?? 0) : 0;
      const capAmount = bonusSettings.rakebackDailyCapCoins;
      const remainingCap = capAmount > 0 ? Math.max(0, capAmount - earnedToday) : Number.POSITIVE_INFINITY;
      const rakebackEarned = Math.min(remainingCap, amount * rakebackRate);
      const rakebackBalance = Math.max(0, (prev.rakebackBalance ?? 0) + rakebackEarned);
      const nextEarnedToday = earnedToday + rakebackEarned;

      persistUserData({
        xp: nextXp,
        level: progress.level,
        totalSpent,
        rakebackBalance,
        rakebackEarnedToday: nextEarnedToday,
        rakebackEarnedAt: today
      });

      return {
        ...prev,
        xp: nextXp,
        level: progress.level,
        totalSpent,
        rakebackBalance,
        rakebackEarnedToday: nextEarnedToday,
        rakebackEarnedAt: today
      };
    });
  };

  const addBalance = async (amount: number) => {
    setBalance(prev => {
      const updated = prev + amount;
      setUser(current => ({ ...current, balance: updated }));
      return updated;
    }); 
  };

  // Server-authoritative balance updates (no client-side persistence).
  const syncBalance = (amount: number) => {
    setBalance(amount);
    setUser(prev => ({ ...prev, balance: amount }));
  };

  const deductBalance = (amount: number, options?: { trackRewards?: boolean }): boolean => {
    if (balance >= amount) {
      setBalance(prev => {
        const updated = prev - amount;
        setUser(current => ({ ...current, balance: updated }));
        return updated;
      });
      if (options?.trackRewards !== false) {
        registerSpend(amount);
      }
      return true;
    }
    return false;
  };

  const addToInventory = (item: CaseItem, provenance?: InventoryProvenance): InventoryItem => {
    const newItem: InventoryItem = {
      ...item,
      instanceId: Math.random().toString(36).substr(2, 9),
      obtainedAt: Date.now(),
      status: 'available',
      provenance
    };
    setInventory(prev => {
      const nextInventory = [newItem, ...prev];
      const nextTopPulls = rankTopPullsByValue(nextInventory);

      setUser(current => ({ ...current, topPulls: nextTopPulls }));
      setUsers(current => current.map(u => u.id === auth.currentUser?.uid ? { ...u, topPulls: nextTopPulls } : u));

      return nextInventory;
    });
    return newItem;
  };

  // Inventory updates from serverless APIs (avoid client-side writes).
  const addInventoryItemFromServer = (item: InventoryItem) => {
    setInventory(prev => {
      const nextInventory = [item, ...prev];
      const nextTopPulls = rankTopPullsByValue(nextInventory);

      setUser(current => ({ ...current, topPulls: nextTopPulls }));
      setUsers(current => current.map(u => u.id === auth.currentUser?.uid ? { ...u, topPulls: nextTopPulls } : u));

      return nextInventory;
    });
  };

  const addNotification = (
    notification: Omit<AppNotification, 'id' | 'createdAt'> & Partial<Pick<AppNotification, 'id' | 'createdAt'>>
  ) => {
    setNotifications((prev) => {
      const next: AppNotification = {
        id: notification.id ?? `notif-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        createdAt: notification.createdAt ?? Date.now(),
        message: notification.message,
        type: notification.type
      };
      return [next, ...prev].slice(0, 50);
    });
  };

  const dismissNotification = (id: string) => {
    setNotifications((prev) => prev.filter((notification) => notification.id !== id));
  };

  const clearNotifications = () => {
    setNotifications([]);
  };

  const sendAdminNotification = (message: string) => {
    if (!message.trim()) return;
    addNotification({ message: message.trim(), type: 'admin' });
  };

  const followUser = async (targetUserId: string) => {
    if (!isAuthenticated) {
      openAuthModal('login');
      return;
    }

    if (targetUserId === user.id) return;

    const targetUser = users.find((u) => u.id === targetUserId);
    if (!targetUser) {
      console.warn('Attempted to follow unknown user');
      return;
    }

    const targetFollowers = Array.isArray(targetUser.followers)
      ? targetUser.followers
      : Array.isArray(targetUser.friends)
        ? targetUser.friends
        : [];
    if (targetFollowers.includes(user.id)) return;

    const updatedTarget = [...targetFollowers, user.id];

    try {
      await setDoc(getUserRef(targetUserId), { followers: updatedTarget }, { merge: true });
    } catch (error) {
      console.error('Failed to update followers in Firebase', error);
    }

    setUsers((prev) =>
      prev.map((u) => {
        if (u.id === targetUserId) return { ...u, followers: updatedTarget };
        return u;
      })
    );
  };

  const unfollowUser = async (targetUserId: string) => {
    if (!isAuthenticated) {
      openAuthModal('login');
      return;
    }

    if (targetUserId === user.id) return;

    const targetUser = users.find((u) => u.id === targetUserId);
    if (!targetUser) {
      console.warn('Attempted to unfollow unknown user');
      return;
    }

    const targetFollowers = Array.isArray(targetUser.followers)
      ? targetUser.followers
      : Array.isArray(targetUser.friends)
        ? targetUser.friends
        : [];
    if (!targetFollowers.includes(user.id)) return;

    const updatedTarget = targetFollowers.filter((id) => id !== user.id);

    try {
      await setDoc(getUserRef(targetUserId), { followers: updatedTarget }, { merge: true });
    } catch (error) {
      console.error('Failed to update followers in Firebase', error);
    }

    setUsers((prev) =>
      prev.map((u) => {
        if (u.id === targetUserId) return { ...u, followers: updatedTarget };
        return u;
      })
    );
  };

  const sellItem = async (instanceId: string) => {
    if (!auth.currentUser) {
      openAuthModal('login');
      return;
    }

    const itemIndex = inventory.findIndex((item) => item.instanceId === instanceId);
    const itemToSell = itemIndex >= 0 ? inventory[itemIndex] : undefined;
    if (itemToSell?.redeemable === false) {
      alert('This item is not redeemable and cannot be sold back.');
      return;
    }
    try {
      pendingSoldIdsRef.current.add(instanceId);
      setInventory(prev => prev.filter(item => item.instanceId !== instanceId));

      const data = await authedFetch<{ newCoins?: number }>('/api/sell-item', {
        method: 'POST',
        body: JSON.stringify({ inventoryId: instanceId })
      });

      const nextCoins = Number(data.newCoins);
      if (Number.isFinite(nextCoins)) {
        pendingBalanceRef.current = nextCoins;
        syncBalance(nextCoins);
      }
    } catch (error) {
      pendingSoldIdsRef.current.delete(instanceId);
      if (itemToSell) {
        setInventory((prev) => {
          const next = [...prev];
          const insertAt = Math.min(Math.max(itemIndex, 0), next.length);
          next.splice(insertAt, 0, itemToSell);
          return next;
        });
      }
      console.error('Failed to sell item', error);
      alert('Unable to sell item right now. Please try again.');
    }
  };

  const shipItem = async (instanceId: string) => {
    if (!auth.currentUser) {
      openAuthModal('login');
      return;
    }

    const itemToShip = inventory.find(item => item.instanceId === instanceId);
    if (!itemToShip || !user.shippingAddress) {
      alert('Please add a shipping address before requesting shipment.');
      return;
    }

    try {
      const data = await authedFetch<{ newCoins?: number }>('/api/request-shipment', {
        method: 'POST',
        body: JSON.stringify({
          inventoryId: instanceId,
          shippingInfo: user.shippingAddress
        })
      });

      const nextCoins = Number(data?.newCoins);
      if (Number.isFinite(nextCoins)) {
        syncBalance(nextCoins);
      }

      setInventory(prev =>
        prev.map(item =>
          item.instanceId === instanceId
            ? { ...item, status: 'shipping_requested' }
            : item
        )
      );

      addNotification({
        message: `${itemToShip.name} is now shipping to your saved address.`,
        type: 'shipping'
      });
    } catch (error) {
      console.error('Failed to request shipment', error);
      alert('Unable to request shipment right now. Please try again.');
    }
  };

  const updateAddress = async (address: ShippingAddress) => {
      setUser(prev => {
        const updated = { ...prev, shippingAddress: address };
        persistUserData({ shippingAddress: address });
        return updated;
      });
  };

  const updateUserInfo = async (name: string, avatar: string) => {
      const updates = { name, avatar };
      setUser(prev => ({ ...prev, ...updates }));
      setUsers(prev => prev.map(u => u.id === auth.currentUser?.uid ? { ...u, ...updates } : u));

      try {
        await persistUserData(updates);
      } catch (error) {
        console.error('Failed to persist profile changes', error);
      }
  };

  const updateUserFlags = async (updates: Partial<User>) => {
      if (!isAuthenticated || !auth.currentUser) return;
      const sanitizedUpdates = sanitizeData(updates);

      try {
          await setDoc(getUserRef(auth.currentUser.uid), sanitizedUpdates, { merge: true });
      } catch (error) {
          console.error('Failed to update user flags in Firebase', error);
      }

      setUser(prev => ({ ...prev, ...updates }));
      setUsers(prev => prev.map(u => u.id === auth.currentUser?.uid ? { ...u, ...updates } : u));
  };

  const updateUserAdminData = async (userId: string, updates: Partial<User>) => {
      if (!isAuthenticated || !auth.currentUser) return;
      const sanitizedUpdates = sanitizeDeep(updates);
      delete sanitizedUpdates.balance;
      delete sanitizedUpdates.coins;

      try {
        await setDoc(getUserRef(userId), sanitizedUpdates, { merge: true });
      } catch (error) {
        console.error('Failed to update user admin data in Firebase', error);
      }

      setUsers(prev => prev.map(u => u.id === userId ? { ...u, ...updates } : u));
      setUser(prev => prev.id === userId ? { ...prev, ...updates } : prev);
  };

  const updateUserBalance = async (userId: string, nextBalance: number) => {
      if (!isAuthenticated || !auth.currentUser) return;
      const balanceValue = Number.isFinite(nextBalance) ? Math.max(0, nextBalance) : 0;
      try {
        await setDoc(getUserRef(userId), { coins: balanceValue }, { merge: true });
      } catch (error) {
        console.error('Failed to update user balance in Firebase', error);
      }

      setUsers(prev => prev.map(u => u.id === userId ? { ...u, balance: balanceValue } : u));
      setUser(prev => prev.id === userId ? { ...prev, balance: balanceValue } : prev);
      if (auth.currentUser.uid === userId) {
        setBalance(balanceValue);
      }
  };

  const createBattle = async (boxIds: string[], maxPlayers: number) => {
    if (!isAuthenticated) {
        openAuthModal('login');
        return;
    }

    const selectedCases = boxIds.map(id => boxes.find(b => b.id === id)).filter(b => b !== undefined) as MysteryBox[];
    const cost = selectedCases.reduce((sum, b) => sum + b.price, 0);
    const costCoins = toCoins(cost, PRICE_UNIT_MODE);

    if (selectedCases.length === 0) {
        alert("Please select at least one box");
        return;
    }

    if (!deductBalance(costCoins)) {
      alert("Insufficient funds to create battle!");
      return;
    }
    
    const battleRef = doc(collection(db, 'battles'));
    const newBattle: Battle = {
      id: battleRef.id,
      mode: 'Normal',
      players: [{ ...user, totalWin: 0 }],
      playerCount: 1,
      maxPlayers,
      cost,
      cases: selectedCases,
      rounds: selectedCases.length,
      currentRound: 0,
      status: 'waiting',
      history: [],
      createdAt: Date.now(),
      rewardsDistributed: false,
      botsAdded: false
    };
    
    setBattles(prev => [newBattle, ...prev.filter(b => b.id !== newBattle.id)]);
    try {
      await setDoc(battleRef, sanitizeDeep(newBattle));
    } catch (error) {
      console.error('Failed to create battle in Firebase', error);
    }
    setView({ type: 'BATTLE_ARENA', battleId: newBattle.id });
  };

  const joinBattle = async (battleId: string) => {
    if (!isAuthenticated) {
        openAuthModal('login');
        return;
    }
    const battle = battles.find(b => b.id === battleId);
    if (!battle) return;
    if (battle.players.some(p => p.id === user.id)) {
      setView({ type: 'BATTLE_ARENA', battleId });
      return;
    }
    if (battle.playerCount >= battle.maxPlayers) {
      alert("Battle is full!");
      return;
    }
    if (!deductBalance(toCoins(battle.cost, PRICE_UNIT_MODE), { trackRewards: false })) {
      alert("Insufficient funds to join battle!");
      return;
    }
    const battleRef = doc(db, 'battles', battleId);
    try {
      await runTransaction(db, async (transaction) => {
        const battleSnap = await transaction.get(battleRef);
        if (!battleSnap.exists()) {
          throw new Error('Battle not found');
        }
        const data = battleSnap.data() as Battle;

        if (data.players.some(p => p.id === user.id)) {
          throw new Error('already-joined');
        }

        if (data.playerCount >= data.maxPlayers) {
          throw new Error('full');
        }

        const updatedPlayers = [...data.players, { ...user, totalWin: 0 }];
        const newCount = updatedPlayers.length;

        transaction.set(battleRef, sanitizeDeep({
          ...data,
          players: updatedPlayers,
          playerCount: newCount,
          status: (newCount === data.maxPlayers ? 'active' : 'waiting') as Battle['status']
        }));
      });
    } catch (error: any) {
      console.error('Failed to join battle', error);
      addBalance(toCoins(battle.cost, PRICE_UNIT_MODE));
      if (error?.message === 'full') {
        alert("Battle is full!");
      }
      return;
    }
    registerSpend(toCoins(battle.cost, PRICE_UNIT_MODE));
    setView({ type: 'BATTLE_ARENA', battleId });
  };

  const updateBattle = (updatedBattle: Battle) => {
    const battleRef = doc(db, 'battles', updatedBattle.id);
    setDoc(battleRef, sanitizeDeep(updatedBattle)).catch((error) => {
      console.error('Failed to update battle in Firebase', error);
    });
    setBattles(prev => prev.map(b => b.id === updatedBattle.id ? updatedBattle : b));
  };

  const createItem = async (item: CaseItem) => {
      const { id, ...itemDataRaw } = item;
      const itemData = sanitizeData(itemDataRaw);
      let itemId = id;

      try {
          if (id) {
              await setDoc(doc(db, 'items', id), itemData, { merge: true });
              itemId = id;
          } else {
              const docRef = await addDoc(collection(db, 'items'), itemData);
              itemId = docRef.id;
          }
      } catch (error) {
          console.error('Failed to save item to Firebase', error);
          itemId = itemId || `local-item-${Date.now()}`;
      }

      setItems(prev => {
          const filtered = prev.filter(existing => existing.id !== itemId);
          return [...filtered, { ...itemData, id: itemId }];
      });
  };

  const updateItem = async (updatedItem: CaseItem) => {
      const { id, ...itemDataRaw } = updatedItem;
      if (!id) {
          console.warn('Attempted to update an item without an id');
          return;
      }

      const itemData = sanitizeData(itemDataRaw);

      try {
          await setDoc(doc(db, 'items', id), itemData, { merge: true });
      } catch (error) {
          console.error('Failed to update item in Firebase', error);
      }

      setItems(prev => prev.map(i => i.id === id ? { ...itemData, id } : i));

      const boxesToUpdate = boxes
        .filter((box) => box.items.some((item) => item.id === id))
        .map((box) => ({
          ...box,
          items: box.items.map((boxItem) =>
            boxItem.id === id
              ? { ...itemData, id, chance: boxItem.chance }
              : boxItem
          )
        }));

      if (boxesToUpdate.length === 0) {
        return;
      }

      setBoxes((prev) =>
        prev.map((box) => boxesToUpdate.find((updated) => updated.id === box.id) ?? box)
      );

      await Promise.all(
        boxesToUpdate.map(async (box) => {
          const { id: boxId, ...boxDataRaw } = box;
          if (!boxId) return;
          const boxData = sanitizeDeep(boxDataRaw);
          try {
            await setDoc(doc(db, 'boxes', boxId), boxData, { merge: true });
          } catch (error) {
            console.error('Failed to update box with refreshed item data', error);
          }
        })
      );

      setInventory((prev) =>
        prev.map((inventoryItem) =>
          inventoryItem.id === id
            ? { ...inventoryItem, ...itemData, id, instanceId: inventoryItem.instanceId }
            : inventoryItem
        )
      );

      setUsers((prev) =>
        prev.map((existingUser) => {
          if (!Array.isArray(existingUser.inventory)) return existingUser;
          const updatedInventory = existingUser.inventory.map((inventoryItem) =>
            inventoryItem.id === id
              ? { ...inventoryItem, ...itemData, id, instanceId: inventoryItem.instanceId }
              : inventoryItem
          );
          return { ...existingUser, inventory: updatedInventory };
        })
      );

      try {
        const inventoryQuery = query(
          collectionGroup(db, 'inventory'),
          where('id', '==', id)
        );
        const inventorySnapshot = await getDocs(inventoryQuery);
        await Promise.all(
          inventorySnapshot.docs.map((docSnapshot) =>
            setDoc(docSnapshot.ref, itemData, { merge: true })
          )
        );
      } catch (error) {
        console.error('Failed to update inventory items with refreshed item data', error);
      }
  };

  const deleteItem = async (itemId: string) => {
      try {
          await deleteDoc(doc(db, 'items', itemId));
      } catch (error) {
          console.error('Failed to delete item from Firebase', error);
      }

      setItems(prev => prev.filter(i => i.id !== itemId));
  };

  const ensureAdmin = () => {
    if (!user.isAdmin) {
      console.warn('Unauthorized admin action attempted');
      throw new Error('Not authorized');
    }
  };

  const createCoinPackage = async (pkg: Omit<CoinPackage, 'id'> & { id?: string }) => {
    ensureAdmin();
    const { id, ...rawData } = pkg;
    const packageData = sanitizeDeep({
      ...rawData,
      coins: Math.max(0, Number(rawData.coins ?? 0)),
      bonusCoins: Math.max(0, Number(rawData.bonusCoins ?? 0)),
      sortOrder: Number(rawData.sortOrder ?? 0),
      active: !!rawData.active,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    try {
      if (id) {
        await setDoc(doc(db, 'coin_packages', id), packageData, { merge: true });
      } else {
        await addDoc(collection(db, 'coin_packages'), packageData);
      }
    } catch (error) {
      console.error('Failed to save coin package in Firebase', error);
      throw error;
    }
  };

  const updateCoinPackage = async (id: string, updates: Partial<CoinPackage>) => {
    ensureAdmin();
    if (!id) {
      console.warn('Attempted to update a coin package without an id');
      return;
    }

    const packageData = sanitizeDeep({
      ...updates,
      coins: updates.coins !== undefined ? Math.max(0, Number(updates.coins ?? 0)) : undefined,
      bonusCoins: updates.bonusCoins !== undefined ? Math.max(0, Number(updates.bonusCoins ?? 0)) : undefined,
      sortOrder: updates.sortOrder !== undefined ? Number(updates.sortOrder ?? 0) : undefined,
      active: updates.active !== undefined ? !!updates.active : undefined,
      updatedAt: serverTimestamp()
    });

    try {
      await setDoc(doc(db, 'coin_packages', id), packageData, { merge: true });
    } catch (error) {
      console.error('Failed to update coin package in Firebase', error);
      throw error;
    }
  };

  const deleteCoinPackage = async (id: string) => {
    ensureAdmin();
    try {
      await deleteDoc(doc(db, 'coin_packages', id));
    } catch (error) {
      console.error('Failed to delete coin package from Firebase', error);
      throw error;
    }
  };

  const createBox = async (box: MysteryBox) => {
      const { id, ...boxDataRaw } = box;
      const boxData = sanitizeDeep(boxDataRaw);
      let boxId = id;

      try {
          if (id) {
              await setDoc(doc(db, 'boxes', id), boxData, { merge: true });
              boxId = id;
          } else {
              const docRef = await addDoc(collection(db, 'boxes'), boxData);
              boxId = docRef.id;
          }
      } catch (error) {
          console.error('Failed to save box to Firebase', error);
          boxId = boxId || `local-box-${Date.now()}`;
      }

      upsertAdminBox({ ...boxData, id: boxId });
  };

  const createUserBox = async (box: MysteryBox) => {
      if (!auth.currentUser) {
        openAuthModal('login');
        throw new Error('Login required');
      }

      const userBox = { ...box, isUserCreated: true, createdAt: Date.now() };
      const response = await authedFetch<{ boxId: string; newCoins?: number }>('/api/publish-case-lab-box', {
        method: 'POST',
        body: JSON.stringify({ box: userBox })
      });

      if (!response?.boxId) {
        throw new Error('Missing published box id');
      }

      setBoxes(prev => [...prev, { ...userBox, id: response.boxId }]);

      const nextCoins = Number(response?.newCoins);
      if (Number.isFinite(nextCoins)) {
        syncBalance(nextCoins);
      }

      return response.boxId;
  };

  const updateBox = async (updatedBox: MysteryBox) => {
      const { id, ...boxDataRaw } = updatedBox;
      if (!id) {
          console.warn('Attempted to update a box without an id');
          return;
      }

      const boxData = sanitizeDeep(boxDataRaw);

      try {
          await setDoc(doc(db, 'boxes', id), boxData, { merge: true });
      } catch (error) {
          console.error('Failed to update box in Firebase', error);
      }

      upsertAdminBox({ ...boxData, id });
  };

  const deleteBox = async (boxId: string) => {
      try {
          await deleteDoc(doc(db, 'boxes', boxId));
      } catch (error) {
          console.error('Failed to delete box from Firebase', error);
      }

      removeAdminBox(boxId);
  };

  const claimDaily = async () => {
    const timestamp = Date.now();
    setUser(prev => ({ ...prev, lastDailyClaim: timestamp }));
    persistUserData({ lastDailyClaim: timestamp });
  };

  const claimRakeback = async () => {
    if (!isAuthenticated) {
      openAuthModal('login');
      return;
    }

    try {
      const data = await authedFetch<{ newCoins?: number; remainingRakeback?: number }>('/api/claim-rakeback', {
        method: 'POST'
      });
      const nextCoins = Number(data?.newCoins);
      const remainingRakeback = Number(data?.remainingRakeback);

      if (Number.isFinite(nextCoins)) {
        syncBalance(nextCoins);
        setUser(prev => ({ ...prev, balance: nextCoins }));
        setUsers(prev => prev.map(u => u.id === user.id ? { ...u, balance: nextCoins } : u));
      }

      if (Number.isFinite(remainingRakeback)) {
        setUser(prev => ({ ...prev, rakebackBalance: remainingRakeback }));
        persistUserData({ rakebackBalance: remainingRakeback });
      }
    } catch (error) {
      console.error('Failed to claim rakeback', error);
      alert('Unable to claim rakeback right now. Please try again.');
    }
  };

  const awardCaseOpenXp = () => {
    if (!isAuthenticated) return;

    const xpGain = Math.max(0, Math.floor(bonusSettings.xpPerCaseOpen));
    if (!xpGain) return;

    setUser(prev => {
      const nextXp = Math.max(0, prev.xp + xpGain);
      const progress = calculateLevelProgress(nextXp, bonusSettings);
      persistUserData({ xp: nextXp, level: progress.level });
      return { ...prev, xp: nextXp, level: progress.level };
    });
  };

  const generateAffiliateCode = async () => {
    if (!isAuthenticated || !auth.currentUser) {
      openAuthModal('login');
      return;
    }

    if (user.affiliateCode) return user.affiliateCode;

    const base = (user.name || 'PLAYER').replace(/[^a-zA-Z0-9]/g, '').slice(0, 8).toUpperCase();
    const random = Math.random().toString(36).slice(-4).toUpperCase();
    const newCode = `${base}${random}`;

    try {
      await setDoc(getUserRef(auth.currentUser.uid), { affiliateCode: newCode }, { merge: true });
    } catch (error) {
      console.error('Failed to save affiliate code in Firebase', error);
    }

    setUser(prev => ({ ...prev, affiliateCode: newCode }));
    setUsers(prev => prev.map(u => u.id === auth.currentUser?.uid ? { ...u, affiliateCode: newCode } : u));
    return newCode;
  };

  const updateUserProgress = async (userId: string, xp: number) => {
    const numericXp = Number.isFinite(xp) ? xp : 0;
    const sanitizedXp = Math.max(0, Math.floor(numericXp));
    const progress = calculateLevelProgress(sanitizedXp, bonusSettings);
    try {
      await setDoc(getUserRef(userId), { xp: sanitizedXp, level: progress.level }, { merge: true });
    } catch (error) {
      console.error('Failed to update user progress in Firebase', error);
    }

    setUsers(prev => prev.map(u => u.id === userId ? { ...u, xp: sanitizedXp, level: progress.level } : u));
    setUser(prev => prev.id === userId ? { ...prev, xp: sanitizedXp, level: progress.level } : prev);
  };

  const updateShipmentStatus = async (
    shipmentId: string,
    userId: string,
    inventoryId: string | undefined,
    status: ShipmentStatus,
    trackingNumber?: string
  ) => {
    const sanitizedTrackingNumber = trackingNumber?.trim();
    if (!shipmentId) {
      console.warn('Attempted to update shipment without a shipment id');
      return;
    }

    const shipmentUpdates = sanitizeDeep({
      status,
      trackingNumber: sanitizedTrackingNumber,
      updatedAt: serverTimestamp()
    });

    try {
      await setDoc(doc(db, 'shipments', shipmentId), shipmentUpdates, { merge: true });
    } catch (error) {
      console.error('Failed to update shipment status in Firebase', error);
      return;
    }

    if (userId && inventoryId) {
      try {
        await setDoc(doc(db, 'users', userId, 'inventory', inventoryId), {
          status,
          trackingNumber: sanitizedTrackingNumber
        }, { merge: true });
      } catch (error) {
        console.error('Failed to update inventory shipment status in Firebase', error);
      }
    }

    setUsers((prev) =>
      prev.map((u) => {
        if (u.id !== userId) return u;
        if (!Array.isArray(u.inventory)) return u;
        const updatedInventory = u.inventory.map((item) =>
          item.instanceId === inventoryId
            ? {
                ...item,
                status,
                trackingNumber: sanitizedTrackingNumber || item.trackingNumber
              }
            : item
        );
        return { ...u, inventory: updatedInventory };
      })
    );
  };

  return (
    <GameContext.Provider value={{
      user,
      isAuthenticated,
      users,
      notifications,
      showLoginModal,
      showTopUpModal,
      authModalMode,
      showEmailVerificationModal,
      showEmailVerifiedModal,
      emailVerificationStatus,
      balance,
      inventory,
      shipments,
      view,
      battles,
      boxes,
      items,
      coinPackages,
      bonusSettings,
      stripeSettings,
      login,
      loginWithGoogle,
      linkGoogleAccount,
      register,
      resetPassword,
      logout,
      setShowLoginModal,
      setShowTopUpModal,
      setAuthModalMode,
      openAuthModal,
      resendEmailVerification,
      refreshEmailVerification,
      setShowEmailVerifiedModal,
      setShowEmailVerificationModal,
      setView,
      addBalance,
      syncBalance,
      deductBalance,
      addToInventory,
      addInventoryItemFromServer,
      followUser,
      unfollowUser,
      sellItem,
      shipItem,
      updateAddress,
      updateUserInfo,
      addNotification,
      dismissNotification,
      clearNotifications,
      sendAdminNotification,
      updateUserFlags,
      updateUserAdminData,
      updateUserBalance,
      createBattle,
      joinBattle,
      updateBattle,
      createItem,
      updateItem,
      deleteItem,
      createCoinPackage,
      updateCoinPackage,
      deleteCoinPackage,
      createBox,
      createUserBox,
      updateBox,
      deleteBox,
      claimDaily,
      claimRakeback,
      updateBonusSettings,
      updateStripeSettings,
      awardCaseOpenXp,
      registerSpend,
      generateAffiliateCode,
      updateUserProgress,
      updateShipmentStatus,
      authInitialized
    }}>
      {children}
    </GameContext.Provider>
  );
};

export const useGame = () => {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error('useGame must be used within a GameProvider');
  }
  return context;
};
