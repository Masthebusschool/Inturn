// Resume contact: fullName/phone/email are fixed; everything else is a free list of { label, value } links.
// Pure helpers (no DB) shared by the resume routes, the AI parser and the analyzer.
import { s } from './sanitize.js';

const MAX_LINKS = 12;
const MAX_LABEL = 40;
const MAX_VALUE = 300;

// Pre-links resumes stored these three as separate fields.
export const LEGACY_LINKS = [['linkedin', 'LinkedIn'], ['github', 'GitHub'], ['portfolio', 'Portfolio']];

const legacyLinks = (c) => LEGACY_LINKS.map(([key, label]) => ({ label, value: s(c?.[key]) })).filter((l) => l.value);

// contact.links when the resume has any, else the pre-links linkedin/github/portfolio values as entries.
export function contactLinks(c) {
  const links = Array.isArray(c?.links)
    ? c.links.map((l) => ({ label: s(l?.label), value: s(l?.value) })).filter((l) => l.value)
    : [];
  return links.length > 0 ? links : legacyLinks(c);
}

// Request-body sanitiser. Never emits the legacy keys, so saving a resume drops them.
export function cleanContact(c) {
  const raw = Array.isArray(c?.links) ? c.links : legacyLinks(c);
  const links = raw
    .map((l) => ({ label: s(l?.label).slice(0, MAX_LABEL), value: s(l?.value).slice(0, MAX_VALUE) }))
    .filter((l) => l.label && l.value)
    .slice(0, MAX_LINKS);
  return { fullName: s(c?.fullName), phone: s(c?.phone), email: s(c?.email), links };
}
