import { sendJson } from '../_lib/http.js';
import { requireUser } from '../_utils/auth.js';
import { claimRewardsCoinsForUser } from '../_lib/rewards.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return sendJson(res, 405, { ok: false, error: 'METHOD_NOT_ALLOWED' });
  }

  try {
    const decoded = await requireUser(req);
    const result = await claimRewardsCoinsForUser({ uid: decoded.uid });
    return sendJson(res, 200, { ok: true, ...result });
  } catch (error) {
    const status = Number(error?.status) || 500;
    const message = error instanceof Error ? error.message : 'Unable to claim leaderboard coins.';
    const code = typeof error?.error === 'string' ? error.error : 'CLAIM_FAILED';
    return sendJson(res, status, { ok: false, error: code, message });
  }
}
