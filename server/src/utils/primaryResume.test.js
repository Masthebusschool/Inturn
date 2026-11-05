import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import User from '../models/User.js';
import Resume from '../models/Resume.js';
import { addSkillsToPrimary } from './primaryResume.js';
import { ensureDb } from '../test/helpers.js';

const EMAIL = `__test_primary_${Date.now()}@inturn.local`;
let userId;

before(async () => {
  await ensureDb();
  userId = (await User.create({ name: 'Primary Test', email: EMAIL, passwordHash: 'x' }))._id;
});

after(async () => {
  await Resume.deleteMany({ user: userId });
  await User.deleteOne({ _id: userId });
  await mongoose.disconnect();
});

test('addSkillsToPrimary creates a primary resume when the user has none', async () => {
  const added = await addSkillsToPrimary(userId, ['Go']);
  assert.deepEqual(added, ['Go']);
  const primary = await Resume.findOne({ user: userId, primary: true });
  assert.deepEqual([...primary.skills], ['Go']);
});

test('addSkillsToPrimary appends only new skills (canonical match) and keeps existing order', async () => {
  await Resume.updateOne({ user: userId, primary: true }, { $set: { skills: ['Python', 'SQL'] } });
  const added = await addSkillsToPrimary(userId, ['sql', 'Node.js', 'nodejs', 'Docker']);
  assert.deepEqual(added, ['Node.js', 'Docker']);
  const primary = await Resume.findOne({ user: userId, primary: true });
  assert.deepEqual([...primary.skills], ['Python', 'SQL', 'Node.js', 'Docker']);

  assert.deepEqual(await addSkillsToPrimary(userId, ['python', '']), []);
});
