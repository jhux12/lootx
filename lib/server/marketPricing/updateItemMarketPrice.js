import { admin, db } from '../../../api/_lib/firebaseAdmin.js';
import { COINS_PER_USD, SAFE_AUTO_APPROVE_PERCENT, SUSPICIOUS_PRICE_FLOOR_USD } from './types.js';
import { getMarketPrice } from './getMarketPrice.js';
import { recalculateBoxesForItem } from './recalculateBoxEV.js';

const roundUsd = (value) => Math.round(Math.max(0, Number(value) || 0) * 100) / 100;
const toCoins = (usd) => Math.max(0, Math.round(roundUsd(usd) * COINS_PER_USD));
const sellBackCoins = (coins) => Math.max(0, Math.floor(Number(coins || 0) * 0.8));

const approvedUsdFor = (item) => {
  const pricing = item.marketPricing || {};
  const raw = pricing.approvedValueUsd ?? item.valueUsd ?? ((item.valueCoins ?? item.price ?? 0) / COINS_PER_USD);
  return roundUsd(raw);
};

const percentChange = (fromUsd, toUsd) => {
  if (fromUsd <= 0) return toUsd > 0 ? 1 : 0;
  return Math.abs(toUsd - fromUsd) / fromUsd;
};

export async function updateItemMarketPrice(itemDoc) {
  const item = { id: itemDoc.id, ...(itemDoc.data() || {}) };
  const pricing = item.marketPricing || {};
  const now = admin.firestore.FieldValue.serverTimestamp();

  if (pricing.enabled !== true) return { checked: false, updated: false, pendingReview: false, failed: false, affectedBoxes: [] };

  try {
    const market = await getMarketPrice(item);
    const approvedUsd = approvedUsdFor(item);
    const suggestedUsd = roundUsd(market.valueUsd);

    if (suggestedUsd < SUSPICIOUS_PRICE_FLOOR_USD && approvedUsd >= SUSPICIOUS_PRICE_FLOOR_USD) {
      throw new Error(`Suspicious market price $${suggestedUsd.toFixed(2)} ignored because the approved value is $${approvedUsd.toFixed(2)}.`);
    }
    if (approvedUsd < 5 && suggestedUsd > 100) {
      throw new Error(`Suspicious market price $${suggestedUsd.toFixed(2)} rejected because the approved/current value is $${approvedUsd.toFixed(2)}.`);
    }
    if (suggestedUsd > 5000 && pricing.allowHighValue !== true) {
      throw new Error(`Suspicious market price $${suggestedUsd.toFixed(2)} rejected. Set marketPricing.allowHighValue to true for high-value items.`);
    }

    const suggestedValueCoins = toCoins(suggestedUsd);
    const suggestedSellBackCoins = sellBackCoins(suggestedValueCoins);
    const locked = pricing.valueLocked === true;
    const isLargeChange = percentChange(approvedUsd, suggestedUsd) > SAFE_AUTO_APPROVE_PERCENT;
    const isExtremeIncrease = approvedUsd > 0 && suggestedUsd > approvedUsd * 10;
    const pricingWarning = isExtremeIncrease
      ? `Market price warning: suggested value $${suggestedUsd.toFixed(2)} is more than 10x the approved/current value $${approvedUsd.toFixed(2)}.`
      : null;
    const shouldAutoApprove = !locked && !isLargeChange && !isExtremeIncrease;

    const update = {
      marketPricing: {
        ...pricing,
        source: market.source || pricing.source || 'manual',
        sourceId: market.sourceId || pricing.sourceId || null,
        lastCheckedAt: now,
        lastMarketValueUsd: suggestedUsd,
        suggestedValueUsd: suggestedUsd,
        suggestedValueCoins,
        suggestedSellBackCoins,
        updateStatus: shouldAutoApprove ? 'approved' : 'pending_review',
        warning: pricingWarning,
        lastError: pricingWarning
      }
    };

    if (shouldAutoApprove) {
      update.valueUsd = suggestedUsd;
      update.valueCoins = suggestedValueCoins;
      update.sellBackCoins = suggestedSellBackCoins;
      update.price = suggestedValueCoins; // Existing app paths use price as the live coin value.
      update.marketPricing.approvedValueUsd = suggestedUsd;
      update.marketPricing.approvedValueCoins = suggestedValueCoins;
      update.marketPricing.approvedSellBackCoins = suggestedSellBackCoins;
    }

    await itemDoc.ref.set(update, { merge: true });
    const affectedBoxes = await recalculateBoxesForItem(itemDoc.id);
    return { checked: true, updated: shouldAutoApprove, pendingReview: !shouldAutoApprove, failed: false, affectedBoxes };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown market pricing error';
    await itemDoc.ref.set({
      marketPricing: {
        ...pricing,
        lastCheckedAt: now,
        updateStatus: 'failed',
        lastError: message
      }
    }, { merge: true });
    return { checked: true, updated: false, pendingReview: false, failed: true, error: message, affectedBoxes: [] };
  }
}

export async function updateEnabledMarketPrices({ itemId, itemIds, boxId } = {}) {
  const docs = [];
  const requestedIds = new Set();

  if (itemId) requestedIds.add(String(itemId));
  if (Array.isArray(itemIds)) {
    itemIds.forEach((id) => {
      if (id != null && String(id).trim()) requestedIds.add(String(id));
    });
  }

  if (boxId) {
    const boxSnap = await db.collection('boxes').doc(String(boxId)).get();
    const box = boxSnap.exists ? boxSnap.data() || {} : {};
    const prizes = Array.isArray(box.items) ? box.items : Array.isArray(box.prizes) ? box.prizes : [];
    prizes.forEach((prize) => {
      const id = String(prize?.id || prize?.itemId || '').trim();
      if (id) requestedIds.add(id);
    });
  }

  if (requestedIds.size > 0) {
    await Promise.all([...requestedIds].map(async (id) => {
      const snap = await db.collection('items').doc(id).get();
      if (snap.exists) docs.push(snap);
    }));
  } else {
    const snapshot = await db.collection('items').where('marketPricing.enabled', '==', true).get();
    docs.push(...snapshot.docs);
  }

  const summary = { checked: 0, updated: 0, pendingReview: 0, failed: 0, affectedBoxes: [] };
  for (const doc of docs) {
    const result = await updateItemMarketPrice(doc);
    if (!result.checked) continue;
    summary.checked += 1;
    if (result.updated) summary.updated += 1;
    if (result.pendingReview) summary.pendingReview += 1;
    if (result.failed) summary.failed += 1;
    for (const box of result.affectedBoxes || []) {
      if (!summary.affectedBoxes.some((existing) => existing.id === box.id)) summary.affectedBoxes.push(box);
    }
  }
  return summary;
}
