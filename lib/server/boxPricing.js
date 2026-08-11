const CACHE_TTL_MS = 18 * 60 * 60 * 1000;
const responseCache = new Map();

export const parseTcgplayerUrl = (input) => {
  let parsed;
  try { parsed = new URL(String(input || '').trim()); } catch { throw new Error('INVALID_TCGPLAYER_URL'); }
  const hostname = parsed.hostname.toLowerCase().replace(/^www\./, '');
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') throw new Error('INVALID_TCGPLAYER_URL');
  if (hostname !== 'tcgplayer.com') throw new Error('INVALID_TCGPLAYER_DOMAIN');
  const match = parsed.pathname.match(/^\/product\/(\d+)(?:\/|$)/i);
  if (!match || !/^\d+$/.test(match[1])) throw new Error('INVALID_TCGPLAYER_PRODUCT_ID');
  const cleanPath = parsed.pathname.replace(/\/+$/, '');
  return { productId: match[1], canonicalUrl: `https://www.tcgplayer.com${cleanPath}` };
};

const normalizeVariant = (value) => {
  const key = String(value || '').toLowerCase().replace(/[_\s]+/g, '-');
  if (key === 'reverse' || key === 'reverse-holo' || key === 'reverse-holofoil') return 'reverse-holofoil';
  if (key === 'holo' || key === 'holofoil') return 'holofoil';
  if (key === 'normal') return 'normal';
  return null;
};
const positive = (value) => Number.isFinite(Number(value)) && Number(value) > 0;
const idFrom = (node) => node?.productId ?? node?.product_id ?? node?.tcgplayerProductId;

export const extractTcgplayerVariants = (card, requiredProductId) => {
  const found = new Map();
  const visit = (node, hint = '', inheritedId = null) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) { node.forEach((entry) => visit(entry, entry?.variant || entry?.name || hint, inheritedId)); return; }
    const ownId = idFrom(node) ?? inheritedId;
    const ownVariant = normalizeVariant(node.variant || node.type || node.name || hint);
    const marketPrice = node.marketPrice ?? node.market_price;
    if (ownVariant && positive(marketPrice) && (!requiredProductId || String(ownId) === String(requiredProductId))) {
      found.set(ownVariant, { key: ownVariant, label: ownVariant === 'reverse-holofoil' ? 'Reverse holofoil' : ownVariant === 'holofoil' ? 'Holofoil' : 'Normal', marketPriceCents: Math.round(Number(marketPrice) * 100), marketPriceCoins: Math.round(Number(marketPrice) * 100), productId: ownId == null ? null : String(ownId), updatedAt: node.updatedAt || node.updated_at || null });
    }
    for (const [key, value] of Object.entries(node)) visit(value, normalizeVariant(key) || hint, ownId);
  };
  visit(card?.pricing?.tcgplayer || card?.pricing?.tcgPlayer || card?.tcgplayer);
  visit(card?.variants_detailed || card?.variantsDetailed);
  return [...found.values()];
};

const containsProductId = (node, productId) => {
  if (!node || typeof node !== 'object') return false;
  if (String(idFrom(node) ?? '') === String(productId)) return true;
  return Object.values(node).some((value) => containsProductId(value, productId));
};

const cachedJson = async (url, fetchImpl = fetch) => {
  const cached = responseCache.get(url), now = Date.now();
  if (cached && now - cached.at < CACHE_TTL_MS) return cached.value;
  const response = await fetchImpl(url, { headers: { accept: 'application/json' } });
  if (!response.ok) throw new Error(`TCGDEX_${response.status}`);
  const value = await response.json(); responseCache.set(url, { at: now, value }); return value;
};

export const findTcgplayerMatches = async ({ itemName, tcgplayerUrl, language = 'en', fetchImpl = fetch }) => {
  const parsed = parseTcgplayerUrl(tcgplayerUrl);
  const name = String(itemName || '').trim();
  if (!name) throw new Error('ITEM_NAME_REQUIRED');
  const summaries = await cachedJson(`https://api.tcgdex.net/v2/${encodeURIComponent(language)}/cards?name=${encodeURIComponent(name)}`, fetchImpl);
  const list = Array.isArray(summaries) ? summaries.slice(0, 50) : [];
  const cards = await Promise.all(list.filter((entry) => entry?.id).map((entry) => cachedJson(`https://api.tcgdex.net/v2/${encodeURIComponent(language)}/cards/${encodeURIComponent(entry.id)}`, fetchImpl)));
  return {
    ...parsed,
    matches: cards.filter((card) => containsProductId(card?.pricing, parsed.productId) || containsProductId(card?.variants_detailed, parsed.productId)).map((card) => ({
      tcgdexId: String(card.id), name: card.name || name, image: card.image || null,
      set: card.set?.name || card.set?.id || null, setId: card.set?.id || null,
      cardNumber: card.localId || card.number || null, rarity: card.rarity || null,
      productId: parsed.productId, providerUpdatedAt: card.pricing?.tcgplayer?.updatedAt || card.pricing?.updatedAt || null,
      variants: extractTcgplayerVariants(card, parsed.productId)
    }))
  };
};

export const effectiveItemValue = (item) => [item.effectiveValue, item.boxValueOverrideCoins, item.valueCoins, item.price, item.manualValue].map(Number).find((value) => Number.isFinite(value) && value >= 0) ?? 0;
export const calculatePricingSnapshot = (box, items = box.items || [], now = new Date().toISOString()) => {
  const values = items.map(effectiveItemValue), expectedValue = items.reduce((sum, item) => sum + Math.max(0, Number(item.chance) || 0) / 100 * effectiveItemValue(item), 0), boxPrice = Math.max(0, Number(box.price) || 0);
  return { expectedValue, marginAmount: boxPrice - expectedValue, marginPercent: boxPrice ? ((boxPrice - expectedValue) / boxPrice) * 100 : 0, minimumItemValue: values.length ? Math.min(...values) : 0, maximumItemValue: values.length ? Math.max(...values) : 0, calculatedAt: now };
};
export const withoutUndefined = (value) => Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined));
export const buildAppliedItem = ({ item, resolved, match, variant, now }) => {
  if (!variant || !Number.isInteger(variant.marketPriceCoins) || variant.marketPriceCoins <= 0) return item;
  const previousValue = effectiveItemValue(item);
  return withoutUndefined({ ...item, tcgplayerUrl: resolved.canonicalUrl, tcgplayerProductId: resolved.productId, tcgdexId: match.tcgdexId, pricingVariant: variant.key, marketPriceCoins: variant.marketPriceCoins, marketPriceCents: variant.marketPriceCents, priceSource: 'tcgdex_tcgplayer', priceUpdatedAt: variant.updatedAt || match.providerUpdatedAt || now, priceAppliedAt: now, previousValue: previousValue !== variant.marketPriceCoins ? previousValue : item.previousValue, effectiveValue: variant.marketPriceCoins, price: variant.marketPriceCoins, valueCoins: variant.marketPriceCoins, valueUsd: variant.marketPriceCents / 100, pricingStatus: 'current', pricingError: null });
};
export const clearTcgCache = () => responseCache.clear();
