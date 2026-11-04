import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import profileRouter from './profile.js';
import Application from '../models/Application.js';
import Resume from '../models/Resume.js';
import User from '../models/User.js';
import { ensureDb, startTestServer } from '../test/helpers.js';

// Throwaway user so deleting the account never touches the shared dev fixture.
const EMAIL = `__test_profile_${Date.now()}@inturn.local`;
let base, close, userId;

const json = { 'Content-Type': 'application/json' };
const del = (confirmEmail) =>
  fetch(`${base}/`, { method: 'DELETE', headers: json, body: JSON.stringify({ confirmEmail }) });

before(async () => {
  await ensureDb();
  ({ base, close } = await startTestServer('/api/profile', profileRouter, { email: EMAIL }));
  // Any request makes the helper upsert the throwaway user
  await fetch(`${base}/activity`);
  userId = (await User.findOne({ email: EMAIL }))._id;
  await Application.create([
    { user: userId, title: 'T1', companyName: 'C', status: 'Saved' },
    { user: userId, title: 'T2', companyName: 'C', status: 'Saved' },
    { user: userId, title: 'T3', companyName: 'C', status: 'Applied' },
  ]);
  await Resume.create({ user: userId, name: '__test_profile__ resume', skills: ['Python'], primary: true });
});

after(async () => {
  if (userId) {
    await Application.deleteMany({ user: userId });
    await Resume.deleteMany({ user: userId });
  }
  await User.deleteOne({ email: EMAIL });
  await close();
  await mongoose.disconnect();
});

test('GET /activity returns counts matching the seeded applications', async () => {
  const res = await fetch(`${base}/activity`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.stats.total, 3);
  assert.equal(body.stats.submitted, 1);
  assert.deepEqual(body.stats.byStatus, { Saved: 2, Applied: 1, Interview: 0, Offered: 0 });
  assert.equal(body.applicationDates.length, 3);
  assert.ok(body.joinedAt);
  assert.equal(body.lastLoginAt, null);
});

test('GET / returns the user without skills plus a profile built from the primary resume', async () => {
  const res = await fetch(`${base}/`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal('skills' in body.user, false);
  assert.deepEqual(body.user.targetIndustries, []);
  assert.deepEqual(body.profile.skills, ['Python']);
  assert.equal(body.profile.email, EMAIL);
});

const put = (body) => fetch(`${base}/`, { method: 'PUT', headers: json, body: JSON.stringify(body) });

test('PUT / updates name and education', async () => {
  const res = await put({ name: '  New Name ', educationLevel: 'Undergraduate', institution: 'SMU', fieldOfStudy: 'IS' });
  assert.equal(res.status, 200);
  const { user } = await res.json();
  assert.equal(user.name, 'New Name');
  assert.equal(user.educationLevel, 'Undergraduate');
  assert.equal(user.institution, 'SMU');
});

test('PUT / without a name leaves the name alone', async () => {
  const res = await put({ educationLevel: 'Postgraduate', institution: 'NUS', fieldOfStudy: 'CS' });
  assert.equal(res.status, 200);
  assert.equal((await res.json()).user.name, 'New Name');
});

test('PUT / cleans target industries and leaves them alone when not sent', async () => {
  const res = await put({ educationLevel: 'Undergraduate', targetIndustries: [' Finance ', 'finance', 'Technology', ''] });
  assert.equal(res.status, 200);
  assert.deepEqual((await res.json()).user.targetIndustries, ['Finance', 'Technology']);

  const again = await put({ educationLevel: 'Undergraduate' });
  assert.deepEqual((await again.json()).user.targetIndustries, ['Finance', 'Technology']);
});

test('PUT / rejects more than 10 target industries', async () => {
  const res = await put({ educationLevel: 'Undergraduate', targetIndustries: Array.from({ length: 11 }, (_, i) => `Ind ${i}`) });
  assert.equal(res.status, 400);
});

test('PUT / rejects a missing education level, an empty name and a too-long name', async () => {
  const noLevel = await put({ institution: 'SMU' });
  assert.equal(noLevel.status, 400);
  assert.deepEqual((await noLevel.json()).errors, ['Education level is required']);

  const empty = await put({ name: '  ', educationLevel: 'PhD' });
  assert.equal(empty.status, 400);
  assert.deepEqual((await empty.json()).errors, ['Name is required']);

  const long = await put({ name: 'x'.repeat(51), educationLevel: 'PhD' });
  assert.equal(long.status, 400);
  assert.deepEqual((await long.json()).errors, ['Name must not exceed 50 characters']);
});

test('DELETE / with the wrong email is rejected and deletes nothing', async () => {
  const res = await del('someone-else@inturn.local');
  assert.equal(res.status, 400);
  assert.deepEqual((await res.json()).errors, ['Type your email exactly to confirm']);
  assert.ok(await User.findById(userId));
  assert.equal(await Application.countDocuments({ user: userId }), 3);
  assert.equal(await Resume.countDocuments({ user: userId }), 1);
});

test('DELETE / with the right email removes the user and their data', async () => {
  const res = await del(`  ${EMAIL.toUpperCase()} `);
  assert.equal(res.status, 200);
  assert.equal(await User.findById(userId), null);
  assert.equal(await Application.countDocuments({ user: userId }), 0);
  assert.equal(await Resume.countDocuments({ user: userId }), 0);
});
