import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../utils/phoneAuthErrors.ts', import.meta.url), 'utf8');

test('phone verification reports disabled Firebase phone authentication clearly', () => {
  assert.match(source, /auth\/operation-not-allowed/);
  assert.match(source, /Text-message verification is not enabled yet/);
});

test('phone verification distinguishes reCAPTCHA, domain, quota, and retry failures', () => {
  for (const code of [
    'auth/captcha-check-failed',
    'auth/invalid-app-credential',
    'auth/unauthorized-domain',
    'auth/quota-exceeded',
    'auth/too-many-requests',
    'auth/requires-recent-login'
  ]) {
    assert.match(source, new RegExp(code.replace('/', '\\/')));
  }
});
