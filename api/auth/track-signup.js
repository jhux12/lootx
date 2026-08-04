import { recordSignupIp } from '../_lib/signupIp.js';
import { deny, ok, requireUser } from '../_utils/auth.js';
import { getClientIp } from '../_utils/clientIp.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return deny(res, 405, 'METHOD_NOT_ALLOWED');

  try {
    const decoded = await requireUser(req);
    const signupIp = getClientIp(req);
    if (!signupIp) return deny(res, 400, 'SIGNUP_IP_UNAVAILABLE');

    const result = await recordSignupIp(decoded.uid, signupIp);
    return ok(res, result);
  } catch (error) {
    return deny(res, error?.status ?? 500, error?.error ?? error?.message ?? 'SIGNUP_IP_TRACKING_FAILED');
  }
}
