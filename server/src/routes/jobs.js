import { Router } from "express";

import { fetchMcfJson } from "../services/jobsSnapshot.js";
import { searchPublishedJobs } from "../services/jobsSearch.js";

const router = Router();

const upstreamUrl = "https://api.mycareersfuture.gov.sg/v2/jobs";

router.post("/search", async (req, res) => {
  res.set("Cache-Control", "no-store");

  const startedAt = Date.now();

  try {
    const input = req.body;

    if (
      input !== undefined && (input === null || typeof input !== "object" || Array.isArray(input))
    ) {
      return res.status(400).json({
        error: "Invalid search request.",
      });
    }

    const result = await searchPublishedJobs(input || {});

    console.log(
      `[Jobs search] ${Date.now() - startedAt} ms; ` +
      `${result.results.length} returned; ` +
      `${result.total} matches.`
    );

    return res.json(result);
  } catch (error) {
    console.error(
      "[Jobs search]",
      error.code || "",
      error.message
    );

    const status =
      error.status ||
      (error.code === 50 ? 504 : 500);

    return res.status(status).json({
      error:
        error.status === 400 ||
        error.status === 503
          ? error.message
          : error.code === 50
            ? "The database search took too long. Try a narrower search."
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