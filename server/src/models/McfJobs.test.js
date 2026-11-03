import { test } from 'node:test';
import assert from 'node:assert/strict';
import { jobFromMcf } from './McfJobs.js';

test('jobFromMcf strips HTML from the description into plain text', () => {
  const details = jobFromMcf({
    uuid: 'abc123',
    title: 'Backend Intern',
    hiringCompany: { name: 'Acme' },
    description: '<p>Build <b>APIs</b>.</p><ul><li>Node.js</li><li>Mongo</li></ul>',
  });
  assert.equal(details.description, 'Build APIs.\n\n• Node.js\n• Mongo');
});

test('jobFromMcf returns an empty description when the job has none (compact list job)', () => {
  const details = jobFromMcf({ uuid: 'abc123', title: 'Backend Intern' });
  assert.equal(details.description, '');
});
