import test from 'node:test';
import assert from 'node:assert/strict';

import { getClientIp, normalizeIp } from '../api/_utils/clientIp.js';
import { MAX_UNBANNED_ACCOUNTS_PER_SIGNUP_IP, shouldAutoBanSignupIpAccount } from '../api/_lib/signupIpPolicy.js';
import { evaluateSignupFraud } from '../api/_lib/fraudPolicy.js';

test('getClientIp uses the originating forwarded address', () => {
  const request = {
    headers: {
      'x-forwarded-for': '203.0.113.9, 10.0.0.4',
      'x-real-ip': '198.51.100.2'
    },
    socket: { remoteAddress: '127.0.0.1' }
  };

  assert.equal(getClientIp(request), '203.0.113.9');
});

test('fraud scoring applies device, IP, welcome bonus, and automatic-ban rules', () => {
  assert.deepEqual(evaluateSignupFraud({ accountsBeforeDevice: 1 }), {
    score: 6, reasons: ['shared_device'], autoBanned: false, autoBanReason: null
  });
  assert.equal(evaluateSignupFraud({ accountsBeforeDevice: 1, accountsBeforeIp: 1 }).autoBanned, true);
  assert.equal(evaluateSignupFraud({ deviceWelcomeBonusClaimed: true }).score, 8);
  assert.equal(evaluateSignupFraud({ ipWelcomeBonusClaimed: true }).score, 4);
  assert.equal(evaluateSignupFraud({ accountsBeforeDevice: 2 }).autoBanReason, 'device_account_limit');
  assert.equal(evaluateSignupFraud({ accountsBeforeIp: 3 }).autoBanReason, 'signup_ip_account_limit');
});

test('getClientIp falls back to the socket and normalizes mapped IPv4', () => {
  assert.equal(getClientIp({ headers: {}, socket: { remoteAddress: '::ffff:192.0.2.10' } }), '192.0.2.10');
});

test('normalizeIp handles bracketed IPv6 and rejects empty values', () => {
  assert.equal(normalizeIp('[2001:db8::1]:443'), '2001:db8::1');
  assert.equal(normalizeIp(' unknown '), null);
  assert.equal(normalizeIp(''), null);
});

test('the first three accounts from an IP are allowed and the fourth and later are banned', () => {
  for (let accountsBeforeSignup = 0; accountsBeforeSignup < MAX_UNBANNED_ACCOUNTS_PER_SIGNUP_IP; accountsBeforeSignup += 1) {
    assert.equal(shouldAutoBanSignupIpAccount(accountsBeforeSignup), false);
  }
  assert.equal(shouldAutoBanSignupIpAccount(3), true);
  assert.equal(shouldAutoBanSignupIpAccount(4), true);
});
