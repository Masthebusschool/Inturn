import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import resumesRouter from './resumes.js';
import Resume from '../models/Resume.js';
import User from '../models/User.js';
import { ensureDb, startTestServer } from '../test/helpers.js';

// Throwaway user so the primary-resume rules never touch the shared dev fixture.
const EMAIL = `__test_resumes_${Date.now()}@inturn.local`;
const NAME_PREFIX = '__test_resumes__';
let base, close;

const json = { 'Content-Type': 'application/json' };
const patchPrimary = (body) => fetch(`${base}/primary`, { method: 'PATCH', headers: json, body: JSON.stringify(body) });
const post = (body) => fetch(`${base}/`, { method: 'POST', headers: json, body: JSON.stringify(body) });

before(async () => {
  await ensureDb();
  ({ base, close } = await startTestServer('/api/resumes', resumesRouter, { email: EMAIL }));
});

after(async () => {
  const user = await User.findOne({ email: EMAIL });
  if (user) await Resume.deleteMany({ user: user._id });
  await User.deleteOne({ email: EMAIL });
  await close();
  await mongoose.disconnect();
});

test('PATCH /primary creates "My Profile" when the user has no resumes, and GET /primary returns it', async () => {
  const res = await patchPrimary({ skills: ['SQL', 'sql', ' '] });
  assert.equal(res.status, 200);
  const { resume } = await res.json();
  assert.equal(resume.name, 'My Profile');
  assert.equal(resume.primary, true);
  assert.deepEqual(resume.skills, ['SQL']);

  const got = await (await fetch(`${base}/primary`)).json();
  assert.equal(got.resume._id, resume._id);
  assert.deepEqual(got.resume.skills, ['SQL']);
});

test('only the first POSTed resume is primary; the flag is listed and not copied by duplicate', async () => {
  const user = await User.findOne({ email: EMAIL });
  await Resume.deleteMany({ user: user._id });
  const a = (await (await post({ name: `${NAME_PREFIX} first`, seed: 'blank' })).json()).resume;
  const b = (await (await post({ name: `${NAME_PREFIX} second`, seed: 'blank' })).json()).resume;
  assert.equal(a.primary, true);
  assert.equal(b.primary, false);

  const { resumes } = await (await fetch(`${base}/`)).json();
  assert.equal(resumes.find((r) => r._id === a._id).primary, true);
  assert.equal(resumes.find((r) => r._id === b._id).primary, false);

  const dup = await fetch(`${base}/${a._id}/duplicate`, { method: 'POST', headers: json, body: JSON.stringify({}) });
  assert.equal((await dup.json()).resume.primary, false);
  assert.equal(await Resume.countDocuments({ user: user._id, primary: true }), 1);
});

test('PATCH /primary with only projects leaves skills untouched', async () => {
  await patchPrimary({ skills: ['Python'] });
  const res = await patchPrimary({ projects: [{ name: 'Tracker', bullets: ['Built it'], skills: ['React'] }] });
  const { resume } = await res.json();
  assert.deepEqual(resume.skills, ['Python']);
  assert.equal(resume.projects.length, 1);
  assert.equal(resume.projects[0].name, 'Tracker');
});

