import { getPrimaryResume } from './primaryResume.js';
import { profileFromResume } from './resumeProfile.js';

// The profile shape Skill Gap scoring and "Start from Profile" read: identity and education come
// from the User, while summary, skills, experience and projects come from the user's primary
// resume (utils/primaryResume.js). Never includes passwordHash.
export async function toProfile(user) {
  const resume = await getPrimaryResume(user._id);
  const r = resume ? profileFromResume(resume) : { summary: '', skills: [], experience: [], projects: [] };
  return {
    email: user.email,
    name: user.name,
    educationLevel: user.educationLevel,
    summary: r.summary,
    skills: r.skills,
    targetRoles: [],
    experience: r.experience,
    projects: r.projects,
    education: user.institution || user.fieldOfStudy
      ? [{ school: user.institution || '', degree: user.educationLevel || '', field: user.fieldOfStudy || '', startDate: '', endDate: '' }]
      : [],
    updatedAt: user.updatedAt,
  };
}
