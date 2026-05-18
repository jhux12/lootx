import { Item } from './types';

export const RARITY_COLORS: Record<Item['rarity'], string> = {
  common: 'border-gray-500 text-gray-300',
  uncommon: 'border-green-500 text-green-400',
  rare: 'border-blue-500 text-blue-400',
  epic: 'border-purple-500 text-purple-400',
  legendary: 'border-amber-500 text-amber-400',
  mythic: 'border-sky-500 text-sky-400'
};

export const RARITY_BG: Record<Item['rarity'], string> = {
  common: 'bg-gray-500/10',
  uncommon: 'bg-green-500/10',
  rare: 'bg-blue-500/10',
  epic: 'bg-purple-500/10',
  legendary: 'bg-amber-500/10',
  mythic: 'bg-sky-500/10'
};
