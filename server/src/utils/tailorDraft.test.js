import { test } from 'node:test';
import assert from 'node:assert/strict';
import { unsupportedSkills } from './tailorDraft.js';

test('unsupportedSkills returns skills whose words never appear in the support text', () => {
  const support = '{"skills":["Python","SQL"],"experience":[{"bullets":["Built REST APIs with Node.js"]}]}';
  assert.deepEqual(unsupportedSkills(['Python', 'sql', 'REST APIs', 'Kubernetes', 'Docker'], support), ['Kubernetes', 'Docker']);
});

test('unsupportedSkills tolerates empty input', () => {
  assert.deepEqual(unsupportedSkills(undefined, 'x'), []);
  assert.deepEqual(unsupportedSkills(['Go'], undefined), ['Go']);
});
