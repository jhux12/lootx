import test from 'node:test';
import assert from 'node:assert/strict';
import { calculatePricingSnapshot, clearTcgCache, extractTcgplayerPrice, getTcgCard, marketPricingConfig, previewBoxPricing } from '../lib/server/boxPricing.js';

const card = { id: 'sv3-125', localId: '125', set: { id: 'sv3' }, pricing: { tcgplayer: { normal: { marketPrice: 2, lowPrice: 1.5 }, reverse: { marketPrice: 3 }, holo: { marketPrice: 4 } } } };
const item = { id: 'one', name: 'Exact card', pricingMode: 'automatic', tcgdexId: 'sv3-125', tcgdexSetId: 'sv3', tcgdexCardNumber: '125', pricingLanguage: 'en', pricingVariant: 'normal', price: 100, chance: 25 };
const response = (body = card, ok = true) => async () => ({ ok, status: ok ? 200 : 503, json: async () => body });

test('extracts normal, reverse and holo TCGplayer variants', () => {
  assert.equal(extractTcgplayerPrice(card, 'normal').marketPrice, 2);
  assert.equal(extractTcgplayerPrice(card, 'reverse').marketPrice, 3);
  assert.equal(extractTcgplayerPrice(card, 'holo').marketPrice, 4);
});

test('requires exact selection and rejects ambiguous name-only configuration', async () => {
  const result = await previewBoxPricing({ id: 'b', price: 500, items: [{ ...item, tcgdexId: undefined, tcgdexSetId: undefined, tcgdexCardNumber: undefined }] });
  assert.equal(result.rows[0].status, 'uncertain_match');
  assert.equal(result.rows[0].proposedValue, null);
});

test('preserves manual values and calculates EV with existing chances', async () => {
  const manual = { id: 'm', pricingMode: 'manual', price: 800, effectiveValue: 800, chance: 75 };
  const result = await previewBoxPricing({ id: 'b', price: 1000, items: [manual, item] }, { fetchImpl: response() });
  assert.equal(result.rows.length, 1);
  assert.equal(result.currentSnapshot.expectedValue, 625);
  assert.equal(manual.effectiveValue, 800);
});

test('missing, zero, mismatched and provider failures never propose a replacement', async () => {
  for (const [providerCard, expected] of [
    [{ ...card, pricing: {} }, 'missing_pricing'],
    [{ ...card, pricing: { tcgplayer: { normal: { marketPrice: 0 } } } }, 'missing_pricing'],
    [{ ...card, localId: '999' }, 'uncertain_match']
  ]) {
    clearTcgCache(); const result = await previewBoxPricing({ id: 'b', price: 500, items: [item] }, { fetchImpl: response(providerCard) });
    assert.equal(result.rows[0].status, expected); assert.equal(result.rows[0].proposedValue, null);
  }
  clearTcgCache(); const failed = await previewBoxPricing({ id: 'b', price: 500, items: [item] }, { fetchImpl: response({}, false) });
  assert.equal(failed.rows[0].status, 'provider_error');
});

test('cache is shared by card key without coupling box snapshots', async () => {
  clearTcgCache(); let calls = 0; const fetchImpl = async () => { calls++; return { ok: true, json: async () => card }; };
  const first = await previewBoxPricing({ id: 'a', price: 500, items: [item] }, { fetchImpl });
  const second = await previewBoxPricing({ id: 'b', price: 900, items: [{ ...item, price: 150 }] }, { fetchImpl });
  assert.equal(calls, 1); assert.equal(second.rows[0].cacheHit, true); assert.notEqual(first.currentSnapshot.marginAmount, second.currentSnapshot.marginAmount);
});

test('threshold, profitability warning and backwards-compatible defaults are safe', async () => {
  clearTcgCache(); const under = await previewBoxPricing({ id: 'b', price: 1000, targetEV: .9, marketPricing: { autoApplyThresholdPercent: 20 }, items: [{ ...item, price: 180 }] }, { fetchImpl: response() });
  assert.equal(under.rows[0].requiresApproval, false);
  clearTcgCache(); const over = await previewBoxPricing({ id: 'b', price: 210, targetEV: .85, marketPricing: { autoApplyThresholdPercent: 20 }, items: [{ ...item, chance: 100 }] }, { fetchImpl: response() });
  assert.equal(over.rows[0].requiresApproval, true); assert.equal(over.profitabilityWarning, true);
  assert.equal(marketPricingConfig().enabled, false); assert.equal(marketPricingConfig().autoApplyThresholdPercent, 20);
});

test('snapshot uses effective values and does not mutate input', () => {
  const items = [{ chance: 50, price: 100, effectiveValue: 300 }, { chance: 50, price: 500 }];
  const snap = calculatePricingSnapshot({ price: 1000 }, items, 'now');
  assert.deepEqual({ ev: snap.expectedValue, min: snap.minimumItemValue, max: snap.maximumItemValue }, { ev: 400, min: 300, max: 500 });
  assert.equal(items[0].price, 100);
});
