const plain = (arr) => (arr || []).map((x) => (x && typeof x.toObject === 'function' ? x.toObject() : x));

// Maps a Resume document into the same shape toProfile() produces, for skill-gap scoring
// (analyzeSkillGap / generateTailoredResume read only summary/skills/experience/projects/education).
// email/name are left blank: a resume's contact block is a different namespace from profile
// identity, and nothing in the scoring path reads either field.
export function profileFromResume(resume) {
  return {
    email: '',
    name: '',
    educationLevel: '',
    summary: resume.summary || '',
    skills: [...(resume.skills || [])],
    targetRoles: [],
    experience: plain(resume.experience),
    projects: plain(resume.projects),
    education: plain(resume.education),
    updatedAt: resume.updatedAt,
  };
}
