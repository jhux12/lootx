import { requireAdmin, deny, ok } from '../../../../_utils/auth.js';
import { applyBoxItemPrice } from '../../../../_lib/boxPricingService.js';
export default async function handler(req, res) {
  if (req.method !== 'POST') return deny(res, 405, 'METHOD_NOT_ALLOWED');
  try { const user = await requireAdmin(req); return ok(res, await applyBoxItemPrice({ boxId: req.query.boxId, itemId: req.body?.itemId, tcgplayerUrl: req.body?.tcgplayerUrl, tcgdexId: req.body?.tcgdexId, pricingVariant: req.body?.pricingVariant, actor: user.uid })); }
  catch (error) { return deny(res, error.status || 500, error.error || error.message || 'PRICE_APPLY_FAILED'); }
}
