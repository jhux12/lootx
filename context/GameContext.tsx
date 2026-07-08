import React, { createContext, useCallback, useContext, useState, useEffect, ReactNode, useRef, useMemo } from 'react';
import { AppNotification, User, InventoryItem, CaseItem, InventoryProvenance, ViewState, Battle, MysteryBox, ShippingAddress, UserLocks, CoinPackage, StripeSettings, Shipment, ShipmentStatus } from '../types';
import { CASE_ITEMS } from '../constants';
import { auth, db } from '../firebase';
import { authedFetch } from '../utils/authedFetch';
import { SHIPPING_PROTECTION_TIERS, SHIPPING_RATE_TIERS, SIGNATURE_REQUIRED_CENTS } from '../utils/shippingRates';
import { trackEvent, trackMetaEvent } from '../utils/trackEvent';
import { PRICE_UNIT_MODE, toCoins } from '../utils/coins';
import { consumePostSignupRedirect, DEFAULT_POST_SIGNUP_REDIRECT, setPostSignupRedirect } from '../utils/postSignupRedirect';
import { resolveUserDisplayName } from '../utils/userIdentity';
import {
  User as FirebaseUser,
  AuthCredential,
  EmailAuthProvider,
  GoogleAuthProvider,
  browserLocalPersistence,
  browserSessionPersistence,
  applyActionCode,
  setPersistence,
  signInWithCredential,
  signInWithEmailAndPassword,
  signInWithCustomToken,
  createUserWithEmailAndPassword,
  fetchSignInMethodsForEmail,
  linkWithCredential,
  sendPasswordResetEmail,
  signOut,
  getIdTokenResult,
  onAuthStateChanged
} from 'firebase/auth';
import {
  addDoc,
  collection,
  collectionGroup,
  deleteDoc,
  deleteField,
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
  where,
  writeBatch
} from 'firebase/firestore';
import { activityStore } from '../src/lib/activity/activityStore';

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
      forceFullSellBack: typed.forceFullSellBack === true,
      sellBackRate: Number(typed.sellBackRate ?? 0),
      source: typeof typed.source === 'string' ? typed.source : undefined,
      sourceItemId: typeof typed.sourceItemId === 'string' ? typed.sourceItemId : undefined,
      sourceRedemptionId: typeof typed.sourceRedemptionId === 'string' ? typed.sourceRedemptionId : undefined,
      acquisitionCurrencyType: typed.acquisitionCurrencyType === 'XP' ? 'XP' : typed.acquisitionCurrencyType === 'COIN' ? 'COIN' : undefined,
      openCurrencyType: typed.openCurrencyType === 'XP' ? 'XP' : typed.openCurrencyType === 'COIN' ? 'COIN' : undefined,
      freeShipping: typed.freeShipping === true,
      shippingCostOverrideCoins: typed.shippingCostOverrideCoins == null ? undefined : Number(typed.shippingCostOverrideCoins),
      shippingCostOverrideCents: typed.shippingCostOverrideCents == null ? undefined : Number(typed.shippingCostOverrideCents)
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


const REFERRAL_CODE_STORAGE_KEY = 'pullz_pending_referral_code';

const normalizeReferralCode = (value: string | null | undefined) =>
  String(value ?? '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');

const getStoredReferralCode = () => {
  if (typeof window === 'undefined') return '';
  return normalizeReferralCode(window.localStorage.getItem(REFERRAL_CODE_STORAGE_KEY));
};

const setStoredReferralCode = (code: string) => {
  if (typeof window === 'undefined') return;
  const normalized = normalizeReferralCode(code);
  if (!normalized) {
    window.localStorage.removeItem(REFERRAL_CODE_STORAGE_KEY);
    return;
  }
  window.localStorage.setItem(REFERRAL_CODE_STORAGE_KEY, normalized);
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
  xpPer100CoinsWagered: number;
  xpPerCaseOpened: number;
  baseXpBonus: number;
  xpMultiplier: number;
  levelBaseXp: number;
  levelXpMultiplier: number;
  rakebackUnlockLevel: number;
  rakebackBasePercent: number;
  rakebackBonusCoins: number;
  rakebackDailyCapCoins: number;
  dailySpinOdds: Record<string, number>;
}

const DEFAULT_BONUS_SETTINGS: BonusSettings = {
  xpPer100Coins: 25,
  xpPerCaseOpen: 15,
  xpPer100CoinsWagered: 25,
  xpPerCaseOpened: 15,
  baseXpBonus: 0,
  xpMultiplier: 1,
  levelBaseXp: 200,
  levelXpMultiplier: 1.12,
  rakebackUnlockLevel: 6,
  rakebackBasePercent: 5,
  rakebackBonusCoins: 2500,
  rakebackDailyCapCoins: 15000,
  dailySpinOdds: {
    '10': 30,
    '25': 25,
    '100': 18,
    '500': 12,
    '1000': 9,
    '2500': 6
  }
};

const getStoredBonusSettings = (): BonusSettings => DEFAULT_BONUS_SETTINGS;

const DEFAULT_STRIPE_SETTINGS: StripeSettings = {
  boxCatalogHeroImageUrl: '',
  authPopupImageUrl: '',
  authPopupImageUrls: ['', '', ''],
  homeCategoryImageUrls: ['', '', ''],
  homeCategorySlugs: ['', '', ''],
  howItWorksStepImageUrls: ['', '', ''],
  shippingCashEnabled: false,
  shippingFlatRateCents: 0,
  shippingCoinEnabled: false,
  shippingCoinCostCoins: 0,
  shippingRateTiers: SHIPPING_RATE_TIERS.map((tier) => ({ maxValueCoinsExclusive: Number.isFinite(tier.maxValueCoinsExclusive) ? tier.maxValueCoinsExclusive : null, cashCents: tier.cashCents, label: tier.label })),
  shippingProtectionTiers: SHIPPING_PROTECTION_TIERS.map((tier) => ({ maxValueCoinsExclusive: Number.isFinite(tier.maxValueCoinsExclusive) ? tier.maxValueCoinsExclusive : null, cashCents: tier.cashCents, label: tier.label })),
  signatureRequiredCents: SIGNATURE_REQUIRED_CENTS,
  stripeShippingProductId: '',
  caseLabPublishFeeCoins: 0,
  caseLabSellBackPercent: 75,
  caseLabVisibleBoxIds: [],
  boxTagIcons: {}
};


const normalizeEditableShippingTiers = (tiers: unknown, fallback: StripeSettings['shippingRateTiers']): StripeSettings['shippingRateTiers'] => {
  if (!Array.isArray(tiers)) return fallback;

  const normalized = tiers
    .map((tier) => {
      if (!tier || typeof tier !== 'object') return null;
      const source = tier as { maxValueCoinsExclusive?: unknown; cashCents?: unknown; label?: unknown };
      const maxValue = source.maxValueCoinsExclusive === null
        ? null
        : Math.max(0, Math.round(Number(source.maxValueCoinsExclusive) || 0));
      return {
        maxValueCoinsExclusive: maxValue,
        cashCents: Math.max(0, Math.round(Number(source.cashCents) || 0)),
        label: typeof source.label === 'string' && source.label.trim() ? source.label.trim() : 'Custom tier'
      };
    })
    .filter((tier): tier is StripeSettings['shippingRateTiers'][number] => Boolean(tier) && (tier.maxValueCoinsExclusive === null || tier.maxValueCoinsExclusive > 0))
    .sort((a, b) => (a.maxValueCoinsExclusive ?? Number.POSITIVE_INFINITY) - (b.maxValueCoinsExclusive ?? Number.POSITIVE_INFINITY));

  return normalized.length > 0 ? normalized : fallback;
};

const normalizeStripeSettings = (settings: Partial<StripeSettings>): StripeSettings => {
  const legacyProductId =
    typeof (settings as { stripeShippingKeyOrId?: string }).stripeShippingKeyOrId === 'string'
      ? (settings as { stripeShippingKeyOrId?: string }).stripeShippingKeyOrId
      : '';
  const legacyAuthImage = typeof settings.authPopupImageUrl === 'string' ? settings.authPopupImageUrl.trim() : '';
  const normalizedAuthImages = Array.isArray(settings.authPopupImageUrls)
    ? settings.authPopupImageUrls
        .filter((imageUrl): imageUrl is string => typeof imageUrl === 'string')
        .map((imageUrl) => imageUrl.trim())
        .slice(0, 3)
    : [];

  return {
    boxCatalogHeroImageUrl: typeof settings.boxCatalogHeroImageUrl === 'string' ? settings.boxCatalogHeroImageUrl.trim() : '',
    authPopupImageUrl: legacyAuthImage,
    authPopupImageUrls: normalizedAuthImages.length > 0
      ? normalizedAuthImages
      : legacyAuthImage
        ? [legacyAuthImage]
        : [],
    homeCategoryImageUrls: Array.isArray(settings.homeCategoryImageUrls)
      ? settings.homeCategoryImageUrls
          .filter((imageUrl): imageUrl is string => typeof imageUrl === 'string')
          .map((imageUrl) => imageUrl.trim())
          .slice(0, 3)
      : [],
    homeCategorySlugs: Array.isArray(settings.homeCategorySlugs)
      ? settings.homeCategorySlugs
          .filter((slug): slug is string => typeof slug === 'string')
          .map((slug) => slug.trim())
          .slice(0, 3)
      : [],
    howItWorksStepImageUrls: Array.isArray(settings.howItWorksStepImageUrls)
      ? settings.howItWorksStepImageUrls
          .filter((imageUrl): imageUrl is string => typeof imageUrl === 'string')
          .map((imageUrl) => imageUrl.trim())
          .slice(0, 3)
      : [],
    shippingCashEnabled: settings.shippingCashEnabled === true,
    shippingFlatRateCents: Math.max(0, Math.round(Number(settings.shippingFlatRateCents) || 0)),
    shippingCoinEnabled: settings.shippingCoinEnabled === true,
    shippingCoinCostCoins: Math.max(0, Math.round(Number(settings.shippingCoinCostCoins) || 0)),
    shippingRateTiers: normalizeEditableShippingTiers(settings.shippingRateTiers, DEFAULT_STRIPE_SETTINGS.shippingRateTiers),
    shippingProtectionTiers: normalizeEditableShippingTiers(settings.shippingProtectionTiers, DEFAULT_STRIPE_SETTINGS.shippingProtectionTiers),
    signatureRequiredCents: Math.max(0, Math.round(Number(settings.signatureRequiredCents ?? SIGNATURE_REQUIRED_CENTS) || 0)),
    stripeShippingProductId:
      typeof settings.stripeShippingProductId === 'string' ? settings.stripeShippingProductId : legacyProductId,
    caseLabPublishFeeCoins: Math.max(0, Math.round(Number(settings.caseLabPublishFeeCoins) || 0)),
    caseLabSellBackPercent: Math.min(100, Math.max(0, Math.round(Number(settings.caseLabSellBackPercent) || 0))),
    caseLabVisibleBoxIds: Array.isArray(settings.caseLabVisibleBoxIds)
      ? settings.caseLabVisibleBoxIds.filter((boxId): boxId is string => typeof boxId === 'string' && boxId.trim().length > 0)
      : [],
    boxTagIcons: settings.boxTagIcons && typeof settings.boxTagIcons === 'object'
      ? Object.fromEntries(
          Object.entries(settings.boxTagIcons)
            .filter(([tag, iconClass]) => typeof tag === 'string' && typeof iconClass === 'string')
            .map(([tag, iconClass]) => [tag.trim().toLowerCase(), iconClass.trim().replace(/\s+/g, ' ')])
            .filter(([tag, iconClass]) => tag.length > 0 && iconClass.length > 0)
        )
      : {}
  };
};

const normalizeBonusSettings = (settings: Partial<BonusSettings>): BonusSettings => ({
  xpPer100Coins: Math.max(0, Number(settings.xpPer100Coins) || Number(settings.xpPer100CoinsWagered) || 0),
  xpPerCaseOpen: Math.max(0, Number(settings.xpPerCaseOpen) || Number(settings.xpPerCaseOpened) || 0),
  xpPer100CoinsWagered: Math.max(0, Number(settings.xpPer100CoinsWagered) || Number(settings.xpPer100Coins) || 0),
  xpPerCaseOpened: Math.max(0, Number(settings.xpPerCaseOpened) || Number(settings.xpPerCaseOpen) || 0),
  baseXpBonus: Math.max(0, Number(settings.baseXpBonus) || 0),
  xpMultiplier: Math.max(0, Number(settings.xpMultiplier) || 1),
  levelBaseXp: Math.max(1, Number(settings.levelBaseXp) || DEFAULT_BONUS_SETTINGS.levelBaseXp),
  levelXpMultiplier: Math.max(1, Number(settings.levelXpMultiplier) || DEFAULT_BONUS_SETTINGS.levelXpMultiplier),
  rakebackUnlockLevel: Math.max(1, Number(settings.rakebackUnlockLevel) || DEFAULT_BONUS_SETTINGS.rakebackUnlockLevel),
  rakebackBasePercent: Math.max(0, Number(settings.rakebackBasePercent) || 0),
  rakebackBonusCoins: Math.max(0, Number(settings.rakebackBonusCoins) || 0),
  rakebackDailyCapCoins: Math.max(0, Number(settings.rakebackDailyCapCoins) || 0),
  dailySpinOdds: (() => {
    const source =
      settings.dailySpinOdds && typeof settings.dailySpinOdds === 'object'
        ? settings.dailySpinOdds
        : DEFAULT_BONUS_SETTINGS.dailySpinOdds;

    const normalizedEntries = Object.entries(source)
      .map(([amount, weight]) => [String(Math.max(0, Math.floor(Number(amount) || 0))), Math.max(0, Number(weight) || 0)] as const)
      .filter(([amount]) => Number(amount) > 0);

    const next = Object.fromEntries(normalizedEntries);
    return Object.keys(next).length > 0 ? next : { ...DEFAULT_BONUS_SETTINGS.dailySpinOdds };
  })()
});

