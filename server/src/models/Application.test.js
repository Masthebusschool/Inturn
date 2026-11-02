import { test } from 'node:test';
import assert from 'node:assert/strict';
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
