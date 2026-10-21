import LearningTask from '../models/LearningTask.js';
import { SKILL_CATEGORIES } from './skillGapScoring.js';
import { canonical } from './skillNormalize.js';

const MAX_SOURCES = 20;

// True when every word of the shorter key also appears in the longer one (e.g. "docker" / "docker
// containers") — a strict-subset signal, deliberately conservative. A looser ratio-based overlap
// (e.g. "share 1 of 2 words") was tried and rejected: "cloud aws" and "cloud platforms" score the
// same under it as "python developer" and "java developer" — there's no way to tell a real
// duplicate from two genuinely different skills using word overlap alone once it's that loose, so
// it merged things that were never the same skill. A full subset relationship has no such
// false-positive case: if A's words are entirely contained in B's, B is A stated more specifically,
// not a different skill that happens to share one word.
export function similarSkillKeys(a, b) {
  if (a === b) return true;
  const wordsOf = (k) => new Set(k.split(' ').filter(Boolean));
  const wa = wordsOf(a);
  const wb = wordsOf(b);
  if (!wa.size || !wb.size) return false;
  const [small, big] = wa.size <= wb.size ? [wa, wb] : [wb, wa];
  for (const w of small) if (!big.has(w)) return false;
  return true;
}

// First key in `knownKeys` similar enough to `key` to reuse, else `key` itself (a new entry).
export function resolveSkillKey(key, knownKeys) {
  return knownKeys.find((k) => similarSkillKeys(k, key)) || key;
}

// Missing/partial skill requirements, one per canonical skill (first occurrence wins).
export function todoCandidates(requirements) {
  if (!Array.isArray(requirements)) return [];
  const seen = new Set();
  const out = [];
  for (const r of requirements) {
    if (r.verdict !== 'missing' && r.verdict !== 'partial') continue;
    if (!SKILL_CATEGORIES.includes(r.category)) continue;
    const skillKey = canonical(r.key || r.text);
    if (!skillKey || seen.has(skillKey)) continue;
    seen.add(skillKey);
    out.push({ skillKey, skillText: r.text, verdict: r.verdict });
  }
  return out;
}

// List order: pending first, then earliest deadline (none last), then oldest.
export function compareTasks(a, b) {
  if (a.status !== b.status) return a.status === 'done' ? 1 : -1;
  if (a.deadline && b.deadline) {
    const d = new Date(a.deadline) - new Date(b.deadline);
    if (d) return d;
  } else if (a.deadline) return -1;
  else if (b.deadline) return 1;
  return new Date(a.createdAt) - new Date(b.createdAt);
}

export async function syncLearningTasksFromResult(userId, result) {
  const deadline = result.job?.applicationDeadline || undefined;
  const candidates = todoCandidates(result.requirements);
  if (!candidates.length) return;

  // Resolve each candidate against the user's existing to-do keys (and against earlier candidates
  // already resolved in this same batch, so two similar skills surfaced by the SAME analysis also
  // collapse into one) before upserting, so a differently-worded-but-same skill from a different
  // job posting lands on the existing item instead of creating a near-duplicate.
  const existing = await LearningTask.find({ user: userId }).select('skillKey').lean();
  const knownKeys = existing.map((t) => t.skillKey);

  const ops = [];
  for (const { skillKey, skillText, verdict } of candidates) {
    const matchKey = resolveSkillKey(skillKey, knownKeys);
    if (!knownKeys.includes(matchKey)) knownKeys.push(matchKey);
    ops.push({
      updateOne: {
        filter: { user: userId, skillKey: matchKey },
        update: {
          // status only on insert => a done item stays done
          $setOnInsert: { skillText, status: 'pending' },
          $push: {
            sources: {
              $each: [{ skillGapResult: result._id, job: { title: result.job?.title, company: result.job?.company }, verdict, deadline }],
              $slice: -MAX_SOURCES,
            },
          },
          // $min on an absent field sets it; on a present one keeps the earlier date.
          ...(deadline && { $min: { deadline } }),
        },
        upsert: true,
      },
    });
  }
  await LearningTask.bulkWrite(ops, { ordered: false });
}
