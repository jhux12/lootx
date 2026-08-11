import { requireAdmin, deny, ok } from '../../../../_utils/auth.js';
import { syncBox } from '../../../../_lib/boxPricingService.js';
export default async function handler(req, res) { if (req.method !== 'POST') return deny(res, 405, 'METHOD_NOT_ALLOWED'); try { const user = await requireAdmin(req); return ok(res, await syncBox(req.query.boxId, user.uid)); } catch (e) { return deny(res, e.status || 500, e.error || e.message || 'PRICE_SYNC_FAILED'); } }
