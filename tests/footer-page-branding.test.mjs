import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('default footer and legal page copy uses Ripza branding', async () => {
  const content = await source('utils/footerPagesContent.ts');
  const defaults = content.slice(content.indexOf('export const DEFAULT_FOOTER_PAGE_CONTENT'));

  assert.doesNotMatch(defaults, /\bPullz\b/);
  assert.match(defaults, /title: 'About Ripza'/);
  assert.match(defaults, /Welcome to Ripza!/);
  assert.match(defaults, /support@ripza\.gg/);
});

test('persisted footer page titles and content have legacy branding normalized', async () => {
  const [content, managedPage, editor] = await Promise.all([
    source('utils/footerPagesContent.ts'),
    source('components/FooterManagedContent.tsx'),
    source('components/admin/FooterPagesEditor.tsx')
  ]);

  assert.match(content, /export const normalizeFooterPageBranding/);
  assert.match(content, /content\.replace\(\/\\bpullz\(\\\.gg\)\?\\b\/gi/);
  assert.match(managedPage, /setTitle\(normalizeFooterPageBranding/);
  assert.match(managedPage, /setContent\(normalizeFooterPageBranding/);
  assert.match(editor, /published\.content`\]: brandedDraft/);
  assert.match(editor, /draft\.content`\]: brandedDraft/);
});

test('provably fair features use the Ripza default client seed', async () => {
  const paths = [
    'api/_lib/provablyFairState.js',
    'api/attempt-upgrade.js',
    'api/open-case.js',
    'components/CaseOpening.tsx',
    'components/ProvablyFairPage.tsx',
    'src/pages/UpgraderPage.tsx'
  ];
  const files = await Promise.all(paths.map(source));

  for (const file of files) {
    assert.match(file, /ripza-player/);
    assert.doesNotMatch(file, /pullz-?player/);
  }
});
