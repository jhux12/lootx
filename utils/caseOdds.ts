import { CaseItem } from '../types';

const RISK_EXPONENT_MAX = 1.8;
const RISK_EXPONENT_MIN = 0.6;
const CHANCE_DECIMALS = 4;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export const getRiskLabel = (riskLevel: number) => {
  const clamped = clamp(riskLevel, 0, 100);
  if (clamped <= 25) return 'Safe';
  if (clamped <= 45) return 'Low Risk';
  if (clamped <= 60) return 'Balanced';
  if (clamped <= 75) return 'High Risk';
  return 'Extreme';
};

export const calculateExpectedValue = (items: CaseItem[]) =>
  items.reduce((sum, item) => sum + item.price * (item.chance / 100), 0);

export const calculateOddsTotal = (items: CaseItem[]) =>
  items.reduce((sum, item) => sum + item.chance, 0);

const applyRarityFromChance = (item: CaseItem) => {
  let rarity: CaseItem['rarity'] = 'common';
  let color = '#9ca3af';

  if (item.chance < 0.5) { rarity = 'legendary'; color = '#fbbf24'; }
  else if (item.chance < 5) { rarity = 'epic'; color = '#a855f7'; }
  else if (item.chance < 15) { rarity = 'rare'; color = '#3b82f6'; }
  else if (item.chance < 40) { rarity = 'uncommon'; color = '#22c55e'; }

  return { ...item, rarity, color };
};

const normalizeChances = (items: CaseItem[]) => {
  const total = calculateOddsTotal(items);
  if (total === 0) return items;

  const factor = 10 ** CHANCE_DECIMALS;
  const normalized = items.map((item) => ({
    ...item,
    chance: Math.round(((item.chance / total) * 100) * factor) / factor
  }));

  const normalizedTotal = calculateOddsTotal(normalized);
  const diff = Math.round((100 - normalizedTotal) * factor) / factor;

  if (Math.abs(diff) > 0) {
    const targetIndex = normalized.reduce((bestIndex, item, index, list) =>
      item.chance > list[bestIndex].chance ? index : bestIndex, 0);
    normalized[targetIndex] = {
      ...normalized[targetIndex],
      chance: Math.round((normalized[targetIndex].chance + diff) * factor) / factor
    };
  }

  return normalized;
};

const getRiskWeights = (items: CaseItem[], riskLevel: number) => {
  const clamped = clamp(riskLevel, 0, 100);
  const riskExponent = RISK_EXPONENT_MAX - (clamped / 100) * (RISK_EXPONENT_MAX - RISK_EXPONENT_MIN);
  return items.map((item) => 1 / Math.pow(Math.max(1, item.price), riskExponent));
};

const buildOddsFromWeights = (items: CaseItem[], weights: number[]) => {
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  if (!totalWeight) return items;

  const initial = items.map((item, index) => ({
    ...item,
    chance: (weights[index] / totalWeight) * 100
  }));

  return normalizeChances(initial).map(applyRarityFromChance);
};

export const buildRiskAdjustedOdds = (items: CaseItem[], riskLevel: number) => {
  const weights = getRiskWeights(items, riskLevel);
  return buildOddsFromWeights(items, weights);
};

export const buildOddsWithRiskAndTargetEV = (
  items: CaseItem[],
  riskLevel: number,
  targetEV: number,
  price: number
) => {
  if (items.length === 0) return items;
  if (price <= 0 || targetEV <= 0) {
    return buildRiskAdjustedOdds(items, riskLevel);
  }

  const baseWeights = getRiskWeights(items, riskLevel);
  const averagePrice = items.reduce((sum, item) => sum + item.price, 0) / items.length || 1;
  const safeAverage = Math.max(1, averagePrice);
  const desiredEvRatio = targetEV;

  let lower = -3;
  let upper = 3;
  let bestItems = buildOddsFromWeights(items, baseWeights);
  let bestDiff = Math.abs(calculateExpectedValue(bestItems) / price - desiredEvRatio);

  // Deterministic search: nudge weight toward high or low values until EV matches target.
  for (let i = 0; i < 28; i += 1) {
    const mid = (lower + upper) / 2;
    const biasedWeights = baseWeights.map((weight, index) => {
      const valueFactor = Math.pow(Math.max(1, items[index].price) / safeAverage, mid);
      return weight * valueFactor;
    });
    const candidateItems = buildOddsFromWeights(items, biasedWeights);
    const candidateRatio = calculateExpectedValue(candidateItems) / price;
    const diff = Math.abs(candidateRatio - desiredEvRatio);

    if (diff < bestDiff) {
      bestItems = candidateItems;
      bestDiff = diff;
    }

    if (candidateRatio > desiredEvRatio) {
      upper = mid;
    } else {
      lower = mid;
    }
  }

  return bestItems;
};
