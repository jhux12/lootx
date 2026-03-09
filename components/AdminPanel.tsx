import React, { useEffect, useMemo, useRef, useState } from 'react';
import { LayoutDashboard, Users, Settings, Activity, ShieldAlert, Package, Box as BoxIcon, Calculator, Edit2, Trash2, Calendar, BellRing, Truck, PackageCheck, Lock, Unlock, ShieldCheck, ScrollText, UserCog, Sparkles, X, BadgeDollarSign, Beaker, Home as HomeIcon, PackageOpen, MessageCircle } from 'lucide-react';
import { Timestamp, addDoc, arrayUnion, collection, deleteDoc, doc, getDocs, limit, onSnapshot, orderBy, query, runTransaction, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { calculateLevelProgress, useGame } from '../context/GameContext';
import { AdminActionLog, CaseItem, CoinPackage, InventoryHistoryEntry, InventoryItem, LedgerEntry, LedgerEntryType, MysteryBox, Shipment, UserLocks, UserStatus } from '../types';
import { COIN_ICON } from '../constants';
import { CoinAmount } from './CoinAmount';
import { buildOddsWithRiskAndTargetEV, buildRiskAdjustedOdds, calculateExpectedValue, calculateOddsTotal, getRiskLabel } from '../utils/caseOdds';
import { PRICE_UNIT_MODE, toCoins } from '../utils/coins';
import { db, storage } from '../firebase';
import { HomepageShowcaseEditor } from './admin/HomepageShowcaseEditor';
import { BoxesPageConfigEditor } from './admin/BoxesPageConfigEditor';
import { LegalEditor } from './admin/LegalEditor';
import { UpgraderAdminSection } from './admin/UpgraderAdminSection';
import { Checkbox } from './ui/Checkbox';
import { Input } from './ui/Input';
import { Select } from './ui/Select';
import { Textarea } from './ui/Textarea';
import { getBoxTags } from '../utils/boxTags';

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
    heroImageUrl: ''
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
    updateUserAdminData,
    updateUserBalance,
    bonusSettings,
    updateBonusSettings,
    stripeSettings,
    updateStripeSettings
  } = useGame();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'users' | 'settings' | 'items' | 'boxes' | 'shipments' | 'support' | 'bonuses' | 'packages' | 'fees' | 'case-lab' | 'homepage' | 'boxes-page' | 'legal'>('dashboard');

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
      redeemable: true
  });
  const [itemTagInput, setItemTagInput] = useState('');
  const [itemSizeInput, setItemSizeInput] = useState('');
  const [boxTagInput, setBoxTagInput] = useState('');
  const [itemSearchQuery, setItemSearchQuery] = useState('');
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
      tags: [],
      sellBackRate: 0.82
  });
  const [isPackageModalOpen, setIsPackageModalOpen] = useState(false);
  const [editingPackageId, setEditingPackageId] = useState<string | null>(null);
  const [packageDraft, setPackageDraft] = useState<Partial<CoinPackage>>({
      name: '',
      coins: 0,
      bonusCoins: 0,
      displayPrice: '',
      stripePriceId: '',
      badge: undefined,
      active: true,
      sortOrder: 0
  });
  const [packageError, setPackageError] = useState<string | null>(null);
  const [isSavingPackage, setIsSavingPackage] = useState(false);
  const [riskBalance, setRiskBalance] = useState(50);
  const [targetEV, setTargetEV] = useState(0.85);
  const [selectedItems, setSelectedItems] = useState<CaseItem[]>([]);
  const [itemBrandFilter, setItemBrandFilter] = useState('');
  const [itemCategoryFilter, setItemCategoryFilter] = useState('');
  const [itemTagFilters, setItemTagFilters] = useState<string[]>([]);
  const [deletingBoxId, setDeletingBoxId] = useState<string | null>(null);
  const [isUploadingSpinnerBackground, setIsUploadingSpinnerBackground] = useState(false);
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
  const [supportCases, setSupportCases] = useState<SupportCase[]>([]);
  const [expandedSupportCases, setExpandedSupportCases] = useState<Set<string>>(new Set());
  const [supportReplyDrafts, setSupportReplyDrafts] = useState<Record<string, string>>({});
  const [supportReplyStatus, setSupportReplyStatus] = useState<Record<string, { sending: boolean; error?: string; success?: string }>>(
      {}
  );
  const [supportStatusUpdates, setSupportStatusUpdates] = useState<Record<string, { sending: boolean; error?: string; success?: string }>>(
      {}
  );

  useEffect(() => {
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
      });

      return () => unsubscribe();
  }, []);

  const filteredAdminItems = useMemo(() => {
      const query = itemSearchQuery.trim().toLowerCase();
      if (!query) {
          return items;
      }

      return items.filter((item) => {
          const haystack = [
              item.name,
              item.brand,
              item.category,
              item.rarity,
              ...(item.tags ?? []),
              ...(item.sizes ?? [])
          ]
              .filter(Boolean)
              .join(' ')
              .toLowerCase();

          return haystack.includes(query);
      });
  }, [itemSearchQuery, items]);

  const visibleAdminItems = useMemo(
      () => filteredAdminItems.slice(0, itemVisibleCount),
      [filteredAdminItems, itemVisibleCount]
  );

  useEffect(() => {
      setItemVisibleCount(20);
  }, [itemSearchQuery, items]);

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
  const [userStatuses, setUserStatuses] = useState<Record<string, UserStatus>>({});
  const [userLocks, setUserLocks] = useState<Record<string, UserLocks>>({});
  const [ledgerEntries, setLedgerEntries] = useState<Record<string, LedgerEntry[]>>({});
  const [adminLogs, setAdminLogs] = useState<Record<string, AdminActionLog[]>>({});
  const [inventoryState, setInventoryState] = useState<Record<string, InventoryItem[]>>({});
  const [reversalAmount, setReversalAmount] = useState('');
  const [reversalReason, setReversalReason] = useState('');
  const [voidSourceId, setVoidSourceId] = useState('');
  const [voidReason, setVoidReason] = useState('');
  const [ledgerFilter, setLedgerFilter] = useState<'all' | LedgerEntryType>('all');
  const [ledgerSearch, setLedgerSearch] = useState('');
  const [timelineFilter, setTimelineFilter] = useState<'all' | 'ledger' | 'inventory' | 'admin'>('all');
  const [timelineSearch, setTimelineSearch] = useState('');
  const [bonusDraft, setBonusDraft] = useState(bonusSettings);
  const [questRulesText, setQuestRulesText] = useState<string>('[]');
  const [rewardsDraft, setRewardsDraft] = useState(DEFAULT_REWARDS_SETTINGS);
  const [rewardsSettingsNotice, setRewardsSettingsNotice] = useState(false);
  const [leaderboardApprovals, setLeaderboardApprovals] = useState<LeaderboardApprovalEntry[]>([]);
  const [selectedLeaderboardWinnerIds, setSelectedLeaderboardWinnerIds] = useState<string[]>([]);
  const [leaderboardApprovalsLoading, setLeaderboardApprovalsLoading] = useState(false);
  const [isApprovingLeaderboardWinners, setIsApprovingLeaderboardWinners] = useState(false);
  const [leaderboardApprovalNotice, setLeaderboardApprovalNotice] = useState<string | null>(null);
  const [bonusSaveNotice, setBonusSaveNotice] = useState(false);
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
  const [spreadsheetStatus, setSpreadsheetStatus] = useState<{ tone: 'success' | 'error'; message: string } | null>(null);
  const [isSpreadsheetUploading, setIsSpreadsheetUploading] = useState(false);
  const spreadsheetInputRef = useRef<HTMLInputElement | null>(null);
  const EV_TOLERANCE = 0.01;
  const safeTargetEVInput = Number.isFinite(targetEV) ? targetEV : 0.85;
  const clampedTargetEV = Math.min(1.5, Math.max(0.5, safeTargetEVInput));

  useEffect(() => {
      const supportQuery = query(
          collection(db, 'supportCases'),
          orderBy('lastUpdatedAt', 'desc')
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
      });

      return () => unsubscribe();
  }, []);

  useEffect(() => {
      const itemsQuery = query(collection(db, 'xpShopItems'), orderBy('sortOrder', 'asc'));
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
      });

      return () => unsubscribe();
  }, []);

  useEffect(() => {
      const redemptionsQuery = query(collection(db, 'xpRedemptions'), orderBy('createdAt', 'desc'));
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
      });

      return () => unsubscribe();
  }, []);

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
  const boxTagOptions = ['tech boxes', 'pokemon', 'digital codes', 'hot', 'deals'];
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

  const seedLedgerEntries = (profileId: string, index: number): LedgerEntry[] => {
      const now = Date.now();
      const base = now - (index + 1) * 1000 * 60 * 60 * 6;
      return [
          {
              id: makeId('ledger'),
              userId: profileId,
              type: 'deposit',
              amount: 250,
              createdAt: base - 1000 * 60 * 60,
              sourceId: `stripe-${profileId.slice(0, 6)}`,
              memo: 'Stripe top-up'
          },
          {
              id: makeId('ledger'),
              userId: profileId,
              type: 'case_open',
              amount: -45,
              createdAt: base - 1000 * 60 * 30,
              sourceId: `case-${profileId.slice(0, 6)}-open`,
              memo: 'Opened Neon Nexus Box'
          },
          {
              id: makeId('ledger'),
              userId: profileId,
              type: 'sell_back',
              amount: 82,
              createdAt: base - 1000 * 60 * 12,
              sourceId: `sell-${profileId.slice(0, 6)}`,
              memo: 'Sold inventory item'
          },
          {
              id: makeId('ledger'),
              userId: profileId,
              type: 'bonus',
              amount: 15,
              createdAt: base - 1000 * 60 * 5,
              sourceId: `promo-${profileId.slice(0, 6)}`,
              memo: 'Welcome promo credit'
          }
      ];
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
          history
      };
  };

  const shipmentRecords = useMemo(() => {
      return shipments.map((shipment, index) => {
          const shipmentUser = users.find((profile) => profile.id === shipment.uid);
          return {
              shipment,
              user: shipmentUser,
              key: shipment.id || `${shipment.uid}-${shipment.inventoryId ?? index}`
          };
      });
  }, [shipments, users]);

  const filteredShipments = shipmentRecords.filter(({ shipment }) => {
      if (shipmentFilter === 'processing') return shipment.status === 'shipping' || shipment.status === 'shipping_requested';
      if (shipmentFilter === 'shipped') return shipment.status === 'shipped';
      return true;
  });
  const stats = [
    { title: 'Total Coins', value: 124592, icon: CoinStatIcon, color: 'text-green-500', bg: 'bg-green-500/10', isCoin: true },
    { title: 'Active Users', value: '1,420', icon: Users, color: 'text-blue-500', bg: 'bg-blue-500/10' },
    { title: 'Battles Today', value: '843', icon: SwordsIcon, color: 'text-purple-500', bg: 'bg-purple-500/10' },
    { title: 'Server Load', value: '12%', icon: Activity, color: 'text-yellow-500', bg: 'bg-yellow-500/10' },
  ];

  useEffect(() => {
      if (users.length === 0) return;

      setSelectedUserId((current) => current ?? users[0].id);

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
          users.forEach((profile, index) => {
              next[profile.id] = profile.ledger ?? next[profile.id] ?? seedLedgerEntries(profile.id, index);
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
      setQuestRulesText(JSON.stringify((bonusSettings as any).questRules ?? [], null, 2));
  }, [bonusSettings]);

  useEffect(() => {
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
          });
      });
      return () => unsubscribe();
  }, []);

  const handleSaveRewardsSettings = async () => {
      try {
          const parsedRank = JSON.parse(rewardsDraft.rankRulesText || '[]');
          const parsedPoints = JSON.parse(rewardsDraft.pointsRulesText || '[]');
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
              }
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
                  limit(100)
              );
              const snapshot = await getDocs(leaderboardQuery);
              if (cancelled) return;
              const rows = snapshot.docs.map((docSnap, index) => {
                  const data = docSnap.data() as Record<string, any>;
                  const rank = index + 1;
                  return {
                      uid: docSnap.id,
                      displayName: String(data.displayName ?? data.name ?? 'Player'),
                      points: Number(data.points ?? 0),
                      rank,
                      rewardCoins: getRewardCoinsForRank(rank),
                      rewardApprovedAt: data.rewardApprovedAt == null ? undefined : Number(data.rewardApprovedAt)
                  } as LeaderboardApprovalEntry;
              });
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
                      rewardApprovedBy: user.id,
                      rewardApprovedCoins: winner.rewardCoins
                  }, { merge: true });
              });

              appendLedgerEntry(uid, {
                  id: makeId('ledger'),
                  userId: uid,
                  type: 'bonus',
                  amount: winner.rewardCoins,
                  createdAt: Date.now(),
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
          console.error('Failed to load economy settings', error);
          setEconomyDraft(DEFAULT_ECONOMY_SETTINGS);
      });

      return () => unsubscribe();
  }, []);

  useEffect(() => {
      if (!selectedUserId) return;
      const inventoryRef = collection(db, 'users', selectedUserId, 'inventory');
      const unsubscribe = onSnapshot(inventoryRef, (snapshot) => {
          const loaded = snapshot.docs
              .map((docSnap) => mapAdminInventoryDoc(docSnap.id, docSnap.data()))
              .sort((a, b) => b.obtainedAt - a.obtainedAt);
          setInventoryState((prev) => ({ ...prev, [selectedUserId]: loaded }));
      }, (error) => {
          console.error('Failed to load user inventory from Firebase', error);
      });

      return () => unsubscribe();
  }, [selectedUserId]);

  useEffect(() => {
      setStripeSettingsDraft({
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
      const normalized = tag.trim().toLowerCase();
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
          const category = item.category?.trim();
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

  const filteredItemsForBox = useMemo(() => {
      const normalizedBrand = itemBrandFilter.trim().toLowerCase();
      const normalizedCategory = itemCategoryFilter.trim().toLowerCase();
      const normalizedTagFilters = itemTagFilters.map((tag) => tag.toLowerCase());

      return items.filter((item) => {
          const brand = item.brand?.toLowerCase() ?? '';
          const category = item.category?.toLowerCase() ?? '';
          const tags = (item.tags ?? []).map((tag) => tag.toLowerCase());
          const matchesBrand = !normalizedBrand || brand === normalizedBrand;
          const matchesCategory = !normalizedCategory || category === normalizedCategory;
          const matchesTags = normalizedTagFilters.length === 0 || normalizedTagFilters.some((tag) => tags.includes(tag));
          return matchesBrand && matchesCategory && matchesTags;
      });
  }, [items, itemBrandFilter, itemCategoryFilter, itemTagFilters]);

  const handleSaveItem = async () => {
      if(!newItem.name || !newItem.price) return;
      const brand = newItem.brand?.trim() ?? '';
      const category = newItem.category?.trim() ?? '';
      const tags = normalizeTagList(newItem.tags ?? []);
      const sizes = normalizeSizeList(newItem.sizes ?? []);

      const item: CaseItem = {
          id: editingItemId || `custom-item-${Date.now()}`,
          name: newItem.name!,
          price: Number(newItem.price),
          image: newItem.image || 'https://picsum.photos/200',
          rarity: newItem.rarity as any || 'common',
          chance: Number(newItem.chance),
          color: newItem.color || '#9ca3af',
          brand,
          category,
          tags,
          sizes: sizes.length ? sizes : undefined,
          redeemable: newItem.redeemable ?? true
      };

      if (editingItemId) {
          await updateItem(item);
          alert("Item Updated!");
      } else {
          await createItem(item);
          alert("Item Created!");
      }
      resetItemForm();
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
          redeemable: item.redeemable ?? true
      });
      setItemTagInput('');
      setItemSizeInput('');
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
          redeemable: true
      });
      setItemTagInput('');
      setItemSizeInput('');
  };

  const resetPackageForm = () => {
      setEditingPackageId(null);
      setPackageDraft({
          name: '',
          coins: 0,
          bonusCoins: 0,
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
      const displayPrice = packageDraft.displayPrice?.trim() ?? '';
      const stripePriceId = packageDraft.stripePriceId?.trim() ?? '';
      const sortOrder = Number.isFinite(Number(packageDraft.sortOrder)) ? Number(packageDraft.sortOrder) : 0;
      const active = packageDraft.active ?? true;
      const badge = packageDraft.badge ?? undefined;

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
      if (!stripePriceId.startsWith('price_')) {
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

  const handleDeletePackage = async (id: string) => {
      if (!confirm('Delete this coin package? This cannot be undone.')) return;
      try {
          await deleteCoinPackage(id);
      } catch (error) {
          alert('Failed to delete package.');
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
                  redeemable: true
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

  const calculateBoxConfig = () => {
      if (selectedItems.length === 0) return;
      const baseSelection = selectedItems.map(item => ({ ...item, chance: 0 }));
      const baseItems = buildRiskAdjustedOdds(baseSelection, riskBalance);
      const baseEv = calculateExpectedValue(baseItems);
      const calculatedPrice = hasExplicitBoxPrice
        ? effectiveBoxPrice
        : baseEv / clampedTargetEV;
      const updatedItems = applyRarityOverrides(
          buildOddsWithRiskAndTargetEV(baseSelection, riskBalance, clampedTargetEV, calculatedPrice),
          selectedItems
      );

      // Apply updates
      setSelectedItems(updatedItems);
      setNewBox(prev => ({
          ...prev,
          [isXpBox ? 'priceXP' : 'price']: parseFloat(calculatedPrice.toFixed(2))
      }));
  };

  useEffect(() => {
      setSelectedItems((prev) => {
          if (prev.length === 0) return prev;

          const baseSelection = prev.map(item => ({ ...item, chance: 0 }));
          const baseItems = buildRiskAdjustedOdds(baseSelection, riskBalance);
          const baseEv = calculateExpectedValue(baseItems);
          const calculatedPrice = hasExplicitBoxPrice
            ? effectiveBoxPrice
            : baseEv / clampedTargetEV;
          const updatedItems = applyRarityOverrides(
              buildOddsWithRiskAndTargetEV(baseSelection, riskBalance, clampedTargetEV, calculatedPrice),
              prev
          );

          if (!hasExplicitBoxPrice) {
              setNewBox((current) => ({
                  ...current,
                  [isXpBox ? 'priceXP' : 'price']: parseFloat(calculatedPrice.toFixed(2))
              }));
          }

          return updatedItems;
      });
  }, [clampedTargetEV, effectiveBoxPrice, hasExplicitBoxPrice, isXpBox, riskBalance]);

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
      if (!selectedUserId) return;
      const name = inventoryDraft.name.trim();
      const price = Number(inventoryDraft.price);
      if (!name || !Number.isFinite(price)) return;
      const rarity = inventoryDraft.rarity as InventoryItem['rarity'];
      const now = Date.now();
      const instanceId = makeId('inv-instance');
      const newItem: InventoryItem = {
          id: makeId('inv'),
          instanceId,
          name,
          price,
          image: inventoryDraft.image.trim() || 'https://picsum.photos/200',
          rarity,
          chance: 0,
          color: rarityColorMap[rarity] ?? '#9ca3af',
          obtainedAt: now,
          status: inventoryDraft.status as InventoryItem['status'],
          locked: false,
          history: [
              {
                  id: makeId('history'),
                  action: 'added',
                  createdAt: now,
                  note: 'Added by admin',
                  adminUid: adminUser?.id ?? 'admin'
              }
          ]
      };

      try {
          await setDoc(doc(db, 'users', selectedUserId, 'inventory', instanceId), {
              name: newItem.name,
              value: newItem.price,
              image: newItem.image,
              rarity: newItem.rarity,
              status: newItem.status,
              obtainedAt: newItem.obtainedAt,
              locked: newItem.locked,
              history: newItem.history ?? [],
              provenance: newItem.provenance ?? null,
              redeemable: newItem.redeemable ?? true,
              sellBackRate: newItem.sellBackRate ?? 0
          });
      } catch (error) {
          console.error('Failed to add inventory item to Firebase', error);
      }

      updateInventoryRecords(selectedUserId, (items) => [newItem, ...items]);
      logAdminAction(
          selectedUserId,
          'inventory_add',
          {},
          { instanceId: newItem.instanceId, name: newItem.name, price: newItem.price },
          'Added inventory item'
      );
      setInventoryDraft({
          name: '',
          price: '',
          image: '',
          rarity: 'common',
          status: 'available'
      });
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
          const currentBalance = entries.reduce((sum, item) => sum + item.amount, 0);
          const entryWithBalance = {
              ...entry,
              balanceAfter: entry.balanceAfter ?? currentBalance + entry.amount
          };
          return [entryWithBalance, ...entries];
      });
  };

  const handleStatusChange = (targetUserId: string, nextStatus: UserStatus) => {
      const previousStatus = userStatuses[targetUserId] ?? 'active';
      setUserStatuses((prev) => ({ ...prev, [targetUserId]: nextStatus }));
      void updateUserAdminData(targetUserId, { status: nextStatus });
      logAdminAction(
          targetUserId,
          'status_update',
          { status: previousStatus },
          { status: nextStatus },
          `Status changed to ${nextStatus}`
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
      if (!selectedUserId) return;
      const amountValue = Number(reversalAmount);
      if (!amountValue || !reversalReason.trim()) return;
      const entry: LedgerEntry = {
          id: makeId('ledger'),
          userId: selectedUserId,
          type: 'reversal',
          amount: -Math.abs(amountValue),
          createdAt: Date.now(),
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
      if (!selectedUserId || !voidSourceId.trim()) return;
      const items = inventoryState[selectedUserId] ?? [];
      const impactedItems = items.filter((item) => item.provenance?.sourceId === voidSourceId.trim());
      const totalValue = impactedItems.reduce(
          (sum, item) => sum + toCoins(item.price, PRICE_UNIT_MODE),
          0
      );
      const entry: LedgerEntry = {
          id: makeId('ledger'),
          userId: selectedUserId,
          type: 'reversal',
          amount: totalValue === 0 ? 0 : -Math.abs(totalValue),
          createdAt: Date.now(),
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

  const selectedUser = useMemo(() => users.find((profile) => profile.id === selectedUserId), [users, selectedUserId]);
  const selectedLedgerEntries = selectedUserId ? ledgerEntries[selectedUserId] ?? [] : [];
  const selectedInventory = selectedUserId ? inventoryState[selectedUserId] ?? [] : [];
  const selectedAdminLogs = selectedUserId ? adminLogs[selectedUserId] ?? [] : [];
  const ledgerNetChange = selectedLedgerEntries.reduce((sum, entry) => sum + entry.amount, 0);
  const ledgerSearchValue = ledgerSearch.trim().toLowerCase();

  const timelineEntries = useMemo(() => {
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
          }))
      ];
      return entries.sort((a, b) => b.createdAt - a.createdAt);
  }, [selectedAdminLogs, selectedInventory, selectedLedgerEntries]);

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
          tags: [],
          sellBackRate: 0.82
      });
      window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSaveBox = () => {
      const allowsZeroPrice = Boolean(newBox.isDaily);
      if(!newBox.name || !hasExplicitBoxPrice) {
          alert("Please fill in box details");
          return;
      }
      if (effectiveBoxPrice < 0) {
          alert(isXpBox ? 'XP boxes cannot have a negative price.' : 'Boxes cannot have a negative coin price.');
          return;
      }
      if (effectiveBoxPrice === 0 && !allowsZeroPrice) {
          alert(isXpBox ? 'XP boxes require a positive XP price unless marked as a free daily box.' : 'Boxes require a positive coin price unless marked as a free daily box.');
          return;
      }
      
      if(selectedItems.length === 0) {
          alert("Select at least one item for the box");
          return;
      }
      const baseSelection = selectedItems.map(item => ({ ...item, chance: 0 }));
      const refreshedItems = applyRarityOverrides(
          buildOddsWithRiskAndTargetEV(
              baseSelection,
              riskBalance,
              clampedTargetEV,
              Number(effectiveBoxPrice)
          ),
          selectedItems
      );
      const refreshedOddsTotal = calculateOddsTotal(refreshedItems);
      const refreshedEv = calculateExpectedValue(refreshedItems);
      const refreshedEvRatio = effectiveBoxPrice > 0 ? refreshedEv / Number(effectiveBoxPrice) : 0;
      const refreshedOddsOutOfBounds = Math.abs(refreshedOddsTotal - 100) > 0.001;
      const refreshedEvOutOfBounds = effectiveBoxPrice > 0
        ? Math.abs(refreshedEvRatio - clampedTargetEV) > EV_TOLERANCE
        : false;

      setSelectedItems(refreshedItems);

      if (refreshedOddsOutOfBounds) {
          alert("Total odds must equal 100% before saving.");
          return;
      }
      if (refreshedEvOutOfBounds) {
          alert("Expected value is outside the allowed tolerance.");
          return;
      }

      // Clone items to decouple from global pool (ensuring box-specific chances)
      const boxItems = refreshedItems.map(i => ({...i}));
      
      // If setting as daily, unset others first (best effort approach)
      if (newBox.isDaily) {
          boxes.forEach(b => {
              if (b.isDaily && b.id !== (editingBoxId || '')) {
                  updateBox({ ...b, isDaily: false });
              }
          });
      }

      const box: MysteryBox = buildEditableBoxPayload(boxItems);

      if (editingBoxId) {
          updateBox(box);
          alert("Box Updated!");
      } else {
          createBox(box);
          alert("Box Created in Firebase!");
      }

      resetBoxForm();
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
          sellBackRate: box.sellBackRate ?? (box.isUserCreated ? 0.75 : 0.82)
      });
      setBoxTagInput('');
      setSelectedItems(box.items.map(i => ({...i})));
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
      const exists = selectedItems.find(i => i.id === item.id);
      if(exists) {
          setSelectedItems(prev => prev.filter(i => i.id !== item.id));
      } else {
          setSelectedItems(prev => [...prev, { ...item }]);
      }
  };

  const buildEditableBoxPayload = (items: CaseItem[]): MysteryBox => ({
      id: editingBoxId || '', // Empty ID tells createBox to addDoc
      name: newBox.name || '',
      price: isXpBox ? 0 : Number(newBox.price),
      priceXP: isXpBox ? Math.max(0, Math.floor(Number(newBox.priceXP ?? 0))) : undefined,
      currencyType: isXpBox ? 'XP' : 'COIN',
      image: newBox.image || 'https://picsum.photos/300',
      spinnerBackgroundImage: (newBox.spinnerBackgroundImage ?? '').trim(),
      accentColor: newBox.accentColor || '#3b82f6',
      tag: newBox.tag,
      tags: normalizeBoxTagList(newBox.tags ?? []),
      isDaily: newBox.isDaily,
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
      let parsedQuestRules: unknown[] = [];
      try {
          const parsed = JSON.parse(questRulesText || '[]');
          parsedQuestRules = Array.isArray(parsed) ? parsed : [];
      } catch {
          parsedQuestRules = [];
      }
      updateBonusSettings({ ...(bonusDraft as any), questRules: parsedQuestRules } as any);
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

  const handleSaveStripeSettings = () => {
      const rawRate = Number(stripeSettingsDraft.shippingFlatRateInput);
      const shippingFlatRateCents = Number.isFinite(rawRate) ? Math.max(0, Math.round(rawRate * 100)) : 0;
      updateStripeSettings({
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
          caseLabPublishFeeCoins: Math.max(0, Math.round(Number(stripeSettingsDraft.caseLabPublishFeeCoins) || 0)),
          caseLabSellBackPercent: Math.min(100, Math.max(0, Math.round(Number(stripeSettingsDraft.caseLabSellBackPercent) || 0))),
          caseLabVisibleBoxIds: Array.from(new Set(stripeSettingsDraft.caseLabVisibleBoxIds))
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
                     onClick={() => setActiveTab('legal')}
                     className={`flex items-center gap-3 px-3 py-2 rounded-lg font-medium text-sm transition-colors ${activeTab === 'legal' ? 'btn-logo-gradient text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}
                   >
                       <ScrollText className="w-4 h-4" /> Legal
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
                    {activeTab === 'support' && 'Support Inbox'}
                    {activeTab === 'bonuses' && 'Bonuses & XP'}
                    {activeTab === 'fees' && 'Fees & Shipping'}
                    {activeTab === 'homepage' && 'Homepage Showcase'}
                    {activeTab === 'boxes-page' && 'Boxes Page'}
                    {activeTab === 'case-lab' && 'Box Lab'}
                    {activeTab === 'legal' && 'Legal Content'}
                </h1>
                <p className="text-gray-400 text-sm">Welcome back, Administrator. System is operating normally.</p>
            </div>

            {/* TAB: DASHBOARD */}
            {activeTab === 'dashboard' && (
                <>
                    {/* Stats Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                        {stats.map((stat, idx) => (
                            <div key={idx} className="bg-[#131720] border border-gray-800 rounded-xl p-4">
                                <div className="flex items-start justify-between mb-4">
                                    <div className={`p-2 rounded-lg ${stat.bg}`}>
                                        <stat.icon className={`w-6 h-6 ${stat.color}`} />
                                    </div>
                                    <span className="text-xs font-bold text-green-500 bg-green-500/10 px-1.5 py-0.5 rounded">+4.5%</span>
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
                            {[1, 2, 3, 4, 5].map((i) => (
                                <div key={i} className="flex items-center justify-between py-2 border-b border-gray-800 last:border-0">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-2 h-2 rounded-full ${i % 2 === 0 ? 'bg-green-500' : 'bg-blue-500'}`}></div>
                                        <div>
                                            <div className="text-sm font-bold text-gray-200">
                                                {i % 2 === 0 ? 'Deposit' : 'Box Opening'}
                                            </div>
                                            <div className="text-xs text-gray-500">2 minutes ago</div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <CoinAmount
                                          amount={i % 2 === 0 ? 500 : -50}
                                          formatOptions={{ maximumFractionDigits: 0 }}
                                          showSign
                                          className={`text-sm font-bold ${i % 2 === 0 ? 'text-green-400' : 'text-white'}`}
                                          iconClassName="w-3.5 h-3.5"
                                        />
                                        <div className="text-xs text-gray-500">User_{1000 + i}</div>
                                    </div>
                                </div>
                            ))}
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
                            <Input type="number" placeholder="Price (coins)" className="bg-[#0b0e14] border border-gray-700 rounded p-2 text-white" value={newItem.price || ''} onChange={e => setNewItem({...newItem, price: Number(e.target.value)})} />
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
                            <Input type="number" placeholder="Chance % (0-100)" className="bg-[#0b0e14] border border-gray-700 rounded p-2 text-white" value={newItem.chance} onChange={e => setNewItem({...newItem, chance: Number(e.target.value)})} />
                            <label className="col-span-1 md:col-span-2 flex items-center gap-3 rounded-lg border border-gray-700 bg-[#0b0e14] px-3 py-2 text-sm text-gray-300">
                                <Checkbox
                                  checked={newItem.redeemable ?? true}
                                  onChange={(event) => setNewItem({ ...newItem, redeemable: event.target.checked })}
                                  className="h-4 w-4 rounded border-gray-600 bg-transparent text-emerald-500 focus:ring-emerald-400"
                                />
                                Redeemable (allow sell back)
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
                        <button onClick={handleSaveItem} className={`px-6 py-2 ${editingItemId ? 'bg-orange-600 hover:bg-orange-500' : 'btn-logo-gradient'} text-white font-bold rounded`}>
                            {editingItemId ? 'Update Item' : 'Add Item'}
                        </button>
                    </div>

                    {/* Item List */}
                    <div className="bg-[#131720] border border-gray-800 rounded-xl overflow-hidden">
                        <div className="flex flex-col gap-3 border-b border-gray-800 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <h3 className="text-lg font-bold text-white">Item Inventory</h3>
                                <p className="text-xs text-gray-400">
                                    Showing {Math.min(itemVisibleCount, filteredAdminItems.length)} of {filteredAdminItems.length} items. Scroll to load more.
                                </p>
                            </div>
                            <div className="w-full sm:w-64">
                                <Input
                                    value={itemSearchQuery}
                                    onChange={(event) => setItemSearchQuery(event.target.value)}
                                    placeholder="Search items, tags, sizes..."
                                    className="w-full bg-[#0b0e14] border border-gray-700 rounded p-2 text-sm text-white"
                                />
                            </div>
                        </div>
                        <div ref={itemListContainerRef} className="max-h-[520px] overflow-y-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-[#0b0e14] text-gray-400 font-medium">
                                    <tr>
                                        <th className="px-4 py-3">Item</th>
                                        <th className="px-4 py-3">Rarity</th>
                                        <th className="px-4 py-3">Price</th>
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
                                            <td colSpan={4} className="px-4 py-6 text-center text-sm text-gray-400">
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
                                      Tags power homepage filters. Max {MAX_BOX_TAGS} tags, {MAX_BOX_TAG_LENGTH} characters each.
                                    </p>
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
                                        className="w-full accent-brand-purple"
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
                                        className="w-4 h-4 rounded border-gray-700 bg-[#0b0e14] text-brand-purple focus:ring-brand-purple"
                                    />
                                    <label htmlFor="daily-case" className="text-sm text-gray-400 flex items-center gap-1">
                                        <Calendar className="w-3 h-3 text-yellow-500" /> Set as Daily Free Box
                                    </label>
                                </div>
                                <p className="text-[10px] text-gray-500">
                                    Daily free boxes can be saved with a price of 0.
                                </p>
                            </div>
                        </div>

                        {/* Middle: Item Selector & Auto-Calculator */}
                        <div className="mb-6 p-4 bg-[#0b0e14] rounded-lg border border-gray-800">
                             <div className="flex justify-between items-center mb-4">
                                 <h4 className="text-sm font-bold text-gray-400 uppercase">Available Items</h4>
                                 <button 
                                    onClick={calculateBoxConfig}
                                    disabled={selectedItems.length === 0}
                                    className="flex items-center gap-2 px-3 py-1.5 bg-brand-purple hover:bg-purple-600 disabled:opacity-50 text-white text-xs font-bold rounded shadow-lg shadow-purple-900/20"
                                 >
                                    <Calculator className="w-3 h-3" /> Auto-Calculate Odds & Price
                                 </button>
                             </div>

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
                                     <div className="flex items-end">
                                         <button
                                             type="button"
                                             onClick={() => {
                                                 setItemBrandFilter('');
                                                 setItemCategoryFilter('');
                                                 setItemTagFilters([]);
                                             }}
                                             className="w-full rounded border border-gray-700 px-3 py-2 text-[11px] font-semibold uppercase text-gray-400 transition hover:border-gray-500 hover:text-gray-200"
                                         >
                                             Clear Filters
                                         </button>
                                     </div>
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
                                                     className={`px-2 py-1.5 rounded border text-[11px] font-semibold uppercase tracking-wide transition ${isSelected ? 'bg-brand-purple/20 border-brand-purple text-purple-200' : 'bg-[#131720] border-gray-800 text-gray-400 hover:border-gray-600'}`}
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
                                            className={`p-2 rounded border cursor-pointer flex flex-col items-center gap-2 text-center transition-all ${isSelected ? 'bg-blue-600/10 border-blue-500' : 'bg-[#131720] border-gray-800 hover:border-gray-600'}`}
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
                                     <h4 className="text-sm font-bold text-gray-400 uppercase mb-2">Box Contents ({selectedItems.length})</h4>
                                     <div className="space-y-1">
                                         {selectedItems.map((item, idx) => (
                                             <div key={idx} className="flex flex-wrap items-center gap-2 text-xs bg-[#131720] p-2 rounded border border-gray-700">
                                                 <img src={item.image} alt={item.name} className="w-5 h-5 object-contain" />
                                                 <span className="min-w-[120px] flex-1 text-gray-300 truncate">{item.name}</span>
                                                 <CoinAmount
                                                   amount={toCoins(item.price, PRICE_UNIT_MODE)}
                                                   formatOptions={{ maximumFractionDigits: 0 }}
                                                   className="text-gray-500"
                                                   iconClassName="w-3 h-3"
                                                 />
                                                 <div className="flex items-center gap-1 bg-black/30 px-2 py-0.5 rounded">
                                                     <span className="text-gray-400">Chance:</span>
                                                     <span className="font-bold text-white">{item.chance}%</span>
                                                 </div>
                                                 <label className="relative">
                                                     <span className="sr-only">Item rarity for {item.name}</span>
                                                     <select
                                                         value={item.rarity}
                                                         onChange={(event) => handleSelectedItemRarityChange(item.id, event.target.value as CaseItem['rarity'])}
                                                         className="cursor-pointer rounded font-bold uppercase text-[10px] px-2 py-1 pr-6 border border-white/10 bg-black/30 focus:outline-none focus:ring-2 focus:ring-brand-purple"
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
                            <table className="w-full min-w-[900px] text-left text-sm">
                                <thead className="bg-[#0b0e14] text-gray-400 font-medium">
                                    <tr>
                                        <th className="px-4 py-3">Name</th>
                                        <th className="px-4 py-3">Base Coins</th>
                                        <th className="px-4 py-3">Bonus Coins</th>
                                        <th className="px-4 py-3">Total</th>
                                        <th className="px-4 py-3">Display Price</th>
                                        <th className="px-4 py-3">Stripe Price ID</th>
                                        <th className="px-4 py-3">Badge</th>
                                        <th className="px-4 py-3">Active</th>
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
                                                    <span className="rounded bg-black/30 px-2 py-1 font-mono">{pkg.stripePriceId}</span>
                                                </td>
                                                <td className="px-4 py-3 text-xs text-gray-300">
                                                    {pkg.badge ? (
                                                        <span className={`rounded-full px-2 py-1 font-semibold ${pkg.badge === 'best' ? 'bg-amber-500/20 text-amber-200' : 'bg-sky-500/20 text-sky-200'}`}>
                                                            {pkg.badge === 'best' ? 'Best value' : 'Good value'}
                                                        </span>
                                                    ) : (
                                                        <span className="text-gray-500">—</span>
                                                    )}
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
                                                <td className="px-4 py-3 text-gray-300">{pkg.sortOrder}</td>
                                                <td className="px-4 py-3 text-gray-400 text-xs">
                                                    {pkg.updatedAt ? formatTimestamp(pkg.updatedAt) : '--'}
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    <div className="flex justify-end gap-2">
                                                        <button
                                                            onClick={() => handleEditPackage(pkg)}
                                                            className="p-1.5 hover:bg-blue-500/10 text-blue-400 rounded transition-colors"
                                                        >
                                                            <Edit2 className="w-4 h-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeletePackage(pkg.id)}
                                                            className="p-1.5 hover:bg-red-500/10 text-red-400 rounded transition-colors"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={11} className="px-4 py-6 text-center text-gray-500 text-sm">
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
                    <div className="bg-[#131720] border border-gray-800 rounded-xl overflow-hidden">
                        <div className="hidden md:block overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-[#0b0e14] text-gray-400 font-medium border-b border-gray-800">
                                    <tr>
                                        <th className="px-6 py-4">User</th>
                                        <th className="px-6 py-4">Level</th>
                                        <th className="px-6 py-4">XP</th>
                                        <th className="px-6 py-4">Status</th>
                                        <th className="px-6 py-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-800">
                                    {users.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="px-6 py-6 text-center text-gray-500">
                                                No users found in Firebase.
                                            </td>
                                        </tr>
                                    ) : (
                                        users.map((profile) => {
                                            const isEditing = editingUserId === profile.id;
                                            const progress = calculateLevelProgress(isEditing ? userXpInput : (profile.xp || 0));
                                            const status = userStatuses[profile.id] ?? 'active';
                                            return (
                                                <tr key={profile.id} className="hover:bg-[#1a2130] transition-colors">
                                                    <td className="px-6 py-4 flex items-center gap-3">
                                                        <img src={profile.avatar} alt={`${profile.name} avatar`} className="w-8 h-8 rounded-full" />
                                                        <span className="font-bold text-white">{profile.name}</span>
                                                    </td>
                                                    <td className="px-6 py-4 text-gray-400">XP {(profile.xpBalance ?? profile.xp ?? 0).toLocaleString()}</td>
                                                    <td className="px-6 py-4 text-gray-400">
                                                        {isEditing ? (
                                                            <div className="space-y-1">
                                                                <Input
                                                                    type="number"
                                                                    value={userXpInput}
                                                                    onChange={(e) => setUserXpInput(Number(e.target.value))}
                                                                    className="w-32 bg-[#0b0e14] border border-gray-700 rounded px-3 py-1.5 text-white text-sm"
                                                                />
                                                                <div className="text-[11px] text-gray-500">XP after save: {Math.max(0, Math.floor(userXpInput)).toLocaleString()}</div>
                                                            </div>
                                                        ) : (
                                                            <span className="text-gray-300">{profile.xp ?? 0}</span>
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <span className={`px-2 py-1 rounded text-xs font-bold ${
                                                            status === 'active'
                                                                ? 'bg-green-500/10 text-green-500'
                                                                : status === 'suspended'
                                                                    ? 'bg-yellow-500/10 text-yellow-400'
                                                                    : 'bg-red-500/10 text-red-400'
                                                        }`}>
                                                            {status}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="flex justify-end gap-3">
                                                            {isEditing ? (
                                                                <>
                                                                    <button
                                                                        onClick={() => saveUserProgress(profile.id)}
                                                                        disabled={isSavingUser}
                                                                        className="text-green-400 hover:text-green-300 font-bold text-xs disabled:opacity-50"
                                                                    >
                                                                        {isSavingUser ? 'Saving...' : 'Save'}
                                                                    </button>
                                                                    <button
                                                                        onClick={cancelEditUser}
                                                                        className="text-gray-400 hover:text-gray-300 font-bold text-xs"
                                                                    >
                                                                        Cancel
                                                                    </button>
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <button
                                                                        className="text-blue-400 hover:text-blue-300 font-bold text-xs"
                                                                        onClick={() => startEditUser(profile.id, profile.xp || 0)}
                                                                    >
                                                                        Edit XP
                                                                    </button>
                                                                    <button
                                                                        className="text-purple-400 hover:text-purple-300 font-bold text-xs"
                                                                        onClick={() => setSelectedUserId(profile.id)}
                                                                    >
                                                                        View
                                                                    </button>
                                                                    <button
                                                                        className="text-red-400 hover:text-red-300 font-bold text-xs disabled:opacity-50"
                                                                        onClick={() => handleDeleteUser(profile.id)}
                                                                        disabled={deletingUserId === profile.id}
                                                                    >
                                                                        {deletingUserId === profile.id ? 'Deleting...' : 'Delete'}
                                                                    </button>
                                                                </>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>

                        <div className="grid grid-cols-1 gap-4 p-4 md:hidden">
                            {users.length === 0 ? (
                                <div className="px-6 py-6 text-center text-gray-500">
                                    No users found in Firebase.
                                </div>
                            ) : (
                                users.map((profile) => {
                                    const status = userStatuses[profile.id] ?? 'active';
                                    const isEditing = editingUserId === profile.id;
                                    return (
                                        <div key={profile.id} className="bg-[#0b0e14] border border-gray-800 rounded-xl p-4 space-y-3">
                                            <div className="flex items-center gap-3">
                                                <img src={profile.avatar} alt={`${profile.name} avatar`} className="w-10 h-10 rounded-full" />
                                                <div className="flex-1">
                                                    <div className="text-white font-bold">{profile.name}</div>
                                                    <div className="text-xs text-gray-400">XP {(profile.xpBalance ?? profile.xp ?? 0).toLocaleString()}</div>
                                                </div>
                                                <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${
                                                    status === 'active'
                                                        ? 'bg-green-500/10 text-green-500'
                                                        : status === 'suspended'
                                                            ? 'bg-yellow-500/10 text-yellow-400'
                                                            : 'bg-red-500/10 text-red-400'
                                                }`}>
                                                    {status}
                                                </span>
                                            </div>
                                            <div className="text-xs text-gray-400">
                                                XP: <span className="text-gray-200">{profile.xp ?? 0}</span>
                                            </div>
                                            {isEditing && (
                                                <div className="space-y-2">
                                                    <Input
                                                        type="number"
                                                        value={userXpInput}
                                                        onChange={(e) => setUserXpInput(Number(e.target.value))}
                                                        className="w-full bg-[#131720] border border-gray-700 rounded px-3 py-2 text-white text-sm"
                                                    />
                                                    <div className="flex gap-3">
                                                        <button
                                                            onClick={() => saveUserProgress(profile.id)}
                                                            disabled={isSavingUser}
                                                            className="text-green-400 text-xs font-bold disabled:opacity-50"
                                                        >
                                                            {isSavingUser ? 'Saving...' : 'Save'}
                                                        </button>
                                                        <button
                                                            onClick={cancelEditUser}
                                                            className="text-gray-400 text-xs font-bold"
                                                        >
                                                            Cancel
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                            {!isEditing && (
                                                <div className="flex flex-wrap gap-2">
                                                    <button
                                                        className="px-3 py-1.5 rounded-lg bg-blue-600/20 text-blue-300 text-xs font-semibold"
                                                        onClick={() => startEditUser(profile.id, profile.xp || 0)}
                                                    >
                                                        Edit XP
                                                    </button>
                                                    <button
                                                        className="px-3 py-1.5 rounded-lg bg-purple-600/20 text-purple-300 text-xs font-semibold"
                                                        onClick={() => setSelectedUserId(profile.id)}
                                                    >
                                                        View
                                                    </button>
                                                    <button
                                                        className="px-3 py-1.5 rounded-lg bg-red-600/20 text-red-300 text-xs font-semibold disabled:opacity-50"
                                                        onClick={() => handleDeleteUser(profile.id)}
                                                        disabled={deletingUserId === profile.id}
                                                    >
                                                        {deletingUserId === profile.id ? 'Deleting...' : 'Delete'}
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>

                    {selectedUser ? (
                        <div className="space-y-6">
                            <div className="bg-[#131720] border border-gray-800 rounded-xl p-6">
                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                                    <div className="flex items-center gap-4">
                                        <img src={selectedUser.avatar} alt={`${selectedUser.name} avatar`} className="w-12 h-12 rounded-full" />
                                        <div>
                                            <div className="text-white text-lg font-bold">{selectedUser.name}</div>
                                            <div className="text-xs text-gray-400">{selectedUser.email || 'No email on file'}</div>
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        <span className="px-3 py-1 rounded-full bg-[#0b0e14] text-xs text-gray-400 inline-flex items-center gap-2">
                                            Coins:
                                            <CoinAmount
                                              amount={selectedUser.balance ?? 0}
                                              formatOptions={{ maximumFractionDigits: 0 }}
                                              className="text-green-400 font-semibold"
                                              iconClassName="w-3 h-3"
                                            />
                                        </span>
                                        <span className="px-3 py-1 rounded-full bg-[#0b0e14] text-xs text-gray-400">
                                            Inventory: <span className="text-gray-200 font-semibold">{selectedInventory.length}</span>
                                        </span>
                                        <span className="px-3 py-1 rounded-full bg-[#0b0e14] text-xs text-gray-400">
                                            Ledger entries: <span className="text-gray-200 font-semibold">{selectedLedgerEntries.length}</span>
                                        </span>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        <button
                                            onClick={startBalanceEdit}
                                            className="px-3 py-2 rounded-lg bg-green-500/10 text-green-300 text-xs font-semibold"
                                        >
                                            Edit Balance
                                        </button>
                                        <button
                                            onClick={() => setIsEditingInventory((prev) => !prev)}
                                            className="px-3 py-2 rounded-lg bg-blue-500/10 text-blue-300 text-xs font-semibold"
                                        >
                                            {isEditingInventory ? 'Done Editing Inventory' : 'Edit Inventory'}
                                        </button>
                                        <button
                                            onClick={() => handleDeleteUser(selectedUser.id)}
                                            disabled={deletingUserId === selectedUser.id}
                                            className="px-3 py-2 rounded-lg bg-red-500/10 text-red-300 text-xs font-semibold disabled:opacity-50"
                                        >
                                            {deletingUserId === selectedUser.id ? 'Deleting...' : 'Delete User'}
                                        </button>
                                    </div>
                                </div>
                                {isEditingBalance && (
                                    <div className="mt-4 bg-[#0b0e14] border border-gray-800 rounded-lg p-4 flex flex-col sm:flex-row gap-3 sm:items-center">
                                        <div className="flex-1">
                                            <label className="block text-[10px] uppercase text-gray-500 font-bold mb-2">Set Coin Balance</label>
                                            <Input
                                                type="number"
                                                value={balanceDraft}
                                                onChange={(event) => setBalanceDraft(event.target.value)}
                                                className="w-full bg-[#131720] border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200"
                                            />
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={saveBalanceEdit}
                                                className="px-3 py-2 rounded-lg bg-green-500/20 text-green-300 text-xs font-semibold"
                                            >
                                                Save Balance
                                            </button>
                                            <button
                                                onClick={cancelBalanceEdit}
                                                className="px-3 py-2 rounded-lg bg-gray-700/40 text-gray-200 text-xs font-semibold"
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                                <div className="space-y-6">
                                    <div className="bg-[#131720] border border-gray-800 rounded-xl p-5">
                                        <div className="flex items-center gap-2 mb-4">
                                            <UserCog className="w-4 h-4 text-blue-400" />
                                            <h3 className="text-sm font-bold text-white">Status & Locks</h3>
                                        </div>
                                        <div className="space-y-4">
                                            <div>
                                                <label className="block text-[10px] uppercase text-gray-500 font-bold mb-2">Account Status</label>
                                                <Select
                                                    value={userStatuses[selectedUser.id] ?? 'active'}
                                                    onChange={(event) => handleStatusChange(selectedUser.id, event.target.value as UserStatus)}
                                                    className="w-full bg-[#0b0e14] border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200"
                                                >
                                                    <option value="active">Active</option>
                                                    <option value="suspended">Suspended</option>
                                                    <option value="banned">Banned</option>
                                                </Select>
                                            </div>
                                            <div>
                                                <label className="block text-[10px] uppercase text-gray-500 font-bold mb-2">Risk Locks</label>
                                                <div className="space-y-2">
                                                    {Object.entries(LOCK_LABELS).map(([key, label]) => {
                                                        const isLocked = userLocks[selectedUser.id]?.[key as keyof UserLocks];
                                                        return (
                                                            <button
                                                                key={key}
                                                                onClick={() => handleLockToggle(selectedUser.id, key as keyof UserLocks)}
                                                                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg border text-sm ${
                                                                    isLocked
                                                                        ? 'bg-red-500/10 border-red-500/40 text-red-300'
                                                                        : 'bg-[#0b0e14] border-gray-700 text-gray-300'
                                                                }`}
                                                            >
                                                                <span>{label}</span>
                                                                {isLocked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="bg-[#131720] border border-gray-800 rounded-xl p-5">
                                        <div className="flex items-center gap-2 mb-4">
                                            <ShieldCheck className="w-4 h-4 text-green-400" />
                                            <h3 className="text-sm font-bold text-white">Fix Tools</h3>
                                        </div>
                                        <div className="space-y-4">
                                            <div className="space-y-2">
                                                <label className="block text-[10px] uppercase text-gray-500 font-bold">Reversal Entry</label>
                                                <Input
                                                    type="number"
                                                    value={reversalAmount}
                                                    onChange={(event) => setReversalAmount(event.target.value)}
                                                    placeholder="Amount to reverse"
                                                    className="w-full bg-[#0b0e14] border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200"
                                                />
                                                <Textarea
                                                    value={reversalReason}
                                                    onChange={(event) => setReversalReason(event.target.value)}
                                                    rows={2}
                                                    placeholder="Reason for reversal"
                                                    className="w-full bg-[#0b0e14] border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200"
                                                />
                                                <button
                                                    onClick={handleCreateReversal}
                                                    disabled={!reversalAmount || !reversalReason.trim()}
                                                    className="w-full px-3 py-2 rounded-lg bg-red-500/20 text-red-300 text-xs font-bold uppercase disabled:opacity-50"
                                                >
                                                    Create Reversal Entry
                                                </button>
                                            </div>
                                            <div className="border-t border-gray-800 pt-4 space-y-2">
                                                <label className="block text-[10px] uppercase text-gray-500 font-bold">Void Box Open</label>
                                                <Input
                                                    type="text"
                                                    value={voidSourceId}
                                                    onChange={(event) => setVoidSourceId(event.target.value)}
                                                    placeholder="Box open ID"
                                                    className="w-full bg-[#0b0e14] border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200"
                                                />
                                                <Textarea
                                                    value={voidReason}
                                                    onChange={(event) => setVoidReason(event.target.value)}
                                                    rows={2}
                                                    placeholder="Void reason"
                                                    className="w-full bg-[#0b0e14] border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200"
                                                />
                                                <button
                                                    onClick={handleVoidOpen}
                                                    disabled={!voidSourceId.trim()}
                                                    className="w-full px-3 py-2 rounded-lg bg-yellow-500/20 text-yellow-300 text-xs font-bold uppercase disabled:opacity-50"
                                                >
                                                    Void Open & Compensate
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="xl:col-span-2 space-y-6">
                                    <div className="bg-[#131720] border border-gray-800 rounded-xl p-5">
                                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                                            <div className="flex items-center gap-2">
                                                <ScrollText className="w-4 h-4 text-purple-400" />
                                                <h3 className="text-sm font-bold text-white">Immutable Coin Ledger</h3>
                                            </div>
                                            <div className="flex flex-wrap gap-2 text-[11px]">
                                                <span className="px-2 py-1 rounded-full bg-[#0b0e14] text-gray-400">
                                                    Entries: <span className="text-gray-200 font-semibold">{selectedLedgerEntries.length}</span>
                                                </span>
                                                <span className="px-2 py-1 rounded-full bg-[#0b0e14] text-gray-400">
                                                    Net:{' '}
                                                    <CoinAmount
                                                      amount={ledgerNetChange}
                                                      formatOptions={{ maximumFractionDigits: 0 }}
                                                      showSign
                                                      className={ledgerNetChange >= 0 ? 'text-green-400 font-semibold' : 'text-red-400 font-semibold'}
                                                      iconClassName="w-3.5 h-3.5"
                                                    />
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex flex-col md:flex-row gap-3 mb-4">
                                            <Select
                                                value={ledgerFilter}
                                                onChange={(event) => setLedgerFilter(event.target.value as 'all' | LedgerEntryType)}
                                                className="w-full md:w-48 bg-[#0b0e14] border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200"
                                            >
                                                <option value="all">All entry types</option>
                                                <option value="deposit">Deposit</option>
                                                <option value="case_open">Box open</option>
                                                <option value="sell_back">Sell back</option>
                                                <option value="bonus">Bonus</option>
                                                <option value="admin_adjustment">Admin adjustment</option>
                                                <option value="chargeback_reversal">Chargeback reversal</option>
                                                <option value="reversal">Reversal</option>
                                            </Select>
                                            <Input
                                                type="text"
                                                value={ledgerSearch}
                                                onChange={(event) => setLedgerSearch(event.target.value)}
                                                placeholder="Search memo or source ID"
                                                className="w-full bg-[#0b0e14] border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200"
                                            />
                                        </div>
                                        <div className="space-y-3">
                                            {filteredLedgerEntries.length === 0 ? (
                                                <div className="text-sm text-gray-500">No ledger entries yet.</div>
                                            ) : (
                                                filteredLedgerEntries.map((entry) => (
                                                    <div key={entry.id} className="bg-[#0b0e14] border border-gray-800 rounded-lg p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                                                        <div>
                                                            <div className="text-xs text-gray-400 uppercase">{entry.type.replace('_', ' ')}</div>
                                                            <div className="text-sm text-gray-200 font-semibold">{entry.memo || 'Balance update'}</div>
                                                            <div className="text-[11px] text-gray-500">
                                                                {entry.sourceId || 'Manual entry'} • {formatTimestamp(entry.createdAt)}
                                                                {entry.balanceAfter !== undefined && (
                                                                    <span className="text-gray-400 inline-flex items-center gap-1">
                                                                      • Balance
                                                                      <CoinAmount
                                                                        amount={entry.balanceAfter}
                                                                        formatOptions={{ maximumFractionDigits: 0 }}
                                                                        className="text-gray-400 font-semibold"
                                                                        iconClassName="w-3 h-3"
                                                                      />
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <CoinAmount
                                                          amount={entry.amount}
                                                          formatOptions={{ maximumFractionDigits: 0 }}
                                                          showSign
                                                          className={`text-sm font-bold ${entry.amount >= 0 ? 'text-green-400' : 'text-red-400'}`}
                                                          iconClassName="w-3.5 h-3.5"
                                                        />
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </div>

                                    <div className="bg-[#131720] border border-gray-800 rounded-xl p-5">
                                        <div className="flex items-center gap-2 mb-4">
                                            <Package className="w-4 h-4 text-blue-400" />
                                            <h3 className="text-sm font-bold text-white">Inventory Locks & Provenance</h3>
                                        </div>
                                        {isEditingInventory && (
                                            <div className="mb-4 bg-[#0b0e14] border border-gray-800 rounded-lg p-4 space-y-3">
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                    <div>
                                                        <label className="block text-[10px] uppercase text-gray-500 font-bold mb-2">Item name</label>
                                                        <Input
                                                            type="text"
                                                            value={inventoryDraft.name}
                                                            onChange={(event) => setInventoryDraft((prev) => ({ ...prev, name: event.target.value }))}
                                                            className="w-full bg-[#131720] border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-[10px] uppercase text-gray-500 font-bold mb-2">Value</label>
                                                        <Input
                                                            type="number"
                                                            value={inventoryDraft.price}
                                                            onChange={(event) => setInventoryDraft((prev) => ({ ...prev, price: event.target.value }))}
                                                            className="w-full bg-[#131720] border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-[10px] uppercase text-gray-500 font-bold mb-2">Image URL</label>
                                                        <Input
                                                            type="text"
                                                            value={inventoryDraft.image}
                                                            onChange={(event) => setInventoryDraft((prev) => ({ ...prev, image: event.target.value }))}
                                                            className="w-full bg-[#131720] border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-[10px] uppercase text-gray-500 font-bold mb-2">Rarity</label>
                                                        <Select
                                                            value={inventoryDraft.rarity}
                                                            onChange={(event) => setInventoryDraft((prev) => ({ ...prev, rarity: event.target.value }))}
                                                            className="w-full bg-[#131720] border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200"
                                                        >
                                                            {rarityColorOptions.map((option) => (
                                                                <option key={option.value} value={option.value}>{option.label}</option>
                                                            ))}
                                                        </Select>
                                                    </div>
                                                    <div>
                                                        <label className="block text-[10px] uppercase text-gray-500 font-bold mb-2">Status</label>
                                                        <Select
                                                            value={inventoryDraft.status}
                                                            onChange={(event) => setInventoryDraft((prev) => ({ ...prev, status: event.target.value }))}
                                                            className="w-full bg-[#131720] border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200"
                                                        >
                                                            <option value="available">Available</option>
                                                            <option value="shipping_requested">Shipping requested</option>
                                                            <option value="shipping">Shipping</option>
                                                            <option value="shipped">Shipped</option>
                                                        </Select>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={handleAddInventoryItem}
                                                    className="w-full sm:w-auto px-3 py-2 rounded-lg bg-blue-500/20 text-blue-300 text-xs font-semibold"
                                                >
                                                    Add inventory item
                                                </button>
                                            </div>
                                        )}
                                        <div className="space-y-3">
                                            {selectedInventory.length === 0 ? (
                                                <div className="text-sm text-gray-500">No inventory items available.</div>
                                            ) : (
                                                selectedInventory.map((item) => (
                                                    <div key={item.instanceId} className="bg-[#0b0e14] border border-gray-800 rounded-lg p-3 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                                                        <div className="flex items-start gap-3">
                                                            <img src={item.image} alt={item.name} className="w-10 h-10 rounded-lg bg-[#131720] object-contain" />
                                                            <div>
                                                                <div className="text-sm text-white font-semibold">{item.name}</div>
                                                                <div className="text-xs text-gray-500">
                                                                    {item.provenance ? `From ${item.provenance.sourceType} (${item.provenance.sourceId})` : 'Provenance unknown'}
                                                                </div>
                                                                <div className="text-[10px] text-gray-500 mt-1">Status: {item.status}</div>
                                                            </div>
                                                        </div>
                                                        <div className="flex flex-col sm:flex-row gap-2">
                                                            <button
                                                                onClick={() => handleInventoryLockToggle(selectedUser.id, item.instanceId)}
                                                                className={`px-3 py-2 rounded-lg text-xs font-bold uppercase ${
                                                                    item.locked
                                                                        ? 'bg-red-500/20 text-red-300'
                                                                        : 'bg-[#131720] text-gray-300 border border-gray-700'
                                                                }`}
                                                            >
                                                                {item.locked ? 'Unlock' : 'Lock'}
                                                            </button>
                                                            {isEditingInventory && (
                                                                <button
                                                                    onClick={() => handleRemoveInventoryItem(selectedUser.id, item.instanceId)}
                                                                    className="px-3 py-2 rounded-lg text-xs font-bold uppercase bg-red-500/20 text-red-300"
                                                                >
                                                                    Remove
                                                                </button>
                                                            )}
                                                            <div className="text-[10px] text-gray-500">
                                                                {(item.history ?? []).slice(0, 2).map((history) => (
                                                                    <div key={history.id}>
                                                                        {history.action.replace('_', ' ')} • {formatTimestamp(history.createdAt)}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </div>

                                    <div className="bg-[#131720] border border-gray-800 rounded-xl p-5">
                                        <div className="flex items-center gap-2 mb-4">
                                            <ShieldAlert className="w-4 h-4 text-red-400" />
                                            <h3 className="text-sm font-bold text-white">Admin Action Log</h3>
                                        </div>
                                        <div className="space-y-3">
                                            {selectedAdminLogs.length === 0 ? (
                                                <div className="text-sm text-gray-500">No admin actions recorded.</div>
                                            ) : (
                                                selectedAdminLogs.map((log) => (
                                                    <div key={log.id} className="bg-[#0b0e14] border border-gray-800 rounded-lg p-3">
                                                        <div className="text-xs text-gray-400 uppercase">{log.actionType.replace('_', ' ')}</div>
                                                        <div className="text-sm text-gray-200 font-semibold">{log.reason}</div>
                                                        <div className="text-[11px] text-gray-500">Admin {log.adminUid} • {formatTimestamp(log.createdAt)}</div>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </div>

                                    <div className="bg-[#131720] border border-gray-800 rounded-xl p-5">
                                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                                            <div className="flex items-center gap-2">
                                                <Activity className="w-4 h-4 text-green-400" />
                                                <h3 className="text-sm font-bold text-white">Unified User Timeline</h3>
                                            </div>
                                            <div className="text-[11px] text-gray-500">
                                                Showing <span className="text-gray-200 font-semibold">{Math.min(filteredTimelineEntries.length, 15)}</span> of <span className="text-gray-200 font-semibold">{filteredTimelineEntries.length}</span>
                                            </div>
                                        </div>
                                        <div className="flex flex-col md:flex-row gap-3 mb-4">
                                            <div className="flex flex-wrap gap-2">
                                                {(['all', 'ledger', 'inventory', 'admin'] as const).map((filter) => (
                                                    <button
                                                        key={filter}
                                                        onClick={() => setTimelineFilter(filter)}
                                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition-colors ${
                                                            timelineFilter === filter
                                                                ? 'bg-green-500/20 text-green-300'
                                                                : 'bg-[#0b0e14] text-gray-400 hover:text-white hover:bg-gray-800'
                                                        }`}
                                                    >
                                                        {filter === 'all' ? 'All' : filter}
                                                    </button>
                                                ))}
                                            </div>
                                            <Input
                                                type="text"
                                                value={timelineSearch}
                                                onChange={(event) => setTimelineSearch(event.target.value)}
                                                placeholder="Search timeline details"
                                                className="w-full bg-[#0b0e14] border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200"
                                            />
                                        </div>
                                        <div className="space-y-3">
                                            {filteredTimelineEntries.length === 0 ? (
                                                <div className="text-sm text-gray-500">No timeline events available.</div>
                                            ) : (
                                                filteredTimelineEntries.slice(0, 15).map((entry) => (
                                                    <div key={entry.id} className="bg-[#0b0e14] border border-gray-800 rounded-lg p-3">
                                                        <div className="text-sm text-gray-200 font-semibold">{entry.title}</div>
                                                        <div className="text-xs text-gray-400">{entry.description}</div>
                                                        <div className="text-[11px] text-gray-500">
                                                            {entry.meta ? `${entry.meta} • ` : ''}{formatTimestamp(entry.createdAt)}
                                                        </div>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-[#131720] border border-gray-800 rounded-xl p-6 text-sm text-gray-500">
                            Select a user to review ledger activity, locks, and admin actions.
                        </div>
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

                    {filteredShipments.length === 0 ? (
                        <div className="bg-[#131720] border border-gray-800 rounded-xl p-8 text-center text-gray-500">
                            No shipment requests match this filter.
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            {filteredShipments.map(({ user: shipmentUser, shipment, key }) => {
                                const address = shipment.shippingInfo ?? shipmentUser?.shippingAddress;
                                const canUpdate = Boolean(shipment.id);
                                const trackingKey = shipment.id || key;
                                const trackingValue = shipmentTracking[trackingKey] ?? shipment.trackingNumber ?? '';
                                const shipmentItem = shipment.item ?? ({ name: 'Mystery Item', value: 0, image: 'https://picsum.photos/200', rarity: 'common' } as Shipment['item']);
                                const displayName = shipmentUser?.name ?? address?.fullName ?? 'Unknown user';
                                const displayEmail = shipmentUser?.email || 'No email on file';
                                return (
                                    <div key={key} className="bg-[#131720] border border-gray-800 rounded-xl p-5 flex flex-col gap-4">
                                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                                            <div className="flex items-center gap-3">
                                                <img src={shipmentItem.image} alt={shipmentItem.name} className="w-12 h-12 rounded-lg bg-[#0b0e14] object-contain" />
                                                <div>
                                                    <div className="text-white font-bold">{shipmentItem.name}</div>
                                                    <CoinAmount
                                                      amount={toCoins(shipmentItem.value, PRICE_UNIT_MODE)}
                                                      formatOptions={{ maximumFractionDigits: 0 }}
                                                      className="text-xs text-green-400 font-semibold"
                                                      iconClassName="w-3 h-3"
                                                    />
                                                    {shipmentItem.size && (
                                                        <div className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-blue-200">
                                                            Size: {shipmentItem.size}
                                                        </div>
                                                    )}
                                                    <div className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full mt-1 ${
                                                        shipment.status === 'shipped'
                                                            ? 'bg-green-500/10 text-green-400'
                                                            : 'bg-yellow-500/10 text-yellow-400'
                                                    }`}>
                                                        {shipment.status === 'shipped' ? <PackageCheck className="w-3 h-3" /> : <Truck className="w-3 h-3" />}
                                                        {shipment.status === 'shipped' ? 'Shipped' : 'Processing'}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="text-sm text-gray-300 sm:text-right">
                                                <div className="font-semibold">{displayName}</div>
                                                <div className="text-xs text-gray-500 break-all">{displayEmail}</div>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="bg-[#0b0e14] border border-gray-800 rounded-lg p-3 text-xs text-gray-400 space-y-1">
                                                <div className="text-[10px] uppercase font-bold text-gray-500">Shipping Address</div>
                                                {address ? (
                                                    <>
                                                        <div className="text-gray-200 font-semibold">{address.fullName}</div>
                                                        <div>{address.street}</div>
                                                        <div>{address.city}, {address.state} {address.zipCode}</div>
                                                        <div>{address.country}</div>
                                                    </>
                                                ) : (
                                                    <div className="text-yellow-400">No address saved.</div>
                                                )}
                                            </div>
                                            <div className="bg-[#0b0e14] border border-gray-800 rounded-lg p-3 text-xs text-gray-400 flex flex-col gap-3">
                                                <div className="text-[10px] uppercase font-bold text-gray-500">Shipment Actions</div>
                                                <div className="text-gray-500">Instance ID: <span className="text-gray-300">{shipment.inventoryId || 'Unavailable'}</span></div>
                                                <label className="text-[10px] uppercase font-bold text-gray-500">Tracking number</label>
                                                <Input
                                                    type="text"
                                                    value={trackingValue}
                                                    onChange={(event) =>
                                                        setShipmentTracking((prev) => ({
                                                            ...prev,
                                                            [trackingKey]: event.target.value
                                                        }))
                                                    }
                                                    placeholder="Enter tracking number"
                                                    className="w-full bg-[#131720] border border-gray-700 rounded-lg px-3 py-2 text-xs text-gray-200"
                                                />
                                                <button
                                                    onClick={() =>
                                                        updateShipmentStatus(
                                                            shipment.id,
                                                            shipment.uid,
                                                            shipment.inventoryId,
                                                            'shipped',
                                                            trackingValue
                                                        )
                                                    }
                                                    disabled={shipment.status === 'shipped' || !canUpdate}
                                                    className="w-full sm:w-auto px-4 py-2 bg-green-600 hover:bg-green-500 text-white text-xs font-bold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    Mark as shipped
                                                </button>
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
                                                                    ? 'bg-purple-500/10 text-purple-100'
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
                    <div className="bg-[#131720] border border-gray-800 rounded-xl p-6">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                            <div>
                                <h3 className="text-lg font-bold text-white">XP Earn & Bonuses</h3>
                                <p className="text-sm text-gray-400">
                                    Tune how players earn XP points and configure reward modifiers. All values are admin-controlled.
                                </p>
                            </div>
                            <div className="text-xs text-gray-500 bg-[#0b0e14] border border-gray-800 rounded-lg px-3 py-2">
                                XP reward rules
                            </div>
                        </div>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">XP per 100 coins wagered</label>
                                    <Input
                                        type="number"
                                        min={0}
                                        step={1}
                                        value={bonusDraft.xpPer100CoinsWagered}
                                        onChange={(event) => setBonusDraft((prev) => ({ ...prev, xpPer100CoinsWagered: Number(event.target.value), xpPer100Coins: Number(event.target.value) }))}
                                        className="w-full bg-[#0b0e14] border border-gray-700 rounded-lg px-4 py-2 text-white"
                                    />
                                    <p className="text-xs text-gray-500 mt-2">
                                        Current distribution: {bonusDraft.xpPer100CoinsWagered} XP for every 100 coins wagered.
                                    </p>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">XP per box opened</label>
                                    <Input
                                        type="number"
                                        min={0}
                                        step={1}
                                        value={bonusDraft.xpPerCaseOpened}
                                        onChange={(event) => setBonusDraft((prev) => ({ ...prev, xpPerCaseOpened: Number(event.target.value), xpPerCaseOpen: Number(event.target.value) }))}
                                        className="w-full bg-[#0b0e14] border border-gray-700 rounded-lg px-4 py-2 text-white"
                                    />
                                    <p className="text-xs text-gray-500 mt-2">
                                        Bonus XP for engagement loops and streaks.
                                    </p>
                                </div>
                            </div>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Base XP bonus</label>
                                    <Input
                                        type="number"
                                        min={0}
                                        step={10}
                                        value={bonusDraft.baseXpBonus}
                                        onChange={(event) => setBonusDraft((prev) => ({ ...prev, baseXpBonus: Number(event.target.value) }))}
                                        className="w-full bg-[#0b0e14] border border-gray-700 rounded-lg px-4 py-2 text-white"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">XP multiplier</label>
                                    <Input
                                        type="number"
                                        min={0}
                                        step={0.01}
                                        value={bonusDraft.xpMultiplier}
                                        onChange={(event) => setBonusDraft((prev) => ({ ...prev, xpMultiplier: Number(event.target.value) }))}
                                        className="w-full bg-[#0b0e14] border border-gray-700 rounded-lg px-4 py-2 text-white"
                                    />
                                    <p className="text-xs text-gray-500 mt-2">
                                        Multiplies box-open XP rewards after wager/open/base values are combined.
                                    </p>
                                </div>
                            </div>
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
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Mini challenges JSON</label>
                                    <Textarea
                                        rows={8}
                                        value={questRulesText}
                                        onChange={(event) => setQuestRulesText(event.target.value)}
                                        className="w-full bg-[#0b0e14] border border-gray-700 rounded-lg px-3 py-2 text-white"
                                    />
                                    <p className="text-xs text-gray-500 mt-2">Mission types: unboxing_count, sell_back_count, sell_back_value, upgrader_uses, unbox_rarity.</p>
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
                                className="w-full sm:w-auto px-5 py-2 bg-brand-purple/20 text-brand-purple border border-brand-purple/40 rounded-lg text-sm font-bold hover:bg-brand-purple hover:text-white transition-colors"
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
                                            className="w-full sm:w-auto px-3 py-2 rounded-lg border border-brand-purple/40 text-brand-purple hover:bg-brand-purple hover:text-white text-sm font-semibold"
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
                                        className="w-full sm:w-auto px-4 py-2 rounded-lg bg-brand-purple/20 text-brand-purple border border-brand-purple/40 hover:bg-brand-purple hover:text-white font-bold text-sm"
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
                                            Enable Stripe Checkout and set the flat rate per shipment.
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
                                className="w-full sm:w-auto px-5 py-2 bg-brand-purple/20 text-brand-purple border border-brand-purple/40 rounded-lg text-sm font-bold hover:bg-brand-purple hover:text-white transition-colors"
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
                <HomepageShowcaseEditor />
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
                                                className="h-4 w-4 rounded border-gray-700 bg-[#0b0e14] text-brand-purple focus:ring-brand-purple"
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
                                className="w-full sm:w-auto px-5 py-2 bg-brand-purple/20 text-brand-purple border border-brand-purple/40 rounded-lg text-sm font-bold hover:bg-brand-purple hover:text-white transition-colors"
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

            {/* TAB: LEGAL */}
            {activeTab === 'legal' && (
                <LegalEditor />
            )}

            {/* TAB: SETTINGS */}
            {activeTab === 'settings' && (
                <div className="space-y-6">
                    <UpgraderAdminSection />
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
                                        className="w-full sm:w-auto px-5 py-2 bg-brand-purple/20 text-brand-purple border border-brand-purple/40 rounded-lg text-sm font-bold hover:bg-brand-purple hover:text-white transition-colors"
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
                            <BellRing className="w-5 h-5 text-brand-purple" />
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
                                className="w-full bg-[#0b0e14] border border-gray-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-brand-purple transition-colors"
                            />
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                <span className="text-xs text-gray-500">
                                    Keep it short and actionable for mobile users.
                                </span>
                                <button
                                    onClick={() => { void handleSendAdminNotification(); }}
                                    disabled={!adminNotification.trim() || isSendingAdminNotice}
                                    className="px-5 py-2 bg-brand-purple/20 text-brand-purple border border-brand-purple/40 rounded-lg text-sm font-bold hover:bg-brand-purple hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
              <div className="relative w-full max-w-lg bg-[#131720] border border-gray-700 rounded-2xl shadow-2xl p-6 animate-in zoom-in-95">
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
                          <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Badge</label>
                          <Select
                              value={packageDraft.badge ?? ''}
                              onChange={(event) =>
                                  setPackageDraft((prev) => ({
                                      ...prev,
                                      badge: event.target.value ? (event.target.value as CoinPackage['badge']) : undefined
                                  }))
                              }
                              className="w-full bg-[#0b0e14] border border-gray-700 rounded-lg px-4 py-2 text-white"
                          >
                              <option value="">None</option>
                              <option value="good">Good value</option>
                              <option value="best">Best value</option>
                          </Select>
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

const SwordsIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="14.5 17.5 3 6 3 3 6 3 17.5 14.5"></polyline><line x1="13" y1="19" x2="19" y2="13"></line><line x1="16" y1="16" x2="20" y2="20"></line><line x1="19" y1="21" x2="21" y2="19"></line><polyline points="14.5 6.5 18 3 21 3 21 6 17.5 9.5"></polyline><line x1="5" y1="14" x2="9" y2="18"></line><line x1="7" y1="17" x2="4" y2="20"></line><line x1="3" y1="19" x2="5" y2="21"></line></svg>
);

const CoinStatIcon = () => (
    <img src={COIN_ICON} alt="Coin" className="w-6 h-6" />
);
