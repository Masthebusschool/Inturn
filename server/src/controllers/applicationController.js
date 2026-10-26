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
    deleteApplicationById
} from "../models/Application.js";
import { toCard } from "../models/Application.js";
import { jobFromMcf, jobFromForm } from "../models/McfJobs.js";
import * as User from "../models/User.js";

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