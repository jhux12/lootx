import { sendJson } from './_lib/http.js';

const CONTACT_EMAIL = 'contact@ripza.gg';
const MAX_LENGTHS = { firstName: 60, lastName: 60, email: 254, subject: 120, message: 3000 };
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const clean = (value) => typeof value === 'string' ? value.trim() : '';

const escapeHtml = (value) => value
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return sendJson(res, 405, { error: 'METHOD_NOT_ALLOWED', message: 'Method not allowed.' });
  }

  const fields = Object.fromEntries(Object.keys(MAX_LENGTHS).map((key) => [key, clean(req.body?.[key])]));
  const invalidField = Object.entries(MAX_LENGTHS).find(([key, max]) => !fields[key] || fields[key].length > max);

  if (invalidField || !EMAIL_PATTERN.test(fields.email)) {
    return sendJson(res, 400, { error: 'INVALID_FORM', message: 'Please complete every field with valid contact information.' });
  }

  const resendApiKey = process.env.RESEND_API_KEY;
  const emailFrom = process.env.EMAIL_FROM;
  if (!resendApiKey || !emailFrom) {
    console.error('Support email configuration is invalid.');
    return sendJson(res, 500, { error: 'EMAIL_CONFIG_INVALID', message: 'Email is temporarily unavailable. Please try again later.' });
  }

  const name = `${fields.firstName} ${fields.lastName}`;
  const htmlMessage = escapeHtml(fields.message).replace(/\n/g, '<br />');

  try {
    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendApiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: emailFrom,
        to: CONTACT_EMAIL,
        reply_to: fields.email,
        subject: `[Ripza Support] ${fields.subject}`,
        html: `<h2>New customer support message</h2><p><strong>From:</strong> ${escapeHtml(name)} (${escapeHtml(fields.email)})</p><p><strong>Subject:</strong> ${escapeHtml(fields.subject)}</p><hr /><p>${htmlMessage}</p>`
      })
    });

    if (!resendResponse.ok) {
      const details = await resendResponse.text().catch(() => '');
      throw new Error(`Resend request failed: ${resendResponse.status} ${details}`);
    }

    return sendJson(res, 200, { ok: true });
  } catch (error) {
    console.error('Failed to send support email', error);
    return sendJson(res, 500, { error: 'EMAIL_SEND_FAILED', message: 'We could not send your message. Please try again.' });
  }
}
