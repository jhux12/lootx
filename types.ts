
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
  username?: string;
  displayName?: string;
  email?: string;
  avatar: string;
  photoURL?: string;
  provider?: string;
  level: number;
  xp: number;
  xpBalance?: number;
  xpEarnedLifetime?: number;
  xpSpentLifetime?: number;
  pullPassSeasonXp?: number;
  pullPassXp?: number;
  pullPassClaims?: Record<string, any>;
  pullPassResetAt?: number;
  activePullPassBoxClaim?: { tier: number; boxId: string; claimedAt?: number; rewardName?: string };
  balance?: number;
  followers?: string[];
  lastDailyClaim?: number;
  lastFreeBoxClaim?: number;
  totalSpent?: number;
  totalDepositedCents?: number;
  depositCount?: number;
  lastDepositAt?: any;
  rakebackBalance?: number;
  rakebackEarnedToday?: number;
  rakebackEarnedAt?: number;
  rakebackUnlocked?: boolean;
  rakebackPercent?: number;
  rakebackTier?: string | null;
  affiliateCode?: string;
  referredBy?: string;
  shippingAddress?: ShippingAddress;
  inventory?: InventoryItem[];
  isAdmin?: boolean;
  termsFlagged?: boolean;
  status?: UserStatus;
  locks?: UserLocks;
  ledger?: LedgerEntry[];
  adminLogs?: AdminActionLog[];
  topPullsPublic?: boolean;
  hiddenFromLeaderboard?: boolean;
  hiddenFromPublicDisplay?: boolean;
  topPulls?: InventoryItem[];
  createdAt?: number;
  signupIp?: string;
  signupIpRecordedAt?: any;
  signupIpAccountNumber?: number;
  deviceId?: string;
  deviceAccountNumber?: number;
  fraudScore?: number;
  fraudSignals?: string[];
  fraudAssessedAt?: any;
  welcomeBonusClaimedAt?: any;
  autoBannedAt?: any;
  autoBanReason?: string;
  challengeStatsDay?: string;
  challengeStats?: {
    boxesOpened?: number;
    sellBackItems?: number;
    sellBackCoins?: number;
    upgraderUses?: number;
    rarityUnboxed?: Record<string, number>;
  };
  questClaims?: Record<string, string>;
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


export type MarketPricingSource = 'pricecharting' | 'tcgplayer' | 'justtcg' | 'manual';
export type MarketPricingCondition = 'raw' | 'near_mint' | 'lightly_played' | 'psa_9' | 'psa_10' | 'sealed';
export type MarketPricingStatus = 'idle' | 'pending_review' | 'approved' | 'failed';

export interface ItemMarketPricing {
  enabled: boolean;
  source: MarketPricingSource;
  sourceId?: string;
  query?: string;
  condition?: MarketPricingCondition;
  game?: string;
  lastCheckedAt?: any;
  lastMarketValueUsd?: number;
  suggestedValueUsd?: number;
  suggestedValueCoins?: number;
  suggestedSellBackCoins?: number;
  approvedValueUsd?: number;
  approvedValueCoins?: number;
  approvedSellBackCoins?: number;
  updateStatus?: MarketPricingStatus;
  lastError?: string | null;
  valueLocked?: boolean;
  allowHighValue?: boolean;
  warning?: string | null;
}

export interface BoxMarketValueAudit {
  lastCheckedAt?: any;
  expectedValueCoins: number;
  boxPriceCoins: number;
  marginCoins: number;
  marginPercent: number;
  status: 'healthy' | 'warning' | 'danger';
  needsReview: boolean;
}

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
  sizes?: string[];
  redeemable?: boolean;
  shippable?: boolean;
  forceFullSellBack?: boolean;
  upgraderEnabled?: boolean;
  upgraderCategory?: '' | 'tech' | 'collectible' | 'apparel';
  upgraderSort?: number;
  upgraderFeatured?: boolean;
  valueUsd?: number;
  valueCoins?: number;
  sellBackCoins?: number;
  marketPricing?: ItemMarketPricing;
  boxValueOverrideCoins?: number;
  originalPriceCoins?: number;
}

export interface MysteryBox {
  id: string;
  name: string;
  price: number;
  priceXP?: number;
  currencyType?: 'COIN' | 'XP';
  image: string;
  spinnerBackgroundImage?: string;
  tag?: BoxTag;
  tags?: string[];
  accentColor: string;
  items: CaseItem[];
  targetEV?: number;
  riskLevel?: number;
  isUserCreated?: boolean;
  isDaily?: boolean;
  isPullPassBox?: boolean;
  pullPassBoxType?: 'bronze' | 'silver' | 'gold' | 'elite' | 'master' | 'collector';
  sellBackRate?: number;
  createdAt?: number;
  marketValueAudit?: BoxMarketValueAudit;
}

