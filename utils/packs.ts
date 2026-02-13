import { CaseItem, MysteryBox, ValueDistributionBracket } from '../types';

export const getPackType = (box: MysteryBox): string => {
  if (box.packType && box.packType.trim()) return box.packType.trim();
  const slug = box.id.replace(/-(\d+|\d+k)$/i, '').trim();
  return slug || box.id;
};

export const getTierRank = (box: MysteryBox): number => {
  const tierFromId = Number(box.tierId);
  if (Number.isFinite(tierFromId) && tierFromId > 0) return tierFromId;
  return Number(box.price ?? 0);
};

const DISTRIBUTION_BRACKETS = [
  { key: '1-25', min: 1, max: 25 },
  { key: '25-50', min: 25, max: 50 },
  { key: '50-100', min: 50, max: 100 },
  { key: '100-250', min: 100, max: 250 },
  { key: '250+', min: 250, max: Infinity },
] as const;

export const buildValueDistribution = (items: CaseItem[]): ValueDistributionBracket[] => {
  if (!Array.isArray(items) || items.length === 0) return [];
  const totalWeight = items.reduce((sum, item) => sum + Math.max(0, Number(item.chance ?? 0)), 0);
  if (totalWeight <= 0) return [];

  const distribution = DISTRIBUTION_BRACKETS.map((bucket) => {
    const bucketWeight = items.reduce((sum, item) => {
      const value = Number(item.price ?? 0);
      const chance = Math.max(0, Number(item.chance ?? 0));
      const inRange = value >= bucket.min && value < bucket.max;
      return inRange ? sum + chance : sum;
    }, 0);
    return {
      min: bucket.min,
      max: Number.isFinite(bucket.max) ? bucket.max : undefined,
      chance: Number(((bucketWeight / totalWeight) * 100).toFixed(2)),
    };
  });

  const sum = distribution.reduce((acc, bracket) => acc + bracket.chance, 0);
  const drift = Number((100 - sum).toFixed(2));
  if (distribution.length > 0 && drift !== 0) {
    distribution[distribution.length - 1].chance = Number((distribution[distribution.length - 1].chance + drift).toFixed(2));
  }
  return distribution;
};
