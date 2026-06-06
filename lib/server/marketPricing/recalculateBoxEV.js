import { admin, db } from '../../../api/_lib/firebaseAdmin.js';

const RISK_EXPONENT_MAX = 1.8;
const RISK_EXPONENT_MIN = 0.6;
const CHANCE_DECIMALS = 4;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const valueCoinsForPrize = (item, latestItem) => {
  const candidate = latestItem || item || {};
  const value = candidate.valueCoins ?? candidate.price ?? candidate.value ?? item?.valueCoins ?? item?.price ?? item?.value ?? 0;
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : 0;
};

const probabilityForPrize = (item) => {
  const raw = Number(item?.probability ?? item?.chance ?? item?.weight ?? 0);
  if (!Number.isFinite(raw) || raw <= 0) return 0;
  return raw > 1 ? raw / 100 : raw;
};

const auditStatus = (marginPercent) => {
  if (marginPercent >= 0.25) return 'healthy';
  if (marginPercent >= 0.10) return 'warning';
  return 'danger';
};

const calculateExpectedValue = (items) =>
  items.reduce((sum, item) => sum + valueCoinsForPrize(item) * (Number(item.chance ?? item.weight ?? 0) / 100), 0);

const calculateOddsTotal = (items) =>
  items.reduce((sum, item) => sum + Number(item.chance ?? item.weight ?? 0), 0);

const normalizeChances = (items) => {
  const total = calculateOddsTotal(items);
  if (total === 0) return items;

  const factor = 10 ** CHANCE_DECIMALS;
  const targetUnits = 100 * factor;
  const rawUnits = items.map((item) => ((Number(item.chance ?? item.weight ?? 0) / total) * 100) * factor);
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

  return items.map((item, index) => ({ ...item, chance: flooredUnits[index] / factor }));
};

const getRiskWeights = (items, riskLevel) => {
  const clamped = clamp(Number(riskLevel) || 0, 0, 100);
  const riskExponent = RISK_EXPONENT_MAX - (clamped / 100) * (RISK_EXPONENT_MAX - RISK_EXPONENT_MIN);
  return items.map((item) => 1 / Math.pow(Math.max(1, valueCoinsForPrize(item)), riskExponent));
};

const buildOddsFromWeights = (items, weights) => {
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  if (!totalWeight) return items;

  const initial = items.map((item, index) => ({
    ...item,
    chance: (weights[index] / totalWeight) * 100
  }));

  return normalizeChances(initial);
};

const buildRiskAdjustedOdds = (items, riskLevel) => buildOddsFromWeights(items, getRiskWeights(items, riskLevel));

const buildOddsWithRiskAndTargetEV = (items, riskLevel, targetEV, price) => {
  if (items.length === 0) return items;
  if (price <= 0 || targetEV <= 0) return buildRiskAdjustedOdds(items, riskLevel);

  const baseWeights = getRiskWeights(items, riskLevel);
  const averagePrice = items.reduce((sum, item) => sum + valueCoinsForPrize(item), 0) / items.length || 1;
  const safeAverage = Math.max(1, averagePrice);
  const desiredEvRatio = targetEV;
  let lower = -1;
  let upper = 1;
  let bestItems = buildOddsFromWeights(items, baseWeights);
  let bestDiff = Math.abs(calculateExpectedValue(bestItems) / price - desiredEvRatio);

  for (let i = 0; i < 28; i += 1) {
    const mid = (lower + upper) / 2;
    const biasedWeights = baseWeights.map((weight, index) => {
      const itemPrice = Math.max(1, valueCoinsForPrize(items[index]));
      const normalized = (itemPrice - safeAverage) / safeAverage;
      const tilt = 1 + mid * normalized;
      return weight * clamp(tilt, 0.05, 20);
    });
    const candidateItems = buildOddsFromWeights(items, biasedWeights);
    const candidateRatio = calculateExpectedValue(candidateItems) / price;
    const diff = Math.abs(candidateRatio - desiredEvRatio);
    if (diff < bestDiff) {
      bestItems = candidateItems;
      bestDiff = diff;
    }
    if (candidateRatio > desiredEvRatio) upper = mid;
    else lower = mid;
  }

  return bestItems;
};

const refreshPrizeFromCatalog = (prize, latestItem) => {
  if (!latestItem) return prize;
  const valueCoins = valueCoinsForPrize(prize, latestItem);
  return {
    ...prize,
    price: valueCoins,
    valueCoins,
    valueUsd: latestItem.valueUsd ?? Math.round((valueCoins / 100) * 100) / 100,
    sellBackCoins: latestItem.sellBackCoins ?? Math.floor(valueCoins * 0.8),
    marketPricing: latestItem.marketPricing ?? prize.marketPricing
  };
};

export async function recalculateBoxesForItem(itemId) {
  const boxesSnapshot = await db.collection('boxes').get();
  const affected = [];

  for (const boxDoc of boxesSnapshot.docs) {
    const box = boxDoc.data() || {};
    const usesItemsField = Array.isArray(box.items);
    const prizes = usesItemsField ? box.items : Array.isArray(box.prizes) ? box.prizes : [];
    if (!prizes.some((prize) => String(prize?.id || prize?.itemId || '') === String(itemId))) continue;

    const itemRefs = prizes.map((prize) => String(prize?.id || prize?.itemId || '')).filter(Boolean);
    const latestItems = new Map();
    await Promise.all([...new Set(itemRefs)].map(async (id) => {
      try {
        const snap = await db.collection('items').doc(id).get();
        if (snap.exists) latestItems.set(id, snap.data());
      } catch (error) {
        console.error('Failed to load item for EV recalculation', id, error);
      }
    }));

    const refreshedPrizes = prizes.map((prize) => {
      const id = String(prize?.id || prize?.itemId || '');
      return refreshPrizeFromCatalog(prize, latestItems.get(id));
    });
    const boxPriceCoins = Math.max(0, Number(box.priceCoins ?? box.price ?? 0) || 0);
    const targetEV = Number.isFinite(Number(box.targetEV)) ? clamp(Number(box.targetEV), 0.5, 1.5) : 0.85;
    const riskLevel = Number.isFinite(Number(box.riskLevel)) ? clamp(Number(box.riskLevel), 0, 100) : 50;
    const recalculatedPrizes = buildOddsWithRiskAndTargetEV(refreshedPrizes, riskLevel, targetEV, boxPriceCoins);
    const expectedValueCoins = Math.round(calculateExpectedValue(recalculatedPrizes));
    const marginCoins = Math.round(boxPriceCoins - expectedValueCoins);
    const marginPercent = boxPriceCoins > 0 ? Math.round((marginCoins / boxPriceCoins) * 10000) / 10000 : 0;
    const status = auditStatus(marginPercent);
    const audit = {
      lastCheckedAt: admin.firestore.FieldValue.serverTimestamp(),
      expectedValueCoins,
      boxPriceCoins,
      marginCoins,
      marginPercent,
      status,
      needsReview: status === 'danger'
    };

    const prizeUpdate = usesItemsField ? { items: recalculatedPrizes } : { prizes: recalculatedPrizes };
    await boxDoc.ref.set({ ...prizeUpdate, marketValueAudit: audit }, { merge: true });
    affected.push({ id: boxDoc.id, name: box.name || 'Mystery Box', status, marginPercent });
  }

  return affected;
}
