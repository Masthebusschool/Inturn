import { test } from 'node:test';
import assert from 'node:assert/strict';
import { unsupportedSkills, cleanSuggestions, newEntryIds } from './tailorDraft.js';

test('unsupportedSkills returns skills whose words never appear in the support text', () => {
  const support = '{"skills":["Python","SQL"],"experience":[{"bullets":["Built REST APIs with Node.js"]}]}';
  assert.deepEqual(unsupportedSkills(['Python', 'sql', 'REST APIs', 'Kubernetes', 'Docker'], support), ['Kubernetes', 'Docker']);
});

test('unsupportedSkills tolerates empty input', () => {
  assert.deepEqual(unsupportedSkills(undefined, 'x'), []);
  assert.deepEqual(unsupportedSkills(['Go'], undefined), ['Go']);
});

// ---- new-entry suggestions ----
const draftFx = (nProjects = 1) => ({
  summary: '', skills: [],
  experience: [{ title: 'Intern', company: 'Shopee', bullets: ['Built dashboards'] }],
  projects: Array.from({ length: nProjects }, (_, i) => ({ name: i === 0 ? 'Budget App' : `Side Project ${i}`, bullets: ['Tracked spending'] })),
});
const validKeys = new Set(['k1']);
const supportFor = (d) => `${JSON.stringify(d)}\nI also built a Telegram bot for my CCA that tracks attendance using Python. I interned at Grab as a Data Analyst.`;
const run = (raw, d = draftFx()) => cleanSuggestions(raw, d, { validKeys, supportText: supportFor(d) });
const entry = (o) => ({ field: 'entry', text: '', original: '', requirementKeys: [], bullets: ['Did a thing'], ...o });

test('entry: new project is accepted, company ignored, keys filtered', () => {
  const r = run([entry({ sectionId: 'project:new', title: 'CCA Attendance Telegram Bot', company: 'ignored corp', bullets: ['Built a Telegram bot in Python to track CCA attendance'], requirementKeys: ['k1', 'bogus'] })]);
  assert.equal(r.suggestions.length, 1);
  const s = r.suggestions[0];
  assert.equal(s.field, 'entry');
  assert.equal(s.company, '');
  assert.equal(s.text, '');
  assert.equal(s.original, '');
  assert.deepEqual(s.requirementKeys, ['k1']);
  assert.deepEqual(s.bullets, ['Built a Telegram bot in Python to track CCA attendance']);
});

test('entry: new experience is accepted with its company', () => {
  const r = run([entry({ sectionId: 'experience:new', title: 'Data Analyst', company: 'Grab' })]);
  assert.equal(r.suggestions.length, 1);
  assert.equal(r.suggestions[0].company, 'Grab');
});

test('entry: placeholders are rejected', () => {
  assert.equal(run([entry({ sectionId: 'project:new', title: 'Budget Bot', bullets: ['Improved retention by X%'] })]).rejected.placeholder, 1);
  const r = run([entry({ sectionId: 'project:new', title: '[Project Name]' })]);
  assert.equal(r.rejected.placeholder, 1);
  assert.equal(r.suggestions.length, 0);
});

test('entry: unmatched section, full draft and duplicates count as unmatched', () => {
  assert.equal(run([entry({ sectionId: 'project:2', title: 'Telegram Bot' })]).rejected.unmatched, 1);
  assert.equal(run([entry({ sectionId: 'project:new', title: 'Telegram Bot' })], draftFx(15)).rejected.unmatched, 1);
  const dup = run([entry({ sectionId: 'project:new', title: 'Budget App' })]);
  assert.equal(dup.rejected.unmatched, 1);
  assert.equal(dup.suggestions.length, 0);
});

test('entry: cap counts entries accepted earlier in the same call', () => {
  const r = run([
    entry({ sectionId: 'project:new', title: 'Telegram Bot' }),
    entry({ sectionId: 'project:new', title: 'Attendance Tracker' }),
  ], draftFx(14));
  assert.equal(r.suggestions.length, 1);
  assert.equal(r.rejected.unmatched, 1);
});

test('entry: made-up employer is rejected as unsupported', () => {
  const r = run([entry({ sectionId: 'experience:new', title: 'Data Analyst', company: 'Acme Fintech Pte Ltd' })]);
  assert.equal(r.rejected.unsupported, 1);
  assert.ok(r.unsupportedTerms.includes('Acme Fintech Pte Ltd'));
  assert.equal(r.suggestions.length, 0);
});

test('entry: made-up project name is rejected as unsupported', () => {
  const r = run([entry({ sectionId: 'project:new', title: 'SmartAttend Platform' })]);
  assert.equal(r.rejected.unsupported, 1);
  assert.deepEqual(r.unsupportedTerms, ['SmartAttend Platform']);
  assert.equal(r.suggestions.length, 0);
});

test('entry: invented tech in a bullet is rejected', () => {
  const r = run([entry({ sectionId: 'project:new', title: 'Telegram Bot', bullets: ['Stored data in PostgreSQL'] })]);
  assert.equal(r.rejected.unsupported, 1);
  assert.ok(r.unsupportedTerms.includes('PostgreSQL'));
  assert.equal(r.suggestions.length, 0);
});

test('entry: empty bullets are skipped silently', () => {
  const r = run([entry({ sectionId: 'project:new', title: 'Telegram Bot', bullets: [] })]);
  assert.equal(r.suggestions.length, 0);
  assert.deepEqual(r.rejected, { placeholder: 0, unmatched: 0, unsupported: 0 });
});

test('newEntryIds drops kinds at the cap', () => {
  assert.deepEqual(newEntryIds(draftFx()), ['experience:new', 'project:new']);
  const full = { experience: Array.from({ length: 15 }, () => ({})), projects: [] };
  assert.deepEqual(newEntryIds(full), ['project:new']);
  assert.deepEqual(newEntryIds(undefined), ['experience:new', 'project:new']);
  assert.deepEqual(newEntryIds({}), ['experience:new', 'project:new']);
});

test('bullet suggestions keep their shape (no entry fields)', () => {
  const r = run([{ sectionId: 'experience:0', field: 'bullet', original: 'Built dashboards', text: 'Built Python dashboards for the ops team', requirementKeys: ['k1'] }]);
  assert.equal(r.suggestions.length, 1);
  assert.equal(r.suggestions[0].field, 'bullet');
  assert.equal(r.suggestions[0].original, 'Built dashboards');
  assert.equal('bullets' in r.suggestions[0], false);
});
