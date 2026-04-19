import { Timestamp } from 'firebase/firestore';

export type UpgraderSettings = {
  enabled: boolean;
  edgeMultiplier: number;
  maxExpectedPayoutRatio: number;
  minChance: number;
  maxChance: number;
  minUpgradeRatio: number;
  maxTargetValue?: number;
  cooldownMs: number;
  allowFromFreeBox: boolean;
  allowFromPromo: boolean;
  requireTargetHigherValue: boolean;
  sourceItemIdsEnabled?: string[];
  categoriesEnabled?: string[];
  raritiesEnabled?: string[];
  rarityBonusEnabled?: boolean;
  rarityBonusPercent?: number;
  vipBonusEnabled?: boolean;
  promoEventMultiplier?: number;
  serverSeedHash?: string;
  seedRotationRequiredAt?: Timestamp;
  auditLoggingEnabled?: boolean;
};

export type UpgraderTarget = {
  id: string;
  name: string;
  imageUrl: string;
  coinValue: number;
  rarity: string;
  category: string;
  enabled: boolean;
  featured?: boolean;
  upgraderSort?: number;
  weight?: number;
  minSourceValue?: number;
  maxSourceValue?: number;
};

export const DEFAULT_UPGRADER_SETTINGS: UpgraderSettings = {
  enabled: true,
  edgeMultiplier: 0.92,
  maxExpectedPayoutRatio: 0.98,
  minChance: 0.02,
  maxChance: 0.7,
  minUpgradeRatio: 1.25,
  cooldownMs: 1500,
  allowFromFreeBox: false,
  allowFromPromo: false,
  requireTargetHigherValue: true,
  sourceItemIdsEnabled: [],
  categoriesEnabled: [],
  raritiesEnabled: [],
  rarityBonusEnabled: false,
  rarityBonusPercent: 0,
  vipBonusEnabled: false,
  promoEventMultiplier: 1,
  auditLoggingEnabled: true
};

