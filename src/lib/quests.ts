export type QuestType = 'unboxing_count' | 'sell_back_count' | 'sell_back_value' | 'unbox_rarity';

export type QuestRule = {
  id: string;
  title: string;
  description?: string;
  type: QuestType;
  target: number;
  rewardCoins: number;
  rarity?: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
  enabled?: boolean;
};

export type QuestProgressStats = {
  boxesOpened?: number;
  sellBackItems?: number;
  sellBackCoins?: number;
  upgraderUses?: number;
  rarityUnboxed?: Record<string, number>;
};

export const DEFAULT_QUEST_RULES: QuestRule[] = [
  { id: 'open-3-boxes', title: 'Unboxing mission', description: 'Open 3 boxes today.', type: 'unboxing_count', target: 3, rewardCoins: 50, enabled: true },
  { id: 'sell-2-items', title: 'Sell back mission', description: 'Sell back 2 items today.', type: 'sell_back_count', target: 2, rewardCoins: 40, enabled: true },
  { id: 'sell-200-coins', title: 'Sell back value mission', description: 'Sell back 200 coins worth today.', type: 'sell_back_value', target: 200, rewardCoins: 60, enabled: true },
  { id: 'unbox-rare', title: 'Rarity mission', description: 'Unbox 1 rare item today.', type: 'unbox_rarity', target: 1, rewardCoins: 80, rarity: 'rare', enabled: true }
];

export const normalizeQuestRules = (raw: unknown): QuestRule[] => {
  if (!Array.isArray(raw)) return DEFAULT_QUEST_RULES;
  const normalized = raw
    .map((entry, index) => {
      const candidate = entry as Partial<QuestRule>;
      const type = candidate.type;
      if (!type || !['unboxing_count', 'sell_back_count', 'sell_back_value', 'unbox_rarity'].includes(type)) return null;
      const id = typeof candidate.id === 'string' && candidate.id.trim() ? candidate.id.trim() : `quest-${index + 1}`;
      return {
        id,
        title: typeof candidate.title === 'string' && candidate.title.trim() ? candidate.title.trim() : 'Quest',
        description: typeof candidate.description === 'string' ? candidate.description : '',
        type,
        target: Math.max(1, Math.floor(Number(candidate.target) || 1)),
        rewardCoins: Math.max(0, Math.floor(Number(candidate.rewardCoins) || 0)),
        rarity: candidate.rarity,
        enabled: candidate.enabled !== false
      } as QuestRule;
    })
    .filter((entry): entry is QuestRule => Boolean(entry));

  return normalized.length ? normalized : DEFAULT_QUEST_RULES;
};

export const getQuestProgressValue = (rule: QuestRule, stats: QuestProgressStats): number => {
  switch (rule.type) {
    case 'unboxing_count':
      return Number(stats.boxesOpened ?? 0);
    case 'sell_back_count':
      return Number(stats.sellBackItems ?? 0);
    case 'sell_back_value':
      return Number(stats.sellBackCoins ?? 0);
    case 'unbox_rarity':
      return Number(stats.rarityUnboxed?.[rule.rarity ?? 'rare'] ?? 0);
    default:
      return 0;
  }
};

export const getClaimReadyQuestCount = (rules: QuestRule[], stats: QuestProgressStats, claims: Record<string, string>, dayKey: string) => (
  rules.filter((rule) => rule.enabled !== false && getQuestProgressValue(rule, stats) >= rule.target && claims?.[rule.id] !== dayKey).length
);
