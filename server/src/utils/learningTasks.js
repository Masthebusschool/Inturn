import LearningTask from '../models/LearningTask.js';
import { SKILL_CATEGORIES } from './skillGapScoring.js';
import { canonical } from './skillNormalize.js';

const MAX_SOURCES = 20;

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
  const ops = todoCandidates(result.requirements).map(({ skillKey, skillText, verdict }) => ({
    updateOne: {
      filter: { user: userId, skillKey },
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
  }));
  if (ops.length) await LearningTask.bulkWrite(ops, { ordered: false });
}
