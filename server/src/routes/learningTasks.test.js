import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import learningTasksRouter from './learningTasks.js';
import LearningTask from '../models/LearningTask.js';
import User from '../models/User.js';
import { syncLearningTasksFromResult } from '../utils/learningTasks.js';
import { ensureDb, startTestServer } from '../test/helpers.js';

// canonical() strips underscores, so test keys use the token "testlt" (-> skillKey "testlt ...").
// The DB and dev user are shared with real data: only create/assert on/delete testlt rows.
let base, close, userId;

before(async () => {
  await ensureDb();
  ({ base, close } = await startTestServer('/api/learning-tasks', learningTasksRouter));
  const user = await User.findOneAndUpdate(
    { email: 'dev@inturn.local' },
    { $setOnInsert: { email: 'dev@inturn.local', name: 'Dev Student' } },
    { upsert: true, returnDocument: 'after' }
  );
  userId = user._id;
});

after(async () => {
  await LearningTask.deleteMany({ skillKey: /^testlt / });
  await close();
  await mongoose.disconnect();
});

const result = (reqs, deadline, title = 'Test Role', company = 'Test Co') => ({
  _id: new mongoose.Types.ObjectId(),
  job: { title, company, applicationDeadline: deadline && new Date(deadline) },
  requirements: reqs.map(([key, category = 'technical', verdict = 'missing']) => ({ key, text: key, category, verdict })),
});
const row = (skillKey) => LearningTask.findOne({ user: userId, skillKey }).lean();
const getList = async () => (await (await fetch(`${base}/`)).json()).tasks.filter((t) => t.skillKey.startsWith('testlt '));
const patch = (id, body) =>
  fetch(`${base}/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

test('sync: only missing/partial skill requirements become pending to-dos', async () => {
  const r = result([
    ['testlt-filter-a', 'technical', 'missing'],
    ['testlt-filter-b', 'soft_skill', 'partial'],
    ['testlt-filter-c', 'technical', 'met'],
    ['testlt-filter-d', 'qualification', 'missing'],
  ]);
  await syncLearningTasksFromResult(userId, r);
  const a = await row('testlt filter a');
  const b = await row('testlt filter b');
  assert.equal(a.status, 'pending');
  assert.equal(b.status, 'pending');
  assert.equal(a.sources.length, 1);
  assert.equal(String(a.sources[0].skillGapResult), String(r._id));
  assert.equal(a.sources[0].job.title, 'Test Role');
  assert.equal(a.sources[0].job.company, 'Test Co');
  assert.equal(a.sources[0].verdict, 'missing');
  assert.equal(b.sources[0].verdict, 'partial');
  assert.equal(await row('testlt filter c'), null);
  assert.equal(await row('testlt filter d'), null);
});

test('sync: same skill across jobs is one row with both sources', async () => {
  await syncLearningTasksFromResult(userId, result([['testlt-SQL']]));
  await syncLearningTasksFromResult(userId, result([['TESTLT_sql']]));
  const rows = await LearningTask.find({ user: userId, skillKey: 'testlt sql' }).lean();
  assert.equal(rows.length, 1);
  assert.equal(rows[0].sources.length, 2);
});

test('sync: row deadline is the earliest source deadline', async () => {
  for (const d of ['2026-12-01', '2026-11-15', '2026-12-20']) {
    await syncLearningTasksFromResult(userId, result([['testlt-min-x']], d));
  }
  assert.equal((await row('testlt min x')).deadline.toISOString().slice(0, 10), '2026-11-15');
});

test('sync: missing deadlines do not clobber real ones', async () => {
  await syncLearningTasksFromResult(userId, result([['testlt-null-x']]));
  const first = await row('testlt null x');
  assert.equal('deadline' in first, false);
  await syncLearningTasksFromResult(userId, result([['testlt-null-x']], '2026-11-30'));
  assert.equal((await row('testlt null x')).deadline.toISOString().slice(0, 10), '2026-11-30');
  await syncLearningTasksFromResult(userId, result([['testlt-null-x']]));
  assert.equal((await row('testlt null x')).deadline.toISOString().slice(0, 10), '2026-11-30');
});

test('sync: a done task stays done when a later analysis reaffirms it', async () => {
  await syncLearningTasksFromResult(userId, result([['testlt-sticky']]));
  const { _id } = await row('testlt sticky');
  const done = await (await patch(_id, { status: 'done' })).json();
  assert.equal(done.task.status, 'done');
  await syncLearningTasksFromResult(userId, result([['testlt-sticky']]));
  const after = await row('testlt sticky');
  assert.equal(after.status, 'done');
  assert.ok(after.doneAt);
  assert.equal(after.sources.length, 2);
});

test('GET / lists pending by deadline (none last), then done; omits user', async () => {
  await syncLearningTasksFromResult(userId, result([['testlt-order-late']], '2026-12-01'));
  await syncLearningTasksFromResult(userId, result([['testlt-order-early']], '2026-11-01'));
  await syncLearningTasksFromResult(userId, result([['testlt-order-open']]));
  await syncLearningTasksFromResult(userId, result([['testlt-order-done']], '2026-10-25'));
  await patch((await row('testlt order done'))._id, { status: 'done' });

  const mine = (await getList()).filter((t) => t.skillKey.startsWith('testlt order '));
  assert.deepEqual(mine.map((t) => t.skillKey), ['testlt order early', 'testlt order late', 'testlt order open', 'testlt order done']);
  assert.equal('user' in mine[0], false);
});

test('PATCH /:id toggles status and doneAt, rejects bad input and foreign rows', async () => {
  await syncLearningTasksFromResult(userId, result([['testlt-patch']]));
  const { _id } = await row('testlt patch');

  const done = await (await patch(_id, { status: 'done' })).json();
  assert.equal(done.task.status, 'done');
  assert.ok(done.task.doneAt);
  const pending = await (await patch(_id, { status: 'pending' })).json();
  assert.equal(pending.task.status, 'pending');
  assert.equal('doneAt' in (await row('testlt patch')), false);

  assert.equal((await patch(_id, { status: 'nope' })).status, 400);
  assert.equal((await patch('not-an-id', { status: 'done' })).status, 404);

  const other = new mongoose.Types.ObjectId();
  await syncLearningTasksFromResult(other, result([['testlt-patch-foreign']]));
  const foreign = await LearningTask.findOne({ user: other, skillKey: 'testlt patch foreign' }).lean();
  assert.equal((await patch(foreign._id, { status: 'done' })).status, 404);
  assert.equal((await LearningTask.findById(foreign._id).lean()).status, 'pending');
});

test('GET / never includes another user\'s rows', async () => {
  const other = new mongoose.Types.ObjectId();
  await syncLearningTasksFromResult(other, result([['testlt-own-foreign']]));
  assert.equal((await getList()).some((t) => t.skillKey === 'testlt own foreign'), false);
});

test('DELETE /:id removes own rows and 404s foreign ones', async () => {
  await syncLearningTasksFromResult(userId, result([['testlt-delete']]));
  const { _id } = await row('testlt delete');
  const res = await fetch(`${base}/${_id}`, { method: 'DELETE' });
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true });
  assert.equal((await getList()).some((t) => t.skillKey === 'testlt delete'), false);

  const other = new mongoose.Types.ObjectId();
  await syncLearningTasksFromResult(other, result([['testlt-delete-foreign']]));
  const foreign = await LearningTask.findOne({ user: other, skillKey: 'testlt delete foreign' }).lean();
  assert.equal((await fetch(`${base}/${foreign._id}`, { method: 'DELETE' })).status, 404);
  assert.ok(await LearningTask.findById(foreign._id).lean());
});
