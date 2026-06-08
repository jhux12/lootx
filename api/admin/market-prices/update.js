import { requireAdmin, deny, ok } from '../../_utils/auth.js';
import { updateEnabledMarketPrices } from '../../../lib/server/marketPricing/updateItemMarketPrice.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return deny(res, 405, 'METHOD_NOT_ALLOWED');
  try {
    await requireAdmin(req);
    const summary = await updateEnabledMarketPrices({
      itemId: req.body?.itemId,
      itemIds: Array.isArray(req.body?.itemIds) ? req.body.itemIds : undefined,
      boxId: req.body?.boxId
    });
    return ok(res, summary);
  } catch (error) {
    console.error('Market price update failed', error);
    return deny(res, error?.status || 500, error?.error || error?.message || 'MARKET_PRICE_UPDATE_FAILED');
  }
}
