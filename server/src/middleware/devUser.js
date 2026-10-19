// ============================================================================
// TEMPORARY MOCK AUTH — DEV ONLY.
// Real auth arrives with feat/AccountProfile. When it lands: delete this file
// and swap `router.use(devUser)` in routes/profile.js + routes/skillgap.js for
// the real auth middleware. Routes only ever read `req.user` / `req.user._id`,
// so nothing else needs to change.
// ============================================================================
import mongoose from 'mongoose';
import User from '../models/User.js';

const DEV_EMAIL = 'dev@inturn.local';

export async function devUser(req, res, next) {
  // Without this check Mongoose buffers queries for 10s before throwing.
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ error: 'Database not connected. Set MONGODB_URI in server/.env.' });
  }
  // Atomic find-or-create (Express 5 forwards a rejected promise to the error handler).
  req.user = await User.findOneAndUpdate(
    { email: DEV_EMAIL },
    { $setOnInsert: { email: DEV_EMAIL, name: 'Dev Student' } },
    { upsert: true, returnDocument: 'after' }
  );
  next();
}
