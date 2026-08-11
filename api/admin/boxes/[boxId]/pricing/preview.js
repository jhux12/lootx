import { requireAdmin, deny, ok } from '../../../../_utils/auth.js';
import { loadBox } from '../../../../_lib/boxPricingService.js';
import { previewBoxPricing } from '../../../../../lib/server/boxPricing.js';
export default async function handler(req, res) { if (req.method !== 'POST') return deny(res, 405, 'METHOD_NOT_ALLOWED'); try { await requireAdmin(req); const box = await loadBox(req.query.boxId); return ok(res, { preview: await previewBoxPricing(box) }); } catch (e) { return deny(res, e.status || 500, e.error || e.message || 'PRICE_PREVIEW_FAILED'); } }
