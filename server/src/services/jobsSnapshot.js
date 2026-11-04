import mongoose from "mongoose";
import { randomUUID } from "node:crypto";
import { prepareJobGeneration } from "./jobsSearch.js";

const API = "https://api.mycareersfuture.gov.sg/v2/jobs";
const LIMIT = 100;

const wait = (ms) =>
  new Promise((resolve) => setTimeout(resolve, ms));

function collections() {
  if (mongoose.connection.readyState !== 1) {
    throw new Error("MongoDB is not connected.");
  }

  return {
    jobs: mongoose.connection.db.collection("mcf_job_snapshots"),
    state: mongoose.connection.db.collection("mcf_sync_state"),
  };
}

function compactJob(job) {
  return {
    uuid: job.uuid,
    title: job.title,
    skills: job.skills || [],
    categories: job.categories || [],
    employmentTypes: job.employmentTypes || [],
    minimumYearsExperience: job.minimumYearsExperience,
    salary: job.salary,
    address: job.address,
    metadata: job.metadata,

    postedCompany: job.postedCompany ? { name: job.postedCompany.name } : null,
  };
}

export async function fetchMcfJson(url) {
  for (let attempt = 0; attempt < 6; attempt++) {
    let response;

    try {
      response = await fetch(url, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(30000),
      });
    } catch (error) {
      if (attempt === 5) throw error;

      await wait(2000 * 2 ** attempt);
      continue;
    }

    if (response.ok) {
      return response.json();
    }

    const status = response.status;
    const retryAfter = response.headers.get("retry-after");

    await response.body?.cancel();

    if (
      (status !== 429 && status < 500) ||
      attempt === 5
    ) {
      throw new Error(`MCF returned HTTP ${status}`);
    }

    let retryDelay = 0;

    if (retryAfter) {
      const seconds = Number(retryAfter);

      retryDelay = Number.isFinite(seconds)
        ? seconds * 1000
        : Math.max(0, Date.parse(retryAfter) - Date.now());
    }

    const delay = Math.max(
      retryDelay || 0,
      status === 429
        ? 60000 * 2 ** attempt
        : 2000 * 2 ** attempt
    );

    console.log(
      `[Jobs sync] HTTP ${status}; retrying in ` +
      `${Math.ceil(delay / 1000)} seconds.`
    );

    await wait(delay);
  }

  throw new Error("MCF request failed.");
}

function getSingaporeDate(date = new Date()) {
  return new Date(
    date.getTime() + 8 * 60 * 60 * 1000
  ).toISOString().slice(0, 10);
}

function isUnexpired(job) {
  const value = job.metadata?.expiryDate;

  if (typeof value !== "string" || !value.trim()) {
    return false;
  }

  const closingDate = new Date(value);

  if (!Number.isFinite(closingDate.getTime())) {
    return false;
  }

  return getSingaporeDate(closingDate) >= getSingaporeDate();
}

export async function syncJobs() {
  const { jobs, state } = collections();

  const MAX_JOBS = 30000;
  const titlePattern = /\bintern(?:s|ship|ships)?\b/i;

  await jobs.createIndex(
    { generation: 1, uuid: 1 },
    { unique: true }
  );

  const generation = randomUUID();
  const startedAt = new Date();

  const savedIds = new Set();

  let page = 0;
  let previousSignature = "";

  console.log(
    `[Jobs sync] Collecting up to ${MAX_JOBS} internship jobs.`
  );

  try {
    while (savedIds.size < MAX_JOBS) {
      const data = await fetchMcfJson(
        `${API}?limit=${LIMIT}&page=${page}&sortBy=new_posting_date`
      );

      if (
        !Array.isArray(data.results) ||
        !Number.isInteger(data.total) ||
        data.total < 0
      ) {
        throw new Error("Unexpected MCF response.");
      }

      if (data.results.length === 0) {
        if (page * LIMIT < data.total) {
          throw new Error(
            "Collection stopped at an unexpected empty page."
          );
        }

        break;
      }

      if (
        data.results.some(
          (job) =>
            !job ||
            typeof job.uuid !== "string" ||
            !job.uuid.trim()
        )
      ) {
        throw new Error("A job is missing its UUID.");
      }

      const signature = data.results
        .map((job) => job.uuid)
        .join(",");

      if (signature === previousSignature) {
        throw new Error("The API repeated the previous page.");
      }

      previousSignature = signature;

      const selectedJobs = [];

      for (const job of data.results) {
        if (
          typeof job.title !== "string" ||
          !titlePattern.test(job.title) ||
          !isUnexpired(job) ||
          savedIds.has(job.uuid)
        ) {
          continue;
        }

        savedIds.add(job.uuid);
        selectedJobs.push(job);

        if (savedIds.size >= MAX_JOBS) {
          break;
        }
      }

      if (selectedJobs.length > 0) {
        await jobs.bulkWrite(
          selectedJobs.map((job) => ({
            updateOne: {
              filter: {
                generation,
                uuid: job.uuid,
              },

              update: {
                $set: {
                  generation,
                  uuid: job.uuid,
                  createdAt: startedAt,
                  job: compactJob(job),
                },
              },

              upsert: true,
            },
          })),
          { ordered: false }
        );
      }

      console.log(
        `[Jobs sync] Source page ${page + 1}: ` +
        `${savedIds.size} internship jobs stored.`
      );

      if (
        savedIds.size >= MAX_JOBS ||
        (page + 1) * LIMIT >= data.total
      ) {
        break;
      }

      page += 1;

      await wait(5000);
    }

    const count = await jobs.countDocuments({ generation });

    if (count === 0) {
      throw new Error(
        "No internship jobs were collected. " +
        "The previous dataset has been kept."
      );
    }

    if (count !== savedIds.size || count > MAX_JOBS) {
      throw new Error("Stored internship count is inconsistent.");
    }

    await prepareJobGeneration(generation);

    await state.updateOne(
      { _id: "active" },
      {
        $set: {
          generation,
          updatedAt: new Date().toISOString(),
          count,
          searchVersion: 2,
        },
      },
      { upsert: true }
    );

    console.log(
      `[Jobs sync] Published ${count} internship jobs.`
    );
  } catch (error) {
    // Clean up this failed run only if it was not published.
    // If publication status cannot be checked, leave it untouched.
    try {
      const active = await state.findOne({ _id: "active" });

      if (active?.generation !== generation) {
        await jobs.deleteMany({ generation });
      }
    } catch {
      console.warn(
        "[Jobs sync] Could not clean up the unfinished dataset."
      );
    }

    throw error;
  }

  // Allow requests using the previous generation time to finish.
  await wait(60000);

  try {
    const active = await state.findOne({ _id: "active" });

    if (active?.generation === generation) {
      const result = await jobs.deleteMany({
        generation: {
          $exists: true,
          $ne: generation,
        },
      });

      console.log(
        `[Jobs sync] Removed ${result.deletedCount} old job records.`
      );
    }
  } catch {
    console.warn(
      "[Jobs sync] Old dataset cleanup failed. " +
      "The published internships remain available."
    );
  }
}