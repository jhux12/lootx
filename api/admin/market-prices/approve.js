import { requireAdmin, deny, ok } from '../../_utils/auth.js';
import { db } from '../../_lib/firebaseAdmin.js';
import { recalculateBoxesForItem } from '../../../lib/server/marketPricing/recalculateBoxEV.js';

const nonNegative = (value) => Math.max(0, Number(value) || 0);

export default async function handler(req, res) {
  if (req.method !== 'POST') return deny(res, 405, 'METHOD_NOT_ALLOWED');
  try {
    await requireAdmin(req);
    const itemId = String(req.body?.itemId || '').trim();
    if (!itemId) return deny(res, 400, 'ITEM_ID_REQUIRED');

    const ref = db.collection('items').doc(itemId);
    const snap = await ref.get();
    if (!snap.exists) return deny(res, 404, 'ITEM_NOT_FOUND');

    const item = snap.data() || {};
    const pricing = item.marketPricing || {};
    const valueUsd = nonNegative(pricing.suggestedValueUsd ?? pricing.approvedValueUsd ?? item.valueUsd ?? ((item.valueCoins ?? item.price ?? 0) / 100));
    const valueCoins = Math.round(nonNegative(pricing.suggestedValueCoins ?? valueUsd * 100));
    const sellBackCoins = Math.floor(nonNegative(pricing.suggestedSellBackCoins ?? valueCoins * 0.8));

    await ref.set({
      valueUsd,
      valueCoins,
      sellBackCoins,
      price: valueCoins,
      marketPricing: {
        ...pricing,
        approvedValueUsd: valueUsd,
        approvedValueCoins: valueCoins,
        approvedSellBackCoins: sellBackCoins,
        updateStatus: 'approved',
        lastError: null
      }
    }, { merge: true });

    const affectedBoxes = await recalculateBoxesForItem(itemId);
    return ok(res, { itemId, affectedBoxes });
  } catch (error) {
    console.error('Market price approval failed', error);
    return deny(res, error?.status || 500, error?.error || error?.message || 'MARKET_PRICE_APPROVE_FAILED');
  }
}
