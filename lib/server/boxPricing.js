const CACHE_TTL_MS = 18 * 60 * 60 * 1000;
const responseCache = new Map();

export const DEFAULT_MARKET_PRICING = Object.freeze({
  enabled: false, provider: 'tcgdex', marketplace: 'tcgplayer', autoApplyEnabled: false,
  autoApplyThresholdPercent: 20, lastCheckedAt: null, lastAppliedAt: null,
  status: 'never_synced', itemsChecked: 0, itemsUpdated: 0,
  itemsMissingPricing: 0, itemsPendingApproval: 0
});

export const marketPricingConfig = (value = {}) => ({ ...DEFAULT_MARKET_PRICING, ...(value || {}) });
export const effectiveItemValue = (item) => {
  const candidates = [item.effectiveValue, item.boxValueOverrideCoins, item.valueCoins, item.price, item.manualValue];
  const value = candidates.map(Number).find((entry) => Number.isFinite(entry) && entry >= 0);
  return value ?? 0;
};

export const calculatePricingSnapshot = (box, items = box.items || [], now = new Date().toISOString()) => {
  const values = items.map(effectiveItemValue);
  const expectedValue = items.reduce((sum, item) => sum + (Math.max(0, Number(item.chance) || 0) / 100) * effectiveItemValue(item), 0);
  const boxPrice = Math.max(0, Number(box.price) || 0);
  const marginAmount = boxPrice - expectedValue;
  return {
    expectedValue, marginAmount,
    marginPercent: boxPrice > 0 ? (marginAmount / boxPrice) * 100 : 0,
    minimumItemValue: values.length ? Math.min(...values) : 0,
    maximumItemValue: values.length ? Math.max(...values) : 0,
    calculatedAt: now
  };
};

const finitePositive = (value) => Number.isFinite(Number(value)) && Number(value) > 0;
const variants = { normal: ['normal'], reverse: ['reverse', 'reverseHolo', 'reverse_holo'], holo: ['holo', 'holofoil'] };
const lookupPrice = (node, variant) => {
  if (!node || typeof node !== 'object') return null;
  for (const key of variants[variant] || []) {
    const candidate = node[key];
    if (finitePositive(candidate?.marketPrice)) return { marketPrice: Number(candidate.marketPrice), lowPrice: finitePositive(candidate.lowPrice) ? Number(candidate.lowPrice) : null, updatedAt: candidate.updatedAt || node.updatedAt || null };
    if (finitePositive(candidate)) return { marketPrice: Number(candidate), lowPrice: null, updatedAt: node.updatedAt || null };
  }
  return null;
};

export const extractTcgplayerPrice = (card, variant) => {
  if (!['normal', 'reverse', 'holo'].includes(variant)) return null;
  const roots = [card?.pricing?.tcgplayer, card?.pricing?.tcgPlayer, card?.tcgplayer, card?.market?.tcgplayer];
  for (const root of roots) {
    const direct = lookupPrice(root, variant);
    if (direct) return direct;
    if (Array.isArray(root)) {
      const row = root.find((entry) => variants[variant].includes(String(entry?.variant || entry?.type || '').toLowerCase()));
      if (finitePositive(row?.marketPrice)) return { marketPrice: Number(row.marketPrice), lowPrice: finitePositive(row.lowPrice) ? Number(row.lowPrice) : null, updatedAt: row.updatedAt || null };
    }
  }
  return null;
};

export const getTcgCard = async (language, tcgdexId, { fetchImpl = fetch, now = Date.now() } = {}) => {
  const lang = String(language || 'en').toLowerCase();
  const id = String(tcgdexId || '').trim();
  if (!/^[a-z]{2}$/.test(lang) || !/^[a-z0-9-]+$/i.test(id)) throw new Error('EXACT_TCGDEX_CARD_REQUIRED');
  const key = `${lang}:${id}`;
  const cached = responseCache.get(key);
  if (cached && now - cached.cachedAt < CACHE_TTL_MS) return { ...cached, cacheHit: true };
  const response = await fetchImpl(`https://api.tcgdex.net/v2/${lang}/cards/${encodeURIComponent(id)}`, { headers: { accept: 'application/json' } });
  if (!response.ok) throw new Error(`TCGDEX_${response.status}`);
  const card = await response.json();
  if (!card?.id || String(card.id) !== id) throw new Error('UNCERTAIN_CARD_MATCH');
  const result = { card, cachedAt: now, cacheHit: false };
  responseCache.set(key, result);
  return result;
};

