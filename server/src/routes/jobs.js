import { Router } from "express";

import {
  readFile,
  writeFile,
  mkdir,
  rename,
} from "node:fs/promises";

import { resolve, dirname } from "node:path";

const router = Router();

const upstreamUrl =
  "https://api.mycareersfuture.gov.sg/v2/jobs";

const cachePath = resolve("data/mcf-jobs-cache.json");

let snapshot = null;
let initialization = null;
let collecting = null;
let lastFailure = 0;
let collectionError = "";

let progress = {
  loaded: 0,
  expected: 0,
};

function wait(milliseconds) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

async function fetchUpstream(url) {
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(30000),
        headers: {
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        const error = new Error(
          "Job API returned HTTP " + response.status
        );

        error.retryable =
          response.status === 429 ||
          response.status >= 500;

        throw error;
      }

      return await response.json();
    } catch (error) {
      if (error.retryable === false || attempt === 3) {
        throw error;
      }

      await wait(1500 * (attempt + 1));
    }
  }
}

// Store card/filter information.
// The full description is fetched when opening a job.
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

async function collectJobs() {
  const collected = new Map();

  progress = {
    loaded: 0,
    expected: 0,
  };

  let page = 0;

  while (true) {
    const data = await fetchUpstream(
      upstreamUrl +
        "?limit=100&page=" +
        page +
        "&sortBy=new_posting_date"
    );

    if (
      !Array.isArray(data.results) ||
      !Number.isFinite(data.total)
    ) {
      throw new Error("Unexpected job API response");
    }

    progress.expected = data.total;

    for (const job of data.results) {
      if (job.uuid) {
        collected.set(job.uuid, compactJob(job));
      }
    }

    progress.loaded = collected.size;

    const hasNextPage = Boolean(
      data._links?.next?.href
    );

    if (!hasNextPage) {
      if ((page + 1) * 100 < data.total) {
        throw new Error(
          "Collection stopped before all reported pages were read"
        );
      }

      break;
    }

    if (data.results.length === 0) {
      throw new Error("An intermediate job page was empty");
    }

    page++;
    await wait(250);
  }

  const nextSnapshot = {
    updatedAt: new Date().toISOString(),
    jobs: [...collected.values()],
  };

  await mkdir(dirname(cachePath), {
    recursive: true,
  });

  await writeFile(
    cachePath + ".tmp",
    JSON.stringify(nextSnapshot)
  );

  await rename(cachePath + ".tmp", cachePath);

  snapshot = nextSnapshot;
  collectionError = "";
}

async function initializeCache() {
  try {
    const saved = JSON.parse(
      await readFile(cachePath, "utf8")
    );

    if (
      Array.isArray(saved.jobs) &&
      Number.isFinite(Date.parse(saved.updatedAt))
    ) {
      snapshot = saved;
    }
  } catch {
    // First run, or no usable cache.
  }
}

export async function prepareSnapshot() {
  if (!initialization) {
    initialization = initializeCache();
  }

  await initialization;

  const needsRefresh =
    !snapshot ||
    Date.now() - Date.parse(snapshot.updatedAt) >
      60 * 60 * 1000;

  if (
    needsRefresh &&
    !collecting &&
    Date.now() - lastFailure > 60000
  ) {
    collecting = collectJobs()
      .catch((error) => {
        collectionError = error.message;
        lastFailure = Date.now();

        console.error(
          "[Job collection]",
          error.message
        );
      })
      .finally(() => {
        collecting = null;
      });
  }
}

function normalize(value) {
  return String(value || "").trim().toLowerCase();
}

function uniqueNames(values) {
  const result = [];

  if (!Array.isArray(values)) {
    return result;
  }

  for (const value of values) {
    if (typeof value === "string") {
      const name = normalize(value);

      if (name && !result.includes(name)) {
        result.push(name);
      }
    }
  }

  return result;
}

function getSkills(job) {
  return uniqueNames(
    (job.skills || []).map((item) => item.skill)
  );
}

function getRegions(job) {
  if (job.metadata?.isHideCompanyAddress) {
    return [];
  }

  return uniqueNames(
    (job.address?.districts || []).map(
      (district) => district.region
    )
  );
}

