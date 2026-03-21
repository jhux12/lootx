import { adminAuth } from './_lib/firebaseAdmin.js';
import { getBearerToken, sendJson } from './_lib/http.js';

const EXPECTED_EMAIL_FROM = 'Pullz.gg <verify@pullz.gg>';

const getVerificationHandlerUrl = () => {
  const configuredBaseUrl = process.env.VERIFY_CONTINUE_URL || 'https://pullz.gg';

  try {
    const url = new URL(configuredBaseUrl);
    url.pathname = '/verify';
    url.search = '';
    url.hash = '';
    return url.toString();
  } catch {
    return 'https://pullz.gg/verify';
  }
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return sendJson(res, 405, { error: 'METHOD_NOT_ALLOWED', message: 'Method not allowed.' });
  }

  const token = getBearerToken(req);
  if (!token) {
    return sendJson(res, 401, { error: 'UNAUTHENTICATED', message: 'Authentication is required.' });
  }

  let decoded;
  try {
    decoded = await adminAuth.verifyIdToken(token);
  } catch {
    return sendJson(res, 401, { error: 'UNAUTHENTICATED', message: 'Authentication is required.' });
  }

  if (!decoded.email) {
    return sendJson(res, 400, { error: 'EMAIL_REQUIRED', message: 'This account does not have an email address.' });
  }

  if (decoded.email_verified) {
    return sendJson(res, 409, { error: 'EMAIL_ALREADY_VERIFIED', message: 'This email address is already verified.' });
  }

  const emailFrom = process.env.EMAIL_FROM;
  const resendApiKey = process.env.RESEND_API_KEY;

  if (emailFrom !== EXPECTED_EMAIL_FROM || !resendApiKey) {
    console.error('Verification email configuration is invalid.');
    return sendJson(res, 500, {
      error: 'EMAIL_CONFIG_INVALID',
      message: 'Verification email is not configured correctly.'
    });
  }

  try {
    const verificationLink = await adminAuth.generateEmailVerificationLink(decoded.email, {
      url: getVerificationHandlerUrl()
    });

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: emailFrom,
        to: decoded.email,
        subject: 'Verify your Pullz.gg email',
        template: {
          id: 'email-verification',
          variables: {
            VERIFY_URL: verificationLink
          }
        }
      })
    });

    if (!resendResponse.ok) {
      const resendPayload = await resendResponse.text().catch(() => '');
      throw new Error(`Resend request failed: ${resendResponse.status} ${resendPayload}`);
    }

    return sendJson(res, 200, { ok: true });
  } catch (error) {
    console.error('Failed to send verification email', error);
    return sendJson(res, 500, {
      error: 'EMAIL_SEND_FAILED',
      message: 'We could not send the verification email. Please try again.'
    });
  }
}
