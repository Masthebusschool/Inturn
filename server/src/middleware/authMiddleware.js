import * as User from '../models/User.js';

// Protects API routes: only logged-in users get through.
// Usage in any route file:
//   router.get('/', isLoggedIn, controller.fn)
// then read the current user's id from req.session.user.id
export function isLoggedIn(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ error: 'You need to log in first' });
  }
  return next();
}

// For routes that need the whole user document (e.g. Skill Gap, resumes): sets req.user.
// Usage: router.use(isLoggedIn, loadUser), then read req.user / req.user._id
export async function loadUser(req, res, next) {
  const user = await User.retrieveUserById(req.session.user.id);
  // The account was deleted while this session was still open
  if (!user) {
    return res.status(401).json({ error: 'You need to log in first' });
  }
  req.user = user;
  return next();
}
