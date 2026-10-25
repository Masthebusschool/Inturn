import * as User from '../models/User.js';

// Trims each item, drops empty ones and removes duplicates (ignoring case).
function cleanList(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  const result = [];
  for (const item of value) {
    const text = String(item ?? '').trim();
    const key = text.toLowerCase();
    if (text && !seen.has(key)) {
      seen.add(key);
      result.push(text);
    }
  }
  return result;
}

/**
 * Rules: education level is required, at least one skill, target industries optional.
 * @param {Object} data
 * @param {Array} errors
 */
function validateProfile(data, errors) {
  if (!data.educationLevel)
    errors.push('Education level is required');
  else if (!User.EDUCATION_LEVELS.includes(data.educationLevel))
    errors.push('Invalid education level');

  if (data.skills.length === 0)
    errors.push('Add at least one skill');

  
}

export const getProfile = async (req, res) => {
  try {
    const user = await User.retrieveUserById(req.session.user.id);
    if (!user)
      return res.status(404).json({ error: 'User not found' });
    return res.json({ user: User.toPublicUser(user) });
  }
  catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'An internal error occurred' });
  }
};

// Used by both onboarding and edit profile.
export const updateProfile = async (req, res) => {
  const body = req.body ?? {};
  // Only these fields can be changed here: never email or password
  const data = {
    educationLevel: String(body.educationLevel ?? '').trim(),
    institution: String(body.institution ?? '').trim(),
    fieldOfStudy: String(body.fieldOfStudy ?? '').trim(),
    skills: cleanList(body.skills),
    targetIndustries: cleanList(body.targetIndustries),
  };
  const errors = [];

  try {
    validateProfile(data, errors);
    if (errors.length > 0)
      return res.status(400).json({ errors });

    const user = await User.updateUser(req.session.user.id, data);
    if (!user)
      return res.status(404).json({ error: 'User not found' });
    return res.json({ user: User.toPublicUser(user) });
  }
  catch (e) {
    if (e.name === 'ValidationError')
      return res.status(400).json({ errors: Object.values(e.errors).map((err) => err.message) });
    console.error(e);
    return res.status(500).json({ error: 'An internal error occurred' });
  }
};
