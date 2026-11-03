import mongoose from "mongoose";
import { randomUUID } from "node:crypto";

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

    postedCompany: job.postedCompany
      ? { name: job.postedCompany.name }
      : null,
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

export async function syncJobs() {
  const { jobs, state } = collections();

  await jobs.createIndex(
    { generation: 1, uuid: 1 },
    { unique: true }
  );

  await jobs.createIndex({ createdAt: 1 });

  const generation = randomUUID();
  const startedAt = new Date();

  let page = 0;
  let largestReportedTotal = 0;
  let previousSignature = "";

  console.log("[Jobs sync] Starting collection.");

  while (true) {
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

    largestReportedTotal = Math.max(largestReportedTotal, data.total);

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

    await jobs.bulkWrite(
      data.results.map((job) => ({
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

    console.log(
      `[Jobs sync] Page ${page + 1} stored; ` +
      `API reports ${data.total} jobs.`
    );

    if ((page + 1) * LIMIT >= data.total) {
      break;
    }

    page += 1;

    // Starting delay; the API may still rate-limit requests.
    await wait(5000);
  }

  const count = await jobs.countDocuments({ generation });

  if (
    count === 0 ||
    count < Math.ceil(largestReportedTotal * 0.98)
  ) {
    throw new Error(
      `Collection appears incomplete: ${count} unique jobs; ` +
      `largest reported total was ${largestReportedTotal}.`
    );
  }

  // Publish this generation only after collection has finished.
  // Until then, searches continue using the previous generation.
  await state.updateOne(
    { _id: "active" },
    {
      $set: {
        generation,
        updatedAt: new Date().toISOString(),
        count,
      },
    },
    { upsert: true }
  );

  console.log(`[Jobs sync] Published ${count} jobs.`);

  try {
    const active = await state.findOne({ _id: "active" });

    if (active) {
      await jobs.deleteMany({
        generation: { $ne: active.generation },
        createdAt: {
          $lt: new Date(
            Date.now() - 7 * 24 * 60 * 60 * 1000
          ),
        },
      });
    }
  } catch {
    console.warn(
      "[Jobs sync] Cleanup failed; published jobs remain available."
    );
  }
}

// Shared by requests handled by this server process.
let cachedSnapshot = null;
let checking = null;
let nextCheckAt = 0;

export async function loadPublishedSnapshot() {
  if (checking) return checking;

  if (cachedSnapshot && Date.now() < nextCheckAt) {
    return cachedSnapshot;
  }

  checking = (async () => {
    const { jobs, state } = collections();
    const active = await state.findOne({ _id: "active" });

    if (!active) {
      if (cachedSnapshot) return cachedSnapshot;

      throw new Error(
        "No completed jobs collection is available."
      );
    }

    if (cachedSnapshot?.generation !== active.generation) {
      const documents = await jobs
        .find(
          { generation: active.generation },
          { projection: { _id: 0, job: 1 } }
        )
        .toArray();

      if (documents.length !== active.count) {
        throw new Error(
          "Published jobs collection is incomplete."
        );
      }

      cachedSnapshot = {
        generation: active.generation,
        updatedAt: active.updatedAt,
        jobs: documents.map((document) => document.job),
      };
    }

    nextCheckAt = Date.now() + 60000;

    return cachedSnapshot;
  })();

  try {
    return await checking;
  } catch (error) {
    if (cachedSnapshot) {
      nextCheckAt = Date.now() + 10000;
      return cachedSnapshot;
    }

    throw error;
  } finally {
    checking = null;
  }
}