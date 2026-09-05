import assert from 'node:assert/strict';
import test from 'node:test';

import contactSupport from '../api/contact-support.js';

const validBody = {
  firstName: 'Jamie',
  lastName: 'Customer',
  email: 'jamie@example.com',
  subject: 'Order question',
  message: 'Can you help with my order?'
};

const createResponse = () => ({
  statusCode: 200,
  headers: {},
  payload: undefined,
  setHeader(name, value) {
    this.headers[name] = value;
  },
  end(body) {
    this.payload = JSON.parse(body);
  }
});

test('support messages are sent to contact@ripza.gg with a safe default sender', async (t) => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.RESEND_API_KEY;
  const originalEmailFrom = process.env.EMAIL_FROM;
  const originalSupportFrom = process.env.SUPPORT_EMAIL_FROM;

  t.after(() => {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = originalKey;
    if (originalEmailFrom === undefined) delete process.env.EMAIL_FROM;
    else process.env.EMAIL_FROM = originalEmailFrom;
    if (originalSupportFrom === undefined) delete process.env.SUPPORT_EMAIL_FROM;
    else process.env.SUPPORT_EMAIL_FROM = originalSupportFrom;
  });

  process.env.RESEND_API_KEY = 're_test';
  delete process.env.EMAIL_FROM;
  delete process.env.SUPPORT_EMAIL_FROM;

  let request;
  globalThis.fetch = async (url, options) => {
    request = { url, options };
    return new Response(JSON.stringify({ id: 'email_123' }), { status: 200 });
  };

  const response = createResponse();
  await contactSupport({ method: 'POST', body: validBody }, response);

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.payload, { ok: true });
  assert.equal(request.url, 'https://api.resend.com/emails');
  assert.equal(request.options.headers.Authorization, 'Bearer re_test');

  const email = JSON.parse(request.options.body);
  assert.equal(email.to, 'contact@ripza.gg');
  assert.equal(email.from, 'Ripza <verify@ripza.gg>');
  assert.equal(email.reply_to, validBody.email);
  assert.match(email.subject, /Order question/);
});

test('support endpoint reports missing Resend credentials without making a request', async (t) => {
  const originalKey = process.env.RESEND_API_KEY;
  t.after(() => {
    if (originalKey === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = originalKey;
  });
  delete process.env.RESEND_API_KEY;

  const response = createResponse();
  await contactSupport({ method: 'POST', body: validBody }, response);

  assert.equal(response.statusCode, 500);
  assert.equal(response.payload.error, 'EMAIL_CONFIG_INVALID');
});
