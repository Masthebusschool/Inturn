import dotenv from "dotenv";
import mongoose from "mongoose";

import {connectDB, applyWindowsDnsWorkaroundIfNeeded} from "../config/db.js";

import { syncJobs } from "../services/jobsSnapshot.js";

dotenv.config({ quiet: true });

try {
  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI is missing.");
  }

  await applyWindowsDnsWorkaroundIfNeeded(
    process.env.MONGODB_URI
  );

  const connected = await connectDB();

  if (!connected) {
    throw new Error("Could not connect to MongoDB.");
  }

  await syncJobs();
} catch (error) {
  console.error("[Jobs sync] Failed:", error.message.replace( /mongodb(?:\+srv)?:\/\/[^\s]+/gi, "[database URL hidden]"));

  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}