import { requireAdmin, deny, ok } from '../../../../_utils/auth.js';
import { matchBoxItem } from '../../../../_lib/boxPricingService.js';
export default async function handler(req, res) {
  if (req.method !== 'POST') return deny(res, 405, 'METHOD_NOT_ALLOWED');
  try { await requireAdmin(req); return ok(res, await matchBoxItem(req.query.boxId, req.body?.itemId, req.body?.tcgplayerUrl)); }
  catch (error) { return deny(res, error.status || 500, error.error || error.message || 'TCGDEX_MATCH_FAILED'); }
}
