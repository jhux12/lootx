import { admin, firestore } from './firebaseAdmin.js';
import { buildAppliedItem, calculatePricingSnapshot, findTcgplayerMatches } from '../../lib/server/boxPricing.js';

export const loadBox = async (boxId) => {
  const snapshot = await firestore.collection('boxes').doc(String(boxId)).get();
  if (!snapshot.exists) throw Object.assign(new Error('BOX_NOT_FOUND'), { status: 404 });
  return { id: snapshot.id, ...snapshot.data() };
};

export const matchBoxItem = async (boxId, itemId, tcgplayerUrl, options = {}) => {
  const box = await loadBox(boxId), item = (box.items || []).find((entry) => entry.id === itemId);
  if (!item) throw Object.assign(new Error('BOX_ITEM_NOT_FOUND'), { status: 404 });
  return findTcgplayerMatches({ itemName: item.name, tcgplayerUrl, fetchImpl: options.fetchImpl });
};

export const applyBoxItemPrice = async ({ boxId, itemId, tcgplayerUrl, tcgdexId, pricingVariant, actor = 'admin', fetchImpl }) => {
  const resolved = await matchBoxItem(boxId, itemId, tcgplayerUrl, { fetchImpl });
  const match = resolved.matches.find((entry) => entry.tcgdexId === tcgdexId);
  if (!match) throw Object.assign(new Error('TCGDEX_MATCH_REQUIRED'), { status: 409 });
  const variant = match.variants.find((entry) => entry.key === pricingVariant);
  if (!variant || !Number.isInteger(variant.marketPriceCoins) || variant.marketPriceCoins <= 0) throw Object.assign(new Error('MARKET_PRICE_UNAVAILABLE'), { status: 409 });
  return firestore.runTransaction(async (transaction) => {
    const ref = firestore.collection('boxes').doc(String(boxId)), snapshot = await transaction.get(ref);
    if (!snapshot.exists) throw Object.assign(new Error('BOX_NOT_FOUND'), { status: 404 });
    const box = { id: snapshot.id, ...snapshot.data() }, now = new Date().toISOString();
    let previousValue = null, changed = false;
    const items = (box.items || []).map((item) => {
      if (item.id !== itemId) return item;
      previousValue = Number(item.effectiveValue ?? item.price ?? 0);
      changed = previousValue !== variant.marketPriceCoins;
      return buildAppliedItem({ item, resolved, match, variant, now });
    });
    if (!items.some((item) => item.id === itemId)) throw Object.assign(new Error('BOX_ITEM_NOT_FOUND'), { status: 404 });
    const pricingSnapshot = calculatePricingSnapshot(box, items, now);
    transaction.update(ref, { items, pricingSnapshot });
    if (changed) transaction.set(ref.collection('pricingChangeLog').doc(), { actor, itemId, tcgdexId: match.tcgdexId, tcgplayerProductId: resolved.productId, variant: variant.key, previousValue, appliedValue: variant.marketPriceCoins, appliedAt: admin.firestore.FieldValue.serverTimestamp() });
    return { updated: changed ? 1 : 0, itemId, appliedValue: variant.marketPriceCoins, pricingSnapshot };
  });
};
