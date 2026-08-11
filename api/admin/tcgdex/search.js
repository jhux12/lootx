import { requireAdmin, deny, ok } from '../../_utils/auth.js';
import { getTcgCard } from '../../../lib/server/boxPricing.js';
export default async function handler(req, res) {
  if (req.method !== 'GET') return deny(res, 405, 'METHOD_NOT_ALLOWED');
  try {
    await requireAdmin(req);
    const setId = String(req.query.setId || '').trim(), cardNumber = String(req.query.cardNumber || '').trim();
    if (!setId || !cardNumber) return deny(res, 400, 'EXACT_SET_AND_CARD_NUMBER_REQUIRED');
    const tcgdexId = String(req.query.tcgdexId || `${setId}-${cardNumber}`).trim();
    const result = await getTcgCard(req.query.language || 'en', tcgdexId);
    const actualSet = String(result.card.set?.id ?? result.card.setId ?? ''), actualNumber = String(result.card.localId ?? result.card.number ?? '');
    if (actualSet !== setId || actualNumber !== cardNumber) return deny(res, 409, 'EXACT_CARD_MATCH_NOT_FOUND');
    return ok(res, { results: [result.card], cacheHit: result.cacheHit });
  } catch (e) { return deny(res, e.status || 502, e.error || e.message || 'TCGDEX_SEARCH_FAILED'); }
}
