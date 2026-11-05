import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import authRouter from './auth.js';
import User from '../models/User.js';
import { ensureDb, startTestServer } from '../test/helpers.js';

// Throwaway users. The test server re-upserts EMAIL on every request, so after the email
// change the original address is cleaned up too.
const STAMP = Date.now();
const EMAIL = `__test_auth_${STAMP}@inturn.local`;
const OTHER = `__test_auth_other_${STAMP}@inturn.local`;
const NEW_EMAIL = `__test_auth_new_${STAMP}@inturn.local`;
const OLD_PW = 'OldPass1';
let base, close, userId;

const json = { 'Content-Type': 'application/json' };
const put = (path, body) => fetch(`${base}${path}`, { method: 'PUT', headers: json, body: JSON.stringify(body) });
const hashOf = async () => (await User.findById(userId).select('+passwordHash')).passwordHash;

before(async () => {
  await ensureDb();
  const passwordHash = await bcrypt.hash(OLD_PW, 10);
  userId = (await User.create({ name: 'Auth Tester', email: EMAIL, passwordHash }))._id;
  await User.create({ name: 'Other', email: OTHER, passwordHash });
  ({ base, close } = await startTestServer('/api/auth', authRouter, { email: EMAIL }));
});

after(async () => {
  await User.deleteMany({ email: { $in: [EMAIL, OTHER, NEW_EMAIL] } });
  await close();
  await mongoose.disconnect();
});

test('PUT /password rejects a wrong current password and keeps the hash', async () => {
  const before = await hashOf();
  const res = await put('/password', { currentPassword: 'Nope1234', password: 'NewPass1', confirmPassword: 'NewPass1' });
  assert.equal(res.status, 400);
  assert.deepEqual((await res.json()).errors, ['Current password is incorrect']);
  assert.equal(await hashOf(), before);
});

test('PUT /password enforces the password policy, confirmation and a new value', async () => {
  const weak = await put('/password', { currentPassword: OLD_PW, password: 'short', confirmPassword: 'short' });
  assert.equal(weak.status, 400);
  assert.ok((await weak.json()).errors.some((e) => e.startsWith('Password must')));

  const mismatch = await put('/password', { currentPassword: OLD_PW, password: 'NewPass1', confirmPassword: 'NewPass2' });
  assert.equal(mismatch.status, 400);
  assert.ok((await mismatch.json()).errors.includes('Confirm password and password do not match'));

  const same = await put('/password', { currentPassword: OLD_PW, password: OLD_PW, confirmPassword: OLD_PW });
  assert.equal(same.status, 400);

  const missing = await put('/password', { password: 'NewPass1', confirmPassword: 'NewPass1' });
  assert.deepEqual((await missing.json()).errors, ['Enter your current password']);
});

test('PUT /password stores a new hash that matches the new password', async () => {
  const res = await put('/password', { currentPassword: OLD_PW, password: 'NewPass1', confirmPassword: 'NewPass1' });
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { message: 'Password updated' });
  const hash = await hashOf();
  assert.equal(await bcrypt.compare('NewPass1', hash), true);
  assert.equal(await bcrypt.compare(OLD_PW, hash), false);
});

test('PUT /email rejects bad format, wrong password, same email and a taken email', async () => {
  const bad = await put('/email', { email: 'not-an-email', currentPassword: 'NewPass1' });
  assert.equal(bad.status, 400);
  assert.deepEqual((await bad.json()).errors, ['Email format is invalid']);

  const wrong = await put('/email', { email: NEW_EMAIL, currentPassword: 'Nope1234' });
  assert.equal(wrong.status, 400);
  assert.deepEqual((await wrong.json()).errors, ['Current password is incorrect']);

  const same = await put('/email', { email: EMAIL.toUpperCase(), currentPassword: 'NewPass1' });
  assert.deepEqual((await same.json()).errors, ['That is already your email']);

  const taken = await put('/email', { email: OTHER, currentPassword: 'NewPass1' });
  assert.equal(taken.status, 400);
  assert.deepEqual((await taken.json()).errors, ['Email is already registered']);

  assert.equal((await User.findById(userId)).email, EMAIL);
});

// Last: the helper re-upserts EMAIL on any later request.
test('PUT /email updates the stored email', async () => {
  const res = await put('/email', { email: `  ${NEW_EMAIL.toUpperCase()} `, currentPassword: 'NewPass1' });
  assert.equal(res.status, 200);
  const { user } = await res.json();
  assert.equal(user.email, NEW_EMAIL);
  assert.equal('passwordHash' in user, false);
  assert.equal((await User.findById(userId)).email, NEW_EMAIL);
});
