import mongoose from 'mongoose';
import dns from 'node:dns';

// Some Windows machines misdetect the system DNS resolver as 127.0.0.1
// (nothing listens there, so every lookup fails with ECONNREFUSED) even
// though the OS itself resolves fine — a Node/c-ares quirk, not a real
// network problem. Retry once against public resolvers in that case.
function isDnsError(err) {
  return err?.code === 'ECONNREFUSED' && /^query/i.test(err?.syscall || String(err?.message || ''));
}

// The DNS retry below (via 8.8.8.8/1.1.1.1) leaves a duplicate lookup for the *first*,
// already-handled failure resolving in the background; when it rejects it's an unhandled
// rejection outside any try/catch here, and Node kills the whole process by default — breaking
// the "never throws" promise just below. Only swallow this exact, already-logged DNS shape.
process.on('unhandledRejection', (err) => {
  if (!isDnsError(err)) throw err;
  console.warn('[db] Ignoring a duplicate/delayed DNS rejection from an already-handled connection attempt:', err.message);
});

// connect-mongo (server/src/config/session.js) opens its own MongoClient, independent of
// mongoose's connection below, so it hits the same Windows DNS bug on its own SRV lookup —
// with no retry of its own. Call this once at startup, before createSessionMiddleware() or
// connectDB() runs, so Node's shared `dns` module is already fixed for both by the time either
// tries to connect, instead of each needing its own reactive catch-and-retry.
export async function applyWindowsDnsWorkaroundIfNeeded(uri) {
  if (!uri) return;
  try {
    const hostname = new URL(uri).hostname;
    await dns.promises.resolveSrv(`_mongodb._tcp.${hostname}`);
  } catch (err) {
    if (!isDnsError(err)) return;
    console.warn('[db] Default DNS resolver failed (%s), switching to 8.8.8.8/1.1.1.1 before any MongoDB client connects...', err.message);
    dns.setServers(['8.8.8.8', '1.1.1.1']);
  }
}

// Connects to MongoDB. Never throws: the API should stay up even without a database.
export async function connectDB() {
  // Read env inside the function (dotenv has run by the time this is called).
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.warn('[db] MONGODB_URI is not set — skipping MongoDB connection. Copy server/.env.example to server/.env and fill it in. API will keep running without a database.');
    return false;
  }

  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
  } catch (err) {
    if (!isDnsError(err)) {
      console.warn('[db] Could not connect to MongoDB:', err.message, '— server will keep running without a database.');
      return false;
    }
    console.warn('[db] Default DNS resolver failed (%s), retrying via 8.8.8.8/1.1.1.1...', err.message);
    dns.setServers(['8.8.8.8', '1.1.1.1']);
    try {
      await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
    } catch (err2) {
      console.warn('[db] Could not connect to MongoDB:', err2.message, '— server will keep running without a database.');
      return false;
    }
  }

  console.log(`[db] Connected to MongoDB (${mongoose.connection.name})`);
  // Attached after connecting so a failed first attempt logs once (above), not three times.
  mongoose.connection.on('error', (err) => console.warn('[db] Connection error:', err.message));
  mongoose.connection.on('disconnected', () => console.warn('[db] Disconnected from MongoDB'));
  return true;
}
