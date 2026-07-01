import { firestore } from './firebaseAdmin.js';

const DEFAULT_SETTINGS = {
  enabled: true,
  minItems: 5,
  maxItems: 0,
  targetRtp: 0.7,
  eligibleBoxIds: [],
  eligibleCategories: [],
  discountTiers: []
};

const toNum = (v, f = 0) => { const n = Number(v); return Number.isFinite(n) ? n : f; };
const norm = (s) => String(s ?? '').trim().toLowerCase();
const isPositive = (v) => Number.isFinite(Number(v)) && Number(v) > 0;
const hasImage = (v) => typeof v === 'string' && /^https?:\/\//i.test(v.trim());

export async function getBuildBoxSettings(transaction = null) {
  const ref = firestore.collection('settings').doc('buildBox');
  const snap = transaction ? await transaction.get(ref) : await ref.get();
  const raw = snap.exists ? snap.data() ?? {} : {};
  return {
    ...DEFAULT_SETTINGS,
    ...raw,
    enabled: raw.enabled === false ? false : true,
    minItems: Math.max(1, Math.floor(toNum(raw.minItems, DEFAULT_SETTINGS.minItems))),
    maxItems: Math.max(0, Math.floor(toNum(raw.maxItems, DEFAULT_SETTINGS.maxItems))),
    targetRtp: DEFAULT_SETTINGS.targetRtp,
    eligibleBoxIds: Array.isArray(raw.eligibleBoxIds) ? raw.eligibleBoxIds.filter((x) => typeof x === 'string') : [],
    eligibleCategories: Array.isArray(raw.eligibleCategories) ? raw.eligibleCategories.map(norm).filter(Boolean) : [],
    discountTiers: Array.isArray(raw.discountTiers) ? raw.discountTiers : []
  };
}

const boxIsEligible = (box, settings) => {
  if (!box) return false;
  if (box.disabled === true || box.enabled === false || box.hidden === true || box.isHidden === true || box.draft === true || box.status === 'draft' || box.public === false) return false;
  if (box.isUserCreated === true) return false;
  if (settings.eligibleBoxIds.length && !settings.eligibleBoxIds.includes(box.id)) return false;
  return true;
};

const itemKey = (item) => String(item.itemId ?? item.sourceItemId ?? item.sku ?? item.id ?? item.name ?? '').trim().toLowerCase();
const itemValue = (item) => toNum(item.valueCoins ?? item.value ?? item.price ?? item.boxValueOverrideCoins, 0);
const itemIsEligible = (item, settings) => {
  if (!item || typeof item !== 'object') return false;
  if (item.disabled === true || item.enabled === false || item.hidden === true || item.adminOnly === true || item.test === true) return false;
  if (item.stockTracked === true || item.trackStock === true || item.limitedStock === true) {
    const stock = toNum(item.stock ?? item.quantity ?? item.remainingStock, 0);
    if (stock <= 0) return false;
  }
  if (!hasImage(item.image)) return false;
  if (!isPositive(itemValue(item))) return false;
  if (settings.eligibleCategories.length) {
    const cat = norm(item.category);
    if (!settings.eligibleCategories.includes(cat)) return false;
  }
  return Boolean(itemKey(item));
};

export async function loadEligibleBuildBoxItems(selectedIds = [], transaction = null) {
  const settings = await getBuildBoxSettings(transaction);
  if (!settings.enabled) throw Object.assign(new Error('Build a Box is currently disabled.'), { status: 403, error: 'BUILD_BOX_DISABLED' });
  const boxesSnap = transaction ? await transaction.get(firestore.collection('boxes').limit(500)) : await firestore.collection('boxes').limit(500).get();
  const byKey = new Map();
  boxesSnap.docs.forEach((doc) => {
    const box = { id: doc.id, ...(doc.data() ?? {}) };
    if (!boxIsEligible(box, settings)) return;
    const rawItems = Array.isArray(box.items) ? box.items : (Array.isArray(box.prizes) ? box.prizes : []);
    rawItems.forEach((raw, index) => {
      if (!itemIsEligible(raw, settings)) return;
      const key = itemKey(raw);
      if (!key) return;
      const value = itemValue(raw);
      const existing = byKey.get(key);
      const entry = {
        id: key,
        originalId: raw.id ?? key,
        name: raw.name ?? 'Mystery Item',
        image: raw.image,
        value,
        price: value,
        rarity: String(raw.rarity ?? 'common').toLowerCase(),
        category: raw.category ?? '',
        brand: raw.brand ?? '',
        color: raw.color ?? '#8b5cf6',
        redeemable: raw.redeemable ?? true,
        forceFullSellBack: raw.forceFullSellBack === true,
        sourceBoxes: [{ id: box.id, name: box.name ?? 'Mystery Box' }],
        primaryBoxId: box.id,
        primaryBoxName: box.name ?? 'Mystery Box',
        sourceIndex: index
      };
      if (existing) {
        if (!existing.sourceBoxes.some((s) => s.id === box.id)) existing.sourceBoxes.push({ id: box.id, name: box.name ?? 'Mystery Box' });
      } else byKey.set(key, entry);
    });
  });
  const items = [...byKey.values()];
  if (!selectedIds.length) return { settings, items };
  const wanted = new Set(selectedIds.map(norm));
  return { settings, items: items.filter((item) => wanted.has(norm(item.id))) };
}

export function buildQuote(items, settings) {
  const min = settings.minItems;
  if (items.length < min) throw Object.assign(new Error(`Choose at least ${min} possible pulls to build your box.`), { status: 400, error: 'MIN_ITEMS' });
  if (settings.maxItems > 0 && items.length > settings.maxItems) throw Object.assign(new Error(`Choose ${settings.maxItems} or fewer possible pulls.`), { status: 400, error: 'MAX_ITEMS' });
  const distinctValues = new Set(items.map((i) => Math.round(i.value))).size;
  const distinctRarities = new Set(items.map((i) => i.rarity)).size;
  if (distinctValues < 2 && distinctRarities < 2) throw Object.assign(new Error('Choose at least two distinct item values or rarity tiers.'), { status: 400, error: 'POOL_VARIETY' });
  const invWeights = items.map((item) => 1 / Math.max(1, item.value));
  const totalInv = invWeights.reduce((a, b) => a + b, 0);
  let odds = items.map((item, idx) => ({ ...item, probability: invWeights[idx] / totalInv }));
  const cap = Math.min(0.55, Math.max(0.25, 2 / Math.max(3, items.length)));
  const floor = 0.0001;
  odds = odds.map((o) => ({ ...o, probability: Math.min(cap, Math.max(floor, o.probability)) }));
  const total = odds.reduce((a, o) => a + o.probability, 0);
  odds = odds.map((o) => ({ ...o, probability: o.probability / total }));
  const expectedValue = odds.reduce((sum, o) => sum + o.value * o.probability, 0);
  const price = Math.max(1, Math.ceil((expectedValue / settings.targetRtp) / 5) * 5);
  const oddsItems = odds.map((o) => ({ ...o, chance: Number((o.probability * 100).toFixed(4)), weight: Number((o.probability * 1000000).toFixed(0)) }));
  const diff = 100 - oddsItems.reduce((s, o) => s + o.chance, 0);
  oddsItems[0].chance = Number((oddsItems[0].chance + diff).toFixed(4));
  return { price, originalPrice: price, savings: 0, expectedValue: Math.round(expectedValue), targetRtp: settings.targetRtp, items: oddsItems };
}
