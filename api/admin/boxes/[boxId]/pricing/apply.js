import { requireAdmin, deny, ok } from '../../../../_utils/auth.js';
import { applyPricingPreview } from '../../../../_lib/boxPricingService.js';
export default async function handler(req, res) { if (req.method !== 'POST') return deny(res, 405, 'METHOD_NOT_ALLOWED'); try { const user = await requireAdmin(req); return ok(res, await applyPricingPreview(req.query.boxId, req.body?.preview, { approvedItemIds: req.body?.approvedItemIds, actor: user.uid })); } catch (e) { return deny(res, e.status || 500, e.error || e.message || 'PRICE_APPLY_FAILED'); } }
