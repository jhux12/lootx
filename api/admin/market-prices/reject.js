import { requireAdmin, deny, ok } from '../../_utils/auth.js';
import { db } from '../../_lib/firebaseAdmin.js';

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

    await ref.set({
      marketPricing: {
        ...pricing,
        rejectedSuggestion: {
          valueUsd: pricing.suggestedValueUsd ?? null,
          valueCoins: pricing.suggestedValueCoins ?? null,
          sellBackCoins: pricing.suggestedSellBackCoins ?? null,
          rejectedAt: new Date().toISOString()
        },
        suggestedValueUsd: null,
        suggestedValueCoins: null,
        suggestedSellBackCoins: null,
        updateStatus: pricing.approvedValueCoins != null ? 'approved' : 'idle'
      }
    }, { merge: true });

    return ok(res, { itemId });
  } catch (error) {
    console.error('Market price rejection failed', error);
    return deny(res, error?.status || 500, error?.error || error?.message || 'MARKET_PRICE_REJECT_FAILED');
  }
}
