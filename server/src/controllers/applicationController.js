import {
    getApplicationsByUser,
    createApplication,
    findDuplicateApplication,
    updateApplicationStatusById,
    updateApplicationInterviewDateById,
    updateApplicationFavouriteById,
    addApplicationTaskById,
    updateApplicationTaskById,
    deleteApplicationTaskById,
    deleteApplicationById,
    getApplicationByIdAndUser
} from "../models/Application.js";
import { toCard } from "../models/Application.js";
import { jobFromMcf, jobFromForm } from "../models/McfJobs.js";
import { fetchJobDetail } from "../routes/jobs.js";
import * as User from "../models/User.js";
import Application from "../models/Application.js";

// Get All Apps By Uid
export async function getApplications (req, res, next) {
    try {
        const uid = req.session.user.id;
        const applications = await getApplicationsByUser(uid);
        const user = await User.retrieveUserById(uid);

        // get user's skills
        let skills = [];
        if (user && user.skills) {
            user.skills.forEach(skill => {
                skills.push(skill.toLowerCase());
            });
        }

        // format each application card's attributes to return into json format
        let cards = [];
        applications.forEach(app => {
            cards.push(toCard(app, skills));
        });

        return res.json(cards);
        
    } catch (err) {
        console.log("Err at get apps controller: " + err);
        next(err);
    }
}

// Get one application by id, used to prefill Skill Gap Analysis from a saved job
export async function getApplicationById(req, res, next) {
    try {
        const uid = req.session.user.id;
        const application = await getApplicationByIdAndUser(req.params.id, uid);

        if (!application) return res.status(404).json({ error: 'Application not found' });
        return res.json(application);

    } catch (err) {
        console.log("Err at get application by id controller: " + err);
        next(err);
    }
}

// Add Application either 1. from MCF or 2. Manual Self-Source

export async function addApplication(req, res, next) {
    try {
        const uid = req.session.user.id;
        const job = req.body.job;
        let details;

        if (job) { // if from mycareersfuture
            details = jobFromMcf(job);
        } else { // if manually entered
            details = jobFromForm(req.body);
        }

        // stop duplicates, same title and company already on this user's board
        const existing = await findDuplicateApplication(uid, details.title, details.companyName);
        if (existing) {
            return res.status(409).json({ error: 'You already have this application on your board.' });
        }

        const application = await createApplication(uid, details);
        return res.status(201).json(application);

    } catch (err) {
        // same MCF job saved twice, blocked by the unique index
        if (err.code === 11000) {
            return res.status(409).json({ error: 'You already have this application on your board.' });
        }
        console.log("Err at create app controller: " + err);
        next(err);
    }
}

// Update status of application card
export async function updateStatus(req, res, next) {
    try {
        const uid = req.session.user.id;
        const status = req.body.status;
        const application = await updateApplicationStatusById(req.params.id, uid, status);

        return res.json(application);

    } catch (err) {
        console.log("Err at update status app controller: " + err);
        next(err);
    }
}

// Update interviewDate of application
export async function updateInterviewDate(req, res, next) {
    try {
        const uid = req.session.user.id;
        let interviewAt = req.body.interviewAt;
        if(!interviewAt) interviewAt = null;

        const application = await updateApplicationInterviewDateById(req.params.id, uid, interviewAt);
        return res.json(application);

    } catch (err) {
        console.log("Err at update interview date app controller: " + err);
        next(err);
    }
}

// Favourite or unfavourite an application card
export async function updateFavourite(req, res, next) {
    try {
        const uid = req.session.user.id;
        const isFavourite = req.body.isFavourite === true; // anything else counts as false
        const application = await updateApplicationFavouriteById(req.params.id, uid, isFavourite);

        if (!application) return res.status(404).json({ error: 'Application not found' });
        return res.json(application);

    } catch (err) {
        console.log("Err at update favourite app controller: " + err);
        next(err);
    }
}

// Checklist where add a task to the card
export async function addTask(req, res, next) {
    try {
        const uid = req.session.user.id;
        let text = req.body.text;
        if (typeof text !== 'string' || text.trim() === '') {
            return res.status(400).json({ error: 'Task text is required' });
        }
        text = text.trim();

        const application = await addApplicationTaskById(req.params.id, uid, text);

        if (!application) return res.status(404).json({ error: 'Application not found' });
        return res.status(201).json(application);

    } catch (err) {
        console.log("Err at add task app controller: " + err);
        next(err);
    }
}

// Checklist, tick or untick a task
export async function updateTask(req, res, next) {
    try {
        const uid = req.session.user.id;
        const done = req.body.done === true; // anything else counts as false
        const application = await updateApplicationTaskById(req.params.id, uid, req.params.taskId, done);

        if (!application) return res.status(404).json({ error: 'Task not found' });
        return res.json(application);

    } catch (err) {
        console.log("Err at update task app controller: " + err);
        next(err);
    }
}