test('POST / with seed "profile" copies the primary resume, including location', async () => {
  await patchPrimary({
    skills: ['Go'],
    experience: [{ title: 'Intern', company: 'Acme', location: 'Singapore', startDate: '2024-05', bullets: ['Shipped'], skills: ['Go'] }],
    projects: [{ name: 'Proj', bullets: [], skills: ['Docker'] }],
  });
  const res = await post({ name: `${NAME_PREFIX} from-profile`, seed: 'profile' });
  const { resume } = await res.json();
  assert.equal(resume.primary, false);
  assert.deepEqual(resume.skills, ['Go']);
  assert.equal(resume.experience[0].location, 'Singapore');
  assert.equal(resume.experience[0].startDate, '2024-05');
  assert.deepEqual(resume.projects[0].skills, ['Docker']);
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

const putContact = (id, contact) => fetch(`${base}/${id}`, {
  method: 'PUT', headers: json,
  body: JSON.stringify({ name: `${NAME_PREFIX} contact`, contact, summary: '', skills: [], experience: [], projects: [], education: [] }),
});

test('PUT /:id stores a legacy-only contact body as links and removes the legacy fields', async () => {
  const user = await User.findOne({ email: EMAIL });
  const old = await Resume.create({
    user: user._id, name: `${NAME_PREFIX} contact`,
    contact: { fullName: 'Old', linkedin: 'linkedin.com/in/old', github: 'github.com/old' },
  });
  const res = await putContact(old._id, { fullName: 'A', linkedin: 'linkedin.com/in/a' });
  assert.equal(res.status, 200);
  assert.deepEqual((await res.json()).resume.contact.links, [{ label: 'LinkedIn', value: 'linkedin.com/in/a' }]);

  const raw = await Resume.collection.findOne({ _id: old._id });
  assert.equal('linkedin' in raw.contact, false);
  assert.equal('github' in raw.contact, false);
});

test('PUT /:id keeps valid links, drops blank ones, and clears legacy fields set earlier', async () => {
  const user = await User.findOne({ email: EMAIL });
  const old = await Resume.create({ user: user._id, name: `${NAME_PREFIX} contact`, contact: { linkedin: 'legacy' } });
  const res = await putContact(old._id, {
    fullName: 'A',
    links: [{ label: ' Blog ', value: ' b.com ' }, { label: '', value: 'x' }, { label: 'Empty', value: '' }],
  });
  assert.deepEqual((await res.json()).resume.contact.links, [{ label: 'Blog', value: 'b.com' }]);
  const raw = await Resume.collection.findOne({ _id: old._id });
  assert.equal('linkedin' in raw.contact, false);
  assert.deepEqual(raw.contact.links, [{ label: 'Blog', value: 'b.com' }]);
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
  await patchPrimary({ skills: [`${NAME_PREFIX}-skill`] });
  const created = await (await post({ name: `${NAME_PREFIX} original`, seed: 'profile' })).json();
  const res = await fetch(`${base}/${created.resume._id}/duplicate`, {
    method: 'POST', headers: json, body: JSON.stringify({}),
  });
  assert.equal(res.status, 201);
  const { resume } = await res.json();
  assert.equal(resume.name, `Copy of ${NAME_PREFIX} original`);
  assert.notEqual(resume._id, created.resume._id);
  assert.deepEqual(resume.skills, [`${NAME_PREFIX}-skill`]); // duplicate actually copies fields, not just the name
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

test('POST /:id/parse 404s for a foreign/invalid resume id before touching the upload', async () => {
  const res = await fetch(`${base}/${new mongoose.Types.ObjectId()}/parse`, { method: 'POST' });
  assert.equal(res.status, 404);
});

test('POST /:id/parse rejects a missing file', async () => {
  const created = await (await fetch(`${base}/`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: `${NAME_PREFIX} parse-nofile`, seed: 'blank' }),
  })).json();
  const res = await fetch(`${base}/${created.resume._id}/parse`, { method: 'POST' });
  assert.equal(res.status, 400);
});

test('POST /:id/parse rejects a non-PDF upload', async () => {
  const created = await (await fetch(`${base}/`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: `${NAME_PREFIX} parse-badtype`, seed: 'blank' }),
  })).json();
  const form = new FormData();
  form.append('resume', new Blob(['not a pdf'], { type: 'text/plain' }), 'resume.txt');
  const res = await fetch(`${base}/${created.resume._id}/parse`, { method: 'POST', body: form });
  assert.equal(res.status, 400);
});

test('deleting the primary resume promotes the most recently updated one on the next GET /primary', async () => {
  const user = await User.findOne({ email: EMAIL });
  const { resume: primary } = await (await fetch(`${base}/primary`)).json();
  const older = (await (await post({ name: `${NAME_PREFIX} promo-older`, seed: 'blank' })).json()).resume;
  const newer = (await (await post({ name: `${NAME_PREFIX} promo-newer`, seed: 'blank' })).json()).resume;
  await new Promise((r) => setTimeout(r, 5));
  // touch `newer` so it is unambiguously the latest
  await fetch(`${base}/${newer._id}`, {
    method: 'PUT', headers: json,
    body: JSON.stringify({ name: newer.name, contact: {}, summary: 'x', skills: [], experience: [], projects: [], education: [] }),
  });
  await fetch(`${base}/${primary._id}`, { method: 'DELETE' });
  assert.equal(await Resume.countDocuments({ user: user._id, primary: true }), 0);

  const { resume } = await (await fetch(`${base}/primary`)).json();
  const expected = (await Resume.findOne({ user: user._id }).sort({ updatedAt: -1 }).select('_id'))._id.toString();
  assert.equal(resume._id, expected);
  assert.notEqual(resume._id, older._id);
  assert.equal(await Resume.countDocuments({ user: user._id, primary: true }), 1);
});
