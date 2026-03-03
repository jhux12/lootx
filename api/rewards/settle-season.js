import { sendJson } from '../_lib/http.js';
import { requireAdmin, requireUser } from '../_utils/auth.js';
import { settleExpiredRewardsSeason } from '../_lib/rewards.js';

const hasAdminSecret = (req) => {
  const adminSecret = process.env.ADMIN_SECRET;
  const incoming = req.headers['x-admin-secret'];
  return Boolean(adminSecret) && typeof incoming === 'string' && incoming === adminSecret;
};

const isValidCronInvocation = (req) => {
  if (req.headers['x-vercel-cron'] !== '1') return false;

  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return true;
  }

  return req.headers['x-cron-secret'] === cronSecret;
};

export default async function handler(req, res) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    res.setHeader('Allow', 'GET, POST');
    return sendJson(res, 405, { error: 'METHOD_NOT_ALLOWED' });
  }

  try {
    const force = req.query?.force === '1';

    const allowedBySecret = hasAdminSecret(req);
    const allowedByCron = isValidCronInvocation(req);
    let allowedByAdminClaim = false;

    if (!allowedBySecret && !allowedByCron) {
      try {
        await requireAdmin(req);
        allowedByAdminClaim = true;
      } catch {
        try {
          await requireUser(req);
        } catch {
          return sendJson(res, 401, { ok: false, error: 'AUTH_REQUIRED' });
        }
      }
    }

    if (!allowedBySecret && !allowedByCron && !allowedByAdminClaim) {
      return sendJson(res, 403, { ok: false, error: 'FORBIDDEN' });
    }

    const result = await settleExpiredRewardsSeason({ force, maxUsers: 100 });
    return sendJson(res, 200, { ok: true, ...result });
  } catch (error) {
    console.error('settle-season error', error);
    return sendJson(res, 500, { error: 'SETTLEMENT_FAILED', message: error instanceof Error ? error.message : 'Settlement failed.' });
  }
}
