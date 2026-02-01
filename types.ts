
export interface ShippingAddress {
  fullName: string;
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
}

export interface User {
  id: string;
  name: string;
  email?: string;
  avatar: string;
  level: number;
  xp: number;
  balance?: number;
  followers?: string[];
  lastDailyClaim?: number;
  totalSpent?: number;
  rakebackBalance?: number;
  rakebackEarnedToday?: number;
  rakebackEarnedAt?: number;
  affiliateCode?: string;
  referredBy?: string;
  shippingAddress?: ShippingAddress;
  inventory?: InventoryItem[];
  isAdmin?: boolean;
  chatWarnings?: number;
  chatDisabled?: boolean;
  chatDisabledAt?: number;
  termsFlagged?: boolean;
  status?: UserStatus;
  locks?: UserLocks;
  ledger?: LedgerEntry[];
  adminLogs?: AdminActionLog[];
  topPullsPublic?: boolean;
  topPulls?: InventoryItem[];
  createdAt?: number;
  lastChatAt?: number;
}

export interface ChatMessage {
  id: string;
  user: User;
  message: string;
  timestamp: string;
  createdAt?: number;
  isSystem?: boolean;
}

export type BoxTag = 'tech' | 'pokemon' | 'hot' | 'digital' | 'holiday';
export const BOX_TAG_OPTIONS: BoxTag[] = ['tech', 'pokemon', 'hot', 'digital', 'holiday'];

export interface CaseItem {
  id: string;
  name: string;
  price: number;
  image: string;
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
  chance: number; // Percentage 0-100
  color: string;
  brand?: string;
  category?: string;
  tags?: string[];
}

export interface MysteryBox {
  id: string;
  name: string;
  price: number;
  image: string;
  tag?: BoxTag;
  tags?: string[];
  accentColor: string;
  items: CaseItem[];
  targetEV?: number;
  riskLevel?: number;
  sellBackRate?: number;
  isUserCreated?: boolean;
  isDaily?: boolean;
}

export interface CoinPackage {
  id: string;
  name: string;
  coins: number;
  bonusCoins?: number;
  totalCoins?: number;
  displayPrice: string;
  stripePriceId: string;
  active: boolean;
  sortOrder: number;
  createdAt?: number;
  updatedAt?: number;
}

export interface InventoryItem extends CaseItem {
  instanceId: string;
  obtainedAt: number;
  status: 'available' | 'sold' | 'shipping' | 'shipping_requested' | 'shipped';
  locked?: boolean;
  trackingNumber?: string;
  provenance?: InventoryProvenance;
  history?: InventoryHistoryEntry[];
  sellBackRate?: number;
}

export type UserStatus = 'active' | 'suspended' | 'banned';

export interface UserLocks {
  openCases: boolean;
  deposits: boolean;
  withdraws: boolean;
  marketplace: boolean;
  shipments: boolean;
}

export type LedgerEntryType =
  | 'deposit'
  | 'case_open'
  | 'sell_back'
  | 'bonus'
  | 'admin_adjustment'
  | 'chargeback_reversal'
  | 'reversal';

export interface LedgerEntry {
  id: string;
  userId: string;
  type: LedgerEntryType;
  amount: number;
  createdAt: number;
  balanceAfter?: number;
  sourceId?: string;
  memo?: string;
}

export interface AdminActionLog {
  id: string;
  adminUid: string;
  targetUserUid: string;
  actionType: string;
  reason: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  createdAt: number;
}

export type InventoryHistoryAction =
  | 'added'
  | 'locked'
  | 'unlocked'
  | 'sold'
  | 'shipped'
  | 'void_open'
  | 'reversal';

export interface InventoryHistoryEntry {
  id: string;
  action: InventoryHistoryAction;
  createdAt: number;
  note?: string;
  adminUid?: string;
}

export interface InventoryProvenance {
  sourceType: 'case_open' | 'deposit' | 'promo' | 'admin_adjustment';
  sourceId: string;
}

export interface BattlePlayer extends User {
  totalWin: number;
  isBot?: boolean;
}

export interface BattleRound {
  roundNumber: number;
  drops: { playerId: string; item: CaseItem }[];
}

export interface Battle {
  id: string;
  mode: 'Normal' | 'Inverse' | 'Terminal';
  players: BattlePlayer[];
  playerCount: number;
  maxPlayers: number;
  cost: number;
  cases: MysteryBox[]; // The sequence of boxes
  rounds: number; // Derived from cases.length
  currentRound: number;
  status: 'waiting' | 'active' | 'finished';
  history: BattleRound[];
  createdAt: number;
  rewardsDistributed?: boolean;
  botsAdded?: boolean;
}

export interface LiveDrop {
  id: string;
  itemName: string;
  itemImage: string;
  value: number;
  user: User;
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
}

export interface AppNotification {
  id: string;
  message: string;
  createdAt: number;
  type: 'shipping' | 'admin';
}

export type ViewState = 
  | { type: 'HOME' }
  | { type: 'BOXES' }
  | { type: 'PROFILE'; userId?: string }
  | { type: 'INVENTORY' }
  | { type: 'BONUSES' }
  | { type: 'ADMIN' }
  | { type: 'LEADERBOARD' }
  | { type: 'CUSTOM_CREATOR' }
  | { type: 'CASE_OPENING'; boxId: string; isFree?: boolean }
  | { type: 'BATTLE_ARENA'; battleId: string }
  | { type: 'BATTLES' };
