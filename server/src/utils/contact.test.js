import { test } from 'node:test';
import assert from 'node:assert/strict';
import { contactLinks, cleanContact } from './contact.js';

test('contactLinks prefers links, falls back to legacy fields, skips empty values', () => {
  assert.deepEqual(
    contactLinks({ links: [{ label: 'Site', value: 'a.com' }, { label: 'X', value: ' ' }], linkedin: 'old' }),
    [{ label: 'Site', value: 'a.com' }]
  );
  assert.deepEqual(contactLinks({ linkedin: 'linkedin.com/in/a', github: '', portfolio: 'p.dev' }), [
    { label: 'LinkedIn', value: 'linkedin.com/in/a' },
    { label: 'Portfolio', value: 'p.dev' },
  ]);
  assert.deepEqual(contactLinks(undefined), []);
});

test('cleanContact trims, drops blank entries, caps lengths and count, omits legacy keys', () => {
  const c = cleanContact({
    fullName: ' A ', phone: '1', email: 'e', linkedin: 'ignored',
    links: [
      { label: ' Blog ', value: ' b.com ' },
      { label: '', value: 'x' },
      { label: 'y', value: '' },
      { label: 'L'.repeat(60), value: 'v'.repeat(400) },
      ...Array.from({ length: 20 }, (_, i) => ({ label: `l${i}`, value: `v${i}` })),
    ],
  });
  assert.equal(c.fullName, 'A');
  assert.deepEqual(c.links[0], { label: 'Blog', value: 'b.com' });
  assert.equal(c.links[1].label.length, 40);
  assert.equal(c.links[1].value.length, 300);
  assert.equal(c.links.length, 12);
  assert.deepEqual(Object.keys(c), ['fullName', 'phone', 'email', 'links']);
});

test('cleanContact derives links from legacy fields when links is absent', () => {
  assert.deepEqual(cleanContact({ github: 'github.com/a' }).links, [{ label: 'GitHub', value: 'github.com/a' }]);
  assert.deepEqual(cleanContact(undefined), { fullName: '', phone: '', email: '', links: [] });
});
