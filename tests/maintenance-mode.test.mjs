import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const app = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');
const gate = readFileSync(new URL('../components/MaintenanceModeGate.tsx', import.meta.url), 'utf8');
const admin = readFileSync(new URL('../components/AdminPanel.tsx', import.meta.url), 'utf8');
const middleware = readFileSync(new URL('../middleware.ts', import.meta.url), 'utf8');
const rules = readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8');

test('maintenance mode replaces the customer application while preserving verified admin access', () => {
  assert.match(app, /<MaintenanceModeGate>[\s\S]*<AppShell \/>[\s\S]*<\/MaintenanceModeGate>/);
  assert.match(gate, /Site under maintenance/);
  assert.match(gate, /view\.type === 'ADMIN'/);
  assert.match(gate, /user\.isAdmin === true/);
});

test('site settings exposes a confirmed maintenance toggle', () => {
  assert.match(admin, /Turn On Maintenance/);
  assert.match(admin, /window\.confirm\(nextEnabled/);
  assert.match(admin, /doc\(db, 'site', 'maintenance'\)/);
});

test('maintenance mode blocks customer APIs and direct Firestore writes', () => {
  assert.match(middleware, /status: 503/);
  assert.match(middleware, /SITE_MAINTENANCE/);
  assert.match(middleware, /pathname\.startsWith\('\/api\/admin\/'\)/);
  assert.match(rules, /function canUseCustomerSite\(\)/);
  assert.match(rules, /allow create: if canUseCustomerSite\(\)/);
});
