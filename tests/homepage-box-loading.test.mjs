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

test('pack surfaces restore cached summaries immediately and retry bounded network reads', async () => {
  const [repository, home, catalog] = await Promise.all([
    source('utils/boxRepository.ts'),
    source('components/HomeReplica.tsx'),
    source('components/BoxCatalog.tsx')
  ]);

  assert.match(repository, /SUMMARY_STORAGE_MAX_AGE_MS/);
  assert.match(repository, /getCachedBoxSummaries/);
  assert.match(repository, /getBoxSummaryPageWithRetry/);
  assert.match(repository, /page\.boxes\.length === 0/);
  assert.match(home, /useState<MysteryBox\[\]>\(\(\) => getCachedBoxSummaries\(\)\)/);
  assert.match(catalog, /catalogReloadKey/);
  assert.match(catalog, /!catalogError && groupedBoxes\.length === 0/);
});

test('live pulls use a capped listener, session cache, and finite loading state', async () => {
  const pulls = await source('src/lib/pulls/useRecentPulls.ts');

  assert.match(pulls, /RECENT_PULLS_CACHE_KEY/);
  assert.match(pulls, /limit\(100\)/);
  assert.match(pulls, /setTimeout\(\(\) => setIsLoading\(false\), 6_000\)/);
  assert.doesNotMatch(pulls, /pullLimit \* 10/);

  const ticker = await source('src/figma/BetLiveWinsTicker.tsx');
  assert.match(ticker, /loading=\{index < 6 \? 'eager' : 'lazy'\}/);
});
