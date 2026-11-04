// Choices and limits for the profile form. Keep in sync with the server
// (EDUCATION_LEVELS in server/src/models/User.js, limits in the server's profile validation).

export const EDUCATION_LEVELS = ['Polytechnic', 'Undergraduate', 'Postgraduate', 'PhD']

export const SKILL_SUGGESTIONS = [
  'Python', 'Java', 'JavaScript', 'SQL', 'HTML/CSS', 'Excel',
  'Data Analysis', 'Machine Learning', 'Figma', 'Communication',
  'Teamwork', 'Project Management',
]

export const INDUSTRY_OPTIONS = [
  'Technology', 'Finance', 'Banking', 'Consulting', 'Healthcare',
  'Education', 'Marketing', 'Media & Communications', 'Government & Public Sector',
  'Retail & E-commerce', 'Logistics & Supply Chain', 'Engineering', 'Legal', 'Non-profit',
]

export const PROFILE_LIMITS = {
  textLength: 100,
  tagLength: 50,
  skills: 30,
  industries: 10,
  resumeMB: 2, // MAX_RESUME_SIZE in server/src/middleware/uploadMiddleware.js
}
