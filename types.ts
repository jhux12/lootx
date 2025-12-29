
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
  followers?: string[];
  lastDailyClaim?: number;
  totalSpent?: number;
  rakebackBalance?: number;
  affiliateCode?: string;
  referredBy?: string;
  shippingAddress?: ShippingAddress;
  isAdmin?: boolean;
  chatWarnings?: number;
  chatDisabled?: boolean;
  chatDisabledAt?: number;
  termsFlagged?: boolean;
}

export interface ChatMessage {
  id: string;
  user: User;
  message: string;
  timestamp: string;
  createdAt?: number;
  isSystem?: boolean;
}

export interface CaseItem {
  id: string;
  name: string;
  price: number;
  image: string;
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
  chance: number; // Percentage 0-100
  color: string;
}

export interface MysteryBox {
  id: string;
  name: string;
  price: number;
  image: string;
  tag?: 'New' | 'Hot' | 'Sale';
  accentColor: string;
  items: CaseItem[];
  isUserCreated?: boolean;
  isDaily?: boolean;
}

export interface InventoryItem extends CaseItem {
  instanceId: string;
  obtainedAt: number;
  status: 'available' | 'sold' | 'shipping' | 'shipped';
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

export type ViewState = 
  | { type: 'HOME' }
  | { type: 'PROFILE'; userId?: string }
  | { type: 'BONUSES' }
  | { type: 'ADMIN' }
  | { type: 'LEADERBOARD' }
  | { type: 'CUSTOM_CREATOR' }
  | { type: 'CASE_OPENING'; boxId: string; isFree?: boolean }
  | { type: 'BATTLE_ARENA'; battleId: string }
  | { type: 'BATTLES' };
