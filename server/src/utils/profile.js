export const PROFILE_FIELDS = [
  'summary', 'skills', 'experience', 'projects', 'education',
  'targetRoles', 'targetIndustries', 'educationLevel',
];

const plain = (arr) => (arr || []).map((x) => (x && typeof x.toObject === 'function' ? x.toObject() : x));

// Public shape of a user's profile (never includes passwordHash).
export function toProfile(user) {
  return {
    email: user.email,
    name: user.name,
    educationLevel: user.educationLevel,
    summary: user.summary || '',
    skills: [...(user.skills || [])],
    targetRoles: [...(user.targetRoles || [])],
    targetIndustries: [...(user.targetIndustries || [])],
    experience: plain(user.experience),
    projects: plain(user.projects),
    education: plain(user.education),
    updatedAt: user.updatedAt,
  };
}
