import { Resend } from 'resend';
import { adminAuth } from './_lib/firebaseAdmin.js';
import { getBearerToken, readJsonBody, sendJson } from './_lib/http.js';

const resend = new Resend(process.env.RESEND_API_KEY);
const DEFAULT_APP_URL = process.env.APP_URL || process.env.VITE_APP_URL || 'http://localhost:5173';
const EMAIL_FROM = process.env.RESEND_FROM_EMAIL;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return sendJson(res, 405, { error: 'Method Not Allowed' });
  }

  try {
    const token = getBearerToken(req);
    if (!token) {
      return sendJson(res, 401, { error: 'Missing bearer token' });
    }

    if (!process.env.RESEND_API_KEY) {
      console.error('send-email-verification missing RESEND_API_KEY');
      return sendJson(res, 500, { error: 'Email provider is not configured' });
    }

    if (!EMAIL_FROM) {
      console.error('send-email-verification missing RESEND_FROM_EMAIL');
      return sendJson(res, 500, { error: 'Verification email sender is not configured' });
    }

    const body = await readJsonBody(req);
    if (body === null) {
      return sendJson(res, 400, { error: 'Invalid JSON body' });
    }

    const decoded = await adminAuth.verifyIdToken(token);
    const userRecord = await adminAuth.getUser(decoded.uid);

    if (!userRecord.email) {
      return sendJson(res, 400, { error: 'User email is missing' });
    }

    if (userRecord.emailVerified) {
      return sendJson(res, 400, { error: 'Email is already verified' });
    }

    const origin = typeof body?.origin === 'string' && /^https?:\/\//.test(body.origin)
      ? body.origin
      : DEFAULT_APP_URL;

    const verificationLink = await adminAuth.generateEmailVerificationLink(userRecord.email, {
      url: origin,
      handleCodeInApp: true,
    });

    const { error } = await resend.emails.send({
      from: EMAIL_FROM,
      to: userRecord.email,
      subject: 'Verify your email',
      template: {
        id: 'email-verification',
        variables: {
          VERIFY_URL: verificationLink,
        },
      },
    });

    if (error) {
      console.error('send-email-verification resend error', error);
      return sendJson(res, 502, { error: 'Unable to send verification email' });
    }

    return sendJson(res, 200, { ok: true });
  } catch (error) {
    console.error('send-email-verification error', error);
    const status = Number.isInteger(error?.statusCode) ? error.statusCode : 500;
    if (error?.code === 'auth/id-token-expired' || error?.code === 'auth/argument-error') {
      return sendJson(res, 401, { error: 'Invalid bearer token' });
    }
    return sendJson(res, typeof status === 'number' ? status : 500, { error: 'Unable to send verification email' });
  }
}
