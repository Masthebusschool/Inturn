import { test } from 'node:test';
import assert from 'node:assert/strict';
import { profileFromResume } from './resumeProfile.js';

test('profileFromResume maps a resume into the scoring-profile shape, excluding contact fields', () => {
  const resume = {
    contact: { fullName: 'Aiden Lim', email: 'aiden@example.com' },
    summary: 'Second-year IS student.',
    skills: ['Node.js', 'SQL'],
    experience: [{ title: 'Intern', company: 'Acme', bullets: ['Built APIs'], skills: ['Node.js'] }],
    projects: [{ name: 'CampusSwap', bullets: ['Built a marketplace'], skills: ['React'] }],
    education: [{ school: 'SMU', degree: 'BSc', field: 'IS' }],
    updatedAt: new Date('2026-01-01'),
  };
  const profile = profileFromResume(resume);
  assert.equal(profile.summary, 'Second-year IS student.');
  assert.deepEqual(profile.skills, ['Node.js', 'SQL']);
  assert.equal(profile.experience[0].company, 'Acme');
  assert.equal(profile.projects[0].name, 'CampusSwap');
  assert.equal(profile.education[0].school, 'SMU');
  assert.equal(profile.email, ''); // contact is a different namespace; nothing in scoring reads it
  assert.equal(profile.name, '');
  assert.deepEqual(profile.updatedAt, new Date('2026-01-01'));
});
