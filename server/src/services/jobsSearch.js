import mongoose from "mongoose";

export const SEARCH_VERSION = 2;

function database() {
  if (mongoose.connection.readyState !== 1) {
    throw new Error("MongoDB is not connected.");
  }

  return mongoose.connection.db;
}

function normalize(value) {
  return String(value ?? "").trim().toLowerCase();
}

function uniqueNames(values) {
  return [
    ...new Set(
      (Array.isArray(values) ? values : [])
        .filter((value) => typeof value === "string").map(normalize).filter(Boolean)
    ),
  ];
}

function text(expression) {
  return {
    $convert: {
      input: expression,
      to: "string",
      onError: "",
      onNull: "",
    },
  };
}

function lower(expression) {
  return {
    $toLower: {
      $trim: {
        input: text(expression),
      },
    },
  };
}

function number(expression) {
  return {
    $convert: {
      input: expression,
      to: "double",
      onError: null,
      onNull: null,
    },
  };
}

function names(array, field) {
  return {
    $setUnion: [
      {
        $filter: {
          input: {
            $map: {
              input: { $ifNull: [array, []] },
              as: "item",
              in: lower(`$$item.${field}`),
            },
          },
          as: "name",
          cond: { $ne: ["$$name", ""] },
        },
      },
      [],
    ],
  };
}

function join(parts) {
  return {
    $reduce: {
      input: parts,
      initialValue: "",
      in: {
        $concat: [
          "$$value",
          {
            $cond: [
              { $eq: ["$$value", ""] },
              "",
              " ",
            ],
          },
          "$$this",
        ],
      },
    },
  };
}

export async function prepareJobGeneration(generation) {
  const jobs = database().collection("mcf_job_snapshots");

  console.log("[Jobs search] Preparing compact search fields.");

  await jobs.updateMany(
    {
      generation,
      "search.v": { $ne: SEARCH_VERSION },
    },
    [
      {
        $set: {
          search: {
            skills: names("$job.skills", "skill"),

            closingDate: {
              $convert: {
                input: "$job.metadata.expiryDate",
                to: "date",
                onError: null,
                onNull: null,
              },
            },

            payMin: number("$job.salary.minimum"),
            payMax: number("$job.salary.maximum"),
          },
        },
      },

      {
        $set: {
          "search.payValid": {
            $and: [
              {
                $ne: [
                  {
                    $ifNull: [
                      "$job.metadata.isHideSalary",
                      false,
                    ],
                  },
                  true,
                ],
              },
              {
                $eq: [
                  "$job.salary.type.salaryType",
                  "Monthly",
                ],
              },
              { $ne: ["$search.payMin", null] },
              { $ne: ["$search.payMax", null] },
              { $gt: ["$search.payMin", 0] },
              {
                $gte: [
                  "$search.payMax",
                  "$search.payMin",
                ],
              },
            ],
          },

          "search.closingDay": {
            $dateToString: {
              date: "$search.closingDate",
              format: "%Y-%m-%d",
              timezone: "Asia/Singapore",
              onNull: null,
            },
          },
        },
      },

      {
        $set: {
          "search.payMin": {
            $cond: [
              "$search.payValid",
              "$search.payMin",
              null,
            ],
          },

          "search.payMax": {
            $cond: [
              "$search.payValid",
              "$search.payMax",
              null,
            ],
          },

          "search.v": SEARCH_VERSION,
        },
      },
    ]
  );

  await jobs.createIndex(
    { generation: 1, uuid: 1 },
    { unique: true }
  );

  console.log("[Jobs search] Compact search fields ready.");
}

