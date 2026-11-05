import { test } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { toCard } from './Application.js';

function baseApp(overrides = {}) {
  return {
    _id: 'app1',
    title: 'Backend Intern',
    companyName: 'Acme',
    status: 'Saved',
    expiryDate: null,
    appliedDate: null,
    interviewAt: null,
    isFavourite: false,
    tasks: [],
    skills: [],
    skillGapResultId: null,
    ...overrides,
  };
}

test('toCard returns null skillGapScore/skillGapBand when no analysis is linked', () => {
  const card = toCard(baseApp(), []);
  assert.equal(card.skillGapScore, null);
  assert.equal(card.skillGapBand, null);
});

test('toCard surfaces the populated skillGapResultId score and band', () => {
  const card = toCard(baseApp({ skillGapResultId: { atsScore: 72, band: 'moderate' } }), []);
  assert.equal(card.skillGapScore, 72);
  assert.equal(card.skillGapBand, 'moderate');
});

test('toCard uses the linked analysis missing skills (draft first), else the keyword heuristic', () => {
  const skills = ['Python', 'SQL'];
  const heuristic = toCard(baseApp({ skills }), ['python']);
  assert.deepEqual(heuristic.missing, ['SQL']);

  const orig = toCard(baseApp({ skills, skillGapResultId: { atsScore: 50, band: 'low', missingSkills: ['Docker'] } }), ['python']);
  assert.deepEqual(orig.missing, ['Docker']);
  assert.equal(orig.matched, 1); // heuristic counts stay as the client fallback
  assert.equal(orig.total, 2);

  const draft = toCard(baseApp({
    skills, skillGapResultId: { missingSkills: ['Docker'], draftScore: { missingSkills: [] } },
  }), []);
  assert.deepEqual(draft.missing, []);

  const unpopulated = toCard(baseApp({ skills, skillGapResultId: new mongoose.Types.ObjectId() }), ['python']);
  assert.deepEqual(unpopulated.missing, ['SQL']);
});

test('toCard prefers the tailored draft score, matching the Skill Gap history badge', () => {
  const card = toCard(baseApp({
    skillGapResultId: { atsScore: 16, band: 'low', draftScore: { atsScore: 70, band: 'moderate' } },
  }), []);
  assert.equal(card.skillGapScore, 70);
  assert.equal(card.skillGapBand, 'moderate');
});