const toNumber = (value: unknown, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const normalizeUpgraderSettings = (value: Partial<UpgraderSettings> | null | undefined): UpgraderSettings => ({
  enabled: value?.enabled !== false,
  edgeMultiplier: (() => {
    const edgeRaw = Math.max(0, toNumber(value?.edgeMultiplier, DEFAULT_UPGRADER_SETTINGS.edgeMultiplier));
    return edgeRaw > 1 ? edgeRaw / 100 : edgeRaw;
  })(),
  maxExpectedPayoutRatio: Math.max(0, Math.min(1, toNumber(value?.maxExpectedPayoutRatio, DEFAULT_UPGRADER_SETTINGS.maxExpectedPayoutRatio))),
  minChance: Math.max(0, Math.min(1, toNumber(value?.minChance, DEFAULT_UPGRADER_SETTINGS.minChance))),
  maxChance: Math.max(0, Math.min(1, toNumber(value?.maxChance, DEFAULT_UPGRADER_SETTINGS.maxChance))),
  minUpgradeRatio: Math.max(1, toNumber(value?.minUpgradeRatio, DEFAULT_UPGRADER_SETTINGS.minUpgradeRatio)),
  maxTargetValue: value?.maxTargetValue == null ? undefined : Math.max(0, toNumber(value.maxTargetValue, 0)),
  cooldownMs: Math.max(0, Math.round(toNumber(value?.cooldownMs, DEFAULT_UPGRADER_SETTINGS.cooldownMs))),
  allowFromFreeBox: value?.allowFromFreeBox === true,
  allowFromPromo: value?.allowFromPromo === true,
  requireTargetHigherValue: value?.requireTargetHigherValue !== false,
  sourceItemIdsEnabled: Array.isArray(value?.sourceItemIdsEnabled) ? value?.sourceItemIdsEnabled.map((entry) => String(entry).trim()).filter(Boolean) : [],
  categoriesEnabled: Array.isArray(value?.categoriesEnabled) ? value?.categoriesEnabled.filter(Boolean) : [],
  raritiesEnabled: Array.isArray(value?.raritiesEnabled) ? value?.raritiesEnabled.filter(Boolean) : [],
  rarityBonusEnabled: value?.rarityBonusEnabled === true,
  rarityBonusPercent: Math.max(0, Math.min(0.5, toNumber(value?.rarityBonusPercent, 0))),
  vipBonusEnabled: value?.vipBonusEnabled === true,
  promoEventMultiplier: Math.max(0.1, Math.min(2, toNumber(value?.promoEventMultiplier, 1))),
  serverSeedHash: typeof value?.serverSeedHash === 'string' ? value.serverSeedHash : undefined,
  seedRotationRequiredAt: value?.seedRotationRequiredAt,
  auditLoggingEnabled: value?.auditLoggingEnabled !== false
});

export const getItemCoinValue = (item: { coinValue?: number; value?: number; price?: number }) =>
  Math.max(0, Number(item.coinValue ?? item.value ?? item.price ?? 0));

export const computeExpectedPayout = ({ chance, targetValue }: { chance: number; targetValue: number }) =>
  Math.max(0, chance) * Math.max(0, targetValue);

export const getMaxChanceFromExpectedPayout = ({
  sourceValue,
  targetValue,
  maxExpectedPayoutRatio
}: {
  sourceValue: number;
  targetValue: number;
  maxExpectedPayoutRatio: number;
}) => {
  if (!Number.isFinite(sourceValue) || !Number.isFinite(targetValue) || sourceValue <= 0 || targetValue <= 0) {
    return 0;
  }

  return Math.max(0, (sourceValue * Math.max(0, maxExpectedPayoutRatio)) / targetValue);
};

export const getProfitabilitySafety = ({
  chance,
  sourceValue,
  targetValue,
  maxExpectedPayoutRatio
}: {
  chance: number;
  sourceValue: number;
  targetValue: number;
  maxExpectedPayoutRatio: number;
}) => {
  const maxChance = getMaxChanceFromExpectedPayout({ sourceValue, targetValue, maxExpectedPayoutRatio });
  const clampedChance = Math.min(Math.max(0, chance), maxChance);
  const expectedPayout = computeExpectedPayout({ chance: clampedChance, targetValue });
  const expectedValueRatio = sourceValue > 0 ? expectedPayout / sourceValue : 0;

  return {
    maxChance,
    clampedChance,
    expectedPayout,
    expectedValueRatio,
    wasClamped: clampedChance < chance
  };
};

export const validateUpgraderSettings = (settings: UpgraderSettings) => {
  const issues: string[] = [];
  if (settings.maxChance < settings.minChance) {
    issues.push('Max chance must be greater than or equal to min chance.');
  }

  const profitabilityFloor = settings.minUpgradeRatio > 0
    ? settings.maxExpectedPayoutRatio / settings.minUpgradeRatio
    : 0;

  if (settings.minChance > profitabilityFloor) {
    issues.push('Min chance exceeds the configured expected value ceiling for the minimum upgrade ratio.');
  }

  return {
    ok: issues.length === 0,
    issues,
    profitabilityFloor
  };
};

export const computeUpgradeChance = ({
  sourceValue,
  targetValue,
  settings,
  isSameRarity,
  vipMultiplier
}: {
  sourceValue: number;
  targetValue: number;
  settings: UpgraderSettings;
  isSameRarity?: boolean;
  vipMultiplier?: number;
}) => {
  if (!Number.isFinite(sourceValue) || !Number.isFinite(targetValue) || sourceValue <= 0 || targetValue <= 0) {
    return 0;
  }

  const raw = sourceValue / targetValue;
  const edgeRaw = settings.edgeMultiplier ?? DEFAULT_UPGRADER_SETTINGS.edgeMultiplier;
  const edge = edgeRaw > 1 ? edgeRaw / 100 : edgeRaw;
  let chance = raw * edge;

  if (settings.rarityBonusEnabled && isSameRarity) {
    chance += settings.rarityBonusPercent ?? 0;
  }

  if (settings.vipBonusEnabled && vipMultiplier && vipMultiplier > 0) {
    chance *= vipMultiplier;
  }

  chance *= settings.promoEventMultiplier ?? 1;
  chance = Math.min(settings.maxChance, Math.max(settings.minChance, chance));
  return getProfitabilitySafety({
    chance,
    sourceValue,
    targetValue,
    maxExpectedPayoutRatio: settings.maxExpectedPayoutRatio ?? DEFAULT_UPGRADER_SETTINGS.maxExpectedPayoutRatio
  }).clampedChance;
};