export interface CoinPackage {
  id: string;
  name: string;
  coins: number;
  bonusCoins?: number;
  totalCoins?: number;
  defaultSelected?: boolean;
  firstTimeDepositOnly?: boolean;
  imageUrl?: string;
  displayPrice: string;
  stripePriceId: string;
  badge?: string;
  active: boolean;
  sortOrder: number;
  createdAt?: number;
  updatedAt?: number;
}

export interface ShippingRateTierSetting {
  maxValueCoinsExclusive: number | null;
  cashCents: number;
  label: string;
}

export interface StripeSettings {
  boxCatalogHeroImageUrl: string;
  authPopupImageUrl: string;
  authPopupImageUrls: string[];
  homeCategoryImageUrls: string[];
  homeCategorySlugs: string[];
  howItWorksStepImageUrls: string[];
  shippingCashEnabled: boolean;
  shippingFlatRateCents: number;
  shippingCoinEnabled: boolean;
  shippingCoinCostCoins: number;
  shippingRateTiers: ShippingRateTierSetting[];
  shippingProtectionTiers: ShippingRateTierSetting[];
  signatureRequiredCents: number;
  stripeShippingProductId: string;
  caseLabPublishFeeCoins: number;
  caseLabSellBackPercent: number;
  caseLabVisibleBoxIds: string[];
  boxTagIcons: Record<string, string>;
  boxTagLabels: Record<string, string>;
}

export interface InventoryItem extends CaseItem {
  instanceId: string;
  obtainedAt: number;
  status: 'available' | 'sold' | 'opened' | 'shipping' | 'shipping_requested' | 'pending_shipment' | 'shipped';
  locked?: boolean;
  trackingNumber?: string;
  size?: string;
  provenance?: InventoryProvenance;
  history?: InventoryHistoryEntry[];
  sellBackRate?: number;
  source?: string;
  sourceItemId?: string;
  sourceRedemptionId?: string;
  acquisitionCurrencyType?: 'COIN' | 'XP';
  openCurrencyType?: 'COIN' | 'XP';
  boxId?: string;
  pullPassTier?: number;
  pullPassBoxType?: MysteryBox['pullPassBoxType'];
  openedAt?: number;
  freeShipping?: boolean;
  shippingCostOverrideCoins?: number;
  shippingCostOverrideCents?: number;
}

export type ShipmentStatus = 'pending_payment' | 'shipping_requested' | 'shipping' | 'shipped' | 'cancelled';

export interface ShipmentItem {
  name: string;
  value: number;
  image: string;
  rarity: CaseItem['rarity'];
  sellBackRate?: number;
  size?: string | null;
  boxId?: string | null;
  prizeId?: string | null;
}

export interface Shipment {
  id: string;
  uid: string;
  inventoryId?: string;
  item: ShipmentItem;
  shippingInfo?: ShippingAddress;
  shippingCost?: number;
  shippingPaid?: boolean;
  shippingPaymentMethod?: 'coins' | 'cash' | 'FREE_XP';
  shippingCashAmountCents?: number;
  shippingBatchId?: string;
  shippingBatchCost?: number;
  shippingBatchCostCents?: number;
  shippingBatchValueCoins?: number;
  shippingRateTier?: string;
  status: ShipmentStatus;
  trackingNumber?: string;
  createdAt?: number;
  updatedAt?: number;
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
  | { type: 'SPIN' }
  | { type: 'BOXES' }
  | { type: 'PROFILE'; userId?: string }
  | { type: 'INVENTORY' }
  | { type: 'BONUSES' }
  | { type: 'POLLS' }
  | { type: 'REFERRALS' }
  | { type: 'QUESTS' }
  | { type: 'CONTACT' }
  | { type: 'TERMS' }
  | { type: 'PRIVACY' }
  | { type: 'FAQ' }
  | { type: 'ABOUT' }
  | { type: 'SHIPPING_POLICY' }
  | { type: 'REFUND_POLICY' }
  | { type: 'ADMIN' }
  | { type: 'LEADERBOARD' }
  | { type: 'CUSTOM_CREATOR' }
  | { type: 'PROVABLY_FAIR' }
  | { type: 'CASE_OPENING'; boxId: string; isFree?: boolean; inventoryId?: string; pullPassClaimTier?: number }
  | { type: 'BATTLE_ARENA'; battleId: string }
  | { type: 'BATTLES' }
  | { type: 'PLINKO' }
  | { type: 'ADMIN_UPGRADER_SETTINGS' }
  | { type: 'ADMIN_UPGRADER_TARGETS' }
  | { type: 'VERIFY_EMAIL' };
