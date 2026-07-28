import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('case preview does not start an infinite Web Animation', () => {
  const caseOpening = source('components/CaseOpening.tsx');
  assert.doesNotMatch(caseOpening, /iterations:\s*Infinity/);
  assert.match(caseOpening, /unopened preview reel remains static/);
});

test('homepage wins uses one bounded lightweight query and never box details', () => {
  const home = source('components/HomeReplica.tsx');
  const repository = source('utils/recentWinsRepository.ts');
  assert.doesNotMatch(home, /getBoxDetail/);
  assert.match(repository, /collection\(db, 'homepageWins'\)/);
  assert.match(repository, /limit\(10\)/);
});

test('mobile viewport events share a guarded animation-frame scheduler', () => {
  const nav = source('components/MobileBottomNav.tsx');
  assert.match(nav, /if \(rafId !== null\) return/);
  assert.match(nav, /Math\.abs\(offset - lastOffset\) >= 0\.5/);
  assert.match(nav, /vv\?\.addEventListener\('scroll', deferredUpdate, \{ passive: true \}\)/);
});
