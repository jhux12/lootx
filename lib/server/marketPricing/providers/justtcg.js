const JUSTTCG_BASE_URL = 'https://api.justtcg.com/v1';

const normalizeText = (value) => String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();

export function normalizeUsdPrice(value) {
  if (value == null) return null;

  let numeric = value;
  if (typeof value === 'string') {
    const cleaned = value.replace(/[$,\s]/g, '');
    if (!cleaned) return null;
    numeric = Number(cleaned);
  }

  if (typeof numeric !== 'number' || !Number.isFinite(numeric) || numeric <= 0) return null;

  const dollars = numeric > 1000 ? numeric / 100 : numeric;
  if (!Number.isFinite(dollars) || dollars <= 0) return null;
  return Math.round(dollars * 100) / 100;
}

const addCandidate = (candidates, field, value) => {
  const normalized = normalizeUsdPrice(value);
  if (normalized != null) candidates.push({ field, valueUsd: normalized });
};

const walkPriceObject = (candidates, prefix, value, depth = 0) => {
  if (depth > 4 || value == null) return;

  if (typeof value === 'number' || typeof value === 'string') {
    addCandidate(candidates, prefix, value);
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((entry, index) => walkPriceObject(candidates, `${prefix}[${index}]`, entry, depth + 1));
    return;
  }

  if (typeof value === 'object') {
    for (const [key, nested] of Object.entries(value)) {
      walkPriceObject(candidates, prefix ? `${prefix}.${key}` : key, nested, depth + 1);
    }
  }
};

