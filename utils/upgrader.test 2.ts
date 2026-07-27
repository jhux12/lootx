import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeExpectedPayout,
  computeUpgradeChance,
  DEFAULT_UPGRADER_SETTINGS,
  getProfitabilitySafety,
  normalizeUpgraderSettings,
  validateUpgraderSettings
} from './upgrader.ts';

test('high VIP + promo + same-rarity upgrades are clamped below positive EV', () => {
  const settings = normalizeUpgraderSettings({
    ...DEFAULT_UPGRADER_SETTINGS,
    edgeMultiplier: 0.99,
    maxExpectedPayoutRatio: 0.98,
    minChance: 0,
    maxChance: 0.95,
    rarityBonusEnabled: true,
    rarityBonusPercent: 0.08,
    vipBonusEnabled: true,
    promoEventMultiplier: 1.2
  });

  const chance = computeUpgradeChance({
    sourceValue: 100,
    targetValue: 110,
    settings,
    isSameRarity: true,
    vipMultiplier: 1.3
  });

  const expectedPayout = computeExpectedPayout({ chance, targetValue: 110 });
  const safety = getProfitabilitySafety({
    chance,
    sourceValue: 100,
    targetValue: 110,
    maxExpectedPayoutRatio: settings.maxExpectedPayoutRatio
  });

  assert.equal(Number(chance.toFixed(6)), Number((98 / 110).toFixed(6)));
  assert.equal(Number(expectedPayout.toFixed(6)), 98);
  assert.equal(safety.wasClamped, false);
  assert.ok(expectedPayout <= 100 * settings.maxExpectedPayoutRatio);
});

test('unsafe min chance is rejected by admin validation', () => {
  const settings = normalizeUpgraderSettings({
    ...DEFAULT_UPGRADER_SETTINGS,
    maxExpectedPayoutRatio: 0.98,
    minUpgradeRatio: 1.1,
    minChance: 0.95,
    maxChance: 0.99
  });

  const validation = validateUpgraderSettings(settings);
  assert.equal(validation.ok, false);
  assert.match(validation.issues[0] ?? '', /expected value ceiling/i);
});
