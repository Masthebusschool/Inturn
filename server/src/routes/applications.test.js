import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import applicationsRouter from './applications.js';
import Application from '../models/Application.js';
import SkillGapResult from '../models/SkillGapResult.js';
import User from '../models/User.js';
import { ensureDb, startTestServer } from '../test/helpers.js';

const TITLE_PREFIX = '__test_applications__';
let base, close, userId;

before(async () => {
  await ensureDb();
  ({ base, close } = await startTestServer('/api/applications', applicationsRouter));
  const user = await User.findOneAndUpdate(
    { email: 'dev@inturn.local' },
    { $setOnInsert: { email: 'dev@inturn.local', name: 'Dev Student' } },
    { upsert: true, returnDocument: 'after' }
  );
  userId = user.id;
});

after(async () => {
  await Application.deleteMany({ title: new RegExp(`^${TITLE_PREFIX}`) });
  await SkillGapResult.deleteMany({ 'job.title': new RegExp(`^${TITLE_PREFIX}`) });
  await close();
  await mongoose.disconnect();
});

test('GET /:id returns the application with its description; a foreign/invalid id 404s', async () => {
  const created = await Application.create({
    user: userId,
    title: `${TITLE_PREFIX} get`,
    companyName: 'Acme',
    description: 'Full job description text.',
  });

  const ok = await fetch(`${base}/${created._id}`);
  assert.equal(ok.status, 200);
  const app = await ok.json();
  assert.equal(app.title, `${TITLE_PREFIX} get`);
  assert.equal(app.description, 'Full job description text.');

  const notAnId = await fetch(`${base}/not-an-id`);
  assert.equal(notAnId.status, 404);

  const validButMissing = await fetch(`${base}/${new mongoose.Types.ObjectId()}`);
  assert.equal(validButMissing.status, 404);

  const otherUser = await Application.create({
    user: new mongoose.Types.ObjectId(),
    title: `${TITLE_PREFIX} foreign`,
    companyName: 'Acme',
  });
  const foreign = await fetch(`${base}/${otherUser._id}`);
  assert.equal(foreign.status, 404);
});

test('GET / surfaces skillGapScore/skillGapBand once a SkillGapResult is linked', async () => {
  const created = await Application.create({
    user: userId,
    title: `${TITLE_PREFIX} badge`,
    companyName: 'Acme',
  });

  const before = await (await fetch(`${base}/`)).json();
  const beforeCard = before.find((c) => c._id === String(created._id));
  assert.equal(beforeCard.skillGapScore, null);

  const result = await SkillGapResult.create({
    user: userId,
    job: { title: `${TITLE_PREFIX} badge`, company: 'Acme', description: 'x' },
    atsScore: 81,
    band: 'strong',
  });
  created.skillGapResultId = result._id;
  await created.save();

  const after = await (await fetch(`${base}/`)).json();
  const afterCard = after.find((c) => c._id === String(created._id));
  assert.equal(afterCard.skillGapScore, 81);
  assert.equal(afterCard.skillGapBand, 'strong');
});
