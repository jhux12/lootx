import { readJsonBody, sendJson } from '../_lib/http.js';
import {
  maybeStartBattle,
  parseAuth,
  withHttpError
} from '../_lib/battles.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return sendJson(res, 405, { error: 'METHOD_NOT_ALLOWED', message: 'Only POST is supported.' });
  }

  try {
    await parseAuth(req);
    const body = await readJsonBody(req);
    const battleId = typeof body?.battleId === 'string' ? body.battleId : '';
    if (!battleId) {
      return sendJson(res, 400, { error: 'INVALID_REQUEST', message: 'battleId is required.' });
    }

    const result = await maybeStartBattle(battleId);
    return sendJson(res, 200, { ok: true, action: result.action, reason: result.reason ?? null, engineResult: result.engineResult ?? null });
  } catch (error) {
    const safe = withHttpError(error, 'Failed to start battle.');
    return sendJson(res, safe.status, { error: safe.error, message: safe.message });
  }
}
