import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('banning keeps Firebase sign-in enabled while persisting the restriction', async () => {
  const source = await readFile(new URL('../api/admin/users.js', import.meta.url), 'utf8');

  assert.match(source, /adminAuth\.updateUser\(userId, \{ disabled: false \}\)/);
  assert.doesNotMatch(source, /revokeRefreshTokens/);
  assert.match(source, /collection\('users'\)\.doc\(userId\)\.set\(\{ status/);
});

test('restricted sessions are rejected by the shared authenticated feature guard', async () => {
  const source = await readFile(new URL('../api/_utils/auth.js', import.meta.url), 'utf8');

  assert.match(source, /status === 'banned'/);
  assert.match(source, /ACCOUNT_RESTRICTED/);
  assert.match(source, /await requireActiveAccount\(decoded\.uid\)/);
});

test('legacy disabled bans are restored before email and Google sign-in', async () => {
  const emailLogin = await readFile(new URL('../context/GameContext.tsx', import.meta.url), 'utf8');
  const restoreEndpoint = await readFile(new URL('../api/auth/restore-restricted-login.js', import.meta.url), 'utf8');
  const googleCallback = await readFile(new URL('../api/auth/google/callback.ts', import.meta.url), 'utf8');

  assert.match(emailLogin, /restore-restricted-login/);
  assert.match(restoreEndpoint, /authUser\.disabled/);
  assert.match(restoreEndpoint, /status === 'banned'/);
  assert.match(restoreEndpoint, /disabled: false/);
  assert.match(googleCallback, /userRecord\.disabled/);
  assert.match(googleCallback, /disabled: false/);
});
