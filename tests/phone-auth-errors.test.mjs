import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../utils/phoneAuthErrors.ts', import.meta.url), 'utf8');
const modalSource = await readFile(new URL('../components/PhoneVerificationModal.tsx', import.meta.url), 'utf8');
const loginModalSource = await readFile(new URL('../components/LoginModal.tsx', import.meta.url), 'utf8');

test('phone verification reports disabled Firebase phone authentication clearly', () => {
  assert.match(source, /auth\/operation-not-allowed/);
  assert.match(source, /Text-message verification is not enabled yet/);
});

test('phone entry defaults to the US and offers every supported country calling code', () => {
  assert.match(modalSource, /getCountries\(\)/);
  assert.match(modalSource, /getCountryCallingCode/);
  assert.match(modalSource, /parsed\?\.country \?\? 'US'/);
  assert.match(modalSource, /aria-label="Country code"/);
  assert.match(modalSource, /autoComplete="tel-national"/);
});

test('signup does not request a phone number', () => {
  assert.doesNotMatch(loginModalSource, /phoneNumber|signup-phone|Confirm phone/);
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

test('code confirmation reports incorrect, expired, and missing codes separately', () => {
  assert.match(source, /auth\/invalid-verification-code/);
  assert.match(source, /verification code is incorrect/);
  assert.match(source, /auth\/code-expired/);
  assert.match(source, /verification code has expired/);
  assert.match(source, /auth\/missing-verification-code/);
  assert.match(modalSource, /getPhoneCodeErrorMessage\(error\)/);
  assert.doesNotMatch(modalSource, /That code is incorrect or expired/);
});

test('post-verification profile mirroring cannot turn success into an expired-code error', () => {
  assert.match(modalSource, /void updateDoc[\s\S]*?\.catch/);
  assert.match(modalSource, /Phone verified\./);
});
