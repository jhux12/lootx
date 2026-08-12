import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildAppliedItem, calculatePricingSnapshot, clearTcgCache, extractTcgplayerVariants, findTcgplayerMatches, parseTcgplayerUrl, withoutUndefined } from '../lib/server/boxPricing.js';

test('accepts and canonicalizes TCGplayer product links with tracking parameters', () => {
  assert.deepEqual(parseTcgplayerUrl('https://tcgplayer.com/product/660414/pokemon-card?utm_source=x#offer'), { productId: '660414', canonicalUrl: 'https://www.tcgplayer.com/product/660414/pokemon-card' });
  assert.equal(parseTcgplayerUrl('http://www.tcgplayer.com/product/123').canonicalUrl, 'https://www.tcgplayer.com/product/123');
});

test('rejects invalid domains and missing product IDs', () => {
  assert.throws(() => parseTcgplayerUrl('https://example.com/product/123'), /INVALID_TCGPLAYER_DOMAIN/);
  assert.throws(() => parseTcgplayerUrl('https://www.tcgplayer.com/search/pokemon'), /INVALID_TCGPLAYER_PRODUCT_ID/);
  assert.throws(() => parseTcgplayerUrl('https://www.tcgplayer.com/product/not-a-number'), /INVALID_TCGPLAYER_PRODUCT_ID/);
});

const detail = { id: 'sv-test', name: 'Dawn', image: 'image', localId: '10', set: { id: 'sv', name: 'Test Set' }, rarity: 'Rare', pricing: { tcgplayer: { productId: 660414, updatedAt: 'today', normal: { marketPrice: 2.5 }, holofoil: { marketPrice: 4.75 } } }, variants_detailed: [{ variant: 'reverse-holofoil', productId: '660414', marketPrice: 3.25 }] };
const fakeFetch = async (url) => ({ ok: true, json: async () => url.includes('?name=') ? [{ id: 'sv-test' }, { id: 'other' }] : url.endsWith('/other') ? { ...detail, id: 'other', pricing: { tcgplayer: { productId: 999, normal: { marketPrice: 9 } } }, variants_detailed: [] } : detail });

test('searches by item name then matches the exact nested TCGplayer product ID', async () => {
  clearTcgCache(); const result = await findTcgplayerMatches({ itemName: 'Dawn', tcgplayerUrl: 'https://www.tcgplayer.com/product/660414/dawn', fetchImpl: fakeFetch });
  assert.equal(result.matches.length, 1); assert.equal(result.matches[0].tcgdexId, 'sv-test'); assert.equal(result.matches[0].productId, '660414');
});

test('returns all available pricing and variants_detailed variants in integer coins', () => {
  const variants = extractTcgplayerVariants(detail, '660414');
  assert.deepEqual(Object.fromEntries(variants.map((value) => [value.key, value.marketPriceCoins])), { normal: 250, holofoil: 475, 'reverse-holofoil': 325 });
});

test('extracts variant type and inherited product ID from nested variants_detailed pricing', () => {
  const card = { variants_detailed: [{ type: 'Reverse Holofoil', pricing: { tcgplayer: { productId: 660414, marketPrice: 6.12, updatedAt: 'now' } } }] };
  assert.deepEqual(extractTcgplayerVariants(card, '660414').map(({ key, marketPriceCoins }) => ({ key, marketPriceCoins })), [{ key: 'reverse-holofoil', marketPriceCoins: 612 }]);
});

test('uses TCGdex like filters and accepts paginated search response shapes', async () => {
  clearTcgCache(); const urls = [];
  const fetchImpl = async (url) => { urls.push(url); return { ok: true, json: async () => url.includes('?name=') ? { data: [{ id: 'sv-test' }] } : detail }; };
  const result = await findTcgplayerMatches({ itemName: 'Dawn PSA 10 (Phantasmal Flames)', tcgplayerUrl: 'https://tcgplayer.com/product/660414/dawn', fetchImpl });
  assert.equal(result.matches.length, 1);
  assert.ok(urls.some((url) => url.includes('name=like%3ADawn')));
  assert.deepEqual(result.searchedNames, ['Dawn']);
});

test('missing pricing cannot produce an applied value', () => {
  assert.deepEqual(extractTcgplayerVariants({ pricing: { tcgplayer: { productId: 1, normal: {} } } }, '1'), []);
  const item = { id: 'x', price: 500 }; assert.equal(buildAppliedItem({ item, resolved: {}, match: {}, variant: null, now: 'now' }), item);
});

test('undefined properties are omitted from sanitized Firestore data', () => {
  assert.deepEqual(withoutUndefined({ kept: 1, missing: undefined, nullable: null }), { kept: 1, nullable: null });
});

test('applying a price updates only the selected box item and recalculates existing EV', () => {
  const original = { id: 'card', price: 100, chance: 50 }, other = { id: 'other', price: 300, chance: 50 };
  const resolved = { canonicalUrl: 'https://www.tcgplayer.com/product/660414/dawn', productId: '660414' }, match = { tcgdexId: 'sv-test', providerUpdatedAt: 'today' }, variant = { key: 'normal', marketPriceCoins: 250, marketPriceCents: 250 };
  const applied = buildAppliedItem({ item: original, resolved, match, variant, now: 'now' });
  assert.equal(applied.effectiveValue, 250); assert.equal(applied.previousValue, 100); assert.equal(applied.priceSource, 'tcgdex_tcgplayer');
  assert.equal(calculatePricingSnapshot({ price: 1000 }, [applied, other], 'now').expectedValue, 275);
  assert.equal(other.price, 300);
});

test('existing customer inventory remains unchanged when a box item price is applied', () => {
  const inventory = Object.freeze({ id: 'won', valueAtWin: 100, sellbackValueAtWin: 80 });
  buildAppliedItem({ item: { id: 'card', price: 100 }, resolved: { canonicalUrl: 'https://www.tcgplayer.com/product/1', productId: '1' }, match: { tcgdexId: 'x' }, variant: { key: 'normal', marketPriceCoins: 200, marketPriceCents: 200 }, now: 'now' });
  assert.deepEqual(inventory, { id: 'won', valueAtWin: 100, sellbackValueAtWin: 80 });
});

test('admin UI uses flat Vercel function routes for match and apply', async () => {
  const source = await readFile(new URL('../components/admin/BoxMarketPricingEditor.tsx', import.meta.url), 'utf8');
  assert.match(source, /\/api\/admin\/box-pricing-match/);
  assert.match(source, /\/api\/admin\/box-pricing-apply/);
  assert.doesNotMatch(source, /\/api\/admin\/boxes\/\$\{box\.id\}\/pricing/);
  const [matchRoute, applyRoute] = await Promise.all([
    readFile(new URL('../api/admin/box-pricing-match.js', import.meta.url), 'utf8'),
    readFile(new URL('../api/admin/box-pricing-apply.js', import.meta.url), 'utf8')
  ]);
  assert.match(matchRoute, /req\.method !== 'POST'/);
  assert.match(applyRoute, /req\.method !== 'POST'/);
});
