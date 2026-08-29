import React, { useEffect, useMemo, useRef, useState } from 'react';
import { LayoutDashboard, Users, Settings, Activity, ShieldAlert, Package, Box as BoxIcon, Calculator, Edit2, Trash2, Calendar, BellRing, Truck, PackageCheck, Lock, Unlock, ShieldCheck, ScrollText, UserCog, Sparkles, X, BadgeDollarSign, Beaker, Home as HomeIcon, PackageOpen, MessageCircle, BarChart3, Search, MapPin } from 'lucide-react';
import { Timestamp, addDoc, arrayUnion, collection, deleteDoc, deleteField, doc, getDocs, limit, onSnapshot, orderBy, query, runTransaction, serverTimestamp, setDoc, updateDoc, writeBatch } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { calculateLevelProgress, useGame } from '../context/GameContext';
import { AdminActionLog, CaseItem, CoinPackage, InventoryHistoryEntry, InventoryItem, LedgerEntry, LedgerEntryType, MysteryBox, Shipment, ShippingPackage, ShippingProfile, User, UserLocks, UserStatus } from '../types';
import { COIN_ICON } from '../constants';
import { CoinAmount } from './CoinAmount';
import { buildOddsWithRiskAndTargetEV, buildRiskAdjustedOdds, calculateExpectedValue, calculateOddsTotal, getRiskLabel } from '../utils/caseOdds';
import { PRICE_UNIT_MODE, toCoins } from '../utils/coins';
import { db } from '../firebase';
import { storage } from '../firebaseStorage';
import { HomepageShowcaseEditor } from './admin/HomepageShowcaseEditor';
import { BoxesPageConfigEditor } from './admin/BoxesPageConfigEditor';
import { FooterPagesEditor } from './admin/FooterPagesEditor';
import { PollsAdminSection } from './admin/PollsAdminSection';
import { ReferralAdminSection } from './admin/ReferralAdminSection';
import { MarketPricingAdminSection } from './admin/MarketPricingAdminSection';
import { BoxMarketPricingEditor } from './admin/BoxMarketPricingEditor';
import { ShippingProfilesAdminSection } from './admin/ShippingProfilesAdminSection';
import { ShippingPackagesAdminSection } from './admin/ShippingPackagesAdminSection';
import { ShippingOriginAdminSection } from './admin/ShippingOriginAdminSection';
import { SeoManager } from './admin/SeoManager';
import { Checkbox } from './ui/Checkbox';
import { Input } from './ui/Input';
import { Select } from './ui/Select';
import { Textarea } from './ui/Textarea';
import { getBoxTags, sanitizeFontAwesomeClass } from '../utils/boxTags';
import { authedFetch } from '../utils/authedFetch';

const rarityColorMap: Record<CaseItem['rarity'], string> = {
    common: '#9ca3af',
    uncommon: '#22c55e',
    rare: '#3b82f6',
    epic: '#a855f7',
    legendary: '#fbbf24'
};

const rarityColorOptions = [
    { value: 'common' as const, label: 'Common', color: rarityColorMap.common },
    { value: 'uncommon' as const, label: 'Uncommon', color: rarityColorMap.uncommon },
    { value: 'rare' as const, label: 'Rare', color: rarityColorMap.rare },
    { value: 'epic' as const, label: 'Epic', color: rarityColorMap.epic },
    { value: 'legendary' as const, label: 'Legendary', color: rarityColorMap.legendary }
];

const ITEM_TAG_SUGGESTIONS = [
    'pokemon',
    'sealed',
    'slab',
    'psa10',
    'booster-pack',
    'booster-box',
    'etb',
    'sneakers',
    'tech',
    'apple',
    'nike',
    'gaming',
    'graded',
    'raw',
    'vintage',
    'modern'
] as const;
const BOX_TAG_PRESETS = ['new', 'top', 'hot', 'limited', 'popular'] as const;

const DEFAULT_DAILY_SPIN_REWARD_AMOUNTS = [10, 25, 100, 500, 1000, 2500];

const getDailySpinRows = (dailySpinOdds?: Record<string, number>) => {
    const entries = Object.entries(dailySpinOdds ?? {})
        .map(([amount, weight]) => ({ amount: Math.max(1, Math.floor(Number(amount) || 0)), weight: Math.max(0, Number(weight) || 0) }))
        .filter((entry) => entry.amount > 0)
        .sort((a, b) => a.amount - b.amount);

    const rows = entries.length > 0
        ? entries.slice(0, DEFAULT_DAILY_SPIN_REWARD_AMOUNTS.length)
        : DEFAULT_DAILY_SPIN_REWARD_AMOUNTS.map((amount) => ({ amount, weight: 1 }));

    return DEFAULT_DAILY_SPIN_REWARD_AMOUNTS.map((fallbackAmount, index) => rows[index] ?? { amount: fallbackAmount, weight: 0 });
};

const setDailySpinRow = (dailySpinOdds: Record<string, number> | undefined, index: number, nextRow: { amount: number; weight: number }) => {
    const rows = getDailySpinRows(dailySpinOdds);
    rows[index] = {
        amount: Math.max(1, Math.floor(Number(nextRow.amount) || 1)),
        weight: Math.max(0, Number(nextRow.weight) || 0)
    };

    return rows.reduce<Record<string, number>>((next, row, rowIndex) => {
        const normalizedAmount = Math.max(1, Math.floor(Number(row.amount) || DEFAULT_DAILY_SPIN_REWARD_AMOUNTS[rowIndex]));
        next[String(normalizedAmount)] = Math.max(0, Number(row.weight) || 0);
        return next;
    }, {});
};

const ITEM_SIZE_SUGGESTIONS = [
    'XS',
    'S',
    'M',
    'L',
    'XL',
    'XXL',
    'US 7',
    'US 8',
    'US 9',
    'US 10',
    'US 11',
    'US 12'
] as const;

const UPGRADER_CATEGORY_OPTIONS = [
    { value: '', label: 'None' },
    { value: 'tech', label: 'Tech' },
    { value: 'collectible', label: 'Collectible' },
    { value: 'apparel', label: 'Apparel' }
] as const;

const ITEM_SPREADSHEET_REQUIRED_HEADERS = ['name', 'price', 'image', 'rarity', 'chance', 'color'] as const;
const ITEM_SPREADSHEET_OPTIONAL_HEADERS = ['brand', 'category', 'tags'] as const;
const ITEM_SPREADSHEET_HEADERS = [...ITEM_SPREADSHEET_REQUIRED_HEADERS, ...ITEM_SPREADSHEET_OPTIONAL_HEADERS] as const;
const ITEM_SPREADSHEET_TEMPLATE = `name,price,image,rarity,chance,color,brand,category,tags
Neon Headset,450,https://picsum.photos/200,rare,12,#3b82f6,NeonX,tech,tech|gaming
Pixel Booster,120,https://picsum.photos/200,common,35,#9ca3af,,pokemon,booster-pack|sealed
`;
const USER_BOX_EXPIRY_MS = 24 * 60 * 60 * 1000;

const DEFAULT_REWARDS_SETTINGS = {
    enabled: true,
    pointsPerCoinSpent: 1,
    seasonEndsAt: '',
    rewardRulesMode: 'rank' as 'rank' | 'points',
    rankRulesText: '[{"minRank":4,"maxRank":10,"rewardAmountCoins":1000}]',
    pointsRulesText: '[{"minPoints":1000,"rewardAmountCoins":10000}]',
    payoutType: 'coins' as 'coins' | 'xp' | 'item' | 'none',
    top1CoinReward: 5000,
    top2CoinReward: 3000,
    top3CoinReward: 2000,
    heroImageUrl: '',
    questRulesText: '[{"id":"open-3-boxes","title":"Unboxing mission","description":"Open 3 boxes today","type":"unboxing_count","target":3,"rewardCoins":50,"enabled":true},{"id":"sell-2-items","title":"Sell back mission","description":"Sell back 2 items today","type":"sell_back_count","target":2,"rewardCoins":40,"enabled":true},{"id":"sell-200-coins","title":"Sell back value mission","description":"Sell back 200 coins worth today","type":"sell_back_value","target":200,"rewardCoins":60,"enabled":true},{"id":"unbox-rare","title":"Rarity mission","description":"Unbox 1 rare item today","type":"unbox_rarity","target":1,"rarity":"rare","rewardCoins":80,"enabled":true}]'
};


const DEFAULT_PULL_PASS_TIERS = [
    { xpRequired: 50, tier: 1, premiumReward: '100 Coins', freeReward: 'Bronze Box' },
    { xpRequired: 100, tier: 2, premiumReward: '125 Coins', freeReward: '50 Coins' },
    { xpRequired: 160, tier: 3, premiumReward: '150 Coins', freeReward: '75 Coins' },
    { xpRequired: 230, tier: 4, premiumReward: '175 Coins', freeReward: '100 Coins' },
    { xpRequired: 310, tier: 5, premiumReward: '200 Coins', freeReward: 'Bronze Box' },
    { xpRequired: 400, tier: 6, premiumReward: '225 Coins', freeReward: '125 Coins' },
    { xpRequired: 500, tier: 7, premiumReward: '250 Coins', freeReward: '150 Coins' },
    { xpRequired: 610, tier: 8, premiumReward: '275 Coins', freeReward: '175 Coins' },
    { xpRequired: 730, tier: 9, premiumReward: '300 Coins', freeReward: '200 Coins' },
    { xpRequired: 860, tier: 10, premiumReward: '350 Coins', freeReward: 'Silver Box' },
    { xpRequired: 1000, tier: 11, premiumReward: '375 Coins', freeReward: '225 Coins' },
    { xpRequired: 1150, tier: 12, premiumReward: '400 Coins', freeReward: '250 Coins' },
    { xpRequired: 1310, tier: 13, premiumReward: '425 Coins', freeReward: '275 Coins' },
    { xpRequired: 1480, tier: 14, premiumReward: '450 Coins', freeReward: '300 Coins' },
    { xpRequired: 1660, tier: 15, premiumReward: '500 Coins', freeReward: 'Silver Box' },
    { xpRequired: 1850, tier: 16, premiumReward: '525 Coins', freeReward: '325 Coins' },
    { xpRequired: 2050, tier: 17, premiumReward: '550 Coins', freeReward: '350 Coins' },
    { xpRequired: 2260, tier: 18, premiumReward: '575 Coins', freeReward: '375 Coins' },
    { xpRequired: 2480, tier: 19, premiumReward: '600 Coins', freeReward: '400 Coins' },
    { xpRequired: 2710, tier: 20, premiumReward: '700 Coins', freeReward: 'Gold Box' },
    { xpRequired: 2950, tier: 21, premiumReward: '725 Coins', freeReward: '425 Coins' },
    { xpRequired: 3200, tier: 22, premiumReward: '750 Coins', freeReward: '450 Coins' },
    { xpRequired: 3460, tier: 23, premiumReward: '775 Coins', freeReward: '475 Coins' },
    { xpRequired: 3730, tier: 24, premiumReward: '800 Coins', freeReward: '500 Coins' },
    { xpRequired: 4010, tier: 25, premiumReward: '900 Coins', freeReward: 'Gold Box' },
    { xpRequired: 4300, tier: 26, premiumReward: '925 Coins', freeReward: '525 Coins' },
    { xpRequired: 4600, tier: 27, premiumReward: '950 Coins', freeReward: '550 Coins' },
    { xpRequired: 4910, tier: 28, premiumReward: '975 Coins', freeReward: '575 Coins' },
    { xpRequired: 5230, tier: 29, premiumReward: '1000 Coins', freeReward: '600 Coins' },
    { xpRequired: 5560, tier: 30, premiumReward: '1250 Coins', freeReward: 'Elite Box' },
    { xpRequired: 5900, tier: 31, premiumReward: '1050 Coins', freeReward: '650 Coins' },
    { xpRequired: 6250, tier: 32, premiumReward: '1100 Coins', freeReward: '700 Coins' },
    { xpRequired: 6610, tier: 33, premiumReward: '1150 Coins', freeReward: '750 Coins' },
    { xpRequired: 6980, tier: 34, premiumReward: '1200 Coins', freeReward: '800 Coins' },
    { xpRequired: 7360, tier: 35, premiumReward: '1500 Coins', freeReward: 'Elite Box' },
    { xpRequired: 7750, tier: 36, premiumReward: '1250 Coins', freeReward: '850 Coins' },
    { xpRequired: 8150, tier: 37, premiumReward: '1300 Coins', freeReward: '900 Coins' },
    { xpRequired: 8560, tier: 38, premiumReward: '1350 Coins', freeReward: '950 Coins' },
    { xpRequired: 8980, tier: 39, premiumReward: '1400 Coins', freeReward: '1000 Coins' },
    { xpRequired: 9410, tier: 40, premiumReward: '2000 Coins', freeReward: 'Master Box' },
    { xpRequired: 9850, tier: 41, premiumReward: '1450 Coins', freeReward: '1050 Coins' },
    { xpRequired: 10300, tier: 42, premiumReward: '1500 Coins', freeReward: '1100 Coins' },
    { xpRequired: 10760, tier: 43, premiumReward: '1600 Coins', freeReward: '1150 Coins' },
    { xpRequired: 11230, tier: 44, premiumReward: '1700 Coins', freeReward: '1200 Coins' },
    { xpRequired: 11710, tier: 45, premiumReward: '2500 Coins', freeReward: 'Elite Box' },
    { xpRequired: 12200, tier: 46, premiumReward: '1800 Coins', freeReward: '1250 Coins' },
    { xpRequired: 12700, tier: 47, premiumReward: '1900 Coins', freeReward: '1300 Coins' },
    { xpRequired: 13210, tier: 48, premiumReward: '2000 Coins', freeReward: '1350 Coins' },
    { xpRequired: 13730, tier: 49, premiumReward: '2500 Coins', freeReward: '1500 Coins' },
    { xpRequired: 14260, tier: 50, premiumReward: '5000 Coins', freeReward: 'Gold Collector Box' },
];

const DEFAULT_PULL_PASS_SETTINGS = {
    enabled: true,
    seasonName: 'Season 1: The Collector',
    startsAt: '',
    endsAt: '',
    coinsPerXp: 10,
    totalTiers: 50,
    resetOnEnd: true,
    tiersText: JSON.stringify(DEFAULT_PULL_PASS_TIERS, null, 2)
};

const DEFAULT_LOCKS: UserLocks = {
    openCases: false,
    deposits: false,
    withdraws: false,
    marketplace: false,
    shipments: false
};

const LOCK_LABELS: Record<keyof UserLocks, string> = {
    openCases: 'Open Boxes',
    deposits: 'Deposits',
    withdraws: 'Withdraws',
    marketplace: 'Marketplace',
    shipments: 'Shipments'
};

type SupportMessage = {
    sender: 'user' | 'admin';
    text: string;
    timestamp?: Timestamp;
};

type SupportCase = {
    id: string;
    uid: string;
    email: string;
    subject: string;
    status: 'Open' | 'Closed' | string;
    createdAt?: Timestamp;
    lastUpdatedAt?: Timestamp;
    messages?: SupportMessage[];
};

type ShipmentOrderRecord = {
    id: string;
    key: string;
    shipments: Shipment[];
    user?: User;
    createdAt: number;
    updatedAt: number;
    status: Shipment['status'];
    itemCount: number;
    totalValue: number;
    shippingCost: number;
    shippingBatchCostCents: number;
    shippingPaymentMethod?: Shipment['shippingPaymentMethod'];
    shippingRateTier?: string;
    trackingNumbers: string[];
};


type AdminXpShopItem = {
    id: string;
    title: string;
    description: string;
    imageUrl?: string;
    xpCost: number;
    stock: number | null;
    limitPerUser: number | null;
    category: string;
    fulfillmentType: 'DIGITAL' | 'COUPON' | 'PHYSICAL_SHIP' | 'XP_BOX';
    metadata?: {
        caseId?: string;
        xpPriceOverride?: number;
        unlockRakeback?: boolean;
        rakebackPercent?: number;
        rakebackTier?: string | null;
    };
    enabled: boolean;
    sortOrder: number;
};

type AdminXpRedemption = {
    id: string;
    userId: string;
    itemId: string;
    xpCost: number;
    status: 'pending' | 'fulfilled' | 'cancelled' | string;
    createdAt?: Timestamp;
    metadata?: Record<string, unknown>;
};

type BalanceAuditEntry = {
    id: string;
    currency: 'coins' | 'xp';
    reason: string;
    amount: number;
    balanceBefore?: number;
    balanceAfter?: number;
    actorType?: 'user' | 'admin' | 'system';
    actorUid?: string | null;
    source?: string;
    relatedId?: string | null;
    metadata?: Record<string, unknown>;
    createdAt?: Timestamp;
};



type EconomySettingsDraft = {
    xpPerDollar: number;
    coinsPerDollar: number;
    xpOpenEnabled: boolean;
};

type LeaderboardApprovalEntry = {
    uid: string;
    displayName: string;
    points: number;
    rank: number;
    rewardCoins: number;
    rewardApprovedAt?: number;
};

const DEFAULT_ECONOMY_SETTINGS: EconomySettingsDraft = {
    xpPerDollar: 250,
    coinsPerDollar: 100,
    xpOpenEnabled: true
};

type AdminSentNotification = {
    id: string;
    title: string;
    body: string;
    recipientCount: number;
    createdBy: string;
    createdAt?: Timestamp;
};

type DashboardTransaction = {
    id: string;
    userLabel: string;
    type: LedgerEntryType;
    amount: number;
    createdAt: number;
};

type DashboardUserSummary = {
    id: string;
    createdAt: number;
    balance: number;
    ledger: LedgerEntry[];
};

const escapeText = (value: string) =>
    value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

const toSafeHtml = (value: string) => escapeText(value).replace(/\n/g, '<br />');

const formatSupportTimestamp = (timestamp?: Timestamp) => {
    if (!timestamp) return 'Just now';
    return timestamp.toDate().toLocaleString();
};

const toMillis = (value: unknown, fallback = 0): number => {
    if (value instanceof Timestamp) return value.toMillis();
    if (typeof value === 'object' && value && typeof (value as { toMillis?: unknown }).toMillis === 'function') {
        return Number((value as { toMillis: () => number }).toMillis());
    }
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
        const parsed = Date.parse(value);
        if (!Number.isNaN(parsed)) return parsed;
    }
    return fallback;
};

export const AdminPanel: React.FC = () => {
  const {
    user: adminUser,
    createItem,
    updateItem,
    deleteItem,
    coinPackages,
    createCoinPackage,
    updateCoinPackage,
    deleteCoinPackage,
    createBox,
    updateBox,
    deleteBox,
    items,
    boxes,
    users,
    shipments,
    updateUserProgress,
    sendAdminNotification,
    updateShipmentStatus,
    cancelShipmentAsAdmin,
    updateUserAdminData,
    updateUserBalance,
    bonusSettings,
    updateBonusSettings,
    stripeSettings,
    updateStripeSettings
  } = useGame();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'users' | 'settings' | 'seo' | 'items' | 'boxes' | 'shipments' | 'shipping-origin' | 'shipping-profiles' | 'shipping-packages' | 'support' | 'bonuses' | 'packages' | 'fees' | 'case-lab' | 'homepage' | 'boxes-page' | 'footer-pages' | 'polls' | 'referrals' | 'market-pricing'>('dashboard');
  const [shippingProfiles, setShippingProfiles] = useState<ShippingProfile[]>([]);
  const loadShippingProfiles = async () => { const result = await authedFetch<{ profiles: ShippingProfile[] }>('/api/admin/shipping-profiles'); setShippingProfiles(result.profiles ?? []); };
  useEffect(() => { void loadShippingProfiles().catch((error) => console.error('Failed to load shipping profiles', error)); }, []);
  const [shippingPackages, setShippingPackages] = useState<ShippingPackage[]>([]);
  const loadShippingPackages = async () => { const result = await authedFetch<{ packages: ShippingPackage[] }>('/api/admin/shipping-packages'); setShippingPackages(result.packages ?? []); };
  useEffect(() => { void loadShippingPackages().catch((error) => console.error('Failed to load shipping packages', error)); }, []);

  // --- ITEM FORM STATE ---
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [newItem, setNewItem] = useState<Partial<CaseItem>>({
      name: '',
      price: 0,
      priceXP: 0,
      currencyType: 'COIN',
      image: 'https://picsum.photos/200',
      rarity: 'common',
      chance: 10,
      color: '#9ca3af',
      brand: '',
      category: '',
      tags: [],
      sizes: [],
      redeemable: true,
      forceFullSellBack: false,
      upgraderEnabled: false,
      upgraderCategory: '',
      upgraderSort: undefined,
      upgraderFeatured: false
  });
  const [itemTagInput, setItemTagInput] = useState('');
  const [itemSizeInput, setItemSizeInput] = useState('');
  const [itemFormError, setItemFormError] = useState<string | null>(null);
  const [boxTagInput, setBoxTagInput] = useState('');
  const [itemSearchQuery, setItemSearchQuery] = useState('');
  const [itemUpgraderOnlyFilter, setItemUpgraderOnlyFilter] = useState(false);
  const [itemUpgraderCategoryFilter, setItemUpgraderCategoryFilter] = useState<'' | 'tech' | 'collectible' | 'apparel'>('');
  const [itemVisibleCount, setItemVisibleCount] = useState(20);
  const itemListContainerRef = useRef<HTMLDivElement | null>(null);
  const itemListSentinelRef = useRef<HTMLDivElement | null>(null);

  // --- BOX FORM STATE ---
  const [editingBoxId, setEditingBoxId] = useState<string | null>(null);
  const [newBox, setNewBox] = useState<Partial<MysteryBox>>({
      name: '',
      price: 0,
      image: 'https://picsum.photos/300',
      spinnerBackgroundImage: '',
      accentColor: '#3b82f6',
      isDaily: false,
      isPullPassBox: false,
      pullPassBoxType: 'bronze',
      tags: [],
      sellBackRate: 0.82
  });
  const [isPackageModalOpen, setIsPackageModalOpen] = useState(false);
  const [editingPackageId, setEditingPackageId] = useState<string | null>(null);
  const [packageDraft, setPackageDraft] = useState<Partial<CoinPackage>>({
      name: '',
      coins: 0,
      bonusCoins: 0,
      defaultSelected: false,
      firstTimeDepositOnly: false,
      imageUrl: '',
      displayPrice: '',
      stripePriceId: '',
      badge: undefined,
      active: true,
      sortOrder: 0
  });
  const [packageError, setPackageError] = useState<string | null>(null);
  const [isSavingPackage, setIsSavingPackage] = useState(false);
  const [deletingPackageId, setDeletingPackageId] = useState<string | null>(null);
  const [riskBalance, setRiskBalance] = useState(50);
  const [targetEV, setTargetEV] = useState(0.85);
  const [selectedItems, setSelectedItems] = useState<CaseItem[]>([]);
  const [bulkShippingItemIds, setBulkShippingItemIds] = useState<string[]>([]);
  const [oddsEditorMode, setOddsEditorMode] = useState<'auto' | 'manual'>('auto');
  const [itemBrandFilter, setItemBrandFilter] = useState('');
  const [itemCategoryFilter, setItemCategoryFilter] = useState('');
  const [itemTagFilters, setItemTagFilters] = useState<string[]>([]);
  const [boxItemSearchQuery, setBoxItemSearchQuery] = useState('');
  const [deletingBoxId, setDeletingBoxId] = useState<string | null>(null);
  const [isUploadingSpinnerBackground, setIsUploadingSpinnerBackground] = useState(false);
  const [isUploadingBoxCatalogHero, setIsUploadingBoxCatalogHero] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [userXpInput, setUserXpInput] = useState<number>(0);
  const [isSavingUser, setIsSavingUser] = useState(false);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [adminNotification, setAdminNotification] = useState('');
  const [adminNoticeSent, setAdminNoticeSent] = useState(false);
  const [isSendingAdminNotice, setIsSendingAdminNotice] = useState(false);
  const [adminSentNotifications, setAdminSentNotifications] = useState<AdminSentNotification[]>([]);
  const [deletingAdminNoticeId, setDeletingAdminNoticeId] = useState<string | null>(null);
  const [shipmentFilter, setShipmentFilter] = useState<'all' | 'processing' | 'shipped'>('processing');
  const [shipmentTracking, setShipmentTracking] = useState<Record<string, string>>({});
  const [phoneVerificationDraft, setPhoneVerificationDraft] = useState('');
  const [phoneVerificationState, setPhoneVerificationState] = useState<{ saving: boolean; error?: string; success?: string }>({ saving: false });
  const [supportCases, setSupportCases] = useState<SupportCase[]>([]);
  const [expandedSupportCases, setExpandedSupportCases] = useState<Set<string>>(new Set());
  const [supportReplyDrafts, setSupportReplyDrafts] = useState<Record<string, string>>({});
  const [supportReplyStatus, setSupportReplyStatus] = useState<Record<string, { sending: boolean; error?: string; success?: string }>>(
      {}
  );
  const [supportStatusUpdates, setSupportStatusUpdates] = useState<Record<string, { sending: boolean; error?: string; success?: string }>>(
      {}
  );
  const [dashboardTransactions, setDashboardTransactions] = useState<DashboardTransaction[]>([]);
  const [dashboardUsers, setDashboardUsers] = useState<DashboardUserSummary[]>([]);

  useEffect(() => {
      const currentIds = new Set(selectedItems.map((item) => item.id));
      setBulkShippingItemIds((ids) => {
          const next = ids.filter((id) => currentIds.has(id));
          return next.length === ids.length && next.every((id, index) => id === ids[index]) ? ids : next;
      });
  }, [selectedItems]);

  useEffect(() => {
      if (activeTab !== 'dashboard') return;
      const noticesQuery = query(collection(db, 'adminNotifications'), orderBy('createdAt', 'desc'), limit(30));
      const unsubscribe = onSnapshot(noticesQuery, (snapshot) => {
          const next = snapshot.docs.map((docSnap) => {
              const data = docSnap.data() as Record<string, any>;
              return {
                  id: docSnap.id,
                  title: typeof data.title === 'string' ? data.title : 'Admin update',
                  body: typeof data.body === 'string' ? data.body : '',
                  recipientCount: Number(data.recipientCount ?? 0),
                  createdBy: typeof data.createdBy === 'string' ? data.createdBy : 'unknown',
                  createdAt: data.createdAt instanceof Timestamp ? data.createdAt : undefined
              } as AdminSentNotification;
          });
          setAdminSentNotifications(next);
      }, (error) => {
          console.error('Admin notifications snapshot failed', error);
      });

      return () => unsubscribe();
  }, [activeTab]);

  const filteredAdminItems = useMemo(() => {
      const query = itemSearchQuery.trim().toLowerCase();
      return items.filter((item) => {
          if (itemUpgraderOnlyFilter && item.upgraderEnabled !== true) {
              return false;
          }
          if (itemUpgraderCategoryFilter && item.upgraderCategory !== itemUpgraderCategoryFilter) {
              return false;
          }
          const haystack = [
              item.name,
              item.brand,
              item.category,
              item.rarity,
              item.upgraderCategory,
              item.upgraderFeatured ? 'featured' : '',
              item.upgraderEnabled ? 'upgrader' : '',
              ...(item.tags ?? []),
              ...(item.sizes ?? [])
          ]
              .filter(Boolean)
              .join(' ')
              .toLowerCase();

          return !query || haystack.includes(query);
      });
  }, [itemSearchQuery, items, itemUpgraderOnlyFilter, itemUpgraderCategoryFilter]);

  const visibleAdminItems = useMemo(
      () => filteredAdminItems.slice(0, itemVisibleCount),
      [filteredAdminItems, itemVisibleCount]
  );

  useEffect(() => {
      setItemVisibleCount(20);
  }, [itemSearchQuery, items, itemUpgraderOnlyFilter, itemUpgraderCategoryFilter]);

  useEffect(() => {
      const sentinel = itemListSentinelRef.current;
      if (!sentinel) return;

      const observer = new IntersectionObserver(
          (entries) => {
              const entry = entries[0];
              if (entry.isIntersecting) {
                  setItemVisibleCount((prev) => Math.min(prev + 20, filteredAdminItems.length));
              }
          },
          {
              root: itemListContainerRef.current,
              rootMargin: '100px',
              threshold: 0.1
          }
      );

      observer.observe(sentinel);

      return () => {
          observer.disconnect();
      };
  }, [filteredAdminItems.length]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedSignupIp, setSelectedSignupIp] = useState<string | null>(null);
  const [userStatuses, setUserStatuses] = useState<Record<string, UserStatus>>({});
  const [userLocks, setUserLocks] = useState<Record<string, UserLocks>>({});
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [expandedUserIds, setExpandedUserIds] = useState<Record<string, boolean>>({});
  const [usersQuickFilter, setUsersQuickFilter] = useState<'all' | 'shared_ip' | 'locked' | 'high_risk' | 'empty_inventory' | 'high_value'>('all');
  const [usersSort, setUsersSort] = useState<{ key: 'user' | 'created' | 'lastActive' | 'status' | 'coins' | 'inventoryValue' | 'lifetimeDeposits' | 'lifetimeSpent' | 'pendingShipments' | 'risk'; direction: 'asc' | 'desc' }>({
      key: 'created',
      direction: 'desc'
  });
  const [userInternalLabels, setUserInternalLabels] = useState<Record<string, string[]>>({});
  const [userAdminNotes, setUserAdminNotes] = useState<Record<string, string>>({});
  const [ledgerEntries, setLedgerEntries] = useState<Record<string, LedgerEntry[]>>({});
  const [adminLogs, setAdminLogs] = useState<Record<string, AdminActionLog[]>>({});
  const [inventoryState, setInventoryState] = useState<Record<string, InventoryItem[]>>({});
  const [reversalAmount, setReversalAmount] = useState('');
  const [reversalReason, setReversalReason] = useState('');
  const [voidSourceId, setVoidSourceId] = useState('');
  const [voidReason, setVoidReason] = useState('');
  const [ledgerFilter, setLedgerFilter] = useState<'all' | LedgerEntryType>('all');
  const [ledgerSearch, setLedgerSearch] = useState('');
  const [timelineFilter, setTimelineFilter] = useState<'all' | 'ledger' | 'inventory' | 'admin' | 'shipment' | 'support'>('all');
  const [timelineSearch, setTimelineSearch] = useState('');
  const [balanceAuditEntries, setBalanceAuditEntries] = useState<Record<string, BalanceAuditEntry[]>>({});
  const [balanceAuditCurrencyFilter, setBalanceAuditCurrencyFilter] = useState<'all' | 'coins' | 'xp'>('all');
  const [balanceAuditDirectionFilter, setBalanceAuditDirectionFilter] = useState<'all' | 'positive' | 'negative'>('all');
  const [balanceAuditReasonFilter, setBalanceAuditReasonFilter] = useState('all');
  const [balanceAuditSearch, setBalanceAuditSearch] = useState('');
  const [expandedAuditRows, setExpandedAuditRows] = useState<Record<string, boolean>>({});
  const [bonusDraft, setBonusDraft] = useState(bonusSettings);
  const [rewardsDraft, setRewardsDraft] = useState(DEFAULT_REWARDS_SETTINGS);
  const [pullPassDraft, setPullPassDraft] = useState(DEFAULT_PULL_PASS_SETTINGS);
  const [pullPassSettingsNotice, setPullPassSettingsNotice] = useState(false);
  const [isResettingPullPass, setIsResettingPullPass] = useState(false);
  const [pullPassResetNotice, setPullPassResetNotice] = useState<string | null>(null);
  const [rewardsSettingsNotice, setRewardsSettingsNotice] = useState(false);
  const [leaderboardApprovals, setLeaderboardApprovals] = useState<LeaderboardApprovalEntry[]>([]);
  const [selectedLeaderboardWinnerIds, setSelectedLeaderboardWinnerIds] = useState<string[]>([]);
  const [leaderboardApprovalsLoading, setLeaderboardApprovalsLoading] = useState(false);
  const [isApprovingLeaderboardWinners, setIsApprovingLeaderboardWinners] = useState(false);
  const [leaderboardApprovalNotice, setLeaderboardApprovalNotice] = useState<string | null>(null);
  const [bonusSaveNotice, setBonusSaveNotice] = useState(false);
  const dailySpinRows = useMemo(() => getDailySpinRows(bonusDraft.dailySpinOdds), [bonusDraft.dailySpinOdds]);
  const [economyDraft, setEconomyDraft] = useState<EconomySettingsDraft>(DEFAULT_ECONOMY_SETTINGS);
  const [economySaveNotice, setEconomySaveNotice] = useState(false);
  const [xpShopItems, setXpShopItems] = useState<AdminXpShopItem[]>([]);
  const [xpRedemptions, setXpRedemptions] = useState<AdminXpRedemption[]>([]);
  const [editingXpShopItemId, setEditingXpShopItemId] = useState<string | null>(null);
  const [isSavingXpShopItem, setIsSavingXpShopItem] = useState(false);
  const [xpShopItemDraft, setXpShopItemDraft] = useState<Omit<AdminXpShopItem, 'id'>>({
      title: '',
      description: '',
      imageUrl: '',
      xpCost: 100,
      stock: null,
      limitPerUser: null,
      category: 'Exclusive',
      fulfillmentType: 'DIGITAL',
      metadata: {},
      enabled: true,
      sortOrder: 0
  });
  const [stripeSettingsDraft, setStripeSettingsDraft] = useState({
      boxCatalogHeroImageUrl: stripeSettings.boxCatalogHeroImageUrl,
      authPopupImageUrl: stripeSettings.authPopupImageUrl,
      authPopupImageUrls: stripeSettings.authPopupImageUrls,
      homeCategoryImageUrls: stripeSettings.homeCategoryImageUrls,
      homeCategorySlugs: stripeSettings.homeCategorySlugs,
      howItWorksStepImageUrls: stripeSettings.howItWorksStepImageUrls,
      shippingCashEnabled: stripeSettings.shippingCashEnabled,
      shippingFlatRateInput: (stripeSettings.shippingFlatRateCents / 100).toFixed(2),
      stripeShippingProductId: stripeSettings.stripeShippingProductId,
      shippingCoinEnabled: stripeSettings.shippingCoinEnabled,
      shippingCoinCostCoins: stripeSettings.shippingCoinCostCoins,
      shippingRateTiers: stripeSettings.shippingRateTiers.map((tier) => ({ ...tier })),
      shippingProtectionTiers: stripeSettings.shippingProtectionTiers.map((tier) => ({ ...tier })),
      signatureRequiredInput: (stripeSettings.signatureRequiredCents / 100).toFixed(2),
      caseLabPublishFeeCoins: stripeSettings.caseLabPublishFeeCoins,
      caseLabSellBackPercent: stripeSettings.caseLabSellBackPercent,
      caseLabVisibleBoxIds: stripeSettings.caseLabVisibleBoxIds
  });
  const [stripeSettingsNotice, setStripeSettingsNotice] = useState(false);

  const homeCategoryOptions = useMemo(() => {
      const tags = new Set<string>();
      boxes.forEach((box) => {
          if (box.isDaily || box.isUserCreated) return;
          getBoxTags(box).forEach((tag) => {
              const normalized = tag.trim().toLowerCase();
              if (!normalized) return;
              tags.add(normalized);
          });
      });

      const sortedTags = Array.from(tags).sort((a, b) => a.localeCompare(b));
      return sortedTags.map((tag) => ({
          value: tag,
          label: tag
              .split(/[-_\s]+/)
              .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
              .join(' ')
      }));
  }, [boxes]);
  const [isEditingBalance, setIsEditingBalance] = useState(false);
  const [balanceDraft, setBalanceDraft] = useState('');
  const [isEditingInventory, setIsEditingInventory] = useState(false);
  const [inventoryDraft, setInventoryDraft] = useState({
      name: '',
      price: '',
      image: '',
      rarity: 'common',
      status: 'available'
  });
  const [inventorySaveError, setInventorySaveError] = useState<string | null>(null);
  const [spreadsheetStatus, setSpreadsheetStatus] = useState<{ tone: 'success' | 'error'; message: string } | null>(null);
  const [isSpreadsheetUploading, setIsSpreadsheetUploading] = useState(false);
  const spreadsheetInputRef = useRef<HTMLInputElement | null>(null);
  const EV_TOLERANCE = 0.01;
  const safeTargetEVInput = Number.isFinite(targetEV) ? targetEV : 0.85;
  const isRealSelectedUserId = (userId: string | null | undefined) => Boolean(userId && userId.trim() && userId !== 'loading');
  const clampedTargetEV = Math.min(1.5, Math.max(0.5, safeTargetEVInput));

  useEffect(() => {
      if (activeTab !== 'support') return;
      const supportQuery = query(
          collection(db, 'supportCases'),
          orderBy('lastUpdatedAt', 'desc'),
          limit(50)
      );
      const unsubscribe = onSnapshot(supportQuery, (snapshot) => {
          const nextCases = snapshot.docs.map((docSnapshot) => {
              const data = docSnapshot.data() as Omit<SupportCase, 'id'>;
              return {
                  id: docSnapshot.id,
                  ...data
              };
          });
          setSupportCases(nextCases);
      }, (error) => {
          console.error('Support cases snapshot failed', error);
      });

      return () => unsubscribe();
  }, [activeTab]);

  useEffect(() => {
      if (activeTab !== 'bonuses') return;
      const itemsQuery = query(collection(db, 'xpShopItems'), orderBy('sortOrder', 'asc'), limit(100));
      const unsubscribe = onSnapshot(itemsQuery, (snapshot) => {
          const nextItems = snapshot.docs.map((docSnapshot) => {
              const data = docSnapshot.data() as Record<string, any>;
              return {
                  id: docSnapshot.id,
                  title: String(data.title ?? ''),
                  description: String(data.description ?? ''),
                  imageUrl: typeof data.imageUrl === 'string' ? data.imageUrl : '',
                  xpCost: Math.max(0, Math.floor(Number(data.xpCost ?? 0))),
                  stock: data.stock == null ? null : Math.max(0, Math.floor(Number(data.stock ?? 0))),
                  limitPerUser: data.limitPerUser == null ? null : Math.max(0, Math.floor(Number(data.limitPerUser ?? 0))),
                  category: String(data.category ?? 'Exclusive'),
                  fulfillmentType: (data.fulfillmentType ?? 'DIGITAL') as AdminXpShopItem['fulfillmentType'],
                  enabled: data.enabled !== false,
                  sortOrder: Math.floor(Number(data.sortOrder ?? 0)),
                  metadata: {
                      caseId: typeof data?.metadata?.caseId === 'string' ? data.metadata.caseId : undefined,
                      xpPriceOverride: data?.metadata?.xpPriceOverride == null ? undefined : Math.max(0, Math.floor(Number(data.metadata.xpPriceOverride))),
                      unlockRakeback: data?.metadata?.unlockRakeback === true,
                      rakebackPercent: data?.metadata?.rakebackPercent == null ? undefined : Math.max(0, Number(data.metadata.rakebackPercent)),
                      rakebackTier: data?.metadata?.rakebackTier == null ? null : String(data.metadata.rakebackTier)
                  }
              } as AdminXpShopItem;
          });
          setXpShopItems(nextItems);
      }, (error) => {
          console.error('XP shop items snapshot failed', error);
      });

      return () => unsubscribe();
  }, [activeTab]);

  useEffect(() => {
      if (activeTab !== 'bonuses') return;
      const redemptionsQuery = query(collection(db, 'xpRedemptions'), orderBy('createdAt', 'desc'), limit(100));
      const unsubscribe = onSnapshot(redemptionsQuery, (snapshot) => {
          const nextRedemptions = snapshot.docs.map((docSnapshot) => {
              const data = docSnapshot.data() as Record<string, any>;
              return {
                  id: docSnapshot.id,
                  userId: String(data.userId ?? ''),
                  itemId: String(data.itemId ?? ''),
                  xpCost: Math.max(0, Math.floor(Number(data.xpCost ?? 0))),
                  status: String(data.status ?? 'pending'),
                  createdAt: data.createdAt as Timestamp | undefined,
                  metadata: (data.metadata ?? {}) as Record<string, unknown>
              } as AdminXpRedemption;
          });
          setXpRedemptions(nextRedemptions);
      }, (error) => {
          console.error('XP redemptions snapshot failed', error);
      });

      return () => unsubscribe();
  }, [activeTab]);

  const handleDeleteUser = async (userId: string) => {
      const targetUser = users.find((profile) => profile.id === userId);
      const displayName = targetUser?.name ?? 'this user';
      const confirmed = window.confirm(`Delete ${displayName}? This permanently removes their profile data.`);
      if (!confirmed) return;
      setDeletingUserId(userId);
      try {
          await deleteDoc(doc(db, 'users', userId));
          setUserStatuses((current) => {
              const next = { ...current };
              delete next[userId];
              return next;
          });
          setUserLocks((current) => {
              const next = { ...current };
              delete next[userId];
              return next;
          });
          setLedgerEntries((current) => {
              const next = { ...current };
              delete next[userId];
              return next;
          });
          setAdminLogs((current) => {
              const next = { ...current };
              delete next[userId];
              return next;
          });
          setInventoryState((current) => {
              const next = { ...current };
              delete next[userId];
              return next;
          });
          setSelectedUserId((current) => (current === userId ? null : current));
          setEditingUserId((current) => (current === userId ? null : current));
      } catch (error) {
          console.error('Failed to delete user', error);
          window.alert('Unable to delete user. Please try again.');
      } finally {
          setDeletingUserId((current) => (current === userId ? null : current));
      }
  };
  const MAX_BOX_TAGS = 10;
  const MAX_BOX_TAG_LENGTH = 24;
  const sortedPackages = useMemo(() => {
      return [...coinPackages].sort((a, b) => a.sortOrder - b.sortOrder);
  }, [coinPackages]);
  const userCaseLabBoxes = useMemo(() => {
      return [...boxes]
          .filter((box) => box.isUserCreated)
          .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
  }, [boxes]);
  const selectableCaseLabBoxes = useMemo(
      () => boxes.filter((box) => !box.isUserCreated && box.items.length > 0),
      [boxes]
  );
  const xpBoxes = useMemo(
      () => boxes.filter((box) => (box.currencyType ?? 'COIN') === 'XP'),
      [boxes]
  );


  const boxTagStats = useMemo(() => {
      const usage = new Map<string, number>();
      boxes
          .filter((box) => !box.isUserCreated)
          .forEach((box) => {
              getBoxTags(box).forEach((tag) => {
                  usage.set(tag, (usage.get(tag) ?? 0) + 1);
              });
          });

      return Array.from(usage.entries())
          .map(([tag, count]) => ({ tag, count }))
          .sort((a, b) => a.tag.localeCompare(b.tag));
  }, [boxes]);

  const boxTagOptions = useMemo(() => boxTagStats.map((entry) => entry.tag), [boxTagStats]);

  const [boxTagIconsDraft, setBoxTagIconsDraft] = useState<Record<string, string>>(stripeSettings.boxTagIcons);
  const [boxTagLabelsDraft, setBoxTagLabelsDraft] = useState<Record<string, string>>(stripeSettings.boxTagLabels);
  const [customBoxTag, setCustomBoxTag] = useState('');
  const [boxTagIconsNotice, setBoxTagIconsNotice] = useState(false);

  useEffect(() => {
      setBoxTagIconsDraft(stripeSettings.boxTagIcons);
      setBoxTagLabelsDraft(stripeSettings.boxTagLabels);
  }, [stripeSettings.boxTagIcons, stripeSettings.boxTagLabels]);

  // --- DELETE CONFIRMATION STATE ---
  const [boxToDelete, setBoxToDelete] = useState<string | null>(null);
  const [pendingXpBoxIds, setPendingXpBoxIds] = useState<string[] | null>(null);

  useEffect(() => {
      if (!pendingXpBoxIds) return;
      const createdBox = xpBoxes.find((box) => !pendingXpBoxIds.includes(box.id));
      if (!createdBox) return;
      setXpShopItemDraft((prev) => ({ ...prev, metadata: { ...(prev.metadata ?? {}), caseId: createdBox.id } }));
      setPendingXpBoxIds(null);
      setActiveTab('bonuses');
  }, [pendingXpBoxIds, xpBoxes]);

  const makeId = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
  const formatTimestamp = (ts: number) => new Date(ts).toLocaleString();
  const getBoxExpiryLabel = (box: MysteryBox) => {
      if (!box.createdAt) return 'Created time unavailable';
      const timeRemaining = USER_BOX_EXPIRY_MS - (Date.now() - box.createdAt);
      if (timeRemaining <= 0) return 'Expired (ready to remove)';
      const hoursRemaining = Math.ceil(timeRemaining / (1000 * 60 * 60));
      return `Expires in ${hoursRemaining}h`;
  };
  const formatCoinText = (amount: number, { showSign = true }: { showSign?: boolean } = {}) => {
      const absoluteAmount = showSign ? Math.abs(amount) : amount;
      const formatted = absoluteAmount.toLocaleString(undefined, { maximumFractionDigits: 0 });
      const sign = showSign ? (amount < 0 ? '-' : '+') : '';
      return `${sign}${formatted} coins`;
  };

  const normalizeLedgerEntries = (entries: LedgerEntry[] = [], currentBalance?: number) => {
      const sorted = [...entries].sort((a, b) => {
          const createdDiff = Number(b.createdAt ?? 0) - Number(a.createdAt ?? 0);
          if (createdDiff !== 0) return createdDiff;
          return String(b.id).localeCompare(String(a.id));
      });

      let runningBalance = Number.isFinite(currentBalance) ? Number(currentBalance) : null;

      return sorted.map((entry) => {
          const nextEntry = {
              ...entry,
              amount: Number(entry.amount ?? 0),
              createdAt: Number(entry.createdAt ?? 0)
          };

          if (runningBalance === null) {
              return nextEntry;
          }

          const resolvedBalanceAfter = Number.isFinite(nextEntry.balanceAfter)
              ? Number(nextEntry.balanceAfter)
              : runningBalance;

          runningBalance = resolvedBalanceAfter - nextEntry.amount;

          return {
              ...nextEntry,
              balanceAfter: resolvedBalanceAfter
          };
      });
  };

  const seedInventory = (inventory: InventoryItem[] = [], profileId: string, index: number) => {
      return inventory.map((item, itemIndex) => {
          const provenance = item.provenance ?? {
              sourceType: itemIndex % 2 === 0 ? 'case_open' : 'promo',
              sourceId: `${itemIndex % 2 === 0 ? 'case' : 'promo'}-${profileId.slice(0, 6)}-${itemIndex + 1}`
          };
          const history: InventoryHistoryEntry[] = item.history ?? [
              {
                  id: makeId('history'),
                  action: 'added',
                  createdAt: item.obtainedAt || Date.now() - (index + 1) * 1000 * 60 * 45,
                  note: 'Item added to inventory'
              }
];
          return {
              ...item,
              locked: item.locked ?? false,
              provenance,
              history
          };
      });
  };

  const mapAdminInventoryDoc = (docId: string, data: Record<string, any>): InventoryItem => {
      const rarity = (data.rarity ?? 'common') as InventoryItem['rarity'];
      const obtainedAt = Number(data.obtainedAt ?? Date.now());
      const status = (data.status ?? 'available') as InventoryItem['status'];
      const history = Array.isArray(data.history) ? data.history : [];

      return {
          id: data.prizeId ?? docId,
          instanceId: docId,
          name: data.name ?? 'Mystery Item',
          price: Number(data.value ?? data.price ?? 0),
          image: data.image ?? 'https://picsum.photos/200',
          rarity,
          chance: 0,
          color: data.color ?? rarityColorMap[rarity] ?? '#9ca3af',
          obtainedAt,
          status,
          locked: data.locked ?? false,
          size: typeof data.size === 'string' ? data.size : undefined,
          provenance: data.provenance ?? (data.boxId ? { sourceType: 'case_open', sourceId: data.boxId } : undefined),
          redeemable: data.redeemable ?? true,
          sellBackRate: Number(data.sellBackRate ?? 0),
          freeShipping: data.freeShipping === true,
          shippable: data.shippable === false ? false : true,
          shippingCostOverrideCoins: data.shippingCostOverrideCoins == null ? undefined : Number(data.shippingCostOverrideCoins),
          shippingCostOverrideCents: data.shippingCostOverrideCents == null ? undefined : Number(data.shippingCostOverrideCents),
          history
      };
  };

  const shipmentOrders = useMemo<ShipmentOrderRecord[]>(() => {
      const grouped = new Map<string, Shipment[]>();

      shipments.forEach((shipment, index) => {
          const orderId = shipment.shippingBatchId || shipment.id || `${shipment.uid}-${shipment.inventoryId ?? index}`;
          grouped.set(orderId, [...(grouped.get(orderId) ?? []), shipment]);
      });

      const getOrderStatus = (orderShipments: Shipment[]): Shipment['status'] => {
          if (orderShipments.some((shipment) => shipment.status === 'pending_payment')) return 'pending_payment';
          if (orderShipments.some((shipment) => shipment.status === 'shipping_requested' || shipment.status === 'shipping')) return 'shipping_requested';
          if (orderShipments.length > 0 && orderShipments.every((shipment) => shipment.status === 'shipped')) return 'shipped';
          if (orderShipments.length > 0 && orderShipments.every((shipment) => shipment.status === 'cancelled')) return 'cancelled';
          return orderShipments[0]?.status ?? 'shipping_requested';
      };

      return Array.from(grouped.entries())
          .map(([orderId, orderShipments]) => {
              const sortedShipments = [...orderShipments].sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0));
              const primaryShipment = sortedShipments[0];
              const shipmentUser = users.find((profile) => profile.id === primaryShipment?.uid);
              const shippingCost = sortedShipments.reduce((sum, shipment) => sum + Number(shipment.shippingCost ?? 0), 0);
              const shippingBatchCostCents = Math.max(...sortedShipments.map((shipment) => Number(shipment.shippingBatchCostCents ?? 0)), 0);
              const totalValue = sortedShipments.reduce((sum, shipment) => sum + Number(shipment.item?.value ?? 0), 0);
              const createdAt = Math.min(...sortedShipments.map((shipment) => shipment.createdAt ?? Date.now()));
              const updatedAt = Math.max(...sortedShipments.map((shipment) => shipment.updatedAt ?? shipment.createdAt ?? 0));
              const trackingNumbers = Array.from(new Set(sortedShipments.flatMap((shipment) =>
                  shipment.trackingNumbers?.length ? shipment.trackingNumbers : shipment.trackingNumber ? [shipment.trackingNumber] : []
              )));

              return {
                  id: orderId,
                  key: orderId,
                  shipments: sortedShipments,
                  user: shipmentUser,
                  createdAt,
                  updatedAt,
                  status: getOrderStatus(sortedShipments),
                  itemCount: sortedShipments.length,
                  totalValue,
                  shippingCost,
                  shippingBatchCostCents,
                  shippingPaymentMethod: sortedShipments.find((shipment) => shipment.shippingPaymentMethod)?.shippingPaymentMethod,
                  shippingRateTier: sortedShipments.find((shipment) => shipment.shippingRateTier)?.shippingRateTier,
                  trackingNumbers
              };
          })
          .sort((a, b) => b.createdAt - a.createdAt);
  }, [shipments, users]);

  const filteredShipmentOrders = shipmentOrders.filter((order) => {
      if (shipmentFilter === 'processing') return order.status === 'pending_payment' || order.status === 'shipping' || order.status === 'shipping_requested';
      if (shipmentFilter === 'shipped') return order.status === 'shipped';
      return true;
  });
  useEffect(() => {
      const usersQuery = query(collection(db, 'users'), orderBy('createdAt', 'desc'), limit(250));
      const unsubscribe = onSnapshot(usersQuery, (snapshot) => {
          const nextTransactions: DashboardTransaction[] = [];
          const nextUsers: DashboardUserSummary[] = [];
          snapshot.docs.forEach((docSnap) => {
              const data = docSnap.data() as Record<string, any>;
              const ledger = Array.isArray(data.ledger) ? data.ledger : [];
              const normalizedLedger: LedgerEntry[] = ledger
                  .map((entry: any, index: number) => ({
                      id: String(entry?.id ?? `${docSnap.id}-${index}`),
                      userId: docSnap.id,
                      type: (entry?.type ?? 'admin_adjustment') as LedgerEntryType,
                      amount: Number(entry?.amount ?? 0),
                      createdAt: toMillis(entry?.createdAt, 0)
                  }))
                  .filter((entry) => Number.isFinite(entry.amount) && Number.isFinite(entry.createdAt) && entry.createdAt > 0);
              nextUsers.push({
                  id: docSnap.id,
                  createdAt: toMillis(data.createdAt, 0),
                  balance: Math.max(0, Number(data.balance ?? data.coins ?? 0)),
                  ledger: normalizedLedger
              });
              const userLabel =
                  typeof data.username === 'string' && data.username.trim()
                      ? data.username.trim()
                      : (typeof data.name === 'string' && data.name.trim() ? data.name.trim() : `User_${docSnap.id.slice(0, 6)}`);

              normalizedLedger.forEach((entry, index) => {
                  if (entry.amount === 0) return;
                  nextTransactions.push({
                      id: `${docSnap.id}-${entry.id ?? index}-${entry.createdAt}`,
                      userLabel,
                      type: entry.type,
                      amount: entry.amount,
                      createdAt: entry.createdAt
                  });
              });
          });

          nextTransactions.sort((a, b) => b.createdAt - a.createdAt);
          setDashboardTransactions(nextTransactions.slice(0, 12));
          setDashboardUsers(nextUsers);
      }, (error) => {
          console.error('Dashboard users snapshot failed', error);
      });

      return () => unsubscribe();
  }, []);

  const dashboardStats = useMemo(() => {
      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

      const totalCoins = dashboardUsers.reduce((sum, profile) => sum + Math.max(0, Number(profile.balance ?? 0)), 0);
      const signUpsToday = dashboardUsers.reduce((count, profile) => (
          Number(profile.createdAt ?? 0) >= startOfToday ? count + 1 : count
      ), 0);

      const { depositedToday, spentToday } = dashboardUsers.reduce((totals, profile) => {
          const ledger = profile.ledger ?? [];
          ledger.forEach((entry) => {
              const createdAt = Number(entry.createdAt ?? 0);
              if (!Number.isFinite(createdAt) || createdAt < startOfToday) return;
              const amount = Number(entry.amount ?? 0);
              if (!Number.isFinite(amount) || amount === 0) return;
              if (amount > 0 && entry.type === 'deposit') {
                  totals.depositedToday += amount;
              } else if (amount < 0) {
                  totals.spentToday += Math.abs(amount);
              }
          });
          return totals;
      }, { depositedToday: 0, spentToday: 0 });

      return [
          { title: 'Total Coins', value: totalCoins, icon: CoinStatIcon, color: 'text-green-500', bg: 'bg-green-500/10', isCoin: true },
          { title: 'Sign Ups Today', value: signUpsToday.toLocaleString(), icon: Users, color: 'text-blue-500', bg: 'bg-blue-500/10' },
          { title: 'Coins Deposited Today', value: Math.round(depositedToday), icon: BadgeDollarSign, color: 'text-emerald-500', bg: 'bg-emerald-500/10', isCoin: true },
          { title: 'Coins Spent Today', value: Math.round(spentToday), icon: Activity, color: 'text-orange-400', bg: 'bg-orange-500/10', isCoin: true }
      ];
  }, [dashboardUsers]);

  const liveTransactions = useMemo(
      () => dashboardTransactions.slice(0, 8),
      [dashboardTransactions]
  );

  useEffect(() => {
      if (users.length === 0) return;

      setSelectedUserId((current) => {
          if (isRealSelectedUserId(current) && users.some((profile) => profile.id === current)) return current;
          return null;
      });

      setUserStatuses((prev) => {
          const next = { ...prev };
          users.forEach((profile) => {
              next[profile.id] = profile.status ?? 'active';
          });
          return next;
      });

      setUserLocks((prev) => {
          const next = { ...prev };
          users.forEach((profile) => {
              next[profile.id] = { ...DEFAULT_LOCKS, ...(profile.locks ?? {}) };
          });
          return next;
      });

      setLedgerEntries((prev) => {
          const next = { ...prev };
          users.forEach((profile) => {
              next[profile.id] = normalizeLedgerEntries(profile.ledger ?? next[profile.id] ?? [], profile.balance ?? 0);
          });
          return next;
      });

      setAdminLogs((prev) => {
          const next = { ...prev };
          users.forEach((profile) => {
              next[profile.id] = profile.adminLogs ?? next[profile.id] ?? [];
          });
          return next;
      });

      setInventoryState((prev) => {
          const next = { ...prev };
          users.forEach((profile, index) => {
              if (!next[profile.id] && profile.inventory) {
                  next[profile.id] = seedInventory(profile.inventory, profile.id, index);
              }
          });
          return next;
      });
  }, [users]);

  useEffect(() => {
      setBonusDraft(bonusSettings);
  }, [bonusSettings]);

  useEffect(() => {
      if (activeTab !== 'bonuses') return;
      const rewardsRef = doc(db, 'settings', 'rewards');
      const unsubscribe = onSnapshot(rewardsRef, (snapshot) => {
          const data = snapshot.data() as Record<string, any> | undefined;
          const rankRules = Array.isArray(data?.rewardRules?.payoutsByRank) ? data.rewardRules.payoutsByRank : [];
          const getTopReward = (rank: number, fallback: number) => {
              const exactRule = rankRules.find((entry: any) => Number(entry?.minRank) === rank && Number(entry?.maxRank) === rank);
              return Math.max(0, Number(exactRule?.rewardAmountCoins) || fallback);
          };
          setRewardsDraft({
              enabled: data?.enabled !== false,
              pointsPerCoinSpent: Math.max(0, Number(data?.pointsPerCoinSpent) || 1),
              seasonEndsAt: data?.seasonEndsAt ? new Date(typeof data.seasonEndsAt?.toMillis === 'function' ? data.seasonEndsAt.toMillis() : Number(data.seasonEndsAt)).toISOString().slice(0, 16) : '',
              rewardRulesMode: Array.isArray(data?.rewardRules?.payoutsByPoints) && data.rewardRules.payoutsByPoints.length > 0 ? 'points' : 'rank',
              rankRulesText: JSON.stringify(rankRules.filter((entry: any) => !(Number(entry?.minRank) >= 1 && Number(entry?.maxRank) <= 3)), null, 2),
              pointsRulesText: JSON.stringify(data?.rewardRules?.payoutsByPoints ?? [], null, 2),
              payoutType: ['coins', 'xp', 'item', 'none'].includes(data?.rewardRules?.payoutType) ? data.rewardRules.payoutType : 'coins',
              top1CoinReward: getTopReward(1, DEFAULT_REWARDS_SETTINGS.top1CoinReward),
              top2CoinReward: getTopReward(2, DEFAULT_REWARDS_SETTINGS.top2CoinReward),
              top3CoinReward: getTopReward(3, DEFAULT_REWARDS_SETTINGS.top3CoinReward),
              heroImageUrl: typeof data?.heroImageUrl === 'string' ? data.heroImageUrl : ''
              ,questRulesText: JSON.stringify(data?.questRules ?? JSON.parse(DEFAULT_REWARDS_SETTINGS.questRulesText), null, 2)
          });
      }, (error) => {
          console.error('Rewards settings snapshot failed', error);
      });
      return () => unsubscribe();
  }, [activeTab]);


  useEffect(() => {
      if (activeTab !== 'bonuses') return;
      const pullPassRef = doc(db, 'settings', 'pullPass');
      const unsubscribe = onSnapshot(pullPassRef, (snapshot) => {
          if (!snapshot.exists()) return;
          const data = snapshot.data() as Partial<typeof DEFAULT_PULL_PASS_SETTINGS> & { tiers?: unknown[] };
          setPullPassDraft({
              ...DEFAULT_PULL_PASS_SETTINGS,
              ...data,
              startsAt: typeof data.startsAt === 'string' ? data.startsAt : '',
              endsAt: typeof data.endsAt === 'string' ? data.endsAt : '',
              tiersText: Array.isArray(data.tiers) ? JSON.stringify(data.tiers, null, 2) : (typeof data.tiersText === 'string' ? data.tiersText : DEFAULT_PULL_PASS_SETTINGS.tiersText)
          });
      }, (error) => {
          console.error('Failed to subscribe to Pull Pass settings', error);
      });
      return () => unsubscribe();
  }, [activeTab]);

  const handleSavePullPassSettings = async () => {
      try {
          const parsedTiers = JSON.parse(pullPassDraft.tiersText || '[]');
          if (!Array.isArray(parsedTiers)) {
              window.alert('Pull Pass tiers must be a JSON array.');
              return;
          }
          await setDoc(doc(db, 'settings', 'pullPass'), {
              enabled: pullPassDraft.enabled,
              seasonName: pullPassDraft.seasonName.trim() || DEFAULT_PULL_PASS_SETTINGS.seasonName,
              startsAt: pullPassDraft.startsAt,
              endsAt: pullPassDraft.endsAt,
              coinsPerXp: Math.max(1, Math.floor(Number(pullPassDraft.coinsPerXp) || DEFAULT_PULL_PASS_SETTINGS.coinsPerXp)),
              totalTiers: Math.max(1, Math.floor(Number(pullPassDraft.totalTiers) || DEFAULT_PULL_PASS_SETTINGS.totalTiers)),
              resetOnEnd: pullPassDraft.resetOnEnd !== false,
              tiers: parsedTiers,
              tiersText: JSON.stringify(parsedTiers, null, 2),
              updatedAt: Date.now()
          }, { merge: true });
          setPullPassSettingsNotice(true);
          window.setTimeout(() => setPullPassSettingsNotice(false), 2200);
      } catch (error) {
          console.error('Failed to save Pull Pass settings', error);
          window.alert('Unable to save Pull Pass settings. Check the tier JSON and try again.');
      }
  };

  const handleResetCurrentPullPass = async () => {
      const confirmed = window.confirm(
          `Reset "${pullPassDraft.seasonName || DEFAULT_PULL_PASS_SETTINGS.seasonName}" for every user?\n\nThis clears Pull Pass XP, claims, and active reward-box claim flags. This cannot be undone.`
      );
      if (!confirmed || isResettingPullPass) return;

      setIsResettingPullPass(true);
      setPullPassResetNotice(null);
      try {
          const resetAt = Date.now();
          const usersSnapshot = await getDocs(collection(db, 'users'));

          let batch = writeBatch(db);
          let operationCount = 0;
          const commitIfNeeded = async (force = false) => {
              if (operationCount === 0 || (!force && operationCount < 450)) return;
              await batch.commit();
              batch = writeBatch(db);
              operationCount = 0;
          };

          for (const userDoc of usersSnapshot.docs) {
              batch.set(userDoc.ref, {
                  pullPassSeasonXp: 0,
                  pullPassXp: 0,
                  pullPassClaims: {},
                  activePullPassBoxClaim: deleteField(),
                  pullPass: deleteField(),
                  pullPassLastXpAwardAt: deleteField(),
                  pullPassResetAt: resetAt,
              }, { merge: true });
              operationCount += 1;
              await commitIfNeeded();
          }

          await commitIfNeeded(true);
          await setDoc(doc(db, 'settings', 'pullPass'), {
              lastResetAt: resetAt,
              updatedAt: resetAt,
          }, { merge: true });
          setPullPassResetNotice(`Pull Pass reset complete for ${usersSnapshot.size.toLocaleString()} users. Cleared Pull Pass XP, claims, and active reward-box flags.`);
      } catch (error) {
          console.error('Failed to reset Pull Pass', error);
          window.alert('Unable to reset Pull Pass. Please try again.');
      } finally {
          setIsResettingPullPass(false);
      }
  };

  const handleSaveRewardsSettings = async () => {
      try {
          const parsedRank = JSON.parse(rewardsDraft.rankRulesText || '[]');
          const parsedPoints = JSON.parse(rewardsDraft.pointsRulesText || '[]');
          const parsedQuests = JSON.parse(rewardsDraft.questRulesText || '[]');
          const topRankRules = [
              { minRank: 1, maxRank: 1, rewardAmountCoins: Math.max(0, Math.floor(Number(rewardsDraft.top1CoinReward) || 0)) },
              { minRank: 2, maxRank: 2, rewardAmountCoins: Math.max(0, Math.floor(Number(rewardsDraft.top2CoinReward) || 0)) },
              { minRank: 3, maxRank: 3, rewardAmountCoins: Math.max(0, Math.floor(Number(rewardsDraft.top3CoinReward) || 0)) }
          ];
          await setDoc(doc(db, 'settings', 'rewards'), {
              enabled: rewardsDraft.enabled,
              pointsPerCoinSpent: Math.max(0, Number(rewardsDraft.pointsPerCoinSpent) || 1),
              seasonEndsAt: rewardsDraft.seasonEndsAt ? new Date(rewardsDraft.seasonEndsAt).getTime() : null,
              heroImageUrl: rewardsDraft.heroImageUrl.trim(),
              rewardRules: {
                  payoutType: rewardsDraft.payoutType,
                  payoutsByRank: rewardsDraft.rewardRulesMode === 'rank' ? [...topRankRules, ...parsedRank] : topRankRules,
                  payoutsByPoints: rewardsDraft.rewardRulesMode === 'points' ? parsedPoints : []
              },
              questRules: Array.isArray(parsedQuests) ? parsedQuests : []
          }, { merge: true });
          setRewardsSettingsNotice(true);
          window.setTimeout(() => setRewardsSettingsNotice(false), 2200);
      } catch (error) {
          console.error('Failed to save rewards settings', error);
      }
  };

  const getRewardsSeasonId = () => {
      if (!rewardsDraft.seasonEndsAt) return null;
      const seasonEnd = new Date(rewardsDraft.seasonEndsAt).getTime();
      if (!Number.isFinite(seasonEnd)) return null;
      return `season_${new Date(seasonEnd).toISOString().slice(0, 10)}`;
  };

  const getRewardCoinsForRank = (rank: number) => {
      if (rewardsDraft.payoutType !== 'coins') return 0;
      const baseRules = [
          { minRank: 1, maxRank: 1, rewardAmountCoins: Math.max(0, Math.floor(Number(rewardsDraft.top1CoinReward) || 0)) },
          { minRank: 2, maxRank: 2, rewardAmountCoins: Math.max(0, Math.floor(Number(rewardsDraft.top2CoinReward) || 0)) },
          { minRank: 3, maxRank: 3, rewardAmountCoins: Math.max(0, Math.floor(Number(rewardsDraft.top3CoinReward) || 0)) }
      ];
      let parsedRankRules: Array<{ minRank: number; maxRank: number; rewardAmountCoins?: number }> = [];
      try {
          const parsed = JSON.parse(rewardsDraft.rankRulesText || '[]');
          if (Array.isArray(parsed)) parsedRankRules = parsed;
      } catch {
          parsedRankRules = [];
      }
      const allRules = [...baseRules, ...parsedRankRules];
      const matched = allRules.find((rule) => rank >= Number(rule.minRank) && rank <= Number(rule.maxRank));
      return Math.max(0, Math.floor(Number(matched?.rewardAmountCoins ?? 0)));
  };

  useEffect(() => {
      const seasonId = getRewardsSeasonId();
      const seasonEndTs = rewardsDraft.seasonEndsAt ? new Date(rewardsDraft.seasonEndsAt).getTime() : null;
      if (!seasonId || !seasonEndTs || Date.now() < seasonEndTs) {
          setLeaderboardApprovals([]);
          setSelectedLeaderboardWinnerIds([]);
          return;
      }

      let cancelled = false;
      const loadLeaderboardApprovals = async () => {
          setLeaderboardApprovalsLoading(true);
          try {
              const leaderboardQuery = query(
                  collection(db, 'leaderboards', `rewardsSeason_${seasonId}`, 'users'),
                  orderBy('points', 'desc'),
                  orderBy('updatedAt', 'asc'),
                  limit(500)
              );
              const snapshot = await getDocs(leaderboardQuery);
              if (cancelled) return;
              const rows = snapshot.docs.map((docSnap, index) => {
                  const data = docSnap.data() as Record<string, any>;
                  if (data.hiddenFromLeaderboard === true) return null;
                  const rank = index + 1;
                  return {
                      uid: docSnap.id,
                      displayName: String(data.displayName ?? data.name ?? 'Player'),
                      points: Number(data.points ?? 0),
                      rank,
                      rewardCoins: getRewardCoinsForRank(rank),
                      rewardApprovedAt: data.rewardApprovedAt == null ? undefined : Number(data.rewardApprovedAt)
                  } as LeaderboardApprovalEntry;
              }).filter((row): row is LeaderboardApprovalEntry => row !== null)
                .map((row, index) => ({ ...row, rank: index + 1, rewardCoins: getRewardCoinsForRank(index + 1) }));
              setLeaderboardApprovals(rows);
              setSelectedLeaderboardWinnerIds((prev) => prev.filter((id) => rows.some((row) => row.uid === id && !row.rewardApprovedAt)));
          } catch (error) {
              console.error('Failed to load leaderboard approvals', error);
              setLeaderboardApprovals([]);
          } finally {
              if (!cancelled) setLeaderboardApprovalsLoading(false);
          }
      };

      void loadLeaderboardApprovals();
      return () => {
          cancelled = true;
      };
  }, [rewardsDraft.seasonEndsAt, rewardsDraft.payoutType, rewardsDraft.rankRulesText, rewardsDraft.top1CoinReward, rewardsDraft.top2CoinReward, rewardsDraft.top3CoinReward]);

  const handleApproveLeaderboardWinners = async () => {
      const seasonId = getRewardsSeasonId();
      if (!seasonId || selectedLeaderboardWinnerIds.length === 0 || isApprovingLeaderboardWinners) return;

      setIsApprovingLeaderboardWinners(true);
      setLeaderboardApprovalNotice(null);
      try {
          let approvedCount = 0;
          for (const uid of selectedLeaderboardWinnerIds) {
              const winner = leaderboardApprovals.find((entry) => entry.uid === uid);
              if (!winner || winner.rewardApprovedAt || winner.rewardCoins <= 0) continue;

              await runTransaction(db, async (transaction) => {
                  const userRef = doc(db, 'users', uid);
                  const leaderboardRef = doc(db, 'leaderboards', `rewardsSeason_${seasonId}`, 'users', uid);
                  const userSnap = await transaction.get(userRef);
                  const leaderboardSnap = await transaction.get(leaderboardRef);
                  const leaderboardData = leaderboardSnap.exists() ? (leaderboardSnap.data() as Record<string, any>) : {};
                  if (leaderboardData.rewardApprovedAt) return;

                  const currentBalance = Number(userSnap.data()?.balance ?? 0);
                  const nextBalance = currentBalance + winner.rewardCoins;
                  transaction.set(userRef, { balance: nextBalance }, { merge: true });
                  transaction.set(leaderboardRef, {
                      rewardApprovedAt: Date.now(),
                      rewardApprovedBy: adminUser.id,
                      rewardApprovedCoins: winner.rewardCoins
                  }, { merge: true });
              });

              const winnerCurrentBalance = users.find((profile) => profile.id === uid)?.balance ?? 0;
              appendLedgerEntry(uid, {
                  id: makeId('ledger'),
                  userId: uid,
                  type: 'bonus',
                  amount: winner.rewardCoins,
                  createdAt: Date.now(),
                  balanceAfter: winnerCurrentBalance + winner.rewardCoins,
                  sourceId: `leaderboard-${seasonId}-${winner.rank}`,
                  memo: `Leaderboard reward #${winner.rank}`
              });
              approvedCount += 1;
          }

          setLeaderboardApprovalNotice(approvedCount > 0 ? `Approved ${approvedCount} leaderboard payout${approvedCount === 1 ? '' : 's'}.` : 'No pending winners were approved.');
          setSelectedLeaderboardWinnerIds([]);
      } catch (error) {
          console.error('Failed to approve leaderboard winners', error);
          setLeaderboardApprovalNotice('Failed to approve leaderboard winners.');
      } finally {
          setIsApprovingLeaderboardWinners(false);
      }
  };

  useEffect(() => {
      if (activeTab !== 'settings' && activeTab !== 'bonuses') return;
      const economyRef = doc(db, 'settings', 'economy');
      const unsubscribe = onSnapshot(economyRef, (snapshot) => {
          const data = snapshot.exists() ? snapshot.data() ?? {} : {};
          const nextDraft: EconomySettingsDraft = {
              xpPerDollar: Math.max(1, Number(data.xpPerDollar ?? DEFAULT_ECONOMY_SETTINGS.xpPerDollar) || DEFAULT_ECONOMY_SETTINGS.xpPerDollar),
              coinsPerDollar: Math.max(1, Number(data.coinsPerDollar ?? DEFAULT_ECONOMY_SETTINGS.coinsPerDollar) || DEFAULT_ECONOMY_SETTINGS.coinsPerDollar),
              xpOpenEnabled: data.xpOpenEnabled !== false
          };
          setEconomyDraft(nextDraft);
      }, (error) => {
          console.error('Economy settings snapshot failed', error);
          setEconomyDraft(DEFAULT_ECONOMY_SETTINGS);
      });

      return () => unsubscribe();
  }, [activeTab]);

  useEffect(() => {
      if (!isRealSelectedUserId(selectedUserId)) return;
      const inventoryRef = collection(db, 'users', selectedUserId, 'inventory');
      const unsubscribe = onSnapshot(inventoryRef, (snapshot) => {
          const loaded = snapshot.docs
              .map((docSnap) => mapAdminInventoryDoc(docSnap.id, docSnap.data()))
              .sort((a, b) => b.obtainedAt - a.obtainedAt);
          setInventoryState((prev) => ({ ...prev, [selectedUserId]: loaded }));
      }, (error) => {
          console.error('Admin inventory snapshot failed', error);
      });

      return () => unsubscribe();
  }, [selectedUserId]);

  useEffect(() => {
      setStripeSettingsDraft({
              boxCatalogHeroImageUrl: stripeSettings.boxCatalogHeroImageUrl,
              authPopupImageUrl: stripeSettings.authPopupImageUrl,
          authPopupImageUrls: stripeSettings.authPopupImageUrls,
          homeCategoryImageUrls: stripeSettings.homeCategoryImageUrls,
          homeCategorySlugs: stripeSettings.homeCategorySlugs,
          howItWorksStepImageUrls: stripeSettings.howItWorksStepImageUrls,
          shippingCashEnabled: stripeSettings.shippingCashEnabled,
          shippingFlatRateInput: (stripeSettings.shippingFlatRateCents / 100).toFixed(2),
          stripeShippingProductId: stripeSettings.stripeShippingProductId,
          shippingCoinEnabled: stripeSettings.shippingCoinEnabled,
          shippingCoinCostCoins: stripeSettings.shippingCoinCostCoins,
      shippingRateTiers: stripeSettings.shippingRateTiers.map((tier) => ({ ...tier })),
      shippingProtectionTiers: stripeSettings.shippingProtectionTiers.map((tier) => ({ ...tier })),
      signatureRequiredInput: (stripeSettings.signatureRequiredCents / 100).toFixed(2),
          caseLabPublishFeeCoins: stripeSettings.caseLabPublishFeeCoins,
          caseLabSellBackPercent: stripeSettings.caseLabSellBackPercent,
          caseLabVisibleBoxIds: stripeSettings.caseLabVisibleBoxIds
      });
  }, [stripeSettings]);

  const normalizeTagList = (tags: string[]) => Array.from(new Set(
      tags
          .map((tag) => tag.trim().toLowerCase())
          .filter(Boolean)
  ));

  const normalizeBoxTagList = (tags: string[]) => {
      const normalized = tags
          .map((tag) => tag.trim().toLowerCase())
          .filter(Boolean)
          .map((tag) => tag.slice(0, MAX_BOX_TAG_LENGTH));

      return Array.from(new Set(normalized)).slice(0, MAX_BOX_TAGS);
  };

  const normalizeSizeList = (sizes: string[]) => {
      const seen = new Set<string>();
      return sizes
          .map((size) => size.trim())
          .filter(Boolean)
          .filter((size) => {
              const key = size.toLowerCase();
              if (seen.has(key)) return false;
              seen.add(key);
              return true;
          });
  };

  const addItemTag = (tag: string) => {
      const normalized = tag.trim().toLowerCase();
      if (!normalized) return;
      setNewItem((prev) => ({
          ...prev,
          tags: normalizeTagList([...(prev.tags ?? []), normalized])
      }));
  };

  const removeItemTag = (tag: string) => {
      const normalized = tag.trim().toLowerCase();
      setNewItem((prev) => ({
          ...prev,
          tags: (prev.tags ?? []).filter((existing) => existing.toLowerCase() !== normalized)
      }));
  };

  const addBoxTag = (tag: string) => {
      const normalized = tag.trim();
      if (!normalized) return;
      setNewBox((prev) => ({
          ...prev,
          tags: normalizeBoxTagList([...(prev.tags ?? []), normalized])
      }));
  };

  const removeBoxTag = (tag: string) => {
      const normalized = tag.trim().toLowerCase();
      setNewBox((prev) => ({
          ...prev,
          tags: (prev.tags ?? []).filter((existing) => existing.toLowerCase() !== normalized)
      }));
  };

  const addItemSize = (size: string) => {
      const normalized = size.trim();
      if (!normalized) return;
      setNewItem((prev) => ({
          ...prev,
          sizes: normalizeSizeList([...(prev.sizes ?? []), normalized])
      }));
  };

  const removeItemSize = (size: string) => {
      const normalized = size.trim().toLowerCase();
      setNewItem((prev) => ({
          ...prev,
          sizes: (prev.sizes ?? []).filter((existing) => existing.toLowerCase() !== normalized)
      }));
  };

  const itemBrandOptions = useMemo(() => {
      const brands = new Set<string>();
      items.forEach((item) => {
          const brand = item.brand?.trim();
          if (brand) brands.add(brand);
      });
      return Array.from(brands).sort((a, b) => a.localeCompare(b));
  }, [items]);

  const itemCategoryOptions = useMemo(() => {
      const categories = new Set<string>();
      items.forEach((item) => {
          const category = typeof item.category === 'string' ? item.category.trim() : '';
          if (category) categories.add(category);
      });
      return Array.from(categories).sort((a, b) => a.localeCompare(b));
  }, [items]);

  const itemTagOptions = useMemo(() => {
      const tags = new Set<string>(ITEM_TAG_SUGGESTIONS);
      items.forEach((item) => {
          (item.tags ?? []).forEach((tag) => {
              if (tag) tags.add(tag.toLowerCase());
          });
      });
      return Array.from(tags).sort((a, b) => a.localeCompare(b));
  }, [items]);

  const handleSaveBoxTagIcons = () => {
      const normalized = Object.fromEntries(
          Object.entries(boxTagIconsDraft)
              .map(([tag, iconValue]) => {
                  const normalizedTag = tag.trim().toLowerCase();
                  const trimmedValue = typeof iconValue === 'string' ? iconValue.trim() : '';
                  const sanitizedFa = sanitizeFontAwesomeClass(trimmedValue);
                  const normalizedValue = sanitizedFa || (/^https?:\/\//i.test(trimmedValue) ? trimmedValue : '');
                  return [normalizedTag, normalizedValue] as const;
              })
              .filter(([tag, iconValue]) => tag.length > 0 && iconValue.length > 0)
      );

      updateStripeSettings({
          ...stripeSettings,
          boxTagIcons: normalized,
          boxTagLabels: Object.fromEntries(
              Object.entries(boxTagLabelsDraft)
                  .map(([tag, label]) => [tag.trim().toLowerCase(), String(label).trim()] as const)
                  .filter(([tag, label]) => tag.length > 0 && label.length > 0)
          )
      });
      setBoxTagIconsNotice(true);
      window.setTimeout(() => setBoxTagIconsNotice(false), 3000);
  };

  const addCustomBoxTag = () => {
      const tag = customBoxTag.trim().toLowerCase().replace(/\s+/g, '-');
      if (!tag) return;
      setBoxTagLabelsDraft((previous) => ({ ...previous, [tag]: previous[tag] || tag }));
      setCustomBoxTag('');
  };

  const handleUploadTagSvg = async (tag: string, file: File | null) => {
      if (!file) return;
      const normalizedTag = tag.trim().toLowerCase();
      try {
          const path = `box-tag-icons/${normalizedTag}-${Date.now()}.svg`;
          const storageRef = ref(storage, path);
          await uploadBytes(storageRef, file, { contentType: file.type || 'image/svg+xml' });
          const downloadUrl = await getDownloadURL(storageRef);
          setBoxTagIconsDraft((prev) => ({ ...prev, [normalizedTag]: downloadUrl }));
      } catch (error) {
          console.error('Failed to upload tag svg icon', error);
          alert('Failed to upload SVG icon. Please try again.');
      }
  };

  const filteredItemsForBox = useMemo(() => {
      const normalizedBrand = itemBrandFilter.trim().toLowerCase();
      const normalizedCategory = itemCategoryFilter.trim().toLowerCase();
      const normalizedTagFilters = itemTagFilters.map((tag) => tag.toLowerCase());
      const query = boxItemSearchQuery.trim().toLowerCase();

      return items.filter((item) => {
          const brand = item.brand?.toLowerCase() ?? '';
          const category = item.category?.toLowerCase() ?? '';
          const tags = (item.tags ?? []).map((tag) => tag.toLowerCase());
          const matchesBrand = !normalizedBrand || brand === normalizedBrand;
          const matchesCategory = !normalizedCategory || category === normalizedCategory;
          const matchesTags = normalizedTagFilters.length === 0 || normalizedTagFilters.some((tag) => tags.includes(tag));
          const haystack = [
              item.name,
              item.brand,
              item.category,
              item.rarity,
              item.upgraderCategory,
              ...(item.tags ?? []),
              ...(item.sizes ?? [])
          ]
              .filter(Boolean)
              .join(' ')
              .toLowerCase();
          const matchesSearch = !query || haystack.includes(query);
          return matchesBrand && matchesCategory && matchesTags && matchesSearch;
      });
  }, [items, itemBrandFilter, itemCategoryFilter, itemTagFilters, boxItemSearchQuery]);

  const handleSaveItem = async () => {
      const name = newItem.name?.trim() ?? '';
      const price = Number(newItem.price ?? 0);
      const chance = Number(newItem.chance ?? 0);

      if (!name) {
          setItemFormError('Item name is required.');
          return;
      }
      if (!Number.isFinite(price) || price < 0) {
          setItemFormError('Item price must be 0 or higher.');
          return;
      }
      if (!Number.isFinite(chance) || chance < 0 || chance > 100) {
          setItemFormError('Default chance must be between 0 and 100.');
          return;
      }

      setItemFormError(null);
      const brand = newItem.brand?.trim() ?? '';
      const category = newItem.category?.trim() ?? '';
      const tags = normalizeTagList(newItem.tags ?? []);
      const sizes = normalizeSizeList(newItem.sizes ?? []);
      const upgraderCategory = ['tech', 'collectible', 'apparel'].includes(String(newItem.upgraderCategory ?? ''))
          ? (String(newItem.upgraderCategory) as CaseItem['upgraderCategory'])
          : '';
      const upgraderSort = newItem.upgraderSort == null || newItem.upgraderSort === ''
          ? undefined
          : Number(newItem.upgraderSort);

      const item: CaseItem = {
          id: editingItemId || `custom-item-${Date.now()}`,
          name,
          price,
          image: newItem.image || 'https://picsum.photos/200',
          rarity: newItem.rarity as any || 'common',
          chance,
          color: newItem.color || '#9ca3af',
          brand,
          category,
          tags,
          sizes: sizes.length ? sizes : undefined,
          redeemable: newItem.redeemable ?? true,
          forceFullSellBack: newItem.forceFullSellBack ?? false,
          upgraderEnabled: newItem.upgraderEnabled === true,
          upgraderCategory,
          upgraderSort: Number.isFinite(upgraderSort) ? upgraderSort : undefined,
          upgraderFeatured: newItem.upgraderFeatured === true,
          shippingProfileId: newItem.shippingProfileId || null,
          shippingOverride: newItem.shippingOverride
      };

      console.log("CATALOG ITEM SAVE CLICKED", item);
      console.log("WRITING CATALOG ITEM PATH", `items/${item.id}`);
      try {
          if (editingItemId) {
              await updateItem(item);
              console.log("CATALOG ITEM SAVE SUCCESS", item.id);
              alert("Item Updated!");
          } else {
              await createItem(item);
              console.log("CATALOG ITEM SAVE SUCCESS", item.id);
              alert("Item Created!");
          }
          resetItemForm();
      } catch (error: any) {
          console.error("CATALOG ITEM SAVE FAILED", error?.code, error?.message, error);
          setItemFormError(error?.message ? `Firestore save failed: ${error.message}` : 'Firestore save failed. Please verify your admin permissions and try again.');
      }
  };

  const handleEditItem = (item: CaseItem) => {
      setEditingItemId(item.id);
      setNewItem({
          name: item.name,
          price: item.price,
          image: item.image,
          rarity: item.rarity,
          chance: item.chance,
          color: item.color,
          brand: item.brand ?? '',
          category: item.category ?? '',
          tags: item.tags ?? [],
          sizes: item.sizes ?? [],
          redeemable: item.redeemable ?? true,
          forceFullSellBack: item.forceFullSellBack ?? false,
          upgraderEnabled: item.upgraderEnabled === true,
          upgraderCategory: item.upgraderCategory ?? '',
          upgraderSort: item.upgraderSort,
          upgraderFeatured: item.upgraderFeatured === true,
          shippingProfileId: item.shippingProfileId ?? null,
          shippingOverride: item.shippingOverride
      });
      setItemTagInput('');
      setItemSizeInput('');
      setItemFormError(null);
      window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteItem = async (id: string) => {
      if (confirm("Are you sure you want to delete this item? It will be removed from future box selections, but existing boxes may still reference it.")) {
          await deleteItem(id);
      }
  };

  const resetItemForm = () => {
      setEditingItemId(null);
      setNewItem({
          name: '',
          price: 0,
        priceXP: 0,
        currencyType: 'COIN',
          image: 'https://picsum.photos/200',
          rarity: 'common',
          chance: 10,
          color: '#9ca3af',
          brand: '',
          category: '',
          tags: [],
          sizes: [],
          redeemable: true,
          forceFullSellBack: false,
          upgraderEnabled: false,
          upgraderCategory: '',
          upgraderSort: undefined,
          upgraderFeatured: false,
          shippingProfileId: null
      });
      setItemTagInput('');
      setItemSizeInput('');
      setItemFormError(null);
  };

  const resetPackageForm = () => {
      setEditingPackageId(null);
      setPackageDraft({
          name: '',
          coins: 0,
          bonusCoins: 0,
          defaultSelected: false,
          imageUrl: '',
          displayPrice: '',
          stripePriceId: '',
          badge: undefined,
          active: true,
          sortOrder: 0
      });
      setPackageError(null);
  };

  const openNewPackageModal = () => {
      resetPackageForm();
      setIsPackageModalOpen(true);
  };

  const handleEditPackage = (pkg: CoinPackage) => {
      setEditingPackageId(pkg.id);
      setPackageDraft({ ...pkg });
      setPackageError(null);
      setIsPackageModalOpen(true);
  };

  const handleSavePackage = async () => {
      const name = packageDraft.name?.trim() ?? '';
      const coins = Number(packageDraft.coins ?? 0);
      const bonusCoins = Number(packageDraft.bonusCoins ?? 0);
      const imageUrl = packageDraft.imageUrl?.trim() ?? '';
      const displayPrice = packageDraft.displayPrice?.trim() ?? '';
      const stripePriceId = packageDraft.stripePriceId?.trim() ?? '';
      const sortOrder = Number.isFinite(Number(packageDraft.sortOrder)) ? Number(packageDraft.sortOrder) : 0;
      const active = packageDraft.active ?? true;
      const defaultSelected = packageDraft.defaultSelected ?? false;
      const firstTimeDepositOnly = packageDraft.firstTimeDepositOnly ?? false;
      const badge = packageDraft.badge?.trim() ?? '';

      if (!name) {
          setPackageError('Package name is required.');
          return;
      }
      if (!Number.isFinite(coins) || coins <= 0) {
          setPackageError('Coins must be a positive number.');
          return;
      }
      if (!Number.isFinite(bonusCoins) || bonusCoins < 0 || !Number.isInteger(bonusCoins)) {
          setPackageError('Bonus coins must be a whole number greater than or equal to 0.');
          return;
      }
      if (!displayPrice) {
          setPackageError('Display price is required.');
          return;
      }
      if (imageUrl && !/^https?:\/\//i.test(imageUrl)) {
          setPackageError('Image URL must start with http:// or https://');
          return;
      }
      if (!editingPackageId && !stripePriceId.startsWith('price_')) {
          setPackageError('Stripe price ID must start with "price_".');
          return;
      }

      setIsSavingPackage(true);
      setPackageError(null);
      try {
          if (editingPackageId) {
              await updateCoinPackage(editingPackageId, {
                  name,
                  coins,
                  bonusCoins,
                  defaultSelected,
                  firstTimeDepositOnly,
                  imageUrl,
                  displayPrice,
                  stripePriceId,
                  badge,
                  sortOrder,
                  active
              });
          } else {
              await createCoinPackage({
                  name,
                  coins,
                  bonusCoins,
                  defaultSelected,
                  firstTimeDepositOnly,
                  imageUrl,
                  displayPrice,
                  stripePriceId,
                  badge,
                  sortOrder,
                  active
              });
          }
          setIsPackageModalOpen(false);
          resetPackageForm();
      } catch (error) {
          setPackageError('Failed to save package. Please try again.');
      } finally {
          setIsSavingPackage(false);
      }
  };

  const handleDeletePackage = async (pkg: CoinPackage) => {
      if (deletingPackageId) return;
      if (!confirm(`Delete ${pkg.name || 'this coin package'}? This cannot be undone.`)) return;
      setDeletingPackageId(pkg.id);
      try {
          await deleteCoinPackage(pkg.id);
      } catch (error) {
          alert('Failed to delete package.');
      } finally {
          setDeletingPackageId(null);
      }
  };

  const handleTogglePackageActive = async (pkg: CoinPackage) => {
      try {
          await updateCoinPackage(pkg.id, { active: !pkg.active });
      } catch (error) {
          alert('Failed to update package status.');
      }
  };

  const parseCsvRows = (content: string) => {
      const rows: string[][] = [];
      let current = '';
      let row: string[] = [];
      let inQuotes = false;

      for (let index = 0; index < content.length; index += 1) {
          const char = content[index];
          const nextChar = content[index + 1];

          if (char === '"' && inQuotes && nextChar === '"') {
              current += '"';
              index += 1;
              continue;
          }

          if (char === '"') {
              inQuotes = !inQuotes;
              continue;
          }

          if (!inQuotes && (char === '\n' || char === '\r')) {
              if (char === '\r' && nextChar === '\n') {
                  index += 1;
              }
              row.push(current);
              rows.push(row);
              row = [];
              current = '';
              continue;
          }

          if (!inQuotes && char === ',') {
              row.push(current);
              current = '';
              continue;
          }

          current += char;
      }

      if (current.length > 0 || row.length > 0) {
          row.push(current);
          rows.push(row);
      }

      return rows;
  };

  const parseSpreadsheetItems = (content: string) => {
      const trimmed = content.trim();
      if (!trimmed) {
          return { items: [], errors: ['Spreadsheet is empty.'] };
      }

      const rows = parseCsvRows(trimmed).filter((row) => row.some((cell) => cell.trim() !== ''));
      if (rows.length === 0) {
          return { items: [], errors: ['Spreadsheet has no usable rows.'] };
      }

      const headers = rows[0].map((header) => header.trim().toLowerCase());
      const headerIndex = ITEM_SPREADSHEET_HEADERS.reduce<Record<string, number>>((acc, header) => {
          const index = headers.indexOf(header);
          if (index !== -1) {
              acc[header] = index;
          }
          return acc;
      }, {});

      const missingHeaders = ITEM_SPREADSHEET_REQUIRED_HEADERS.filter((header) => headerIndex[header] === undefined);
      if (missingHeaders.length) {
          return { items: [], errors: [`Missing required headers: ${missingHeaders.join(', ')}.`] };
      }

      const errors: string[] = [];
      const items: CaseItem[] = [];

      rows.slice(1).forEach((row, rowIndex) => {
          const lineNumber = rowIndex + 2;
          const rowErrors: string[] = [];
          const getValue = (header: typeof ITEM_SPREADSHEET_HEADERS[number]) => {
              const index = headerIndex[header];
              if (index === undefined) return '';
              return row[index]?.trim() ?? '';
          };
          const name = getValue('name');
          const priceValue = getValue('price');
          const image = getValue('image');
          const rarityValue = getValue('rarity').toLowerCase() as CaseItem['rarity'];
          const chanceValue = getValue('chance');
          const color = getValue('color');
          const brand = getValue('brand');
          const category = getValue('category');
          const tagsValue = getValue('tags');

          if (!name) {
              rowErrors.push(`Row ${lineNumber}: name is required.`);
          }

          const price = Number(priceValue);
          if (!Number.isFinite(price) || price <= 0) {
              rowErrors.push(`Row ${lineNumber}: price must be a positive number.`);
          }

          if (!image) {
              rowErrors.push(`Row ${lineNumber}: image URL is required.`);
          }

          const isValidRarity = ['common', 'uncommon', 'rare', 'epic', 'legendary'].includes(rarityValue);
          if (!isValidRarity) {
              rowErrors.push(`Row ${lineNumber}: rarity must be common, uncommon, rare, epic, or legendary.`);
          }

          const chance = Number(chanceValue);
          if (!Number.isFinite(chance) || chance < 0 || chance > 100) {
              rowErrors.push(`Row ${lineNumber}: chance must be between 0 and 100.`);
          }

          if (!color) {
              rowErrors.push(`Row ${lineNumber}: color is required.`);
          }

          const tags = tagsValue
              ? tagsValue
                    .split(/[|;]/)
                    .map((tag) => tag.trim().toLowerCase())
                    .filter(Boolean)
              : [];
          const normalizedTags = normalizeTagList(tags);

          if (rowErrors.length === 0) {
              items.push({
                  id: `spreadsheet-${Date.now()}-${rowIndex}`,
                  name,
                  price,
                  image,
                  rarity: rarityValue,
                  chance,
                  color,
                  brand: brand.trim(),
                  category: category.trim(),
                  tags: normalizedTags,
                  redeemable: true,
                  upgraderEnabled: false,
                  upgraderCategory: '',
                  upgraderFeatured: false
              });
          }
          errors.push(...rowErrors);
      });

      return { items, errors };
  };

  const handleSpreadsheetUpload = async (file: File) => {
      setSpreadsheetStatus(null);
      setIsSpreadsheetUploading(true);

      try {
          const content = await file.text();
          const { items, errors } = parseSpreadsheetItems(content);

          if (errors.length) {
              setSpreadsheetStatus({ tone: 'error', message: errors.slice(0, 6).join(' ') });
              return;
          }

          if (!items.length) {
              setSpreadsheetStatus({ tone: 'error', message: 'No valid rows found to import.' });
              return;
          }

          for (const item of items) {
              await createItem(item);
          }

          setSpreadsheetStatus({
              tone: 'success',
              message: `Imported ${items.length} item${items.length === 1 ? '' : 's'} successfully.`
          });
          if (spreadsheetInputRef.current) {
              spreadsheetInputRef.current.value = '';
          }
      } catch (error) {
          setSpreadsheetStatus({ tone: 'error', message: 'Unable to read the spreadsheet. Please try again.' });
      } finally {
          setIsSpreadsheetUploading(false);
      }
  };

  const handleDownloadTemplate = () => {
      const blob = new Blob([ITEM_SPREADSHEET_TEMPLATE], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'pullzgg-item-upload-template.csv';
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
  };

  const startEditUser = (userId: string, xp: number) => {
      setEditingUserId(userId);
      setUserXpInput(xp);
  };

  const cancelEditUser = () => {
      setEditingUserId(null);
      setUserXpInput(0);
  };

  const saveUserProgress = async (userId: string) => {
      setIsSavingUser(true);
      const previousXp = users.find((profile) => profile.id === userId)?.xp ?? 0;
      await updateUserProgress(userId, userXpInput);
      logAdminAction(
          userId,
          'xp_update',
          { xp: previousXp },
          { xp: userXpInput },
          'Updated user XP'
      );
      setIsSavingUser(false);
      setEditingUserId(null);
      alert('User progress updated!');
  };

  const handleSendAdminNotification = async () => {
      const message = adminNotification.trim();
      if (!message) return;
      setIsSendingAdminNotice(true);
      try {
          await sendAdminNotification(message);
          setAdminNotification('');
          setAdminNoticeSent(true);
          setTimeout(() => setAdminNoticeSent(false), 3000);
      } finally {
          setIsSendingAdminNotice(false);
      }
  };

  const handleDeleteSentNotification = async (notificationId: string) => {
      if (!notificationId || deletingAdminNoticeId) return;
      setDeletingAdminNoticeId(notificationId);
      try {
          await deleteDoc(doc(db, 'adminNotifications', notificationId));
      } finally {
          setDeletingAdminNoticeId(null);
      }
  };

  const isXpBox = (newBox.currencyType ?? 'COIN') === 'XP';
  const effectiveBoxPrice = isXpBox
      ? Number(newBox.priceXP ?? 0)
      : Number(newBox.price ?? 0);
  const hasExplicitBoxPrice = Number.isFinite(effectiveBoxPrice) && effectiveBoxPrice >= 0;

  const applyRarityOverrides = (computedItems: CaseItem[], sourceItems: CaseItem[] = selectedItems) => {
      const rarityLookup = new Map(
          sourceItems.map((entry) => [
              String(entry.id ?? entry.name),
              { rarity: entry.rarity, color: entry.color }
          ])
      );
      return computedItems.map((entry) => {
          const override = rarityLookup.get(String(entry.id ?? entry.name));
          return override
              ? { ...entry, rarity: override.rarity, color: override.color }
              : entry;
      });
  };

  const getAutoCalculatedBoxItems = (sourceItems: CaseItem[]) => {
      const baseSelection = sourceItems.map(item => ({ ...item, chance: 0 }));
      const baseItems = buildRiskAdjustedOdds(baseSelection, riskBalance);
      const baseEv = calculateExpectedValue(baseItems);
      const calculatedPrice = hasExplicitBoxPrice
        ? effectiveBoxPrice
        : baseEv / clampedTargetEV;
      const updatedItems = applyRarityOverrides(
          buildOddsWithRiskAndTargetEV(baseSelection, riskBalance, clampedTargetEV, calculatedPrice),
          sourceItems
      );

      return { updatedItems, calculatedPrice };
  };

  const calculateBoxConfig = () => {
      if (selectedItems.length === 0) return;
      const { updatedItems, calculatedPrice } = getAutoCalculatedBoxItems(selectedItems);

      // Apply updates
      setSelectedItems(updatedItems);
      setOddsEditorMode('auto');
      setNewBox(prev => ({
          ...prev,
          [isXpBox ? 'priceXP' : 'price']: parseFloat(calculatedPrice.toFixed(2))
      }));
  };

  useEffect(() => {
      if (oddsEditorMode !== 'auto') return;
      setSelectedItems((prev) => {
          if (prev.length === 0) return prev;

          const { updatedItems, calculatedPrice } = getAutoCalculatedBoxItems(prev);

          if (!hasExplicitBoxPrice) {
              setNewBox((current) => ({
                  ...current,
                  [isXpBox ? 'priceXP' : 'price']: parseFloat(calculatedPrice.toFixed(2))
              }));
          }

          return updatedItems;
      });
  }, [clampedTargetEV, effectiveBoxPrice, hasExplicitBoxPrice, isXpBox, oddsEditorMode, riskBalance]);

  const updateAdminLogs = (targetUserId: string, updater: (entries: AdminActionLog[]) => AdminActionLog[]) => {
      setAdminLogs((prev) => {
          const nextEntries = updater(prev[targetUserId] ?? []);
          void updateUserAdminData(targetUserId, { adminLogs: nextEntries });
          return { ...prev, [targetUserId]: nextEntries };
      });
  };

  const updateLedgerRecords = (targetUserId: string, updater: (entries: LedgerEntry[]) => LedgerEntry[]) => {
      setLedgerEntries((prev) => {
          const nextEntries = updater(prev[targetUserId] ?? []);
          void updateUserAdminData(targetUserId, { ledger: nextEntries });
          return { ...prev, [targetUserId]: nextEntries };
      });
  };

  const updateInventoryRecords = (targetUserId: string, updater: (items: InventoryItem[]) => InventoryItem[]) => {
      setInventoryState((prev) => {
          const nextItems = updater(prev[targetUserId] ?? []);
          void updateUserAdminData(targetUserId, { inventory: nextItems });
          return { ...prev, [targetUserId]: nextItems };
      });
  };

  const startBalanceEdit = () => {
      if (!selectedUser) return;
      setBalanceDraft(String(selectedUser.balance ?? 0));
      setIsEditingBalance(true);
  };

  const cancelBalanceEdit = () => {
      setIsEditingBalance(false);
      setBalanceDraft('');
  };

  const saveBalanceEdit = async () => {
      if (!selectedUser) return;
      const nextBalance = Number(balanceDraft);
      if (!Number.isFinite(nextBalance)) return;
      const previousBalance = selectedUser.balance ?? 0;
      await updateUserBalance(selectedUser.id, nextBalance);
      const delta = nextBalance - previousBalance;
      if (delta !== 0) {
          appendLedgerEntry(selectedUser.id, {
              id: makeId('ledger'),
              userId: selectedUser.id,
              type: 'admin_adjustment',
              amount: delta,
              createdAt: Date.now(),
              balanceAfter: nextBalance,
              sourceId: `admin-balance-${selectedUser.id.slice(0, 6)}`,
              memo: 'Admin balance edit'
          });
      }
      logAdminAction(
          selectedUser.id,
          'balance_update',
          { balance: previousBalance },
          { balance: nextBalance },
          'Updated user balance'
      );
      setIsEditingBalance(false);
      setBalanceDraft('');
  };

  const handleAddInventoryItem = async () => {
      const targetUserId = selectedUserId?.trim() ?? '';
      const name = inventoryDraft.name.trim();
      const price = Number(inventoryDraft.price);
      const rarity = (inventoryDraft.rarity || 'common') as InventoryItem['rarity'];
      const now = Date.now();
      const instanceId = makeId('inv-instance');
      const inventoryPath = targetUserId ? `users/${targetUserId}/inventory/${instanceId}` : 'users/<missing>/inventory/<pending>';

      console.log('SAVE ITEM CLICKED', {
          selectedUserId: targetUserId || null,
          firestorePath: inventoryPath
      });

      if (!targetUserId || targetUserId === 'loading') {
          const message = 'Select a real user before adding an inventory item.';
          setInventorySaveError(message);
          console.error('SAVE ITEM FAILED', {
              selectedUserId: targetUserId || null,
              firestorePath: inventoryPath,
              code: 'invalid-selected-user',
              message
          });
          return;
      }
      if (!name || !Number.isFinite(price) || price < 0) {
          const message = 'Enter an item name and a non-negative value before saving.';
          setInventorySaveError(message);
          console.error('SAVE ITEM FAILED', {
              selectedUserId: targetUserId,
              firestorePath: inventoryPath,
              code: 'invalid-item-payload',
              message
          });
          return;
      }

      const image = inventoryDraft.image.trim() || 'https://picsum.photos/200';
      const history: InventoryHistoryEntry[] = [
          {
              id: makeId('history'),
              action: 'added',
              createdAt: now,
              note: 'Added by admin',
              adminUid: adminUser?.id ?? 'admin'
          }
      ];
      const newItem: InventoryItem = {
          id: instanceId,
          instanceId,
          name,
          price,
          image,
          rarity,
          chance: 0,
          color: rarityColorMap[rarity] ?? '#9ca3af',
          obtainedAt: now,
          status: 'available',
          locked: false,
          shippable: true,
          source: 'admin',
          provenance: {
              sourceType: 'admin_adjustment',
              sourceId: instanceId
          },
          history
      };
      const itemPayload = {
          name: newItem.name,
          value: newItem.price,
          price: newItem.price,
          image: newItem.image,
          cardImage: newItem.image,
          rarity: newItem.rarity,
          status: 'available',
          shippable: true,
          locked: false,
          obtainedAt: newItem.obtainedAt,
          createdAt: now,
          source: 'admin',
          history,
          provenance: newItem.provenance,
          redeemable: true,
          sellBackRate: 0
      };

      console.log('SAVE ITEM PAYLOAD', {
          selectedUserId: targetUserId,
          firestorePath: inventoryPath,
          itemPayload
      });

      try {
          await setDoc(doc(db, 'users', targetUserId, 'inventory', instanceId), itemPayload);

          const adminLogPath = `users/${targetUserId}/adminLogs`;
          const auditLogPath = 'auditLogs';
          const logPayload = {
              adminUid: adminUser?.id ?? 'admin',
              targetUserUid: targetUserId,
              actionType: 'inventory_add',
              before: {},
              after: { instanceId: newItem.instanceId, name: newItem.name, price: newItem.price },
              reason: 'Added inventory item',
              createdAt: now
          };
          console.log('SAVE ITEM ADMIN LOG PATHS', {
              selectedUserId: targetUserId,
              adminLogPath,
              auditLogPath
          });
          const adminLogRef = await addDoc(collection(db, 'users', targetUserId, 'adminLogs'), logPayload);
          await addDoc(collection(db, 'auditLogs'), {
              ...logPayload,
              userAdminLogId: adminLogRef.id
          });

          setInventoryState((prev) => ({
              ...prev,
              [targetUserId]: [newItem, ...(prev[targetUserId] ?? []).filter((item) => item.instanceId !== instanceId)]
          }));
          setAdminLogs((prev) => ({
              ...prev,
              [targetUserId]: [{ id: adminLogRef.id, ...logPayload }, ...(prev[targetUserId] ?? [])]
          }));
          setInventorySaveError(null);
          console.log('SAVE ITEM SUCCESS', {
              selectedUserId: targetUserId,
              firestorePath: inventoryPath,
              adminLogPath: `${adminLogPath}/${adminLogRef.id}`
          });
          setInventoryDraft({
              name: '',
              price: '',
              image: '',
              rarity: 'common',
              status: 'available'
          });
      } catch (error: any) {
          const code = error?.code ?? 'unknown';
          const message = error?.message ?? String(error);
          console.error('SAVE ITEM FAILED', {
              selectedUserId: targetUserId,
              firestorePath: inventoryPath,
              code,
              message,
              error
          });
          setInventorySaveError(`Failed to add inventory item: ${code} ${message}`);
      }
  };

  const handleRemoveInventoryItem = async (targetUserId: string, instanceId: string) => {
      try {
          await deleteDoc(doc(db, 'users', targetUserId, 'inventory', instanceId));
      } catch (error) {
          console.error('Failed to remove inventory item from Firebase', error);
      }
      updateInventoryRecords(targetUserId, (items) => items.filter((item) => item.instanceId !== instanceId));
      logAdminAction(
          targetUserId,
          'inventory_remove',
          { instanceId },
          { instanceId },
          'Removed inventory item'
      );
  };

  const logAdminAction = (targetUserId: string, actionType: string, before: Record<string, unknown>, after: Record<string, unknown>, reason: string) => {
      const entry: AdminActionLog = {
          id: makeId('admin-log'),
          adminUid: adminUser?.id ?? 'admin',
          targetUserUid: targetUserId,
          actionType,
          before,
          after,
          reason,
          createdAt: Date.now()
      };
      updateAdminLogs(targetUserId, (entries) => [entry, ...entries]);
  };

  const appendLedgerEntry = (targetUserId: string, entry: LedgerEntry) => {
      updateLedgerRecords(targetUserId, (entries) => {
          const entryWithBalance = {
              ...entry,
              balanceAfter: entry.balanceAfter
          };
          const nextEntries = [entryWithBalance, ...entries];
          const currentUserBalance = users.find((profile) => profile.id === targetUserId)?.balance ?? entryWithBalance.balanceAfter ?? 0;
          return normalizeLedgerEntries(nextEntries, currentUserBalance);
      });
  };

  const handleStatusChange = async (targetUserId: string, nextStatus: UserStatus) => {
      const previousStatus = userStatuses[targetUserId] ?? 'active';
      setUserStatuses((prev) => ({ ...prev, [targetUserId]: nextStatus }));
      try {
          await authedFetch('/api/admin/users', {
              method: 'PATCH',
              body: JSON.stringify({ userId: targetUserId, status: nextStatus })
          });
      } catch (error) {
          setUserStatuses((prev) => ({ ...prev, [targetUserId]: previousStatus }));
          console.error('Failed to update account status', error);
          window.alert('Unable to update account status. Please try again.');
          return;
      }
      logAdminAction(
          targetUserId,
          'status_update',
          { status: previousStatus },
          { status: nextStatus },
          `Status changed to ${nextStatus}`
      );
  };

  const handlePublicVisibilityToggle = (targetUserId: string) => {
      const targetUser = users.find((profile) => profile.id === targetUserId);
      const previousHidden = targetUser?.hiddenFromLeaderboard === true || targetUser?.hiddenFromPublicDisplay === true;
      const nextHidden = !previousHidden;
      void updateUserAdminData(targetUserId, {
          hiddenFromLeaderboard: nextHidden,
          hiddenFromPublicDisplay: nextHidden
      });

      const seasonId = getRewardsSeasonId();
      if (seasonId) {
          void setDoc(
              doc(db, 'leaderboards', `rewardsSeason_${seasonId}`, 'users', targetUserId),
              { hiddenFromLeaderboard: nextHidden, hiddenFromPublicDisplay: nextHidden, updatedAt: serverTimestamp() },
              { merge: true }
          ).catch((error) => {
              console.error('Failed to sync leaderboard visibility flag', error);
          });
      }

      logAdminAction(
          targetUserId,
          'public_visibility_toggle',
          { hiddenFromLeaderboard: previousHidden, hiddenFromPublicDisplay: previousHidden },
          { hiddenFromLeaderboard: nextHidden, hiddenFromPublicDisplay: nextHidden },
          nextHidden ? 'Hidden from leaderboard and public display' : 'Restored to leaderboard and public display'
      );
  };

  const handleLockToggle = (targetUserId: string, lockKey: keyof UserLocks) => {
      setUserLocks((prev) => {
          const currentLocks = prev[targetUserId] ?? { ...DEFAULT_LOCKS };
          const nextLocks = { ...currentLocks, [lockKey]: !currentLocks[lockKey] };
          void updateUserAdminData(targetUserId, { locks: nextLocks });
          logAdminAction(
              targetUserId,
              'lock_toggle',
              { [lockKey]: currentLocks[lockKey] },
              { [lockKey]: nextLocks[lockKey] },
              `Toggled ${lockKey} lock`
          );
          return { ...prev, [targetUserId]: nextLocks };
      });
  };

  const handleInventoryLockToggle = (targetUserId: string, instanceId: string) => {
      updateInventoryRecords(targetUserId, (items) => {
          const nextItems = items.map((item) => {
              if (item.instanceId !== instanceId) return item;
              const nextLocked = !item.locked;
              const historyEntry: InventoryHistoryEntry = {
                  id: makeId('history'),
                  action: nextLocked ? 'locked' : 'unlocked',
                  createdAt: Date.now(),
                  note: `Item ${nextLocked ? 'locked' : 'unlocked'} by admin`,
                  adminUid: adminUser?.id ?? 'admin'
              };
              return {
                  ...item,
                  locked: nextLocked,
                  history: [historyEntry, ...(item.history ?? [])]
              };
          });

          const updatedItem = nextItems.find((item) => item.instanceId === instanceId);
          if (updatedItem) {
              void setDoc(
                  doc(db, 'users', targetUserId, 'inventory', instanceId),
                  {
                      locked: updatedItem.locked,
                      history: updatedItem.history ?? []
                  },
                  { merge: true }
              ).catch((error) => {
                  console.error('Failed to toggle inventory lock in Firebase', error);
              });
          }

          logAdminAction(
              targetUserId,
              'inventory_lock',
              { instanceId },
              { instanceId, locked: updatedItem?.locked },
              'Inventory lock toggled'
          );
          return nextItems;
      });
  };

  const handleCreateReversal = () => {
      if (!selectedUserId || !selectedUser) return;
      const amountValue = Number(reversalAmount);
      if (!amountValue || !reversalReason.trim()) return;
      const delta = -Math.abs(amountValue);
      const nextBalance = Math.max(0, Number(selectedUser.balance ?? 0) + delta);
      void updateUserBalance(selectedUserId, nextBalance);
      const entry: LedgerEntry = {
          id: makeId('ledger'),
          userId: selectedUserId,
          type: 'reversal',
          amount: delta,
          createdAt: Date.now(),
          balanceAfter: nextBalance,
          sourceId: `reversal-${selectedUserId.slice(0, 6)}`,
          memo: reversalReason.trim()
      };
      appendLedgerEntry(selectedUserId, entry);
      logAdminAction(
          selectedUserId,
          'ledger_reversal',
          { amount: 0 },
          { amount: entry.amount },
          reversalReason.trim()
      );
      setReversalAmount('');
      setReversalReason('');
  };

  const handleVoidOpen = () => {
      if (!selectedUserId || !selectedUser || !voidSourceId.trim()) return;
      const items = inventoryState[selectedUserId] ?? [];
      const impactedItems = items.filter((item) => item.provenance?.sourceId === voidSourceId.trim());
      const totalValue = impactedItems.reduce(
          (sum, item) => sum + toCoins(item.price, PRICE_UNIT_MODE),
          0
      );
      const delta = totalValue === 0 ? 0 : -Math.abs(totalValue);
      const nextBalance = Math.max(0, Number(selectedUser.balance ?? 0) + delta);
      if (delta !== 0) {
          void updateUserBalance(selectedUserId, nextBalance);
      }
      const entry: LedgerEntry = {
          id: makeId('ledger'),
          userId: selectedUserId,
          type: 'reversal',
          amount: delta,
          createdAt: Date.now(),
          balanceAfter: nextBalance,
          sourceId: voidSourceId.trim(),
          memo: voidReason.trim() || 'Voided box open'
      };
      appendLedgerEntry(selectedUserId, entry);
      updateInventoryRecords(selectedUserId, (prevItems) => {
          const nextItems = prevItems.map((item) => {
              if (item.provenance?.sourceId !== voidSourceId.trim()) return item;
              const historyEntry: InventoryHistoryEntry = {
                  id: makeId('history'),
                  action: 'void_open',
                  createdAt: Date.now(),
                  note: voidReason.trim() || 'Box open voided',
                  adminUid: adminUser?.id ?? 'admin'
              };
              return {
                  ...item,
                  locked: true,
                  history: [historyEntry, ...(item.history ?? [])]
              };
          });
          return nextItems;
      });
      logAdminAction(
          selectedUserId,
          'void_case_open',
          { sourceId: voidSourceId.trim(), affectedItems: impactedItems.length },
          { ledgerAmount: entry.amount, affectedItems: impactedItems.length },
          voidReason.trim() || 'Box open voided'
      );
      setVoidSourceId('');
      setVoidReason('');
  };

  const toggleUsersSort = (key: 'user' | 'created' | 'lastActive' | 'status' | 'coins' | 'inventoryValue' | 'lifetimeDeposits' | 'lifetimeSpent' | 'pendingShipments' | 'risk') => {
      setUsersSort((prev) => ({
          key,
          direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc'
      }));
  };

  const toggleInternalLabel = (userId: string, label: string) => {
      setUserInternalLabels((prev) => {
          const current = prev[userId] ?? [];
          const next = current.includes(label) ? current.filter((entry) => entry !== label) : [...current, label];
          void updateUserAdminData(userId, { internalLabels: next }); // TODO: persist when backend model formalizes internalLabels.
          return { ...prev, [userId]: next };
      });
  };

  const saveAdminNote = (userId: string) => {
      const note = userAdminNotes[userId] ?? '';
      void updateUserAdminData(userId, { adminNotes: note }); // TODO: replace with dedicated admin notes collection when available.
  };

  const selectedUser = useMemo(() => isRealSelectedUserId(selectedUserId) ? users.find((profile) => profile.id === selectedUserId) : undefined, [users, selectedUserId]);
  useEffect(() => {
      setPhoneVerificationDraft(selectedUser?.phoneNumber ?? '');
      setPhoneVerificationState({ saving: false });
  }, [selectedUser?.id]);

  const handleAdminPhoneVerification = async () => {
      if (!selectedUser || phoneVerificationState.saving) return;
      const phoneNumber = phoneVerificationDraft.trim();
      if (!phoneNumber) {
          setPhoneVerificationState({ saving: false, error: 'Enter a phone number with its country code.' });
          return;
      }
      setPhoneVerificationState({ saving: true });
      try {
          const result = await authedFetch<{ phoneNumber: string }>('/api/admin/users', {
              method: 'PATCH',
              body: JSON.stringify({ action: 'verify_phone', userId: selectedUser.id, phoneNumber })
          });
          await updateUserAdminData(selectedUser.id, { phoneNumber: result.phoneNumber });
          setPhoneVerificationDraft(result.phoneNumber);
          setPhoneVerificationState({ saving: false, success: 'Phone number manually verified.' });
          logAdminAction(selectedUser.id, 'phone_verification', { phoneNumber: selectedUser.phoneNumber ?? null }, { phoneNumber: result.phoneNumber }, 'Manually verified phone number');
      } catch (error) {
          const message = error instanceof Error && error.message.includes('PHONE_NUMBER_ALREADY_IN_USE')
              ? 'That phone number is already assigned to another account.'
              : error instanceof Error && error.message.includes('INVALID_PHONE_NUMBER')
                  ? 'Enter a valid phone number with its country code.'
                  : 'Unable to verify this phone number right now.';
          setPhoneVerificationState({ saving: false, error: message });
      }
  };
  const signupIpAccounts = useMemo(() => {
      const grouped = new Map<string, typeof users>();
      users.forEach((profile) => {
          if (!profile.signupIp) return;
          grouped.set(profile.signupIp, [...(grouped.get(profile.signupIp) ?? []), profile]);
      });
      return grouped;
  }, [users]);
  const selectedIpAccounts = selectedSignupIp ? signupIpAccounts.get(selectedSignupIp) ?? [] : [];
  const flaggedSignupIps = useMemo(
      () => Array.from(signupIpAccounts.entries()).filter(([, accounts]) => accounts.length > 1),
      [signupIpAccounts]
  );
  const flaggedAccountCount = flaggedSignupIps.reduce((total, [, accounts]) => total + accounts.length, 0);
  const reviewFlaggedAccounts = () => {
      setUsersQuickFilter('shared_ip');
      setSelectedSignupIp(flaggedSignupIps[0]?.[0] ?? null);
  };
  const normalizedUserSearch = userSearchQuery.trim().toLowerCase();
  const getUserLabels = (profile: (typeof users)[number]) => {
      const profileLabels = (profile as unknown as { internalLabels?: string[] }).internalLabels ?? [];
      return userInternalLabels[profile.id] ?? profileLabels;
  };
  const getUserMetrics = (profile: (typeof users)[number]) => {
      const inventory = inventoryState[profile.id] ?? profile.inventory ?? [];
      const ledger = ledgerEntries[profile.id] ?? profile.ledger ?? [];
      const logs = adminLogs[profile.id] ?? profile.adminLogs ?? [];
      const pendingShipmentCount = shipments.filter((shipment) => shipment.uid === profile.id && shipment.status !== 'shipped').length;
      const supportTicketCount = supportCases.filter((caseItem) => caseItem.uid === profile.id && caseItem.status !== 'Closed').length;
      const lifetimeDeposits = ledger.filter((entry) => entry.type === 'deposit').reduce((sum, entry) => sum + Math.max(0, entry.amount), 0);
      const lifetimeSpent = Math.abs(ledger.filter((entry) => entry.type === 'case_open').reduce((sum, entry) => sum + Math.min(0, entry.amount), 0));
      const lifetimeSellback = ledger.filter((entry) => entry.type === 'sell_back').reduce((sum, entry) => sum + Math.max(0, entry.amount), 0);
      const inventoryValue = inventory.reduce((sum, item) => sum + Number(item.price ?? 0), 0);
      const hasRapidSellback = lifetimeSellback > 0 && lifetimeSpent > 0 && lifetimeSellback / lifetimeSpent > 0.75;
      const failedPaymentCount = logs.filter((entry) => entry.actionType.includes('payment') || entry.reason.toLowerCase().includes('payment failed')).length;
      const chargebackCount = ledger.filter((entry) => entry.type === 'chargeback_reversal').length;
      const excessiveAdminAdjustments = logs.filter((entry) => entry.actionType.includes('admin') || entry.reason.toLowerCase().includes('adjust')).length;
      const accountAgeMs = Date.now() - (profile.createdAt ?? Date.now());
      const isNewHighValue = accountAgeMs < 7 * 24 * 60 * 60 * 1000 && (lifetimeDeposits > 25000 || Number(profile.balance ?? 0) > 20000);
      const suspiciousFlags = [chargebackCount > 0, failedPaymentCount > 1, hasRapidSellback, isNewHighValue, pendingShipmentCount > 2, excessiveAdminAdjustments > 4].filter(Boolean).length;
      const riskScore = Math.min(10, Math.max(0, Number(profile.fraudScore ?? 0)));
      const riskLevel = riskScore >= 8 ? 'High' : riskScore >= 4 ? 'Medium' : 'Low';
      const lastActive = (profile as unknown as { lastActiveAt?: number }).lastActiveAt ?? ledger[0]?.createdAt ?? profile.createdAt ?? Date.now();
      const biggestWin = inventory.reduce((best, item) => Math.max(best, Number(item.price ?? 0)), 0);
      return {
          inventory,
          logs,
          pendingShipmentCount,
          supportTicketCount,
          lifetimeDeposits,
          lifetimeSpent,
          lifetimeSellback,
          inventoryValue,
          hasRapidSellback,
          failedPaymentCount,
          chargebackCount,
          excessiveAdminAdjustments,
          isNewHighValue,
          suspiciousFlags,
          riskScore,
          riskLevel,
          lastActive,
          biggestWin
      };
  };

  const filteredUsers = useMemo(() => {
      const searched = normalizedUserSearch
          ? users.filter((profile) => {
              const metrics = getUserMetrics(profile);
              const searchableFields = [
                  profile.name,
                  profile.username,
                  profile.displayName,
                  profile.email,
                  profile.id,
                  profile.signupIp,
                  profile.autoBanReason,
                  String(profile.balance ?? 0),
                  String(metrics.inventory.length),
                  String(metrics.riskScore),
                  ...getUserLabels(profile)
              ]
                  .filter(Boolean)
                  .join(' ')
                  .toLowerCase();
              return searchableFields.includes(normalizedUserSearch);
          })
          : users;

      const quickFiltered = searched.filter((profile) => {
          const metrics = getUserMetrics(profile);
          const locked = Object.values(userLocks[profile.id] ?? DEFAULT_LOCKS).some(Boolean);
          if (usersQuickFilter === 'shared_ip') return Boolean(profile.signupIp && (signupIpAccounts.get(profile.signupIp)?.length ?? 0) > 1);
          if (usersQuickFilter === 'locked') return locked;
          if (usersQuickFilter === 'high_risk') return metrics.riskScore >= 8;
          if (usersQuickFilter === 'empty_inventory') return metrics.inventory.length === 0;
          if (usersQuickFilter === 'high_value') return metrics.lifetimeDeposits >= 25000 || metrics.inventoryValue >= 15000;
          return true;
      });

      const direction = usersSort.direction === 'asc' ? 1 : -1;
      return [...quickFiltered].sort((a, b) => {
          const am = getUserMetrics(a);
          const bm = getUserMetrics(b);
          const aStatus = userStatuses[a.id] ?? 'active';
          const bStatus = userStatuses[b.id] ?? 'active';
          const comparisons: Record<typeof usersSort.key, number> = {
              user: (a.name || '').localeCompare(b.name || ''),
              created: (a.createdAt ?? 0) - (b.createdAt ?? 0),
              lastActive: am.lastActive - bm.lastActive,
              status: aStatus.localeCompare(bStatus),
              coins: Number(a.balance ?? 0) - Number(b.balance ?? 0),
              inventoryValue: am.inventoryValue - bm.inventoryValue,
              lifetimeDeposits: am.lifetimeDeposits - bm.lifetimeDeposits,
              lifetimeSpent: am.lifetimeSpent - bm.lifetimeSpent,
              pendingShipments: am.pendingShipmentCount - bm.pendingShipmentCount,
              risk: am.riskScore - bm.riskScore
          };
          return comparisons[usersSort.key] * direction;
      });
  }, [normalizedUserSearch, users, usersQuickFilter, usersSort, inventoryState, ledgerEntries, adminLogs, shipments, supportCases, userInternalLabels, userLocks, userStatuses, signupIpAccounts]);
  const selectedLedgerEntries = useMemo(() => {
      if (!isRealSelectedUserId(selectedUserId)) return [];
      return normalizeLedgerEntries(ledgerEntries[selectedUserId] ?? [], selectedUser?.balance ?? 0);
  }, [ledgerEntries, selectedUser, selectedUserId]);
  const selectedInventory = isRealSelectedUserId(selectedUserId) ? inventoryState[selectedUserId!] ?? [] : [];
  const selectedShippableInventory = selectedInventory.filter((item) => item.status === 'available' && !item.locked && item.shippable !== false);
  const selectedShippableInventoryValue = selectedShippableInventory.reduce((sum, item) => sum + toCoins(item.price, PRICE_UNIT_MODE), 0);
  useEffect(() => {
      if (!selectedUserId) return;
      const run = async () => {
          const auditsQuery = query(collection(db, 'users', selectedUserId, 'balanceAudit'), orderBy('createdAt', 'desc'), limit(300));
          const snap = await getDocs(auditsQuery);
          const parsed: BalanceAuditEntry[] = snap.docs.map((docSnap) => {
              const data = docSnap.data() as Record<string, unknown>;
              return {
                  id: docSnap.id,
                  currency: data.currency === 'xp' ? 'xp' : 'coins',
                  reason: String(data.reason ?? 'balance_change'),
                  amount: Number(data.amount ?? 0),
                  balanceBefore: data.balanceBefore == null ? undefined : Number(data.balanceBefore),
                  balanceAfter: data.balanceAfter == null ? undefined : Number(data.balanceAfter),
                  actorType: data.actorType === 'admin' || data.actorType === 'system' || data.actorType === 'user'
                      ? data.actorType
                      : undefined,
                  actorUid: data.actorUid == null ? null : String(data.actorUid),
                  source: typeof data.source === 'string' ? data.source : '',
                  relatedId: data.relatedId == null ? null : String(data.relatedId),
                  metadata: data.metadata && typeof data.metadata === 'object' ? data.metadata as Record<string, unknown> : {},
                  createdAt: data.createdAt instanceof Timestamp ? data.createdAt : undefined
              };
          });
          setBalanceAuditEntries((prev) => ({ ...prev, [selectedUserId]: parsed }));
      };
      void run();
  }, [selectedUserId]);
  const selectedBalanceAudits = useMemo(() => {
      if (!isRealSelectedUserId(selectedUserId)) return [];
      const searchValue = balanceAuditSearch.trim().toLowerCase();
      return (balanceAuditEntries[selectedUserId] ?? []).filter((entry) => {
          if (balanceAuditCurrencyFilter !== 'all' && entry.currency !== balanceAuditCurrencyFilter) return false;
          if (balanceAuditDirectionFilter === 'positive' && entry.amount <= 0) return false;
          if (balanceAuditDirectionFilter === 'negative' && entry.amount >= 0) return false;
          if (balanceAuditReasonFilter !== 'all' && entry.reason !== balanceAuditReasonFilter) return false;
          if (!searchValue) return true;
          return [entry.relatedId ?? '', entry.source ?? ''].join(' ').toLowerCase().includes(searchValue);
      });
  }, [balanceAuditCurrencyFilter, balanceAuditDirectionFilter, balanceAuditEntries, balanceAuditReasonFilter, balanceAuditSearch, selectedUserId]);
  const balanceAuditReasons = useMemo(
      () => Array.from(new Set<string>(selectedBalanceAudits.map((entry) => entry.reason))).sort((a, b) => a.localeCompare(b)),
      [selectedBalanceAudits]
  );
  const selectedAdminLogs = isRealSelectedUserId(selectedUserId) ? adminLogs[selectedUserId!] ?? [] : [];
  const ledgerNetChange = selectedLedgerEntries.reduce((sum, entry) => sum + entry.amount, 0);
  const ledgerSearchValue = ledgerSearch.trim().toLowerCase();

  const timelineEntries = useMemo(() => {
      const userShipments = selectedUserId ? shipments.filter((shipment) => shipment.uid === selectedUserId) : [];
      const userSupportCases = selectedUserId ? supportCases.filter((caseItem) => caseItem.uid === selectedUserId) : [];
      const entries = [
          ...selectedLedgerEntries.map((entry) => ({
              id: entry.id,
              createdAt: entry.createdAt,
              title: `Ledger • ${entry.type.replace('_', ' ')}`,
              description: `${formatCoinText(entry.amount)} ${entry.memo ?? ''}`.trim(),
              meta: entry.sourceId ? `Source: ${entry.sourceId}` : '',
              category: 'ledger' as const
          })),
          ...selectedInventory.flatMap((item) =>
              (item.history ?? []).map((history) => ({
                  id: `${item.instanceId}-${history.id}`,
                  createdAt: history.createdAt,
                  title: `Inventory • ${history.action.replace('_', ' ')}`,
                  description: `${item.name}${history.note ? ` — ${history.note}` : ''}`,
                  meta: item.provenance ? `From ${item.provenance.sourceType} (${item.provenance.sourceId})` : '',
                  category: 'inventory' as const
              }))
          ),
          ...selectedAdminLogs.map((log) => ({
              id: log.id,
              createdAt: log.createdAt,
              title: `Admin • ${log.actionType.replace('_', ' ')}`,
              description: log.reason,
              meta: `Admin: ${log.adminUid}`,
              category: 'admin' as const
          })),
          ...userShipments.map((shipment) => ({
              id: `shipment-${shipment.id}`,
              createdAt: shipment.updatedAt ?? shipment.createdAt ?? 0,
              title: `Shipment • ${shipment.status.replace('_', ' ')}`,
              description: `${shipment.item.name} • ${shipment.trackingNumber ?? 'Tracking pending'}`,
              meta: `Shipment ID: ${shipment.id}`,
              category: 'shipment' as const
          })),
          ...userSupportCases.map((caseItem) => ({
              id: `support-${caseItem.id}`,
              createdAt: toMillis(caseItem.lastUpdatedAt ?? caseItem.createdAt),
              title: `Support • ${caseItem.status}`,
              description: caseItem.subject,
              meta: `Case ID: ${caseItem.id}`,
              category: 'support' as const
          }))
      ];
      return entries.sort((a, b) => b.createdAt - a.createdAt);
  }, [selectedAdminLogs, selectedInventory, selectedLedgerEntries, selectedUserId, shipments, supportCases]);

  const filteredLedgerEntries = selectedLedgerEntries.filter((entry) => {
      if (ledgerFilter !== 'all' && entry.type !== ledgerFilter) return false;
      if (!ledgerSearchValue) return true;
      return [
          entry.memo,
          entry.sourceId,
          entry.type
      ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(ledgerSearchValue));
  });

  const timelineSearchValue = timelineSearch.trim().toLowerCase();
  const filteredTimelineEntries = timelineEntries.filter((entry) => {
      if (timelineFilter !== 'all' && entry.category !== timelineFilter) return false;
      if (!timelineSearchValue) return true;
      return [entry.title, entry.description, entry.meta]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(timelineSearchValue));
  });

  const oddsTotal = useMemo(() => calculateOddsTotal(selectedItems), [selectedItems]);
  const expectedValue = useMemo(() => calculateExpectedValue(selectedItems), [selectedItems]);
  const evRatio = useMemo(() => {
      if (!hasExplicitBoxPrice || effectiveBoxPrice <= 0) return 0;
      return expectedValue / Number(effectiveBoxPrice);
  }, [effectiveBoxPrice, expectedValue, hasExplicitBoxPrice]);
  const marginPercent = hasExplicitBoxPrice && effectiveBoxPrice > 0 ? (1 - evRatio) * 100 : NaN;
  const evOutOfBounds = hasExplicitBoxPrice && effectiveBoxPrice > 0
    ? Math.abs(evRatio - clampedTargetEV) > EV_TOLERANCE
    : false;
  const oddsOutOfBounds = Math.abs(oddsTotal - 100) > 0.001;
  const canSaveBox = !!newBox.name && hasExplicitBoxPrice && selectedItems.length > 0 && !evOutOfBounds && !oddsOutOfBounds;

  const handleCreateXpBoxFromRewardEditor = () => {
      setPendingXpBoxIds(xpBoxes.map((box) => box.id));
      setActiveTab('boxes');
      setEditingBoxId(null);
      setSelectedItems([]);
      setNewBox({
          name: '',
          price: 0,
          priceXP: 0,
          currencyType: 'XP',
          image: 'https://picsum.photos/300',
          accentColor: '#3b82f6',
          isDaily: false,
          isPullPassBox: false,
          pullPassBoxType: 'bronze',
          tags: [],
          sellBackRate: 0.82
      });
      window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSaveBox = async () => {
      const allowsZeroPrice = Boolean(newBox.isDaily || newBox.isPullPassBox);
      if(!newBox.name || !hasExplicitBoxPrice) {
          alert("Please fill in box details");
          return;
      }
      if (effectiveBoxPrice < 0) {
          alert(isXpBox ? 'XP boxes cannot have a negative price.' : 'Boxes cannot have a negative coin price.');
          return;
      }
      if (effectiveBoxPrice === 0 && !allowsZeroPrice) {
          alert(isXpBox ? 'XP boxes require a positive XP price unless marked as a free daily or Pull Pass box.' : 'Boxes require a positive coin price unless marked as a free daily or Pull Pass box.');
          return;
      }

      if(selectedItems.length === 0) {
          alert("Select at least one item for the box");
          return;
      }
      if (oddsOutOfBounds) {
          alert("Total odds must equal 100% before saving.");
          return;
      }
      if (evOutOfBounds) {
          alert("Expected value is outside the allowed tolerance.");
          return;
      }

      // Clone items to decouple from global pool (ensuring box-specific chances)
      const boxItems = selectedItems.map(i => ({...i}));

      // If setting as daily, unset others first (best effort approach)
      if (newBox.isDaily) {
          boxes.forEach(b => {
              if (b.isDaily && b.id !== (editingBoxId || '')) {
                  updateBox({ ...b, isDaily: false });
              }
          });
      }

      const box: MysteryBox = buildEditableBoxPayload(boxItems);

      try {
          if (editingBoxId) {
              await updateBox(box);
              alert("Box Updated!");
          } else {
              await createBox(box);
              alert("Box Created in Firebase!");
          }
          resetBoxForm();
      } catch (error) {
          console.error('Failed to persist box shipping profiles', error);
          alert('The box could not be saved. Your shipping profile selections are still here—please try again.');
      }
  };

  const handleEditBox = (box: MysteryBox) => {
      setEditingBoxId(box.id);
      setNewBox({
          name: box.name,
          price: box.price,
          priceXP: box.priceXP ?? 0,
          currencyType: box.currencyType ?? 'COIN',
          image: box.image,
          spinnerBackgroundImage: box.spinnerBackgroundImage ?? '',
          accentColor: box.accentColor,
          tag: box.tag,
          tags: normalizeBoxTagList(box.tags ?? (box.tag ? [box.tag] : [])),
          isDaily: box.isDaily,
          isPullPassBox: box.isPullPassBox ?? false,
          pullPassBoxType: box.pullPassBoxType ?? 'bronze',
          sellBackRate: box.sellBackRate ?? (box.isUserCreated ? 0.75 : 0.82)
      });
      setBoxTagInput('');
      setSelectedItems(box.items.map(i => ({ ...i, boxValueOverrideCoins: Number(i.boxValueOverrideCoins ?? i.price ?? 0), originalPriceCoins: Number(i.originalPriceCoins ?? i.price ?? 0) })));
      setOddsEditorMode('manual');
      setRiskBalance(box.riskLevel ?? 50);
      setTargetEV(box.targetEV ?? 0.85);
      window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const initiateDeleteBox = (id: string) => {
      setBoxToDelete(id);
  };

  const confirmDeleteBox = async () => {
      if (!boxToDelete) return;

      setDeletingBoxId(boxToDelete);
      try {
          await deleteBox(boxToDelete);
      } finally {
          setDeletingBoxId(null);
          setBoxToDelete(null);
      }
  };

  const handleSpinnerBackgroundUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      if (!adminUser?.isAdmin) {
          alert('Only admins can upload spinner backgrounds.');
          event.target.value = '';
          return;
      }

      const maxSizeBytes = 5 * 1024 * 1024;
      if (file.size > maxSizeBytes) {
          alert('Please choose an image smaller than 5MB.');
          event.target.value = '';
          return;
      }

      if (!file.type.startsWith('image/')) {
          alert('Please choose a valid image file.');
          event.target.value = '';
          return;
      }

      setIsUploadingSpinnerBackground(true);
      try {
          const extension = (file.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '');
          const safeExtension = extension || 'png';
          const path = `spinner-backgrounds/${Date.now()}-${Math.random().toString(36).slice(2)}.${safeExtension}`;
          const storageRef = ref(storage, path);
          const uploadResult = await uploadBytes(storageRef, file, {
              contentType: file.type
          });
          const downloadUrl = await getDownloadURL(uploadResult.ref);
          setNewBox((prev) => ({ ...prev, spinnerBackgroundImage: downloadUrl }));
      } catch (error) {
          console.error('Failed to upload spinner background image', error);
          alert('Unable to upload image. Please try again.');
      } finally {
          setIsUploadingSpinnerBackground(false);
          event.target.value = '';
      }
  };

  const handleBoxCatalogHeroUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;
      if (!adminUser?.isAdmin) return;
      if (!file.type.startsWith('image/')) {
          alert('Please choose a valid image file.');
          event.target.value = '';
          return;
      }
      setIsUploadingBoxCatalogHero(true);
      try {
          const extension = (file.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '') || 'png';
          const path = `box-catalog-hero/${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;
          const storageRef = ref(storage, path);
          const uploadResult = await uploadBytes(storageRef, file, { contentType: file.type });
          const downloadUrl = await getDownloadURL(uploadResult.ref);
          setStripeSettingsDraft((prev) => ({ ...prev, boxCatalogHeroImageUrl: downloadUrl }));
          setStripeSettingsNotice(false);
      } catch (error) {
          console.error('Failed to upload box catalog hero image', error);
          alert('Unable to upload image. Please try again.');
      } finally {
          setIsUploadingBoxCatalogHero(false);
          event.target.value = '';
      }
  };

  const resetBoxForm = () => {
      setEditingBoxId(null);
      setNewBox({
        name: '',
        price: 0,
        priceXP: 0,
        currencyType: 'COIN',
        image: 'https://picsum.photos/300',
        spinnerBackgroundImage: '',
        accentColor: '#3b82f6',
        isDaily: false,
        tags: [],
        sellBackRate: 0.82
      });
      setBoxTagInput('');
      setSelectedItems([]);
      setOddsEditorMode('auto');
      setRiskBalance(50);
      setTargetEV(0.85);
  };

  const toggleBoxTag = (tag: string) => {
      const normalized = tag.trim().toLowerCase();
      setNewBox(prev => {
          const currentTags = prev.tags ?? [];
          const nextTags = currentTags.includes(normalized)
              ? currentTags.filter(existing => existing !== normalized)
              : normalizeBoxTagList([...currentTags, normalized]);
          return { ...prev, tags: nextTags };
      });
  };

  const toggleItemFilterTag = (tag: string) => {
      setItemTagFilters((prev) => (
          prev.includes(tag)
              ? prev.filter((existing) => existing !== tag)
              : [...prev, tag]
      ));
  };

  const toggleItemSelection = (item: CaseItem) => {
      setSelectedItems((prev) => {
          const exists = prev.some((entry) => entry.id === item.id);
          const nextItems = exists
              ? prev.filter((entry) => entry.id !== item.id)
              : [
                  ...prev,
                  {
                      ...item,
                      boxValueOverrideCoins: Number(item.boxValueOverrideCoins ?? item.price ?? 0),
                      originalPriceCoins: Number(item.originalPriceCoins ?? item.price ?? 0)
                  }
              ];

          if (nextItems.length === 0) {
              return nextItems;
          }

          const { updatedItems, calculatedPrice } = getAutoCalculatedBoxItems(nextItems);
          if (!hasExplicitBoxPrice) {
              setNewBox((current) => ({
                  ...current,
                  [isXpBox ? 'priceXP' : 'price']: parseFloat(calculatedPrice.toFixed(2))
              }));
          }
          return updatedItems;
      });
      setOddsEditorMode('auto');
  };

  const getCatalogItemPrice = (item: CaseItem) => {
      const catalogItem = items.find((entry) => entry.id === item.id);
      return Math.max(0, Number(catalogItem?.price ?? item.originalPriceCoins ?? item.price ?? 0) || 0);
  };

  const applyBoxValueOverride = (itemId: string, nextValueCoins: number) => {
      const nextItems = selectedItems.map((entry) => {
          if (entry.id !== itemId) return entry;
          const safeValueCoins = Math.max(0, Math.round(Number(nextValueCoins) || 0));
          return {
              ...entry,
              price: safeValueCoins,
              valueCoins: safeValueCoins,
              valueUsd: Number((safeValueCoins / 100).toFixed(2)),
              sellBackCoins: Math.floor(safeValueCoins * 0.8),
              boxValueOverrideCoins: safeValueCoins,
              originalPriceCoins: Number(entry.originalPriceCoins ?? getCatalogItemPrice(entry))
          };
      });
      const { updatedItems, calculatedPrice } = getAutoCalculatedBoxItems(nextItems);
      setSelectedItems(updatedItems);
      setOddsEditorMode('auto');
      if (!hasExplicitBoxPrice) {
          setNewBox((prev) => ({
              ...prev,
              [isXpBox ? 'priceXP' : 'price']: parseFloat(calculatedPrice.toFixed(2))
          }));
      }
  };

  const handleSelectedItemValueOverrideChange = (itemId: string, valueInput: string) => {
      const parsedValue = Number(valueInput);
      applyBoxValueOverride(itemId, Number.isFinite(parsedValue) ? parsedValue : 0);
  };

  const resetSelectedItemValueOverride = (item: CaseItem) => {
      applyBoxValueOverride(item.id, getCatalogItemPrice(item));
  };

  const handleSelectedItemChanceChange = (itemId: string, chanceInput: string) => {
      const parsedChance = Number(chanceInput);
      const nextChance = Number.isFinite(parsedChance)
          ? Math.min(100, Math.max(0, parsedChance))
          : 0;
      setOddsEditorMode('manual');
      setSelectedItems((prev) => prev.map((entry) => (
          entry.id === itemId
              ? { ...entry, chance: Number(nextChance.toFixed(4)) }
              : entry
      )));
  };

  const buildEditableBoxPayload = (items: CaseItem[]): MysteryBox => ({
      id: editingBoxId || '', // Empty ID tells createBox to addDoc
      name: newBox.name || '',
      price: isXpBox ? 0 : Math.max(0, Number(newBox.price ?? 0) || 0),
      priceXP: isXpBox ? Math.max(0, Math.floor(Number(newBox.priceXP ?? 0) || 0)) : undefined,
      currencyType: isXpBox ? 'XP' : 'COIN',
      image: newBox.image || 'https://picsum.photos/300',
      spinnerBackgroundImage: (newBox.spinnerBackgroundImage ?? '').trim(),
      accentColor: newBox.accentColor || '#3b82f6',
      tag: newBox.tag,
      tags: normalizeBoxTagList(newBox.tags ?? []),
      isDaily: newBox.isDaily,
      isPullPassBox: newBox.isPullPassBox === true,
      pullPassBoxType: newBox.isPullPassBox ? (newBox.pullPassBoxType ?? 'bronze') : undefined,
      sellBackRate: newBox.sellBackRate ?? (newBox.isDaily ? 0.75 : 0.82),
      items,
      targetEV: clampedTargetEV,
      riskLevel: riskBalance
  });

  const handleSelectedItemRarityChange = (itemId: string, rarity: CaseItem['rarity']) => {
      const normalizedRarity = rarityColorMap[rarity] ? rarity : 'common';
      const nextItems = selectedItems.map((entry) => (
          entry.id === itemId
              ? { ...entry, rarity: normalizedRarity, color: rarityColorMap[normalizedRarity] }
              : entry
      ));
      setSelectedItems(nextItems);

      if (!editingBoxId) return;
      updateBox(buildEditableBoxPayload(nextItems.map((entry) => ({ ...entry }))));
  };

  const handleSaveBonusSettings = () => {
      updateBonusSettings(bonusDraft);
      setBonusSaveNotice(true);
      window.setTimeout(() => setBonusSaveNotice(false), 3000);
  };

  const handleSaveEconomySettings = async () => {
      const payload: EconomySettingsDraft = {
          xpPerDollar: Math.max(1, Number(economyDraft.xpPerDollar) || DEFAULT_ECONOMY_SETTINGS.xpPerDollar),
          coinsPerDollar: Math.max(1, Number(economyDraft.coinsPerDollar) || DEFAULT_ECONOMY_SETTINGS.coinsPerDollar),
          xpOpenEnabled: economyDraft.xpOpenEnabled
      };
      await setDoc(doc(db, 'settings', 'economy'), payload, { merge: true });
      setEconomySaveNotice(true);
      window.setTimeout(() => setEconomySaveNotice(false), 3000);
  };

  const resetXpShopItemDraft = () => {
      setEditingXpShopItemId(null);
      setXpShopItemDraft({
          title: '',
          description: '',
          imageUrl: '',
          xpCost: 100,
          stock: null,
          limitPerUser: null,
          category: 'Exclusive',
          fulfillmentType: 'DIGITAL',
          metadata: {},
          enabled: true,
          sortOrder: 0
      });
  };

  const handleEditXpShopItem = (item: AdminXpShopItem) => {
      setEditingXpShopItemId(item.id);
      setXpShopItemDraft({
          title: item.title,
          description: item.description,
          imageUrl: item.imageUrl ?? '',
          xpCost: item.xpCost,
          stock: item.stock,
          limitPerUser: item.limitPerUser,
          category: item.category,
          fulfillmentType: item.fulfillmentType,
          metadata: {
              caseId: item.metadata?.caseId,
              xpPriceOverride: item.metadata?.xpPriceOverride,
              unlockRakeback: item.metadata?.unlockRakeback === true,
              rakebackPercent: item.metadata?.rakebackPercent,
              rakebackTier: item.metadata?.rakebackTier ?? null
          },
          enabled: item.enabled,
          sortOrder: item.sortOrder
      });
  };

  const handleSaveXpShopItem = async () => {
      const trimmedTitle = xpShopItemDraft.title.trim();
      if (!trimmedTitle) {
          window.alert('Title is required');
          return;
      }

      setIsSavingXpShopItem(true);
      const metadata = {
          caseId: xpShopItemDraft.fulfillmentType === 'XP_BOX' ? (xpShopItemDraft.metadata?.caseId ?? '').trim() : undefined,
          xpPriceOverride: xpShopItemDraft.fulfillmentType === 'XP_BOX' && xpShopItemDraft.metadata?.xpPriceOverride != null
              ? Math.max(0, Math.floor(Number(xpShopItemDraft.metadata.xpPriceOverride) || 0))
              : undefined,
          unlockRakeback: xpShopItemDraft.fulfillmentType === 'DIGITAL' ? xpShopItemDraft.metadata?.unlockRakeback === true : undefined,
          rakebackPercent:
              xpShopItemDraft.fulfillmentType === 'DIGITAL' && xpShopItemDraft.metadata?.unlockRakeback === true && xpShopItemDraft.metadata?.rakebackPercent != null
                  ? Math.max(0, Number(xpShopItemDraft.metadata.rakebackPercent))
                  : undefined,
          rakebackTier:
              xpShopItemDraft.fulfillmentType === 'DIGITAL' && xpShopItemDraft.metadata?.unlockRakeback === true
                  ? (xpShopItemDraft.metadata?.rakebackTier ?? null)
                  : undefined
      };

      if (xpShopItemDraft.fulfillmentType === 'XP_BOX' && !metadata.caseId) {
          window.alert('Please select an XP box for XP_BOX rewards.');
          setIsSavingXpShopItem(false);
          return;
      }

      const payload = Object.fromEntries(Object.entries({
          title: trimmedTitle,
          description: xpShopItemDraft.description.trim(),
          imageUrl: xpShopItemDraft.imageUrl?.trim() ?? '',
          xpCost: Math.max(0, Math.floor(Number(xpShopItemDraft.xpCost) || 0)),
          stock: xpShopItemDraft.fulfillmentType === 'DIGITAL' && metadata.unlockRakeback === true ? null : (xpShopItemDraft.stock == null ? null : Math.max(0, Math.floor(Number(xpShopItemDraft.stock) || 0))),
          limitPerUser: xpShopItemDraft.fulfillmentType === 'DIGITAL' && metadata.unlockRakeback === true ? 1 : (xpShopItemDraft.limitPerUser == null ? null : Math.max(0, Math.floor(Number(xpShopItemDraft.limitPerUser) || 0))),
          category: xpShopItemDraft.category.trim() || 'Exclusive',
          fulfillmentType: xpShopItemDraft.fulfillmentType,
          metadata: Object.fromEntries(Object.entries(metadata).filter(([, value]) => value !== undefined)),
          enabled: xpShopItemDraft.enabled,
          sortOrder: Math.floor(Number(xpShopItemDraft.sortOrder) || 0),
          updatedAt: serverTimestamp()
      }).filter(([, value]) => value !== undefined));

      try {
          if (editingXpShopItemId) {
              await setDoc(doc(db, 'xpShopItems', editingXpShopItemId), payload, { merge: true });
          } else {
              await addDoc(collection(db, 'xpShopItems'), { ...payload, createdAt: serverTimestamp() });
          }
          resetXpShopItemDraft();
      } catch (error) {
          console.error('Failed to save XP shop item', error);
          window.alert('Unable to save XP shop item right now.');
      } finally {
          setIsSavingXpShopItem(false);
      }
  };

  const handleDeleteXpShopItem = async (itemId: string) => {
      if (!window.confirm('Delete this XP shop item?')) return;
      try {
          await deleteDoc(doc(db, 'xpShopItems', itemId));
          if (editingXpShopItemId === itemId) {
              resetXpShopItemDraft();
          }
      } catch (error) {
          console.error('Failed to delete XP shop item', error);
          window.alert('Unable to delete XP shop item right now.');
      }
  };

  const handleUpdateXpRedemptionStatus = async (redemptionId: string, status: 'pending' | 'fulfilled' | 'cancelled') => {
      try {
          await setDoc(doc(db, 'xpRedemptions', redemptionId), { status, updatedAt: serverTimestamp() }, { merge: true });
      } catch (error) {
          console.error('Failed to update redemption status', error);
          window.alert('Unable to update redemption status right now.');
      }
  };


  const updateShippingRateTierDraft = (
      group: 'shippingRateTiers' | 'shippingProtectionTiers',
      index: number,
      field: 'label' | 'cashCents' | 'maxValueCoinsExclusive',
      value: string
  ) => {
      setStripeSettingsDraft((prev) => ({
          ...prev,
          [group]: prev[group].map((tier, tierIndex) => {
              if (tierIndex !== index) return tier;
              if (field === 'label') return { ...tier, label: value };
              if (field === 'cashCents') return { ...tier, cashCents: Math.max(0, Math.round((Number(value) || 0) * 100)) };
              return { ...tier, maxValueCoinsExclusive: value.trim() === '' ? null : Math.max(0, Math.round(Number(value) || 0)) };
          })
      }));
  };

  const handleSaveStripeSettings = () => {
      const rawRate = Number(stripeSettingsDraft.shippingFlatRateInput);
      const shippingFlatRateCents = Number.isFinite(rawRate) ? Math.max(0, Math.round(rawRate * 100)) : 0;
      updateStripeSettings({
          boxCatalogHeroImageUrl: stripeSettingsDraft.boxCatalogHeroImageUrl.trim(),
          authPopupImageUrl: stripeSettingsDraft.authPopupImageUrl.trim(),
          authPopupImageUrls: stripeSettingsDraft.authPopupImageUrls.map((imageUrl) => imageUrl.trim()).slice(0, 3),
          homeCategoryImageUrls: stripeSettingsDraft.homeCategoryImageUrls.map((imageUrl) => imageUrl.trim()).slice(0, 3),
          homeCategorySlugs: stripeSettingsDraft.homeCategorySlugs.map((slug) => slug.trim()).slice(0, 3),
          howItWorksStepImageUrls: stripeSettingsDraft.howItWorksStepImageUrls.map((imageUrl) => imageUrl.trim()).slice(0, 3),
          shippingCashEnabled: stripeSettingsDraft.shippingCashEnabled,
          shippingFlatRateCents,
          stripeShippingProductId: stripeSettingsDraft.stripeShippingProductId,
          shippingCoinEnabled: stripeSettingsDraft.shippingCoinEnabled,
          shippingCoinCostCoins: Math.max(0, Math.round(Number(stripeSettingsDraft.shippingCoinCostCoins) || 0)),
          shippingRateTiers: stripeSettingsDraft.shippingRateTiers.map((tier) => ({
              maxValueCoinsExclusive: tier.maxValueCoinsExclusive === null ? null : Math.max(0, Math.round(Number(tier.maxValueCoinsExclusive) || 0)),
              cashCents: Math.max(0, Math.round(Number(tier.cashCents) || 0)),
              label: tier.label.trim() || 'Custom tier'
          })),
          shippingProtectionTiers: stripeSettingsDraft.shippingProtectionTiers.map((tier) => ({
              maxValueCoinsExclusive: tier.maxValueCoinsExclusive === null ? null : Math.max(0, Math.round(Number(tier.maxValueCoinsExclusive) || 0)),
              cashCents: Math.max(0, Math.round(Number(tier.cashCents) || 0)),
              label: tier.label.trim() || 'Custom tier'
          })),
          signatureRequiredCents: Math.max(0, Math.round((Number(stripeSettingsDraft.signatureRequiredInput) || 0) * 100)),
          caseLabPublishFeeCoins: Math.max(0, Math.round(Number(stripeSettingsDraft.caseLabPublishFeeCoins) || 0)),
          caseLabSellBackPercent: Math.min(100, Math.max(0, Math.round(Number(stripeSettingsDraft.caseLabSellBackPercent) || 0))),
          caseLabVisibleBoxIds: Array.from(new Set(stripeSettingsDraft.caseLabVisibleBoxIds)),
          boxTagIcons: stripeSettings.boxTagIcons
      });
      setStripeSettingsNotice(true);
      window.setTimeout(() => setStripeSettingsNotice(false), 3000);
  };

  const toggleSupportCase = (caseId: string) => {
      setExpandedSupportCases((prev) => {
          const next = new Set(prev);
          if (next.has(caseId)) {
              next.delete(caseId);
          } else {
              next.add(caseId);
          }
          return next;
      });
  };

  const handleSupportReplyChange = (caseId: string, value: string) => {
      setSupportReplyDrafts((prev) => ({ ...prev, [caseId]: value }));
  };

  const handleSupportReplySubmit = async (caseItem: SupportCase) => {
      const replyText = supportReplyDrafts[caseItem.id]?.trim();
      if (!replyText) {
          setSupportReplyStatus((prev) => ({
              ...prev,
              [caseItem.id]: { sending: false, error: 'Reply text cannot be empty.' }
          }));
          return;
      }
      setSupportReplyStatus((prev) => ({
          ...prev,
          [caseItem.id]: { sending: true }
      }));
      try {
          await updateDoc(doc(db, 'supportCases', caseItem.id), {
              messages: arrayUnion({
                  sender: 'admin',
                  text: replyText,
                  timestamp: Timestamp.now()
              }),
              lastUpdatedAt: serverTimestamp()
          });
          setSupportReplyDrafts((prev) => ({ ...prev, [caseItem.id]: '' }));
          setSupportReplyStatus((prev) => ({
              ...prev,
              [caseItem.id]: { sending: false, success: 'Reply sent.' }
          }));
      } catch (error) {
          console.error('Failed to send support reply', error);
          setSupportReplyStatus((prev) => ({
              ...prev,
              [caseItem.id]: { sending: false, error: 'Unable to send reply. Please try again.' }
          }));
      }
  };

  const handleSupportStatusChange = async (caseItem: SupportCase, status: 'Open' | 'Closed') => {
      setSupportStatusUpdates((prev) => ({
          ...prev,
          [caseItem.id]: { sending: true }
      }));
      try {
          await updateDoc(doc(db, 'supportCases', caseItem.id), {
              status,
              lastUpdatedAt: serverTimestamp()
          });
          setSupportStatusUpdates((prev) => ({
              ...prev,
              [caseItem.id]: { sending: false, success: `Marked ${status}.` }
          }));
      } catch (error) {
          console.error('Failed to update support status', error);
          setSupportStatusUpdates((prev) => ({
              ...prev,
              [caseItem.id]: { sending: false, error: 'Unable to update status. Please try again.' }
          }));
      }
  };

  return (
    <div className="w-full max-w-7xl mx-auto p-6 animate-in fade-in duration-300">

      <div className="flex flex-col md:flex-row gap-8">

        {/* Sidebar */}
        <div className="w-full md:w-64 flex-shrink-0">
           <div className="bg-[#131720] border border-gray-800 rounded-xl p-4 sticky top-24">
               <h2 className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-4 px-2">Admin Control</h2>
               <nav className="flex flex-col gap-1">
                   <button
                     onClick={() => setActiveTab('dashboard')}
                     className={`flex items-center gap-3 px-3 py-2 rounded-lg font-medium text-sm transition-colors ${activeTab === 'dashboard' ? 'btn-logo-gradient text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}
                   >
                       <LayoutDashboard className="w-4 h-4" /> Dashboard
                   </button>
                   <button
                     onClick={() => setActiveTab('items')}
                     className={`flex items-center gap-3 px-3 py-2 rounded-lg font-medium text-sm transition-colors ${activeTab === 'items' ? 'btn-logo-gradient text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}
                   >
                       <Package className="w-4 h-4" /> Manage Items
                   </button>
                   <button
                     onClick={() => setActiveTab('boxes')}
                     className={`flex items-center gap-3 px-3 py-2 rounded-lg font-medium text-sm transition-colors ${activeTab === 'boxes' ? 'btn-logo-gradient text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}
                   >
                       <BoxIcon className="w-4 h-4" /> Manage Boxes
                   </button>
                   <button
                     onClick={() => setActiveTab('packages')}
                     className={`flex items-center gap-3 px-3 py-2 rounded-lg font-medium text-sm transition-colors ${activeTab === 'packages' ? 'btn-logo-gradient text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}
                   >
                       <PackageCheck className="w-4 h-4" /> Coin Packages
                   </button>
                   <button
                     onClick={() => setActiveTab('users')}
                     className={`flex items-center gap-3 px-3 py-2 rounded-lg font-medium text-sm transition-colors ${activeTab === 'users' ? 'btn-logo-gradient text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}
                   >
                       <Users className="w-4 h-4" /> User Management
                   </button>
                   <button
                     onClick={() => setActiveTab('shipments')}
                     className={`flex items-center gap-3 px-3 py-2 rounded-lg font-medium text-sm transition-colors ${activeTab === 'shipments' ? 'btn-logo-gradient text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}
                   >
                       <Truck className="w-4 h-4" /> Shipment Manager
                   </button>
                   <button
                     onClick={() => setActiveTab('shipping-profiles')}
                     className={`flex items-center gap-3 px-3 py-2 rounded-lg font-medium text-sm transition-colors ${activeTab === 'shipping-profiles' ? 'btn-logo-gradient text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}
                   >
                       <PackageCheck className="w-4 h-4" /> Shipping Profiles
                   </button>
                   <button onClick={() => setActiveTab('shipping-origin')} className={`flex items-center gap-3 px-3 py-2 rounded-lg font-medium text-sm transition-colors ${activeTab === 'shipping-origin' ? 'btn-logo-gradient text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}><MapPin className="w-4 h-4" /> Shipping Origin</button>
                   <button onClick={() => setActiveTab('shipping-packages')} className={`flex items-center gap-3 px-3 py-2 rounded-lg font-medium text-sm transition-colors ${activeTab === 'shipping-packages' ? 'btn-logo-gradient text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}><PackageOpen className="w-4 h-4" /> Shipping Packages</button>
                   <button
                     onClick={() => setActiveTab('support')}
                     className={`flex items-center gap-3 px-3 py-2 rounded-lg font-medium text-sm transition-colors ${activeTab === 'support' ? 'btn-logo-gradient text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}
                   >
                       <MessageCircle className="w-4 h-4" /> Support Inbox
                   </button>
                   <button
                     onClick={() => setActiveTab('bonuses')}
                     className={`flex items-center gap-3 px-3 py-2 rounded-lg font-medium text-sm transition-colors ${activeTab === 'bonuses' ? 'btn-logo-gradient text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}
                   >
                       <Sparkles className="w-4 h-4" /> Bonuses
                   </button>
                   <button
                     onClick={() => setActiveTab('referrals')}
                     className={`flex items-center gap-3 px-3 py-2 rounded-lg font-medium text-sm transition-colors ${activeTab === 'referrals' ? 'btn-logo-gradient text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}
                   >
                       <Users className="w-4 h-4" /> Referrals
                   </button>
                   <button
                     onClick={() => setActiveTab('market-pricing')}
                     className={`flex items-center gap-3 px-3 py-2 rounded-lg font-medium text-sm transition-colors ${activeTab === 'market-pricing' ? 'btn-logo-gradient text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}
                   >
                       <Calculator className="w-4 h-4" /> Market Pricing
                   </button>
                   <button
                     onClick={() => setActiveTab('fees')}
                     className={`flex items-center gap-3 px-3 py-2 rounded-lg font-medium text-sm transition-colors ${activeTab === 'fees' ? 'btn-logo-gradient text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}
                   >
                       <BadgeDollarSign className="w-4 h-4" /> Fees &amp; Shipping
                   </button>
                   <button
                     onClick={() => setActiveTab('homepage')}
                     className={`flex items-center gap-3 px-3 py-2 rounded-lg font-medium text-sm transition-colors ${activeTab === 'homepage' ? 'btn-logo-gradient text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}
                   >
                       <HomeIcon className="w-4 h-4" /> Homepage
                   </button>
                   <button
                     onClick={() => setActiveTab('boxes-page')}
                     className={`flex items-center gap-3 px-3 py-2 rounded-lg font-medium text-sm transition-colors ${activeTab === 'boxes-page' ? 'btn-logo-gradient text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}
                   >
                       <PackageOpen className="w-4 h-4" /> Boxes Page
                   </button>
                   <button
                     onClick={() => setActiveTab('case-lab')}
                     className={`flex items-center gap-3 px-3 py-2 rounded-lg font-medium text-sm transition-colors ${activeTab === 'case-lab' ? 'btn-logo-gradient text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}
                   >
                       <Beaker className="w-4 h-4" /> Box Lab
                   </button>
                   <button
                     onClick={() => setActiveTab('polls')}
                     className={`flex items-center gap-3 px-3 py-2 rounded-lg font-medium text-sm transition-colors ${activeTab === 'polls' ? 'btn-logo-gradient text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}
                   >
                       <BarChart3 className="w-4 h-4" /> Polls
                   </button>
                   <button
                     onClick={() => setActiveTab('footer-pages')}
                     className={`flex items-center gap-3 px-3 py-2 rounded-lg font-medium text-sm transition-colors ${activeTab === 'footer-pages' ? 'btn-logo-gradient text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}
                   >
                       <ScrollText className="w-4 h-4" /> Footer Pages
                   </button>
                   <button onClick={() => setActiveTab('seo')} className={`flex items-center gap-3 px-3 py-2 rounded-lg font-medium text-sm transition-colors ${activeTab === 'seo' ? 'btn-logo-gradient text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}>
                       <Search className="w-4 h-4" /> SEO Manager
                   </button>
                   <button
                     onClick={() => setActiveTab('settings')}
                     className={`flex items-center gap-3 px-3 py-2 rounded-lg font-medium text-sm transition-colors ${activeTab === 'settings' ? 'btn-logo-gradient text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}
                   >
                       <Settings className="w-4 h-4" /> Site Settings
                   </button>
               </nav>
           </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 min-w-0">

            {/* Header */}
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-white mb-2">
                    {activeTab === 'dashboard' && 'Overview'}
                    {activeTab === 'users' && 'User Database'}
                    {activeTab === 'settings' && 'System Configuration'}
                    {activeTab === 'items' && 'Item Manager'}
                    {activeTab === 'boxes' && 'Box Manager'}
                    {activeTab === 'packages' && 'Coin Packages'}
                    {activeTab === 'shipments' && 'Shipment Manager'}
                    {activeTab === 'shipping-profiles' && 'Shipping Profiles'}
                    {activeTab === 'shipping-origin' && 'Shipping Origin'}
                    {activeTab === 'shipping-packages' && 'Shipping Packages'}
                    {activeTab === 'support' && 'Support Inbox'}
                    {activeTab === 'bonuses' && 'Bonuses & Pull Pass'}
                    {activeTab === 'referrals' && 'Referral Program'}
                    {activeTab === 'fees' && 'Fees & Shipping'}
                    {activeTab === 'homepage' && 'Homepage Showcase'}
                    {activeTab === 'boxes-page' && 'Boxes Page'}
                    {activeTab === 'case-lab' && 'Box Lab'}
                    {activeTab === 'polls' && 'Poll Management'}
                    {activeTab === 'footer-pages' && 'Footer Pages'}
                    {activeTab === 'market-pricing' && 'Market Pricing'}
                    {activeTab === 'seo' && 'SEO Manager'}
                </h1>
                <p className="text-gray-400 text-sm">Welcome back, Administrator. System is operating normally.</p>
            </div>

            {/* TAB: DASHBOARD */}
            {activeTab === 'shipping-profiles' && <ShippingProfilesAdminSection profiles={shippingProfiles} onRefresh={loadShippingProfiles} />}
            {activeTab === 'shipping-origin' && <ShippingOriginAdminSection />}
            {activeTab === 'shipping-packages' && <ShippingPackagesAdminSection packages={shippingPackages} profiles={shippingProfiles} onRefresh={loadShippingPackages} />}
            {activeTab === 'dashboard' && (
                <>
                    {/* Stats Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
                        {dashboardStats.map((stat, idx) => (
                            <div key={idx} className="bg-[#131720] border border-gray-800 rounded-xl p-4">
                                <div className="flex items-start justify-between mb-4">
                                    <div className={`p-2 rounded-lg ${stat.bg}`}>
                                        <stat.icon className={`w-6 h-6 ${stat.color}`} />
                                    </div>
                                    <span className="text-[10px] font-bold text-gray-400 bg-gray-700/40 px-1.5 py-0.5 rounded">Today</span>
                                </div>
                                <div className="text-2xl font-bold text-white mb-1">
                                    {stat.isCoin ? (
                                        <CoinAmount
                                          amount={stat.value as number}
                                          formatOptions={{ maximumFractionDigits: 0 }}
                                          className="text-white"
                                          iconClassName="w-5 h-5"
                                        />
                                    ) : (
                                        stat.value
                                    )}
                                </div>
                                <div className="text-xs text-gray-500">{stat.title}</div>
                            </div>
                        ))}
                    </div>

                    {/* Recent Activity Mock */}
                    <div className="bg-[#131720] border border-gray-800 rounded-xl p-6">
                        <h3 className="text-lg font-bold text-white mb-6">Live Transactions</h3>
                        <div className="space-y-4">
                            {liveTransactions.map((entry) => (
                                <div key={entry.id} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between py-2 border-b border-gray-800 last:border-0">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className={`w-2 h-2 rounded-full shrink-0 ${entry.amount > 0 ? 'bg-green-500' : 'bg-blue-500'}`}></div>
                                        <div>
                                            <div className="text-sm font-bold text-gray-200">
                                                {entry.type.replace(/_/g, ' ')}
                                            </div>
                                            <div className="text-xs text-gray-500">{new Date(entry.createdAt).toLocaleString()}</div>
                                        </div>
                                    </div>
                                    <div className="text-left sm:text-right">
                                        <CoinAmount
                                          amount={entry.amount}
                                          formatOptions={{ maximumFractionDigits: 0 }}
                                          showSign
                                          className={`text-sm font-bold ${entry.amount > 0 ? 'text-green-400' : 'text-white'}`}
                                          iconClassName="w-3.5 h-3.5"
                                        />
                                        <div className="text-xs text-gray-500 truncate max-w-[180px]">{entry.userLabel}</div>
                                    </div>
                                </div>
                            ))}
                            {liveTransactions.length === 0 && (
                                <div className="text-sm text-gray-400">No recent transactions yet.</div>
                            )}
                        </div>
                    </div>
                </>
            )}

            {/* TAB: ITEMS */}
            {activeTab === 'items' && (
                <div className="space-y-8">
                    <div className="bg-[#131720] border border-gray-800 rounded-xl p-6">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <h3 className="text-lg font-bold text-white">Bulk upload via spreadsheet</h3>
                                <p className="text-xs text-gray-400 mt-1">
                                    Upload a CSV export with columns: {ITEM_SPREADSHEET_HEADERS.join(', ')}. Separate multiple tags with
                                    a <span className="text-gray-300">|</span> or <span className="text-gray-300">;</span>.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={handleDownloadTemplate}
                                className="w-full sm:w-auto px-4 py-2 rounded-lg border border-gray-700 text-xs font-semibold uppercase tracking-wide text-gray-200 hover:border-gray-500"
                            >
                                Download template
                            </button>
                        </div>
                        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
                            <Input
                                ref={spreadsheetInputRef}
                                type="file"
                                accept=".csv"
                                onChange={(event) => {
                                    const file = event.target.files?.[0];
                                    if (file) {
                                        handleSpreadsheetUpload(file);
                                    }
                                }}
                                className="w-full text-xs text-gray-400 file:mr-4 file:rounded-md file:border-0 file:bg-blue-600 file:px-4 file:py-2 file:text-xs file:font-semibold file:text-white hover:file:bg-blue-500"
                            />
                            {isSpreadsheetUploading && (
                                <span className="text-xs text-gray-400">Importing items...</span>
                            )}
                        </div>
                        {spreadsheetStatus && (
                            <div
                                className={`mt-3 rounded-lg border px-3 py-2 text-xs ${
                                    spreadsheetStatus.tone === 'success'
                                        ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
                                        : 'border-red-500/40 bg-red-500/10 text-red-200'
                                }`}
                            >
                                {spreadsheetStatus.message}
                            </div>
                        )}
                    </div>
                    {/* Create Item Form */}
                    <div className="bg-[#131720] border border-gray-800 rounded-xl p-6">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold text-white">{editingItemId ? 'Edit Item' : 'Create New Item'}</h3>
                            {editingItemId && <button onClick={resetItemForm} className="text-xs text-red-400 hover:text-red-300">Cancel Edit</button>}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                            <Input type="text" placeholder="Item Name" className="bg-[#0b0e14] border border-gray-700 rounded p-2 text-white" value={newItem.name} onChange={e => setNewItem({...newItem, name: e.target.value})} />
                            <Input type="number" min={0} placeholder="Price (coins)" className="bg-[#0b0e14] border border-gray-700 rounded p-2 text-white" value={newItem.price ?? ''} onChange={e => setNewItem({...newItem, price: e.target.value === '' ? undefined : Number(e.target.value)})} />
                            <Input type="text" placeholder="Brand (e.g. Nike)" className="bg-[#0b0e14] border border-gray-700 rounded p-2 text-white" value={newItem.brand ?? ''} onChange={e => setNewItem({...newItem, brand: e.target.value})} />
                            <Input type="text" placeholder="Category (e.g. sneakers)" className="bg-[#0b0e14] border border-gray-700 rounded p-2 text-white" value={newItem.category ?? ''} onChange={e => setNewItem({...newItem, category: e.target.value})} />
                            <Select className="bg-[#0b0e14] border border-gray-700 rounded p-2 text-gray-300" value={newItem.rarity} onChange={e => setNewItem({...newItem, rarity: e.target.value as any})}>
                                <option value="common">Common</option>
                                <option value="uncommon">Uncommon</option>
                                <option value="rare">Rare</option>
                                <option value="epic">Epic</option>
                                <option value="legendary">Legendary</option>
                            </Select>
                            <Select
                                className="bg-[#0b0e14] border border-gray-700 rounded p-2 text-gray-300"
                                value={rarityColorOptions.find(option => option.color === newItem.color)?.value || 'custom'}
                                onChange={e => {
                                    const selectedRarity = e.target.value as CaseItem['rarity'];
                                    if (rarityColorMap[selectedRarity]) {
                                        setNewItem(prev => ({ ...prev, color: rarityColorMap[selectedRarity] }));
                                    }
                                }}
                            >
                                {rarityColorOptions.map(option => (
                                    <option key={option.value} value={option.value}>
                                        {option.label} ({option.color})
                                    </option>
                                ))}
                                {!rarityColorOptions.some(option => option.color === newItem.color) && (
                                    <option value="custom" disabled>
                                        Custom Color ({newItem.color})
                                    </option>
                                )}
                            </Select>
                            <Input type="text" placeholder="Image URL" className="bg-[#0b0e14] border border-gray-700 rounded p-2 text-white" value={newItem.image} onChange={e => setNewItem({...newItem, image: e.target.value})} />
                            <Input type="number" min={0} max={100} placeholder="Chance % (0-100)" className="bg-[#0b0e14] border border-gray-700 rounded p-2 text-white" value={newItem.chance ?? ''} onChange={e => setNewItem({...newItem, chance: e.target.value === '' ? undefined : Number(e.target.value)})} />
                            <label className="text-[10px] font-bold uppercase text-gray-500">Shipping Profile<Select value={newItem.shippingProfileId ?? ''} onChange={(e) => setNewItem({ ...newItem, shippingProfileId: e.target.value || null })} className="mt-1 min-h-11 w-full rounded border border-gray-700 bg-[#0b0e14] p-2 text-sm normal-case text-gray-200"><option value="">Default — Raw Card • 0.5 oz</option>{shippingProfiles.filter((profile) => profile.active || profile.id === newItem.shippingProfileId).map((profile) => <option key={profile.id} value={profile.id}>{profile.name}{!profile.active ? ' (Inactive)' : ''} • {profile.defaultWeightOz} oz</option>)}</Select></label>
                            <label className="col-span-1 md:col-span-2 flex items-center gap-3 rounded-lg border border-gray-700 bg-[#0b0e14] px-3 py-2 text-sm text-gray-300">
                                <Checkbox
                                  checked={newItem.redeemable ?? true}
                                  onChange={(event) => setNewItem({ ...newItem, redeemable: event.target.checked })}
                                  className="h-4 w-4 rounded border-gray-600 bg-transparent text-emerald-500 focus:ring-emerald-400"
                                />
                                Redeemable (allow sell back)
                            </label>
                            <label className="col-span-1 md:col-span-2 flex items-start gap-3 rounded-lg border border-gray-700 bg-[#0b0e14] px-3 py-2 text-sm text-gray-300">
                                <Checkbox
                                  checked={newItem.forceFullSellBack ?? false}
                                  onChange={(event) => setNewItem({ ...newItem, forceFullSellBack: event.target.checked })}
                                  className="mt-0.5 h-4 w-4 shrink-0 rounded border-gray-600 bg-transparent text-emerald-500 focus:ring-emerald-400"
                                />
                                <span className="leading-tight">
                                  Force 100% sell back for this item
                                  <span className="mt-1 block text-[10px] text-gray-500">
                                    Overrides the box sell back percentage when this item is won.
                                  </span>
                                </span>
                            </label>
                            <label className="col-span-1 md:col-span-2 flex items-center gap-3 rounded-lg border border-cyan-500/30 bg-cyan-500/5 px-3 py-2 text-sm text-cyan-100">
                                <Checkbox
                                  checked={newItem.upgraderEnabled ?? false}
                                  onChange={(event) => setNewItem({ ...newItem, upgraderEnabled: event.target.checked })}
                                  className="h-4 w-4 rounded border-cyan-400/60 bg-transparent text-cyan-400 focus:ring-cyan-300"
                                />
                                Enable for Elite Upgrader
                            </label>
                            <Select
                                className="bg-[#0b0e14] border border-gray-700 rounded p-2 text-gray-300"
                                value={newItem.upgraderCategory ?? ''}
                                onChange={(event) => setNewItem({ ...newItem, upgraderCategory: event.target.value as CaseItem['upgraderCategory'] })}
                            >
                                {UPGRADER_CATEGORY_OPTIONS.map((option) => (
                                    <option key={option.value || 'none'} value={option.value}>{option.label}</option>
                                ))}
                            </Select>
                            <Input
                                type="number"
                                placeholder="Upgrader sort order (optional)"
                                className="bg-[#0b0e14] border border-gray-700 rounded p-2 text-white"
                                value={newItem.upgraderSort ?? ''}
                                onChange={(event) => setNewItem({ ...newItem, upgraderSort: event.target.value === '' ? undefined : Number(event.target.value) })}
                            />
                            <label className="col-span-1 md:col-span-2 flex items-center gap-3 rounded-lg border border-gray-700 bg-[#0b0e14] px-3 py-2 text-sm text-gray-300">
                                <Checkbox
                                  checked={newItem.upgraderFeatured ?? false}
                                  onChange={(event) => setNewItem({ ...newItem, upgraderFeatured: event.target.checked })}
                                  className="h-4 w-4 rounded border-gray-600 bg-transparent text-[#205DD7] focus:ring-blue-400"
                                />
                                Featured in Upgrader
                            </label>
                        </div>
                        <div className="mb-4">
                            <label className="text-[10px] text-gray-500 uppercase font-bold block mb-2">Item Tags</label>
                            <div className="flex flex-col gap-3">
                                <Input
                                    type="text"
                                    placeholder="Add a tag and press Enter"
                                    className="bg-[#0b0e14] border border-gray-700 rounded p-2 text-white"
                                    value={itemTagInput}
                                    onChange={(event) => setItemTagInput(event.target.value)}
                                    onKeyDown={(event) => {
                                        if (event.key === 'Enter') {
                                            event.preventDefault();
                                            addItemTag(itemTagInput);
                                            setItemTagInput('');
                                        }
                                    }}
                                />
                                <div className="flex flex-wrap gap-2">
                                    {ITEM_TAG_SUGGESTIONS.map((tag) => (
                                        <button
                                            key={tag}
                                            type="button"
                                            onClick={() => addItemTag(tag)}
                                            className="px-2 py-1.5 rounded border text-[11px] font-semibold uppercase tracking-wide transition bg-[#0b0e14] border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-200"
                                        >
                                            {tag}
                                        </button>
                                    ))}
                                </div>
                                {(newItem.tags ?? []).length > 0 && (
                                    <div className="flex flex-wrap gap-2">
                                        {(newItem.tags ?? []).map((tag) => (
                                            <span
                                                key={tag}
                                                className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-gray-200"
                                            >
                                                {tag}
                                                <button
                                                    type="button"
                                                    onClick={() => removeItemTag(tag)}
                                                    className="rounded-full p-0.5 text-gray-400 hover:text-white"
                                                    aria-label={`Remove ${tag}`}
                                                >
                                                    <X className="h-3 w-3" />
                                                </button>
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <p className="mt-2 text-[10px] text-gray-500">Tags power Box Lab filters and box item search.</p>
                        </div>
                        <div className="mb-4">
                            <label className="text-[10px] text-gray-500 uppercase font-bold block mb-2">Size Options</label>
                            <div className="flex flex-col gap-3">
                                <Input
                                    type="text"
                                    placeholder="Add a size and press Enter (optional)"
                                    className="bg-[#0b0e14] border border-gray-700 rounded p-2 text-white"
                                    value={itemSizeInput}
                                    onChange={(event) => setItemSizeInput(event.target.value)}
                                    onKeyDown={(event) => {
                                        if (event.key === 'Enter') {
                                            event.preventDefault();
                                            addItemSize(itemSizeInput);
                                            setItemSizeInput('');
                                        }
                                    }}
                                />
                                <div className="flex flex-wrap gap-2">
                                    {ITEM_SIZE_SUGGESTIONS.map((size) => (
                                        <button
                                            key={size}
                                            type="button"
                                            onClick={() => addItemSize(size)}
                                            className="px-2 py-1.5 rounded border text-[11px] font-semibold uppercase tracking-wide transition bg-[#0b0e14] border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-200"
                                        >
                                            {size}
                                        </button>
                                    ))}
                                </div>
                                {(newItem.sizes ?? []).length > 0 && (
                                    <div className="flex flex-wrap gap-2">
                                        {(newItem.sizes ?? []).map((size) => (
                                            <span
                                                key={size}
                                                className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-gray-200"
                                            >
                                                {size}
                                                <button
                                                    type="button"
                                                    onClick={() => removeItemSize(size)}
                                                    className="rounded-full p-0.5 text-gray-400 hover:text-white"
                                                    aria-label={`Remove ${size}`}
                                                >
                                                    <X className="h-3 w-3" />
                                                </button>
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <p className="mt-2 text-[10px] text-gray-500">If provided, winners receive a random size from this list.</p>
                        </div>
                        {itemFormError && (
                            <div className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                                {itemFormError}
                            </div>
                        )}
                        <button onClick={handleSaveItem} className={`w-full px-6 py-3 sm:w-auto sm:py-2 ${editingItemId ? 'bg-orange-600 hover:bg-orange-500' : 'btn-logo-gradient'} text-white font-bold rounded`}>
                            {editingItemId ? 'Update Item' : 'Add Item'}
                        </button>
                    </div>

                    {/* Item List */}
                    <div className="bg-[#131720] border border-gray-800 rounded-xl overflow-hidden">
                        <div className="flex flex-col gap-3 border-b border-gray-800 px-4 py-4">
                            <div>
                                <h3 className="text-lg font-bold text-white">Item Inventory</h3>
                                <p className="text-xs text-gray-400">
                                    Showing {Math.min(itemVisibleCount, filteredAdminItems.length)} of {filteredAdminItems.length} items. Scroll to load more.
                                </p>
                            </div>
                            <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-3">
                                <Input
                                    value={itemSearchQuery}
                                    onChange={(event) => setItemSearchQuery(event.target.value)}
                                    placeholder="Search items, tags, sizes..."
                                    className="w-full bg-[#0b0e14] border border-gray-700 rounded p-2 text-sm text-white sm:col-span-2"
                                />
                                <Select
                                    value={itemUpgraderCategoryFilter}
                                    onChange={(event) => setItemUpgraderCategoryFilter(event.target.value as typeof itemUpgraderCategoryFilter)}
                                    className="w-full bg-[#0b0e14] border border-gray-700 rounded p-2 text-sm text-gray-300"
                                >
                                    <option value="">All upgrader categories</option>
                                    <option value="tech">Tech</option>
                                    <option value="collectible">Collectible</option>
                                    <option value="apparel">Apparel</option>
                                </Select>
                            </div>
                            <label className="inline-flex items-center gap-2 self-start rounded-lg border border-gray-700 bg-[#0b0e14] px-3 py-2 text-xs text-gray-300">
                                <Checkbox
                                    checked={itemUpgraderOnlyFilter}
                                    onChange={(event) => setItemUpgraderOnlyFilter(event.target.checked)}
                                    className="h-4 w-4 rounded border-gray-600 bg-transparent text-cyan-400 focus:ring-cyan-300"
                                />
                                Show only upgrader-enabled
                            </label>
                        </div>
                        <div ref={itemListContainerRef} className="max-h-[520px] overflow-y-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-[#0b0e14] text-gray-400 font-medium">
                                    <tr>
                                        <th className="px-4 py-3">Item</th>
                                        <th className="px-4 py-3">Rarity</th>
                                        <th className="px-4 py-3">Price</th>
                                        <th className="px-4 py-3">Upgrader</th>
                                        <th className="px-4 py-3 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-800">
                                    {visibleAdminItems.map((item, i) => (
                                        <tr key={i}>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-2">
                                                    <img src={item.image} alt={item.name} className="w-8 h-8 object-contain" />
                                                    <div>
                                                        <div className="text-white">{item.name}</div>
                                                        {(item.brand || item.category) && (
                                                            <div className="mt-0.5 text-[10px] uppercase tracking-wide text-gray-500">
                                                                {[item.brand, item.category].filter(Boolean).join(' • ')}
                                                            </div>
                                                        )}
                                                        {item.tags?.length ? (
                                                            <div className="mt-1 flex flex-wrap gap-1 text-[10px] text-gray-500">
                                                                {item.tags.map(tag => (
                                                                    <span key={tag} className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 uppercase tracking-wide text-gray-300">
                                                                        {tag}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        ) : null}
                                                        {item.sizes?.length ? (
                                                            <div className="mt-1 flex flex-wrap gap-1 text-[10px] text-gray-500">
                                                                {item.sizes.map((size) => (
                                                                    <span key={size} className="rounded-full border border-blue-500/20 bg-blue-500/10 px-2 py-0.5 uppercase tracking-wide text-blue-200">
                                                                        {size}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        ) : null}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 capitalize text-gray-400">{item.rarity}</td>
                                            <td className="px-4 py-3">
                                                <CoinAmount
                                                  amount={toCoins(item.price, PRICE_UNIT_MODE)}
                                                  formatOptions={{ maximumFractionDigits: 0 }}
                                                  className="text-green-500 font-semibold"
                                                  iconClassName="w-3.5 h-3.5"
                                                />
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex flex-wrap gap-1 text-[10px] uppercase tracking-wide">
                                                    <span className={`rounded-full border px-2 py-0.5 font-semibold ${item.upgraderEnabled ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200' : 'border-gray-700 text-gray-500'}`}>
                                                        {item.upgraderEnabled ? 'Enabled' : 'Off'}
                                                    </span>
                                                    {item.upgraderCategory ? (
                                                        <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 font-semibold text-cyan-200">
                                                            {item.upgraderCategory}
                                                        </span>
                                                    ) : null}
                                                    {item.upgraderFeatured ? (
                                                        <span className="rounded-full border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 font-semibold text-sky-200">
                                                            Featured
                                                        </span>
                                                    ) : null}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <div className="flex justify-end gap-2">
                                                    <button onClick={() => handleEditItem(item)} className="p-1.5 hover:bg-blue-500/10 text-blue-400 rounded transition-colors"><Edit2 className="w-4 h-4" /></button>
                                                    <button onClick={() => handleDeleteItem(item.id)} className="p-1.5 hover:bg-red-500/10 text-red-400 rounded transition-colors"><Trash2 className="w-4 h-4" /></button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {filteredAdminItems.length === 0 && (
                                        <tr>
                                            <td colSpan={5} className="px-4 py-6 text-center text-sm text-gray-400">
                                                No items found. Try another search.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                            <div ref={itemListSentinelRef} className="h-6" />
                        </div>
                    </div>
                </div>
            )}

            {/* TAB: BOXES */}
            {activeTab === 'boxes' && (
                <div className="space-y-8">
                    {/* Create/Edit Box Form */}
                    <div className="bg-[#131720] border border-gray-800 rounded-xl p-6">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold text-white">{editingBoxId ? 'Edit Box' : 'Create New Box'}</h3>
                            {editingBoxId && <button onClick={resetBoxForm} className="text-xs text-red-400 hover:text-red-300">Cancel Edit</button>}
                        </div>

                        {/* Top Config Row */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                            <div className="space-y-3">
                                <Input type="text" placeholder="Box Name" className="bg-[#0b0e14] border border-gray-700 rounded p-2 text-white" value={newBox.name} onChange={e => setNewBox({...newBox, name: e.target.value})} />
                                <Input type="text" placeholder="Image URL" className="bg-[#0b0e14] border border-gray-700 rounded p-2 text-white" value={newBox.image} onChange={e => setNewBox({...newBox, image: e.target.value})} />
                                <Input type="text" placeholder="Spinner Background URL (optional)" className="bg-[#0b0e14] border border-gray-700 rounded p-2 text-white" value={newBox.spinnerBackgroundImage ?? ''} onChange={e => setNewBox({...newBox, spinnerBackgroundImage: e.target.value})} />
                                <div className="rounded-lg border border-gray-700 bg-[#0b0e14] p-3">
                                    <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wide text-gray-400">Upload spinner background image</label>
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={handleSpinnerBackgroundUpload}
                                        disabled={isUploadingSpinnerBackground}
                                        className="block w-full cursor-pointer text-xs text-gray-300 file:mr-3 file:rounded file:border-0 file:bg-blue-600 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white hover:file:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
                                    />
                                    <p className="mt-2 text-[11px] leading-relaxed text-gray-500">
                                        {isUploadingSpinnerBackground
                                            ? 'Uploading to Firebase Storage…'
                                            : 'Recommended size: 1920×1080 (desktop-safe) with key visuals centered for mobile crop.'}
                                    </p>
                                </div>
                                <Input type="text" placeholder="Accent Color (Hex)" className="bg-[#0b0e14] border border-gray-700 rounded p-2 text-white" value={newBox.accentColor} onChange={e => setNewBox({...newBox, accentColor: e.target.value})} />
                                <div>
                                    <label className="text-[10px] text-gray-500 uppercase font-bold block mb-2">Box Tags</label>
                                    <div className="mb-2 flex flex-wrap gap-2">
                                        {BOX_TAG_PRESETS.map((tag) => (
                                            <button
                                                key={`preset-${tag}`}
                                                type="button"
                                                onClick={() => addBoxTag(tag)}
                                                className="rounded border border-gray-700 bg-[#0b0e14] px-2 py-1 text-[10px] uppercase tracking-wide text-gray-300 hover:border-gray-500"
                                            >
                                                + {tag}
                                            </button>
                                        ))}
                                    </div>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                        {boxTagOptions.map((tag) => {
                                            const isSelected = (newBox.tags ?? []).includes(tag);
                                            return (
                                                <button
                                                    key={tag}
                                                    type="button"
                                                    aria-pressed={isSelected}
                                                    onClick={() => toggleBoxTag(tag)}
                                                    className={`px-2 py-1.5 rounded border text-[11px] font-semibold uppercase tracking-wide transition ${isSelected ? 'bg-blue-600/20 border-blue-500 text-blue-200' : 'bg-[#0b0e14] border-gray-700 text-gray-400 hover:border-gray-500'}`}
                                                >
                                                    {tag}
                                                </button>
                                            );
                                        })}
                                    </div>
                                    <div className="mt-3 space-y-2">
                                        <div className="flex flex-wrap gap-2">
                                            {(newBox.tags ?? []).map((tag) => (
                                                <span key={tag} className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-300">
                                                    {tag}
                                                    <button
                                                        type="button"
                                                        onClick={() => removeBoxTag(tag)}
                                                        className="text-gray-500 hover:text-white"
                                                        aria-label={`Remove ${tag}`}
                                                    >
                                                        <X className="h-3 w-3" />
                                                    </button>
                                                </span>
                                            ))}
                                        </div>
                                        <Input
                                            type="text"
                                            placeholder="Add tags (comma or enter)"
                                            className="w-full bg-[#0b0e14] border border-gray-700 rounded p-2 text-white text-sm"
                                            value={boxTagInput}
                                            onChange={(e) => setBoxTagInput(e.target.value)}
                                            onKeyDown={(event) => {
                                                if (event.key === 'Enter' || event.key === ',') {
                                                    event.preventDefault();
                                                    const entries = boxTagInput.split(',').map((tagValue) => tagValue.trim()).filter(Boolean);
                                                    entries.forEach((entry) => addBoxTag(entry));
                                                    setBoxTagInput('');
                                                }
                                            }}
                                            onBlur={() => {
                                                const entries = boxTagInput.split(',').map((tagValue) => tagValue.trim()).filter(Boolean);
                                                if (entries.length > 0) {
                                                    entries.forEach((entry) => addBoxTag(entry));
                                                    setBoxTagInput('');
                                                }
                                            }}
                                        />
                                    </div>
                                    <p className="mt-2 text-[10px] text-gray-500">
                                      Tags power homepage filters and catalog badges (new=blue, top=violet, hot=red, limited=gold, popular=green). Max {MAX_BOX_TAGS} tags, {MAX_BOX_TAG_LENGTH} characters each.
                                    </p>
                                </div>
                                <div className="mt-5 rounded-xl border border-white/10 bg-[#0b0e14] p-3 sm:p-4">
                                    <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                        <div>
                                            <h4 className="text-sm font-semibold text-white">Category tag editor</h4>
                                            <p className="text-[11px] text-gray-400">Set a custom label and either a Font Awesome class or SVG icon for every box tag.</p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={handleSaveBoxTagIcons}
                                            className="w-full rounded-lg bg-[#205DD7] px-3 py-2 text-xs font-bold text-white hover:bg-[#1f6bea] sm:w-auto"
                                        >
                                            Save tag settings
                                        </button>
                                    </div>
                                    {boxTagIconsNotice && <p className="mb-3 text-xs text-green-400">Tag settings saved.</p>}
                                    <div className="mb-3 flex flex-col gap-2 sm:flex-row">
                                        <Input
                                            type="text"
                                            value={customBoxTag}
                                            onChange={(event) => setCustomBoxTag(event.target.value)}
                                            onKeyDown={(event) => {
                                                if (event.key === 'Enter') {
                                                    event.preventDefault();
                                                    addCustomBoxTag();
                                                }
                                            }}
                                            placeholder="Add a custom tag, e.g. apparel"
                                            className="min-w-0 flex-1 bg-[#080b10] border border-gray-700 rounded p-2 text-xs text-white"
                                        />
                                        <button type="button" onClick={addCustomBoxTag} className="rounded-lg border border-gray-600 px-3 py-2 text-xs font-semibold text-gray-200 hover:border-blue-400 hover:text-white">Add tag</button>
                                    </div>
                                    {Array.from(new Set([...boxTagStats.map(({ tag }) => tag), ...Object.keys(boxTagLabelsDraft), ...Object.keys(boxTagIconsDraft)])).length === 0 ? (
                                        <p className="text-xs text-gray-400">No tags found on current site boxes yet.</p>
                                    ) : (
                                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                            {Array.from(new Set([...boxTagStats.map(({ tag }) => tag), ...Object.keys(boxTagLabelsDraft), ...Object.keys(boxTagIconsDraft)])).sort().map((tag) => {
                                                const count = boxTagStats.find((entry) => entry.tag === tag)?.count ?? 0;
                                                const iconClass = boxTagIconsDraft[tag] ?? '';
                                                return (
                                                    <div key={`tag-icon-${tag}`} className="rounded-lg border border-white/10 p-2">
                                                        <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-gray-200">
                                                            <span className="truncate uppercase tracking-wide">{tag}</span>
                                                            <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-gray-300">{count} box{count === 1 ? '' : 'es'}</span>
                                                            {iconClass ? <i aria-hidden="true" className={`${sanitizeFontAwesomeClass(iconClass)} text-sm text-blue-300`} /> : <span className="h-2.5 w-2.5 rounded-full bg-blue-500" />}
                                                        </div>
                                                        <Input
                                                            type="text"
                                                            placeholder="fa-regular fa-gem or https://.../icon.svg"
                                                            className="w-full bg-[#080b10] border border-gray-700 rounded p-2 text-xs text-white"
                                                            value={iconClass}
                                                            onChange={(event) => setBoxTagIconsDraft((prev) => ({ ...prev, [tag]: event.target.value }))}
                                                        />
                                                        <Input
                                                            type="text"
                                                            placeholder="Display label"
                                                            aria-label={`${tag} display label`}
                                                            className="mt-2 w-full bg-[#080b10] border border-gray-700 rounded p-2 text-xs text-white"
                                                            value={boxTagLabelsDraft[tag] ?? ''}
                                                            onChange={(event) => setBoxTagLabelsDraft((prev) => ({ ...prev, [tag]: event.target.value }))}
                                                        />
                                                        <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
                                                            <input
                                                                type="file"
                                                                accept=".svg,image/svg+xml"
                                                                onChange={(event) => {
                                                                    const file = event.target.files?.[0] ?? null;
                                                                    void handleUploadTagSvg(tag, file);
                                                                    event.currentTarget.value = '';
                                                                }}
                                                                className="block w-full cursor-pointer text-[11px] text-gray-300 file:mr-2 file:rounded file:border-0 file:bg-blue-600 file:px-2 file:py-1 file:text-[10px] file:font-medium file:text-white hover:file:bg-blue-500"
                                                            />
                                                            {iconClass.startsWith('http') && (
                                                                <img src={iconClass} alt={`${tag} icon`} className="h-5 w-5 object-contain" />
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="flex flex-col gap-4">
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                    <div>
                                        <label className="text-[10px] text-gray-500 uppercase font-bold block mb-1">Currency Type</label>
                                        <Select
                                            value={newBox.currencyType ?? 'COIN'}
                                            onChange={(event) => setNewBox((prev) => ({ ...prev, currencyType: event.target.value as 'COIN' | 'XP' }))}
                                        >
                                            <option value="COIN">COIN</option>
                                            <option value="XP">XP</option>
                                        </Select>
                                    </div>
                                    <div>
                                        <label className="text-[10px] text-gray-500 uppercase font-bold block mb-1">{isXpBox ? 'Price (XP)' : 'Price (coins)'}</label>
                                        <Input
                                          type="number"
                                          placeholder={isXpBox ? 'Box Price (XP)' : 'Box Price (coins)'}
                                          className="w-full bg-[#0b0e14] border border-gray-700 rounded p-2 text-white font-bold text-green-400"
                                          value={isXpBox ? (newBox.priceXP ?? '') : (newBox.price ?? '')}
                                          onChange={(e) => {
                                              const nextValue = e.target.value === '' ? undefined : Math.max(0, Number(e.target.value));
                                              if (isXpBox) {
                                                setNewBox({ ...newBox, priceXP: Number.isFinite(nextValue) ? Math.floor(nextValue) : undefined });
                                              } else {
                                                setNewBox({ ...newBox, price: Number.isFinite(nextValue) ? nextValue : undefined });
                                              }
                                          }}
                                        />
                                        <div className="text-[10px] text-gray-500 mt-1 flex items-center gap-1">
                                            <span>Calculated:</span>
                                            {hasExplicitBoxPrice ? (
                                                isXpBox ? (
                                                    <span className="text-gray-300 font-semibold">{Math.floor(Number(newBox.priceXP ?? 0)).toLocaleString()} XP</span>
                                                ) : (
                                                    <CoinAmount
                                                        amount={toCoins(Number(newBox.price), PRICE_UNIT_MODE)}
                                                        formatOptions={{ maximumFractionDigits: 0 }}
                                                        className="text-gray-300 font-semibold"
                                                        iconClassName="w-3 h-3"
                                                    />
                                                )
                                            ) : (
                                                <span className="text-gray-600">--</span>
                                            )}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-[10px] text-gray-500 uppercase font-bold block mb-1">Target EV (ratio)</label>
                                        <Input
                                            type="number"
                                            min={0.5}
                                            max={1.5}
                                            step={0.01}
                                            placeholder="0.85"
                                            className="w-full bg-[#0b0e14] border border-gray-700 rounded p-2 text-white font-bold"
                                            value={targetEV}
                                            onChange={e => setTargetEV(Number(e.target.value))}
                                        />
                                        <p className="text-[10px] text-gray-500 mt-1">0.85 = 85% payout target.</p>
                                    </div>
                                    <div>
                                        <label className="text-[10px] text-gray-500 uppercase font-bold block mb-1">Sell back %</label>
                                        <Input
                                            type="number"
                                            min={0}
                                            max={100}
                                            step={1}
                                            placeholder="82"
                                            className="w-full bg-[#0b0e14] border border-gray-700 rounded p-2 text-white font-bold"
                                            value={Math.round((newBox.sellBackRate ?? 0.82) * 100)}
                                            onChange={e => {
                                              const nextRate = Math.min(100, Math.max(0, Number(e.target.value)));
                                              setNewBox({ ...newBox, sellBackRate: Number.isFinite(nextRate) ? nextRate / 100 : 0.82 });
                                            }}
                                        />
                                        <p className="text-[10px] text-gray-500 mt-1">Percent of item value paid on sell back.</p>
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[10px] text-gray-500 uppercase font-bold block mb-1">Risk Balance</label>
                                    <Input
                                        type="range"
                                        min={0}
                                        max={100}
                                        value={riskBalance}
                                        onChange={e => setRiskBalance(Number(e.target.value))}
                                        className="w-full accent-brand-blue"
                                    />
                                    <div className="flex justify-between text-[10px] text-gray-500">
                                        <span>Safer</span>
                                        <span className="text-gray-300 font-semibold">{getRiskLabel(riskBalance)}</span>
                                        <span>Riskier</span>
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] text-gray-400">
                                    <div className="bg-[#0b0e14] border border-gray-800 rounded p-2">
                                        <div className="uppercase text-[10px] text-gray-500 font-bold">Live EV</div>
                                        <div className="text-white font-semibold">{expectedValue.toFixed(2)}</div>
                                    </div>
                                    <div className="bg-[#0b0e14] border border-gray-800 rounded p-2">
                                        <div className="uppercase text-[10px] text-gray-500 font-bold">Margin</div>
                                        <div className="text-white font-semibold">{Number.isFinite(marginPercent) ? `${marginPercent.toFixed(2)}%` : '--'}</div>
                                    </div>
                                    <div className="bg-[#0b0e14] border border-gray-800 rounded p-2">
                                        <div className="uppercase text-[10px] text-gray-500 font-bold">Total Odds</div>
                                        <div className="text-white font-semibold">{oddsTotal.toFixed(2)}%</div>
                                    </div>
                                </div>
                                {(evOutOfBounds || oddsOutOfBounds) && (
                                    <div className="text-[11px] text-red-400">
                                        {oddsOutOfBounds && <div>⚠ Total odds must equal 100%.</div>}
                                        {evOutOfBounds && <div>⚠ EV must stay within ±1% of target.</div>}
                                    </div>
                                )}
                                <div className="flex items-center gap-2">
                                    <Checkbox
                                        id="daily-case"
                                        checked={newBox.isDaily || false}
                                        onChange={e => setNewBox({...newBox, isDaily: e.target.checked})}
                                        className="w-4 h-4 rounded border-gray-700 bg-[#0b0e14] text-brand-blue focus:ring-brand-blue"
                                    />
                                    <label htmlFor="daily-case" className="text-sm text-gray-400 flex items-center gap-1">
                                        <Calendar className="w-3 h-3 text-yellow-500" /> Set as Daily Free Box
                                    </label>
                                </div>
                                <p className="text-[10px] text-gray-500">
                                    Daily free boxes can be saved with a price of 0.
                                </p>
                                <div className="mt-3 rounded-lg border border-purple-400/20 bg-purple-500/5 p-3">
                                    <div className="flex items-center gap-2">
                                        <Checkbox
                                            id="pull-pass-case"
                                            checked={newBox.isPullPassBox || false}
                                            onChange={e => setNewBox({...newBox, isPullPassBox: e.target.checked, pullPassBoxType: e.target.checked ? (newBox.pullPassBoxType ?? 'bronze') : newBox.pullPassBoxType})}
                                            className="w-4 h-4 rounded border-gray-700 bg-[#0b0e14] text-brand-blue focus:ring-brand-blue"
                                        />
                                        <label htmlFor="pull-pass-case" className="text-sm text-gray-300">Set as Pull Pass Box</label>
                                    </div>
                                    {newBox.isPullPassBox && (
                                        <label className="mt-3 block text-xs text-gray-500 uppercase font-bold">Pull Pass box type
                                            <Select
                                                value={newBox.pullPassBoxType ?? 'bronze'}
                                                onChange={(event) => setNewBox((prev) => ({ ...prev, pullPassBoxType: event.target.value as any }))}
                                                className="mt-1 w-full bg-[#0b0e14] border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200"
                                            >
                                                <option value="bronze">Bronze</option>
                                                <option value="silver">Silver</option>
                                                <option value="gold">Gold</option>
                                                <option value="elite">Elite</option>
                                                <option value="master">Master</option>
                                                <option value="collector">Collector</option>
                                            </Select>
                                        </label>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Middle: Item Selector & Auto-Calculator */}
                        <div className="mb-6 p-4 bg-[#0b0e14] rounded-lg border border-gray-800">
                             <div className="flex justify-between items-center mb-4">
                                 <h4 className="text-sm font-bold text-gray-400 uppercase">Available Items</h4>
                                 <button
                                    onClick={calculateBoxConfig}
                                    disabled={selectedItems.length === 0}
                                    className="flex items-center gap-2 px-3 py-1.5 bg-brand-blue hover:bg-[#205DD7] disabled:opacity-50 text-white text-xs font-bold rounded shadow-lg shadow-blue-900/20"
                                 >
                                    <Calculator className="w-3 h-3" /> Auto-Calculate Odds & Price
                                 </button>
                             </div>
                             <p className="mb-3 text-[11px] text-gray-500">
                                 Mode: <span className="font-semibold text-gray-300">{oddsEditorMode === 'manual' ? 'Manual odds' : 'Auto-calculated odds'}</span>. You can edit each item&apos;s chance directly below. Changing an item EV value auto-recalculates odds against the target EV.
                             </p>

                             <div className="mb-4 flex flex-col gap-3">
                                 <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                                     <label className="text-[10px] uppercase text-gray-500 font-bold">
                                         Brand
                                         <Select
                                             className="mt-1 w-full bg-[#131720] border border-gray-800 rounded p-2 text-xs text-gray-200"
                                             value={itemBrandFilter}
                                             onChange={(event) => setItemBrandFilter(event.target.value)}
                                         >
                                             <option value="">All brands</option>
                                             {itemBrandOptions.map((brand) => (
                                                 <option key={brand} value={brand}>
                                                     {brand}
                                                 </option>
                                             ))}
                                         </Select>
                                     </label>
                                     <label className="text-[10px] uppercase text-gray-500 font-bold">
                                         Category
                                         <Select
                                             className="mt-1 w-full bg-[#131720] border border-gray-800 rounded p-2 text-xs text-gray-200"
                                             value={itemCategoryFilter}
                                             onChange={(event) => setItemCategoryFilter(event.target.value)}
                                         >
                                             <option value="">All categories</option>
                                             {itemCategoryOptions.map((category) => (
                                                 <option key={category} value={category}>
                                                     {category}
                                                 </option>
                                             ))}
                                         </Select>
                                     </label>
                                     <label className="text-[10px] uppercase text-gray-500 font-bold sm:col-span-2 lg:col-span-1">
                                         Search
                                         <Input
                                             type="text"
                                             value={boxItemSearchQuery}
                                             onChange={(event) => setBoxItemSearchQuery(event.target.value)}
                                             placeholder="Search name, tag, category..."
                                             className="mt-1 w-full bg-[#131720] border border-gray-800 rounded p-2 text-xs text-gray-200"
                                         />
                                     </label>
                                 </div>
                                 <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                     <div className="text-[11px] text-gray-500">
                                         Showing <span className="font-semibold text-gray-300">{filteredItemsForBox.length}</span> of {items.length} catalog items.
                                     </div>
                                     <button
                                         type="button"
                                         onClick={() => {
                                             setItemBrandFilter('');
                                             setItemCategoryFilter('');
                                             setItemTagFilters([]);
                                             setBoxItemSearchQuery('');
                                         }}
                                         className="w-full rounded border border-gray-700 px-3 py-2 text-[11px] font-semibold uppercase text-gray-400 transition hover:border-gray-500 hover:text-gray-200 sm:w-auto"
                                     >
                                         Clear Filters
                                     </button>
                                 </div>
                                 <div>
                                     <div className="text-[10px] uppercase text-gray-500 font-bold mb-2">Tags (match any)</div>
                                     <div className="flex flex-wrap gap-2">
                                         {itemTagOptions.map((tag) => {
                                             const isSelected = itemTagFilters.includes(tag);
                                             return (
                                                 <button
                                                     key={tag}
                                                     type="button"
                                                     onClick={() => toggleItemFilterTag(tag)}
                                                     className={`px-2 py-1.5 rounded border text-[11px] font-semibold uppercase tracking-wide transition ${isSelected ? 'bg-brand-blue/20 border-brand-blue text-blue-200' : 'bg-[#131720] border-gray-800 text-gray-400 hover:border-gray-600'}`}
                                                 >
                                                     {tag}
                                                 </button>
                                             );
                                         })}
                                     </div>
                                 </div>
                             </div>

                             {/* Item Pool */}
                             <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 max-h-48 overflow-y-auto mb-4 pr-1">
                                {filteredItemsForBox.map(item => {
                                    const isSelected = selectedItems.some(i => i.id === item.id);
                                    return (
                                        <div
                                            key={item.id}
                                            onClick={() => toggleItemSelection(item)}
                                            className={`relative p-2 rounded border cursor-pointer flex flex-col items-center gap-2 text-center transition-all ${isSelected ? 'bg-blue-600/10 border-blue-500' : 'bg-[#131720] border-gray-800 hover:border-gray-600'}`}
                                        >
                                            <img src={item.image} alt={item.name} className="w-8 h-8 object-contain" />
                                            <div className="w-full">
                                                <div className="text-[10px] text-gray-300 truncate font-medium">{item.name}</div>
                                                <CoinAmount
                                                  amount={toCoins(item.price, PRICE_UNIT_MODE)}
                                                  formatOptions={{ maximumFractionDigits: 0 }}
                                                  className="text-[10px] text-green-400 font-bold justify-center"
                                                  iconClassName="w-3 h-3"
                                                />
                                            </div>
                                            {isSelected && <div className="absolute top-1 right-1 w-2 h-2 bg-blue-500 rounded-full"></div>}
                                        </div>
                                    );
                                })}
                             </div>

                             {/* Selected & Configured Items */}
                             {selectedItems.length > 0 && (
                                 <div className="border-t border-gray-800 pt-4">
                                     <div className="mb-3 space-y-2 rounded-xl border border-gray-700 bg-[#10141c] p-3">
                                         <div className="flex flex-wrap items-center justify-between gap-2">
                                             <h4 className="text-sm font-bold uppercase text-gray-300">Box Contents ({selectedItems.length})</h4>
                                             <div className="flex gap-2">
                                                 <button type="button" onClick={() => setBulkShippingItemIds(selectedItems.map((item) => item.id))} className="min-h-10 rounded-lg border border-gray-600 px-3 text-xs font-bold text-gray-200">Select all</button>
                                                 {bulkShippingItemIds.length > 0 && <button type="button" onClick={() => setBulkShippingItemIds([])} className="min-h-10 rounded-lg border border-gray-700 px-3 text-xs font-bold text-gray-400">Clear</button>}
                                             </div>
                                         </div>
                                         <label className="flex flex-col gap-1 text-[10px] font-bold uppercase text-gray-500 sm:flex-row sm:items-center">Assign profile to {bulkShippingItemIds.length} selected
                                             <Select aria-label="Assign a shipping profile to selected box items" defaultValue="" disabled={bulkShippingItemIds.length === 0} onChange={(event) => { const id = event.target.value; if (!id) return; const selectedIds = new Set(bulkShippingItemIds); setSelectedItems((current) => current.map((entry) => selectedIds.has(entry.id) ? { ...entry, shippingProfileId: id === '__unassigned' ? null : id } : entry)); event.target.value = ''; }} className="min-h-11 w-full rounded border border-gray-700 bg-[#0b0e14] px-3 text-sm normal-case text-white disabled:opacity-50 sm:min-w-64 sm:flex-1"><option value="">Choose profile…</option><option value="__unassigned">Default — Raw Card • 0.5 oz</option>{shippingProfiles.filter((profile) => profile.active).map((profile) => <option key={profile.id} value={profile.id}>{profile.name} • {profile.defaultWeightOz} oz</option>)}</Select>
                                         </label>
                                     </div>
                                     <div className="space-y-1">
                                         {selectedItems.map((item, idx) => (
                                             <div key={idx} className="flex flex-wrap items-center gap-2 text-xs bg-[#131720] p-2 rounded border border-gray-700 sm:flex-nowrap">
                                                 <label className="flex min-h-11 min-w-11 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-gray-600 bg-black/25" aria-label={`Select ${item.name} for bulk shipping profile assignment`}><input type="checkbox" checked={bulkShippingItemIds.includes(item.id)} onChange={(event) => setBulkShippingItemIds((ids) => event.target.checked ? Array.from(new Set([...ids, item.id])) : ids.filter((id) => id !== item.id))} className="h-5 w-5 accent-blue-500" /></label>
                                                 <button
                                                     type="button"
                                                     onClick={() => toggleItemSelection(item)}
                                                     className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-red-500/40 bg-red-500/10 text-red-300 transition hover:bg-red-500/20 focus:outline-none focus:ring-2 focus:ring-red-400"
                                                     aria-label={`Remove ${item.name} from box`}
                                                     title="Remove item from box"
                                                 >
                                                     <X className="h-4 w-4" />
                                                 </button>
                                                 <img src={item.image} alt={item.name} className="w-8 h-8 object-contain sm:w-5 sm:h-5" />
                                                 <span className="min-w-[120px] flex-1 text-gray-300 truncate">{item.name}</span>
                                                 <label className="flex w-full flex-col gap-1 rounded bg-black/30 px-2 py-1 text-[10px] font-bold uppercase text-gray-500 sm:w-52">Shipping Profile<Select value={item.shippingProfileId ?? ''} onChange={(event) => setSelectedItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, shippingProfileId: event.target.value || null } : entry))} className={`min-h-10 w-full rounded border bg-[#0b0e14] px-2 text-xs normal-case text-white ${item.shippingProfileId ? 'border-gray-700' : 'border-amber-500/60'}`}><option value="">Default — Raw Card • 0.5 oz</option>{shippingProfiles.filter((profile) => profile.active || profile.id === item.shippingProfileId).map((profile) => <option key={profile.id} value={profile.id}>{profile.name}{!profile.active ? ' (Inactive)' : ''} • {profile.defaultWeightOz} oz</option>)}</Select>{!item.shippingProfileId && <span className="normal-case text-amber-300">Defaults to Raw Card • 0.5 oz</span>}</label>
                                                 <div className="flex w-full flex-col gap-1 rounded bg-black/30 px-2 py-1 sm:w-[150px]">
                                                     <div className="flex items-center justify-between gap-2">
                                                         <span className="text-[10px] uppercase text-gray-500">EV value</span>
                                                         <CoinAmount
                                                           amount={toCoins(item.price, PRICE_UNIT_MODE)}
                                                           formatOptions={{ maximumFractionDigits: 0 }}
                                                           className="text-[11px] text-emerald-300"
                                                           iconClassName="w-3 h-3"
                                                         />
                                                     </div>
                                                     <Input
                                                         type="number"
                                                         min={0}
                                                         step={1}
                                                         value={Math.round(Number(item.price ?? 0))}
                                                         onChange={(event) => handleSelectedItemValueOverrideChange(item.id, event.target.value)}
                                                         className="w-full bg-[#0b0e14] border border-gray-700 rounded px-2 py-1 text-white font-semibold text-xs"
                                                         aria-label={`Override EV coin value for ${item.name}`}
                                                     />
                                                     <button
                                                         type="button"
                                                         onClick={() => resetSelectedItemValueOverride(item)}
                                                         className="text-left text-[10px] text-gray-500 hover:text-gray-300"
                                                     >
                                                         Reset to catalog: {Math.round(getCatalogItemPrice(item)).toLocaleString()} coins
                                                     </button>
                                                 </div>
                                                 <label className="flex items-center gap-1 bg-black/30 px-2 py-1 rounded w-full sm:w-auto">
                                                     <span className="text-gray-400 whitespace-nowrap">Chance %</span>
                                                     <Input
                                                         type="number"
                                                         min={0}
                                                         max={100}
                                                         step={0.0001}
                                                         value={item.chance}
                                                         onChange={(event) => handleSelectedItemChanceChange(item.id, event.target.value)}
                                                         className="w-24 bg-[#0b0e14] border border-gray-700 rounded px-2 py-1 text-white font-semibold text-xs"
                                                     />
                                                 </label>
                                                 <label className="relative">
                                                     <span className="sr-only">Item rarity for {item.name}</span>
                                                     <select
                                                         value={item.rarity}
                                                         onChange={(event) => handleSelectedItemRarityChange(item.id, event.target.value as CaseItem['rarity'])}
                                                         className="cursor-pointer rounded font-bold uppercase text-[10px] px-2 py-1 pr-6 border border-white/10 bg-black/30 focus:outline-none focus:ring-2 focus:ring-brand-blue"
                                                         style={{ color: item.color, backgroundColor: `${item.color}20` }}
                                                     >
                                                         {rarityColorOptions.map((option) => (
                                                             <option key={option.value} value={option.value}>
                                                                 {option.label}
                                                             </option>
                                                         ))}
                                                     </select>
                                                 </label>
                                             </div>
                                         ))}
                                     </div>
                                 </div>
                             )}
                        </div>

                        {editingBoxId && (() => {
                            const persistedBox = boxes.find((entry) => entry.id === editingBoxId);
                            return persistedBox ? <BoxMarketPricingEditor box={{ ...persistedBox, items: selectedItems, price: Number(newBox.price ?? persistedBox.price) }} items={selectedItems} onItemsChange={setSelectedItems} /> : null;
                        })()}

                        <button
                            onClick={handleSaveBox}
                            disabled={!canSaveBox}
                            className={`w-full py-3 ${editingBoxId ? 'bg-orange-600 hover:bg-orange-500' : 'btn-logo-gradient'} text-white font-bold rounded shadow-lg disabled:opacity-50 disabled:cursor-not-allowed`}
                        >
                            {editingBoxId ? 'Update Box' : 'Create Box'}
                        </button>
                    </div>

                     {/* Box List */}
                     <div className="bg-[#131720] border border-gray-800 rounded-xl overflow-hidden">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-[#0b0e14] text-gray-400 font-medium">
                                <tr>
                                    <th className="px-4 py-3">Box</th>
                                    <th className="px-4 py-3">Items</th>
                                    <th className="px-4 py-3">Price</th>
                                    <th className="px-4 py-3 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-800">
                                {boxes.map((box, i) => (
                                    <tr key={i}>
                                        <td className="px-4 py-3 flex items-center gap-2">
                                            <img src={box.image} alt={box.name} className="w-8 h-8 object-contain" />
                                            <div>
                                                <div className="text-white flex items-center gap-2">
                                                    {box.name}
                                                    {box.isDaily && <span className="text-[10px] bg-yellow-500/20 text-yellow-500 px-1 rounded">DAILY</span>}
                                                    {box.isPullPassBox && <span className="text-[10px] bg-purple-500/20 text-purple-300 px-1 rounded">PULL PASS {box.pullPassBoxType?.toUpperCase()}</span>}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-gray-400">{box.items?.length || 0} items</td>
                                        <td className="px-4 py-3">
                                            <CoinAmount
                                              amount={toCoins(box.price, PRICE_UNIT_MODE)}
                                              formatOptions={{ maximumFractionDigits: 0 }}
                                              className="text-green-500 font-semibold"
                                              iconClassName="w-3.5 h-3.5"
                                            />
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <div className="flex justify-end gap-2">
                                                <button onClick={() => handleEditBox(box)} className="p-1.5 hover:bg-blue-500/10 text-blue-400 rounded transition-colors"><Edit2 className="w-4 h-4" /></button>
                                                <button
                                                    onClick={() => initiateDeleteBox(box.id)}
                                                    className={`p-1.5 rounded transition-colors ${deletingBoxId === box.id ? 'bg-red-500 text-white animate-pulse' : 'hover:bg-red-500/10 text-red-400'}`}
                                                    disabled={deletingBoxId === box.id}
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* TAB: COIN PACKAGES */}
            {activeTab === 'packages' && (
                <div className="space-y-6">
                    <div className="bg-[#131720] border border-gray-800 rounded-xl p-6">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <h3 className="text-lg font-bold text-white">Coin Packages</h3>
                                <p className="text-xs text-gray-400 mt-1">
                                    Manage Stripe price-based packages shown in the top up modal. Use Stripe price IDs (price_...).
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={openNewPackageModal}
                                className="w-full sm:w-auto px-4 py-2 rounded-lg btn-logo-gradient text-white text-sm font-semibold"
                            >
                                New Package
                            </button>
                        </div>
                    </div>
                    <div className="bg-[#131720] border border-gray-800 rounded-xl overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[1120px] text-left text-sm">
                                <thead className="bg-[#0b0e14] text-gray-400 font-medium">
                                    <tr>
                                        <th className="px-4 py-3">Name</th>
                                        <th className="px-4 py-3">Base Coins</th>
                                        <th className="px-4 py-3">Bonus Coins</th>
                                        <th className="px-4 py-3">Total</th>
                                        <th className="px-4 py-3">Display Price</th>
                                        <th className="px-4 py-3">Image URL</th>
                                        <th className="px-4 py-3">Stripe Price ID</th>
                                        <th className="px-4 py-3">Badge</th>
                                        <th className="px-4 py-3">Active</th>
                                        <th className="px-4 py-3">Default</th>
                                        <th className="px-4 py-3">First Deposit</th>
                                        <th className="px-4 py-3">Sort</th>
                                        <th className="px-4 py-3">Updated</th>
                                        <th className="px-4 py-3 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-800">
                                    {sortedPackages.length ? (
                                        sortedPackages.map((pkg) => (
                                            <tr key={pkg.id}>
                                                <td className="px-4 py-3 text-white font-semibold">{pkg.name}</td>
                                                <td className="px-4 py-3">
                                                    <CoinAmount
                                                        amount={pkg.coins}
                                                        formatOptions={{ maximumFractionDigits: 0 }}
                                                        className="text-green-400 font-semibold"
                                                        iconClassName="w-3.5 h-3.5"
                                                    />
                                                </td>
                                                <td className="px-4 py-3 text-gray-300">
                                                    {(pkg.bonusCoins ?? 0).toLocaleString()}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <CoinAmount
                                                        amount={pkg.totalCoins ?? (pkg.coins + (pkg.bonusCoins ?? 0))}
                                                        formatOptions={{ maximumFractionDigits: 0 }}
                                                        className="text-white font-semibold"
                                                        iconClassName="w-3.5 h-3.5"
                                                    />
                                                </td>
                                                <td className="px-4 py-3 text-gray-300">{pkg.displayPrice}</td>
                                                <td className="px-4 py-3 text-xs text-gray-400">
                                                    {pkg.imageUrl ? (
                                                        <a href={pkg.imageUrl} target="_blank" rel="noreferrer" className="font-mono underline decoration-dotted underline-offset-2 hover:text-white">
                                                            Custom image
                                                        </a>
                                                    ) : (
                                                        <span className="text-gray-500">Default</span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-xs text-gray-400">
                                                    <span className="rounded bg-black/30 px-2 py-1 font-mono">{pkg.stripePriceId}</span>
                                                </td>
                                                <td className="px-4 py-3 text-xs text-gray-300">
                                                    {pkg.badge?.trim() ? <span className="rounded-full bg-white/10 px-2 py-1 font-semibold text-white">{pkg.badge}</span> : <span className="text-gray-500">—</span>}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleTogglePackageActive(pkg)}
                                                        className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                                                            pkg.active
                                                                ? 'bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20'
                                                                : 'bg-gray-500/10 text-gray-400 hover:bg-gray-500/20'
                                                        }`}
                                                    >
                                                        {pkg.active ? 'Active' : 'Inactive'}
                                                    </button>
                                                </td>
                                                <td className="px-4 py-3 text-xs text-gray-300">
                                                    {pkg.defaultSelected ? (
                                                        <span className="rounded-full bg-cyan-500/20 px-2 py-1 font-semibold text-cyan-200">Preselected</span>
                                                    ) : (
                                                        <span className="text-gray-500">—</span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-xs text-gray-300">
                                                    {pkg.firstTimeDepositOnly ? (
                                                        <span className="rounded-full bg-amber-500/15 px-2 py-1 font-semibold text-amber-200">First deposit</span>
                                                    ) : (
                                                        <span className="text-gray-500">—</span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-gray-300">{pkg.sortOrder}</td>
                                                <td className="px-4 py-3 text-gray-400 text-xs">
                                                    {pkg.updatedAt ? formatTimestamp(pkg.updatedAt) : '--'}
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    <div className="flex flex-col justify-end gap-2 sm:flex-row">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleEditPackage(pkg)}
                                                            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-blue-500/20 px-2.5 py-2 text-xs font-semibold text-blue-300 transition-colors hover:bg-blue-500/10"
                                                            aria-label={`Edit ${pkg.name}`}
                                                        >
                                                            <Edit2 className="w-4 h-4" />
                                                            <span>Edit</span>
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleDeletePackage(pkg)}
                                                            disabled={deletingPackageId === pkg.id}
                                                            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-red-500/25 px-2.5 py-2 text-xs font-semibold text-red-300 transition-colors hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-50"
                                                            aria-label={`Delete ${pkg.name}`}
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                            <span>{deletingPackageId === pkg.id ? 'Deleting...' : 'Delete'}</span>
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={14} className="px-4 py-6 text-center text-gray-500 text-sm">
                                                No coin packages yet. Create one to enable deposits.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB: USERS */}
            {activeTab === 'users' && (
                <div className="space-y-6">
                    <div className="rounded-2xl border border-gray-800 bg-[#131720] p-4 sm:p-6">
                        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                            <div>
                                <h2 className="text-xl font-bold text-white">User Operations</h2>
                                <p className="text-sm text-gray-400">Live user monitoring center for moderation, finance, inventory, shipments, and support workflows.</p>
                            </div>
                            <div className="flex w-full flex-col gap-3 md:flex-row xl:w-auto">
                                <Input
                                    type="text"
                                    value={userSearchQuery}
                                    onChange={(event) => setUserSearchQuery(event.target.value)}
                                    placeholder="Search users, UID, email, signup IP, labels, risk, balances"
                                    className="w-full md:w-96 bg-[#0b0e14] border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200"
                                />
                                <button
                                    type="button"
                                    onClick={reviewFlaggedAccounts}
                                    disabled={flaggedAccountCount === 0}
                                    className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-200 transition-colors hover:bg-red-500/20 disabled:cursor-not-allowed disabled:border-gray-700 disabled:bg-[#0b0e14] disabled:text-gray-500 md:w-auto"
                                >
                                    <ShieldAlert className="h-4 w-4 shrink-0" />
                                    <span>Review flagged accounts</span>
                                    <span className="rounded-full bg-black/30 px-2 py-0.5" aria-label={`${flaggedAccountCount} flagged accounts`}>{flaggedAccountCount}</span>
                                </button>
                                <button type="button" className="rounded-lg border border-gray-700 bg-[#0b0e14] px-3 py-2 text-xs font-semibold text-gray-300">Export</button>
                            </div>
                        </div>
                        <div className="mt-4 flex flex-wrap items-center gap-2">
                            {[
                                { key: 'all', label: 'All Users' },
                                { key: 'shared_ip', label: 'Shared Signup IP' },
                                { key: 'high_risk', label: 'High Risk' },
                                { key: 'locked', label: 'Any Lock' },
                                { key: 'empty_inventory', label: 'Empty Inventory' },
                                { key: 'high_value', label: 'High Value' }
                            ].map((chip) => (
                                <button
                                    key={chip.key}
                                    type="button"
                                    onClick={() => setUsersQuickFilter(chip.key as typeof usersQuickFilter)}
                                    className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${usersQuickFilter === chip.key ? 'bg-blue-500/20 text-blue-300 border border-blue-400/40' : 'bg-[#0b0e14] text-gray-400 border border-gray-700 hover:text-gray-200'}`}
                                >
                                    {chip.label}
                                </button>
                            ))}
                            <span className="ml-auto rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300">Live • synced</span>
                        </div>
                    </div>

                    {selectedSignupIp && (
                        <section aria-label={`Accounts created from ${selectedSignupIp}`} className="rounded-2xl border border-red-500/30 bg-red-500/5 p-4 sm:p-5">
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <div className="text-xs font-bold uppercase tracking-wide text-red-300">Flagged signup IP</div>
                                    <h3 className="mt-1 break-all font-mono text-base font-semibold text-white">{selectedSignupIp}</h3>
                                    <p className="mt-1 text-xs text-gray-400">{selectedIpAccounts.length} accounts were created from this address.</p>
                                </div>
                                <button type="button" onClick={() => setSelectedSignupIp(null)} className="shrink-0 rounded-lg border border-gray-700 p-2 text-gray-400 hover:text-white" aria-label="Close signup IP account list"><X className="h-4 w-4" /></button>
                            </div>
                            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
                                {selectedIpAccounts.map((profile) => (
                                    <button key={profile.id} type="button" onClick={() => setSelectedUserId(profile.id)} className="min-w-0 rounded-xl border border-gray-800 bg-[#0b0e14] p-3 text-left hover:border-red-500/40">
                                        <div className="truncate text-sm font-semibold text-white">{profile.displayName || profile.name}</div>
                                        <div className="truncate text-xs text-gray-400">{profile.email || 'No email'}</div>
                                        <div className="mt-1 truncate font-mono text-[10px] text-gray-600">{profile.id}</div>
                                    </button>
                                ))}
                            </div>
                        </section>
                    )}

                    <div className="overflow-hidden rounded-2xl border border-gray-800 bg-[#131720]">
                        <div className="max-h-[420px] overflow-auto">
                            <table className="hidden min-w-[1400px] w-full text-left text-xs md:table">
                                <thead className="sticky top-0 z-10 border-b border-gray-800 bg-[#0b0e14] text-gray-400">
                                    <tr>
                                        {[
                                            ['User', 'user'], ['Email', 'user'], ['UID', 'user'], ['Signup IP', 'user'], ['Created', 'created'], ['Last Active', 'lastActive'], ['Status', 'status'], ['Coins', 'coins'], ['Inventory Value', 'inventoryValue'], ['Lifetime Deposits', 'lifetimeDeposits'], ['Lifetime Spent', 'lifetimeSpent'], ['Pending Shipments', 'pendingShipments'], ['Risk Score', 'risk'], ['Internal Labels', 'user'], ['Actions', 'user']
                                        ].map(([label, key]) => (
                                            <th key={label} className="px-3 py-3 font-semibold">
                                                <button type="button" onClick={() => toggleUsersSort(key as typeof usersSort.key)} className="inline-flex items-center gap-1 text-left hover:text-white">
                                                    {label}
                                                    {usersSort.key === key && <span>{usersSort.direction === 'desc' ? '↓' : '↑'}</span>}
                                                </button>
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-800">
                                    {filteredUsers.length === 0 ? (
                                        <tr>
                                            <td colSpan={15} className="px-6 py-10 text-center text-gray-500">{users.length === 0 ? 'No users found in Firebase.' : 'No users match your search or filters.'}</td>
                                        </tr>
                                    ) : (
                                        filteredUsers.map((profile) => {
                                            const metrics = getUserMetrics(profile);
                                            const status = userStatuses[profile.id] ?? 'active';
                                            const labels = getUserLabels(profile);
                                            const locked = Object.values(userLocks[profile.id] ?? DEFAULT_LOCKS).some(Boolean);
                                            const isSelected = selectedUserId === profile.id;
                                            return (
                                                <tr
                                                    key={profile.id}
                                                    onClick={() => setSelectedUserId(isRealSelectedUserId(profile.id) ? profile.id : null)}
                                                    className={`cursor-pointer transition-colors hover:bg-[#182033] ${isSelected ? 'bg-blue-500/10' : ''}`}
                                                >
                                                    <td className="px-3 py-3">
                                                        <div className="flex items-center gap-2">
                                                            <img src={profile.avatar} alt={profile.name} className="h-8 w-8 rounded-full" />
                                                            <div>
                                                                <div className="font-semibold text-white">{profile.displayName || profile.name}</div>
                                                                <div className="text-[11px] text-gray-500">@{profile.username || 'unknown'}</div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-3 py-3 text-gray-300">{profile.email || '—'}</td>
                                                    <td className="px-3 py-3 text-gray-500">{profile.id.slice(0, 10)}...</td>
                                                    <td className="px-3 py-3">
                                                        {profile.signupIp ? (() => {
                                                            const accountCount = signupIpAccounts.get(profile.signupIp)?.length ?? 0;
                                                            return <button type="button" onClick={(event) => { event.stopPropagation(); setSelectedSignupIp(profile.signupIp!); }} className={`rounded px-2 py-1 font-mono text-[11px] ${accountCount > 1 ? 'border border-red-500/40 bg-red-500/10 text-red-300' : 'text-gray-400 hover:bg-white/5'}`}>{profile.signupIp}{accountCount > 1 ? ` • ${accountCount}` : ''}</button>;
                                                        })() : <span className="text-gray-600">—</span>}
                                                    </td>
                                                    <td className="px-3 py-3 text-gray-300">{profile.createdAt ? new Date(profile.createdAt).toLocaleDateString() : '—'}</td>
                                                    <td className="px-3 py-3 text-gray-300">{new Date(metrics.lastActive).toLocaleDateString()}</td>
                                                    <td className="px-3 py-3"><span className={`rounded-full px-2 py-1 font-bold ${status === 'active' ? 'bg-emerald-500/10 text-emerald-300' : status === 'suspended' ? 'bg-yellow-500/10 text-yellow-300' : 'bg-red-500/10 text-red-300'}`}>{status}</span></td>
                                                    <td className="px-3 py-3 text-gray-200">{Math.round(profile.balance ?? 0).toLocaleString()}</td>
                                                    <td className="px-3 py-3 text-gray-300">{Math.round(metrics.inventoryValue).toLocaleString()}</td>
                                                    <td className="px-3 py-3 text-gray-300">{Math.round(metrics.lifetimeDeposits).toLocaleString()}</td>
                                                    <td className="px-3 py-3 text-gray-300">{Math.round(metrics.lifetimeSpent).toLocaleString()}</td>
                                                    <td className="px-3 py-3 text-gray-300">{metrics.pendingShipmentCount}</td>
                                                    <td className="px-3 py-3"><span className={`rounded-full px-2 py-1 font-bold ${metrics.riskLevel === 'High' ? 'bg-red-500/10 text-red-300' : metrics.riskLevel === 'Medium' ? 'bg-yellow-500/10 text-yellow-300' : 'bg-emerald-500/10 text-emerald-300'}`}>{metrics.riskScore}</span></td>
                                                    <td className="px-3 py-3">
                                                        <div className="flex flex-wrap gap-1">{labels.length ? labels.slice(0, 2).map((label) => <span key={label} className="rounded-full bg-blue-500/15 px-2 py-1 text-[10px] text-blue-300">{label}</span>) : <span className="text-gray-500">—</span>}</div>
                                                    </td>
                                                    <td className="px-3 py-3">
                                                        <div className="flex items-center gap-2 text-[11px]">
                                                            {locked && <span className="rounded bg-red-500/10 px-1.5 py-0.5 text-red-300">Locked</span>}
                                                            <button type="button" className="text-blue-300" onClick={(event) => { event.stopPropagation(); setSelectedUserId(isRealSelectedUserId(profile.id) ? profile.id : null); }}>Inspect</button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                            <div className="space-y-3 p-3 md:hidden">
                                {filteredUsers.map((profile) => {
                                    const metrics = getUserMetrics(profile);
                                    return (
                                        <button type="button" key={profile.id} onClick={() => setSelectedUserId(isRealSelectedUserId(profile.id) ? profile.id : null)} className={`w-full rounded-xl border p-3 text-left ${selectedUserId === profile.id ? 'border-blue-500/50 bg-blue-500/10' : 'border-gray-800 bg-[#0b0e14]'}`}>
                                            <div className="flex items-center justify-between gap-3">
                                                <div>
                                                    <div className="text-sm font-semibold text-white">{profile.name}</div>
                                                    <div className="text-xs text-gray-500">{profile.email || profile.id}</div>
                                                </div>
                                                <span className="rounded-full bg-[#131720] px-2 py-1 text-xs text-gray-300">Risk {metrics.riskScore}</span>
                                            </div>
                                            {profile.signupIp && (signupIpAccounts.get(profile.signupIp)?.length ?? 0) > 1 && <span role="button" tabIndex={0} onClick={(event) => { event.stopPropagation(); setSelectedSignupIp(profile.signupIp!); }} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.stopPropagation(); setSelectedSignupIp(profile.signupIp!); } }} className="mt-3 inline-flex max-w-full rounded-lg border border-red-500/40 bg-red-500/10 px-2 py-1 font-mono text-[11px] text-red-300">{profile.signupIp} • {signupIpAccounts.get(profile.signupIp)?.length} accounts</span>}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {selectedUser && isRealSelectedUserId(selectedUserId) ? (
                        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
                            <div className="space-y-6">
                                <div className="rounded-2xl border border-gray-800 bg-[#131720] p-5">
                                    <div className="mb-4 flex items-center justify-between">
                                        <h3 className="text-sm font-bold uppercase tracking-wide text-gray-300">Unified Timeline</h3>
                                        <span className="text-xs text-gray-500">{filteredTimelineEntries.length} events</span>
                                    </div>
                                    <div className="mb-4 flex flex-col gap-2 sm:flex-row">
                                        <Select value={timelineFilter} onChange={(event) => setTimelineFilter(event.target.value as typeof timelineFilter)} className="w-full sm:w-48 bg-[#0b0e14] border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200">
                                            <option value="all">All types</option><option value="ledger">Ledger</option><option value="inventory">Inventory</option><option value="admin">Admin</option><option value="shipment">Shipment</option><option value="support">Support</option>
                                        </Select>
                                        <Input type="text" value={timelineSearch} onChange={(event) => setTimelineSearch(event.target.value)} placeholder="Search timeline" className="w-full bg-[#0b0e14] border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200" />
                                    </div>
                                    <div className="space-y-3">
                                        {filteredTimelineEntries.length === 0 ? <div className="rounded-lg border border-gray-800 bg-[#0b0e14] p-3 text-sm text-gray-500">No timeline events available.</div> : filteredTimelineEntries.slice(0, 30).map((entry) => (
                                            <div key={entry.id} className="rounded-lg border border-gray-800 bg-[#0b0e14] p-3">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <span className="rounded-full bg-[#131720] px-2 py-1 text-[10px] font-semibold uppercase text-gray-300">{entry.category}</span>
                                                    <span className="text-[11px] text-gray-500">{formatTimestamp(entry.createdAt)}</span>
                                                </div>
                                                <div className="mt-1 text-sm font-semibold text-gray-100">{entry.title}</div>
                                                <div className="text-xs text-gray-400">{entry.description}</div>
                                                {entry.meta && <div className="text-[11px] text-gray-500">{entry.meta}</div>}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-6 xl:sticky xl:top-24 xl:self-start">
                                {(() => {
                                    const metrics = getUserMetrics(selectedUser);
                                    const labels = getUserLabels(selectedUser);
                                    const status = userStatuses[selectedUser.id] ?? 'active';
                                    const editableXp = editingUserId === selectedUser.id;
                                    return (
                                        <>
                                            <div className="rounded-2xl border border-gray-800 bg-[#131720] p-5">
                                                <div className="flex items-start gap-3">
                                                    <img src={selectedUser.avatar} alt={selectedUser.name} className="h-12 w-12 rounded-full" />
                                                    <div className="min-w-0 flex-1">
                                                        <div className="text-lg font-bold text-white">{selectedUser.displayName || selectedUser.name}</div>
                                                        <div className="text-xs text-gray-400">@{selectedUser.username || 'unknown'} • {selectedUser.email || 'No email'}</div>
                                                        <div className="mt-2 text-xs text-gray-500">UID: {selectedUser.id}</div>
                                                        <div className="text-xs text-gray-500">Created: {selectedUser.createdAt ? new Date(selectedUser.createdAt).toLocaleString() : 'Unknown'} • Last active: {new Date(metrics.lastActive).toLocaleString()}</div>
                                                        <div className="text-xs text-gray-500">Provider: {selectedUser.provider || 'Unknown'}</div>
                                                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                                                            <span>Phone: <span className="break-all font-mono text-gray-300">{selectedUser.phoneNumber || 'Not provided'}</span></span>
                                                            {selectedUser.phoneNumber && <span className="inline-flex rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 font-bold text-emerald-300">Verified</span>}
                                                        </div>
                                                        <div className="mt-2 text-xs text-gray-500">Signup IP: {selectedUser.signupIp ? <button type="button" onClick={() => setSelectedSignupIp(selectedUser.signupIp!)} className={`break-all font-mono ${(signupIpAccounts.get(selectedUser.signupIp)?.length ?? 0) > 1 ? 'text-red-300 underline decoration-dotted underline-offset-2' : 'text-gray-300'}`}>{selectedUser.signupIp}{(signupIpAccounts.get(selectedUser.signupIp)?.length ?? 0) > 1 ? ` (${signupIpAccounts.get(selectedUser.signupIp)?.length} accounts)` : ''}</button> : 'Not recorded'}</div>
                                                        <div className="mt-1 break-all text-xs text-gray-500">Device ID: <span className="font-mono text-gray-300">{selectedUser.deviceId || 'Not recorded'}</span>{selectedUser.deviceAccountNumber ? ` • account ${selectedUser.deviceAccountNumber}` : ''}</div>
                                                        <div className="mt-2 flex flex-wrap gap-2">
                                                            <span className={`rounded-full px-2 py-1 text-xs font-bold ${status === 'active' ? 'bg-emerald-500/10 text-emerald-300' : status === 'suspended' ? 'bg-yellow-500/10 text-yellow-300' : 'bg-red-500/10 text-red-300'}`}>{status}</span>
                                                            {selectedUser.autoBanReason && <span className="rounded-full border border-red-500/30 bg-red-500/10 px-2 py-1 text-xs font-bold text-red-300">Auto-banned • {selectedUser.autoBanReason.replaceAll('_', ' ')}</span>}
                                                            <span className={`rounded-full px-2 py-1 text-xs font-bold ${(selectedUser.fraudScore ?? 0) >= 8 ? 'bg-red-500/10 text-red-300' : (selectedUser.fraudScore ?? 0) >= 4 ? 'bg-yellow-500/10 text-yellow-300' : 'bg-emerald-500/10 text-emerald-300'}`}>Fraud {selectedUser.fraudScore ?? 0}/10</span>
                                                            <span className={`rounded-full px-2 py-1 text-xs font-bold ${metrics.riskLevel === 'High' ? 'bg-red-500/10 text-red-300' : metrics.riskLevel === 'Medium' ? 'bg-yellow-500/10 text-yellow-300' : 'bg-emerald-500/10 text-emerald-300'}`}>Risk {metrics.riskScore}</span>
                                                            {labels.map((label) => <span key={label} className="rounded-full bg-blue-500/15 px-2 py-1 text-xs text-blue-300">{label}</span>)}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-2">
                                                {[
                                                    ['Current Balance', `${Math.round(selectedUser.balance ?? 0).toLocaleString()} coins`],
                                                    ['Lifetime Deposits', Math.round(metrics.lifetimeDeposits).toLocaleString()],
                                                    ['Lifetime Spent', Math.round(metrics.lifetimeSpent).toLocaleString()],
                                                    ['Lifetime Sellback', Math.round(metrics.lifetimeSellback).toLocaleString()],
                                                    ['Inventory Count', metrics.inventory.length.toString()],
                                                    ['Inventory Value', Math.round(metrics.inventoryValue).toLocaleString()],
                                                    ['Pending Shipments', metrics.pendingShipmentCount.toString()],
                                                    ['Support Tickets', metrics.supportTicketCount.toString()],
                                                    ['Biggest Win', Math.round(metrics.biggestWin).toLocaleString()],
                                                    ['Last Box Opened', selectedLedgerEntries.find((entry) => entry.type === 'case_open')?.sourceId ?? '—']
                                                ].map(([label, value]) => (
                                                    <div key={label} className="rounded-xl border border-gray-800 bg-[#131720] p-3">
                                                        <div className="text-[10px] uppercase text-gray-500">{label}</div>
                                                        <div className="mt-1 text-sm font-semibold text-gray-100">{value}</div>
                                                    </div>
                                                ))}
                                            </div>

                                            <div className="rounded-2xl border border-gray-800 bg-[#131720] p-5 space-y-4">
                                                <h4 className="text-xs font-bold uppercase tracking-wide text-gray-300">Account Controls</h4>
                                                <div className="rounded-xl border border-gray-700 bg-[#0b0e14] p-3">
                                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                                        <label htmlFor="admin-phone-verification" className="text-xs font-bold text-white">Manual phone verification</label>
                                                        {selectedUser.phoneNumber && <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[10px] font-bold uppercase text-emerald-300">Verified</span>}
                                                    </div>
                                                    <p className="mt-1 text-xs leading-5 text-gray-400">Use only after independently confirming ownership. Include the country code, for example +1 555 123 4567.</p>
                                                    <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                                                        <Input
                                                            id="admin-phone-verification"
                                                            type="tel"
                                                            inputMode="tel"
                                                            autoComplete="off"
                                                            value={phoneVerificationDraft}
                                                            onChange={(event) => { setPhoneVerificationDraft(event.target.value); setPhoneVerificationState({ saving: false }); }}
                                                            placeholder="+1 555 123 4567"
                                                            className="min-h-11 w-full min-w-0 bg-[#131720] border border-gray-700 rounded-lg px-3 py-2 text-base text-gray-200 sm:text-sm"
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={() => { void handleAdminPhoneVerification(); }}
                                                            disabled={phoneVerificationState.saving || !phoneVerificationDraft.trim() || phoneVerificationDraft.trim() === (selectedUser.phoneNumber ?? '')}
                                                            className="min-h-11 w-full shrink-0 rounded-lg bg-emerald-600 px-4 text-xs font-bold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                                                        >
                                                            {phoneVerificationState.saving ? 'Verifying…' : selectedUser.phoneNumber ? 'Update & verify' : 'Verify phone'}
                                                        </button>
                                                    </div>
                                                    {phoneVerificationState.error && <p role="alert" className="mt-2 text-xs leading-5 text-red-300">{phoneVerificationState.error}</p>}
                                                    {phoneVerificationState.success && <p role="status" className="mt-2 text-xs leading-5 text-emerald-300">{phoneVerificationState.success}</p>}
                                                </div>
                                                <Select value={status} onChange={(event) => handleStatusChange(selectedUser.id, event.target.value as UserStatus)} className="w-full bg-[#0b0e14] border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200"><option value="active">Active</option><option value="suspended">Suspended</option><option value="banned">Banned</option></Select>
                                                <label className="flex flex-col gap-3 rounded-xl border border-gray-700 bg-[#0b0e14] p-3 text-sm text-gray-200 sm:flex-row sm:items-start">
                                                    <Checkbox
                                                        checked={selectedUser.hiddenFromLeaderboard === true || selectedUser.hiddenFromPublicDisplay === true}
                                                        onChange={() => handlePublicVisibilityToggle(selectedUser.id)}
                                                        className="mt-0.5 h-5 w-5 shrink-0"
                                                    />
                                                    <span className="min-w-0">
                                                        <span className="block font-semibold text-white">Hide from leaderboard and public display</span>
                                                        <span className="mt-1 block text-xs leading-5 text-gray-400">Removes this account from public leaderboards and live public win displays. Use for test, staff, or privacy-sensitive accounts.</span>
                                                    </span>
                                                </label>
                                                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                                    {Object.entries(LOCK_LABELS).map(([key, label]) => {
                                                        const isLocked = userLocks[selectedUser.id]?.[key as keyof UserLocks];
                                                        return <button key={key} onClick={() => handleLockToggle(selectedUser.id, key as keyof UserLocks)} className={`rounded-lg border px-3 py-2 text-xs ${isLocked ? 'border-red-500/40 bg-red-500/10 text-red-300' : 'border-gray-700 bg-[#0b0e14] text-gray-300'}`}>{label}</button>;
                                                    })}
                                                </div>
                                                <div className="flex flex-wrap gap-2">
                                                    {editableXp ? (
                                                        <>
                                                            <Input type="number" value={userXpInput} onChange={(event) => setUserXpInput(Number(event.target.value))} className="w-36 bg-[#0b0e14] border border-gray-700 rounded px-3 py-1.5 text-white text-sm" />
                                                            <button onClick={() => saveUserProgress(selectedUser.id)} disabled={isSavingUser} className="rounded-lg bg-emerald-500/20 px-3 py-1.5 text-xs font-semibold text-emerald-300">Save XP</button>
                                                            <button onClick={cancelEditUser} className="rounded-lg bg-gray-700/40 px-3 py-1.5 text-xs font-semibold text-gray-200">Cancel</button>
                                                        </>
                                                    ) : (
                                                        <button onClick={() => startEditUser(selectedUser.id, selectedUser.xp || 0)} className="rounded-lg bg-blue-500/20 px-3 py-1.5 text-xs font-semibold text-blue-300">Edit XP</button>
                                                    )}
                                                    <button onClick={() => handleDeleteUser(selectedUser.id)} disabled={deletingUserId === selectedUser.id} className="rounded-lg bg-red-500/20 px-3 py-1.5 text-xs font-semibold text-red-300">{deletingUserId === selectedUser.id ? 'Deleting...' : 'Delete User'}</button>
                                                </div>
                                            </div>

                                            <div className="rounded-2xl border border-gray-800 bg-[#131720] p-5 space-y-4">
                                                <h4 className="text-xs font-bold uppercase tracking-wide text-gray-300">Financial Controls</h4>
                                                {!isEditingBalance ? <button onClick={startBalanceEdit} className="rounded-lg bg-emerald-500/20 px-3 py-2 text-xs font-semibold text-emerald-300">Edit Balance</button> : <div className="space-y-2"><Input type="number" value={balanceDraft} onChange={(event) => setBalanceDraft(event.target.value)} className="w-full bg-[#0b0e14] border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200" /><div className="flex gap-2"><button onClick={saveBalanceEdit} className="rounded-lg bg-emerald-500/20 px-3 py-1.5 text-xs font-semibold text-emerald-300">Save</button><button onClick={cancelBalanceEdit} className="rounded-lg bg-gray-700/40 px-3 py-1.5 text-xs font-semibold text-gray-200">Cancel</button></div></div>}
                                                <Input type="number" value={reversalAmount} onChange={(event) => setReversalAmount(event.target.value)} placeholder="Reversal amount" className="w-full bg-[#0b0e14] border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200" />
                                                <Textarea rows={2} value={reversalReason} onChange={(event) => setReversalReason(event.target.value)} placeholder="Reversal reason" className="w-full bg-[#0b0e14] border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200" />
                                                <button onClick={handleCreateReversal} disabled={!reversalAmount || !reversalReason.trim()} className="w-full rounded-lg bg-red-500/20 px-3 py-2 text-xs font-bold uppercase text-red-300 disabled:opacity-50">Create Reversal</button>
                                                <Input type="text" value={voidSourceId} onChange={(event) => setVoidSourceId(event.target.value)} placeholder="Void source ID" className="w-full bg-[#0b0e14] border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200" />
                                                <Textarea rows={2} value={voidReason} onChange={(event) => setVoidReason(event.target.value)} placeholder="Void reason" className="w-full bg-[#0b0e14] border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200" />
                                                <button onClick={handleVoidOpen} disabled={!voidSourceId.trim()} className="w-full rounded-lg bg-yellow-500/20 px-3 py-2 text-xs font-bold uppercase text-yellow-300 disabled:opacity-50">Void Open & Compensate</button>
                                            </div>

                                            <div className="rounded-2xl border border-gray-800 bg-[#131720] p-4 sm:p-5 space-y-4">
                                                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                                    <div>
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            <h4 className="text-xs font-bold uppercase tracking-wide text-gray-300">Live Shippable Inventory</h4>
                                                            <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-300">Live</span>
                                                        </div>
                                                        <p className="mt-1 text-xs text-gray-500">Available, unlocked items that are currently eligible for shipment.</p>
                                                    </div>
                                                    <button onClick={() => setIsEditingInventory((prev) => !prev)} className="w-full rounded-lg bg-blue-500/20 px-3 py-2 text-xs font-semibold text-blue-300 sm:w-auto sm:py-1.5">{isEditingInventory ? 'Done Editing Inventory' : 'Edit Inventory'}</button>
                                                </div>
                                                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                                                    <div className="rounded-xl border border-gray-800 bg-[#0b0e14] p-3">
                                                        <div className="text-[10px] uppercase text-gray-500">Shippable items</div>
                                                        <div className="mt-1 text-lg font-bold text-white">{selectedShippableInventory.length}</div>
                                                    </div>
                                                    <div className="rounded-xl border border-gray-800 bg-[#0b0e14] p-3">
                                                        <div className="text-[10px] uppercase text-gray-500">Shippable value</div>
                                                        <CoinAmount amount={selectedShippableInventoryValue} animated={false} className="mt-1 text-lg font-bold text-white" iconClassName="h-4 w-4" />
                                                    </div>
                                                    <div className="col-span-2 rounded-xl border border-gray-800 bg-[#0b0e14] p-3 sm:col-span-1">
                                                        <div className="text-[10px] uppercase text-gray-500">Total inventory</div>
                                                        <div className="mt-1 text-lg font-bold text-white">{selectedInventory.length}</div>
                                                    </div>
                                                </div>
                                                {isEditingInventory && (
                                                    <div className="grid grid-cols-1 gap-2">
                                                        <Input type="text" value={inventoryDraft.name} onChange={(event) => setInventoryDraft((prev) => ({ ...prev, name: event.target.value }))} placeholder="Item name" className="w-full bg-[#0b0e14] border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200" />
                                                        <Input type="number" min={0} value={inventoryDraft.price} onChange={(event) => setInventoryDraft((prev) => ({ ...prev, price: event.target.value }))} placeholder="Value" className="w-full bg-[#0b0e14] border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200" />
                                                        <Input type="text" value={inventoryDraft.image} onChange={(event) => setInventoryDraft((prev) => ({ ...prev, image: event.target.value }))} placeholder="Image URL" className="w-full bg-[#0b0e14] border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200" />
                                                        {inventorySaveError && (
                                                            <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                                                                {inventorySaveError}
                                                            </div>
                                                        )}
                                                        <button type="button" onClick={handleAddInventoryItem} className="w-full rounded-lg bg-blue-500/20 px-3 py-2 text-xs font-semibold text-blue-300 sm:w-auto">Add Inventory Item</button>
                                                    </div>
                                                )}
                                                <div className="max-h-72 space-y-2 overflow-auto pr-1">
                                                    {selectedShippableInventory.map((item) => (
                                                        <div key={item.instanceId} className="rounded-lg border border-gray-800 bg-[#0b0e14] p-2">
                                                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                                                <div className="flex min-w-0 items-center gap-3">
                                                                    <img src={item.image} alt={item.name} className="h-10 w-10 flex-none rounded-lg object-cover" />
                                                                    <div className="min-w-0">
                                                                        <div className="truncate text-xs font-semibold text-gray-100">{item.name}</div>
                                                                        <div className="text-[10px] text-gray-500">{item.provenance ? `${item.provenance.sourceType}:${item.provenance.sourceId}` : 'unknown provenance'}</div>
                                                                    </div>
                                                                </div>
                                                                <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                                                                    <CoinAmount amount={toCoins(item.price, PRICE_UNIT_MODE)} animated={false} className="text-xs font-bold text-emerald-300" iconClassName="h-3.5 w-3.5" />
                                                                    {item.freeShipping && <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">Free ship</span>}
                                                                    {item.size && <span className="rounded-full bg-gray-800 px-2 py-0.5 text-[10px] text-gray-300">{item.size}</span>}
                                                                </div>
                                                            </div>
                                                            <div className="mt-2 flex flex-wrap gap-2"><button onClick={() => handleInventoryLockToggle(selectedUser.id, item.instanceId)} className="rounded bg-red-500/20 px-2 py-1 text-[10px] font-semibold text-red-300">Lock</button>{isEditingInventory && <button onClick={() => handleRemoveInventoryItem(selectedUser.id, item.instanceId)} className="rounded bg-red-600/20 px-2 py-1 text-[10px] font-semibold text-red-300">Remove</button>}</div>
                                                        </div>
                                                    ))}
                                                    {selectedShippableInventory.length === 0 && <div className="rounded-lg border border-dashed border-gray-800 bg-[#0b0e14] p-4 text-xs text-gray-500">No live shippable inventory for this user.</div>}
                                                </div>
                                                {selectedInventory.length > selectedShippableInventory.length && <div className="text-[11px] text-gray-500">Hidden from this list: sold, shipping, shipped, locked, or non-shippable items.</div>}
                                                {isEditingInventory && (
                                                    <div className="rounded-xl border border-gray-800 bg-[#0b0e14] p-3">
                                                        <div className="mb-2 text-[10px] font-bold uppercase tracking-wide text-gray-500">All inventory controls</div>
                                                        <div className="max-h-48 space-y-2 overflow-auto pr-1">
                                                            {selectedInventory.map((item) => (
                                                                <div key={`all-${item.instanceId}`} className="rounded-lg border border-gray-800 bg-[#131720] p-2">
                                                                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between"><span className="text-xs text-gray-200">{item.name}</span><span className="text-[10px] text-gray-500">{item.status}{item.locked ? ' • locked' : ''}{item.shippable === false ? ' • non-shippable' : ''}</span></div>
                                                                    <div className="mt-2 flex flex-wrap gap-2"><button onClick={() => handleInventoryLockToggle(selectedUser.id, item.instanceId)} className="rounded bg-red-500/20 px-2 py-1 text-[10px] font-semibold text-red-300">{item.locked ? 'Unlock' : 'Lock'}</button><button onClick={() => handleRemoveInventoryItem(selectedUser.id, item.instanceId)} className="rounded bg-red-600/20 px-2 py-1 text-[10px] font-semibold text-red-300">Remove</button></div>
                                                                </div>
                                                            ))}
                                                            {selectedInventory.length === 0 && <div className="text-xs text-gray-500">No inventory items.</div>}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            <div className="rounded-2xl border border-gray-800 bg-[#131720] p-5 space-y-4">
                                                <h4 className="text-xs font-bold uppercase tracking-wide text-gray-300">Shipment Controls</h4>
                                                <div className="text-xs text-gray-400">Pending shipments: <span className="font-semibold text-gray-200">{metrics.pendingShipmentCount}</span></div>
                                            </div>

                                            <div className="rounded-2xl border border-gray-800 bg-[#131720] p-5 space-y-4">
                                                <h4 className="text-xs font-bold uppercase tracking-wide text-gray-300">Communication</h4>
                                                <div>
                                                    <div className="mb-2 text-[11px] uppercase text-gray-500">Internal Labels</div>
                                                    <div className="flex flex-wrap gap-2">
                                                        {['VIP', 'Fraud Watch', 'Big Depositor', 'Chargeback Risk', 'Support Sensitive', 'Needs Review'].map((label) => (
                                                            <button key={label} onClick={() => toggleInternalLabel(selectedUser.id, label)} className={`rounded-full px-2 py-1 text-[10px] font-semibold ${labels.includes(label) ? 'bg-blue-500/30 text-blue-200' : 'bg-[#0b0e14] text-gray-400 border border-gray-700'}`}>{label}</button>
                                                        ))}
                                                    </div>
                                                </div>
                                                <div>
                                                    <div className="mb-2 text-[11px] uppercase text-gray-500">Admin Notes</div>
                                                    <Textarea rows={4} value={userAdminNotes[selectedUser.id] ?? ''} onChange={(event) => setUserAdminNotes((prev) => ({ ...prev, [selectedUser.id]: event.target.value }))} placeholder="Private operator notes only (not user-facing)." className="w-full bg-[#0b0e14] border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200" />
                                                    <div className="mt-2 flex gap-2"><button onClick={() => saveAdminNote(selectedUser.id)} className="rounded-lg bg-blue-500/20 px-3 py-1.5 text-xs font-semibold text-blue-200">Save Notes</button><button disabled className="rounded-lg bg-gray-700/40 px-3 py-1.5 text-xs font-semibold text-gray-400">Send Admin Notice (TODO)</button></div>
                                                </div>
                                            </div>

                                            <div className="rounded-2xl border border-gray-800 bg-[#131720] p-5 space-y-3">
                                                <h4 className="text-xs font-bold uppercase tracking-wide text-gray-300">Risk & Compliance</h4>
                                                <div className="rounded-lg border border-gray-700 bg-[#0b0e14] p-3">
                                                    <div className="text-xs text-gray-400">Calculated Risk Score</div>
                                                    <div className={`mt-1 inline-flex rounded-full px-2 py-1 text-xs font-bold ${metrics.riskLevel === 'High' ? 'bg-red-500/10 text-red-300' : metrics.riskLevel === 'Medium' ? 'bg-yellow-500/10 text-yellow-300' : 'bg-emerald-500/10 text-emerald-300'}`}>{metrics.riskScore} • {metrics.riskLevel}</div>
                                                </div>
                                                <div className="grid grid-cols-1 gap-2 text-xs text-gray-300">
                                                    <div className="rounded-lg border border-gray-800 bg-[#0b0e14] p-2">Chargeback count: {metrics.chargebackCount}</div>
                                                    <div className="rounded-lg border border-gray-800 bg-[#0b0e14] p-2">Failed payment count: {metrics.failedPaymentCount}</div>
                                                    <div className="rounded-lg border border-gray-800 bg-[#0b0e14] p-2">Rapid sellback behavior: {metrics.hasRapidSellback ? 'Flagged' : 'None'}</div>
                                                    <div className="rounded-lg border border-gray-800 bg-[#0b0e14] p-2">New account high-value activity: {metrics.isNewHighValue ? 'Flagged' : 'No'}</div>
                                                    <div className="rounded-lg border border-gray-800 bg-[#0b0e14] p-2">Repeated shipment requests: {metrics.pendingShipmentCount > 2 ? 'Flagged' : 'Normal'}</div>
                                                    <div className="rounded-lg border border-gray-800 bg-[#0b0e14] p-2">Excessive admin adjustments: {metrics.excessiveAdminAdjustments}</div>
                                                    <div className="rounded-lg border border-gray-800 bg-[#0b0e14] p-2">Suspicious activity flags: {metrics.suspiciousFlags}</div>
                                                </div>
                                            </div>

                                            <div className="rounded-2xl border border-gray-800 bg-[#131720] p-5 space-y-3">
                                                <h4 className="text-xs font-bold uppercase tracking-wide text-gray-300">Immutable Ledger</h4>
                                                <div className="flex gap-2"><Select value={ledgerFilter} onChange={(event) => setLedgerFilter(event.target.value as 'all' | LedgerEntryType)} className="w-40 bg-[#0b0e14] border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200"><option value="all">All</option><option value="deposit">Deposit</option><option value="case_open">Box open</option><option value="sell_back">Sell back</option><option value="bonus">Bonus</option><option value="admin_adjustment">Admin adjustment</option><option value="chargeback_reversal">Chargeback reversal</option><option value="reversal">Reversal</option></Select><Input type="text" value={ledgerSearch} onChange={(event) => setLedgerSearch(event.target.value)} placeholder="Search" className="w-full bg-[#0b0e14] border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200" /></div>
                                                <div className="max-h-60 space-y-2 overflow-auto pr-1">{filteredLedgerEntries.length === 0 ? <div className="text-xs text-gray-500">No ledger entries.</div> : filteredLedgerEntries.map((entry) => (<div key={entry.id} className="rounded-lg border border-gray-800 bg-[#0b0e14] p-2"><div className="flex items-center justify-between gap-2"><span className="text-xs uppercase text-gray-400">{entry.type.replace('_', ' ')}</span><CoinAmount amount={entry.amount} formatOptions={{ maximumFractionDigits: 0 }} showSign className={`text-xs font-bold ${entry.amount >= 0 ? 'text-green-400' : 'text-red-400'}`} iconClassName="w-3.5 h-3.5" /></div><div className="text-xs text-gray-300">{entry.memo || 'Balance update'}</div><div className="text-[10px] text-gray-500">{entry.sourceId || 'Manual'} • {formatTimestamp(entry.createdAt)}</div></div>))}</div>
                                            </div>

                                            <div className="rounded-2xl border border-gray-800 bg-[#131720] p-4 sm:p-5 space-y-3">
                                                <h4 className="text-xs font-bold uppercase tracking-wide text-gray-300">Balance Audit</h4>
                                                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
                                                    <Select value={balanceAuditCurrencyFilter} onChange={(event) => setBalanceAuditCurrencyFilter(event.target.value as 'all' | 'coins' | 'xp')} className="bg-[#0b0e14] border border-gray-700 rounded-lg px-3 py-2 text-xs text-gray-200"><option value="all">All currencies</option><option value="coins">Coins</option><option value="xp">XP</option></Select>
                                                    <Select value={balanceAuditDirectionFilter} onChange={(event) => setBalanceAuditDirectionFilter(event.target.value as 'all' | 'positive' | 'negative')} className="bg-[#0b0e14] border border-gray-700 rounded-lg px-3 py-2 text-xs text-gray-200"><option value="all">All directions</option><option value="positive">Positive</option><option value="negative">Negative</option></Select>
                                                    <Select value={balanceAuditReasonFilter} onChange={(event) => setBalanceAuditReasonFilter(event.target.value)} className="bg-[#0b0e14] border border-gray-700 rounded-lg px-3 py-2 text-xs text-gray-200"><option value="all">All reasons</option>{balanceAuditReasons.map((reason) => <option key={reason} value={reason}>{reason}</option>)}</Select>
                                                    <Input value={balanceAuditSearch} onChange={(event) => setBalanceAuditSearch(event.target.value)} placeholder="Search source / relatedId" className="bg-[#0b0e14] border border-gray-700 rounded-lg px-3 py-2 text-xs text-gray-200" />
                                                </div>
                                                <div className="max-h-72 space-y-2 overflow-auto pr-1">
                                                    {selectedBalanceAudits.length === 0 ? <div className="text-xs text-gray-500">No balance audit entries.</div> : selectedBalanceAudits.map((entry) => {
                                                        const delta = (entry.balanceAfter ?? 0) - (entry.balanceBefore ?? 0);
                                                        const hasWarning = (entry.balanceAfter ?? 0) < 0
                                                            || entry.balanceBefore == null
                                                            || delta !== entry.amount
                                                            || !entry.source
                                                            || !entry.actorType;
                                                        const expandedKey = `${selectedUser.id}_${entry.id}`;
                                                        return (
                                                            <div key={entry.id} className="rounded-lg border border-gray-800 bg-[#0b0e14] p-2">
                                                                <div className="flex flex-wrap items-center justify-between gap-2">
                                                                    <div className="text-[10px] text-gray-500">{entry.createdAt ? formatTimestamp(entry.createdAt.toMillis()) : '—'} • {entry.currency.toUpperCase()} • {entry.reason}</div>
                                                                    <div className="flex items-center gap-2">
                                                                        <span className={`text-xs font-bold ${entry.amount >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>{entry.amount >= 0 ? '+' : ''}{entry.amount.toLocaleString()}</span>
                                                                        {hasWarning && <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-300">⚠ warning</span>}
                                                                    </div>
                                                                </div>
                                                                <div className="mt-1 text-[11px] text-gray-300 break-all">{entry.balanceBefore ?? '—'} → {entry.balanceAfter ?? '—'} • {entry.actorType ?? 'missing-actor'} • {entry.actorUid ?? 'null'} • {entry.source || 'missing-source'} • {entry.relatedId ?? 'null'}</div>
                                                                <button onClick={() => setExpandedAuditRows((prev) => ({ ...prev, [expandedKey]: !prev[expandedKey] }))} className="mt-2 rounded bg-gray-700/40 px-2 py-1 text-[10px] text-gray-300">{expandedAuditRows[expandedKey] ? 'Hide metadata' : 'Show metadata'}</button>
                                                                {expandedAuditRows[expandedKey] && (
                                                                    <pre className="mt-2 overflow-x-auto rounded-lg border border-gray-800 bg-[#131720] p-2 text-[10px] text-gray-300">{JSON.stringify(entry.metadata ?? {}, null, 2)}</pre>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>

                                            <div className="rounded-2xl border border-gray-800 bg-[#131720] p-5 space-y-2">
                                                <h4 className="text-xs font-bold uppercase tracking-wide text-gray-300">Admin Action Log</h4>
                                                <div className="max-h-44 space-y-2 overflow-auto pr-1">{selectedAdminLogs.length === 0 ? <div className="text-xs text-gray-500">No admin actions recorded.</div> : selectedAdminLogs.map((log) => <div key={log.id} className="rounded-lg border border-gray-800 bg-[#0b0e14] p-2"><div className="text-xs uppercase text-gray-400">{log.actionType.replace('_', ' ')}</div><div className="text-xs text-gray-200">{log.reason}</div><div className="text-[10px] text-gray-500">Admin {log.adminUid} • {formatTimestamp(log.createdAt)}</div></div>)}</div>
                                            </div>
                                        </>
                                    );
                                })()}
                            </div>
                        </div>
                    ) : (
                        <div className="rounded-2xl border border-dashed border-gray-700 bg-[#131720] p-8 text-center text-sm text-gray-500">Select a user</div>
                    )}
                </div>
            )}

            {/* TAB: SHIPMENTS */}
            {activeTab === 'shipments' && (
                <div className="space-y-6">
                    <div className="bg-[#131720] border border-gray-800 rounded-xl p-6">
                        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                            <div>
                                <h3 className="text-lg font-bold text-white">Shipping Requests</h3>
                                <p className="text-sm text-gray-400">Track items that players have requested to ship or already delivered.</p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {(['all', 'processing', 'shipped'] as const).map((filter) => (
                                    <button
                                        key={filter}
                                        onClick={() => setShipmentFilter(filter)}
                                        className={`px-4 py-2 rounded-lg text-xs font-bold uppercase transition-colors ${
                                            shipmentFilter === filter
                                                ? 'btn-logo-gradient text-white'
                                                : 'bg-[#0b0e14] text-gray-400 hover:text-white hover:bg-gray-800'
                                        }`}
                                    >
                                        {filter === 'all' ? 'All' : filter === 'processing' ? 'Processing' : 'Shipped'}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {filteredShipmentOrders.length === 0 ? (
                        <div className="bg-[#131720] border border-gray-800 rounded-xl p-8 text-center text-gray-500">
                            No shipment orders match this filter.
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                            {filteredShipmentOrders.map((order) => {
                                const firstShipment = order.shipments[0];
                                const address = firstShipment?.shippingInfo ?? order.user?.shippingAddress;
                                const canUpdate = order.shipments.some((shipment) => Boolean(shipment.id));
                                const trackingKey = order.id;
                                const trackingValue = shipmentTracking[trackingKey] ?? order.trackingNumbers.join('\n');
                                const trackingNumbers = Array.from(new Set(trackingValue.split(/[\n,]+/).map((value) => value.trim()).filter(Boolean)));
                                const displayName = order.user?.name ?? address?.fullName ?? 'Unknown user';
                                const displayEmail = order.user?.email || 'No email on file';
                                const orderStatusLabel = order.status === 'shipped'
                                    ? 'Shipped'
                                    : order.status === 'pending_payment'
                                        ? 'Pending payment'
                                        : order.status === 'cancelled'
                                            ? 'Cancelled'
                                            : 'Processing';
                                const orderStatusClass = order.status === 'shipped'
                                    ? 'bg-green-500/10 text-green-400'
                                    : order.status === 'cancelled'
                                        ? 'bg-red-500/10 text-red-300'
                                        : order.status === 'pending_payment'
                                            ? 'bg-blue-500/10 text-blue-300'
                                            : 'bg-yellow-500/10 text-yellow-400';
                                const shippingCostLabel = order.shippingPaymentMethod === 'cash'
                                    ? `$${((order.shippingBatchCostCents || order.shippingCost) / 100).toFixed(2)}`
                                    : `${Math.round(order.shippingCost || 0).toLocaleString()} coins`;

                                return (
                                    <div key={order.key} className="bg-[#131720] border border-gray-800 rounded-xl p-4 sm:p-5 flex flex-col gap-4">
                                        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                                            <div className="min-w-0">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <h4 className="text-white font-bold">Exchange order</h4>
                                                    <span className="rounded-full bg-purple-500/10 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-purple-200">
                                                        {order.itemCount} {order.itemCount === 1 ? 'item' : 'items'} bundled
                                                    </span>
                                                    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full ${orderStatusClass}`}>
                                                        {order.status === 'shipped' ? <PackageCheck className="w-3 h-3" /> : <Truck className="w-3 h-3" />}
                                                        {orderStatusLabel}
                                                    </span>
                                                </div>
                                                <div className="mt-1 text-xs text-gray-500 break-all">Order ID: {order.id}</div>
                                                <div className="mt-1 text-xs text-gray-400">Submitted {formatTimestamp(order.createdAt)}</div>
                                            </div>
                                            <div className="text-sm text-gray-300 sm:text-right">
                                                <div className="font-semibold">{displayName}</div>
                                                <div className="text-xs text-gray-500 break-all">{displayEmail}</div>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                                            <div className="rounded-lg border border-gray-800 bg-[#0b0e14] p-3">
                                                <div className="text-[10px] uppercase font-bold text-gray-500">Items</div>
                                                <div className="mt-1 text-gray-200 font-semibold">{order.itemCount}</div>
                                            </div>
                                            <div className="rounded-lg border border-gray-800 bg-[#0b0e14] p-3">
                                                <div className="text-[10px] uppercase font-bold text-gray-500">Order value</div>
                                                <CoinAmount
                                                  amount={toCoins(order.totalValue, PRICE_UNIT_MODE)}
                                                  formatOptions={{ maximumFractionDigits: 0 }}
                                                  className="mt-1 text-green-400 font-semibold"
                                                  iconClassName="w-3 h-3"
                                                />
                                            </div>
                                            <div className="rounded-lg border border-gray-800 bg-[#0b0e14] p-3">
                                                <div className="text-[10px] uppercase font-bold text-gray-500">Shipping</div>
                                                <div className="mt-1 text-gray-200 font-semibold">{shippingCostLabel}</div>
                                                {order.shippingRateTier && <div className="text-[10px] text-gray-500">{order.shippingRateTier}</div>}
                                            </div>
                                        </div>

                                        <div className="rounded-lg border border-gray-800 bg-[#0b0e14] p-3">
                                            <div className="mb-3 flex items-center justify-between gap-2">
                                                <div className="text-[10px] uppercase font-bold text-gray-500">Bundled items as submitted</div>
                                                <div className="text-[10px] text-gray-500">{order.itemCount} total</div>
                                            </div>
                                            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                                                {order.shipments.map((shipment) => {
                                                    const shipmentItem = shipment.item ?? ({ name: 'Mystery Item', value: 0, image: 'https://picsum.photos/200', rarity: 'common' } as Shipment['item']);
                                                    return (
                                                        <div key={shipment.id || shipment.inventoryId} className="flex gap-3 rounded-lg border border-gray-800 bg-[#131720] p-2">
                                                            <img src={shipmentItem.image} alt={shipmentItem.name} className="h-12 w-12 flex-none rounded-lg bg-[#0b0e14] object-contain" />
                                                            <div className="min-w-0 flex-1">
                                                                <div className="truncate text-sm font-bold text-white">{shipmentItem.name}</div>
                                                                <CoinAmount
                                                                  amount={toCoins(shipmentItem.value, PRICE_UNIT_MODE)}
                                                                  formatOptions={{ maximumFractionDigits: 0 }}
                                                                  className="text-xs text-green-400 font-semibold"
                                                                  iconClassName="w-3 h-3"
                                                                />
                                                                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-gray-500">
                                                                    <span className="break-all">Instance: {shipment.inventoryId || 'Unavailable'}</span>
                                                                    {shipmentItem.size && <span className="text-blue-200">Size: {shipmentItem.size}</span>}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                            <div className="bg-[#0b0e14] border border-gray-800 rounded-lg p-3 text-xs text-gray-400 space-y-1">
                                                <div className="text-[10px] uppercase font-bold text-gray-500">Shipping Address</div>
                                                {address ? (
                                                    <>
                                                        <div className="text-gray-200 font-semibold">{address.fullName}</div>
                                                        <div>{address.street1 ?? address.street}</div>
                                                        <div>{address.city}{address.state ? `, ${address.state}` : ''} {address.postalCode ?? address.zipCode}</div>
                                                        <div>{address.countryCode ?? address.country}</div>
                                                    </>
                                                ) : (
                                                    <div className="text-yellow-400">No address saved.</div>
                                                )}
                                            </div>
                                            <div className="bg-[#0b0e14] border border-gray-800 rounded-lg p-3 text-xs text-gray-400 flex flex-col gap-3">
                                                <div className="text-[10px] uppercase font-bold text-gray-500">Order Actions</div>
                                                <label className="text-[10px] uppercase font-bold text-gray-500">Tracking numbers for all bundled items</label>
                                                <Textarea
                                                    value={trackingValue}
                                                    onChange={(event) =>
                                                        setShipmentTracking((prev) => ({
                                                            ...prev,
                                                            [trackingKey]: event.target.value
                                                        }))
                                                    }
                                                    placeholder={'Enter one tracking number per line'}
                                                    rows={Math.min(5, Math.max(2, trackingNumbers.length + 1))}
                                                    className="min-h-20 w-full resize-y bg-[#131720] border border-gray-700 rounded-lg px-3 py-2 text-base sm:text-xs text-gray-200"
                                                />
                                                <p className="text-[10px] leading-4 text-gray-500">One per line or comma-separated. {trackingNumbers.length}/20 tracking numbers.</p>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                    <button
                                                        onClick={() => {
                                                            void Promise.all(order.shipments.map((shipment) =>
                                                                updateShipmentStatus(
                                                                    shipment.id,
                                                                    shipment.uid,
                                                                    shipment.inventoryId,
                                                                    'shipped',
                                                                    trackingNumbers
                                                                )
                                                            ));
                                                        }}
                                                        disabled={order.status === 'shipped' || order.status === 'pending_payment' || !canUpdate}
                                                        className="w-full px-4 py-2 bg-green-600 hover:bg-green-500 text-white text-xs font-bold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                                                    >
                                                        Mark order shipped
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            void Promise.all(order.shipments.map((shipment) =>
                                                                cancelShipmentAsAdmin(
                                                                    shipment.id,
                                                                    shipment.uid,
                                                                    shipment.inventoryId
                                                                )
                                                            ));
                                                        }}
                                                        disabled={order.status === 'shipped' || order.status === 'cancelled' || !canUpdate}
                                                        className="w-full px-4 py-2 bg-red-600/90 hover:bg-red-500 text-white text-xs font-bold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                                                    >
                                                        Cancel & restore order
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* TAB: SUPPORT */}
            {activeTab === 'support' && (
                <div className="space-y-6">
                    <div className="bg-[#131720] border border-gray-800 rounded-xl p-6">
                        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                            <div>
                                <h3 className="text-lg font-bold text-white">Support Threads</h3>
                                <p className="text-sm text-gray-400">Review user requests, reply, and manage box status.</p>
                            </div>
                            <div className="text-xs text-gray-400">{supportCases.length} total boxes</div>
                        </div>
                    </div>

                    {supportCases.length === 0 ? (
                        <div className="bg-[#131720] border border-gray-800 rounded-xl p-8 text-center text-gray-500">
                            No support boxes found yet.
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {supportCases.map((caseItem) => {
                                const isExpanded = expandedSupportCases.has(caseItem.id);
                                const replyInfo = supportReplyStatus[caseItem.id];
                                const statusInfo = supportStatusUpdates[caseItem.id];
                                const replyValue = supportReplyDrafts[caseItem.id] ?? '';
                                return (
                                    <div key={caseItem.id} className="bg-[#131720] border border-gray-800 rounded-xl">
                                        <button
                                            type="button"
                                            onClick={() => toggleSupportCase(caseItem.id)}
                                            className="flex w-full items-start justify-between gap-4 px-4 py-4 text-left sm:px-6"
                                        >
                                            <div className="space-y-1">
                                                <p
                                                    className="text-sm font-semibold text-white"
                                                    dangerouslySetInnerHTML={{ __html: escapeText(caseItem.subject ?? '') }}
                                                />
                                                <div className="text-xs text-gray-500">
                                                    {caseItem.email || 'No email'} • Updated {formatSupportTimestamp(caseItem.lastUpdatedAt)}
                                                </div>
                                            </div>
                                            <span
                                                className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${
                                                    caseItem.status === 'Closed'
                                                        ? 'bg-gray-500/20 text-gray-300'
                                                        : 'bg-green-500/20 text-green-300'
                                                }`}
                                            >
                                                {caseItem.status || 'Open'}
                                            </span>
                                        </button>

                                        {isExpanded && (
                                            <div className="border-t border-gray-800 px-4 py-4 sm:px-6">
                                                <div className="flex flex-col gap-3 text-xs text-gray-400 sm:flex-row sm:items-center sm:justify-between">
                                                    <span>Box ID: {caseItem.id}</span>
                                                    <span>Created {formatSupportTimestamp(caseItem.createdAt)}</span>
                                                </div>
                                                <div className="mt-4 space-y-3">
                                                    {(caseItem.messages ?? []).map((messageItem, index) => (
                                                        <div
                                                            key={`${caseItem.id}-${index}`}
                                                            className={`rounded-lg border border-gray-800 px-3 py-2 text-xs sm:text-sm ${
                                                                messageItem.sender === 'admin'
                                                                    ? 'bg-blue-500/10 text-blue-100'
                                                                    : 'bg-[#0b0e14] text-gray-200'
                                                            }`}
                                                        >
                                                            <div className="flex items-center justify-between gap-3 text-[11px] text-gray-400">
                                                                <span className="uppercase">{messageItem.sender === 'admin' ? 'Admin' : 'User'}</span>
                                                                <span>{formatSupportTimestamp(messageItem.timestamp)}</span>
                                                            </div>
                                                            <p
                                                                className="mt-2"
                                                                dangerouslySetInnerHTML={{ __html: toSafeHtml(messageItem.text ?? '') }}
                                                            />
                                                        </div>
                                                    ))}
                                                </div>

                                                <div className="mt-4 grid gap-4 lg:grid-cols-[1.5fr_1fr]">
                                                    <div className="space-y-2">
                                                        <label className="text-[10px] uppercase font-bold text-gray-500">Reply</label>
                                                        <Textarea
                                                            value={replyValue}
                                                            onChange={(event) => handleSupportReplyChange(caseItem.id, event.target.value)}
                                                            placeholder="Write a response to the user..."
                                                            className="w-full bg-[#0b0e14] border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 min-h-[120px]"
                                                            disabled={replyInfo?.sending}
                                                        />
                                                        {replyInfo?.error && <p className="text-xs text-red-400">{replyInfo.error}</p>}
                                                        {replyInfo?.success && <p className="text-xs text-green-400">{replyInfo.success}</p>}
                                                        <button
                                                            type="button"
                                                            onClick={() => handleSupportReplySubmit(caseItem)}
                                                            disabled={replyInfo?.sending}
                                                            className="w-full sm:w-auto px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold disabled:opacity-60 disabled:cursor-not-allowed"
                                                        >
                                                            {replyInfo?.sending ? 'Sending...' : 'Send reply'}
                                                        </button>
                                                    </div>
                                                    <div className="space-y-2">
                                                        <label className="text-[10px] uppercase font-bold text-gray-500">Status</label>
                                                        <div className="flex flex-wrap gap-2">
                                                            <button
                                                                type="button"
                                                                onClick={() => handleSupportStatusChange(caseItem, 'Open')}
                                                                disabled={statusInfo?.sending}
                                                                className="px-3 py-2 rounded-lg text-xs font-bold uppercase bg-green-500/20 text-green-300 hover:bg-green-500/30 disabled:opacity-60 disabled:cursor-not-allowed"
                                                            >
                                                                Mark Open
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleSupportStatusChange(caseItem, 'Closed')}
                                                                disabled={statusInfo?.sending}
                                                                className="px-3 py-2 rounded-lg text-xs font-bold uppercase bg-gray-500/20 text-gray-300 hover:bg-gray-500/30 disabled:opacity-60 disabled:cursor-not-allowed"
                                                            >
                                                                Mark Closed
                                                            </button>
                                                        </div>
                                                        {statusInfo?.error && <p className="text-xs text-red-400">{statusInfo.error}</p>}
                                                        {statusInfo?.success && <p className="text-xs text-green-400">{statusInfo.success}</p>}
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* TAB: BONUSES */}
            {activeTab === 'bonuses' && (
                <div className="space-y-6">
                    <div className="bg-[#131720] border border-gray-800 rounded-xl p-4 sm:p-6">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <h3 className="text-lg font-bold text-white">Pull Pass</h3>
                                <p className="text-sm text-gray-400">
                                    Manage season timing, tier count, and XP earning. Default earning is 10 coins spent = 1 XP.
                                </p>
                            </div>
                            <div className={`w-fit rounded-full px-3 py-1 text-xs font-semibold ${pullPassDraft.enabled ? 'bg-purple-500/15 text-purple-200 border border-purple-400/30' : 'bg-gray-800 text-gray-400 border border-gray-700'}`}>
                                {pullPassDraft.enabled ? 'Live / Enabled' : 'Disabled'}
                            </div>
                        </div>

                        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                            <label className="text-sm text-gray-300 md:col-span-2 xl:col-span-1">Season name
                                <Input
                                    type="text"
                                    value={pullPassDraft.seasonName}
                                    onChange={(event) => setPullPassDraft((prev) => ({ ...prev, seasonName: event.target.value }))}
                                    className="mt-1 w-full bg-[#0b0e14] border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                                />
                            </label>
                            <label className="text-sm text-gray-300">Coins spent per 1 XP
                                <Input
                                    type="number"
                                    min={1}
                                    step={1}
                                    value={pullPassDraft.coinsPerXp}
                                    onChange={(event) => setPullPassDraft((prev) => ({ ...prev, coinsPerXp: Math.max(1, Number(event.target.value) || 1) }))}
                                    className="mt-1 w-full bg-[#0b0e14] border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                                />
                            </label>
                            <label className="text-sm text-gray-300">Total tiers
                                <Input
                                    type="number"
                                    min={1}
                                    max={200}
                                    step={1}
                                    value={pullPassDraft.totalTiers}
                                    onChange={(event) => setPullPassDraft((prev) => ({ ...prev, totalTiers: Math.max(1, Math.floor(Number(event.target.value) || 1)) }))}
                                    className="mt-1 w-full bg-[#0b0e14] border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                                />
                            </label>
                            <label className="flex items-center justify-between gap-3 rounded-lg border border-gray-800 bg-[#0b0e14] px-3 py-2 text-sm text-gray-300">
                                Pull Pass enabled
                                <Checkbox checked={pullPassDraft.enabled} onChange={(event) => setPullPassDraft((prev) => ({ ...prev, enabled: event.target.checked }))} />
                            </label>
                            <label className="flex items-center justify-between gap-3 rounded-lg border border-gray-800 bg-[#0b0e14] px-3 py-2 text-sm text-gray-300 md:col-span-2 xl:col-span-1">
                                Restart users after pass ends
                                <Checkbox checked={pullPassDraft.resetOnEnd !== false} onChange={(event) => setPullPassDraft((prev) => ({ ...prev, resetOnEnd: event.target.checked }))} />
                            </label>
                        </div>

                        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <label className="text-sm text-gray-300">Season starts
                                <Input
                                    type="datetime-local"
                                    value={pullPassDraft.startsAt}
                                    onChange={(event) => setPullPassDraft((prev) => ({ ...prev, startsAt: event.target.value }))}
                                    className="mt-1 w-full bg-[#0b0e14] border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                                />
                            </label>
                            <label className="text-sm text-gray-300">Season ends
                                <Input
                                    type="datetime-local"
                                    value={pullPassDraft.endsAt}
                                    onChange={(event) => setPullPassDraft((prev) => ({ ...prev, endsAt: event.target.value }))}
                                    className="mt-1 w-full bg-[#0b0e14] border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                                />
                            </label>
                        </div>

                        <div className="mt-4 rounded-xl border border-purple-400/20 bg-purple-500/10 p-4">
                            <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
                                <div>
                                    <p className="text-xs font-bold uppercase tracking-wide text-purple-200/80">XP Rate</p>
                                    <p className="mt-1 text-white"><span className="font-black">{pullPassDraft.coinsPerXp}</span> coins spent = 1 XP</p>
                                </div>
                                <div>
                                    <p className="text-xs font-bold uppercase tracking-wide text-purple-200/80">Tier Count</p>
                                    <p className="mt-1 text-white"><span className="font-black">{pullPassDraft.totalTiers}</span> total tiers</p>
                                </div>
                                <div>
                                    <p className="text-xs font-bold uppercase tracking-wide text-purple-200/80">Rewards</p>
                                    <p className="mt-1 text-white">Bronze, Silver, Gold, coins, and XP entries</p>
                                </div>
                            </div>
                        </div>

                        <div className="mt-4">
                            <label className="block text-xs font-bold uppercase tracking-wide text-gray-500 mb-2">Tier rewards JSON</label>
                            <Textarea
                                rows={8}
                                value={pullPassDraft.tiersText}
                                onChange={(event) => setPullPassDraft((prev) => ({ ...prev, tiersText: event.target.value }))}
                                className="w-full bg-[#0b0e14] border border-gray-700 rounded-lg px-3 py-2 text-white text-sm font-mono"
                            />
                            <p className="mt-2 text-xs text-gray-500">Use an array of tier objects. Example fields: tier, xpRequired, freeReward, premiumReward, rewardType, imageUrl.</p>
                        </div>

                        <div className="mt-4 flex flex-col gap-3 border-t border-gray-800 pt-4 sm:flex-row sm:items-center sm:justify-between">
                            <p className="text-xs text-gray-500">Saved to settings/pullPass for later frontend and backend integration.</p>
                            <button
                                type="button"
                                onClick={() => { void handleSavePullPassSettings(); }}
                                className="w-full rounded-lg border border-purple-400/35 bg-purple-500/15 px-5 py-2 text-sm font-bold text-purple-100 transition-colors hover:bg-purple-500/25 sm:w-auto"
                            >
                                Save Pull Pass settings
                            </button>
                            {pullPassSettingsNotice && <div className="text-xs text-green-400 bg-green-500/10 border border-green-500/20 rounded-lg px-3 py-2">Pull Pass settings saved.</div>}
                        </div>

                        <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/[0.06] p-4">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <div className="min-w-0">
                                    <p className="text-sm font-bold text-red-200">Reset current Pull Pass</p>
                                    <p className="mt-1 text-xs leading-5 text-gray-400">
                                        Clears every user&apos;s Pull Pass XP, claims, and active reward-box claim flags so the current season starts fresh.
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => { void handleResetCurrentPullPass(); }}
                                    disabled={isResettingPullPass}
                                    className="w-full rounded-lg border border-red-400/40 bg-red-500/15 px-5 py-2 text-sm font-bold text-red-100 transition-colors hover:bg-red-500/25 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                                >
                                    {isResettingPullPass ? 'Resetting…' : 'Reset Pull Pass'}
                                </button>
                            </div>
                            {pullPassResetNotice && (
                                <div className="mt-3 rounded-lg border border-green-500/20 bg-green-500/10 px-3 py-2 text-xs text-green-300">
                                    {pullPassResetNotice}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="bg-[#131720] border border-gray-800 rounded-xl p-6">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                            <div>
                                <h3 className="text-lg font-bold text-white">Economy Conversion</h3>
                                <p className="text-sm text-gray-400">Control XP conversion for opening coin-priced boxes.</p>
                            </div>
                        </div>
                        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">XP equals $1</label>
                                <Input
                                    type="number"
                                    min={1}
                                    step={1}
                                    value={economyDraft.xpPerDollar}
                                    onChange={(event) => setEconomyDraft((prev) => ({ ...prev, xpPerDollar: Math.max(1, Number(event.target.value) || 1) }))}
                                    className="w-full bg-[#0f1521] border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Coins equals $1</label>
                                <Input
                                    type="number"
                                    min={1}
                                    step={1}
                                    value={economyDraft.coinsPerDollar}
                                    onChange={(event) => setEconomyDraft((prev) => ({ ...prev, coinsPerDollar: Math.max(1, Number(event.target.value) || 1) }))}
                                    className="w-full bg-[#0f1521] border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                                />
                            </div>
                        </div>
                        <div className="mt-4 flex items-center justify-between rounded-lg border border-gray-800 bg-[#0b0e14] px-3 py-2">
                            <span className="text-xs font-semibold text-gray-300">Enable XP opens</span>
                            <button
                                type="button"
                                onClick={() => setEconomyDraft((prev) => ({ ...prev, xpOpenEnabled: !prev.xpOpenEnabled }))}
                                className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${economyDraft.xpOpenEnabled ? 'border-emerald-400/40 bg-emerald-400/20 text-emerald-100' : 'border-gray-600 bg-gray-700/40 text-gray-300'}`}
                            >
                                {economyDraft.xpOpenEnabled ? 'Enabled' : 'Disabled'}
                            </button>
                        </div>
                        <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-t border-gray-800 pt-4">
                            <p className="text-xs text-gray-500">Used for XP box cost formula: round((priceCoins / coinsPerDollar) * xpPerDollar).</p>
                            <button
                                onClick={() => { void handleSaveEconomySettings(); }}
                                className="w-full sm:w-auto px-5 py-2 bg-cyan-500/15 text-cyan-200 border border-cyan-400/35 rounded-lg text-sm font-bold hover:bg-cyan-500/25 transition-colors"
                            >
                                Save economy settings
                            </button>
                            {economySaveNotice && (
                                <div className="text-xs text-green-400 bg-green-500/10 border border-green-500/20 rounded-lg px-3 py-2">
                                    Economy settings saved.
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="bg-[#131720] border border-gray-800 rounded-xl p-6">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                            <div>
                                <h3 className="text-lg font-bold text-white">Rakeback Settings</h3>
                                <p className="text-sm text-gray-400">
                                    Configure unlock levels and bonus amounts. Coin values are displayed in coins only.
                                </p>
                            </div>
                            <div className="text-xs text-green-400 bg-green-500/10 border border-green-500/20 rounded-lg px-3 py-2">
                                Unlock at level {bonusDraft.rakebackUnlockLevel}
                            </div>
                        </div>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">XP required to unlock rakeback</label>
                                    <Input
                                        type="number"
                                        min={1}
                                        step={1}
                                        value={bonusDraft.rakebackUnlockLevel}
                                        onChange={(event) => setBonusDraft((prev) => ({ ...prev, rakebackUnlockLevel: Number(event.target.value) }))}
                                        className="w-full bg-[#0b0e14] border border-gray-700 rounded-lg px-4 py-2 text-white"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Base rakeback rate (%)</label>
                                    <Input
                                        type="number"
                                        min={0}
                                        step={0.1}
                                        value={bonusDraft.rakebackBasePercent}
                                        onChange={(event) => setBonusDraft((prev) => ({ ...prev, rakebackBasePercent: Number(event.target.value) }))}
                                        className="w-full bg-[#0b0e14] border border-gray-700 rounded-lg px-4 py-2 text-white"
                                    />
                                    <p className="text-xs text-gray-500 mt-2">
                                        Applies to net wagers once XP requirement is reached.
                                    </p>
                                </div>
                            </div>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Weekly bonus payout (coins)</label>
                                    <Input
                                        type="number"
                                        min={0}
                                        step={100}
                                        value={bonusDraft.rakebackBonusCoins}
                                        onChange={(event) => setBonusDraft((prev) => ({ ...prev, rakebackBonusCoins: Number(event.target.value) }))}
                                        className="w-full bg-[#0b0e14] border border-gray-700 rounded-lg px-4 py-2 text-white"
                                    />
                                    <p className="text-xs text-gray-500 mt-2">
                                        Boost power users with a fixed coin grant.
                                    </p>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Daily rakeback cap (coins)</label>
                                    <Input
                                        type="number"
                                        min={0}
                                        step={100}
                                        value={bonusDraft.rakebackDailyCapCoins}
                                        onChange={(event) => setBonusDraft((prev) => ({ ...prev, rakebackDailyCapCoins: Number(event.target.value) }))}
                                        className="w-full bg-[#0b0e14] border border-gray-700 rounded-lg px-4 py-2 text-white"
                                    />
                                    <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 mt-2">
                                        <span>Cap preview:</span>
                                        <span className="text-gray-200 font-semibold">{bonusDraft.rakebackDailyCapCoins.toLocaleString()} coins</span>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Daily spin odds weights</label>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                        {[10, 25, 100, 500, 1000, 2500].map((amount) => (
                                            <div key={amount} className="rounded-lg border border-gray-700 bg-[#0b0e14] p-2">
                                                <label className="block text-[10px] text-gray-400 mb-1">{amount} coins</label>
                                                <Input
                                                    type="number"
                                                    min={0}
                                                    step={0.1}
                                                    value={Number(bonusDraft.dailySpinOdds?.[String(amount)] ?? 0)}
                                                    onChange={(event) =>
                                                        setBonusDraft((prev) => ({
                                                            ...prev,
                                                            dailySpinOdds: {
                                                                ...(prev.dailySpinOdds ?? {}),
                                                                [String(amount)]: Math.max(0, Number(event.target.value) || 0)
                                                            }
                                                        }))
                                                    }
                                                    className="w-full bg-[#0f1521] border border-gray-700 rounded-lg px-2 py-1.5 text-white text-sm"
                                                />
                                            </div>
                                        ))}
                                    </div>
                                    <p className="text-xs text-gray-500 mt-2">Higher weight means higher chance. Setting 0 disables that prize.</p>
                                </div>
                            </div>
                        </div>
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-t border-gray-800 mt-6 pt-4">
                            <div className="text-xs text-gray-500">
                                Rakeback bonus: {bonusDraft.rakebackBonusCoins.toLocaleString()} coins • Base rate: {bonusDraft.rakebackBasePercent}%
                            </div>
                            <button
                                onClick={handleSaveBonusSettings}
                                className="w-full sm:w-auto px-5 py-2 bg-brand-blue/20 text-brand-blue border border-brand-blue/40 rounded-lg text-sm font-bold hover:bg-brand-blue hover:text-white transition-colors"
                            >
                                Save bonus settings
                            </button>
                            {bonusSaveNotice && (
                                <div className="text-xs text-green-400 bg-green-500/10 border border-green-500/20 rounded-lg px-3 py-2">
                                    Bonus settings saved.
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="bg-[#131720] border border-gray-800 rounded-xl p-6">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                            <div>
                                <h3 className="text-lg font-bold text-white">Economy Conversion</h3>
                                <p className="text-sm text-gray-400">Control XP conversion for opening coin-priced boxes.</p>
                            </div>
                        </div>
                        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">XP equals $1</label>
                                <Input
                                    type="number"
                                    min={1}
                                    step={1}
                                    value={economyDraft.xpPerDollar}
                                    onChange={(event) => setEconomyDraft((prev) => ({ ...prev, xpPerDollar: Math.max(1, Number(event.target.value) || 1) }))}
                                    className="w-full bg-[#0f1521] border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Coins equals $1</label>
                                <Input
                                    type="number"
                                    min={1}
                                    step={1}
                                    value={economyDraft.coinsPerDollar}
                                    onChange={(event) => setEconomyDraft((prev) => ({ ...prev, coinsPerDollar: Math.max(1, Number(event.target.value) || 1) }))}
                                    className="w-full bg-[#0f1521] border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                                />
                            </div>
                        </div>
                        <div className="mt-4 flex items-center justify-between rounded-lg border border-gray-800 bg-[#0b0e14] px-3 py-2">
                            <span className="text-xs font-semibold text-gray-300">Enable XP opens</span>
                            <button
                                type="button"
                                onClick={() => setEconomyDraft((prev) => ({ ...prev, xpOpenEnabled: !prev.xpOpenEnabled }))}
                                className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${economyDraft.xpOpenEnabled ? 'border-emerald-400/40 bg-emerald-400/20 text-emerald-100' : 'border-gray-600 bg-gray-700/40 text-gray-300'}`}
                            >
                                {economyDraft.xpOpenEnabled ? 'Enabled' : 'Disabled'}
                            </button>
                        </div>
                        <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-t border-gray-800 pt-4">
                            <p className="text-xs text-gray-500">Used for XP box cost formula: round((priceCoins / coinsPerDollar) * xpPerDollar).</p>
                            <button
                                onClick={() => { void handleSaveEconomySettings(); }}
                                className="w-full sm:w-auto px-5 py-2 bg-cyan-500/15 text-cyan-200 border border-cyan-400/35 rounded-lg text-sm font-bold hover:bg-cyan-500/25 transition-colors"
                            >
                                Save economy settings
                            </button>
                            {economySaveNotice && (
                                <div className="text-xs text-green-400 bg-green-500/10 border border-green-500/20 rounded-lg px-3 py-2">
                                    Economy settings saved.
                                </div>
                            )}
                        </div>
                    </div>


                    <div className="bg-[#131720] border border-gray-800 rounded-xl p-6">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                            <div>
                                <h3 className="text-lg font-bold text-white">Rewards Settings</h3>
                                <p className="text-sm text-gray-400">Configure rewards points, season end time, and payout rules.</p>
                            </div>
                            <div className={`text-xs font-semibold px-3 py-1 rounded-full ${rewardsDraft.enabled ? 'bg-emerald-500/10 text-emerald-300' : 'bg-gray-800 text-gray-400'}`}>
                                {rewardsDraft.enabled ? 'Enabled' : 'Disabled'}
                            </div>
                        </div>
                        <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
                            <label className="text-sm text-gray-300">Rewards enabled
                                <Checkbox checked={rewardsDraft.enabled} onChange={(e) => setRewardsDraft((prev) => ({ ...prev, enabled: e.target.checked }))} className="ml-3" />
                            </label>
                            <label className="text-sm text-gray-300">Points per coin spent
                                <Input type="number" min={0} step={0.1} value={rewardsDraft.pointsPerCoinSpent} onChange={(e) => setRewardsDraft((prev) => ({ ...prev, pointsPerCoinSpent: Number(e.target.value) }))} className="mt-1" />
                            </label>
                            <label className="text-sm text-gray-300">Season end (optional)
                                <Input type="datetime-local" value={rewardsDraft.seasonEndsAt} onChange={(e) => setRewardsDraft((prev) => ({ ...prev, seasonEndsAt: e.target.value }))} className="mt-1" />
                            </label>
                            <label className="text-sm text-gray-300 md:col-span-2">Leaderboard hero image URL
                                <Input type="url" value={rewardsDraft.heroImageUrl} onChange={(e) => setRewardsDraft((prev) => ({ ...prev, heroImageUrl: e.target.value }))} placeholder="https://your-cdn.com/leaderboard-hero.jpg" className="mt-1" />
                                <span className="mt-1 block text-xs text-gray-500">Recommended: 1800×600 (3:1 ratio). Mobile crops from center.</span>
                            </label>
                            <label className="text-sm text-gray-300">Payout type
                                <Select value={rewardsDraft.payoutType} onChange={(e) => setRewardsDraft((prev) => ({ ...prev, payoutType: e.target.value as any }))} className="mt-1">
                                    <option value="coins">Coins</option>
                                    <option value="xp">XP</option>
                                    <option value="item">Item</option>
                                    <option value="none">None</option>
                                </Select>
                            </label>
                        </div>
                        <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <label className="text-sm text-gray-300">Top 1 coin reward
                                <Input type="number" min={0} step={1} value={rewardsDraft.top1CoinReward} onChange={(e) => setRewardsDraft((prev) => ({ ...prev, top1CoinReward: Number(e.target.value) }))} className="mt-1" />
                            </label>
                            <label className="text-sm text-gray-300">Top 2 coin reward
                                <Input type="number" min={0} step={1} value={rewardsDraft.top2CoinReward} onChange={(e) => setRewardsDraft((prev) => ({ ...prev, top2CoinReward: Number(e.target.value) }))} className="mt-1" />
                            </label>
                            <label className="text-sm text-gray-300">Top 3 coin reward
                                <Input type="number" min={0} step={1} value={rewardsDraft.top3CoinReward} onChange={(e) => setRewardsDraft((prev) => ({ ...prev, top3CoinReward: Number(e.target.value) }))} className="mt-1" />
                            </label>
                        </div>
                        <div className="mt-4 flex items-center gap-3">
                            <button type="button" onClick={() => setRewardsDraft((prev) => ({ ...prev, rewardRulesMode: 'rank' }))} className={`px-3 py-2 rounded-lg text-xs font-bold ${rewardsDraft.rewardRulesMode === 'rank' ? 'bg-cyan-500/20 text-cyan-200' : 'bg-[#0b0e14] text-gray-400 border border-gray-800'}`}>By Rank</button>
                            <button type="button" onClick={() => setRewardsDraft((prev) => ({ ...prev, rewardRulesMode: 'points' }))} className={`px-3 py-2 rounded-lg text-xs font-bold ${rewardsDraft.rewardRulesMode === 'points' ? 'bg-cyan-500/20 text-cyan-200' : 'bg-[#0b0e14] text-gray-400 border border-gray-800'}`}>By Points</button>
                        </div>
                        <div className="mt-4">
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Rules JSON (rank rules should start at rank 4+)</label>
                            <Textarea rows={6} value={rewardsDraft.rewardRulesMode === 'rank' ? rewardsDraft.rankRulesText : rewardsDraft.pointsRulesText} onChange={(e) => setRewardsDraft((prev) => prev.rewardRulesMode === 'rank' ? { ...prev, rankRulesText: e.target.value } : { ...prev, pointsRulesText: e.target.value })} className="w-full" />
                        </div>
                        <div className="mt-4">
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Mini challenges JSON</label>
                            <Textarea rows={8} value={rewardsDraft.questRulesText} onChange={(e) => setRewardsDraft((prev) => ({ ...prev, questRulesText: e.target.value }))} className="w-full" />
                            <p className="mt-2 text-xs text-gray-500">Mission types: unboxing_count, sell_back_count, sell_back_value, upgrader_uses, unbox_rarity.</p>
                        </div>
                        <div className="mt-4 flex items-center gap-3">
                            <button onClick={() => { void handleSaveRewardsSettings(); }} className="px-5 py-2 bg-cyan-500/15 text-cyan-200 border border-cyan-400/35 rounded-lg text-sm font-bold hover:bg-cyan-500/25 transition-colors">Save rewards settings</button>
                            {rewardsSettingsNotice && <div className="text-xs text-green-400 bg-green-500/10 border border-green-500/20 rounded-lg px-3 py-2">Rewards settings saved.</div>}
                        </div>

                        <div className="mt-6 rounded-xl border border-gray-800 bg-[#0b0e14] p-4">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                    <h4 className="text-sm font-bold text-white">Contest winners approval</h4>
                                    <p className="text-xs text-gray-400">After the contest timer ends, approve winners and credit the configured coin payout.</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => { void handleApproveLeaderboardWinners(); }}
                                    disabled={selectedLeaderboardWinnerIds.length === 0 || isApprovingLeaderboardWinners}
                                    className="w-full sm:w-auto rounded-lg border border-emerald-400/35 bg-emerald-500/15 px-4 py-2 text-xs font-bold text-emerald-200 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    {isApprovingLeaderboardWinners ? 'Approving…' : `Approve selected (${selectedLeaderboardWinnerIds.length})`}
                                </button>
                            </div>

                            {rewardsDraft.payoutType !== 'coins' && (
                                <p className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                                    Set payout type to Coins to enable account credit approvals.
                                </p>
                            )}
                            {leaderboardApprovalNotice && (
                                <p className="mt-3 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-xs text-cyan-200">
                                    {leaderboardApprovalNotice}
                                </p>
                            )}

                            <div className="mt-3 overflow-x-auto rounded-lg border border-gray-800">
                                <table className="min-w-full text-left text-xs sm:text-sm">
                                    <thead className="bg-[#111827] text-gray-300">
                                        <tr>
                                            <th className="px-3 py-2">Select</th>
                                            <th className="px-3 py-2">Rank</th>
                                            <th className="px-3 py-2">User</th>
                                            <th className="px-3 py-2">Points</th>
                                            <th className="px-3 py-2">Reward</th>
                                            <th className="px-3 py-2">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {leaderboardApprovalsLoading ? (
                                            <tr><td colSpan={6} className="px-3 py-3 text-gray-400">Loading contest results…</td></tr>
                                        ) : leaderboardApprovals.length === 0 ? (
                                            <tr><td colSpan={6} className="px-3 py-3 text-gray-500">No ended contest results available yet.</td></tr>
                                        ) : leaderboardApprovals.map((entry) => {
                                            const isApproved = Boolean(entry.rewardApprovedAt);
                                            const isDisabled = isApproved || entry.rewardCoins <= 0 || rewardsDraft.payoutType !== 'coins';
                                            return (
                                                <tr key={entry.uid} className="border-t border-gray-800 text-gray-200">
                                                    <td className="px-3 py-2">
                                                        <Checkbox
                                                            checked={selectedLeaderboardWinnerIds.includes(entry.uid)}
                                                            disabled={isDisabled}
                                                            onChange={(event) => {
                                                                setSelectedLeaderboardWinnerIds((prev) => event.target.checked
                                                                    ? [...prev, entry.uid]
                                                                    : prev.filter((id) => id !== entry.uid));
                                                            }}
                                                        />
                                                    </td>
                                                    <td className="px-3 py-2 font-bold">#{entry.rank}</td>
                                                    <td className="max-w-[140px] truncate px-3 py-2 sm:max-w-none">{entry.displayName}</td>
                                                    <td className="px-3 py-2">{entry.points.toLocaleString()}</td>
                                                    <td className="px-3 py-2">{entry.rewardCoins.toLocaleString()} coins</td>
                                                    <td className="px-3 py-2 text-xs">
                                                        {isApproved ? 'Approved' : entry.rewardCoins > 0 ? 'Pending' : 'No coin payout'}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                    <div className="bg-[#131720] border border-gray-800 rounded-xl p-6">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                            <div>
                                <h3 className="text-lg font-bold text-white">XP Shop Management</h3>
                                <p className="text-sm text-gray-400">Create, edit, and sort redeemable XP rewards.</p>
                            </div>
                            <button
                                onClick={resetXpShopItemDraft}
                                className="w-full sm:w-auto px-4 py-2 rounded-lg border border-gray-700 text-gray-300 hover:text-white hover:border-gray-500 text-sm font-semibold"
                            >
                                New Item
                            </button>
                        </div>

                        <div className="mt-5 grid grid-cols-1 xl:grid-cols-2 gap-6">
                            <div className="space-y-3">
                                <label className="block text-xs font-bold text-gray-500 uppercase">Title</label>
                                <Input value={xpShopItemDraft.title} onChange={(event) => setXpShopItemDraft((prev) => ({ ...prev, title: event.target.value }))} placeholder="Reward title" />

                                <label className="block text-xs font-bold text-gray-500 uppercase">Description</label>
                                <Textarea value={xpShopItemDraft.description} onChange={(event) => setXpShopItemDraft((prev) => ({ ...prev, description: event.target.value }))} placeholder="Short reward description" rows={3} />

                                <label className="block text-xs font-bold text-gray-500 uppercase">Image URL (optional)</label>
                                <Input value={xpShopItemDraft.imageUrl ?? ''} onChange={(event) => setXpShopItemDraft((prev) => ({ ...prev, imageUrl: event.target.value }))} placeholder="https://..." />

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-2">XP Cost</label>
                                        <Input type="number" min={0} value={xpShopItemDraft.xpCost} onChange={(event) => setXpShopItemDraft((prev) => ({ ...prev, xpCost: Number(event.target.value) }))} />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Sort Order</label>
                                        <Input type="number" value={xpShopItemDraft.sortOrder} onChange={(event) => setXpShopItemDraft((prev) => ({ ...prev, sortOrder: Number(event.target.value) }))} />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Stock (blank = unlimited)</label>
                                        <Input type="number" min={0} disabled={xpShopItemDraft.fulfillmentType === 'DIGITAL' && xpShopItemDraft.metadata?.unlockRakeback === true} value={xpShopItemDraft.stock ?? ''} onChange={(event) => setXpShopItemDraft((prev) => ({ ...prev, stock: event.target.value === '' ? null : Number(event.target.value) }))} />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Per User Limit (blank = none)</label>
                                        <Input type="number" min={0} disabled={xpShopItemDraft.fulfillmentType === 'DIGITAL' && xpShopItemDraft.metadata?.unlockRakeback === true} value={xpShopItemDraft.limitPerUser ?? ''} onChange={(event) => setXpShopItemDraft((prev) => ({ ...prev, limitPerUser: event.target.value === '' ? null : Number(event.target.value) }))} />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Category</label>
                                        <Input value={xpShopItemDraft.category} onChange={(event) => setXpShopItemDraft((prev) => ({ ...prev, category: event.target.value }))} placeholder="Exclusive" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Fulfillment Type</label>
                                        <Select value={xpShopItemDraft.fulfillmentType} onChange={(event) => setXpShopItemDraft((prev) => ({ ...prev, fulfillmentType: event.target.value as AdminXpShopItem['fulfillmentType'] }))}>
                                            <option value="DIGITAL">DIGITAL</option>
                                            <option value="COUPON">COUPON</option>
                                            <option value="PHYSICAL_SHIP">PHYSICAL_SHIP</option>
                                            <option value="XP_BOX">XP_BOX</option>
                                        </Select>
                                    </div>
                                </div>


                                {xpShopItemDraft.fulfillmentType === 'DIGITAL' && (
                                    <div className="space-y-3 rounded-lg border border-gray-800 bg-[#0b0e14] p-3">
                                        <label className="flex items-center gap-2 text-sm text-gray-300">
                                            <Input
                                                type="checkbox"
                                                checked={xpShopItemDraft.metadata?.unlockRakeback === true}
                                                onChange={(event) => setXpShopItemDraft((prev) => ({
                                                    ...prev,
                                                    stock: event.target.checked ? null : prev.stock,
                                                    limitPerUser: event.target.checked ? 1 : prev.limitPerUser,
                                                    metadata: {
                                                        ...(prev.metadata ?? {}),
                                                        unlockRakeback: event.target.checked,
                                                        rakebackTier: event.target.checked ? (prev.metadata?.rakebackTier ?? null) : null
                                                    }
                                                }))}
                                                className="h-4 w-4"
                                            />
                                            Unlock Rakeback
                                        </label>

                                        {xpShopItemDraft.metadata?.unlockRakeback === true && (
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                <div>
                                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Rakeback % (optional override)</label>
                                                    <Input
                                                        type="number"
                                                        min={0}
                                                        step={0.01}
                                                        value={xpShopItemDraft.metadata?.rakebackPercent ?? ''}
                                                        onChange={(event) => setXpShopItemDraft((prev) => ({
                                                            ...prev,
                                                            metadata: {
                                                                ...(prev.metadata ?? {}),
                                                                rakebackPercent: event.target.value === '' ? undefined : Math.max(0, Number(event.target.value))
                                                            }
                                                        }))}
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Rakeback Tier (optional)</label>
                                                    <Input
                                                        value={xpShopItemDraft.metadata?.rakebackTier ?? ''}
                                                        onChange={(event) => setXpShopItemDraft((prev) => ({
                                                            ...prev,
                                                            metadata: {
                                                                ...(prev.metadata ?? {}),
                                                                rakebackTier: event.target.value.trim() ? event.target.value : null
                                                            }
                                                        }))}
                                                        placeholder="VIP-1"
                                                    />
                                                </div>
                                            </div>
                                        )}

                                        {xpShopItemDraft.metadata?.unlockRakeback === true && (
                                            <p className="text-xs text-gray-400">This reward is single-use and does not create inventory, shipping, or buyback records.</p>
                                        )}
                                    </div>
                                )}

                                {xpShopItemDraft.fulfillmentType === 'XP_BOX' && (
                                    <div className="space-y-3 rounded-lg border border-gray-800 bg-[#0b0e14] p-3">
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">XP Box</label>
                                            <Select
                                                value={xpShopItemDraft.metadata?.caseId ?? ''}
                                                onChange={(event) => setXpShopItemDraft((prev) => ({
                                                    ...prev,
                                                    metadata: { ...(prev.metadata ?? {}), caseId: event.target.value }
                                                }))}
                                            >
                                                <option value="">Select XP Box</option>
                                                {xpBoxes.map((box) => (
                                                    <option key={box.id} value={box.id}>{box.name}</option>
                                                ))}
                                            </Select>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">XP Price Override (optional)</label>
                                            <Input
                                                type="number"
                                                min={0}
                                                value={xpShopItemDraft.metadata?.xpPriceOverride ?? ''}
                                                onChange={(event) => setXpShopItemDraft((prev) => ({
                                                    ...prev,
                                                    metadata: {
                                                        ...(prev.metadata ?? {}),
                                                        xpPriceOverride: event.target.value === '' ? undefined : Math.max(0, Math.floor(Number(event.target.value) || 0))
                                                    }
                                                }))}
                                            />
                                        </div>
                                        <button
                                            type="button"
                                            onClick={handleCreateXpBoxFromRewardEditor}
                                            className="w-full sm:w-auto px-3 py-2 rounded-lg border border-brand-blue/40 text-brand-blue hover:bg-brand-blue hover:text-white text-sm font-semibold"
                                        >
                                            Create XP Box
                                        </button>
                                    </div>
                                )}

                                <label className="flex items-center gap-2 text-sm text-gray-300">
                                    <Input type="checkbox" checked={xpShopItemDraft.enabled} onChange={(event) => setXpShopItemDraft((prev) => ({ ...prev, enabled: event.target.checked }))} className="h-4 w-4" />
                                    Enabled
                                </label>

                                <div className="flex flex-col sm:flex-row gap-2">
                                    <button
                                        onClick={handleSaveXpShopItem}
                                        disabled={isSavingXpShopItem}
                                        className="w-full sm:w-auto px-4 py-2 rounded-lg bg-brand-blue/20 text-brand-blue border border-brand-blue/40 hover:bg-brand-blue hover:text-white font-bold text-sm"
                                    >
                                        {isSavingXpShopItem ? 'Saving...' : editingXpShopItemId ? 'Update Item' : 'Create Item'}
                                    </button>
                                    {editingXpShopItemId && (
                                        <button
                                            onClick={resetXpShopItemDraft}
                                            className="w-full sm:w-auto px-4 py-2 rounded-lg border border-gray-700 text-gray-300 hover:text-white text-sm font-semibold"
                                        >
                                            Cancel Edit
                                        </button>
                                    )}
                                </div>
                            </div>

                            <div className="space-y-3 max-h-[560px] overflow-y-auto pr-1">
                                {xpShopItems.length === 0 ? (
                                    <div className="rounded-lg border border-gray-800 bg-[#0b0e14] p-4 text-sm text-gray-400">No XP shop items yet.</div>
                                ) : (
                                    xpShopItems.map((item) => (
                                        <div key={item.id} className="rounded-lg border border-gray-800 bg-[#0b0e14] p-4">
                                            <div className="flex items-start justify-between gap-3">
                                                <div>
                                                    <div className="text-sm font-bold text-white">{item.title}</div>
                                                    <div className="text-xs text-gray-500 mt-1">{item.category} • {item.fulfillmentType}{item.fulfillmentType === 'XP_BOX' && item.metadata?.caseId ? ` • Box: ${item.metadata.caseId}` : ''}{item.metadata?.unlockRakeback ? ' • Unlocks Rakeback' : ''}</div>
                                                    <div className="text-xs text-gray-400 mt-1">{item.xpCost.toLocaleString()} XP</div>
                                                </div>
                                                <div className="flex gap-2">
                                                    <button onClick={() => handleEditXpShopItem(item)} className="px-2 py-1 text-xs rounded border border-gray-700 text-gray-300 hover:text-white">Edit</button>
                                                    <button onClick={() => handleDeleteXpShopItem(item.id)} className="px-2 py-1 text-xs rounded border border-red-700 text-red-300 hover:text-red-200">Delete</button>
                                                </div>
                                            </div>
                                            <div className="mt-2 text-xs text-gray-500">
                                                Stock: {item.stock == null ? 'Unlimited' : item.stock} • Per user: {item.limitPerUser == null ? 'No limit' : item.limitPerUser} • {item.enabled ? 'Enabled' : 'Disabled'}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="bg-[#131720] border border-gray-800 rounded-xl p-6">
                        <h3 className="text-lg font-bold text-white">XP Redemptions</h3>
                        <p className="text-sm text-gray-400 mb-4">Track pending/fulfilled/cancelled XP redemptions.</p>
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[700px] text-sm">
                                <thead>
                                    <tr className="text-left text-xs uppercase text-gray-500 border-b border-gray-800">
                                        <th className="py-2 pr-3">User</th>
                                        <th className="py-2 pr-3">Item</th>
                                        <th className="py-2 pr-3">Cost</th>
                                        <th className="py-2 pr-3">Date</th>
                                        <th className="py-2 pr-3">Status</th>
                                        <th className="py-2">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {xpRedemptions.slice(0, 100).map((redemption) => {
                                        const itemTitle = String((redemption.metadata?.title as string) ?? redemption.itemId);
                                        const userName = users.find((profile) => profile.id === redemption.userId)?.name ?? redemption.userId;
                                        return (
                                            <tr key={redemption.id} className="border-b border-gray-800/60">
                                                <td className="py-3 pr-3 text-gray-300">{userName}</td>
                                                <td className="py-3 pr-3 text-gray-300">{itemTitle}</td>
                                                <td className="py-3 pr-3 text-gray-300">{redemption.xpCost.toLocaleString()} XP</td>
                                                <td className="py-3 pr-3 text-gray-500">{redemption.createdAt?.toDate?.().toLocaleString?.() ?? '—'}</td>
                                                <td className="py-3 pr-3 text-gray-300">{redemption.status}</td>
                                                <td className="py-3">
                                                    <div className="flex flex-wrap gap-2">
                                                        <button onClick={() => handleUpdateXpRedemptionStatus(redemption.id, 'pending')} className="px-2 py-1 rounded border border-gray-700 text-xs text-gray-300">Pending</button>
                                                        <button onClick={() => handleUpdateXpRedemptionStatus(redemption.id, 'fulfilled')} className="px-2 py-1 rounded border border-emerald-700 text-xs text-emerald-300">Fulfilled</button>
                                                        <button onClick={() => handleUpdateXpRedemptionStatus(redemption.id, 'cancelled')} className="px-2 py-1 rounded border border-red-700 text-xs text-red-300">Cancel</button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {xpRedemptions.length === 0 && (
                                        <tr>
                                            <td colSpan={6} className="py-6 text-center text-gray-500">No redemptions yet.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB: FEES & SHIPPING */}
            {activeTab === 'market-pricing' && (
                <MarketPricingAdminSection items={items} boxes={boxes} />
            )}

            {activeTab === 'referrals' && (
                <ReferralAdminSection />
            )}

            {activeTab === 'fees' && (
                <div className="space-y-6">
                    <div className="bg-[#131720] border border-gray-800 rounded-xl p-6">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                            <div>
                                <h3 className="text-lg font-bold text-white">Shipping Costs</h3>
                                <p className="text-sm text-gray-400">
                                    Configure cash and coin-based shipping for the entire platform.
                                </p>
                            </div>
                            <div className={`text-xs font-semibold px-3 py-1 rounded-full ${stripeSettingsDraft.shippingCashEnabled ? 'bg-emerald-500/10 text-emerald-300' : 'bg-gray-800 text-gray-400'}`}>
                                {stripeSettingsDraft.shippingCashEnabled ? 'Cash enabled' : 'Cash disabled'}
                            </div>
                        </div>
                        <div className="mt-5 space-y-6">
                            <div className="rounded-xl border border-gray-800 bg-[#0b0e14] p-4">
                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                    <div>
                                        <h4 className="text-sm font-bold text-white">Cash Shipping</h4>
                                        <p className="text-xs text-gray-400">
                                            Enable Stripe Checkout and edit the tiered shipping rates customers see.
                                        </p>
                                    </div>
                                    <div className={`text-xs font-semibold px-3 py-1 rounded-full ${stripeSettingsDraft.shippingCashEnabled ? 'bg-emerald-500/10 text-emerald-300' : 'bg-gray-800 text-gray-400'}`}>
                                        {stripeSettingsDraft.shippingCashEnabled ? 'Enabled' : 'Disabled'}
                                    </div>
                                </div>
                                <div className="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
                                    <div className="flex items-center gap-3 bg-[#131720] border border-gray-700 rounded-lg px-4 py-3">
                                        <Input
                                            id="shipping-cash-enabled"
                                            type="checkbox"
                                            checked={stripeSettingsDraft.shippingCashEnabled}
                                            onChange={(event) =>
                                                setStripeSettingsDraft((prev) => ({
                                                    ...prev,
                                                    shippingCashEnabled: event.target.checked
                                                }))
                                            }
                                            className="h-4 w-4 rounded border-gray-700 bg-[#0b0e14] text-emerald-500 focus:ring-emerald-500"
                                        />
                                        <label htmlFor="shipping-cash-enabled" className="text-sm text-gray-200">
                                            Enable cash shipping
                                        </label>
                                    </div>
                                    <div className="lg:col-span-2">
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Shipping flat rate (USD)</label>
                                        <Input
                                            type="number"
                                            min={0}
                                            step={0.01}
                                            value={stripeSettingsDraft.shippingFlatRateInput}
                                            onChange={(event) =>
                                                setStripeSettingsDraft((prev) => ({
                                                    ...prev,
                                                    shippingFlatRateInput: event.target.value
                                                }))
                                            }
                                            className="w-full bg-[#131720] border border-gray-700 rounded-lg px-4 py-2 text-white"
                                            placeholder="6.99"
                                        />
                                    </div>

                                    <div className="lg:col-span-3 rounded-lg border border-emerald-500/10 bg-emerald-500/[0.03] p-4">
                                        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                                            <div>
                                                <h5 className="text-sm font-bold text-white">Base shipping tiers</h5>
                                                <p className="text-xs text-gray-400">Leave the final max value blank for the open-ended tier.</p>
                                            </div>
                                        </div>
                                        <div className="mt-4 grid grid-cols-1 gap-3">
                                            {stripeSettingsDraft.shippingRateTiers.map((tier, index) => (
                                                <div key={`shipping-rate-${index}`} className="grid grid-cols-1 gap-3 rounded-lg border border-gray-800 bg-[#131720] p-3 sm:grid-cols-3">
                                                    <div>
                                                        <label className="block text-[11px] font-bold uppercase text-gray-500">Label</label>
                                                        <Input value={tier.label} onChange={(event) => updateShippingRateTierDraft('shippingRateTiers', index, 'label', event.target.value)} className="mt-1 w-full bg-[#0b0e14] border border-gray-700 rounded-lg px-3 py-2 text-white" />
                                                    </div>
                                                    <div>
                                                        <label className="block text-[11px] font-bold uppercase text-gray-500">Max value (coins)</label>
                                                        <Input type="number" min={0} step={1} value={tier.maxValueCoinsExclusive ?? ''} onChange={(event) => updateShippingRateTierDraft('shippingRateTiers', index, 'maxValueCoinsExclusive', event.target.value)} className="mt-1 w-full bg-[#0b0e14] border border-gray-700 rounded-lg px-3 py-2 text-white" placeholder="No limit" />
                                                    </div>
                                                    <div>
                                                        <label className="block text-[11px] font-bold uppercase text-gray-500">Price (USD)</label>
                                                        <Input type="number" min={0} step={0.01} value={(tier.cashCents / 100).toFixed(2)} onChange={(event) => updateShippingRateTierDraft('shippingRateTiers', index, 'cashCents', event.target.value)} className="mt-1 w-full bg-[#0b0e14] border border-gray-700 rounded-lg px-3 py-2 text-white" />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="lg:col-span-3 rounded-lg border border-blue-500/10 bg-blue-500/[0.03] p-4">
                                        <h5 className="text-sm font-bold text-white">Shipping add-ons</h5>
                                        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                            {stripeSettingsDraft.shippingProtectionTiers.map((tier, index) => (
                                                <div key={`protection-rate-${index}`} className="rounded-lg border border-gray-800 bg-[#131720] p-3">
                                                    <label className="block text-[11px] font-bold uppercase text-gray-500">Protection label</label>
                                                    <Input value={tier.label} onChange={(event) => updateShippingRateTierDraft('shippingProtectionTiers', index, 'label', event.target.value)} className="mt-1 w-full bg-[#0b0e14] border border-gray-700 rounded-lg px-3 py-2 text-white" />
                                                    <label className="mt-3 block text-[11px] font-bold uppercase text-gray-500">Max value (coins)</label>
                                                    <Input type="number" min={0} step={1} value={tier.maxValueCoinsExclusive ?? ''} onChange={(event) => updateShippingRateTierDraft('shippingProtectionTiers', index, 'maxValueCoinsExclusive', event.target.value)} className="mt-1 w-full bg-[#0b0e14] border border-gray-700 rounded-lg px-3 py-2 text-white" placeholder="No limit" />
                                                    <label className="mt-3 block text-[11px] font-bold uppercase text-gray-500">Protection price (USD)</label>
                                                    <Input type="number" min={0} step={0.01} value={(tier.cashCents / 100).toFixed(2)} onChange={(event) => updateShippingRateTierDraft('shippingProtectionTiers', index, 'cashCents', event.target.value)} className="mt-1 w-full bg-[#0b0e14] border border-gray-700 rounded-lg px-3 py-2 text-white" />
                                                </div>
                                            ))}
                                            <div className="rounded-lg border border-gray-800 bg-[#131720] p-3">
                                                <label className="block text-[11px] font-bold uppercase text-gray-500">Signature required (USD)</label>
                                                <Input type="number" min={0} step={0.01} value={stripeSettingsDraft.signatureRequiredInput} onChange={(event) => setStripeSettingsDraft((prev) => ({ ...prev, signatureRequiredInput: event.target.value }))} className="mt-1 w-full bg-[#0b0e14] border border-gray-700 rounded-lg px-3 py-2 text-white" />
                                                <p className="mt-2 text-xs text-gray-500">Applied when customers select signature confirmation.</p>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="lg:col-span-3">
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Stripe Shipping Product ID</label>
                                        <Input
                                            type="text"
                                            value={stripeSettingsDraft.stripeShippingProductId}
                                            onChange={(event) =>
                                                setStripeSettingsDraft((prev) => ({
                                                    ...prev,
                                                    stripeShippingProductId: event.target.value
                                                }))
                                            }
                                            className="w-full bg-[#131720] border border-gray-700 rounded-lg px-4 py-2 text-white"
                                            placeholder="prod_..."
                                        />
                                        <p className="mt-2 text-xs text-gray-500">
                                            Optional. Used only for Stripe reporting.
                                        </p>
                                    </div>
                                </div>
                            </div>


                            <div className="rounded-xl border border-gray-800 bg-[#0b0e14] p-4">
                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                    <div>
                                        <h4 className="text-sm font-bold text-white">Coin Shipping</h4>
                                        <p className="text-xs text-gray-400">Control the global coin-paid shipping option.</p>
                                    </div>
                                    <div className={`text-xs font-semibold px-3 py-1 rounded-full ${stripeSettingsDraft.shippingCoinEnabled ? 'bg-blue-500/10 text-blue-300' : 'bg-gray-800 text-gray-400'}`}>
                                        {stripeSettingsDraft.shippingCoinEnabled ? 'Enabled' : 'Disabled'}
                                    </div>
                                </div>
                                <div className="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
                                    <div className="flex items-center gap-3 bg-[#131720] border border-gray-700 rounded-lg px-4 py-3">
                                        <Input
                                            id="shipping-coin-enabled"
                                            type="checkbox"
                                            checked={stripeSettingsDraft.shippingCoinEnabled}
                                            onChange={(event) =>
                                                setStripeSettingsDraft((prev) => ({
                                                    ...prev,
                                                    shippingCoinEnabled: event.target.checked
                                                }))
                                            }
                                            className="h-4 w-4 rounded border-gray-700 bg-[#0b0e14] text-blue-500 focus:ring-blue-500"
                                        />
                                        <label htmlFor="shipping-coin-enabled" className="text-sm text-gray-200">
                                            Enable coin shipping
                                        </label>
                                    </div>
                                    <div className="lg:col-span-2">
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Coin shipping cost (coins)</label>
                                        <Input
                                            type="number"
                                            min={0}
                                            step={1}
                                            value={stripeSettingsDraft.shippingCoinCostCoins}
                                            onChange={(event) =>
                                                setStripeSettingsDraft((prev) => ({
                                                    ...prev,
                                                    shippingCoinCostCoins: Number(event.target.value)
                                                }))
                                            }
                                            className="w-full bg-[#131720] border border-gray-700 rounded-lg px-4 py-2 text-white"
                                            placeholder="0"
                                        />
                                        <p className="mt-2 text-xs text-gray-500">
                                            Global cost for coin-paid shipping.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="mt-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                            <span className="text-xs text-gray-500">
                                Shipping settings are stored with Stripe configuration in Firestore.
                            </span>
                            <button
                                onClick={handleSaveStripeSettings}
                                className="w-full sm:w-auto px-5 py-2 bg-brand-blue/20 text-brand-blue border border-brand-blue/40 rounded-lg text-sm font-bold hover:bg-brand-blue hover:text-white transition-colors"
                            >
                                Save fees &amp; shipping
                            </button>
                            {stripeSettingsNotice && (
                                <div className="text-xs text-green-400 bg-green-500/10 border border-green-500/20 rounded-lg px-3 py-2">
                                    Fees &amp; shipping settings saved.
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="bg-[#131720] border border-gray-800 rounded-xl p-6">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                            <div>
                                <h3 className="text-lg font-bold text-white">Box Lab Fees</h3>
                                <p className="text-sm text-gray-400">
                                    Apply a one-time fee when publishing Box Lab boxes.
                                </p>
                            </div>
                        </div>
                        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Publish fee (coins)</label>
                                <Input
                                    type="number"
                                    min={0}
                                    step={1}
                                    value={stripeSettingsDraft.caseLabPublishFeeCoins}
                                    onChange={(event) =>
                                        setStripeSettingsDraft((prev) => ({
                                            ...prev,
                                            caseLabPublishFeeCoins: Number(event.target.value)
                                        }))
                                    }
                                    className="w-full bg-[#0b0e14] border border-gray-700 rounded-lg px-4 py-2 text-white"
                                    placeholder="0"
                                />
                                <p className="mt-2 text-xs text-gray-500">
                                    One-time fee charged when publishing a Box Lab box.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB: HOMEPAGE */}
            {activeTab === 'homepage' && (
                <div className="space-y-6">
                    <HomepageShowcaseEditor />
                    <div className="bg-[#131720] border border-gray-800 rounded-xl p-4 sm:p-6">
                        <h3 className="text-lg font-bold text-white">Daily reward box tiers</h3>
                        <p className="mt-1 text-sm text-gray-400">Set purchased-box spend missions and guaranteed daily rewards. The first tier should require 0 coins.</p>
                        <div className="mt-5 space-y-3">
                            {bonusDraft.dailyRewardTiers.map((tier, index) => (
                                <div key={`daily-reward-${index}`} className="grid grid-cols-1 gap-3 rounded-xl border border-gray-700 bg-[#0b0e14] p-3 sm:grid-cols-3">
                                    <label><span className="mb-1 block text-[10px] font-bold uppercase text-gray-500">Box name</span><Input value={tier.name} onChange={(event) => setBonusDraft((prev) => ({ ...prev, dailyRewardTiers: prev.dailyRewardTiers.map((item, i) => i === index ? { ...item, name: event.target.value } : item) }))} className="w-full rounded-lg border border-gray-700 bg-[#0f1521] px-3 py-2 text-sm text-white" /></label>
                                    <label><span className="mb-1 block text-[10px] font-bold uppercase text-gray-500">Coins opened required</span><Input type="number" min={0} value={tier.spendRequired} onChange={(event) => setBonusDraft((prev) => ({ ...prev, dailyRewardTiers: prev.dailyRewardTiers.map((item, i) => i === index ? { ...item, spendRequired: Math.max(0, Number(event.target.value)) } : item) }))} className="w-full rounded-lg border border-gray-700 bg-[#0f1521] px-3 py-2 text-sm text-white" /></label>
                                    <label><span className="mb-1 block text-[10px] font-bold uppercase text-gray-500">Reward coins</span><Input type="number" min={1} value={tier.rewardCoins} onChange={(event) => setBonusDraft((prev) => ({ ...prev, dailyRewardTiers: prev.dailyRewardTiers.map((item, i) => i === index ? { ...item, rewardCoins: Math.max(1, Number(event.target.value)) } : item) }))} className="w-full rounded-lg border border-gray-700 bg-[#0f1521] px-3 py-2 text-sm text-white" /></label>
                                </div>
                            ))}
                        </div>
                        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:justify-end"><button type="button" onClick={() => setBonusDraft((prev) => ({ ...prev, dailyRewardTiers: [...prev.dailyRewardTiers, { name: `Tier ${prev.dailyRewardTiers.length + 1}`, spendRequired: 0, rewardCoins: 25 }] }))} className="rounded-lg border border-gray-600 px-4 py-2 text-sm font-bold text-gray-200">Add tier</button><button onClick={handleSaveBonusSettings} className="rounded-lg border border-brand-blue/40 bg-brand-blue/20 px-5 py-2 text-sm font-bold text-brand-blue">Save daily rewards</button></div>
                    </div>
                    <div className="bg-[#131720] border border-gray-800 rounded-xl p-4 sm:p-6">
                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                            <div>
                                <h3 className="text-lg font-bold text-white">Daily Spin Odds</h3>
                                <p className="mt-1 text-sm text-gray-400">
                                    Customize the prize weights used by the daily spin page. Higher weights make a prize more likely; setting a weight to 0 disables that prize.
                                </p>
                            </div>
                            <div className="rounded-lg border border-[#54f5b3]/20 bg-[#54f5b3]/10 px-3 py-2 text-xs font-semibold text-[#54f5b3]">
                                Mobile friendly grid
                            </div>
                        </div>
                        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                            {dailySpinRows.map((row, index) => (
                                <div key={`homepage-daily-spin-${index}`} className="rounded-xl border border-gray-700 bg-[#0b0e14] p-3">
                                    <div className="mb-3 flex items-center justify-between gap-2">
                                        <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">Reward spin {index + 1}</p>
                                        <span className="rounded-full bg-brand-blue/10 px-2 py-1 text-[10px] font-bold text-brand-blue">{row.amount.toLocaleString()} coins</span>
                                    </div>
                                    <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2">
                                        <label className="block">
                                            <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-gray-500">Reward value</span>
                                            <Input
                                                type="number"
                                                min={1}
                                                step={1}
                                                value={row.amount}
                                                onChange={(event) => {
                                                    setBonusSaveNotice(false);
                                                    setBonusDraft((prev) => ({
                                                        ...prev,
                                                        dailySpinOdds: setDailySpinRow(prev.dailySpinOdds, index, {
                                                            amount: Number(event.target.value),
                                                            weight: row.weight
                                                        })
                                                    }));
                                                }}
                                                className="w-full bg-[#0f1521] border border-gray-700 rounded-lg px-2 py-2 text-white text-sm"
                                            />
                                        </label>
                                        <label className="block">
                                            <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-gray-500">Odds weight</span>
                                            <Input
                                                type="number"
                                                min={0}
                                                step={0.1}
                                                value={row.weight}
                                                onChange={(event) => {
                                                    setBonusSaveNotice(false);
                                                    setBonusDraft((prev) => ({
                                                        ...prev,
                                                        dailySpinOdds: setDailySpinRow(prev.dailySpinOdds, index, {
                                                            amount: row.amount,
                                                            weight: Number(event.target.value)
                                                        })
                                                    }));
                                                }}
                                                className="w-full bg-[#0f1521] border border-gray-700 rounded-lg px-2 py-2 text-white text-sm"
                                            />
                                        </label>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="mt-5 flex flex-col gap-3 border-t border-gray-800 pt-4 sm:flex-row sm:items-center sm:justify-between">
                            <p className="text-xs text-gray-500">
                                These odds are saved to the same bonus settings used by the daily spin API.
                            </p>
                            <button
                                onClick={handleSaveBonusSettings}
                                className="w-full sm:w-auto px-5 py-2 bg-brand-blue/20 text-brand-blue border border-brand-blue/40 rounded-lg text-sm font-bold hover:bg-brand-blue hover:text-white transition-colors"
                            >
                                Save daily spin odds
                            </button>
                            {bonusSaveNotice && (
                                <div className="text-xs text-green-400 bg-green-500/10 border border-green-500/20 rounded-lg px-3 py-2">
                                    Daily spin odds saved.
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* TAB: BOXES PAGE */}
            {activeTab === 'boxes-page' && (
                <BoxesPageConfigEditor boxes={boxes} />
            )}

            {/* TAB: CASE LAB */}
            {activeTab === 'case-lab' && (
                <div className="space-y-6">
                    <div className="bg-[#131720] border border-gray-800 rounded-xl p-6">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                            <div>
                                <h3 className="text-lg font-bold text-white">Box Lab Settings</h3>
                                <p className="text-sm text-gray-400">
                                    Control default sell back rates for Box Lab boxes.
                                </p>
                            </div>
                        </div>
                        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Sell back percentage</label>
                                <Input
                                    type="number"
                                    min={0}
                                    max={100}
                                    step={1}
                                    value={stripeSettingsDraft.caseLabSellBackPercent}
                                    onChange={(event) =>
                                        setStripeSettingsDraft((prev) => ({
                                            ...prev,
                                            caseLabSellBackPercent: Number(event.target.value)
                                        }))
                                    }
                                    className="w-full bg-[#0b0e14] border border-gray-700 rounded-lg px-4 py-2 text-white"
                                />
                                <p className="mt-2 text-xs text-gray-500">
                                    Percent of item value paid on Box Lab sell backs.
                                </p>
                            </div>
                        </div>
                        <div className="mt-4">
                            <div className="flex flex-col gap-1">
                                <label className="block text-xs font-bold text-gray-500 uppercase">Available source boxes</label>
                                <p className="text-xs text-gray-500">
                                    Choose exactly which boxes can be used in Box Lab (for item picking and cover images).
                                </p>
                            </div>
                            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                                {selectableCaseLabBoxes.map((box) => {
                                    const checked = stripeSettingsDraft.caseLabVisibleBoxIds.includes(box.id);
                                    return (
                                        <label
                                            key={box.id}
                                            className="flex items-center gap-3 rounded-lg border border-gray-700 bg-[#0b0e14] px-3 py-2 text-sm text-gray-200"
                                        >
                                            <Input
                                                type="checkbox"
                                                checked={checked}
                                                onChange={(event) =>
                                                    setStripeSettingsDraft((prev) => ({
                                                        ...prev,
                                                        caseLabVisibleBoxIds: event.target.checked
                                                            ? [...prev.caseLabVisibleBoxIds, box.id]
                                                            : prev.caseLabVisibleBoxIds.filter((id) => id !== box.id)
                                                    }))
                                                }
                                                className="h-4 w-4 rounded border-gray-700 bg-[#0b0e14] text-brand-blue focus:ring-brand-blue"
                                            />
                                            <img src={box.image} alt={box.name} className="h-8 w-8 rounded object-cover bg-black/30" />
                                            <div className="min-w-0">
                                                <p className="truncate font-semibold text-white">{box.name}</p>
                                                <p className="text-[11px] text-gray-400">{box.items.length} items</p>
                                            </div>
                                        </label>
                                    );
                                })}
                            </div>
                            {selectableCaseLabBoxes.length === 0 && (
                                <div className="mt-3 rounded-lg border border-dashed border-gray-700 px-4 py-3 text-xs text-gray-500">
                                    No eligible admin boxes are available yet.
                                </div>
                            )}
                            <p className="mt-2 text-xs text-gray-500">
                                If nothing is selected, Box Lab will continue showing all eligible boxes.
                            </p>
                        </div>
                        <div className="mt-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                            <span className="text-xs text-gray-500">
                                Box Lab settings are stored with the Stripe configuration in Firestore.
                            </span>
                            <button
                                onClick={handleSaveStripeSettings}
                                className="w-full sm:w-auto px-5 py-2 bg-brand-blue/20 text-brand-blue border border-brand-blue/40 rounded-lg text-sm font-bold hover:bg-brand-blue hover:text-white transition-colors"
                            >
                                Save Box Lab settings
                            </button>
                            {stripeSettingsNotice && (
                                <div className="text-xs text-green-400 bg-green-500/10 border border-green-500/20 rounded-lg px-3 py-2">
                                    Box Lab settings saved.
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="bg-[#131720] border border-gray-800 rounded-xl p-6">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                            <div>
                                <h3 className="text-lg font-bold text-white">User Created Boxes</h3>
                                <p className="text-sm text-gray-400">
                                    Remove Box Lab boxes that are expired or no longer needed.
                                </p>
                            </div>
                            <span className="text-xs text-gray-500">
                                {userCaseLabBoxes.length} total
                            </span>
                        </div>
                        <div className="mt-4 space-y-3">
                            {userCaseLabBoxes.length === 0 ? (
                                <div className="text-sm text-gray-500 border border-dashed border-gray-700 rounded-lg px-4 py-6 text-center">
                                    No user-created boxes are currently active.
                                </div>
                            ) : (
                                userCaseLabBoxes.map((box) => {
                                    const expiryLabel = getBoxExpiryLabel(box);
                                    const isExpired = expiryLabel.startsWith('Expired');
                                    return (
                                        <div
                                            key={box.id}
                                            className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-[#0b0e14] border border-gray-800 rounded-xl p-4"
                                        >
                                            <div className="flex items-center gap-3">
                                                <img
                                                    src={box.image}
                                                    alt={box.name}
                                                    className="h-12 w-12 rounded-lg object-cover bg-black/40"
                                                />
                                                <div>
                                                    <div className="text-sm font-semibold text-white">{box.name}</div>
                                                    <div className="text-xs text-gray-500">
                                                        {box.createdAt ? formatTimestamp(box.createdAt) : 'Created time unavailable'}
                                                    </div>
                                                    <div className={`text-xs ${isExpired ? 'text-red-400' : 'text-emerald-400'}`}>
                                                        {expiryLabel}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                                                <div className="text-xs text-gray-400">
                                                    Price: <span className="text-white font-semibold">{toCoins(box.price, PRICE_UNIT_MODE)}</span>
                                                </div>
                                                <button
                                                    onClick={() => initiateDeleteBox(box.id)}
                                                    className="px-4 py-2 text-xs font-bold rounded-lg border border-red-500/40 text-red-300 hover:bg-red-500/20 transition-colors"
                                                >
                                                    Remove box
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* TAB: POLLS */}
            {activeTab === 'polls' && (
                <PollsAdminSection />
            )}

            {/* TAB: FOOTER PAGES */}
            {activeTab === 'footer-pages' && (
                <FooterPagesEditor />
            )}

            {activeTab === 'seo' && <SeoManager />}

            {/* TAB: SETTINGS */}
            {activeTab === 'settings' && (
                <div className="space-y-6">
                    <div className="bg-[#131720] border border-gray-800 rounded-xl p-6">
                        <h3 className="text-lg font-bold text-white mb-4">General Configuration</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Site Name</label>
                                <Input type="text" value="pullz.gg" className="w-full bg-[#0b0e14] border border-gray-700 rounded-lg px-4 py-2 text-white" readOnly />
                            </div>
                            <div className="rounded-xl border border-gray-800 bg-[#0b0e14] p-4 md:col-span-2">
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Homepage & auth images</label>
                                <p className="text-xs text-gray-500 mb-4">Paste CDN image URLs. Optimized for mobile cards and modal artwork.</p>
                                <div className="mb-4 rounded-lg border border-gray-700 bg-[#111827] p-3">
                                    <label className="mb-2 block text-xs font-bold uppercase text-gray-400">Box catalog header image</label>
                                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                                        <Input
                                            type="url"
                                            value={stripeSettingsDraft.boxCatalogHeroImageUrl}
                                            onChange={(event) => {
                                                setStripeSettingsDraft((prev) => ({ ...prev, boxCatalogHeroImageUrl: event.target.value }));
                                                setStripeSettingsNotice(false);
                                            }}
                                            placeholder="https://your-cdn.com/box-catalog-hero.png"
                                            className="w-full bg-[#0b0e14] border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
                                        />
                                        <label className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-brand-blue/40 bg-brand-blue/10 px-3 py-2 text-xs font-semibold text-brand-blue hover:bg-brand-blue hover:text-white">
                                            <input type="file" accept="image/*" className="hidden" onChange={handleBoxCatalogHeroUpload} disabled={isUploadingBoxCatalogHero} />
                                            {isUploadingBoxCatalogHero ? 'Uploading…' : 'Upload image'}
                                        </label>
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                    {[0, 1, 2].map((index) => (
                                        <Input
                                            key={`auth-popup-image-${index}`}
                                            type="url"
                                            value={stripeSettingsDraft.authPopupImageUrls[index] ?? ''}
                                            onChange={(event) => {
                                                const nextUrls = [...stripeSettingsDraft.authPopupImageUrls];
                                                nextUrls[index] = event.target.value;
                                                setStripeSettingsDraft((prev) => ({ ...prev, authPopupImageUrls: nextUrls, authPopupImageUrl: nextUrls[0] ?? '' }));
                                                setStripeSettingsNotice(false);
                                            }}
                                            placeholder={`Auth popup image ${index + 1} URL`}
                                            className="w-full bg-[#111827] border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
                                        />
                                    ))}
                                    {[0, 1, 2].map((index) => (
                                        <Input
                                            key={`home-category-image-${index}`}
                                            type="url"
                                            value={stripeSettingsDraft.homeCategoryImageUrls[index] ?? ''}
                                            onChange={(event) => {
                                                const nextUrls = [...stripeSettingsDraft.homeCategoryImageUrls];
                                                nextUrls[index] = event.target.value;
                                                setStripeSettingsDraft((prev) => ({ ...prev, homeCategoryImageUrls: nextUrls }));
                                                setStripeSettingsNotice(false);
                                            }}
                                            placeholder={`Homepage category image ${index + 1} URL`}
                                            className="w-full bg-[#111827] border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
                                        />
                                    ))}
                                    {[0, 1, 2].map((index) => (
                                        <div key={`home-category-slug-${index}`} className="space-y-1.5">
                                            <Select
                                                value={stripeSettingsDraft.homeCategorySlugs[index] ?? ''}
                                                onChange={(event) => {
                                                    const nextSlugs = [...stripeSettingsDraft.homeCategorySlugs];
                                                    nextSlugs[index] = event.target.value;
                                                    setStripeSettingsDraft((prev) => ({ ...prev, homeCategorySlugs: nextSlugs }));
                                                    setStripeSettingsNotice(false);
                                                }}
                                                placeholder={`Select homepage category ${index + 1}`}
                                                className="w-full !bg-[#111827] !border-gray-700"
                                            >
                                                <option value="">No category</option>
                                                {homeCategoryOptions.map((option) => (
                                                    <option key={`home-category-option-${option.value}`} value={option.value}>
                                                        {option.label}
                                                    </option>
                                                ))}
                                            </Select>
                                            {!homeCategoryOptions.some((option) => option.value === (stripeSettingsDraft.homeCategorySlugs[index] ?? '')) && (stripeSettingsDraft.homeCategorySlugs[index] ?? '').trim() ? (
                                                <p className="text-[11px] text-amber-300/90">
                                                    Current value is not in available categories. Pick a category above to ensure click-through works.
                                                </p>
                                            ) : null}
                                        </div>
                                    ))}
                                    {[0, 1, 2].map((index) => (
                                        <Input
                                            key={`how-it-works-image-${index}`}
                                            type="url"
                                            value={stripeSettingsDraft.howItWorksStepImageUrls[index] ?? ''}
                                            onChange={(event) => {
                                                const nextUrls = [...stripeSettingsDraft.howItWorksStepImageUrls];
                                                nextUrls[index] = event.target.value;
                                                setStripeSettingsDraft((prev) => ({ ...prev, howItWorksStepImageUrls: nextUrls }));
                                                setStripeSettingsNotice(false);
                                            }}
                                            placeholder={`How it works step ${index + 1} image URL`}
                                            className="w-full bg-[#111827] border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
                                        />
                                    ))}
                                </div>
                                <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                    <span className="text-xs text-gray-500">
                                        Save to publish image and category updates for homepage and auth flows.
                                    </span>
                                    <button
                                        onClick={handleSaveStripeSettings}
                                        className="w-full sm:w-auto px-5 py-2 bg-brand-blue/20 text-brand-blue border border-brand-blue/40 rounded-lg text-sm font-bold hover:bg-brand-blue hover:text-white transition-colors"
                                    >
                                        Save general configuration
                                    </button>
                                </div>
                                {stripeSettingsNotice && (
                                    <div className="mt-3 text-xs text-green-400 bg-green-500/10 border border-green-500/20 rounded-lg px-3 py-2">
                                        General configuration saved.
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="bg-[#131720] border border-gray-800 rounded-xl p-6">
                        <div className="flex items-center gap-2 mb-4">
                            <BellRing className="w-5 h-5 text-brand-blue" />
                            <h3 className="text-lg font-bold text-white">Send Notification</h3>
                        </div>
                        <p className="text-sm text-gray-400 mb-4">
                            Broadcast a notification to users. Messages appear in the notification bell.
                        </p>
                        <div className="space-y-4">
                            <Textarea
                                value={adminNotification}
                                onChange={(event) => setAdminNotification(event.target.value)}
                                rows={3}
                                placeholder="Enter a notification message..."
                                className="w-full bg-[#0b0e14] border border-gray-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-brand-blue transition-colors"
                            />
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                <span className="text-xs text-gray-500">
                                    Keep it short and actionable for mobile users.
                                </span>
                                <button
                                    onClick={() => { void handleSendAdminNotification(); }}
                                    disabled={!adminNotification.trim() || isSendingAdminNotice}
                                    className="px-5 py-2 bg-brand-blue/20 text-brand-blue border border-brand-blue/40 rounded-lg text-sm font-bold hover:bg-brand-blue hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isSendingAdminNotice ? 'Sending...' : 'Send notification'}
                                </button>
                            </div>
                            {adminNoticeSent && (
                                <div className="text-xs text-green-400 bg-green-500/10 border border-green-500/20 rounded-lg px-3 py-2">
                                    Notification sent.
                                </div>
                            )}
                        </div>

                        <div className="mt-6 rounded-xl border border-gray-800 bg-[#0b0e14] p-4">
                            <div className="flex items-center justify-between gap-3">
                                <h4 className="text-sm font-bold text-white">Recent Sent Notifications</h4>
                                <span className="text-[11px] text-gray-500">Manage sent messages</span>
                            </div>
                            {adminSentNotifications.length === 0 ? (
                                <div className="mt-3 rounded-lg border border-dashed border-gray-700 px-3 py-4 text-center text-xs text-gray-500">
                                    No sent notifications yet.
                                </div>
                            ) : (
                                <div className="mt-3 space-y-2">
                                    {adminSentNotifications.map((notice) => (
                                        <div
                                            key={notice.id}
                                            className="flex flex-col gap-2 rounded-lg border border-gray-800 bg-[#111621] p-3 sm:flex-row sm:items-start sm:justify-between"
                                        >
                                            <div className="min-w-0">
                                                <p className="truncate text-sm font-semibold text-gray-100">{notice.title}</p>
                                                <p className="mt-1 text-xs text-gray-400">{notice.body}</p>
                                                <p className="mt-2 text-[11px] text-gray-500">
                                                    {notice.createdAt ? formatTimestamp(notice.createdAt.toMillis()) : 'Just now'} • Recipients: {notice.recipientCount}
                                                </p>
                                            </div>
                                            <button
                                                onClick={() => { void handleDeleteSentNotification(notice.id); }}
                                                disabled={deletingAdminNoticeId === notice.id}
                                                className="self-end rounded-lg border border-red-500/25 px-3 py-1.5 text-xs font-semibold text-red-300 transition-colors hover:bg-red-500/10 disabled:opacity-50 sm:self-start"
                                            >
                                                {deletingAdminNoticeId === notice.id ? 'Removing...' : 'Delete'}
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

        </div>
      </div>

      {isPackageModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div
                  className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-in fade-in"
                  onClick={() => setIsPackageModalOpen(false)}
              ></div>
              <div className="relative max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto bg-[#131720] border border-gray-700 rounded-2xl shadow-2xl p-4 animate-in zoom-in-95 sm:p-6">
                  <div className="flex items-start justify-between gap-4 mb-4">
                      <div>
                          <h3 className="text-xl font-bold text-white">{editingPackageId ? 'Edit Package' : 'New Package'}</h3>
                          <p className="text-xs text-gray-400 mt-1">
                              Enter the Stripe price ID (price_...) so checkout uses secure price references.
                          </p>
                      </div>
                      <button
                          type="button"
                          onClick={() => setIsPackageModalOpen(false)}
                          className="text-gray-400 hover:text-white"
                      >
                          <X className="w-5 h-5" />
                      </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="sm:col-span-2">
                          <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Package Name</label>
                          <Input
                              type="text"
                              value={packageDraft.name ?? ''}
                              onChange={(event) => setPackageDraft((prev) => ({ ...prev, name: event.target.value }))}
                              className="w-full bg-[#0b0e14] border border-gray-700 rounded-lg px-4 py-2 text-white"
                          />
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Coins</label>
                          <Input
                              type="number"
                              min={1}
                              step={1}
                              value={packageDraft.coins ?? 0}
                              onChange={(event) => setPackageDraft((prev) => ({ ...prev, coins: Number(event.target.value) }))}
                              className="w-full bg-[#0b0e14] border border-gray-700 rounded-lg px-4 py-2 text-white"
                          />
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Bonus Coins</label>
                          <Input
                              type="number"
                              min={0}
                              step={1}
                              value={packageDraft.bonusCoins ?? 0}
                              onChange={(event) => setPackageDraft((prev) => ({ ...prev, bonusCoins: Number(event.target.value) }))}
                              className="w-full bg-[#0b0e14] border border-gray-700 rounded-lg px-4 py-2 text-white"
                          />
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Display Price</label>
                          <Input
                              type="text"
                              placeholder="$9.99"
                              value={packageDraft.displayPrice ?? ''}
                              onChange={(event) => setPackageDraft((prev) => ({ ...prev, displayPrice: event.target.value }))}
                              className="w-full bg-[#0b0e14] border border-gray-700 rounded-lg px-4 py-2 text-white"
                          />
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Badge (optional)</label>
                          <Input
                              type="text"
                              placeholder="Most Popular"
                              value={packageDraft.badge ?? ''}
                              onChange={(event) => setPackageDraft((prev) => ({ ...prev, badge: event.target.value }))}
                              className="w-full bg-[#0b0e14] border border-gray-700 rounded-lg px-4 py-2 text-white"
                          />
                      </div>
                      <div className="sm:col-span-2">
                          <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Custom Image URL (optional)</label>
                          <Input
                              type="url"
                              placeholder="https://cdn.example.com/packages/5000.png"
                              value={packageDraft.imageUrl ?? ''}
                              onChange={(event) => setPackageDraft((prev) => ({ ...prev, imageUrl: event.target.value }))}
                              className="w-full bg-[#0b0e14] border border-gray-700 rounded-lg px-4 py-2 text-white"
                          />
                          <p className="mt-1 text-[11px] text-gray-500">Shown in the top-up modal card. Leave blank to use the default package art.</p>
                      </div>
                      <div className="sm:col-span-2">
                          <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Stripe Price ID</label>
                          <Input
                              type="text"
                              placeholder="price_123..."
                              value={packageDraft.stripePriceId ?? ''}
                              onChange={(event) => setPackageDraft((prev) => ({ ...prev, stripePriceId: event.target.value }))}
                              className="w-full bg-[#0b0e14] border border-gray-700 rounded-lg px-4 py-2 text-white font-mono text-sm"
                          />
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Sort Order</label>
                          <Input
                              type="number"
                              step={1}
                              value={packageDraft.sortOrder ?? 0}
                              onChange={(event) => setPackageDraft((prev) => ({ ...prev, sortOrder: Number(event.target.value) }))}
                              className="w-full bg-[#0b0e14] border border-gray-700 rounded-lg px-4 py-2 text-white"
                          />
                      </div>
                      <div className="flex items-center gap-2 mt-6">
                          <Input
                              id="package-active"
                              type="checkbox"
                              checked={packageDraft.active ?? true}
                              onChange={(event) => setPackageDraft((prev) => ({ ...prev, active: event.target.checked }))}
                              className="w-4 h-4 rounded border-gray-700 bg-[#0b0e14] text-emerald-500 focus:ring-emerald-500"
                          />
                          <label htmlFor="package-active" className="text-sm text-gray-300">
                              Active
                          </label>
                      </div>
                      <div className="flex items-center gap-2 mt-6">
                          <Input
                              id="package-first-time-deposit-only"
                              type="checkbox"
                              checked={packageDraft.firstTimeDepositOnly ?? false}
                              onChange={(event) => setPackageDraft((prev) => ({ ...prev, firstTimeDepositOnly: event.target.checked }))}
                              className="w-4 h-4 rounded border-gray-700 bg-[#0b0e14] text-amber-500 focus:ring-amber-500"
                          />
                          <label htmlFor="package-first-time-deposit-only" className="text-sm text-gray-300">
                              First-time deposit package
                          </label>
                      </div>
                      <div className="flex items-center gap-2 mt-6">
                          <Input
                              id="package-default-selected"
                              type="checkbox"
                              checked={packageDraft.defaultSelected ?? false}
                              onChange={(event) => setPackageDraft((prev) => ({ ...prev, defaultSelected: event.target.checked }))}
                              className="w-4 h-4 rounded border-gray-700 bg-[#0b0e14] text-cyan-500 focus:ring-cyan-500"
                          />
                          <label htmlFor="package-default-selected" className="text-sm text-gray-300">
                              Preselect by default
                          </label>
                      </div>
                  </div>
                  {packageError && (
                      <div className="mt-4 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                          {packageError}
                      </div>
                  )}
                  <div className="mt-6 flex flex-col sm:flex-row gap-3">
                      <button
                          type="button"
                          onClick={() => setIsPackageModalOpen(false)}
                          className="flex-1 py-2.5 bg-gray-800 hover:bg-gray-700 text-white text-sm font-bold rounded-lg transition-colors"
                      >
                          Cancel
                      </button>
                      <button
                          type="button"
                          onClick={handleSavePackage}
                          disabled={isSavingPackage}
                          className="flex-1 py-2.5 btn-logo-gradient text-white text-sm font-bold rounded-lg shadow-lg transition-colors disabled:opacity-50"
                      >
                          {isSavingPackage ? 'Saving...' : (editingPackageId ? 'Save Changes' : 'Create Package')}
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* Delete Confirmation Modal */}
      {boxToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-in fade-in" onClick={() => setBoxToDelete(null)}></div>
              <div className="relative w-full max-w-sm bg-[#131720] border border-gray-700 rounded-2xl shadow-2xl p-6 animate-in zoom-in-95">
                  <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
                      <ShieldAlert className="w-6 h-6 text-red-500" /> Confirm Deletion
                  </h3>
                  <p className="text-gray-400 text-sm mb-6">
                      Are you sure you want to delete this box permanently? This action cannot be undone.
                  </p>
                  <div className="flex gap-3">
                      <button
                          onClick={() => setBoxToDelete(null)}
                          className="flex-1 py-2.5 bg-gray-800 hover:bg-gray-700 text-white text-sm font-bold rounded-lg transition-colors"
                      >
                          Cancel
                      </button>
                      <button
                          onClick={confirmDeleteBox}
                          className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 text-white text-sm font-bold rounded-lg shadow-lg shadow-red-900/20 transition-colors"
                      >
                          Delete Box
                      </button>
                  </div>
              </div>
          </div>
      )}

    </div>
  );
};

const CoinStatIcon = () => (
    <img src={COIN_ICON} alt="Coin" className="w-6 h-6" />
);
