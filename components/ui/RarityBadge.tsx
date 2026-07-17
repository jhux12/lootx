import React from 'react';
import { Badge } from './Badge';
export type Rarity = 'common'|'uncommon'|'rare'|'epic'|'legendary';
const classes: Record<Rarity,string> = { common:'border-slate-400/25 bg-slate-400/10 text-slate-300', uncommon:'border-emerald-400/30 bg-emerald-400/10 text-emerald-300', rare:'border-blue-400/30 bg-blue-400/10 text-blue-300', epic:'border-purple-400/30 bg-purple-400/10 text-purple-300', legendary:'border-pullz-gold/35 bg-pullz-gold-soft text-pullz-gold' };
export const RarityBadge = ({ rarity, className='' }: { rarity: Rarity; className?: string }) => <Badge className={`${classes[rarity]} ${className}`}>{rarity}</Badge>;
