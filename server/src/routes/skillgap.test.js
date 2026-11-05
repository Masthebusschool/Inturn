import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import skillgapRouter from './skillgap.js';
import Application from '../models/Application.js';
import SkillGapResult from '../models/SkillGapResult.js';
import User from '../models/User.js';
import { ensureDb, startTestServer } from '../test/helpers.js';

const TITLE_PREFIX = '__test_skillgap_link__';
let base, close;

// startTestServer upserts and logs in as the dev user; these tests only need a stranger-owned app.
before(async () => {
  await ensureDb();
  ({ base, close } = await startTestServer('/api/skillgap', skillgapRouter));
});

after(async () => {
  await Application.deleteMany({ title: new RegExp(`^${TITLE_PREFIX}`) });
  await SkillGapResult.deleteMany({ 'job.title': new RegExp(`^${TITLE_PREFIX}`) });
  await close();
  await mongoose.disconnect();
});

test('POST / 404s for an applicationId the caller does not own, before calling the AI service', async () => {
  const foreignApp = await Application.create({
    user: new mongoose.Types.ObjectId(),
    title: `${TITLE_PREFIX} foreign`,
    companyName: 'Acme',
  });

  const res = await fetch(`${base}/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      job: { title: 'Backend Intern', company: 'Acme', description: 'Build APIs.' },
      applicationId: String(foreignApp._id),
    }),
  });
  assert.equal(res.status, 404);
});

test('POST /:id/duplicate keeps sourceResume but not the tracker link', async () => {
  const user = await User.findOne({ email: 'dev@inturn.local' });
  const src = await SkillGapResult.create({
    user: user._id,
    job: { title: `${TITLE_PREFIX} dup`, company: 'Acme', description: 'x' },
    sourceResume: { resume: new mongoose.Types.ObjectId(), name: 'My CV' },
    application: new mongoose.Types.ObjectId(),
  });
  const res = await fetch(`${base}/${src._id}/duplicate`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}),
  });
  assert.equal(res.status, 201);
  const { result } = await res.json();
  assert.equal(result.sourceResume.name, 'My CV');
  assert.equal(result.sourceResume.resume, String(src.sourceResume.resume));
  assert.equal(result.application, null);
  assert.equal(result.forkedFrom, String(src._id));
});

test('POST / 404s for a garbage applicationId', async () => {
  const res = await fetch(`${base}/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      job: { title: 'Backend Intern', company: 'Acme', description: 'Build APIs.' },
      applicationId: 'not-an-id',
    }),
  });
  assert.equal(res.status, 404);
});