function getCompanyName(job) {
  if (job.metadata?.isHideEmployerName) {
    return "";
  }

  return normalize(job.postedCompany?.name);
}

function getMonthlyPay(job) {
  if (
    job.metadata?.isHideSalary ||
    job.salary?.type?.salaryType !== "Monthly"
  ) {
    return null;
  }

  const minimum = Number(job.salary.minimum);
  const maximum = Number(job.salary.maximum);

  if (
    !Number.isFinite(minimum) ||
    !Number.isFinite(maximum) ||
    minimum <= 0 ||
    maximum < minimum
  ) {
    return null;
  }

  return { minimum, maximum };
}

function getClosingTime(job) {
  const value = job.metadata?.expiryDate;

  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  const time = Date.parse(value);

  return Number.isFinite(time) ? time : null;
}

// Missing values go last in either direction.
function compareValues(first, second, direction = 1) {
  if (first === null && second === null) return 0;
  if (first === null) return 1;
  if (second === null) return -1;

  if (typeof first === "string") {
    return first.localeCompare(second) * direction;
  }

  return (first - second) * direction;
}

function readAmount(value) {
  if (
    value === undefined ||
    value === null ||
    String(value).trim() === ""
  ) {
    return null;
  }

  return Number(value);
}

function searchSnapshot(input) {
  const selectedSkills = uniqueNames(input.skills);
  const resumeSkills = uniqueNames(input.resumeSkills);

  const keyword = normalize(input.search);
  const minimumPay = readAmount(input.minSalary);
  const maximumPay = readAmount(input.maxSalary);

  if (
    (
      minimumPay !== null &&
      (!Number.isFinite(minimumPay) || minimumPay < 0)
    ) ||
    (
      maximumPay !== null &&
      (!Number.isFinite(maximumPay) || maximumPay < 0)
    ) ||
    (
      minimumPay !== null &&
      maximumPay !== null &&
      minimumPay > maximumPay
    )
  ) {
    const error = new Error("Invalid monthly pay range");
    error.status = 400;
    throw error;
  }

  // Search the collected snapshot, not a single API page.
  const keywordJobs = snapshot.jobs.filter((job) => {
    const street = job.metadata?.isHideCompanyAddress
      ? ""
      : job.address?.street;

    const text = [
      job.title,
      getCompanyName(job),
      street,
      ...getSkills(job),
      ...getRegions(job),
      ...(job.categories || []).map(
        (item) => item.category
      ),
    ]
      .map(normalize)
      .join(" ");

    return !keyword || text.includes(keyword);
  });

  // Provide options from all keyword results.
  const regions = new Set();
  const categories = new Set();
  const skills = new Set();

  for (const job of keywordJobs) {
    if (!job.metadata?.isHideCompanyAddress) {
      for (const district of job.address?.districts || []) {
        if (district.region) {
          regions.add(district.region);
        }
      }
    }

    for (const category of job.categories || []) {
      if (category.category) {
        categories.add(category.category);
      }
    }

    for (const skill of job.skills || []) {
      if (skill.skill) {
        skills.add(skill.skill);
      }
    }
  }

  const matches = [];

  for (const job of keywordJobs) {
    const availableSkills = getSkills(job);

    const selectedCount = selectedSkills.filter(
      (skill) => availableSkills.includes(skill)
    ).length;

    // At least one selected skill must match.
    if (
      selectedSkills.length > 0 &&
      selectedCount === 0
    ) {
      continue;
    }

    if (
      input.location &&
      !getRegions(job).includes(normalize(input.location))
    ) {
      continue;
    }

    if (
      input.category &&
      !(job.categories || []).some(
        (item) =>
          normalize(item.category) ===
          normalize(input.category)
      )
    ) {
      continue;
    }

    const pay = getMonthlyPay(job);

    if (minimumPay !== null || maximumPay !== null) {
      if (!pay) continue;

      if (
        minimumPay !== null &&
        pay.maximum < minimumPay
      ) {
        continue;
      }

      if (
        maximumPay !== null &&
        pay.minimum > maximumPay
      ) {
        continue;
      }
    }

    const resumeCount = resumeSkills.filter(
      (skill) => availableSkills.includes(skill)
    ).length;

    const percentage =
      resumeSkills.length > 0 &&
      availableSkills.length > 0
        ? Math.round(
            resumeCount / availableSkills.length * 100
          )
        : null;

    matches.push({
      job,
      selectedCount,
      resumeCount,
      percentage,
      pay,
    });
  }

  matches.sort((first, second) => {
    // Selected-skill count is the first ranking rule.
    if (selectedSkills.length > 0) {
      const difference =
        second.selectedCount - first.selectedCount;

      if (difference !== 0) return difference;
    }

    let comparison = 0;

    switch (input.sortBy) {
      case "closing-earliest":
        comparison = compareValues(
          getClosingTime(first.job),
          getClosingTime(second.job)
        );
        break;

      case "closing-latest":
        comparison = compareValues(
          getClosingTime(first.job),
          getClosingTime(second.job),
          -1
        );
        break;

      case "pay-highest":
        comparison = compareValues(
          first.pay?.maximum ?? null,
          second.pay?.maximum ?? null,
          -1
        );
        break;

      case "pay-lowest":
        comparison = compareValues(
          first.pay?.maximum ?? null,
          second.pay?.maximum ?? null
        );
        break;

      case "company-az":
        comparison = compareValues(
          getCompanyName(first.job) || null,
          getCompanyName(second.job) || null
        );
        break;

      case "company-za":
        comparison = compareValues(
          getCompanyName(first.job) || null,
          getCompanyName(second.job) || null,
          -1
        );
        break;
    }

    if (comparison !== 0) return comparison;

    return (
      (second.percentage ?? -1) -
        (first.percentage ?? -1) ||
      second.resumeCount - first.resumeCount ||
      String(
        second.job.metadata?.newPostingDate || ""
      ).localeCompare(
        String(first.job.metadata?.newPostingDate || "")
      ) ||
      first.job.uuid.localeCompare(second.job.uuid)
    );
  });

  // Only divide into pages AFTER filtering and sorting.
  const limit = Math.max(
    1,
    Math.min(100, Math.floor(Number(input.limit) || 10))
  );

  const total = matches.length;
  const totalPages = Math.ceil(total / limit);

  const requestedPage = Math.max(
    0,
    Math.floor(Number(input.page) || 0)
  );

  const page = Math.min(
    requestedPage,
    Math.max(0, totalPages - 1)
  );

  return {
    results: matches
      .slice(page * limit, (page + 1) * limit)
      .map((item) => item.job),

    total,
    totalPages,
    page,

    filterOptionsJobs: [
      {
        address: {
          districts: [...regions]
            .sort()
            .map((region) => ({ region })),
        },

        categories: [...categories]
          .sort()
          .map((category) => ({ category })),

        skills: [...skills]
          .sort()
          .map((skill) => ({ skill })),
      },
    ],

    updatedAt: snapshot.updatedAt,
  };
}

router.post("/search", async (req, res) => {
  res.set("Cache-Control", "no-store");

  try {
    await prepareSnapshot();

    if (!snapshot) {
      if (!collecting && collectionError) {
        return res.status(503).json({
          error:
            "Job collection failed. Retry after one minute.",
        });
      }

      return res.status(202).json({
        status: "collecting",
        loaded: progress.loaded,
        expected: progress.expected,
      });
    }

    return res.json(
      searchSnapshot(req.body || {})
    );
  } catch (error) {
    return res.status(error.status || 502).json({
      error:
        error.status === 400
          ? error.message
          : "Could not search job listings.",
    });
  }
});

export async function fetchJobDetail(uuid) {
  return fetchUpstream(upstreamUrl + "/" + uuid);
}

router.get("/:id", async (req, res) => {
  if (!/^[a-f0-9]{32}$/i.test(req.params.id)) {
    return res.status(400).json({
      error: "Invalid job ID",
    });
  }

  try {
    const job = await fetchJobDetail(req.params.id);

    return res.json(job);
  } catch {
    return res.status(502).json({
      error: "Could not retrieve job details.",
    });
  }
});

export default router;