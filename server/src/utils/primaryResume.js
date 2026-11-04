import Resume from '../models/Resume.js';
import { canonical } from './skillNormalize.js';

// Each user has at most one primary resume: their base profile. The Profile page edits it, and
// Skill Gap ("Use base Profile"), "Start from Profile" and job matching read it.

// The user's primary resume, or null when they have no resumes. Accounts from before this flag
// (or whose primary was deleted) get their most recently updated resume promoted, once.
export async function getPrimaryResume(userId) {
  const primary = await Resume.findOne({ user: userId, primary: true });
  if (primary) return primary;
  const latest = await Resume.findOne({ user: userId }).sort({ updatedAt: -1 }).select('_id');
  if (!latest) return null;
  try {
    // timestamps: false so promoting doesn't reorder My Resumes
    return await Resume.findByIdAndUpdate(latest._id, { primary: true }, { returnDocument: 'after', timestamps: false });
  } catch (e) {
    if (e.code !== 11000) throw e;
    return Resume.findOne({ user: userId, primary: true }); // a concurrent request promoted one first
  }
}

// Creates a resume; the user's first one becomes primary.
export async function createResume(userId, fields) {
  const primary = !(await Resume.exists({ user: userId }));
  try {
    return await Resume.create({ ...fields, user: userId, primary });
  } catch (e) {
    if (e.code !== 11000 || !primary) throw e;
    return Resume.create({ ...fields, user: userId, primary: false }); // lost a race for primary
  }
}

export async function getOrCreatePrimaryResume(userId) {
  const existing = await getPrimaryResume(userId);
  if (existing) return existing;
  const created = await createResume(userId, { name: 'My Profile' });
  return created.primary ? created : getPrimaryResume(userId);
}

// Add-only merge into the primary resume's skills: never removes or reorders existing ones.
// Returns the skills actually added.
export async function addSkillsToPrimary(userId, skills) {
  const primary = await getOrCreatePrimaryResume(userId);
  const key = (t) => canonical(t) || t.toLowerCase();
  const seen = new Set((primary.skills || []).map(key));
  const added = [];
  for (const raw of Array.isArray(skills) ? skills : []) {
    const t = typeof raw === 'string' ? raw.trim() : '';
    if (!t || seen.has(key(t))) continue;
    seen.add(key(t));
    added.push(t);
  }
  // $addToSet is atomic and appends at the end, so a concurrent profile edit isn't overwritten.
  if (added.length) await Resume.updateOne({ _id: primary._id }, { $addToSet: { skills: { $each: added } } });
  return added;
}
