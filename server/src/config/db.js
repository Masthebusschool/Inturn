import mongoose from 'mongoose';

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
    console.log(`[db] Connected to MongoDB (${mongoose.connection.name})`);
    // Attached after connecting so a failed first attempt logs once (below), not three times.
    mongoose.connection.on('error', (err) => console.warn('[db] Connection error:', err.message));
    mongoose.connection.on('disconnected', () => console.warn('[db] Disconnected from MongoDB'));
    return true;
  } catch (err) {
    console.warn('[db] Could not connect to MongoDB:', err.message, '— server will keep running without a database.');
    return false;
  }
}