export async function preparePublishedJobSearch() {
  const db = database();

  const state = db.collection("mcf_sync_state");
  const jobs = db.collection("mcf_job_snapshots");

  const active = await state.findOne({ _id: "active" });

  if (!active) {
    throw new Error(
      "No published collection exists. Complete a sync first."
    );
  }

  if (active.searchVersion !== SEARCH_VERSION) {
    // Prevent searches using a partially migrated dataset.
    const marked = await state.updateOne(
      {
        _id: "active",
        generation: active.generation,
      },
      {
        $unset: {
          searchVersion: "",
        },
      }
    );

    if (marked.matchedCount !== 1) {
      throw new Error(
        "The active collection changed. Stop and retry preparation."
      );
    }

    console.log("[Jobs search] Removing old search indexes.");

    const indexes = await jobs.listIndexes().toArray();

    for (const index of indexes) {
      const isOldSearchIndex = Object.keys(
        index.key || {}
      ).some((field) => field.startsWith("search."));

      if (isOldSearchIndex) {
        await jobs.dropIndex(index.name);
      }
    }

    console.log("[Jobs search] Removing duplicate search fields.");

    await jobs.updateMany(
      { generation: active.generation },
      {
        $unset: {
          search: "",
        },
      }
    );
  }

  await prepareJobGeneration(active.generation);

  const result = await state.updateOne(
    {
      _id: "active",
      generation: active.generation,
    },
    {
      $set: {
        searchVersion: SEARCH_VERSION,
      },
    }
  );

  if (result.matchedCount !== 1) {
    throw new Error(
      "The active collection changed. Run preparation again."
    );
  }

  console.log("[Jobs search] Existing jobs are ready to search.");
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

function badRequest(message) {
  const error = new Error(message);
  error.status = 400;
  return error;
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Temp storage for filter suggestions, not the full jobs dataset.
const optionCache = new Map();

async function getFilterOptions(jobs, query, cacheKey) {
  const existing = optionCache.get(cacheKey);

  if (existing && existing.expiresAt > Date.now()) {
    return existing.promise;
  }

  const promise = (async () => {
    const options = { maxTimeMS: 30000 };

    const [categories, skills] = await Promise.all([
      jobs.distinct(
        "job.categories.category",
        query,
        options
      ),
      jobs.distinct(
        "job.skills.skill",
        query,
        options
      ),
    ]);

    return [
      {
        categories: categories
          .filter((value) => typeof value === "string")
          .sort()
          .map((category) => ({ category })),

        skills: skills
          .filter((value) => typeof value === "string")
          .sort()
          .map((skill) => ({ skill })),
      },
    ];
  })();

  // Keep the cache bounded.
  if (optionCache.size >= 20) {
    optionCache.delete(optionCache.keys().next().value);
  }

  const entry = {
    promise,
    expiresAt: Date.now() + 5 * 60 * 1000,
  };

  optionCache.set(cacheKey, entry);

  try {
    return await promise;
  } catch (error) {
    if (optionCache.get(cacheKey) === entry) {
      optionCache.delete(cacheKey);
    }

    throw error;
  }
}

export async function searchPublishedJobs(input = {}) {
  const db = database();
  const jobs = db.collection("mcf_job_snapshots");

  const active = await db
    .collection("mcf_sync_state")
    .findOne({ _id: "active" });

  if (!active) {
    const error = new Error(
      "No completed jobs collection is available."
    );
    error.status = 503;
    throw error;
  }

  if (active.searchVersion !== SEARCH_VERSION) {
    const error = new Error(
      "Job search needs one-time preparation. " +
      "Run the prepare-search command."
    );
    error.status = 503;
    throw error;
  }

  const keyword = normalize(input.search);
  const selected = uniqueNames(input.skills);
  const resume = uniqueNames(input.resumeSkills);

  if (keyword.length > 200) {
    throw badRequest("Search text is too long.");
  }

  if (selected.length > 100 || resume.length > 500) {
    throw badRequest("Too many skills were supplied.");
  }

  const minimum = readAmount(input.minSalary);
  const maximum = readAmount(input.maxSalary);

  if (
    (
      minimum !== null &&
      (!Number.isFinite(minimum) || minimum < 0)
    ) ||
    (
      maximum !== null &&
      (!Number.isFinite(maximum) || maximum < 0)
    ) ||
    (
      minimum !== null &&
      maximum !== null &&
      minimum > maximum
    )
  ) {
    throw badRequest("Invalid monthly pay range.");
  }

  const today = new Date(
    Date.now() + 8 * 60 * 60 * 1000
  ).toISOString().slice(0, 10);

  const keywordQuery = {
    generation: active.generation,
    "search.v": SEARCH_VERSION,

    "job.title": {
      $regex: "\\bintern(?:s|ship|ships)?\\b",
      $options: "i",
    },

    $or: [
      { "search.closingDay": null },
      { "search.closingDay": { $gte: today } },
    ],
  };

  if (keyword) {
    const searchableText = join({
      $concatArrays: [
        [
          lower("$job.title"),
          {
            $cond: [
              "$job.metadata.isHideEmployerName",
              "",
              lower("$job.postedCompany.name"),
            ],
          },
          {
            $cond: [
              "$job.metadata.isHideCompanyAddress",
              "",
              lower("$job.address.street"),
            ],
          },
        ],
        "$search.skills",
        {
          $cond: [
            "$job.metadata.isHideCompanyAddress",
            [],
            names("$job.address.districts", "region"),
          ],
        },

        names("$job.categories", "category"),
      ],
    });

    keywordQuery.$expr = {
      $regexMatch: {
        input: searchableText,
        regex: { $literal: escapeRegex(keyword) },
      },
    };
  }

  const query = { ...keywordQuery };

  if (selected.length > 0) {
    query["search.skills"] = { $in: selected };
  }

  if (input.location) {
    query["job.metadata.isHideCompanyAddress"] = {
      $ne: true,
    };

    query["job.address.districts.region"] = {
      $regex:"^\\s*" + escapeRegex(normalize(input.location)) + "\\s*$", $options: "i",
    };
  }

  if (input.category) {
    query["job.categories.category"] = {
      $regex: "^\\s*" + escapeRegex(normalize(input.category)) + "\\s*$", $options: "i",
    };
  }

  if (minimum !== null || maximum !== null) {
    query["search.payValid"] = true;

    if (minimum !== null) {
      query["search.payMax"] = { $gte: minimum };
    }

    if (maximum !== null) {
      query["search.payMin"] = { $lte: maximum };
    }
  }

  const requestedLimit = Number(input.limit);
  const limit = Number.isFinite(requestedLimit)
    ? Math.max(1, Math.min(100, Math.floor(requestedLimit || 10))) : 10;

  const requestedPage = Number(input.page);
  const wantedPage = Number.isFinite(requestedPage) ? Math.max(0, Math.floor(requestedPage)) : 0;

  const optionsKey = JSON.stringify([active.generation, today, keyword]);

  const [total, filterOptionsJobs] = await Promise.all([
    jobs.countDocuments(query, {
      maxTimeMS: 30000,
    }),

    getFilterOptions(jobs, keywordQuery, optionsKey),
  ]);

  const totalPages = Math.ceil(total / limit);
  const page = Math.min(wantedPage, Math.max(0, totalPages - 1));

  if (total === 0) {
    return {
      results: [],
      total,
      totalPages,
      page,
      filterOptionsJobs,
      updatedAt: active.updatedAt,
    };
  }

  const sort = {};

  if (selected.length > 0) {
    sort.selectedCount = -1;
  }

  switch (input.sortBy) {
    case "closing-earliest":
      sort["search.closingMissing"] = 1;
      sort["search.closingDate"] = 1;
      break;

    case "closing-latest":
      sort["search.closingMissing"] = 1;
      sort["search.closingDate"] = -1;
      break;

    case "pay-highest":
      sort["search.payMissing"] = 1;
      sort["search.payMax"] = -1;
      break;

    case "pay-lowest":
      sort["search.payMissing"] = 1;
      sort["search.payMax"] = 1;
      break;

    case "company-az":
      sort["search.companyMissing"] = 1;
      sort["search.company"] = 1;
      break;

    case "company-za":
      sort["search.companyMissing"] = 1;
      sort["search.company"] = -1;
      break;
  }

  sort.percentage = -1;
  sort.resumeCount = -1;
  sort["search.posted"] = -1;
  sort.uuid = 1;

  const documents = await jobs.aggregate(
    [
      { $match: query },
      {
        $set: {
          "search.company": {
            $cond: [
              "$job.metadata.isHideEmployerName",
              "",
              lower("$job.postedCompany.name"),
            ],
          },

          "search.posted": text(
            "$job.metadata.newPostingDate"
          ),

          "search.payMissing": {
            $cond: ["$search.payValid", 0, 1],
          },

          "search.closingMissing": {
            $cond: [
              { $eq: ["$search.closingDate", null] },
              1,
              0,
            ],
          },
        },
      },

      {
        $set: {
          "search.companyMissing": {
            $cond: [
              { $eq: ["$search.company", ""] },
              1,
              0,
            ],
          },
        },
      },
      {
        $set: {
          selectedCount: {
            $size: {
              $setIntersection: [
                "$search.skills",
                { $literal: selected },
              ],
            },
          },

          resumeCount: {
            $size: {
              $setIntersection: [
                "$search.skills",
                { $literal: resume },
              ],
            },
          },
        },
      },

      {
        $set: {
          percentage: {
            $cond: [
              {
                $and: [
                  { $gt: [{ $size: "$search.skills" }, 0] },
                  { $gt: [{ $literal: resume.length }, 0] },
                ],
              },

              // Same rounding as Math.round for positive percentages.
              {
                $floor: {
                  $add: [
                    {
                      $multiply: [
                        {
                          $divide: [
                            "$resumeCount",
                            { $size: "$search.skills" },
                          ],
                        },
                        100,
                      ],
                    },
                    0.5,
                  ],
                },
              },

              -1,
            ],
          },
        },
      },

      { $sort: sort },
      { $skip: page * limit },
      { $limit: limit },

      {
        $project: {
          _id: 0,
          job: 1,
        },
      },
    ],
    {
      allowDiskUse: true,
      maxTimeMS: 30000,
    }
  ).toArray();

  return {
    results: documents.map((document) => document.job),
    total,
    totalPages,
    page,
    filterOptionsJobs,
    updatedAt: active.updatedAt,
  };
}