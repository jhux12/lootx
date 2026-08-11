import { admin, firestore } from './firebaseAdmin.js';
import { calculatePricingSnapshot, marketPricingConfig, previewBoxPricing } from '../../lib/server/boxPricing.js';

export const loadBox = async (boxId) => {
  const snapshot = await firestore.collection('boxes').doc(boxId).get();
  if (!snapshot.exists) throw Object.assign(new Error('BOX_NOT_FOUND'), { status: 404 });
  return { id: snapshot.id, ...snapshot.data() };
};

export const applyPricingPreview = async (boxId, preview, { approvedItemIds, safeOnly = false, actor = 'admin' } = {}) => {
  const approved = new Set(Array.isArray(approvedItemIds) ? approvedItemIds : []);
  return firestore.runTransaction(async (transaction) => {
    const ref = firestore.collection('boxes').doc(boxId);
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists) throw Object.assign(new Error('BOX_NOT_FOUND'), { status: 404 });
    const box = { id: snapshot.id, ...snapshot.data() };
    const config = marketPricingConfig(box.marketPricing);
    const latestPreview = await previewBoxPricing(box);
    const now = new Date().toISOString();
    let updated = 0;
    const changes = [];
    const items = (box.items || []).map((item) => {
      const row = latestPreview.rows.find((entry) => entry.itemId === item.id);
      const selected = row && row.proposedValue > 0 && (safeOnly ? !row.requiresApproval : (approved.size ? approved.has(item.id) : true));
      if (!selected || Number(item.effectiveValue ?? item.price) === row.proposedValue) return item;
      updated += 1;
      changes.push({ itemId: item.id, item: item.name, from: row.currentValue, to: row.proposedValue });
      return { ...item, previousValue: row.currentValue, marketPrice: row.proposedValue, marketLowPrice: row.marketLowPrice, effectiveValue: row.proposedValue, price: row.proposedValue, valueCoins: row.proposedValue, valueUsd: row.proposedValue / 100, marketPriceUpdatedAt: row.providerUpdatedAt || now, priceCheckedAt: now, pricingStatus: 'current', pricingError: null };
    });
    const pricingSnapshot = calculatePricingSnapshot(box, items, now);
    const missing = latestPreview.rows.filter((row) => ['missing_pricing', 'provider_error', 'missing_variant', 'uncertain_match', 'suspicious'].includes(row.status)).length;
    const pending = latestPreview.rows.filter((row) => row.requiresApproval).length - (safeOnly ? 0 : latestPreview.rows.filter((row) => approved.has(row.itemId)).length);
    const marketPricing = { ...config, lastCheckedAt: now, ...(updated ? { lastAppliedAt: now } : {}), status: pending > 0 ? 'pending_approval' : 'current', itemsChecked: latestPreview.rows.length, itemsUpdated: updated, itemsMissingPricing: missing, itemsPendingApproval: Math.max(0, pending) };
    transaction.update(ref, { items, marketPricing, pricingSnapshot });
    if (updated) transaction.set(ref.collection('pricingChangeLog').doc(), { actor, provider: 'tcgdex', marketplace: 'tcgplayer', changes, appliedAt: admin.firestore.FieldValue.serverTimestamp(), requestKey: `${latestPreview.checkedAt}:${changes.map((c) => c.itemId).join(',')}` });
    return { updated, marketPricing, pricingSnapshot, preview: latestPreview };
  });
};

export const syncBox = async (boxId, actor = 'system') => {
  const box = await loadBox(boxId);
  const preview = await previewBoxPricing(box);
  if (!marketPricingConfig(box.marketPricing).autoApplyEnabled) return { updated: 0, preview };
  return applyPricingPreview(boxId, preview, { safeOnly: true, actor });
};
