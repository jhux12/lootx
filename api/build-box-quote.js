import { readJsonBody, sendJson } from './_lib/http.js';
import { loadEligibleBuildBoxItems, buildQuote } from './_lib/buildBox.js';
export default async function handler(req, res) {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'INVALID_REQUEST', message: 'Only POST is allowed.' });
  try {
    const body = await readJsonBody(req);
    const selectedItemIds = Array.isArray(body?.selectedItemIds) ? body.selectedItemIds.filter((id) => typeof id === 'string') : [];
    const { settings, items } = await loadEligibleBuildBoxItems(selectedItemIds);
    const quote = buildQuote(items, settings);
    return sendJson(res, 200, { ok: true, minItems: settings.minItems, maxItems: settings.maxItems, quote });
  } catch (e) {
    return sendJson(res, e.status || 500, { ok: false, error: e.error || 'BUILD_BOX_QUOTE_FAILED', message: e.message || 'Unable to calculate this box.' });
  }
}
