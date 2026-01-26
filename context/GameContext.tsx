import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { AppNotification, User, InventoryItem, CaseItem, InventoryProvenance, ViewState, Battle, MysteryBox, ShippingAddress, UserLocks } from '../types';
import { CASE_ITEMS } from '../constants';
import { auth, db } from '../firebase';
import { authedFetch } from '../utils/authedFetch';
import { 
  User as FirebaseUser,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut
} from 'firebase/auth';
import { 
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  QueryDocumentSnapshot,
  runTransaction,
  setDoc,
  Timestamp
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

const normalizeInventoryItems = (items: unknown): InventoryItem[] => {
  if (!Array.isArray(items)) return [];
  return items.map((item, index) => {
    const typed = item as Partial<InventoryItem>;
    const fallbackId = typeof typed.id === 'string' ? typed.id : `item-${index}`;
    return {
      ...(typed as InventoryItem),
      id: fallbackId,
      instanceId: typed.instanceId || `${fallbackId}-${index}`,
      obtainedAt: Number(typed.obtainedAt ?? 0),
      status: (typed.status ?? 'available') as InventoryItem['status'],
      rarity: (typed.rarity ?? 'common') as InventoryItem['rarity'],
      price: Number(typed.price ?? 0),
      name: typed.name ?? 'Mystery Item',
      image: typed.image ?? 'https://picsum.photos/200',
      chance: Number(typed.chance ?? 0),
      color: typed.color ?? '#9ca3af'
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

interface GameContextType {
  user: User;
  isAuthenticated: boolean;
  balance: number;
  inventory: InventoryItem[];
  users: User[];
  notifications: AppNotification[];
  view: ViewState;
  battles: Battle[];
  boxes: MysteryBox[];
  items: CaseItem[];
  bonusSettings: BonusSettings;
  showLoginModal: boolean;
  showTopUpModal: boolean;
  
  // Actions
  login: (email: string, pass: string) => Promise<void>;
  register: (name: string, email: string, pass: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  logout: () => void;
  setShowLoginModal: (show: boolean) => void;
  setShowTopUpModal: (show: boolean) => void;
  setView: (view: ViewState) => void;
  addBalance: (amount: number) => void;
  syncBalance: (amount: number) => void;
  deductBalance: (amount: number, options?: { trackRewards?: boolean }) => boolean;
  addToInventory: (item: CaseItem, provenance?: InventoryProvenance) => InventoryItem;
  addInventoryItemFromServer: (item: InventoryItem) => void;
  followUser: (targetUserId: string) => Promise<void>;
  unfollowUser: (targetUserId: string) => Promise<void>;
  sellItem: (instanceId: string) => Promise<void>;
  shipItem: (instanceId: string) => void;
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
  updateUserFlags: (updates: Partial<User>) => Promise<void>;
  updateUserAdminData: (userId: string, updates: Partial<User>) => Promise<void>;
  createBox: (box: MysteryBox) => void; // Admin
  createUserBox: (box: MysteryBox) => void; // User Custom
  updateBox: (box: MysteryBox) => void;
  deleteBox: (boxId: string) => Promise<void>;
  claimDaily: () => void;
  claimRakeback: () => void;
  updateBonusSettings: (settings: BonusSettings) => void;
  awardCaseOpenXp: () => void;
  generateAffiliateCode: () => Promise<string | undefined>;
  updateUserProgress: (userId: string, xp: number) => Promise<void>;
  updateShipmentStatus: (userId: string, instanceId: string, status: InventoryItem['status'], trackingNumber?: string) => Promise<void>;
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

const buildUserProfile = (firebaseUser: FirebaseUser, data: Record<string, any> = {}) => {
  const now = Date.now();
  const metadataCreatedAt = firebaseUser.metadata.creationTime ? Date.parse(firebaseUser.metadata.creationTime) : NaN;
  const fallbackCreatedAt = Number.isFinite(metadataCreatedAt) ? metadataCreatedAt : now;
  const createdAt = normalizeTimestamp(data.createdAt, fallbackCreatedAt);
  const lastChatAt = data.lastChatAt === undefined ? undefined : normalizeTimestamp(data.lastChatAt, now);
  const xp = Number(data.xp ?? 0);
  const progress = calculateLevelProgress(xp);
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
    email: data.email || firebaseUser.email || '',
    avatar: data.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(firebaseUser.email || 'Player')}&background=111827&color=10b981`,
    balance,
    level: data.level ?? progress.level,
    xp,
    lastDailyClaim: data.lastDailyClaim,
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
    termsFlagged: data.termsFlagged ?? false,
    status: data.status ?? 'active',
    locks: data.locks ?? DEFAULT_LOCKS,
    ledger: Array.isArray(data.ledger) ? data.ledger : undefined,
    adminLogs: Array.isArray(data.adminLogs) ? data.adminLogs : undefined,
    topPullsPublic: data.topPullsPublic ?? false,
    topPulls: normalizeInventoryItems(data.topPulls)
  } as User;
};

const mapInventoryDoc = (docSnap: QueryDocumentSnapshot) => {
  const data = docSnap.data() as Record<string, any>;
  const rarity = (data.rarity ?? 'common') as InventoryItem['rarity'];
  const value = Number(data.value ?? data.price ?? 0);
  const obtainedAt = normalizeTimestamp(data.obtainedAt, Date.now());
  const status = (data.status ?? 'available') as InventoryItem['status'];

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
    provenance: data.boxId ? { sourceType: 'case_open', sourceId: data.boxId } : undefined
  } as InventoryItem;
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
  
  // -- PERSISTENT STATE INITIALIZATION --
  
  // 1. Initialize User State
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [user, setUser] = useState<User>(GUEST_USER);
  const [users, setUsers] = useState<User[]>([]);
  const [balance, setBalance] = useState<number>(0);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  
  const [view, setViewState] = useState<ViewState>(() => {
    if (typeof window === 'undefined') {
      return { type: 'HOME' };
    }
    return getViewFromLocation(window.location.pathname, window.location.search);
  });

  const setView = (nextView: ViewState) => {
    setViewState(nextView);
    if (typeof window !== 'undefined') {
      const nextPath = getPathFromView(nextView);
      const currentPath = `${window.location.pathname}${window.location.search}`;
      if (nextPath !== currentPath) {
        window.history.pushState({}, '', nextPath);
      }
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
    setBoxes(prev => {
      const userCreated = prev.filter(b => b.isUserCreated);
      const adminBoxes = prev.filter(b => !b.isUserCreated && b.id !== boxId);
      return [...userCreated, ...adminBoxes];
    });
  };

  const [battles, setBattles] = useState<Battle[]>([]);

  // -- FIREBASE SYNC --
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handlePopState = () => {
      setViewState(getViewFromLocation(window.location.pathname, window.location.search));
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    let userUnsubscribe: (() => void) | null = null;
    let inventoryUnsubscribe: (() => void) | null = null;

    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (userUnsubscribe) {
        userUnsubscribe();
        userUnsubscribe = null;
      }
      if (inventoryUnsubscribe) {
        inventoryUnsubscribe();
        inventoryUnsubscribe = null;
      }

      if (!firebaseUser) {
        setIsAuthenticated(false);
        setUser(GUEST_USER);
        setBalance(0);
        setInventory([]);
        setNotifications([]);
        return;
      }

      setIsAuthenticated(true);

      const userRef = getUserRef(firebaseUser.uid);
      userUnsubscribe = onSnapshot(userRef, (snapshot) => {
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

        setUser((prev) => ({
          ...prev,
          ...profile
        }));
        setBalance(profile.balance ?? 0);
      }, (error) => {
        console.error('Failed to load user profile from Firebase', error);
      });

      const inventoryRef = collection(db, 'users', firebaseUser.uid, 'inventory');
      inventoryUnsubscribe = onSnapshot(inventoryRef, (snapshot) => {
        const loaded = snapshot.docs
          .map(mapInventoryDoc)
          .sort((a, b) => b.obtainedAt - a.obtainedAt);
        setInventory(loaded);
        const nextTopPulls = rankTopPullsByValue(loaded);
        setUser((prev) => ({ ...prev, topPulls: nextTopPulls }));
      }, (error) => {
        console.error('Failed to load inventory from Firebase', error);
      });
    });

    return () => {
      unsubscribe();
      if (userUnsubscribe) userUnsubscribe();
      if (inventoryUnsubscribe) inventoryUnsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      setUsers([]);
      return;
    }
    setUsers([user]);
  }, [isAuthenticated, user]);

  useEffect(() => {
    if (!isAuthenticated) return;

    const latestUser = users.find((entry) => entry.id === user.id);
    if (!latestUser) return;

    const nextBalance = Number(latestUser.balance ?? 0);
    const needsBalanceUpdate = nextBalance !== balance;
    const needsCreatedAtUpdate = !user.createdAt && !!latestUser.createdAt;
    const needsLastChatUpdate = latestUser.lastChatAt !== undefined && latestUser.lastChatAt !== user.lastChatAt;
    const nextTopPullsPublic = latestUser.topPullsPublic ?? false;
    const needsTopPullsPublicUpdate = nextTopPullsPublic !== (user.topPullsPublic ?? false);
    const nextTopPulls = normalizeInventoryItems(latestUser.topPulls);
    const needsTopPullsUpdate = inventorySignature(nextTopPulls) !== inventorySignature(normalizeInventoryItems(user.topPulls));

    if (!needsBalanceUpdate && !needsCreatedAtUpdate && !needsLastChatUpdate && !needsTopPullsPublicUpdate && !needsTopPullsUpdate) return;

    if (needsBalanceUpdate) {
      setBalance(nextBalance);
    }

    const updates: Partial<User> = {};
    if (needsBalanceUpdate) updates.balance = nextBalance;
    if (needsCreatedAtUpdate) updates.createdAt = latestUser.createdAt;
    if (needsLastChatUpdate) updates.lastChatAt = latestUser.lastChatAt;
    if (needsTopPullsPublicUpdate) updates.topPullsPublic = nextTopPullsPublic;
    if (needsTopPullsUpdate) updates.topPulls = nextTopPulls;

    setUser((prev) => ({ ...prev, ...updates }));
  }, [users, isAuthenticated, user.id, user.createdAt, user.lastChatAt, user.topPullsPublic, user.topPulls, balance]);

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
            tags: Array.isArray(data.tags) ? (data.tags as CaseItem['tags']) : undefined
          } as CaseItem;
        })
        .sort((a, b) => a.price - b.price);

      setItems(loaded.length ? loaded : CASE_ITEMS);
    }, (error) => {
      console.error('Failed to load items from Firebase', error);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const boxesRef = collection(db, 'boxes');
    const unsubscribe = onSnapshot(boxesRef, (snapshot) => {
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
              tags: Array.isArray(item.tags) ? (item.tags as CaseItem['tags']) : undefined
            };
          }) : [];

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
            items
          } as MysteryBox;
        })
        .sort((a, b) => a.price - b.price);

      setBoxes(prev => {
        const userCreated = prev.filter(b => b.isUserCreated);
        return [...userCreated, ...firebaseBoxes];
      });
    }, (error) => {
      console.error('Failed to load boxes from Firebase', error);
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

  const login = async (email: string, pass: string) => {
      await signInWithEmailAndPassword(auth, email, pass);
      setShowLoginModal(false);
  };

  const register = async (name: string, email: string, pass: string) => {
    const credential = await createUserWithEmailAndPassword(auth, email, pass);
    const createdAt = Date.now();
    const newUser: User = {
      id: credential.user.uid,
      createdAt,
      name,
      email,
      avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=111827&color=10b981`,
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
      termsFlagged: false
    };

    await setDoc(doc(db, 'users', newUser.id), buildUserDocument(newUser));

    setUser(newUser);
    setBalance(0);
    setInventory([]);
    setIsAuthenticated(true);
    setShowLoginModal(false);
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
      const xpGain = Math.max(0, Math.floor(amount * bonusSettings.xpPer100Coins));
      const nextXp = Math.max(0, prev.xp + xpGain);
      const progress = calculateLevelProgress(nextXp, bonusSettings);
      const totalSpent = Math.max(0, (prev.totalSpent ?? 0) + amount);
      const rakebackRate = Math.max(0, bonusSettings.rakebackBasePercent) / 100;
      const today = getDayStart();
      const earnedAt = Number(prev.rakebackEarnedAt ?? 0);
      const earnedToday = earnedAt === today ? Number(prev.rakebackEarnedToday ?? 0) : 0;
      const capAmount = bonusSettings.rakebackDailyCapCoins / 100;
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
      setShowLoginModal(true);
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
      setShowLoginModal(true);
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
      setShowLoginModal(true);
      return;
    }

    try {
      const data = await authedFetch<{ newCoins?: number }>('/api/sell-item', {
        method: 'POST',
        body: JSON.stringify({ inventoryId: instanceId })
      });

      setInventory(prev => prev.filter(item => item.instanceId !== instanceId));
      syncBalance(Number(data.newCoins ?? balance));
    } catch (error) {
      console.error('Failed to sell item', error);
      alert('Unable to sell item right now. Please try again.');
    }
  };

  const shipItem = async (instanceId: string) => {
    if (!auth.currentUser) {
      setShowLoginModal(true);
      return;
    }

    const itemToShip = inventory.find(item => item.instanceId === instanceId);
    if (!itemToShip || !user.shippingAddress) {
      alert('Please add a shipping address before requesting shipment.');
      return;
    }

    try {
      await authedFetch('/api/request-shipment', {
        method: 'POST',
        body: JSON.stringify({
          inventoryId: instanceId,
          shippingInfo: user.shippingAddress
        })
      });

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
      delete sanitizedUpdates.inventory;
      delete sanitizedUpdates.coins;

      try {
        await setDoc(getUserRef(userId), sanitizedUpdates, { merge: true });
      } catch (error) {
        console.error('Failed to update user admin data in Firebase', error);
      }

      setUsers(prev => prev.map(u => u.id === userId ? { ...u, ...updates } : u));
      setUser(prev => prev.id === userId ? { ...prev, ...updates } : prev);
  };

  const createBattle = async (boxIds: string[], maxPlayers: number) => {
    if (!isAuthenticated) {
        setShowLoginModal(true);
        return;
    }

    const selectedCases = boxIds.map(id => boxes.find(b => b.id === id)).filter(b => b !== undefined) as MysteryBox[];
    const cost = selectedCases.reduce((sum, b) => sum + b.price, 0);

    if (selectedCases.length === 0) {
        alert("Please select at least one box");
        return;
    }

    if (!deductBalance(cost)) {
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
        setShowLoginModal(true);
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
    if (!deductBalance(battle.cost, { trackRewards: false })) {
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
      addBalance(battle.cost);
      if (error?.message === 'full') {
        alert("Battle is full!");
      }
      return;
    }
    registerSpend(battle.cost);
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
  };

  const deleteItem = async (itemId: string) => {
      try {
          await deleteDoc(doc(db, 'items', itemId));
      } catch (error) {
          console.error('Failed to delete item from Firebase', error);
      }

      setItems(prev => prev.filter(i => i.id !== itemId));
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
      const userBox = { ...box, isUserCreated: true };
      setBoxes(prev => [...prev, userBox]);
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

  const claimRakeback = () => {
    if (!isAuthenticated) {
      setShowLoginModal(true);
      return;
    }

    const available = Number(user.rakebackBalance ?? 0);
    if (available <= 0) return;

    const capAmount = bonusSettings.rakebackDailyCapCoins / 100;
    const payout = capAmount > 0 ? Math.min(available, capAmount) : available;
    if (payout <= 0) return;

    addBalance(payout);
    const remaining = Math.max(0, available - payout);
    setUser(prev => ({ ...prev, rakebackBalance: remaining }));
    persistUserData({ rakebackBalance: remaining });
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
      setShowLoginModal(true);
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

  const updateShipmentStatus = async (userId: string, instanceId: string, status: InventoryItem['status'], trackingNumber?: string) => {
    const targetUser = users.find((u) => u.id === userId);
    if (!targetUser) {
      console.warn('Attempted to update shipment for unknown user');
      return;
    }

    const inventoryList = Array.isArray(targetUser.inventory) ? targetUser.inventory : [];
    const sanitizedTrackingNumber = trackingNumber?.trim();
    const updatedInventory = inventoryList.map((item) =>
      item.instanceId === instanceId
        ? {
            ...item,
            status,
            trackingNumber: sanitizedTrackingNumber || item.trackingNumber
          }
        : item
    );

    try {
      await setDoc(getUserRef(userId), { inventory: updatedInventory }, { merge: true });
    } catch (error) {
      console.error('Failed to update shipment status in Firebase', error);
      return;
    }

    setUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, inventory: updatedInventory } : u))
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
      balance,
      inventory,
      view,
      battles,
      boxes,
      items,
      bonusSettings,
      login,
      register,
      logout,
      setShowLoginModal,
      setShowTopUpModal,
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
      createBattle,
      joinBattle,
      updateBattle,
      createItem,
      updateItem,
      deleteItem,
      createBox,
      createUserBox,
      updateBox,
      deleteBox,
      claimDaily,
      claimRakeback,
      updateBonusSettings,
      awardCaseOpenXp,
      generateAffiliateCode,
      updateUserProgress,
      updateShipmentStatus,
      resetPassword
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
