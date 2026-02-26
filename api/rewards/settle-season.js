import { adminAuth } from '../_lib/firebaseAdmin.js';
import { getBearerToken, sendJson } from '../_lib/http.js';
import { settleExpiredRewardsSeason } from '../_lib/rewards.js';

const isCronInvocation = (req) => Boolean(req.headers['x-vercel-cron']);

export default async function handler(req, res) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    res.setHeader('Allow', 'GET, POST');
    return sendJson(res, 405, { error: 'METHOD_NOT_ALLOWED' });
  }

  try {
    const force = req.query?.force === '1';

    if (!isCronInvocation(req)) {
      const token = getBearerToken(req);
      if (!token) {
        return sendJson(res, 401, { error: 'AUTH_REQUIRED' });
      }
      await adminAuth.verifyIdToken(token);
    }

    const result = await settleExpiredRewardsSeason({ force, maxUsers: 100 });
    return sendJson(res, 200, { ok: true, ...result });
  } catch (error) {
    console.error('settle-season error', error);
    return sendJson(res, 500, { error: 'SETTLEMENT_FAILED', message: error instanceof Error ? error.message : 'Settlement failed.' });
  }
}
