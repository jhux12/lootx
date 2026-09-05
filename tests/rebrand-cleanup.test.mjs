import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('the About page cannot render another page\'s content (e.g. Terms) under a stale key', async () => {
  const content = await source('utils/footerPagesContent.ts');
  const defaultsSource = content.slice(content.indexOf('export const DEFAULT_FOOTER_PAGE_CONTENT'));

  // Re-implement the guard's heading-collision check against the real default
  // copy strings to prove About and Terms headings cannot be confused for one
  // another, without needing a TypeScript loader in this plain Node test runner.
  const headingOf = (key) => {
    const match = defaultsSource.match(new RegExp(`${key}: \\{[\\s\\S]*?content: \`(# [^\\n]+)`));
    return match?.[1]?.replace(/^# /, '').trim();
  };

  assert.match(content, /export const isMismatchedFooterPageContent/);
  assert.match(content, /extractHeading/);
  assert.notEqual(headingOf('about'), headingOf('terms'));
  assert.ok(headingOf('about'));
  assert.ok(headingOf('terms'));
});

test('FooterManagedContent falls back to the default page copy when persisted content is mismatched', async () => {
  const managedPage = await source('components/FooterManagedContent.tsx');
  assert.match(managedPage, /isMismatchedFooterPageContent/);
  assert.match(managedPage, /isMismatched \? fallback\.content : publishedContent/);
});

test('the About default content is distinct from Terms and does not duplicate it', async () => {
  const content = await source('utils/footerPagesContent.ts');
  const defaultsSource = content.slice(content.indexOf('export const DEFAULT_FOOTER_PAGE_CONTENT'));
  const aboutBlock = defaultsSource.slice(defaultsSource.indexOf('about: {'), defaultsSource.indexOf('faq: {'));
  assert.match(aboutBlock, /collectible pack-opening/i);
  assert.doesNotMatch(aboutBlock, /Terms of Service/i);
});

test('pullz.gg and www.pullz.gg redirect permanently to the canonical www.ripza.gg origin', async () => {
  const vercelConfig = JSON.parse(await source('vercel.json'));
  const redirects = vercelConfig.redirects ?? [];

  for (const host of ['pullz.gg', 'www.pullz.gg']) {
    const redirect = redirects.find((entry) => entry.has?.some((condition) => condition.type === 'host' && condition.value === host));
    assert.ok(redirect, `expected a redirect rule for host ${host}`);
    assert.equal(redirect.permanent, true);
    assert.match(redirect.destination, /^https:\/\/www\.ripza\.gg\//);
    assert.match(redirect.source, /:path\*/);
    assert.match(redirect.destination, /:path\*/);
  }

  const redirectHosts = redirects.map((entry) => entry.has?.find((c) => c.type === 'host')?.value);
  assert.ok(!redirectHosts.includes('www.ripza.gg'), 'the canonical host must never redirect to itself');
});

test('the homepage no longer links to an unverified Trustpilot profile', async () => {
  const homepage = await source('src/figma/FigmaHomePage.tsx');
  assert.doesNotMatch(homepage, /trustpilot/i);
});

test('no customer-facing surface still ships the retired Pullz "P" logo files', async () => {
  const referencingFiles = await Promise.all([
    source('constants.ts'),
    source('components/Hero.tsx'),
    source('components/PromoPopupModal.tsx'),
    source('components/CaseOpening.tsx'),
    source('components/BrandLockup.tsx'),
    source('index.html'),
    source('components/SeoHead.tsx'),
    source('assets/email-templates/password-reset.html')
  ]);

  for (const file of referencingFiles) {
    assert.doesNotMatch(file, /pullz-icon-(color|navy|white)-2048\.png/);
    assert.doesNotMatch(file, /assetspngpullz-horizontal-light-2400\.png/);
  }
});

test('the Organization/Website JSON-LD schema derives its URL from the canonical Ripza brand config', async () => {
  const [seoHead, brand] = await Promise.all([source('components/SeoHead.tsx'), source('config/publicBrand.ts')]);
  assert.match(brand, /name: 'Ripza'/);
  assert.match(brand, /canonicalOrigin: 'https:\/\/www\.ripza\.gg'/);
  assert.match(seoHead, /'@type': 'Organization'/);
  assert.match(seoHead, /url,/);
});
