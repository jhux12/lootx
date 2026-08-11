import { requireAdmin, deny, ok } from '../../../_utils/auth.js';
import { getTcgCard } from '../../../../lib/server/boxPricing.js';
export default async function handler(req, res) { if (req.method !== 'GET') return deny(res, 405, 'METHOD_NOT_ALLOWED'); try { await requireAdmin(req); const result = await getTcgCard(req.query.language || 'en', req.query.tcgdexId); return ok(res, { card: result.card, cacheHit: result.cacheHit }); } catch (e) { return deny(res, e.status || 502, e.error || e.message || 'TCGDEX_REQUEST_FAILED'); } }
