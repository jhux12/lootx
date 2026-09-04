import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('canonical and social metadata use the Ripza origin', async () => {
  const [index, seo] = await Promise.all([source('index.html'), source('utils/seoSettings.ts')]);
  assert.match(index, /rel="canonical" href="https:\/\/ripza\.gg"/);
  assert.match(index, /property="og:url" content="https:\/\/ripza\.gg"/);
  assert.match(seo, /canonicalUrl: PUBLIC_BRAND\.canonicalOrigin/);
});

test('every sitemap location and robots sitemap use the Ripza origin', async () => {
  const [sitemap, robots] = await Promise.all([source('public/sitemap.xml'), source('public/robots.txt')]);
  const locations = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
  assert.ok(locations.length > 0);
  assert.ok(locations.every((url) => url.startsWith('https://ripza.gg/')));
  assert.match(robots, /Sitemap: https:\/\/ripza\.gg\/sitemap\.xml/);
});

test('referrals use the centralized canonical origin', async () => {
  const referrals = await source('components/ReferralsPage.tsx');
  assert.match(referrals, /CANONICAL_REFERRAL_BASE_URL = PUBLIC_BRAND\.canonicalOrigin/);
  assert.match(referrals, /`\$\{CANONICAL_REFERRAL_BASE_URL\}\/join\?ref=/);
});

test('Google OAuth fallback and callback documentation use Ripza', async () => {
  const [start, callback, env] = await Promise.all([
    source('api/auth/google/start.ts'), source('api/auth/google/callback.ts'), source('.env.example')
  ]);
  assert.match(start, /process\.env\.APP_URL \|\| 'https:\/\/ripza\.gg'/);
  assert.match(callback, /process\.env\.APP_URL \|\| 'https:\/\/ripza\.gg'/);
  assert.match(env, /GOOGLE_REDIRECT_URI=https:\/\/ripza\.gg\/api\/auth\/google\/callback/);
});

test('verification email sender, subject, and URL fallbacks use Ripza', async () => {
  const email = await source('api/send-verification-email.js');
  assert.match(email, /Ripza <verify@ripza\.gg>/);
  assert.match(email, /Verify your Ripza email/);
  assert.match(email, /VERIFY_CONTINUE_URL \|\| 'https:\/\/ripza\.gg'/);
  assert.match(email, /return 'https:\/\/ripza\.gg\/verify'/);
});

test('coin and shipping checkout return URLs derive from APP_URL with a Ripza fallback', async () => {
  const [helper, coins, shipping, legacyShipping] = await Promise.all([
    source('api/_lib/appUrl.js'), source('api/create-checkout-session.js'),
    source('api/shipping/create-checkout-session.js'), source('api/create-shipping-checkout-session.js')
  ]);
  assert.match(helper, /DEFAULT_APP_URL = 'https:\/\/ripza\.gg'/);
  for (const checkout of [coins, shipping, legacyShipping]) {
    assert.match(checkout, /const appUrl = getAppUrl\(\)/);
    assert.match(checkout, /success_url: `\$\{appUrl\}/);
    assert.match(checkout, /cancel_url: `\$\{appUrl\}/);
  }
});
