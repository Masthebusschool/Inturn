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
