import { adminAuth } from './_lib/firebaseAdmin.js';
import { readJsonBody, sendJson } from './_lib/http.js';
import { getBearerToken } from './_utils/auth.js';
import { consumeRateLimit, getRateLimitKey } from './_utils/ratelimit.js';

const DEFAULT_VERIFY_CONTINUE_URL = 'https://pullz.gg';
const REQUIRED_ENV_VARS = ['RESEND_API_KEY', 'EMAIL_FROM'];

const getMissingVerificationEnvVars = () => REQUIRED_ENV_VARS.filter((envVar) => {
  const value = process.env[envVar];
  return typeof value !== 'string' || !value.trim();
});

const getVerificationSenderConfig = () => {
  const missingEnvVars = getMissingVerificationEnvVars();

  if (missingEnvVars.length > 0) {
    throw {
      status: 500,
      error: 'VERIFICATION_EMAIL_CONFIG_MISSING',
      message: `Verification email sender is not fully configured. Missing env vars: ${missingEnvVars.join(', ')}.`
    };
  }

  return {
    resendApiKey: process.env.RESEND_API_KEY.trim(),
    emailFrom: process.env.EMAIL_FROM.trim(),
    continueUrl: process.env.VERIFY_CONTINUE_URL || DEFAULT_VERIFY_CONTINUE_URL
  };
};

const sendVerificationEmail = async ({ resendApiKey, emailFrom, email, verificationLink }) => {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: emailFrom,
      to: [email],
      subject: 'Verify your Pullz.gg email',
      template: {
        id: 'email-verification',
        variables: {
          VERIFY_URL: verificationLink
        }
      }
    })
  });

  if (!response.ok) {
    let payload = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }

    throw {
      status: response.status,
      error: 'RESEND_SEND_FAILED',
      message: payload?.message || payload?.error?.message || 'Resend could not send the verification email.',
      details: payload
    };
  }
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return sendJson(res, 405, { ok: false, error: 'METHOD_NOT_ALLOWED', message: 'Only POST is allowed.' });
  }

  try {
    const token = getBearerToken(req);
    if (!token) {
      return sendJson(res, 401, { ok: false, error: 'AUTH_REQUIRED', message: 'Please sign in to resend the verification email.' });
    }

    const decoded = await adminAuth.verifyIdToken(token);
    const rateLimit = consumeRateLimit({
      key: getRateLimitKey({ req, uid: decoded.uid, prefix: 'resend-email-verification' }),
      limit: 5,
      windowMs: 60_000
    });

    if (!rateLimit.ok) {
      return sendJson(res, 429, { ok: false, error: 'RATE_LIMITED', message: 'Too many verification email requests. Please wait a minute and try again.' });
    }

    const body = await readJsonBody(req);
    if (body == null) {
      return sendJson(res, 400, { ok: false, error: 'INVALID_JSON', message: 'Request body must be valid JSON.' });
    }

    const email = typeof body?.email === 'string' ? body.email.trim() : '';
    if (!email) {
      return sendJson(res, 400, { ok: false, error: 'EMAIL_REQUIRED', message: 'A verified account email is required.' });
    }

    if (decoded.email && decoded.email.toLowerCase() !== email.toLowerCase()) {
      return sendJson(res, 403, { ok: false, error: 'EMAIL_MISMATCH', message: 'The verification email can only be sent to your signed-in account email.' });
    }

    if (decoded.email_verified) {
      return sendJson(res, 400, { ok: false, error: 'ALREADY_VERIFIED', message: 'This email address is already verified.' });
    }

    const { resendApiKey, emailFrom, continueUrl } = getVerificationSenderConfig();
    const verificationLink = await adminAuth.generateEmailVerificationLink(email, {
      url: continueUrl,
      handleCodeInApp: false
    });

    await sendVerificationEmail({ resendApiKey, emailFrom, email, verificationLink });

    return sendJson(res, 200, { ok: true });
  } catch (error) {
    const status = error?.status || 500;
    const message = error?.message || 'Unable to send verification email.';
    const code = error?.error || 'VERIFICATION_EMAIL_SEND_FAILED';

    console.error('Failed to resend verification email', {
      status,
      code,
      message,
      details: error?.details || error?.response?.data || error
    });

    return sendJson(res, status, {
      ok: false,
      error: code,
      message
    });
  }
}
