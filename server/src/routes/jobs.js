import { Router } from "express";

import {
  loadPublishedSnapshot,
  fetchMcfJson,
} from "../services/jobsSnapshot.js";

const router = Router();

const upstreamUrl =
  "https://api.mycareersfuture.gov.sg/v2/jobs";

function normalize(value) {
  return String(value || "").trim().toLowerCase();
}

function uniqueNames(values) {
  if (!Array.isArray(values)) return [];

  return [
    ...new Set(
      values
        .filter((value) => typeof value === "string")
        .map(normalize)
        .filter(Boolean)
    ),
  ];
}

function getSkills(job) {
  return uniqueNames(
    (job.skills || []).map((item) => item.skill)
  );
}

function getRegions(job) {
  if (job.metadata?.isHideCompanyAddress) return [];

  return uniqueNames(
    (job.address?.districts || []).map(
      (district) => district.region
    )
  );
}

function getCompanyName(job) {
  if (job.metadata?.isHideEmployerName) return "";

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

// Missing values remain last in both directions.
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

function searchSnapshot(input, snapshot) {
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

  // Suggestions come from all keyword results.
  const regions = new Set();
  const categories = new Set();
  const skills = new Set();

  for (const job of keywordJobs) {
    if (!job.metadata?.isHideCompanyAddress) {
      for (const district of job.address?.districts || []) {
        if (district.region) regions.add(district.region);
      }
    }

    for (const category of job.categories || []) {
      if (category.category) {
        categories.add(category.category);
      }
    }

    for (const skill of job.skills || []) {
      if (skill.skill) skills.add(skill.skill);
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
    // Selected-skill matches take priority.
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

  const requestedLimit = Number(input.limit);
  const limit = Number.isFinite(requestedLimit)
    ? Math.max(1, Math.min(100, Math.floor(requestedLimit || 10)))
    : 10;

  const total = matches.length;
  const totalPages = Math.ceil(total / limit);

  const pageNumber = Number(input.page);
  const requestedPage = Number.isFinite(pageNumber)
    ? Math.max(0, Math.floor(pageNumber))
    : 0;

  const page = Math.min(
    requestedPage,
    Math.max(0, totalPages - 1)
  );

  // Paginate only after filtering and sorting.
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

  let snapshot;

  try {
    snapshot = await loadPublishedSnapshot();
  } catch {
    console.error("[Jobs search] Dataset unavailable.");

    return res.status(503).json({
      error:
        "Job listings are temporarily unavailable. " +
        "A completed background sync is required.",
    });
  }

  try {
    return res.json(
      searchSnapshot(req.body || {}, snapshot)
    );
  } catch (error) {
    return res.status(error.status || 500).json({
      error:
        error.status === 400
          ? error.message
          : "Could not search job listings.",
    });
  }
});

export async function fetchJobDetail(uuid) {
  return fetchMcfJson(
    upstreamUrl + "/" + encodeURIComponent(uuid)
  );
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