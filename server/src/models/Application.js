import mongoose from "mongoose";
import { STATUS, STATUSES } from "./constants/statuses.js";

// One tasklist per app
const taskSchema = new mongoose.Schema(
    {
        text: { type: String, required: true },
        done: { type: Boolean, required: true, default: false },
    },
    { timestamps: true } // createdAt / UpdatedAt
)

const applicationSchema = new mongoose.Schema(
    {
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        mcfUuid: { type: String }, // MCF's id for the posting
        title: { type: String, required: true },
        companyName: { type: String, required: true },
        companyLogoUrl: { type: String }, // optional
        skills: { type: [String], default: [] }, // used for skill matching
        salaryMin: { type: Number },
        salaryMax: { type: Number },
        expiryDate: { type: Date }, // application deadline
        jobDetailsUrl: { type: String },

        status: { type: String, enum: STATUSES, default: STATUS.SAVED },
        appliedDate: { type: Date }, // opt
        interviewAt: { type: Date, default: null }, // opt
        isFavourite: { type: Boolean, required: true, default: false },

        tasks: { type: [taskSchema], default:[] }, // empty checklist at start
    },
    { timestamps: true }
);

// ensures user cannot save the same job twice
// partialFilterExp -> stops dupe MCF jobs and lets students add self-sourced jobs
applicationSchema.index(
    { user: 1, 'job.mcfluid': 1 },
    { unique: true, partialFilterExpression: { 'job.mcfUuid': { $type: 'string' }}}
);

const Application = mongoose.model('Application', applicationSchema);

// db helpers
// returns application card object
export function toCard(application, skills) {
    let completedTasks = 0;
    // get how many tasks completed count
    application.tasks.forEach(task => {
        if (task.done) completedTasks++;
    });

    // get skills matched count
    let skillsMatched = 0;
    application.skills.forEach(skill => {
        if(skills.includes(skill.toLowerCase())) skillsMatched++;
    });

    // add to application cards list
    let card = {
        _id: application._id,
        title: application.title,
        company: application.companyName,
        status: application.status,
        expiryDate: application.expiryDate,
        appliedDate: application.appliedDate,
        interviewAt: application.interviewAt,
        prep: `${completedTasks} / ${application.tasks.length}`,
        skillsMatched: skillsMatched,
        totalSkills: application.skills.length
    };

    return card;
}

// db functions

// get all specified user's applications
export function getApplicationsByUser(uid) {
    return Application.find({ user: uid});
}

// create application
export function createApplication(uid, details) {
    return Application.create({ user: uid, ...details });
}

// update status during move to another column
export function updateApplicationStatusById(id, uid, status) {
    const update = { status: status }
    if (status === STATUS.APPLIED) update.appliedDate = new Date();

    return Application.findOneAndUpdate(
        { _id: id, user: uid }, update, { after: true, runValidators: true} // rv ensures enum is valid status type exist
    );
} 

// update interview date when user gets one
export function updateApplicationInterviewDateById(id, uid, interviewAt) {
    return Application.findOneAndUpdate(
        { _id: id, user: uid }, { interviewAt: interviewAt }, { after: true, runValidators: true }
    );
}

// delete application from trackboard
export function deleteApplicationById(id, uid) {
    return Application.findOneAndDelete({ _id: id, user: uid });
}

export default Application;

