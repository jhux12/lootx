export type Rarity = 'Common' | 'Uncommon' | 'Rare' | 'Epic' | 'Legendary' | 'Mythic';

export interface Item {
  id: string;
  name: string;
  imageUrl: string;
  coinValue: number;
  rarity: Rarity;
  category: string;
  enabled?: boolean;
}

export interface InventoryItem extends Item {
  locked?: boolean;
  shipping?: boolean;
}

export interface UpgraderSettings {
  enabled: boolean;
  edgeMultiplier: number;
  minChance: number;
  maxChance: number;
  minUpgradeRatio: number;
  maxTargetValueRatio: number;
  cooldownMs: number;
  allowFromFreeBox: boolean;
  allowFromPromo: boolean;
}
