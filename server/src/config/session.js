import session from 'express-session';
import MongoStore from 'connect-mongo';

// "Remember me" keeps the user logged in for 30 days (used by login in step 3).
export const REMEMBER_ME_MAX_AGE = 30 * 24 * 60 * 60 * 1000;

// Built inside a function so it reads process.env after dotenv has run (same as connectDB).
export function createSessionMiddleware() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    console.warn('[session] SESSION_SECRET is not set — using an insecure dev secret. Add it to server/.env.');
  }

  const uri = process.env.MONGODB_URI;

  return session({
    name: 'inturn.sid',
    secret: secret || 'dev-only-insecure-secret',
    resave: false,
    saveUninitialized: false,
    // Sessions live in MongoDB so nodemon restarts don't log everyone out.
    // Without a database, fall back to the default in-memory store.
    store: uri
      ? MongoStore.create({ mongoUrl: uri, collectionName: 'sessions', ttl: REMEMBER_ME_MAX_AGE / 1000 })
      : undefined,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      // No maxAge here: the cookie ends when the browser closes,
      // unless login sets maxAge for "remember me".
    },
  });
}
