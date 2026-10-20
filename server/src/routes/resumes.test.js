import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import resumesRouter from './resumes.js';
import Resume from '../models/Resume.js';
import User from '../models/User.js';
import { ensureDb, startTestServer } from '../test/helpers.js';

const NAME_PREFIX = '__test_resumes__';
let base, close;

before(async () => {
  await ensureDb();
  ({ base, close } = await startTestServer('/api/resumes', resumesRouter));
});

after(async () => {
  await Resume.deleteMany({ name: new RegExp(`^${NAME_PREFIX}`) });
  await close();
  await mongoose.disconnect();
});

test('POST / creates a blank resume and GET / lists it newest-first', async () => {
  const res = await fetch(`${base}/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: `${NAME_PREFIX} blank`, seed: 'blank' }),
  });
  assert.equal(res.status, 201);
  const { resume } = await res.json();
  assert.equal(resume.name, `${NAME_PREFIX} blank`);
  assert.deepEqual(resume.skills, []);

  const listRes = await fetch(`${base}/`);
  const { resumes } = await listRes.json();
  assert.ok(resumes.some((r) => r.name === `${NAME_PREFIX} blank`));
});

test('POST / with seed "profile" copies the dev user\'s skills', async () => {
  const user = await User.findOneAndUpdate(
    { email: 'dev@inturn.local' },
    { $addToSet: { skills: `${NAME_PREFIX}-skill` } },
    { upsert: true, returnDocument: 'after' }
  );
  const res = await fetch(`${base}/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: `${NAME_PREFIX} from-profile`, seed: 'profile' }),
  });
  const { resume } = await res.json();
  assert.ok(resume.skills.includes(`${NAME_PREFIX}-skill`));
  // cleanup the skill we injected on the shared dev user
  user.skills = user.skills.filter((sk) => sk !== `${NAME_PREFIX}-skill`);
  await user.save();
});

test('POST / rejects a missing name', async () => {
  const res = await fetch(`${base}/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ seed: 'blank' }),
  });
  assert.equal(res.status, 400);
});
