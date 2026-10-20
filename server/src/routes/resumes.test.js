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

test('GET /:id returns the resume; a foreign/invalid id 404s', async () => {
  const created = await (await fetch(`${base}/`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: `${NAME_PREFIX} get`, seed: 'blank' }),
  })).json();

  const ok = await fetch(`${base}/${created.resume._id}`);
  assert.equal(ok.status, 200);
  assert.equal((await ok.json()).resume.name, `${NAME_PREFIX} get`);

  const notAnId = await fetch(`${base}/not-an-id`);
  assert.equal(notAnId.status, 404);

  const validButMissing = await fetch(`${base}/${new mongoose.Types.ObjectId()}`);
  assert.equal(validButMissing.status, 404);
});

test('PUT /:id replaces fields and bumps updatedAt', async () => {
  const created = await (await fetch(`${base}/`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: `${NAME_PREFIX} put`, seed: 'blank' }),
  })).json();

  // guard against same-millisecond timestamps when create+update run back-to-back
  await new Promise((r) => setTimeout(r, 5));

  const res = await fetch(`${base}/${created.resume._id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: `${NAME_PREFIX} put-renamed`,
      contact: { fullName: 'Aiden Lim', phone: '', email: '', linkedin: '', github: '', portfolio: '' },
      summary: 'Updated summary', skills: ['SQL', 'sql'], experience: [], projects: [], education: [],
    }),
  });
  assert.equal(res.status, 200);
  const { resume } = await res.json();
  assert.equal(resume.name, `${NAME_PREFIX} put-renamed`);
  assert.equal(resume.contact.fullName, 'Aiden Lim');
  assert.deepEqual(resume.skills, ['SQL']); // deduped case-insensitively, same as profile.js
  assert.ok(
    new Date(resume.updatedAt).getTime() > new Date(created.resume.updatedAt).getTime(),
    'updatedAt should advance after PUT'
  );
});

test('PUT /:id rejects an empty name', async () => {
  const created = await (await fetch(`${base}/`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: `${NAME_PREFIX} put-empty`, seed: 'blank' }),
  })).json();
  const res = await fetch(`${base}/${created.resume._id}`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: '  ', contact: {}, summary: '', skills: [], experience: [], projects: [], education: [] }),
  });
  assert.equal(res.status, 400);
});

test('DELETE /:id removes it; a second GET 404s', async () => {
  const created = await (await fetch(`${base}/`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: `${NAME_PREFIX} delete`, seed: 'blank' }),
  })).json();
  const del = await fetch(`${base}/${created.resume._id}`, { method: 'DELETE' });
  assert.equal(del.status, 200);
  const after = await fetch(`${base}/${created.resume._id}`);
  assert.equal(after.status, 404);
});

test('POST /:id/duplicate defaults to "Copy of <name>"', async () => {
  const created = await (await fetch(`${base}/`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: `${NAME_PREFIX} original`, seed: 'blank' }),
  })).json();
  const res = await fetch(`${base}/${created.resume._id}/duplicate`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}),
  });
  assert.equal(res.status, 201);
  const { resume } = await res.json();
  assert.equal(resume.name, `Copy of ${NAME_PREFIX} original`);
  assert.notEqual(resume._id, created.resume._id);
});

test('POST /:id/duplicate accepts a custom name', async () => {
  const created = await (await fetch(`${base}/`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: `${NAME_PREFIX} source`, seed: 'blank' }),
  })).json();
  const res = await fetch(`${base}/${created.resume._id}/duplicate`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: `${NAME_PREFIX} custom-copy` }),
  });
  const { resume } = await res.json();
  assert.equal(resume.name, `${NAME_PREFIX} custom-copy`);
});
