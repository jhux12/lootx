import { readJsonBody, sendJson } from '../_lib/http.js';
import { getReferralSettings, getReferralSettingsRef, normalizeReferralSettings } from '../_lib/referrals.js';
import { requireAdmin } from '../_utils/auth.js';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const { settings } = await getReferralSettings();
    return sendJson(res, 200, { ok: true, settings });
  }

  if (req.method !== 'PUT') {
    res.setHeader('Allow', 'GET, PUT');
    return sendJson(res, 405, { ok: false, error: 'Method Not Allowed' });
  }

  try {
    await requireAdmin(req);
    const body = await readJsonBody(req);
    const settings = normalizeReferralSettings(body?.settings ?? body ?? {});
    await getReferralSettingsRef().set(settings, { merge: true });
    return sendJson(res, 200, { ok: true, settings });
  } catch (error) {
    const status = error?.status ?? 500;
    return sendJson(res, status, { ok: false, error: error?.error ?? 'Failed to update referral settings' });
  }
}
