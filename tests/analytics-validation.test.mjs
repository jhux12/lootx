import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const analytics = await readFile(new URL('../services/analytics.ts', import.meta.url), 'utf8');
const webhook = await readFile(new URL('../api/stripe-webhook.js', import.meta.url), 'utf8');

test('GA4 event contract is lowercase snake_case and includes the funnel', () => {
  const names = [...analytics.matchAll(/'([a-z][a-z0-9_]*)'/g)].map((match) => match[1]);
  for (const name of ['sign_up', 'view_item', 'box_open', 'begin_checkout', 'purchase', 'first_purchase', 'shipping_requested']) {
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

test('GA4 waits for gtag.js before setup and flushes events queued while loading', () => {
  assert.match(analytics, /let isLoading = false/);
  assert.match(analytics, /let isInitialized = false/);
  assert.match(analytics, /const queuedEvents: QueuedEvent\[\] = \[\]/);
  assert.match(analytics, /script\.onload = \(\) => \{/);
  assert.match(analytics, /script\.onerror = \(\) => \{/);
  assert.match(analytics, /const flushQueuedEvents = \(\) => \{[\s\S]*queuedEvents\.splice\(0\)/);

  const onload = analytics.indexOf('script.onload =');
  const setup = analytics.indexOf("window.gtag('js', new Date())", onload);
  const flush = analytics.indexOf('flushQueuedEvents();', onload);
  assert.ok(onload >= 0 && setup > onload, 'gtag setup must occur in script.onload');
  assert.ok(flush > setup, 'queued events must flush after gtag config');
  assert.doesNotMatch(analytics, /already_initialized/);
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
