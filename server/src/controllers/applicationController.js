import {
    getApplicationsByUser,
    createApplication,
    updateApplicationStatusById,
    updateApplicationInterviewDateById,
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

        const application = await createApplication(uid, details);
        return res.json(application);

    } catch (err) {
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