const BONUS_SETTINGS_DOC = 'bonus-settings';
const STRIPE_SETTINGS_DOC = 'stripe-settings';
const USER_BOX_EXPIRY_MS = 24 * 60 * 60 * 1000;
const SIGNUP_CREDIT_COINS = 0.05;
const getBoxCurrencyType = (box: Partial<MysteryBox> & { price?: number; priceXP?: number; currencyType?: string }) => {
  if (box.currencyType === 'XP') return 'XP' as const;
  const xpPrice = Number(box.priceXP ?? 0);
  const coinPrice = Number(box.price ?? 0);
  if (Number.isFinite(xpPrice) && xpPrice > 0 && (!Number.isFinite(coinPrice) || coinPrice <= 0)) {
    return 'XP' as const;
  }
  return 'COIN' as const;
};

const getBoxSortPrice = (box: Pick<MysteryBox, 'currencyType' | 'priceXP' | 'price'>) =>
  getBoxCurrencyType(box) === 'XP' ? Number(box.priceXP ?? 0) : Number(box.price ?? 0);

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
        isFree: parseBooleanSearchParam(params.get('free')),
        inventoryId: params.get('inventoryId') ?? undefined,
        pullPassClaimTier: params.get('pullPassClaimTier') ? Math.max(1, Math.floor(Number(params.get('pullPassClaimTier')) || 0)) : undefined
      };
    }
    return { type: 'HOME' };
  }

  if (primary === 'case' && secondary === 'free-box') {
    return { type: 'SPIN' };
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

  if (primary === 'spin') {
    return { type: 'SPIN' };
  }

  if (primary === 'arcade' && secondary === 'plinko') {
    return { type: 'PLINKO' };
  }

  if (primary === 'plinko' || primary === 'upgrader') {
    return { type: 'PLINKO' };
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

  if (primary === 'quests') {
    return { type: 'QUESTS' };
  }

  if (primary === 'polls') {
    return { type: 'POLLS' };
  }

  if (primary === 'referrals') {
    return { type: 'REFERRALS' };
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

  if (primary === 'leaderboard' || primary === 'leaderboards') {
    return { type: 'LEADERBOARD' };
  }

  if (primary === 'faq') {
    return { type: 'FAQ' };
  }

  if (primary === 'about') {
    return { type: 'ABOUT' };
  }

  if (primary === 'shipping-policy') {
    return { type: 'SHIPPING_POLICY' };
  }

  if (primary === 'refund-policy') {
    return { type: 'REFUND_POLICY' };
  }

  if (primary === 'provably-fair') {
    return { type: 'PROVABLY_FAIR' };
  }

  if (primary === 'verify') {
    return { type: 'VERIFY_EMAIL' };
  }

  if (primary === 'admin' && secondary === 'upgrader' && segments[2] === 'targets') {
    return { type: 'ADMIN_UPGRADER_TARGETS' };
  }

  if (primary === 'admin' && secondary === 'upgrader') {
    return { type: 'ADMIN_UPGRADER_SETTINGS' };
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
    case 'SPIN':
      return '/spin';
    case 'PLINKO':
      return '/upgrader';
    case 'PROFILE':
      return view.userId ? `/profile/${view.userId}` : '/profile';
    case 'INVENTORY':
      return '/inventory';
    case 'BONUSES':
      return '/bonuses';
    case 'QUESTS':
      return '/quests';
    case 'POLLS':
      return '/polls';
    case 'REFERRALS':
      return '/referrals';
    case 'CONTACT':
      return '/contact';
    case 'TERMS':
      return '/terms';
    case 'PRIVACY':
      return '/privacy';
    case 'FAQ':
      return '/faq';
    case 'ABOUT':
      return '/about';
    case 'SHIPPING_POLICY':
      return '/shipping-policy';
    case 'REFUND_POLICY':
      return '/refund-policy';
    case 'ADMIN':
      return '/admin';
    case 'ADMIN_UPGRADER_SETTINGS':
      return '/admin/upgrader';
    case 'ADMIN_UPGRADER_TARGETS':
      return '/admin/upgrader/targets';
    case 'LEADERBOARD':
      return '/leaderboards';
    case 'CUSTOM_CREATOR':
      return '/case-lab';
    case 'PROVABLY_FAIR':
      return '/provably-fair';
    case 'VERIFY_EMAIL':
      return '/verify';
    case 'CASE_OPENING': {
      const params = new URLSearchParams();
      if (view.isFree) params.set('free', 'true');
      if (view.inventoryId) params.set('inventoryId', view.inventoryId);
      if (view.pullPassClaimTier) params.set('pullPassClaimTier', String(view.pullPassClaimTier));
      const query = params.toString();
      const search = query ? `?${query}` : '';
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
  rakebackUnlocked: boolean;
  rakebackPercent: number;
  rakebackTier: string | null;
  affiliateCode?: string;
  referredBy?: string;
  shippingAddress: ShippingAddress;
  name: string;
  avatar: string;
  username: string;
  usernameLower: string;
  displayName: string;
  photoURL: string;
  topPullsPublic: boolean;
  lastDailyClaim: number;
  purchasedCoins: number;
  promoCoins: number;
  lastFreeBoxClaim: number;
  isAdmin: boolean;
}>;

type GoogleAuthResult =
  | { status: 'success' }
  | { status: 'link-required'; email: string; credential: AuthCredential }
  | { status: 'error'; message: string };

type GoogleAuthOptions = {
  remember?: boolean;
  isRetry?: boolean;
  useRedirect?: boolean;
};

type AuthModalMode = 'login' | 'register';

type EmailVerificationStatus = 'idle' | 'pending' | 'checking' | 'verified-no-session';

type EmailPasswordAuthResult = { requiresEmailVerification?: boolean } | void;

const AUTH_INLINE_MESSAGE_KEY = 'authInlineMessage';

export type TopUpModalIntent = {
  reason: 'insufficient_balance';
  requiredCoins: number;
  currentBalance: number;
  missingCoins: number;
  source?: 'post_free_box';
  preferredPackageUsd?: number;
};

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
  topUpModalIntent: TopUpModalIntent | null;
  authModalMode: AuthModalMode;
  showEmailVerificationModal: boolean;
  showEmailVerifiedModal: boolean;
  emailVerificationStatus: EmailVerificationStatus;
  authInitialized: boolean;

  // Actions
  login: (email: string, pass: string, remember?: boolean) => Promise<EmailPasswordAuthResult>;
  loginWithGoogle: (options?: GoogleAuthOptions) => Promise<GoogleAuthResult>;
  linkGoogleAccount: (email: string, password: string, credential: AuthCredential) => Promise<GoogleAuthResult>;
  register: (name: string, email: string, pass: string) => Promise<EmailPasswordAuthResult>;
  resetPassword: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  setShowLoginModal: (show: boolean) => void;
  setShowTopUpModal: (show: boolean) => void;
  setTopUpModalIntent: (intent: TopUpModalIntent | null) => void;
  setAuthModalMode: (mode: AuthModalMode) => void;
  openAuthModal: (mode?: AuthModalMode) => void;
  resendEmailVerification: () => Promise<void>;
  refreshEmailVerification: () => Promise<void>;
  dismissEmailVerificationModal: () => Promise<void>;
  setShowEmailVerifiedModal: (show: boolean) => void;
  setShowEmailVerificationModal: (show: boolean) => void;
  setView: (view: ViewState) => void;
  addBalance: (amount: number) => void;
  syncBalance: (amount: number) => void;
  syncXpBalance: (amount: number) => void;
  deductBalance: (amount: number, options?: { trackRewards?: boolean }) => boolean;
  addToInventory: (item: CaseItem, provenance?: InventoryProvenance) => InventoryItem;
  addInventoryItemFromServer: (item: InventoryItem) => void;
  followUser: (targetUserId: string) => Promise<void>;
  unfollowUser: (targetUserId: string) => Promise<void>;
  sellItem: (instanceId: string) => Promise<{ creditCoins?: number } | void>;
  shipItem: (instanceId: string | string[], options?: { shippingProtection?: boolean; signatureRequired?: boolean }) => Promise<{ shipmentId?: string; shipmentBatchId?: string; requiresEmailVerification?: boolean } | void>;
  updateAddress: (address: ShippingAddress) => void;
  updateUserInfo: (name: string, avatar: string) => Promise<void>;
  addNotification: (notification: Omit<AppNotification, 'id' | 'createdAt'> & Partial<Pick<AppNotification, 'id' | 'createdAt'>>) => void;
  dismissNotification: (id: string) => void;
  clearNotifications: () => void;
  sendAdminNotification: (message: string) => Promise<void>;
  createBattle: (boxIds: string[], maxPlayers: number, options?: { mode?: 'REGULAR' | 'CRAZY'; format?: '1V1' | '2V2' }) => Promise<void>;
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
  claimFreeBox: (claimedAt?: number, options?: { persist?: boolean }) => Promise<void>;
  claimRakeback: () => Promise<void>;
  updateBonusSettings: (settings: BonusSettings) => void;
  updateStripeSettings: (settings: StripeSettings) => void;
  awardCaseOpenXp: () => void;
  registerSpend: (amount: number) => void;
  generateAffiliateCode: () => Promise<string | undefined>;
  updateUserProgress: (userId: string, xp: number) => Promise<void>;
  updateShipmentStatus: (shipmentId: string, userId: string, inventoryId: string | undefined, status: ShipmentStatus, trackingNumber?: string) => Promise<void>;
  cancelShipmentAsAdmin: (shipmentId: string, userId: string, inventoryId?: string) => Promise<void>;
}

const getDayStart = (timestamp: number = Date.now()) => {
  const date = new Date(timestamp);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
};

const AUTH_LOADING_USER: User = {
  id: 'loading',
  name: 'Loading...',
  avatar: '',
  balance: 0,
  level: 0,
  xp: 0,
  totalSpent: 0,
  totalDepositedCents: 0,
  depositCount: 0,
  lastDepositAt: undefined,
  rakebackBalance: 0,
  rakebackEarnedToday: 0,
  rakebackEarnedAt: getDayStart(),
  rakebackUnlocked: false,
  rakebackPercent: undefined,
  rakebackTier: null,
  followers: [],
  isAdmin: false,
  termsFlagged: false
};

const isRealFirebaseUid = (uid: string | null | undefined) => Boolean(uid && uid.trim() && uid !== 'loading' && uid !== 'guest');

const GameContext = createContext<GameContextType | undefined>(undefined);
const AuthContext = createContext<Pick<GameContextType, 'user' | 'isAuthenticated' | 'authInitialized' | 'openAuthModal' | 'login' | 'loginWithGoogle' | 'linkGoogleAccount' | 'register' | 'resetPassword' | 'logout' | 'authModalMode' | 'setAuthModalMode' | 'showLoginModal' | 'setShowLoginModal' | 'showEmailVerificationModal' | 'setShowEmailVerificationModal' | 'showEmailVerifiedModal' | 'setShowEmailVerifiedModal' | 'emailVerificationStatus' | 'resendEmailVerification' | 'refreshEmailVerification' | 'dismissEmailVerificationModal'> | undefined>(undefined);
const WalletContext = createContext<Pick<GameContextType, 'balance' | 'user' | 'syncBalance' | 'syncXpBalance' | 'addBalance' | 'deductBalance' | 'registerSpend' | 'awardCaseOpenXp'> | undefined>(undefined);
const BoxesContext = createContext<Pick<GameContextType, 'boxes' | 'items' | 'createBox' | 'createUserBox' | 'updateBox' | 'deleteBox' | 'view' | 'setView'> | undefined>(undefined);
const InventoryContext = createContext<Pick<GameContextType, 'inventory' | 'shipments' | 'addToInventory' | 'addInventoryItemFromServer' | 'sellItem' | 'shipItem'> | undefined>(undefined);
const UIContext = createContext<Pick<GameContextType, 'view' | 'setView' | 'notifications' | 'addNotification' | 'dismissNotification' | 'clearNotifications' | 'showTopUpModal' | 'setShowTopUpModal' | 'topUpModalIntent' | 'setTopUpModalIntent'> | undefined>(undefined);

// Guest / Loading User
const GUEST_USER: User = {
  id: 'guest',
  name: 'User',
  avatar: '',
  balance: 0,
  level: 0,
  xp: 0,
  totalSpent: 0,
  totalDepositedCents: 0,
  depositCount: 0,
  lastDepositAt: undefined,
  rakebackBalance: 0,
  rakebackEarnedToday: 0,
  rakebackEarnedAt: getDayStart(),
  rakebackUnlocked: false,
  rakebackPercent: undefined,
  rakebackTier: null,
  followers: [],
  isAdmin: false,
  termsFlagged: false
};

const getUserRef = (uid: string) => doc(db, 'users', uid);


const normalizeNonNegativeNumber = (value: unknown, fallback = 0) => {
  const numericValue = Number(value ?? fallback);
  return Number.isFinite(numericValue) ? Math.max(0, numericValue) : fallback;
};

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

const USER_PROFILE_SAFE_KEYS = [
  'uid',
  'email',
  'username',
  'usernameLower',
  'createdAt',
  'updatedAt',
  'photoURL',
  'displayName',
  'lastLogin',
  'shippingAddress',
  'topPullsPublic'
] as const;

const filterSafeUserProfileFields = (payload: Record<string, unknown>) => {
  const filtered = Object.fromEntries(
    Object.entries(payload).filter(([key]) => USER_PROFILE_SAFE_KEYS.includes(key as typeof USER_PROFILE_SAFE_KEYS[number]))
  );

  if (filtered.shippingAddress === undefined) {
    delete filtered.shippingAddress;
  }

  return sanitizeDeep(filtered);
};

const buildUserDocument = (user: User) => {
  const payload: Record<string, unknown> = {
    uid: user.id,
    email: user.email ?? '',
    username: user.username ?? user.name ?? '',
    usernameLower: toFirestoreUsernameLower(user.username ?? user.name ?? ''),
    createdAt: user.createdAt ?? Date.now(),
    updatedAt: Date.now(),
    photoURL: user.photoURL,
    displayName: user.displayName ?? user.name ?? '',
    lastLogin: Date.now(),
    shippingAddress: user.shippingAddress
  };

  return filterSafeUserProfileFields(payload);
};

const buildLegacyUserProfileBackfill = (firebaseUser: FirebaseUser, data: Record<string, unknown> = {}) => {
  const metadataCreatedAt = firebaseUser.metadata.creationTime ? Date.parse(firebaseUser.metadata.creationTime) : NaN;
  const fallbackCreatedAt = Number.isFinite(metadataCreatedAt) ? metadataCreatedAt : Date.now();
  const username =
    typeof data.username === 'string' && data.username.trim()
      ? data.username.trim()
      : buildBaseUsername(
          typeof data.displayName === 'string' ? data.displayName : firebaseUser.displayName,
          typeof data.email === 'string' ? data.email : firebaseUser.email
        );
  const existingUsernameLower = typeof data.usernameLower === 'string' ? data.usernameLower.trim() : '';
  const usernameLower = isValidFirestoreUsernameLower(existingUsernameLower)
    ? existingUsernameLower
    : toFirestoreUsernameLower(existingUsernameLower || username);

  const patch: Record<string, unknown> = {};

  if (data.uid !== firebaseUser.uid) patch.uid = firebaseUser.uid;
  if (typeof data.email !== 'string' && firebaseUser.email) patch.email = firebaseUser.email;
  if (!(typeof data.username === 'string' && data.username.trim())) patch.username = username;
  if (!isValidFirestoreUsernameLower(existingUsernameLower)) patch.usernameLower = usernameLower;
  if (data.createdAt === undefined) patch.createdAt = fallbackCreatedAt;
  if (data.updatedAt === undefined) patch.updatedAt = Date.now();
  if (data.lastLogin === undefined) patch.lastLogin = Date.now();
  if (data.photoURL === undefined && firebaseUser.photoURL) patch.photoURL = firebaseUser.photoURL;
  if (data.displayName === undefined && (firebaseUser.displayName || typeof data.username === 'string')) {
    patch.displayName =
      firebaseUser.displayName
      || (typeof data.username === 'string' ? data.username : username);
  }
  if (data.shippingAddress !== undefined) patch.shippingAddress = data.shippingAddress;

  return filterSafeUserProfileFields(patch);
};

const normalizeUsername = (value: string) =>
  value
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .replace(/^_+|_+$/g, '');

const clampFirestoreUsernameLower = (value: string) => normalizeUsername(value).slice(0, 16);

const isValidFirestoreUsernameLower = (value: string) => /^[a-z0-9_]{3,16}$/.test(value);

const toFirestoreUsernameLower = (value: string, fallback = 'player') => {
  const normalized = clampFirestoreUsernameLower(value);
  if (isValidFirestoreUsernameLower(normalized)) return normalized;

  const normalizedFallback = clampFirestoreUsernameLower(fallback);
  return isValidFirestoreUsernameLower(normalizedFallback) ? normalizedFallback : 'player';
};

const buildBaseUsername = (displayName: string | null | undefined, email: string | null | undefined) => {
  const fromDisplayName = normalizeUsername(displayName ?? '');
  if (fromDisplayName) return fromDisplayName;
  const emailPrefix = (email ?? '').split('@')[0] ?? '';
  const fromEmail = normalizeUsername(emailPrefix);
  return fromEmail || 'player';
};

const reserveUniqueUsername = async (uid: string, base: string) => {
  let attempt = 0;

  while (true) {
    const suffix = attempt === 0 ? '' : `_${attempt + 1}`;
    const candidate = clampFirestoreUsernameLower(`${base}${suffix}`);

    if (!isValidFirestoreUsernameLower(candidate)) {
      attempt += 1;
      continue;
    }

    const usernameRef = doc(db, 'usernames', candidate);
    const usernameDoc = await getDoc(usernameRef);
    if (usernameDoc.exists()) {
      attempt += 1;
      continue;
    }

    try {
      await setDoc(usernameRef, { uid, createdAt: Date.now() });
      return candidate;
    } catch (error) {
      attempt += 1;
    }
  }
};

const buildUserProfile = (firebaseUser: FirebaseUser, data: Record<string, any> = {}) => {
  const now = Date.now();
  const metadataCreatedAt = firebaseUser.metadata.creationTime ? Date.parse(firebaseUser.metadata.creationTime) : NaN;
  const fallbackCreatedAt = Number.isFinite(metadataCreatedAt) ? metadataCreatedAt : now;
  const createdAt = normalizeTimestamp(data.createdAt, fallbackCreatedAt);
  const xp = Number(data.xpBalance ?? data.xp ?? 0);
  const lastDailyClaim = data.lastDailyClaim === undefined ? undefined : normalizeTimestamp(data.lastDailyClaim, 0);
  const lastFreeBoxClaim = data.lastFreeBoxClaim === undefined ? undefined : normalizeTimestamp(data.lastFreeBoxClaim, 0);
  const followerIds = Array.isArray(data.followers)
    ? data.followers
    : Array.isArray(data.friends)
      ? data.friends
      : [];
  const balance = Number(data.coins ?? data.balance ?? 0);

  const fallbackName = resolveUserDisplayName({
    username: data.username ?? data.name,
    displayName: data.displayName ?? firebaseUser.displayName ?? undefined,
    email: data.email ?? firebaseUser.email ?? undefined
  });
  const fallbackAvatar = data.photoURL || firebaseUser.photoURL || '';

  return {
    id: firebaseUser.uid,
    createdAt,
    name: fallbackName,
    username: data.username ?? data.name ?? fallbackName,
    displayName: data.displayName ?? firebaseUser.displayName ?? undefined,
    email: data.email || firebaseUser.email || '',
    avatar: fallbackAvatar,
    photoURL: data.photoURL ?? firebaseUser.photoURL ?? undefined,
    provider: data.provider,
    balance,
    level: Number(data.level ?? 1),
    xp,
    xpBalance: xp,
    xpEarnedLifetime: Number(data.xpEarnedLifetime ?? 0),
    xpSpentLifetime: Number(data.xpSpentLifetime ?? 0),
    pullPassSeasonXp: Number(data.pullPassSeasonXp ?? 0),
    pullPassXp: Number(data.pullPassXp ?? 0),
    pullPassClaims: data.pullPassClaims ?? undefined,
    pullPassResetAt: Number(data.pullPassResetAt ?? 0),
    activePullPassBoxClaim: data.activePullPassBoxClaim ?? undefined,
    lastDailyClaim,
    lastFreeBoxClaim,
    totalSpent: normalizeNonNegativeNumber(data.totalSpent),
    totalDepositedCents: normalizeNonNegativeNumber(data.totalDepositedCents),
    depositCount: normalizeNonNegativeNumber(data.depositCount),
    lastDepositAt: data.lastDepositAt,
    rakebackBalance: Number(data.rakebackBalance ?? 0),
    rakebackEarnedToday: Number(data.rakebackEarnedToday ?? 0),
    rakebackEarnedAt: Number(data.rakebackEarnedAt ?? 0),
    rakebackUnlocked: data.rakebackUnlocked === true,
    rakebackPercent: data.rakebackPercent == null ? undefined : Math.max(0, Number(data.rakebackPercent)),
    rakebackTier: data.rakebackTier == null ? null : String(data.rakebackTier),
    affiliateCode: data.affiliateCode,
    referredBy: data.referredBy,
    followers: followerIds,
    shippingAddress: data.shippingAddress,
    isAdmin: false,
    termsFlagged: data.termsFlagged ?? false,
    status: data.status ?? 'active',
    locks: data.locks ?? DEFAULT_LOCKS,
    ledger: Array.isArray(data.ledger) ? data.ledger : undefined,
    adminLogs: Array.isArray(data.adminLogs) ? data.adminLogs : undefined,
    topPullsPublic: data.topPullsPublic ?? false,
    hiddenFromLeaderboard: data.hiddenFromLeaderboard === true,
    hiddenFromPublicDisplay: data.hiddenFromPublicDisplay === true,
    topPulls: normalizeInventoryItems(data.topPulls),
    challengeStatsDay: typeof data.challengeStatsDay === 'string' ? data.challengeStatsDay : undefined,
    challengeStats: data.challengeStats ?? undefined,
    questClaims: data.questClaims ?? undefined
  } as User;
};

const buildUserProfileFromDoc = (userId: string, data: Record<string, any> = {}) => {
  const now = Date.now();
  const createdAt = normalizeTimestamp(data.createdAt, now);
  const xp = Number(data.xpBalance ?? data.xp ?? 0);
  const lastDailyClaim = data.lastDailyClaim === undefined ? undefined : normalizeTimestamp(data.lastDailyClaim, 0);
  const lastFreeBoxClaim = data.lastFreeBoxClaim === undefined ? undefined : normalizeTimestamp(data.lastFreeBoxClaim, 0);
  const followerIds = Array.isArray(data.followers)
    ? data.followers
    : Array.isArray(data.friends)
      ? data.friends
      : [];
  const balance = Number(data.coins ?? data.balance ?? 0);
  const name = resolveUserDisplayName({
    username: data.username ?? data.name,
    displayName: data.displayName,
    email: data.email
  });
  const avatar = data.photoURL || '';

  return {
    id: userId,
    createdAt,
    name,
    username: data.username ?? data.name ?? name,
    displayName: data.displayName,
    email: data.email || '',
    avatar,
    photoURL: data.photoURL,
    provider: data.provider,
    balance,
    level: Number(data.level ?? 1),
    xp,
    xpBalance: xp,
    xpEarnedLifetime: Number(data.xpEarnedLifetime ?? 0),
    xpSpentLifetime: Number(data.xpSpentLifetime ?? 0),
    pullPassSeasonXp: Number(data.pullPassSeasonXp ?? 0),
    pullPassXp: Number(data.pullPassXp ?? 0),
    pullPassClaims: data.pullPassClaims ?? undefined,
    pullPassResetAt: Number(data.pullPassResetAt ?? 0),
    activePullPassBoxClaim: data.activePullPassBoxClaim ?? undefined,
    lastDailyClaim,
    lastFreeBoxClaim,
    totalSpent: normalizeNonNegativeNumber(data.totalSpent),
    totalDepositedCents: normalizeNonNegativeNumber(data.totalDepositedCents),
    depositCount: normalizeNonNegativeNumber(data.depositCount),
    lastDepositAt: data.lastDepositAt,
    rakebackBalance: Number(data.rakebackBalance ?? 0),
    rakebackEarnedToday: Number(data.rakebackEarnedToday ?? 0),
    rakebackEarnedAt: Number(data.rakebackEarnedAt ?? 0),
    rakebackUnlocked: data.rakebackUnlocked === true,
    rakebackPercent: data.rakebackPercent == null ? undefined : Math.max(0, Number(data.rakebackPercent)),
    rakebackTier: data.rakebackTier == null ? null : String(data.rakebackTier),
    affiliateCode: data.affiliateCode,
    referredBy: data.referredBy,
    followers: followerIds,
    shippingAddress: data.shippingAddress,
    isAdmin: false,
    termsFlagged: data.termsFlagged ?? false,
    status: data.status ?? 'active',
    locks: data.locks ?? DEFAULT_LOCKS,
    ledger: Array.isArray(data.ledger) ? data.ledger : undefined,
    adminLogs: Array.isArray(data.adminLogs) ? data.adminLogs : undefined,
    topPullsPublic: data.topPullsPublic ?? false,
    hiddenFromLeaderboard: data.hiddenFromLeaderboard === true,
    hiddenFromPublicDisplay: data.hiddenFromPublicDisplay === true,
    topPulls: normalizeInventoryItems(data.topPulls),
    challengeStatsDay: typeof data.challengeStatsDay === 'string' ? data.challengeStatsDay : undefined,
    challengeStats: data.challengeStats ?? undefined,
    questClaims: data.questClaims ?? undefined,
    inventory: normalizeInventoryItems(data.inventory)
  } as User;
};

type AdminDirectoryUserRecord = {
  id: string;
  email?: string;
  displayName?: string;
  photoURL?: string;
  provider?: string;
  disabled?: boolean;
  createdAt?: number;
  firestoreData?: Record<string, any>;
};

const buildUserProfileFromAdminDirectory = (record: AdminDirectoryUserRecord) => {
  const data = record.firestoreData ?? {};
  const fallbackName = resolveUserDisplayName({
    username: data.username ?? data.name,
    displayName: data.displayName ?? record.displayName,
    email: data.email ?? record.email
  });
  const fallbackAvatar = data.photoURL || record.photoURL || '';

  const profile = buildUserProfileFromDoc(record.id, {
    ...data,
    email: data.email ?? record.email ?? '',
    displayName: data.displayName ?? record.displayName,
    photoURL: data.photoURL ?? record.photoURL,
    avatar: fallbackAvatar,
    provider: data.provider ?? record.provider,
    createdAt: data.createdAt ?? record.createdAt ?? Date.now(),
    status: data.status ?? (record.disabled ? 'suspended' : 'active')
  });

  return {
    ...profile,
    inventory: normalizeInventoryItems(data.inventory)
  } as User;
};

const mergeAdminUsers = (snapshotUsers: User[], directoryUsers: AdminDirectoryUserRecord[], fallbackUser: User) => {
  const merged = new Map<string, User>();
  directoryUsers.forEach((record) => {
    merged.set(record.id, buildUserProfileFromAdminDirectory(record));
  });
  snapshotUsers.forEach((entry) => {
    merged.set(entry.id, {
      ...(merged.get(entry.id) ?? {}),
      ...entry
    });
  });

  if (!merged.size && fallbackUser?.id) {
    merged.set(fallbackUser.id, fallbackUser);
  }

  return Array.from(merged.values()).sort((a, b) => {
    const createdDiff = Number(b.createdAt ?? 0) - Number(a.createdAt ?? 0);
    if (createdDiff !== 0) return createdDiff;
    return (a.name ?? '').localeCompare(b.name ?? '');
  });
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
    forceFullSellBack: data.forceFullSellBack === true,
    sellBackRate: Number(data.sellBackRate ?? 0),
    locked: data.locked ?? false,
    history,
    source: typeof data.source === 'string' ? data.source : undefined,
    sourceItemId: typeof data.sourceItemId === 'string' ? data.sourceItemId : undefined,
    sourceRedemptionId: typeof data.sourceRedemptionId === 'string' ? data.sourceRedemptionId : undefined,
    acquisitionCurrencyType: data.acquisitionCurrencyType === 'XP' ? 'XP' : data.acquisitionCurrencyType === 'COIN' ? 'COIN' : undefined,
    openCurrencyType: data.openCurrencyType === 'XP' ? 'XP' : data.openCurrencyType === 'COIN' ? 'COIN' : undefined,
    boxId: typeof data.boxId === 'string' ? data.boxId : undefined,
    pullPassTier: data.pullPassTier == null ? undefined : Number(data.pullPassTier),
    pullPassBoxType: typeof data.pullPassBoxType === 'string' ? data.pullPassBoxType as InventoryItem['pullPassBoxType'] : undefined,
    openedAt: data.openedAt == null ? undefined : normalizeTimestamp(data.openedAt, 0),
    freeShipping: data.freeShipping === true,
    shippingCostOverrideCoins: data.shippingCostOverrideCoins == null ? undefined : Number(data.shippingCostOverrideCoins),
    shippingCostOverrideCents: data.shippingCostOverrideCents == null ? undefined : Number(data.shippingCostOverrideCents)
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
    shippingBatchId: typeof data.shippingBatchId === 'string' ? data.shippingBatchId : undefined,
    shippingBatchCost: Number(data.shippingBatchCost ?? 0),
    shippingBatchCostCents: Number(data.shippingBatchCostCents ?? 0),
    shippingBatchValueCoins: Number(data.shippingBatchValueCoins ?? 0),
    shippingRateTier: typeof data.shippingRateTier === 'string' ? data.shippingRateTier : undefined,
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
  const sanitized = filterSafeUserProfileFields(sanitizeDeep(payload));
  await setDoc(userRef, { ...sanitized, updatedAt: Date.now(), lastLogin: Date.now() }, { merge: true });
};

export const GameProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showTopUpModal, setShowTopUpModal] = useState(false);
  const [topUpModalIntent, setTopUpModalIntent] = useState<TopUpModalIntent | null>(null);
  const [authModalMode, setAuthModalMode] = useState<AuthModalMode>('login');
  const [showEmailVerificationModal, setShowEmailVerificationModal] = useState(false);
  const [showEmailVerifiedModal, setShowEmailVerifiedModal] = useState(false);
  const [emailVerificationStatus, setEmailVerificationStatus] = useState<EmailVerificationStatus>('idle');
  const [authInitialized, setAuthInitialized] = useState(false);
  const hasInventorySubcollectionRef = useRef(false);
  const pendingSoldIdsRef = useRef<Set<string>>(new Set());
  const pendingBalanceRef = useRef<number | null>(null);
  const activeUserIdRef = useRef<string | null>(null);
  const emailVerificationDismissedRef = useRef(false);
  const userUnsubscribeRef = useRef<(() => void) | null>(null);
  const inventoryUnsubscribeRef = useRef<(() => void) | null>(null);
  const notificationsUnsubscribeRef = useRef<(() => void) | null>(null);
  const authStateEventRef = useRef(0);
  const legacyProfileBackfillInFlightRef = useRef<Set<string>>(new Set());
  const syncAdminClaim = async (firebaseUser: FirebaseUser | null) => {
    if (!firebaseUser) {
      setUser((prev) => ({ ...prev, isAdmin: false }));
      return false;
    }

    try {
      const tokenResult = await getIdTokenResult(firebaseUser);
      const isAdmin = tokenResult.claims.admin === true;
      setUser((prev) => ({ ...prev, isAdmin }));
      setUsers((prev) => prev.map((entry) => entry.id === firebaseUser.uid ? { ...entry, isAdmin } : entry));
      return isAdmin;
    } catch (error) {
      console.error('Failed to resolve admin custom claim from Firebase Auth', {
        uid: firebaseUser.uid,
        code: (error as { code?: string })?.code,
        message: (error as { message?: string })?.message,
        error
      });
      setUser((prev) => ({ ...prev, isAdmin: false }));
      return false;
    }
  };

  // -- PERSISTENT STATE INITIALIZATION --

  // 1. Initialize User State
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [user, setUser] = useState<User>(AUTH_LOADING_USER);
  const [users, setUsers] = useState<User[]>([]);
  const [adminDirectoryUsers, setAdminDirectoryUsers] = useState<AdminDirectoryUserRecord[]>([]);
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
      const baseNextPath = getPathFromView(nextView);
      const nextPath =
        nextView.type === 'BOXES' && window.location.pathname === '/boxes' && window.location.search
          ? `/boxes${window.location.search}`
          : baseNextPath;
      const currentPath = `${window.location.pathname}${window.location.search}`;
      if (nextPath !== currentPath) {
        window.history.pushState({}, '', nextPath);
      }
    }
  };


  useEffect(() => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    const referralCode = normalizeReferralCode(url.searchParams.get('ref') ?? url.searchParams.get('code'));
    if (referralCode) {
      setStoredReferralCode(referralCode);
    }

    if (url.pathname === '/join') {
      const nextPath = referralCode ? `/?ref=${encodeURIComponent(referralCode)}` : '/';
      window.history.replaceState({}, '', nextPath);
      setViewState(getViewFromLocation('/', url.search));
    }
  }, []);

  const openAuthModal = (mode: AuthModalMode = 'login') => {
    if (mode === 'register') {
      setPostSignupRedirect(DEFAULT_POST_SIGNUP_REDIRECT);
      trackEvent('signup_cta_clicked', { entrypoint: 'auth_modal' });
    }
    setAuthModalMode(mode);
    setShowLoginModal(true);
  };

  useEffect(() => {
    if (!showTopUpModal) {
      setTopUpModalIntent(null);
    }
  }, [showTopUpModal]);

  const resolveEmailRedirect = (targetPath?: string | null) => {
    if (typeof window === 'undefined') return;
    const resolvedPath = targetPath || consumePostSignupRedirect() || DEFAULT_POST_SIGNUP_REDIRECT;
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
    if (notificationsUnsubscribeRef.current) {
      notificationsUnsubscribeRef.current();
      notificationsUnsubscribeRef.current = null;
    }
  };

  const resetAuthenticatedState = (options?: { resetView?: boolean }) => {
    setIsAuthenticated(false);
    setUser(GUEST_USER);
    setBalance(0);
    setInventory([]);
    setNotifications([]);
    hasInventorySubcollectionRef.current = false;
    pendingBalanceRef.current = null;
    pendingSoldIdsRef.current.clear();
    activityStore.setScope('guest');
    if (options?.resetView) {
      setView({ type: 'HOME' });
    }
  };

  const subscribeToInventory = useCallback((uid: string) => {
    if (inventoryUnsubscribeRef.current) return;
    if (!isRealFirebaseUid(uid)) {
      console.log('SKIPPING INVENTORY SUBSCRIPTION FOR PLACEHOLDER USER', uid);
      return;
    }

    const inventoryPath = `users/${uid}/inventory?limit=200`;
    console.log('READING FIRESTORE PATH', inventoryPath);
    const inventoryRef = query(collection(db, 'users', uid, 'inventory'), orderBy('obtainedAt', 'desc'), limit(200));
    inventoryUnsubscribeRef.current = onSnapshot(inventoryRef, (snapshot) => {
      if (activeUserIdRef.current !== uid) return;
      console.log('SNAPSHOT OK', {
        path: inventoryPath,
        size: snapshot.size
      });
      hasInventorySubcollectionRef.current = snapshot.size > 0;
      const pendingIds = pendingSoldIdsRef.current;
      const loaded = snapshot.docs
        .map(mapInventoryDoc)
        .filter((item) => !pendingIds.has(item.instanceId))
        .sort((a, b) => b.obtainedAt - a.obtainedAt);
      setInventory(loaded);
      setUser((prev) => ({ ...prev, topPulls: rankTopPullsByValue(loaded) }));
    }, (error) => {
      console.error('SNAPSHOT FAILED', {
        path: inventoryPath,
        code: error?.code,
        message: error?.message,
        error
      });
    });
  }, []);

  const subscribeToNotifications = useCallback((uid: string) => {
    if (notificationsUnsubscribeRef.current) return;

    const notificationsPath = `users/${uid}/notifications?limit=50`;
    console.log('READING FIRESTORE PATH', notificationsPath);
    const notificationsRef = query(collection(db, 'users', uid, 'notifications'), orderBy('createdAt', 'desc'), limit(50));
    notificationsUnsubscribeRef.current = onSnapshot(notificationsRef, (snapshot) => {
      if (activeUserIdRef.current !== uid) return;
      console.log('SNAPSHOT OK', {
        path: notificationsPath,
        size: snapshot.size
      });
      const loaded = snapshot.docs.map((docSnap) => {
        const data = docSnap.data() as Record<string, any>;
        const type = data.type === 'shipping' ? 'shipping' : 'admin';
        return {
          id: docSnap.id,
          message: String(data.message ?? data.body ?? data.title ?? 'Notification'),
          createdAt: normalizeTimestamp(data.createdAt, Date.now()),
          type
        } as AppNotification;
      });
      setNotifications(loaded);
    }, (error) => {
      console.error('SNAPSHOT FAILED', {
        path: notificationsPath,
        code: error?.code,
        message: error?.message,
        error
      });
    });
  }, []);

  // Realtime inventory stays attached for the authenticated user's session so the
  // navbar, profile, inventory, and balance-adjacent UI all update without refresh.
  const refreshInventory = useCallback(async (uid: string, options?: { limitCount?: number }) => {
    if (!isRealFirebaseUid(uid)) {
      console.log('SKIPPING INVENTORY REFRESH FOR PLACEHOLDER USER', uid);
      return;
    }
    const cappedLimit = Math.max(10, Math.min(200, Number(options?.limitCount ?? 120)));
    const inventoryPath = `users/${uid}/inventory?limit=${cappedLimit}`;
    console.log('READING FIRESTORE PATH', inventoryPath);
    const inventoryRef = query(collection(db, 'users', uid, 'inventory'), orderBy('obtainedAt', 'desc'), limit(cappedLimit));
    const snapshot = await getDocs(inventoryRef);
    if (activeUserIdRef.current !== uid) return;
    hasInventorySubcollectionRef.current = snapshot.size > 0;
    const loaded = snapshot.docs.map(mapInventoryDoc).sort((a, b) => b.obtainedAt - a.obtainedAt);
    const pendingIds = pendingSoldIdsRef.current;
    const filtered = loaded.filter((item) => !pendingIds.has(item.instanceId));
    setInventory(filtered);
    setUser((prev) => ({ ...prev, topPulls: rankTopPullsByValue(filtered) }));
  }, []);

  const startAuthenticatedSession = (firebaseUser: FirebaseUser) => {
    setShowLoginModal(false);
    const uid = firebaseUser.uid;
    const isSameUser = activeUserIdRef.current === uid;

    if (isSameUser && userUnsubscribeRef.current) {
      setIsAuthenticated(true);
      subscribeToInventory(uid);
      subscribeToNotifications(uid);
      return;
    }

    if (!isSameUser) {
      clearUserSubscriptions();
      setInventory([]);
      setNotifications([]);
      hasInventorySubcollectionRef.current = false;
      pendingBalanceRef.current = null;
      pendingSoldIdsRef.current.clear();
      activeUserIdRef.current = uid;
    }

    setIsAuthenticated(true);
    void syncAdminClaim(firebaseUser);

    const userPath = `users/${uid}`;
    console.log('READING FIRESTORE PATH', userPath);
    const userRef = getUserRef(uid);
    userUnsubscribeRef.current = onSnapshot(userRef, (snapshot) => {
      if (activeUserIdRef.current !== uid) return;
      console.log('SNAPSHOT OK', {
        path: userPath,
        size: 'size' in snapshot ? snapshot.size : undefined
      });
      if (!snapshot.exists()) {
        const profile = buildUserProfile(firebaseUser);
        setUser((prev) => ({ ...prev, ...profile, isAdmin: prev.isAdmin }));
        setBalance(0);
        return;
      }

      const data = snapshot.data();
      const legacyProfileBackfill = buildLegacyUserProfileBackfill(firebaseUser, data);
      if (Object.keys(legacyProfileBackfill).length > 0 && !legacyProfileBackfillInFlightRef.current.has(uid)) {
        legacyProfileBackfillInFlightRef.current.add(uid);
        void authedFetch<{ ok: boolean; patched?: boolean }>('/api/backfill-user-profile', {
          method: 'POST',
          body: JSON.stringify({})
        })
          .catch((error) => {
            console.error('Failed to backfill legacy user profile fields', error);
          })
          .finally(() => {
            legacyProfileBackfillInFlightRef.current.delete(uid);
          });
      }
      const profile = buildUserProfile(firebaseUser, data);

      const purchasedCoins = Math.max(0, Number((data as any).purchasedCoins ?? (data as any).coins ?? profile.balance ?? 0));
      const promoCoins = Math.max(0, Number((data as any).balance ?? profile.balance ?? 0) - purchasedCoins);
      const incomingBalance = purchasedCoins + promoCoins;
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
        isAdmin: prev.isAdmin,
        balance: resolvedBalance,
        purchasedCoins,
        promoCoins,
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
      console.error('SNAPSHOT FAILED', {
        path: userPath,
        code: error?.code,
        message: error?.message,
        error
      });
    });

    subscribeToInventory(uid);
    subscribeToNotifications(uid);
  };

  const checkEmailVerificationStatus = async (firebaseUser?: FirebaseUser | null) => {
    if (!hasPendingEmailVerification()) {
      emailVerificationDismissedRef.current = false;
      setEmailVerificationStatus('idle');
      setShowEmailVerificationModal(false);
      setShowEmailVerifiedModal(false);
      return;
    }

    if (!firebaseUser) {
      if (hasEmailVerificationCompleted()) {
        setEmailVerificationStatus('verified-no-session');
        setShowEmailVerificationModal(false);
        setShowEmailVerifiedModal(false);
        if (typeof window !== 'undefined') {
          window.sessionStorage.setItem(AUTH_INLINE_MESSAGE_KEY, 'Email verified. Sign in to continue.');
        }
        setAuthModalMode('login');
        setShowLoginModal(true);
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
      emailVerificationDismissedRef.current = false;
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
      trackEvent('email_verification_completed');
      clearPendingEmailVerification();
      emailVerificationDismissedRef.current = false;
      setEmailVerificationStatus('idle');
      setShowEmailVerificationModal(false);
      setShowEmailVerifiedModal(false);
      resolveEmailRedirect(getPendingEmailRedirect());
      if (firebaseUser) {
        void syncAdminClaim(firebaseUser);
      startAuthenticatedSession(firebaseUser);
      }
      return;
    }

    setEmailVerificationStatus('pending');
    setShowEmailVerificationModal(false);
    setShowEmailVerifiedModal(false);
  };

  const handleEmailVerificationLink = async () => {
    if (typeof window === 'undefined') return;
    if (window.location.pathname === '/verify') return;
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
      await checkEmailVerificationStatus(auth.currentUser);
    }
  };

  // Initialize Items
  const [items, setItems] = useState<CaseItem[]>(() => CASE_ITEMS);

  const [bonusSettings, setBonusSettings] = useState<BonusSettings>(() => getStoredBonusSettings());


  useEffect(() => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    const customToken = url.searchParams.get('customToken');
    if (!customToken) return;

    console.log('Custom token detected');
    void (async () => {
      try {
        await signInWithCustomToken(auth, customToken);
        console.log('Custom token sign-in success');
        url.searchParams.delete('customToken');
        window.history.replaceState({}, '', `${url.pathname}${url.search}`);
        setShowLoginModal(false);
        const redirectPath = consumePostSignupRedirect() || DEFAULT_POST_SIGNUP_REDIRECT;
        resolveEmailRedirect(redirectPath);
      } catch (error) {
        console.error('Custom token sign-in failed', error);
      }
    })();
  }, []);

  useEffect(() => {
    const bonusSettingsPath = `settings/${BONUS_SETTINGS_DOC}`;
    console.log('READING FIRESTORE PATH', bonusSettingsPath);
    const bonusSettingsRef = doc(db, 'settings', BONUS_SETTINGS_DOC);
    const unsubscribe = onSnapshot(bonusSettingsRef, (snapshot) => {
      console.log('SNAPSHOT OK', {
        path: bonusSettingsPath,
        size: 'size' in snapshot ? snapshot.size : undefined
      });
      if (!snapshot.exists()) return;
      const normalized = normalizeBonusSettings(snapshot.data() as Partial<BonusSettings>);
      setBonusSettings(normalized);
    }, (error) => {
      console.error('SNAPSHOT FAILED', {
        path: bonusSettingsPath,
        code: error?.code,
        message: error?.message,
        error
      });
    });

    return () => unsubscribe();
  }, []);

  const [stripeSettings, setStripeSettings] = useState<StripeSettings>(() => DEFAULT_STRIPE_SETTINGS);

  useEffect(() => {
    const stripeSettingsPath = `settings/${STRIPE_SETTINGS_DOC}`;
    console.log('READING FIRESTORE PATH', stripeSettingsPath);
    const stripeSettingsRef = doc(db, 'settings', STRIPE_SETTINGS_DOC);
    const unsubscribe = onSnapshot(stripeSettingsRef, (snapshot) => {
      console.log('SNAPSHOT OK', {
        path: stripeSettingsPath,
        size: 'size' in snapshot ? snapshot.size : undefined
      });
      const data = snapshot.data() ?? {};
      setStripeSettings(normalizeStripeSettings(data));
    }, (error) => {
      console.error('SNAPSHOT FAILED', {
        path: stripeSettingsPath,
        code: error?.code,
        message: error?.message,
        error
      });
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
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      const authEventId = authStateEventRef.current + 1;
      authStateEventRef.current = authEventId;
      console.log('Auth state fired:', firebaseUser?.uid);
      const isCurrentAuthEvent = () => authStateEventRef.current === authEventId;
      const isPasswordProvider = firebaseUser?.providerData.some((provider) => provider.providerId === 'password') ?? false;
      const requiresVerification = Boolean(firebaseUser && isPasswordProvider && !firebaseUser.emailVerified);
      if (requiresVerification && !hasPendingEmailVerification()) {
        setPendingEmailVerification(consumePostSignupRedirect() || getCurrentPath() || DEFAULT_POST_SIGNUP_REDIRECT);
      }

      void checkEmailVerificationStatus(firebaseUser);

      if (!firebaseUser) {
        console.log('No user');
        clearUserSubscriptions();
        activeUserIdRef.current = null;
        resetAuthenticatedState();
        if (isCurrentAuthEvent()) setAuthInitialized(true);
        return;
      }

      try {
        await firebaseUser.getIdToken();
        if (!isCurrentAuthEvent() || auth.currentUser?.uid !== firebaseUser.uid) return;
        startAuthenticatedSession(firebaseUser);
        console.log('User fully authenticated:', firebaseUser.uid);
      } finally {
        if (isCurrentAuthEvent()) setAuthInitialized(true);
      }
    });

    return () => {
      authStateEventRef.current += 1;
      unsubscribe();
      clearUserSubscriptions();
      activeUserIdRef.current = null;
    };
  }, [subscribeToInventory, subscribeToNotifications]);

  useEffect(() => {
    void checkEmailVerificationStatus(auth.currentUser);
  }, []);

  useEffect(() => {
    void handleEmailVerificationLink();
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      setAdminDirectoryUsers([]);
      setUsers([]);
      return;
    }

    if (!user.isAdmin) {
      setAdminDirectoryUsers([]);
      setUsers([user]);
      return;
    }

    void (async () => {
      try {
        const usersPath = 'users?limit=250';
        console.log('READING FIRESTORE PATH', usersPath);
        const snapshot = await getDocs(query(collection(db, 'users'), orderBy('createdAt', 'desc'), limit(250)));
        const loaded = snapshot.docs.map((docSnap) => buildUserProfileFromDoc(docSnap.id, docSnap.data()));
        setUsers(mergeAdminUsers(loaded, adminDirectoryUsers, user));
      } catch (error) {
        console.error('Failed to load admin users', error);
        setUsers(mergeAdminUsers([], adminDirectoryUsers, user));
      }
    })();
  }, [adminDirectoryUsers, isAuthenticated, user]);

  useEffect(() => {
    if (!isAuthenticated || !user.isAdmin) return;

    let cancelled = false;

    const loadAdminDirectoryUsers = async () => {
      try {
        const response = await authedFetch<{ users?: AdminDirectoryUserRecord[] }>('/api/admin/users');
        if (!cancelled) {
          setAdminDirectoryUsers(Array.isArray(response.users) ? response.users : []);
        }
      } catch (error) {
        console.error('Failed to load admin user directory', error);
        if (!cancelled) {
          setAdminDirectoryUsers([]);
        }
      }
    };

    void loadAdminDirectoryUsers();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, user.isAdmin]);

  useEffect(() => {
    if (!isAuthenticated) {
      setUsers([]);
      return;
    }

    if (!user.isAdmin) {
      setUsers([user]);
      return;
    }

    setUsers((current) => mergeAdminUsers(current, adminDirectoryUsers, user));
  }, [adminDirectoryUsers, isAuthenticated, user]);

  useEffect(() => {
    if (!isAuthenticated) {
      setShipments([]);
      return;
    }

    void (async () => {
      try {
        const shipmentsPath = user.isAdmin ? 'shipments?limit=200' : `shipments?uid=${user.id}&limit=100`;
        console.log('READING FIRESTORE PATH', shipmentsPath);
        const shipmentsQuery = user.isAdmin
          ? query(collection(db, 'shipments'), orderBy('createdAt', 'desc'), limit(200))
          : query(collection(db, 'shipments'), where('uid', '==', user.id), limit(100));
        const snapshot = await getDocs(shipmentsQuery);
        const loaded = snapshot.docs
          .map(mapShipmentDoc)
          .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
        setShipments(loaded);
      } catch (error) {
        console.error('Failed to load shipments', error);
        setShipments([]);
      }
    })();
  }, [isAuthenticated, user.id, user.isAdmin]);

  useEffect(() => {
    if (!isAuthenticated) return;

    const latestUser = users.find((entry) => entry.id === user.id);
    if (!latestUser) return;

    const needsCreatedAtUpdate = !user.createdAt && !!latestUser.createdAt;
    const nextTopPullsPublic = latestUser.topPullsPublic ?? false;
    const needsTopPullsPublicUpdate = nextTopPullsPublic !== (user.topPullsPublic ?? false);
    if (!needsCreatedAtUpdate && !needsTopPullsPublicUpdate) return;

    const updates: Partial<User> = {};
    if (needsCreatedAtUpdate) updates.createdAt = latestUser.createdAt;
    if (needsTopPullsPublicUpdate) updates.topPullsPublic = nextTopPullsPublic;

    setUser((prev) => ({ ...prev, ...updates }));
  }, [users, isAuthenticated, user.id, user.createdAt, user.topPullsPublic]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    let cancelled = false;
    const loadItems = () => {
      if (cancelled) return;
      void (async () => {
      try {
        const itemsPath = 'items?limit=500';
        console.log('READING FIRESTORE PATH', itemsPath);
        const snapshot = await getDocs(query(collection(db, 'items'), limit(500)));
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
            redeemable: data.redeemable ?? true,
            forceFullSellBack: data.forceFullSellBack === true,
            upgraderEnabled: data.upgraderEnabled === true,
            upgraderCategory: ['tech', 'collectible', 'apparel'].includes(String(data.upgraderCategory ?? ''))
              ? (String(data.upgraderCategory) as CaseItem['upgraderCategory'])
              : '',
            upgraderSort: Number.isFinite(Number(data.upgraderSort)) ? Number(data.upgraderSort) : undefined,
            upgraderFeatured: data.upgraderFeatured === true,
            valueUsd: data.valueUsd !== undefined ? Number(data.valueUsd) : undefined,
            valueCoins: data.valueCoins !== undefined ? Number(data.valueCoins) : Number(data.price ?? 0),
            sellBackCoins: data.sellBackCoins !== undefined ? Number(data.sellBackCoins) : undefined,
            marketPricing: data.marketPricing
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
      } catch (error) {
        console.error('Failed to load items', error);
      }
      })();
    };
    const idleId = 'requestIdleCallback' in window
      ? window.requestIdleCallback(loadItems, { timeout: 2500 })
      : window.setTimeout(loadItems, 1200);
    return () => {
      cancelled = true;
      if ('cancelIdleCallback' in window && typeof idleId === 'number') window.cancelIdleCallback(idleId);
      else window.clearTimeout(idleId as number);
    };
  }, []);

  const expiredUserBoxDeletesRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (typeof window === 'undefined') return;
    let cancelled = false;
    const loadBoxes = () => {
      if (cancelled) return;
      void (async () => {
      try {
        const boxesPath = 'boxes?limit=250';
        console.log('READING FIRESTORE PATH', boxesPath);
        const snapshot = await getDocs(query(collection(db, 'boxes'), limit(250)));
        if (cancelled) return;
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
              redeemable: item.redeemable ?? true,
              forceFullSellBack: item.forceFullSellBack === true,
              valueUsd: item.valueUsd !== undefined ? Number(item.valueUsd) : undefined,
              valueCoins: item.valueCoins !== undefined ? Number(item.valueCoins) : price,
              sellBackCoins: item.sellBackCoins !== undefined ? Number(item.sellBackCoins) : undefined,
              marketPricing: user.isAdmin ? item.marketPricing : undefined
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
            priceXP: data.priceXP != null ? Number(data.priceXP) : undefined,
            currencyType: getBoxCurrencyType({
              currencyType: data.currencyType,
              priceXP: data.priceXP,
              price: data.price
            }),
            image: data.image ?? 'https://picsum.photos/300',
            spinnerBackgroundImage:
              typeof data.spinnerBackgroundImage === 'string' ? data.spinnerBackgroundImage : undefined,
            accentColor: data.accentColor ?? '#3b82f6',
            tag: data.tag as MysteryBox['tag'],
            tags: Array.isArray(data.tags) ? (data.tags as MysteryBox['tags']) : undefined,
            isDaily: data.isDaily ?? false,
            isPullPassBox: data.isPullPassBox === true,
            pullPassBoxType: typeof data.pullPassBoxType === 'string' ? data.pullPassBoxType as MysteryBox['pullPassBoxType'] : undefined,
            targetEV: data.targetEV !== undefined ? Number(data.targetEV) : undefined,
            riskLevel: data.riskLevel !== undefined ? Number(data.riskLevel) : undefined,
            items,
            isUserCreated: data.isUserCreated ?? false,
            sellBackRate: data.sellBackRate !== undefined ? Number(data.sellBackRate) : undefined,
            marketValueAudit: user.isAdmin ? data.marketValueAudit : undefined,
            createdAt
          } as MysteryBox;
        })
        .filter((box) => !box.isUserCreated || (box.createdAt && Date.now() - box.createdAt < USER_BOX_EXPIRY_MS))
        .sort((a, b) => getBoxSortPrice(a) - getBoxSortPrice(b));

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
          return [...pendingUserCreated, ...firebaseBoxes].sort((a, b) => getBoxSortPrice(a) - getBoxSortPrice(b));
        });
      } catch (error) {
        if (!cancelled) console.error('Failed to load boxes', error);
      }
      })();
    };
    const idleId = 'requestIdleCallback' in window
      ? window.requestIdleCallback(loadBoxes, { timeout: 1600 })
      : window.setTimeout(loadBoxes, 700);
    return () => {
      cancelled = true;
      if ('cancelIdleCallback' in window && typeof idleId === 'number') window.cancelIdleCallback(idleId);
      else window.clearTimeout(idleId as number);
    };
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
    if (!showTopUpModal) return;
    void (async () => {
      try {
        const coinPackagesPath = 'coin_packages?limit=50';
        console.log('READING FIRESTORE PATH', coinPackagesPath);
        const snapshot = await getDocs(query(collection(db, 'coin_packages'), orderBy('sortOrder', 'asc'), limit(50)));
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
          defaultSelected: Boolean(data.defaultSelected),
          firstTimeDepositOnly: Boolean(data.firstTimeDepositOnly),
          imageUrl: typeof data.imageUrl === 'string' ? data.imageUrl : '',
          displayPrice: data.displayPrice ?? '',
          stripePriceId: data.stripePriceId ?? '',
          badge: typeof data.badge === 'string' ? data.badge : undefined,
          active: data.active ?? false,
          sortOrder: Number(data.sortOrder ?? 0),
          createdAt: normalizeTimestamp(data.createdAt, 0),
          updatedAt: normalizeTimestamp(data.updatedAt, 0)
        } as CoinPackage;
        });
        setCoinPackages(loaded);
      } catch (error) {
        console.error('Failed to load coin packages', error);
      }
    })();
  }, [showTopUpModal]);

  useEffect(() => {
    activityStore.setScope(isAuthenticated && user.id ? user.id : 'guest');
  }, [isAuthenticated, user.id]);

  useEffect(() => {
    if (!isAuthenticated || !auth.currentUser) return;
    if (view.type !== 'INVENTORY' && view.type !== 'PROFILE') return;
    void refreshInventory(auth.currentUser.uid).catch((error) => {
      console.error('Failed to load inventory for inventory/profile view', error);
    });
  }, [isAuthenticated, refreshInventory, view.type]);


  // Cost-control: the battle list is fetched in a bounded one-time query.
  // Realtime is kept in BattleArena for a single active battle view.
  useEffect(() => {
    if (view.type !== 'BATTLES' && view.type !== 'BATTLE_ARENA') return;
    void (async () => {
      try {
        const battlesPath = 'battles?limit=50';
        console.log('READING FIRESTORE PATH', battlesPath);
        const snapshot = await getDocs(query(collection(db, 'battles'), orderBy('createdAt', 'desc'), limit(50)));
        const firebaseBattles = snapshot.docs
        .map((docSnap) => {
          const data = docSnap.data();
          const createdAt = data.createdAt?.toMillis
            ? data.createdAt.toMillis()
            : Number(data.createdAt ?? Date.now());
          const players = Array.isArray(data.players) ? data.players : [];
          const state = String(data.state ?? 'LOBBY');
          const status = state === 'COMPLETE' ? 'finished' : state === 'RUNNING' || state === 'FINISHING' ? 'active' : 'waiting';

          return {
            id: docSnap.id,
            mode: data.mode === 'CRAZY' ? 'Inverse' : 'Normal',
            players: players.map((player: any) => ({
              id: player.uid,
              name: player.displayName || 'Player',
              avatar: player.avatar || `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(player.uid || 'player')}`,
              level: 1,
              xp: 0,
              totalWin: Number(data.totalsByUid?.[player.uid] ?? 0)
            })),
            playerCount: players.length,
            maxPlayers: Number(data.maxPlayers ?? 2),
            cost: Number(data.entryCostCoins ?? 0),
            cases: Array.isArray(data.cases)
              ? data.cases.map((entry: any) => {
                  const box = boxes.find((candidate) => candidate.id === entry.caseId);
                  return box || { id: entry.caseId, name: entry.caseId, image: '', price: 0, accentColor: '#6b7280', items: [] };
                })
              : [],
            rounds: Number(data.roundCount ?? 0),
            currentRound: 0,
            status,
            history: [],
            createdAt,
            rewardsDistributed: state === 'COMPLETE',
            botsAdded: false
          } as Battle;
        });

        setBattles(firebaseBattles);
      } catch (error) {
        console.error('Failed to load battles list', error);
      }
    })();
  }, [boxes, view.type]);

  // --- ACTIONS ---

  const updateBonusSettings = (settings: BonusSettings) => {
    const normalized = normalizeBonusSettings(settings);
    const payload = {
      ...normalized,
      xpPer100Coins: normalized.xpPer100CoinsWagered,
      xpPerCaseOpen: normalized.xpPerCaseOpened
    };

    setBonusSettings(payload);
    const bonusSettingsRef = doc(db, 'settings', BONUS_SETTINGS_DOC);
    void setDoc(bonusSettingsRef, payload, { merge: true }).catch((error) => {
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


  const tryApplyPendingReferralAttribution = async () => {
    const pendingReferralCode = getStoredReferralCode();
    if (!pendingReferralCode) return;
    try {
      await authedFetch<{ ok: boolean; applied?: boolean }>('/api/referrals/attribution', {
        method: 'POST',
        body: JSON.stringify({ referralCode: pendingReferralCode })
      });
      setStoredReferralCode('');
    } catch (referralError) {
      console.error('Failed to apply pending referral attribution', referralError);
    }
  };

  const shouldTrackRegistrationForUser = (uid: string): boolean => {
    if (typeof window === 'undefined') {
      return true;
    }

    const globalRegistrationTracker = ((window as any).__registrationTracked ??= {} as Record<string, boolean>);
    if (globalRegistrationTracker[uid]) {
      return false;
    }

    globalRegistrationTracker[uid] = true;
    return true;
  };

  const trackCompleteRegistrationForNewUser = (firebaseUser: FirebaseUser) => {
    if (!shouldTrackRegistrationForUser(firebaseUser.uid)) {
      return;
    }

    const registrationData: Record<string, unknown> = {
      content_name: 'Account Registration',
      status: true,
      external_id: firebaseUser.uid
    };

    if (firebaseUser.email) {
      registrationData.em = firebaseUser.email;
    }

    console.log('[Meta] fbq available:', typeof window !== 'undefined' ? typeof (window as any).fbq : 'no-window');
    console.log('[Meta] CompleteRegistration payload:', registrationData);
    trackMetaEvent('CompleteRegistration', registrationData, {
      eventID: `complete_registration_${firebaseUser.uid}`
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
      const avatar = photoURL || '';
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
        xpBalance: 0,
        lastDailyClaim: undefined,
        lastFreeBoxClaim: undefined,
        totalSpent: 0,
        totalDepositedCents: 0,
        depositCount: 0,
        lastDepositAt: undefined,
        rakebackBalance: 0,
        rakebackEarnedToday: 0,
        rakebackEarnedAt: getDayStart(),
        rakebackUnlocked: false,
        rakebackPercent: undefined,
        rakebackTier: null,
        followers: [],
        shippingAddress: undefined,
        isAdmin: false,
        termsFlagged: false
      };

      await setDoc(userRef, buildUserDocument(newUser), { merge: true });
      await tryApplyPendingReferralAttribution();
      try {
        trackCompleteRegistrationForNewUser(firebaseUser);
      } catch (err) {
        console.warn('Meta Google registration tracking failed', err);
      }
      return;
    }

    const data = userSnapshot.data() as Record<string, any>;
    const updates: Record<string, unknown> = buildLegacyUserProfileBackfill(firebaseUser, data);

    if (!data.email && email) updates.email = email;
    if (!data.displayName && displayName) updates.displayName = displayName;
    if (!data.photoURL && photoURL) updates.photoURL = photoURL;

    if (Object.keys(updates).length > 0) {
      await setDoc(userRef, filterSafeUserProfileFields(updates), { merge: true });
    }
  };

  const sendCustomVerificationEmail = async (firebaseUser: FirebaseUser) => {
    if (!firebaseUser.email) {
      throw new Error('No email address is available for this account.');
    }

    const token = await firebaseUser.getIdToken();
    const response = await fetch('/api/send-verification-email', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      const errorCode = payload?.error;
      if (errorCode === 'EMAIL_ALREADY_VERIFIED') {
        throw new Error('Your email is already verified. Please refresh this page.');
      }
      if (errorCode === 'EMAIL_SEND_FAILED') {
        throw new Error('We could not send the verification email right now. Please try again in a moment.');
      }
      if (errorCode === 'EMAIL_CONFIG_INVALID') {
        throw new Error('Email delivery is temporarily unavailable. Please contact support if this continues.');
      }
      if (errorCode === 'UNAUTHENTICATED') {
        throw new Error('Please sign in again to continue.');
      }

      throw new Error(payload?.message || 'Unable to send verification email right now.');
    }

    return payload;
  };

  const resendEmailVerification = async () => {
    if (!auth.currentUser) {
      throw new Error('Please sign in to resend the verification email.');
    }
    await sendCustomVerificationEmail(auth.currentUser);
  };

  const refreshEmailVerification = async () => {
    await checkEmailVerificationStatus(auth.currentUser);
  };

  const dismissEmailVerificationModal = async () => {
    emailVerificationDismissedRef.current = true;
    setShowEmailVerificationModal(false);
  };

  const login = async (email: string, pass: string, remember: boolean = true) => {
      await setPersistence(
        auth,
        remember ? browserLocalPersistence : browserSessionPersistence
      );
      const credential = await signInWithEmailAndPassword(auth, email, pass);
      if (!credential.user.emailVerified) {
        const redirectPath = consumePostSignupRedirect() || getCurrentPath() || DEFAULT_POST_SIGNUP_REDIRECT;
        setPendingEmailVerification(redirectPath);
        setEmailVerificationStatus('pending');
      }
      setShowLoginModal(false);
  };

  const googleAuthInProgressRef = useRef(false);

  const loginWithGoogle = async (options: GoogleAuthOptions = {}): Promise<GoogleAuthResult> => {
    const { remember = true } = options;
    if (googleAuthInProgressRef.current) {
      return { status: 'error', message: 'Google sign-in is already in progress.' };
    }
    googleAuthInProgressRef.current = true;

    try {
      await setPersistence(
        auth,
        remember ? browserLocalPersistence : browserSessionPersistence
      );
      trackEvent('google_oauth_started');
      console.log('Google server auth start');
      if (typeof window !== 'undefined') {
        window.location.href = '/api/auth/google/start';
      }
      return { status: 'redirect-started' };
    } catch (error: any) {
      console.error('Google popup error:', error);
      console.error('Firebase Google auth error', { code: error?.code, message: error?.message, error });
      const errorCode = error?.code;
      if (errorCode === 'auth/popup-blocked' || errorCode === 'auth/operation-not-supported-in-this-environment') {
        return { status: 'error', message: 'Your browser blocked Google sign-in. Open Pullz in Safari or Chrome and try again.' };
      }
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

        trackEvent('google_oauth_error', { code: errorCode });
        return {
          status: 'error',
          message: 'That email already has an account. Please sign in using the original provider to link Google.'
        };
      }

      trackEvent('google_oauth_error', { code: errorCode || 'unknown' });
      return { status: 'error', message: error?.message || 'Google sign-in failed.' };
    } finally {
      googleAuthInProgressRef.current = false;
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
      trackEvent('email_signup_completed');

      try {
        trackCompleteRegistrationForNewUser(credential.user);
        console.log('[Meta] CompleteRegistration fired for uid:', credential.user.uid);
      } catch (err) {
        console.warn('Meta registration tracking failed', err);
      }

      const redirectPath = consumePostSignupRedirect() || getCurrentPath() || DEFAULT_POST_SIGNUP_REDIRECT;
      setPendingEmailVerification(redirectPath);
      try {
        await sendCustomVerificationEmail(credential.user);
      } catch (err) {
        console.error('Verification email failed after account creation', err);
      }
      const createdAt = Date.now();
      const username = await reserveUniqueUsername(credential.user.uid, buildBaseUsername(name, email));
      const newUser: User = {
        id: credential.user.uid,
        createdAt,
        name,
        username,
        displayName: name,
        email,
        avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=111827&color=10b981`,
        provider: 'password',
        level: 1,
        xp: 0,
        xpBalance: 0,
        balance: 0,
        lastDailyClaim: undefined,
        lastFreeBoxClaim: undefined,
        totalSpent: 0,
        totalDepositedCents: 0,
        depositCount: 0,
        lastDepositAt: undefined,
        rakebackBalance: 0,
        rakebackEarnedToday: 0,
        rakebackEarnedAt: getDayStart(),
        rakebackUnlocked: false,
        rakebackPercent: undefined,
        rakebackTier: null,
        followers: [],
        shippingAddress: undefined,
        isAdmin: false,
        termsFlagged: false
      };

      await setDoc(doc(db, 'users', newUser.id), buildUserDocument(newUser), { merge: true });

      await tryApplyPendingReferralAttribution();

      setShowLoginModal(false);
      setEmailVerificationStatus('pending');
      emailVerificationDismissedRef.current = false;
      setShowEmailVerificationModal(false);
      return;
    } catch (error: any) {
      if (error?.code === 'auth/email-already-in-use') {
        try {
          await signInWithEmailAndPassword(auth, email, pass);
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

  const logout = async () => {
      authStateEventRef.current += 1;
      await signOut(auth);
      clearUserSubscriptions();
      activeUserIdRef.current = null;
      resetAuthenticatedState({ resetView: true });
      setAuthInitialized(true);
  };

  const isRakebackUnlocked = (profile: User) => profile.rakebackUnlocked === true;

  const getRakebackRatePercent = (profile: User) => {
    if (!isRakebackUnlocked(profile)) return 0;
    if (profile.rakebackPercent != null && Number.isFinite(Number(profile.rakebackPercent))) {
      return Math.max(0, Number(profile.rakebackPercent));
    }
    return Math.max(0, Number(bonusSettings.rakebackBasePercent ?? 0));
  };

  const registerSpend = (amount: number) => {
    if (!isAuthenticated || amount <= 0) return;

    setUser(prev => {
      const totalSpent = Math.max(0, (prev.totalSpent ?? 0) + amount);
      const rakebackRate = getRakebackRatePercent(prev) / 100;
      if (rakebackRate <= 0) {
        return {
          ...prev,
          totalSpent
        };
      }
      const today = getDayStart();
      const earnedAt = Number(prev.rakebackEarnedAt ?? 0);
      const earnedToday = earnedAt === today ? Number(prev.rakebackEarnedToday ?? 0) : 0;
      const capAmount = bonusSettings.rakebackDailyCapCoins;
      const remainingCap = capAmount > 0 ? Math.max(0, capAmount - earnedToday) : Number.POSITIVE_INFINITY;
      const rakebackEarned = Math.min(remainingCap, amount * rakebackRate);
      const rakebackBalance = Math.max(0, (prev.rakebackBalance ?? 0) + rakebackEarned);
      const nextEarnedToday = earnedToday + rakebackEarned;

      persistUserData({
        totalSpent,
        rakebackBalance,
        rakebackEarnedToday: nextEarnedToday,
        rakebackEarnedAt: today
      });

      return {
        ...prev,
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

  const syncXpBalance = (amount: number) => {
    const normalized = Math.max(0, Math.floor(Number(amount) || 0));
    setUser(prev => ({ ...prev, xpBalance: normalized, xp: normalized }));
    setUsers(prev => prev.map(u => u.id === user.id ? { ...u, xpBalance: normalized, xp: normalized } : u));
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
    if (auth.currentUser) {
      void refreshInventory(auth.currentUser.uid).catch((error) => {
        console.error('Failed to revalidate inventory after server item update', error);
      });
    }
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

  const sendAdminNotification = async (message: string) => {
    const trimmed = message.trim();
    if (!trimmed) return;

    addNotification({ message: trimmed, type: 'admin' });

    if (!isAuthenticated || !user.isAdmin) return;

    const broadcastRef = collection(db, 'adminNotifications');
    const usersSnapshot = await getDocs(collection(db, 'users'));
    const userIds = usersSnapshot.docs.map((docSnap) => docSnap.id);

    const title = 'Admin update';
    const body = trimmed.length > 180 ? `${trimmed.slice(0, 177)}...` : trimmed;

    const created = await addDoc(broadcastRef, {
      title,
      body,
      message: trimmed,
      type: 'admin',
      recipientCount: userIds.length,
      createdBy: user.id,
      createdAt: serverTimestamp()
    });

    for (let i = 0; i < userIds.length; i += 400) {
      const batch = writeBatch(db);
      const chunk = userIds.slice(i, i + 400);
      chunk.forEach((uid) => {
        const notificationRef = doc(collection(db, 'users', uid, 'notifications'));
        batch.set(notificationRef, {
          type: 'admin',
          title,
          body,
          createdAt: serverTimestamp(),
          readAt: null,
          seenAt: null,
          broadcastId: created.id
        });
      });
      await batch.commit();
    }
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

      const token = await auth.currentUser.getIdToken();
      const response = await fetch('/api/sell-item', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ inventoryId: instanceId })
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const errorCode = typeof data?.error === 'string' ? data.error : 'SELL_FAILED';
        const message = typeof data?.message === 'string' ? data.message : 'Unable to sell item';
        console.error('Failed to sell item', {
          status: response.status,
          error: errorCode,
          message,
          inventoryId: instanceId
        });
        throw new Error(`${errorCode}: ${message}`);
      }

      const nextCoins = Number(data?.newCoins);
      if (Number.isFinite(nextCoins)) {
        pendingBalanceRef.current = nextCoins;
        syncBalance(nextCoins);
      }
      activityStore.add({
        userId: auth.currentUser?.uid,
        type: 'sell',
        title: `Sold ${itemToSell?.name ?? 'item'}`,
        value: Number(data?.creditCoins ?? 0),
        meta: { inventoryId: instanceId }
      });
      await refreshInventory(auth.currentUser.uid);
      return { creditCoins: Number(data?.creditCoins ?? 0) };
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

      const fallbackMessage = 'Unable to sell item right now. Please try again.';
      const rawMessage = error instanceof Error ? error.message : '';
      const userMessage = rawMessage.includes(':') ? rawMessage.split(':').slice(1).join(':').trim() : rawMessage;
      console.error('Failed to sell item', {
        message: rawMessage || fallbackMessage,
        inventoryId: instanceId
      });
      alert(userMessage || fallbackMessage);
    }
  };

  const shipItem = async (instanceId: string | string[], options?: { shippingProtection?: boolean; signatureRequired?: boolean }) => {
    if (!auth.currentUser) {
      openAuthModal('login');
      return;
    }

    const instanceIds = Array.isArray(instanceId) ? instanceId : [instanceId];
    const uniqueInstanceIds = Array.from(new Set(instanceIds.filter(Boolean)));
    const itemsToShip = inventory.filter((item) => uniqueInstanceIds.includes(item.instanceId));
    if (uniqueInstanceIds.length === 0 || itemsToShip.length !== uniqueInstanceIds.length || !user.shippingAddress) {
      alert('Please add a shipping address before requesting shipment.');
      return;
    }

    try {
      await auth.currentUser.reload();
      if (!auth.currentUser.emailVerified) {
        setPendingEmailVerification(getCurrentPath() || DEFAULT_POST_SIGNUP_REDIRECT);
        setEmailVerificationStatus('pending');
        emailVerificationDismissedRef.current = false;
        return { requiresEmailVerification: true };
      }

      const data = await authedFetch<{ newCoins?: number; shipmentId?: string; shipmentBatchId?: string }>('/api/request-shipment', {
        method: 'POST',
        body: JSON.stringify({
          inventoryIds: uniqueInstanceIds,
          inventoryId: uniqueInstanceIds[0],
          shippingInfo: user.shippingAddress,
          shippingProtection: options?.shippingProtection === true,
          signatureRequired: options?.signatureRequired === true
        })
      });

      const nextCoins = Number(data?.newCoins);
      if (Number.isFinite(nextCoins)) {
        syncBalance(nextCoins);
      }

      const shippedIds = new Set(uniqueInstanceIds);
      setInventory(prev =>
        prev.map(item =>
          shippedIds.has(item.instanceId)
            ? { ...item, status: 'shipping_requested' }
            : item
        )
      );

      const shipmentLabel = itemsToShip.length === 1 ? itemsToShip[0].name : `${itemsToShip.length} items`;
      addNotification({
        message: `${shipmentLabel} ${itemsToShip.length === 1 ? 'is' : 'are'} now shipping to your saved address.`,
        type: 'shipping'
      });
      activityStore.add({
        userId: auth.currentUser?.uid,
        type: 'ship',
        title: `Shipment requested for ${shipmentLabel}`,
        meta: { shipmentId: data.shipmentId ?? data.shipmentBatchId, trackingStatus: 'Processing' }
      });
      const shippedUserId = auth.currentUser.uid;
      void refreshInventory(shippedUserId).catch((refreshError) => {
        console.error('Failed to refresh inventory after shipment request', refreshError);
      });
      return { shipmentId: data.shipmentId, shipmentBatchId: data.shipmentBatchId };
    } catch (error: any) {
      console.error('Failed to request shipment', error);
      if (error?.code === 'EMAIL_VERIFICATION_REQUIRED') {
        setPendingEmailVerification(getCurrentPath() || DEFAULT_POST_SIGNUP_REDIRECT);
        setEmailVerificationStatus('pending');
        emailVerificationDismissedRef.current = false;
        return { requiresEmailVerification: true };
      }
      alert('Unable to request shipment right now. Please try again.');
    }
  };

  const updateAddress = async (address: ShippingAddress) => {
      try {
        await persistUserData({ shippingAddress: address });
        setUser(prev => ({ ...prev, shippingAddress: address }));
        setUsers(prev => prev.map(u => u.id === auth.currentUser?.uid ? { ...u, shippingAddress: address } : u));
      } catch (error) {
        console.error('Failed to save shipping address', error);
        throw error;
      }
  };

  const updateUserInfo = async (name: string, avatar: string) => {
      if (!isAuthenticated || !auth.currentUser) return;

      const trimmedName = name.trim();
      const nextName = trimmedName || user.name || 'Player';
      const nextAvatar = avatar.trim() || user.avatar;
      const nextUsernameLower = clampFirestoreUsernameLower(nextName);

      if (!isValidFirestoreUsernameLower(nextUsernameLower)) {
        throw new Error('Username must be 3-16 characters and use only letters, numbers, or underscores.');
      }

      const currentUsernameLower = toFirestoreUsernameLower(user.username ?? user.name ?? '');
      if (nextUsernameLower !== currentUsernameLower) {
        const usersRef = collection(db, 'users');
        const existingUsers = await getDocs(query(usersRef, where('usernameLower', '==', nextUsernameLower), limit(2)));
        const usernameTaken = existingUsers.docs.some((docSnap) => docSnap.id !== auth.currentUser?.uid);
        if (usernameTaken) {
          throw new Error('That username is already taken. Please choose another one.');
        }
      }

      const updates = {
        name: nextName,
        username: nextName,
        avatar: nextAvatar,
        displayName: nextName,
        photoURL: nextAvatar
      };
      setUser(prev => ({ ...prev, ...updates }));
      setUsers(prev => prev.map(u => u.id === auth.currentUser?.uid ? { ...u, ...updates } : u));

      try {
        await persistUserData({
          username: nextName,
          usernameLower: nextUsernameLower,
          displayName: nextName,
          photoURL: nextAvatar
        });
      } catch (error) {
        console.error('Failed to persist profile changes', error);
        throw error;
      }
  };

  const updateUserFlags = async (updates: Partial<User>) => {
      if (!isAuthenticated || !auth.currentUser) return;
      const sanitizedUpdates = filterSafeUserProfileFields(sanitizeData(updates as Record<string, unknown>));
      if (Object.keys(sanitizedUpdates).length === 0) return;

      try {
          await setDoc(getUserRef(auth.currentUser.uid), { ...sanitizedUpdates, updatedAt: Date.now() }, { merge: true });
      } catch (error) {
          console.error('Failed to update user flags in Firebase', error);
      }

      setUser(prev => ({ ...prev, ...updates }));
      setUsers(prev => prev.map(u => u.id === auth.currentUser?.uid ? { ...u, ...updates } : u));
  };

  const updateUserAdminData = async (userId: string, updates: Partial<User>) => {
      if (!isAuthenticated || !auth.currentUser) return;
      const sanitizedUpdates = sanitizeDeep(updates as Record<string, unknown>);

      if (Object.keys(sanitizedUpdates).length > 0) {
        try {
          await setDoc(getUserRef(userId), { ...sanitizedUpdates, updatedAt: Date.now() }, { merge: true });
        } catch (error) {
          console.error('Failed to update user admin data in Firebase', error);
        }
      }

      setUsers(prev => prev.map(u => u.id === userId ? { ...u, ...updates } : u));
      setUser(prev => prev.id === userId ? { ...prev, ...updates } : prev);
  };

  const updateUserBalance = async (userId: string, nextBalance: number) => {
      if (!isAuthenticated || !auth.currentUser) return;
      const balanceValue = Number.isFinite(nextBalance) ? Math.max(0, nextBalance) : 0;

      try {
        await setDoc(getUserRef(userId), { balance: balanceValue, coins: balanceValue, updatedAt: Date.now() }, { merge: true });
      } catch (error) {
        console.error('Failed to update admin balance in Firebase', error);
      }

      setUsers(prev => prev.map(u => u.id === userId ? { ...u, balance: balanceValue } : u));
      setUser(prev => prev.id === userId ? { ...prev, balance: balanceValue } : prev);
      if (auth.currentUser.uid === userId) {
        setBalance(balanceValue);
      }
  };

  const createBattle = async (boxIds: string[], maxPlayers: number, options?: { mode?: 'REGULAR' | 'CRAZY'; format?: '1V1' | '2V2' }) => {
    if (!isAuthenticated) {
      openAuthModal('login');
      return;
    }

    const selectedCases = boxIds.map(id => boxes.find(b => b.id === id)).filter(Boolean) as MysteryBox[];
    if (!selectedCases.length) {
      alert('Please select at least one box');
      return;
    }

    const entryCostCoins = Math.floor(selectedCases.reduce((sum, box) => sum + toCoins(box.price, PRICE_UNIT_MODE), 0));

    try {
      const response = await authedFetch<{ battleId: string }>('/api/battles/create', {
        method: 'POST',
        body: JSON.stringify({
          mode: options?.mode || 'REGULAR',
          format: options?.format || (maxPlayers === 4 ? '2V2' : '1V1'),
          cases: boxIds,
          roundCount: boxIds.length,
          entryCostCoins,
          roundDurationMs: 4500
        })
      });
      setView({ type: 'BATTLE_ARENA', battleId: response.battleId });
    } catch (error) {
      console.error('Failed to create battle', error);
      alert('Unable to create battle. Please check your balance and try again.');
    }
  };

  const joinBattle = async (battleId: string) => {
    if (!isAuthenticated) {
      openAuthModal('login');
      return;
    }

    try {
      await authedFetch('/api/battles/join', {
        method: 'POST',
        body: JSON.stringify({ battleId })
      });
      setView({ type: 'BATTLE_ARENA', battleId });
    } catch (error) {
      console.error('Failed to join battle', error);
      alert('Unable to join this battle. It may be full or no longer in lobby state.');
    }
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
              itemId = itemId || `custom-item-${Date.now()}`;
              await setDoc(doc(db, 'items', itemId), itemData, { merge: true });
          }
      } catch (error) {
          console.error('Failed to save item to Firebase', error);
          throw error;
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
          throw error;
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
      defaultSelected: !!rawData.defaultSelected,
      firstTimeDepositOnly: !!rawData.firstTimeDepositOnly,
      badge: typeof rawData.badge === 'string' ? rawData.badge.trim() : undefined,
      sortOrder: Number(rawData.sortOrder ?? 0),
      active: !!rawData.active,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    try {
      const now = Date.now();
      const nextPackageBase: CoinPackage = {
        id: id ?? '',
        name: String(rawData.name ?? ''),
        coins: Math.max(0, Number(rawData.coins ?? 0)),
        bonusCoins: Math.max(0, Number(rawData.bonusCoins ?? 0)),
        totalCoins: Math.max(0, Number(rawData.coins ?? 0)) + Math.max(0, Number(rawData.bonusCoins ?? 0)),
        imageUrl: String(rawData.imageUrl ?? ''),
        displayPrice: String(rawData.displayPrice ?? ''),
        stripePriceId: String(rawData.stripePriceId ?? ''),
        badge: typeof rawData.badge === 'string' ? rawData.badge.trim() : undefined,
        active: !!rawData.active,
        sortOrder: Number(rawData.sortOrder ?? 0),
        defaultSelected: !!rawData.defaultSelected,
        firstTimeDepositOnly: !!rawData.firstTimeDepositOnly,
        createdAt: now,
        updatedAt: now
      };
      if (id) {
        await setDoc(doc(db, 'coin_packages', id), packageData, { merge: true });
        const nextPackage = { ...nextPackageBase, id };
        setCoinPackages((prev) => {
          const next = prev.some((entry) => entry.id === id)
            ? prev.map((entry) => (entry.id === id ? { ...entry, ...nextPackage } : entry))
            : [...prev, nextPackage];
          return [...next].sort((a, b) => a.sortOrder - b.sortOrder);
        });
      } else {
        const newDocRef = await addDoc(collection(db, 'coin_packages'), packageData);
        const nextPackage = { ...nextPackageBase, id: newDocRef.id };
        setCoinPackages((prev) => [...prev, nextPackage].sort((a, b) => a.sortOrder - b.sortOrder));
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
      defaultSelected: updates.defaultSelected !== undefined ? !!updates.defaultSelected : undefined,
      firstTimeDepositOnly: updates.firstTimeDepositOnly !== undefined ? !!updates.firstTimeDepositOnly : undefined,
      badge: updates.badge !== undefined ? String(updates.badge ?? '').trim() : undefined,
      sortOrder: updates.sortOrder !== undefined ? Number(updates.sortOrder ?? 0) : undefined,
      active: updates.active !== undefined ? !!updates.active : undefined,
      updatedAt: serverTimestamp()
    });

    try {
      await setDoc(doc(db, 'coin_packages', id), packageData, { merge: true });
      setCoinPackages((prev) =>
        prev
          .map((entry) => {
            if (entry.id !== id) return entry;
            const nextCoins = updates.coins !== undefined ? Math.max(0, Number(updates.coins ?? 0)) : entry.coins;
            const nextBonusCoins = updates.bonusCoins !== undefined ? Math.max(0, Number(updates.bonusCoins ?? 0)) : (entry.bonusCoins ?? 0);
            return {
              ...entry,
              ...updates,
              coins: nextCoins,
              bonusCoins: nextBonusCoins,
              totalCoins: nextCoins + nextBonusCoins,
              badge: updates.badge !== undefined ? String(updates.badge ?? '').trim() : entry.badge,
              updatedAt: Date.now()
            };
          })
          .sort((a, b) => a.sortOrder - b.sortOrder)
      );
    } catch (error) {
      console.error('Failed to update coin package in Firebase', error);
      throw error;
    }
  };

  const deleteCoinPackage = async (id: string) => {
    ensureAdmin();
    try {
      await deleteDoc(doc(db, 'coin_packages', id));
      setCoinPackages((prev) => prev.filter((pkg) => pkg.id !== id));
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

  const claimFreeBox = async (claimedAt?: number, options?: { persist?: boolean }) => {
    const timestamp = Number.isFinite(claimedAt) ? Number(claimedAt) : Date.now();
    setUser(prev => ({ ...prev, lastFreeBoxClaim: timestamp }));
    if (options?.persist === false) {
      return;
    }

    await persistUserData({ lastFreeBoxClaim: timestamp });
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
    // Legacy no-op: XP awards are now server-authoritative in API routes.
    return;
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

    console.warn('Blocked client-side XP write to /users/{uid}; XP must be updated server-side.', {
      userId,
      attemptedXp: sanitizedXp
    });

    setUsers(prev => prev.map(u => u.id === userId ? { ...u, xp: sanitizedXp, xpBalance: sanitizedXp } : u));
    setUser(prev => prev.id === userId ? { ...prev, xp: sanitizedXp, xpBalance: sanitizedXp } : prev);
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


  const cancelShipmentAsAdmin = async (shipmentId: string, userId: string, inventoryId?: string) => {
    if (!shipmentId) {
      console.warn('Attempted to cancel shipment without a shipment id');
      return;
    }

    try {
      await setDoc(doc(db, 'shipments', shipmentId), {
        status: 'cancelled',
        updatedAt: serverTimestamp()
      }, { merge: true });
    } catch (error) {
      console.error('Failed to cancel shipment in Firebase', error);
      return;
    }

    if (userId && inventoryId) {
      try {
        await setDoc(doc(db, 'users', userId, 'inventory', inventoryId), {
          status: 'available',
          shipmentId: deleteField(),
          shipmentBatchId: deleteField(),
          trackingNumber: deleteField(),
          updatedAt: serverTimestamp()
        }, { merge: true });
      } catch (error) {
        console.error('Failed to restore inventory after shipment cancellation', error);
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
                status: 'available',
                shipmentId: undefined,
                shipmentBatchId: undefined,
                trackingNumber: undefined
              }
            : item
        );
        return { ...u, inventory: updatedInventory };
      })
    );
  };

  const gameContextValue = useMemo(() => ({
      user,
      isAuthenticated,
      users,
      notifications,
      showLoginModal,
      showTopUpModal,
      topUpModalIntent,
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
      setTopUpModalIntent,
      setAuthModalMode,
      openAuthModal,
      resendEmailVerification,
      refreshEmailVerification,
      dismissEmailVerificationModal,
      setShowEmailVerifiedModal,
      setShowEmailVerificationModal,
      setView,
      addBalance,
      syncBalance,
      syncXpBalance,
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
      claimFreeBox,
      claimRakeback,
      updateBonusSettings,
      updateStripeSettings,
      awardCaseOpenXp,
      registerSpend,
      generateAffiliateCode,
      updateUserProgress,
      updateShipmentStatus,
      cancelShipmentAsAdmin,
      authInitialized
    }), [
      user, isAuthenticated, users, notifications, showLoginModal, showTopUpModal, topUpModalIntent, authModalMode,
      showEmailVerificationModal, showEmailVerifiedModal, emailVerificationStatus, balance, inventory, shipments,
      view, battles, boxes, items, coinPackages, bonusSettings, stripeSettings, login, loginWithGoogle,
      linkGoogleAccount, register, resetPassword, logout, setShowLoginModal, setShowTopUpModal, setTopUpModalIntent,
      setAuthModalMode, openAuthModal, resendEmailVerification, refreshEmailVerification, dismissEmailVerificationModal, setShowEmailVerifiedModal,
      setShowEmailVerificationModal, setView, addBalance, syncBalance, syncXpBalance, deductBalance, addToInventory,
      addInventoryItemFromServer, followUser, unfollowUser, sellItem, shipItem, updateAddress, updateUserInfo,
      addNotification, dismissNotification, clearNotifications, sendAdminNotification, updateUserFlags,
      updateUserAdminData, updateUserBalance, createBattle, joinBattle, updateBattle, createItem, updateItem,
      deleteItem, createCoinPackage, updateCoinPackage, deleteCoinPackage, createBox, createUserBox, updateBox,
      deleteBox, claimFreeBox, claimRakeback, updateBonusSettings, updateStripeSettings, awardCaseOpenXp,
      registerSpend, generateAffiliateCode, updateUserProgress, updateShipmentStatus, cancelShipmentAsAdmin, authInitialized
    ]);

  const authContextValue = useMemo(() => ({
    user, isAuthenticated, authInitialized, openAuthModal, login, loginWithGoogle, linkGoogleAccount, register,
    resetPassword, logout, authModalMode, setAuthModalMode, showLoginModal, setShowLoginModal,
    showEmailVerificationModal, setShowEmailVerificationModal, showEmailVerifiedModal, setShowEmailVerifiedModal,
    emailVerificationStatus, resendEmailVerification, refreshEmailVerification, dismissEmailVerificationModal
  }), [user, isAuthenticated, authInitialized, openAuthModal, login, loginWithGoogle, linkGoogleAccount, register, resetPassword, logout, authModalMode, showLoginModal, showEmailVerificationModal, showEmailVerifiedModal, emailVerificationStatus, resendEmailVerification, refreshEmailVerification, dismissEmailVerificationModal]);

  const walletContextValue = useMemo(() => ({ user, balance, syncBalance, syncXpBalance, addBalance, deductBalance, registerSpend, awardCaseOpenXp }), [user, balance, syncBalance, syncXpBalance, addBalance, deductBalance, registerSpend, awardCaseOpenXp]);
  const boxesContextValue = useMemo(() => ({ boxes, items, createBox, createUserBox, updateBox, deleteBox, view, setView }), [boxes, items, createBox, createUserBox, updateBox, deleteBox, view, setView]);
  const inventoryContextValue = useMemo(() => ({ inventory, shipments, addToInventory, addInventoryItemFromServer, sellItem, shipItem }), [inventory, shipments, addToInventory, addInventoryItemFromServer, sellItem, shipItem]);
  const uiContextValue = useMemo(() => ({ view, setView, notifications, addNotification, dismissNotification, clearNotifications, showTopUpModal, setShowTopUpModal, topUpModalIntent, setTopUpModalIntent }), [view, setView, notifications, addNotification, dismissNotification, clearNotifications, showTopUpModal, topUpModalIntent]);

  return (
    <GameContext.Provider value={gameContextValue}>
      <AuthContext.Provider value={authContextValue}>
        <WalletContext.Provider value={walletContextValue}>
          <BoxesContext.Provider value={boxesContextValue}>
            <InventoryContext.Provider value={inventoryContextValue}>
              <UIContext.Provider value={uiContextValue}>{children}</UIContext.Provider>
            </InventoryContext.Provider>
          </BoxesContext.Provider>
        </WalletContext.Provider>
      </AuthContext.Provider>
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

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within a GameProvider');
  return context;
};

export const useWallet = () => {
  const context = useContext(WalletContext);
  if (!context) throw new Error('useWallet must be used within a GameProvider');
  return context;
};

export const useBoxes = () => {
  const context = useContext(BoxesContext);
  if (!context) throw new Error('useBoxes must be used within a GameProvider');
  return context;
};

export const useInventory = () => {
  const context = useContext(InventoryContext);
  if (!context) throw new Error('useInventory must be used within a GameProvider');
  return context;
};

export const useUI = () => {
  const context = useContext(UIContext);
  if (!context) throw new Error('useUI must be used within a GameProvider');
  return context;
};