export const clearTcgCache = () => responseCache.clear();

export const previewBoxPricing = async (box, options = {}) => {
  const config = marketPricingConfig(box.marketPricing);
  const rows = [];
  for (const item of box.items || []) {
    if (item.pricingMode !== 'automatic') continue;
    const currentValue = effectiveItemValue(item);
    let proposedValue = null, marketLowPrice = null, providerUpdatedAt = null, status = 'ready', error = null, cacheHit = false;
    if (!item.tcgdexId || !item.tcgdexSetId || !item.tcgdexCardNumber) { status = 'uncertain_match'; error = 'Select an exact TCGdex set and card number.'; }
    else if (!['normal', 'reverse', 'holo'].includes(item.pricingVariant)) { status = 'missing_variant'; error = 'Select a supported pricing variant.'; }
    else try {
      const result = await getTcgCard(item.pricingLanguage || 'en', item.tcgdexId, options);
      cacheHit = result.cacheHit;
      const cardNumber = String(result.card.localId ?? result.card.number ?? '');
      const setId = String(result.card.set?.id ?? result.card.setId ?? '');
      if (cardNumber !== String(item.tcgdexCardNumber) || setId !== String(item.tcgdexSetId)) throw new Error('UNCERTAIN_CARD_MATCH');
      const price = extractTcgplayerPrice(result.card, item.pricingVariant);
      if (!price) { status = 'missing_pricing'; error = `No TCGplayer ${item.pricingVariant} market price.`; }
      else { proposedValue = price.marketPrice * 100; marketLowPrice = price.lowPrice == null ? null : price.lowPrice * 100; providerUpdatedAt = price.updatedAt; }
    } catch (cause) { status = cause?.message === 'UNCERTAIN_CARD_MATCH' ? 'uncertain_match' : 'provider_error'; error = String(cause?.message || 'TCGdex request failed').slice(0, 160); }
    const percentageChange = currentValue > 0 && proposedValue != null ? ((proposedValue - currentValue) / currentValue) * 100 : null;
    if (proposedValue != null && (!finitePositive(proposedValue) || proposedValue < 10)) { status = 'suspicious'; error = 'Proposed price is invalid or suspiciously low.'; proposedValue = null; }
    const requiresApproval = status !== 'ready' || currentValue <= 0 || Math.abs(percentageChange ?? Infinity) > Number(config.autoApplyThresholdPercent || 20);
    if (status === 'ready' && requiresApproval) status = 'pending_approval';
    rows.push({ itemId: item.id, item: item.name, currentValue, proposedValue, marketLowPrice, dollarChange: proposedValue == null ? null : proposedValue - currentValue, percentageChange, status, error, requiresApproval, providerUpdatedAt, cacheHit });
  }
  const proposedItems = (box.items || []).map((item) => { const row = rows.find((entry) => entry.itemId === item.id); return row?.proposedValue ? { ...item, effectiveValue: row.proposedValue } : item; });
  const now = new Date().toISOString();
  const currentSnapshot = calculatePricingSnapshot(box, box.items, now);
  const proposedSnapshot = calculatePricingSnapshot(box, proposedItems, now);
  const targetMargin = (1 - Math.max(0, Number(box.targetEV ?? .85))) * 100;
  const profitabilityWarning = proposedSnapshot.marginPercent < targetMargin;
  if (profitabilityWarning) rows.forEach((row) => { if (row.status === 'ready') { row.status = 'pending_approval'; row.requiresApproval = true; row.error = 'Proposed box EV is outside its profitability target.'; } });
  return { boxId: box.id, checkedAt: now, rows, currentSnapshot, proposedSnapshot, boxPrice: Number(box.price || 0), profitabilityWarning };
};
