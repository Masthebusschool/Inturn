import bcrypt from 'bcryptjs';
import * as User from '../models/User.js';
import { REMEMBER_ME_MAX_AGE } from '../config/session.js';

const SALT_ROUNDS = 10;
const EMAIL_PATTERN = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

const policies = {
  password: [
    'be at least 8 characters',
    'have at least 1 uppercase letter',
    'have at least 1 lowercase letter',
    'have at least 1 number',
  ],
};

/**
 * @param {Object} data
 * @param {Array} errors
 */
function validateSignupFields(data, errors) {
  if (!data.name)
    errors.push('Name is required');
  else if (data.name.length > 50)
    errors.push('Name must not exceed 50 characters');

  if (!data.email)
    errors.push('Email is required');
  else if (!EMAIL_PATTERN.test(data.email))
    errors.push('Email format is invalid');
}

/**
 * @param {Object} data
 * @param {Array} errors
 */
function validatePassword(data, errors) {
  // Password policy: 8 characters, 1 upper, 1 lower, 1 digit
  if (data.password.length < 8)
    errors.push(`Password must ${policies.password[0]}`);
  if (!/[A-Z]/.test(data.password))
    errors.push(`Password must ${policies.password[1]}`);
  if (!/[a-z]/.test(data.password))
    errors.push(`Password must ${policies.password[2]}`);
  if (!/[0-9]/.test(data.password))
    errors.push(`Password must ${policies.password[3]}`);
  if (data.confirmPassword !== data.password)
    errors.push('Confirm password and password do not match');
}

// Starts a fresh session for the user and waits until it is saved,
// so the very next request (e.g. logout) already sees it.
function startSession(req, user, rememberMe) {
  return new Promise((resolve, reject) => {
    // New session id on every login, so an old cookie cannot be reused
    req.session.regenerate((err) => {
      if (err) return reject(err);
      // previousLoginAt: the login before this one, shown as "Last login" on the profile
      req.session.user = { id: user.id, name: user.name, email: user.email, previousLoginAt: user.lastLoginAt ?? null };
      if (rememberMe)
        req.session.cookie.maxAge = REMEMBER_ME_MAX_AGE;
      req.session.save((err) => (err ? reject(err) : resolve()));
    });
  });
}

export const signup = async (req, res) => {
  // Express 5 leaves req.body undefined when no JSON body is sent
  const body = req.body ?? {};
  const data = {
    name: String(body.name ?? '').trim(),
    email: String(body.email ?? '').trim().toLowerCase(),
    password: String(body.password ?? ''),
    confirmPassword: String(body.confirmPassword ?? ''),
  };
  const errors = [];

  try {
    validateSignupFields(data, errors);
    validatePassword(data, errors);
    if (data.email && await User.retrieveUser({ email: data.email }))
      errors.push('Email is already registered');

    if (errors.length > 0)
      return res.status(400).json({ errors });

    const passwordHash = await bcrypt.hash(data.password, SALT_ROUNDS);
    const user = await User.createUser({ name: data.name, email: data.email, passwordHash });

    // No session here: the user logs in themselves after signing up
    return res.status(201).json({ user: User.toPublicUser(user) });
  }
  catch (e) {
    // Two sign ups with the same email at the same time
    if (e.code === 11000)
      return res.status(400).json({ errors: ['Email is already registered'] });
    if (e.name === 'ValidationError')
      return res.status(400).json({ errors: Object.values(e.errors).map((err) => err.message) });
    console.error(e);
    return res.status(500).json({ error: 'An internal error occurred' });
  }
};

export const login = async (req, res) => {
  const body = req.body ?? {};
  const email = String(body.email ?? '').trim().toLowerCase();
  const password = String(body.password ?? '');

  if (!email || !password)
    return res.status(400).json({ errors: ['Email and password are required'] });

  try {
    const user = await User.retrieveUserWithPassword({ email });

    let correct = true;
    if (!user)
      correct = false;
    else if (!await bcrypt.compare(password, user.passwordHash))
      correct = false;

    // Same message either way, so nobody can find out which emails are registered
    if (!correct)
      return res.status(401).json({ errors: ['Email or password is incorrect'] });

    await startSession(req, user, Boolean(body.rememberMe));
    await User.recordLogin(user.id);
    return res.json({ user: User.toPublicUser(user) });
  }
  catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'An internal error occurred' });
  }
};

export const logout = (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'An internal error occurred' });
    }
    res.clearCookie('inturn.sid');
    return res.json({ message: 'Logged out' });
  });
};

// Used by the front end on page load to find out who is logged in.
export const me = async (req, res) => {
  try {
    const user = await User.retrieveUserById(req.session.user.id);
    // The account was deleted while this session was still open
    if (!user) {
      return req.session.destroy(() => {
        res.clearCookie('inturn.sid');
        res.status(401).json({ error: 'You need to log in first' });
      });
    }
    return res.json({ user: User.toPublicUser(user) });
  }
  catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'An internal error occurred' });
  }
};
