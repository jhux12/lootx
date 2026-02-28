export interface Item {
  id: string;
  name: string;
  price: number;
  image: string;
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic';
}

export type UpgradeStatus = 'idle' | 'spinning' | 'success' | 'fail';
