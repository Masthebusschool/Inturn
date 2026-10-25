import mongoose from 'mongoose';
import dns from 'node:dns';

// Some Windows machines misdetect the system DNS resolver as 127.0.0.1
// (nothing listens there, so every lookup fails with ECONNREFUSED) even
// though the OS itself resolves fine — a Node/c-ares quirk, not a real
// network problem. Retry once against public resolvers in that case.
function isDnsError(err) {
  return err?.code === 'ECONNREFUSED' && /^query/i.test(err?.syscall || String(err?.message || ''));
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
