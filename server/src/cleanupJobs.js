import dotenv from "dotenv";
import mongoose from "mongoose";

import {
  connectDB,
  applyWindowsDnsWorkaroundIfNeeded,
} from "./config/db.js";

dotenv.config({ quiet: true });

const MAX_JOBS = 30000;
const titlePattern = /\bintern(?:s|ship|ships)?\b/i;

function getSingaporeDate(date = new Date()) {
  return new Date(
    date.getTime() + 8 * 60 * 60 * 1000
  ).toISOString().slice(0, 10);
}

function isUnexpired(job, today) {
  const value = job?.metadata?.expiryDate;

  if (typeof value !== "string" || !value.trim()) {
    return false;
  }

  const closingDate = new Date(value);

  if (!Number.isFinite(closingDate.getTime())) {
    return false;
  }

  // Jobs closing today remain eligible.
  return getSingaporeDate(closingDate) >= today;
}

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

  const db = mongoose.connection.db;
  const jobs = db.collection("mcf_job_snapshots");
  const state = db.collection("mcf_sync_state");

  const active = await state.findOne({ _id: "active" });

  if (
    typeof active?.generation !== "string" ||
    !active.generation
  ) {
    throw new Error("No active jobs dataset was found.");
  }

  const generation = active.generation;
  const today = getSingaporeDate();

  const activeCount = await jobs.countDocuments({
    generation,
  });

  const oldQuery = {
    generation: {
      $exists: true,
      $ne: generation,
    },
  };

  const oldCount = await jobs.countDocuments(oldQuery);

  // Find matching titles, newest postings first.
  const cursor = jobs
    .find(
      {
        generation,
        "job.title": {
          $regex: titlePattern.source,
          $options: "i",
        },
      },
      {
        projection: {
          _id: 1,
          "job.metadata.expiryDate": 1,
        },
      }
    )
    .sort({
      "job.metadata.newPostingDate": -1,
      uuid: 1,
    });

  const keepIds = [];

  try {
    for await (const document of cursor) {
      if (!isUnexpired(document.job, today)) {
        continue;
      }

      keepIds.push(document._id);

      if (keepIds.length >= MAX_JOBS) {
        break;
      }
    }
  } finally {
    await cursor.close();
  }

  console.log("Active generation:", generation);
  console.log("Singapore date:", today);
  console.log("Current active records:", activeCount);
  console.log("Eligible jobs to keep:", keepIds.length);
  console.log(
    "Active records to remove:",
    activeCount - keepIds.length
  );
  console.log("Old-generation records to remove:", oldCount);

  // Protect against accidentally deleting everything because
  // the title or date format differs from what we expect.
  if (keepIds.length === 0) {
    throw new Error(
      "No eligible jobs were found. Nothing was deleted. " +
      "Check the stored titles and closing-date format."
    );
  }

  if (!process.argv.includes("--apply")) {
    console.log(
      "PREVIEW ONLY: nothing was deleted. " +
      "Run with --apply to perform cleanup."
    );
  } else {
    const current = await state.findOne({ _id: "active" });

    if (current?.generation !== generation) {
      throw new Error(
        "The active generation changed. Nothing was deleted."
      );
    }

    // Keep only the selected unexpired internship records.
    const removedActive = await jobs.deleteMany({
      generation,
      _id: { $nin: keepIds },
    });

    // Remove inactive copies and unfinished older collections.
    const removedOld = await jobs.deleteMany(oldQuery);

    const remaining = await jobs.countDocuments({
      generation,
    });

    const updated = await state.updateOne(
      {
        _id: "active",
        generation,
      },
      {
        $set: {
          count: remaining,
        },
      }
    );

    if (updated.matchedCount !== 1) {
      throw new Error(
        "Cleanup ran, but the active dataset changed. " +
        "Check its stored count before continuing."
      );
    }

    console.log(
      "Removed unwanted active records:",
      removedActive.deletedCount
    );

    console.log(
      "Removed old-generation records:",
      removedOld.deletedCount
    );

    console.log("Remaining eligible jobs:", remaining);
    console.log("Cleanup complete.");
  }
} catch (error) {
  console.error(
    "[Jobs cleanup]",
    error.message.replace(
      /mongodb(?:\+srv)?:\/\/[^\s]+/gi,
      "[database URL hidden]"
    )
  );

  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}