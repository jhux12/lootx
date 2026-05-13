import { deny, ok } from '../_utils/auth.js';
import { updateEnabledMarketPrices } from '../../lib/server/marketPricing/updateItemMarketPrice.js';

export default async function handler(req, res) {
  if (!['GET', 'POST'].includes(req.method)) return deny(res, 405, 'METHOD_NOT_ALLOWED');
  const expected = process.env.CRON_SECRET;
  const provided = req.headers['x-cron-secret'] || req.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (!expected || provided !== expected) return deny(res, 401, 'CRON_SECRET_REQUIRED');

  try {
    const summary = await updateEnabledMarketPrices();
    return ok(res, summary);
  } catch (error) {
    console.error('Cron market price update failed', error);
    return deny(res, 500, error?.message || 'CRON_MARKET_PRICE_UPDATE_FAILED');
  }
}
