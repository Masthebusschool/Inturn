import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canonicalSkillList } from './jobsSearch.js';

test('canonicalSkillList closes spacing/alias gaps and dedupes', () => {
  const skills = [{ skill: 'JavaScript' }, { skill: 'Java Script' }, { skill: 'Python' }];
  assert.deepEqual(canonicalSkillList(skills).sort(), ['javascript', 'python']);
});

test('canonicalSkillList ignores blank/non-string tags and non-array input', () => {
  assert.deepEqual(canonicalSkillList([{ skill: '' }, { skill: 123 }, {}]), []);
  assert.deepEqual(canonicalSkillList(null), []);
  assert.deepEqual(canonicalSkillList(undefined), []);
});
