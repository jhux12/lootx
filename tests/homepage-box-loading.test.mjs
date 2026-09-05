import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('homepage retries transient catalog failures without caching an empty result', async () => {
  const repository = await source('utils/boxRepository.ts');

  assert.match(repository, /HOMEPAGE_RETRY_DELAYS_MS/);
  assert.match(repository, /BOX_SUMMARY_LOAD_TIMEOUT/);
  assert.match(repository, /if \(boxes\.length > 0\) homepageCache\.set/);
});

test('homepage distinguishes loading and failed catalog reads from an empty catalog', async () => {
  const [home, homepage] = await Promise.all([
    source('components/HomeReplica.tsx'),
    source('src/figma/FigmaHomePage.tsx')
  ]);

  assert.match(home, /summariesLoading/);
  assert.match(homepage, /Loading packs…/);
  assert.match(homepage, /!isLoadingBoxes && !hasBoxLoadError/);
});
