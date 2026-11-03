// The profile shape Skill Gap scoring and "Start from Profile" read, built from the fields the
// Profile page collects. Work experience, projects and summaries live on each Resume instead.
// Never includes passwordHash.
export function toProfile(user) {
  return {
    email: user.email,
    name: user.name,
    educationLevel: user.educationLevel,
    summary: '',
    skills: [...(user.skills || [])],
    targetRoles: [],
    targetIndustries: [...(user.targetIndustries || [])],
    experience: [],
    projects: [],
    education: user.institution || user.fieldOfStudy
      ? [{ school: user.institution || '', degree: user.educationLevel || '', field: user.fieldOfStudy || '', startDate: '', endDate: '' }]
      : [],
    updatedAt: user.updatedAt,
  };
}
