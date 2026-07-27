import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const analytics = await readFile(new URL('../services/analytics.ts', import.meta.url), 'utf8');
const webhook = await readFile(new URL('../api/stripe-webhook.js', import.meta.url), 'utf8');
const consent = await readFile(new URL('../utils/cookieConsent.ts', import.meta.url), 'utf8');
const topUpModal = await readFile(new URL('../components/TopUpModal.tsx', import.meta.url), 'utf8');

test('GA4 event contract is lowercase snake_case and includes the funnel', () => {
  const names = [...analytics.matchAll(/'([a-z][a-z0-9_]*)'/g)].map((match) => match[1]);
  for (const name of ['sign_up', 'view_item', 'box_open', 'coin_package_view', 'coin_package_select', 'begin_checkout', 'checkout_abandoned', 'checkout_failed', 'purchase', 'first_purchase', 'shipping_requested']) {
    assert.ok(names.includes(name), `missing ${name}`);
    assert.match(name, /^[a-z][a-z0-9_]*$/);
  }
});

test('client validation strips PII and undefined values and persists session dedupe', () => {
  assert.match(analytics, /PII_KEY/);
  assert.match(analytics, /value !== undefined/);
  assert.match(analytics, /sessionStorage\.getItem/);
  assert.match(analytics, /pullz_ga4_sent/);
  assert.match(analytics, /session_deduplicated/);
});

test('GA4 command queue pushes the gtag arguments object', () => {
  assert.match(analytics, /function\s+gtag\s*\([^)]*\)\s*\{\s*window\.dataLayer!\.push\(arguments\);\s*\}/);
  assert.doesNotMatch(analytics, /dataLayer!\.push\(args\)/);
});

test('purchase and first purchase only originate in the verified webhook flow', () => {
  assert.match(webhook, /constructEvent/);
  assert.match(webhook, /ga4_events/);
  assert.match(webhook, /transaction_id: session\.id/);
  assert.match(webhook, /name: 'purchase'/);
  assert.match(webhook, /name: 'first_purchase'/);
  assert.match(webhook, /firebaseAccount\.metadata\.creationTime/);
  assert.doesNotMatch(analytics, /GA4_API_SECRET/);
});

test('Measurement Protocol uses the base GA cookie client id', () => {
  assert.match(analytics, /_ga=GA\\d\+\\\.\\d\+\\\.\(\\d\+\\\.\\d\+\)/);
  assert.match(analytics, /session state, not the client ID/);
});

test('Meta Pixel is consent-gated and loads the browser library', () => {
  assert.match(consent, /hasMarketingConsent\(\)/);
  assert.match(consent, /VITE_META_PIXEL_ID/);
  assert.match(consent, /connect\.facebook\.net\/en_US\/fbevents\.js/);
  assert.match(consent, /fbq\('track', 'PageView'\)/);
});

test('coin package intent and checkout failures are tracked before redirect', () => {
  assert.match(topUpModal, /trackCoinPackageView/);
  assert.match(topUpModal, /trackCoinPackageSelect/);
  assert.match(topUpModal, /savePendingCheckout/);
  assert.match(topUpModal, /trackGaEvent\('checkout_failed'/);
});

test('verified GA4 delivery records success only after Measurement Protocol succeeds', () => {
  assert.match(webhook, /sendGa4EventOnce/);
  assert.match(webhook, /if \(result\.ok\)/);
  assert.match(webhook, /status: 'sent'/);
  assert.match(webhook, /status: 'failed'/);
});