export function flattenPossiblePrices(card) {
  const candidates = [];
  if (!card || typeof card !== 'object') return candidates;

  ['price', 'marketPrice', 'market_price', 'lowPrice', 'midPrice', 'highPrice'].forEach((field) => {
    addCandidate(candidates, field, card[field]);
  });

  ['prices', 'variants', 'printings'].forEach((field) => {
    walkPriceObject(candidates, field, card[field]);
  });

  const seen = new Set();
  return candidates.filter((candidate) => {
    const key = `${candidate.field}:${candidate.valueUsd}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

const conditionPreferences = (condition) => {
  if (condition === 'lightly_played') return ['lightlyplayed', 'played', 'low', 'market'];
  if (condition === 'sealed') return ['sealed', 'new', 'unopened'];
  if (condition === 'psa_10') return ['psa10', 'psa', 'graded'];
  if (condition === 'psa_9') return ['psa9', 'psa', 'graded'];
  return ['market', 'nearmint', 'normal', 'ungraded', 'loose', 'average'];
};

export function extractBestUsdPrice(card, condition = 'raw') {
  const prices = flattenPossiblePrices(card);
  if (prices.length === 0) return null;

  const normalizedFields = prices.map((price) => ({ ...price, normalizedField: normalizeText(price.field).replace(/\s/g, '') }));
  for (const preference of conditionPreferences(condition)) {
    const match = normalizedFields.find((price) => price.normalizedField.includes(preference));
    if (match) return { valueUsd: match.valueUsd, selectedPriceField: match.field };
  }

  return { valueUsd: prices[0].valueUsd, selectedPriceField: prices[0].field };
}

const looksLikeCard = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return Boolean(value.id || value.tcgplayerId || value.tcgplayer_id || value.name || value.cardName || value.title);
};

const extractCards = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== 'object') return [];

  for (const key of ['data', 'cards', 'results', 'items']) {
    if (Array.isArray(payload[key])) return payload[key];
  }

  if (payload.data && typeof payload.data === 'object') {
    if (looksLikeCard(payload.data)) return [payload.data];
    for (const key of ['cards', 'results', 'items']) {
      if (Array.isArray(payload.data[key])) return payload.data[key];
    }
  }

  return looksLikeCard(payload) ? [payload] : [];
};

const idValuesFor = (card) => [
  card?.id,
  card?.cardId,
  card?.card_id,
  card?.justtcgId,
  card?.justtcg_id,
  card?.tcgplayerId,
  card?.tcgplayer_id,
  card?.tcgPlayerId,
  card?.externalId
].filter((value) => value != null).map((value) => String(value));

const getCardName = (card) => card?.name || card?.cardName || card?.title || card?.productName || '';

const findBestCard = (cards, sourceId, query, condition) => {
  const cardsWithPrices = cards.map((card) => ({ card, price: extractBestUsdPrice(card, condition) })).filter((entry) => entry.price);
  if (cardsWithPrices.length === 0) return null;

  if (sourceId) {
    const normalizedSourceId = String(sourceId);
    const idMatch = cardsWithPrices.find(({ card }) => idValuesFor(card).some((id) => id === normalizedSourceId));
    if (idMatch) return idMatch;
  }

  const normalizedQuery = normalizeText(query);
  if (normalizedQuery) {
    const nameMatch = cardsWithPrices.find(({ card }) => normalizeText(getCardName(card)) === normalizedQuery);
    if (nameMatch) return nameMatch;
  }

  return cardsWithPrices[0];
};

const responsePreview = (payload) => {
  if (Array.isArray(payload)) return payload.slice(0, 2);
  if (!payload || typeof payload !== 'object') return payload;
  const preview = {};
  for (const [key, value] of Object.entries(payload).slice(0, 8)) {
    preview[key] = Array.isArray(value) ? value.slice(0, 2) : value;
  }
  return preview;
};

export async function getJustTcgPrice(item) {
  const apiKey = process.env.JUSTTCG_API_KEY;
  if (!apiKey) {
    throw new Error('JUSTTCG_API_KEY is not configured. Add it in Vercel and redeploy.');
  }

  const pricing = item.marketPricing || {};
  const lookup = pricing.sourceId || pricing.query || item.name;
  if (!lookup) throw new Error('JustTCG lookup requires sourceId, query, or item name.');

  const condition = pricing.condition || 'raw';
  const game = pricing.game || 'Pokemon';
  const url = new URL('/v1/cards', JUSTTCG_BASE_URL);
  const params = new URLSearchParams();
  params.set('limit', '10');
  params.set('game', game);

  if (pricing.sourceId) {
    params.set('id', pricing.sourceId);
    if (/^\d+$/.test(String(pricing.sourceId))) {
      params.set('tcgplayerId', pricing.sourceId);
    }
    params.set('q', pricing.sourceId);
  } else {
    params.set('q', lookup);
    params.set('name', lookup);
  }

  url.search = params.toString();
  console.info('JustTCG market pricing lookup', { queryUsed: lookup, game, condition, hasSourceId: Boolean(pricing.sourceId) });

  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'x-api-key': apiKey
    }
  });

  const responseText = await response.text();
  let payload = null;
  try {
    payload = responseText ? JSON.parse(responseText) : null;
  } catch {
    payload = { raw: responseText };
  }

  if (!response.ok) {
    const providerMessage = payload?.message || payload?.error || response.statusText;
    throw new Error(`JustTCG lookup failed with status ${response.status}: ${providerMessage}`);
  }

  const cards = extractCards(payload);
  const match = findBestCard(cards, pricing.sourceId, pricing.query || item.name, condition);
  if (!match) throw new Error(`JustTCG returned no usable market price for "${lookup}".`);

  const matchedCard = match.card;
  const matchedName = getCardName(matchedCard);
  const matchedIds = idValuesFor(matchedCard);
  const matchedSourceId = matchedIds[0] || pricing.sourceId || lookup;

  console.info('JustTCG market pricing match', {
    queryUsed: lookup,
    matchedName,
    matchedSourceId,
    selectedPriceField: match.price.selectedPriceField,
    valueUsd: match.price.valueUsd
  });

  return {
    source: 'justtcg',
    sourceId: matchedSourceId,
    valueUsd: match.price.valueUsd,
    raw: {
      queryUsed: lookup,
      matchedName,
      selectedPriceField: match.price.selectedPriceField,
      providerResponsePreview: responsePreview(payload)
    }
  };
}
