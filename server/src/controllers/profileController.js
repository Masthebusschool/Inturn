import * as User from '../models/User.js';
import Application from '../models/Application.js';
import { toProfile } from '../utils/profile.js';
import { STATUS, STATUSES } from '../models/constants/statuses.js';

const HEATMAP_DAYS = 400;

// Trim, drop empties, dedupe case-insensitively (first spelling wins).
function cleanList(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  const out = [];
  for (const item of value) {
    const t = String(item ?? '').trim();
    const key = t.toLowerCase();
    if (!t || seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out;
}

/**
 * Rules: education level is required. Name is checked only when it was sent.
 * @param {Object} data
 * @param {Array} errors
 */
function validateProfile(data, errors) {
  if (data.name !== undefined) {
    if (!data.name)
      errors.push('Name is required');
    else if (data.name.length > 50)
      errors.push('Name must not exceed 50 characters');
  }

  if (!data.educationLevel)
    errors.push('Education level is required');
  else if (!User.EDUCATION_LEVELS.includes(data.educationLevel))
    errors.push('Invalid education level');
}

export const getProfile = async (req, res) => {
  try {
    const user = await User.retrieveUserById(req.session.user.id);
    if (!user)
      return res.status(404).json({ error: 'User not found' });
    return res.json({ user: User.toPublicUser(user), profile: await toProfile(user) });
  }
  catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'An internal error occurred' });
  }
};

// Used by both onboarding and edit profile.
export const updateProfile = async (req, res) => {
  const body = req.body ?? {};
  // Only name and education can be changed here. Email and password changes live in
  // authController and need the current password.
  const data = {
    educationLevel: String(body.educationLevel ?? '').trim(),
    institution: String(body.institution ?? '').trim(),
    fieldOfStudy: String(body.fieldOfStudy ?? '').trim(),
  };
  if (body.name !== undefined)
    data.name = String(body.name ?? '').trim();
  // Only touched when sent, so callers that don't know about industries never wipe them.
  if (body.targetIndustries !== undefined)
    data.targetIndustries = cleanList(body.targetIndustries);
  const errors = [];

  try {
    validateProfile(data, errors);
    if (errors.length > 0)
      return res.status(400).json({ errors });

    const user = await User.updateUser(req.session.user.id, data);
    if (!user)
      return res.status(404).json({ error: 'User not found' });
    if (data.name !== undefined)
      req.session.user.name = user.name;
    return res.json({ user: User.toPublicUser(user) });
  }
  catch (e) {
    if (e.name === 'ValidationError')
      return res.status(400).json({ errors: Object.values(e.errors).map((err) => err.message) });
    console.error(e);
    return res.status(500).json({ error: 'An internal error occurred' });
  }
};

// Account dates plus tracked-application counts for the profile's Activity card.
export const getActivity = async (req, res) => {
  try {
    const user = await User.retrieveUserById(req.session.user.id);
    if (!user)
      return res.status(404).json({ error: 'User not found' });

    const applications = await Application.find({ user: req.session.user.id })
      .select('status createdAt')
      .lean();

    const byStatus = Object.fromEntries(STATUSES.map((s) => [s, 0]));
    for (const app of applications)
      if (app.status in byStatus) byStatus[app.status]++;

    const cutoff = Date.now() - HEATMAP_DAYS * 24 * 60 * 60 * 1000;
    const applicationDates = applications
      .filter((app) => app.createdAt && app.createdAt.getTime() >= cutoff)
      .map((app) => app.createdAt.toISOString());

    return res.json({
      joinedAt: user.createdAt,
      lastLoginAt: req.session.user.previousLoginAt ?? null,
      stats: {
        total: applications.length,
        submitted: applications.filter((app) => app.status !== STATUS.SAVED).length,
        byStatus,
      },
      applicationDates,
    });
  }
  catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'An internal error occurred' });
  }
};

// Hard delete, on purpose. The user must type their own email to confirm.
export const deleteAccount = async (req, res) => {
  const body = req.body ?? {};
  const confirmEmail = String(body.confirmEmail ?? '').trim().toLowerCase();

  try {
    const user = await User.retrieveUserById(req.session.user.id);
    if (!user)
      return res.status(404).json({ error: 'User not found' });
    if (confirmEmail !== user.email)
      return res.status(400).json({ errors: ['Type your email exactly to confirm'] });

    await User.deleteUser(user.id);

    // The data is already gone, so a failed session cleanup still counts as success
    return req.session.destroy((err) => {
      if (err) console.error(err);
      res.clearCookie('inturn.sid');
      res.json({ message: 'Account deleted' });
    });
  }
  catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'An internal error occurred' });
  }
};
