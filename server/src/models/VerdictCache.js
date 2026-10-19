import mongoose from 'mongoose';

// A cache, not data: memoizes judge verdicts AND JD parses (hash prefix 'jd|'). Stable requirement
// keys are what make verdict-cache hits and the stability guards work, so the parse must be memoized too.
const verdictCacheSchema = new mongoose.Schema({
  hash: { type: String, required: true, unique: true },
  verdict: mongoose.Schema.Types.Mixed,
  createdAt: { type: Date, default: Date.now, expires: 60 * 60 * 24 * 30 }, // TTL 30 days
});

export default mongoose.model('VerdictCache', verdictCacheSchema); // collection: verdictcaches
