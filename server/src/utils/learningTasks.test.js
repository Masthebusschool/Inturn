import { test } from 'node:test';
import assert from 'node:assert/strict';
import { todoCandidates, compareTasks, similarSkillKeys, resolveSkillKey } from './learningTasks.js';

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

test('similarSkillKeys catches a shorter key fully contained in a longer one', () => {
  // Real pair pulled from this app's own to-do data — same skill, different AI-generated slugs.
  assert.equal(similarSkillKeys('docker', 'docker containers'), true);
  assert.equal(similarSkillKeys('python', 'python'), true);
  assert.equal(similarSkillKeys('docker containers', 'docker'), true); // order-independent
});

test('similarSkillKeys leaves genuinely distinct skills alone, even sharing a word', () => {
  // Same shape as "cloud aws" vs "cloud platforms" (share one of two words) but are clearly
  // different skills — proves the subset rule doesn't just degrade into loose overlap matching.
  assert.equal(similarSkillKeys('python developer', 'java developer'), false);
  assert.equal(similarSkillKeys('cloud aws', 'cloud platforms'), false);
  assert.equal(similarSkillKeys('scalable architecture', 'scalable distributed systems'), false);
  assert.equal(similarSkillKeys('exposure ai ml', 'ai assisted tools'), false);
  assert.equal(similarSkillKeys('microservices', 'scalable distributed systems'), false);
  assert.equal(similarSkillKeys('', 'docker'), false);
});

test('resolveSkillKey reuses a similar existing key, else returns the candidate unchanged', () => {
  assert.equal(resolveSkillKey('docker containers', ['sql', 'docker', 'python']), 'docker');
  assert.equal(resolveSkillKey('rust', ['sql', 'docker', 'python']), 'rust');
  assert.equal(resolveSkillKey('cloud platforms', []), 'cloud platforms');
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
