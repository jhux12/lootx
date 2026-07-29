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

test('case route does not start or retain an AudioContext before an open', () => {
  const sounds = source('context/SoundContext.tsx');
  const caseOpening = source('components/CaseOpening.tsx');
  assert.doesNotMatch(sounds, /new AudioContext|createOscillator|prepareCaseAudio/);
  assert.doesNotMatch(caseOpening, /prepareCaseAudio/);
});

test('mobile homepage does not autoplay hero or eagerly decode inactive hero art', () => {
  const home = source('components/HomeReplica.tsx');
  assert.match(home, /showFreeBoxSlide \|\| performanceMode\.isMobile/);
  assert.match(home, /loadImage=\{showPromoBoxHero\}/);
  assert.match(home, /activeHero === 'hot-picks'/);
});

test('mobile idle CSS drops permanent spinner promotion and continuous pulses', () => {
  const html = source('index.html');
  const spinnerRule = html.match(/html\.pullz-mobile-optimized \.pullz-spinner-track \{([^}]*)\}/)?.[1] ?? '';
  assert.doesNotMatch(spinnerRule, /will-change|translateZ/);
  assert.match(html, /html\.pullz-mobile-optimized \.ambient-pulse/);
  assert.match(html, /html\.pullz-mobile-optimized \.win-rarity-card::before/);
});
