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
  const targetUnits = 100 * factor;
  const rawUnits = items.map((item) => ((item.chance / total) * 100) * factor);
  const flooredUnits = rawUnits.map((value) => Math.floor(value));
  let unitsToDistribute = targetUnits - flooredUnits.reduce((sum, value) => sum + value, 0);

  if (unitsToDistribute > 0) {
    const fractionalOrder = rawUnits
      .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
      .sort((a, b) => b.fraction - a.fraction);

    for (let i = 0; i < fractionalOrder.length && unitsToDistribute > 0; i += 1) {
      flooredUnits[fractionalOrder[i].index] += 1;
      unitsToDistribute -= 1;
    }
  }

  return items.map((item, index) => ({
    ...item,
    chance: flooredUnits[index] / factor
  }));
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

  let lower = -1;
  let upper = 1;
  let bestItems = buildOddsFromWeights(items, baseWeights);
  let bestDiff = Math.abs(calculateExpectedValue(bestItems) / price - desiredEvRatio);

  // Deterministic search: nudge weight toward high or low values until EV matches target.
  for (let i = 0; i < 28; i += 1) {
    const mid = (lower + upper) / 2;
    const biasedWeights = baseWeights.map((weight, index) => {
      const itemPrice = Math.max(1, items[index].price);
      const normalized = (itemPrice - safeAverage) / safeAverage;
      const tilt = 1 + mid * normalized;
      const safeTilt = clamp(tilt, 0.05, 20);
      return weight * safeTilt;
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

export const runRiskBalanceDevCheck = () => {
  const sampleItems: CaseItem[] = [
    { name: 'Canvas Sticker', price: 2, image: '', rarity: 'common', chance: 0, color: '#9ca3af' },
    { name: 'Spray Paint', price: 6, image: '', rarity: 'common', chance: 0, color: '#9ca3af' },
    { name: 'Sports Bottle', price: 12, image: '', rarity: 'uncommon', chance: 0, color: '#22c55e' },
    { name: 'Leather Wallet', price: 20, image: '', rarity: 'uncommon', chance: 0, color: '#22c55e' },
    { name: 'Wireless Earbuds', price: 45, image: '', rarity: 'rare', chance: 0, color: '#3b82f6' },
    { name: 'Smart Speaker', price: 80, image: '', rarity: 'rare', chance: 0, color: '#3b82f6' },
    { name: 'Luxury Watch', price: 160, image: '', rarity: 'epic', chance: 0, color: '#a855f7' },
    { name: 'Collector Drone', price: 320, image: '', rarity: 'legendary', chance: 0, color: '#fbbf24' }
  ];

  const targetEV = 0.65;
  const price = 60;
  const safer = buildOddsWithRiskAndTargetEV(sampleItems, 10, targetEV, price);
  const riskier = buildOddsWithRiskAndTargetEV(sampleItems, 90, targetEV, price);

  const summarize = (label: string, items: CaseItem[]) => {
    const ev = calculateExpectedValue(items);
    console.log(`${label} (EV ratio ${(ev / price).toFixed(3)})`);
    items.forEach((item) => {
      console.log(`  ${item.name}: ${item.chance.toFixed(3)}%`);
    });
  };

  summarize('Risk 10', safer);
  summarize('Risk 90', riskier);

  const diffCount = sampleItems.reduce((count, item) => {
    const saferChance = safer.find((entry) => entry.name === item.name)?.chance ?? 0;
    const riskierChance = riskier.find((entry) => entry.name === item.name)?.chance ?? 0;
    return count + (Math.abs(saferChance - riskierChance) > 0.5 ? 1 : 0);
  }, 0);

  console.log(`Items with >0.5% swing: ${diffCount}`);
};
