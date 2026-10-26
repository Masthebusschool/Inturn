// Shared request-body sanitisers for profile-like string/array/object-list fields.
export const s = (v) => (typeof v === 'string' ? v.trim() : '');

// keyOf (optional) returns the comparison key for dedupe; first occurrence wins, original text is stored.
export const strList = (v, keyOf) => {
  const out = [];
  const seen = new Set();
  for (const x of Array.isArray(v) ? v : []) {
    const t = s(x);
    if (!t) continue;
    if (keyOf) {
      const k = keyOf(t);
      if (seen.has(k)) continue;
      seen.add(k);
    }
    out.push(t);
  }
  return out;
};

// Build each entry, then drop entries whose text/array fields are all blank.
export const objList = (v, build) =>
  (Array.isArray(v) ? v : [])
    .filter((x) => x && typeof x === 'object')
    .map(build)
    .filter((e) => Object.values(e).some((val) => (Array.isArray(val) ? val.length > 0 : typeof val === 'string' && val)));

export const lowerKey = (t) => t.toLowerCase();
