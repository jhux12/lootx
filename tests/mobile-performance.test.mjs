import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('case preview remains static until a deliberate opening', () => {
  const source = read('components/CaseOpening.tsx');
  assert.doesNotMatch(source, /iterations:\s*Infinity/);
  assert.match(source, /Never animate merely because the case page mounted/);
});

test('homepage wins use one bounded lightweight query and native mobile scrolling', () => {
  const source = read('components/HomeReplica.tsx');
  assert.match(source, /collection\(db, 'homepageWins'\).*orderBy\('timestamp', 'desc'\).*limit\(10\)/s);
  assert.doesNotMatch(source, /getBoxDetail\(/);
  assert.doesNotMatch(source, /\[\.\.\.wins, \.\.\.wins\]/);
  assert.match(source, /overflow-x-auto/);
});

test('viewport events share one animation-frame scheduler', () => {
  const source = read('components/MobileBottomNav.tsx');
  assert.match(source, /if \(rafId !== null\) return;/);
  assert.match(source, /Math\.abs\(offset - lastOffset\) >= 0\.5/);
  assert.match(source, /vv\?\.height \?\? innerHeight/);
});