// Checklist, remove a task
export async function deleteTask(req, res, next) {
    try {
        const uid = req.session.user.id;
        const application = await deleteApplicationTaskById(req.params.id, uid, req.params.taskId);

        if (!application) return res.status(404).json({ error: 'Application not found' });
        return res.json(application);

    } catch (err) {
        console.log("Err at delete task app controller: " + err);
        next(err);
    }
}

// delete application card from trackboard
export async function deleteSavedApplication (req, res, next) {
    try {
        const uid = req.session.user.id;
        const application = await deleteApplicationById(req.params.id, uid);
        return res.json(application);

    } catch (err) {
        console.log("Err at delete app controller: " + err);
        next(err);
    }
}

export async function getDiscoverySavedJobs(req, res, next) {
  const uid = req.session?.user?.id;

  if (!uid) {
    return res.status(401).json({
      error: "Please sign in to save jobs.",
    });
  }

  try {
    const applications = await Application.find({
      user: uid,
      mcfUuid: { $type: "string" },
    }).select("_id mcfUuid status");

    return res.json(
      applications.map((application) => ({
        applicationId: String(application._id),
        jobId: application.mcfUuid,
        status: application.status,
      }))
    );
  } catch (error) {
    next(error);
  }
}

// Create a Saved tracker card from a discovery job.
export async function saveDiscoveryJob(req, res, next) {
  const uid = req.session?.user?.id;

  if (!uid) {
    return res.status(401).json({
      error: "Please sign in to save jobs.",
    });
  }

  const job = req.body.job;

  if (
    !job ||
    typeof job.uuid !== "string" ||
    !/^[a-f0-9]{32}$/i.test(job.uuid) ||
    typeof job.title !== "string" ||
    !job.title.trim()
  ) {
    return res.status(400).json({
      error: "Invalid job information.",
    });
  }

  function savedResponse(application) {
    return {
      applicationId: String(application._id),
      jobId: application.mcfUuid,
      status: application.status,
    };
  }

  try {
    // Saving the same MCF job again should not create another card.
    const existing = await Application.findOne({
      user: uid,
      mcfUuid: job.uuid,
    });

    if (existing) {
      return res.json(savedResponse(existing));
    }

    const details = jobFromMcf(job);

    // The list card's "Save" button sends the compact job (no description) — only the
    // detail modal's job object has it. Best-effort backfill; a failure here must not
    // block saving the card (the user can paste the description in manually later).
    if (!details.description) {
      try {
        // fetchUpstream retries for ~2 minutes when MCF is down; cap the wait so Save stays snappy
        const fullJob = await Promise.race([
          fetchJobDetail(job.uuid),
          new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 8000)),
        ]);
        details.description = jobFromMcf(fullJob).description;
      } catch {
        // leave it blank
      }
    }

    if (!details.companyName) {
      details.companyName = "Company undisclosed";
    }

    // Keep the existing title/company duplicate rule.
    const duplicate = await findDuplicateApplication(
      uid,
      details.title,
      details.companyName
    );

    if (duplicate) {
      return res.status(409).json({
        error:
          "A job with this title and company is already on your tracker board.",
      });
    }

    const application = await createApplication(uid, details);

    return res.status(201).json(
      savedResponse(application)
    );
  } catch (error) {
    if (error.code === 11000) {
      try {
        const existing = await Application.findOne({
          user: uid,
          mcfUuid: job.uuid,
        });

        if (existing) {
          return res.json(savedResponse(existing));
        }
      } catch (lookupError) {
        return next(lookupError);
      }

      return res.status(409).json({
        error: "This job is already on your tracker board.",
      });
    }

    next(error);
  }
}

export async function removeDiscoverySavedJob(req, res, next) {
  const uid = req.session?.user?.id;

  if (!uid) {
    return res.status(401).json({
      error: "Please sign in to manage saved jobs.",
    });
  }

  if (!/^[a-f0-9]{32}$/i.test(req.params.jobId)) {
    return res.status(400).json({
      error: "Invalid job ID.",
    });
  }

  try {
    const removed = await Application.findOneAndDelete({
      user: uid,
      mcfUuid: req.params.jobId,
      status: "Saved",
    });

    if (removed) {
      return res.json({
        removed: true,
        jobId: req.params.jobId,
      });
    }

    const existing = await Application.findOne({
      user: uid,
      mcfUuid: req.params.jobId,
    }).select("status");

    if (existing) {
      return res.status(409).json({
        error:
          "This job has moved beyond Saved. Manage it from the tracker board.",
        status: existing.status,
      });
    }

    return res.json({
      removed: true,
      jobId: req.params.jobId,
    });
  } catch (error) {
    next(error);
  }
}