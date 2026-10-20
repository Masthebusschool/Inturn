import { test } from 'node:test';
import assert from 'node:assert/strict';
import { todoCandidates, compareTasks } from './learningTasks.js';

const req = (key, category, verdict, text = key) => ({ key, text, category, verdict });

test('todoCandidates keeps missing/partial skill categories and drops the rest', () => {
  const out = todoCandidates([
    req('python', 'technical', 'missing'),
    req('finance', 'domain', 'partial'),
    req('teamwork', 'soft_skill', 'missing'),
    req('sql', 'technical', 'met'),
    req('degree', 'qualification', 'missing'),
    req('own-features', 'responsibility', 'missing'),
    req('misc', 'other', 'partial'),
  ]);
  assert.deepEqual(out.map((c) => [c.skillKey, c.verdict]), [
    ['python', 'missing'], ['finance', 'partial'], ['teamwork', 'missing'],
  ]);
});

test('todoCandidates keys on canonical(key || text)', () => {
  const [a, b] = todoCandidates([
    req('rest-apis', 'technical', 'missing'),
    req('', 'technical', 'missing', 'Docker'),
  ]);
  assert.equal(a.skillKey, 'rest');
  assert.equal(a.skillText, 'rest-apis');
  assert.equal(b.skillKey, 'docker');
  assert.deepEqual(todoCandidates([req('', 'technical', 'missing', '')]), []);
  assert.equal(todoCandidates([{ key: '', text: 'REST APIs', category: 'technical', verdict: 'missing' }])[0].skillKey, 'rest');
});

test('todoCandidates dedupes (first wins) and tolerates non-arrays', () => {
  const out = todoCandidates([
    req('rest-apis', 'technical', 'missing', 'REST APIs'),
    req('REST_API', 'technical', 'partial', 'RESTful API design'),
  ]);
  assert.equal(out.length, 1);
  assert.equal(out[0].skillText, 'REST APIs');
  assert.deepEqual(todoCandidates(undefined), []);
});

test('compareTasks orders pending first, earliest deadline first, no-deadline last, then createdAt', () => {
  const t = (status, deadline, createdAt) => ({ status, deadline: deadline && new Date(deadline), createdAt: new Date(createdAt) });
  const doneEarly = t('done', '2026-01-01', '2026-01-01');
  const late = t('pending', '2026-12-01', '2026-01-02');
  const early = t('pending', '2026-11-15', '2026-01-03');
  const openOld = t('pending', undefined, '2026-01-04');
  const openNew = t('pending', undefined, '2026-01-05');
  const sorted = [openNew, doneEarly, late, openOld, early].sort(compareTasks);
  assert.deepEqual(sorted, [early, late, openOld, openNew, doneEarly]);
});
