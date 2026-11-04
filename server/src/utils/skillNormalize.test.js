import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canonical, normalize } from './skillNormalize.js';

test('normalize lowercases, strips punctuation and collapses spaces', () => {
  assert.equal(normalize('  JavaScript!! '), 'javascript');
  assert.equal(normalize('C++'), 'cplusplus');
  assert.equal(normalize('Node.js'), 'nodejs');
});

test('canonical closes common spacing gaps between the same skill', () => {
  const pairs = [
    ['JavaScript', 'Java Script'],
    ['TypeScript', 'Type Script'],
    ['MySQL', 'My SQL'],
    ['NoSQL', 'No SQL'],
    ['GitHub', 'Git Hub'],
    ['DevOps', 'Dev Ops'],
    ['Frontend', 'Front End'],
    ['Backend', 'Back End'],
    ['Firebase', 'Fire Base'],
    ['WordPress', 'Word Press'],
    ['Blockchain', 'Block Chain'],
  ];
  for (const [a, b] of pairs) {
    assert.equal(canonical(a), canonical(b), `${a} vs ${b}`);
  }
});

test('canonical still separates genuinely different skills', () => {
  assert.notEqual(canonical('python'), canonical('java'));
  assert.notEqual(canonical('react'), canonical('vue'));
});
