import { Item } from './types';

export const RARITY_COLORS: Record<Item['rarity'], string> = {
  common: 'border-slate-500 text-slate-300',
  uncommon: 'border-emerald-500 text-emerald-400',
  rare: 'border-blue-500 text-blue-400',
  epic: 'border-blue-500 text-blue-400',
  legendary: 'border-amber-500 text-amber-400',
  mythic: 'border-sky-500 text-sky-400'
};

export const RARITY_BG: Record<Item['rarity'], string> = {
  common: 'bg-slate-500/10',
  uncommon: 'bg-emerald-500/10',
  rare: 'bg-blue-500/10',
  epic: 'bg-blue-500/10',
  legendary: 'bg-amber-500/10',
  mythic: 'bg-sky-500/10'
};
