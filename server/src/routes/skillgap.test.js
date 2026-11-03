import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import skillgapRouter from './skillgap.js';
import Application from '../models/Application.js';
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
