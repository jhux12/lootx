import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const consent = await readFile(new URL('../utils/cookieConsent.ts', import.meta.url), 'utf8');
const dialog = await readFile(new URL('../components/CookieConsentToast.tsx', import.meta.url), 'utf8');

test('consent schema is versioned and preserves the legacy Meta contract', () => {
  assert.match(consent, /CONSENT_VERSION\s*=\s*1/);
  assert.match(consent, /updatedAt:\s*new Date\(\)\.toISOString\(\)/);
  assert.match(consent, /choices\.advertising \? 'all' : 'necessary'/);
  assert.match(consent, /legacy !== 'all'.*legacy !== 'necessary'.*legacy !== 'essential'/s);
});

test('Meta initialization and PageView have independent one-time guards', () => {
  assert.match(consent, /__pullzMetaInitialized/);
  assert.match(consent, /__pullzMetaPageViewSent/);
  assert.match(consent, /fbq\('consent', 'revoke'\)/);
  assert.match(consent, /script\[data-pullz-meta-pixel\]/);
});

test('preferences dialog includes accessibility and mobile safeguards', () => {
  assert.match(dialog, /role="dialog"/);
  assert.match(dialog, /aria-modal="true"/);
  assert.match(dialog, /event\.key === 'Escape'/);
  assert.match(dialog, /document\.body\.style\.overflow = 'hidden'/);
  assert.match(dialog, /env\(safe-area-inset-bottom\)/);
});
