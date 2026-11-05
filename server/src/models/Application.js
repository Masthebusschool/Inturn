import mongoose from "mongoose";
import { STATUS, STATUSES } from "./constants/statuses.js";
import { MAX_TASKS } from "./constants/applications.js";

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
        description: { type: String }, // full job description text, snapshotted at save time so Skill Gap Analysis has real text to score

        status: { type: String, enum: STATUSES, default: STATUS.SAVED },
        appliedDate: { type: Date }, // opt
        interviewAt: { type: Date, default: null }, // opt
        isFavourite: { type: Boolean, required: true, default: false },
        skillGapResultId: { type: mongoose.Schema.Types.ObjectId, ref: 'SkillGapResult', default: null }, // set once a Skill Gap Analysis is linked to this card

        tasks: { type: [taskSchema], default:[] }, // empty checklist at start
    },
    { timestamps: true }
);

// ensures user cannot save the same job twice
// partialFilterExp -> stops dupe MCF jobs and lets students add self-sourced jobs
applicationSchema.index(
    { user: 1, mcfUuid: 1 },
    { unique: true, partialFilterExpression: { mcfUuid: { $type: 'string' }}}
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

    // get skills matched count and missing
    let skillsMatched = 0;
    let skillsMissing = [];
    application.skills.forEach(skill => {
        if(skills.includes(skill.toLowerCase())) skillsMatched++;
        else skillsMissing.push(skill);
    });

    // Populated analysis (not a bare ObjectId, which has _bsontype): its gaps are more accurate than the keyword heuristic.
    const link = application.skillGapResultId;
    const gap = link && typeof link === 'object' && !link._bsontype ? link : null;
    const gapMissing = gap ? (gap.draftScore?.missingSkills ?? gap.missingSkills ?? []) : null;

    // add to application cards list
    let card = {
        _id: application._id,
        title: application.title,
        company: application.companyName,
        status: application.status,
        expiryDate: application.expiryDate,
        appliedDate: application.appliedDate,
        interviewAt: application.interviewAt,
        isFavourite: application.isFavourite,
        tasks: application.tasks, // [{ _id, text, done }] for the checklist modal
        prep: `${completedTasks} / ${application.tasks.length}`,
        matched: skillsMatched,
        missing: gapMissing ?? skillsMissing,
        total: application.skills.length,
        skills: application.skills, // prefills the edit form
        jobDetailsUrl: application.jobDetailsUrl, // prefills the edit form
        createdAt: application.createdAt, // for the "Latest saved" sort
        // null until a Skill Gap Analysis is linked (see skillGapResultId); populated by getApplicationsByUser.
        // Prefer the tailored draft's score, same as the Skill Gap page's history badge.
        skillGapScore: application.skillGapResultId?.draftScore?.atsScore ?? application.skillGapResultId?.atsScore ?? null,
        skillGapBand: application.skillGapResultId?.draftScore?.band ?? application.skillGapResultId?.band ?? null,
    };

    return card;
}

// db functions

// get all specified user's applications
export function getApplicationsByUser(uid) {
    return Application.find({ user: uid }).populate('skillGapResultId', 'atsScore band missingSkills draftScore.atsScore draftScore.band draftScore.missingSkills');
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
        { _id: id, user: uid }, update, { returnDocument: 'after', runValidators: true } // rv ensures enum is valid status type exist
    );
} 

// update interview date when user gets one
export function updateApplicationInterviewDateById(id, uid, interviewAt) {
    return Application.findOneAndUpdate(
        { _id: id, user: uid }, { interviewAt: interviewAt }, { returnDocument: 'after', runValidators: true }
    );
}

// update the details typed in the edit form
export function updateApplicationDetailsById(id, uid, details) {
    return Application.findOneAndUpdate(
        { _id: id, user: uid }, details, { returnDocument: 'after', runValidators: true }
    );
}

// find a card with the same title + company for this user (strength 2 = ignores capitals)
export function findDuplicateApplication(userId, title, companyName) {
    return Application.findOne({ user: userId, title: title, companyName: companyName })
        .collation({ locale: 'en', strength: 2 });
}

// get one application owned by this user, used to prefill Skill Gap Analysis from a saved job
export function getApplicationByIdAndUser(id, uid) {
    if (!mongoose.isValidObjectId(id)) return null;
    return Application.findOne({ _id: id, user: uid });
}

// favourite or unfavourite a card
export function updateApplicationFavouriteById(id, userId, isFavourite) {
    return Application.findOneAndUpdate({ _id: id, user: userId }, { isFavourite: isFavourite }, { returnDocument: 'after', runValidators: true });
}

// add a (note checklist) to the card's checklist
// only matches while the card has fewer than MAX_TASKS tasks (no task at index MAX_TASKS - 1),
// so quick adds at the same time still can't go over the limit
export function addApplicationTaskById(id, userId, text) {
    return Application.findOneAndUpdate(
        { _id: id, user: userId, [`tasks.${MAX_TASKS - 1}`]: { $exists: false } },
        { $push: { tasks: { text: text } } },
        { returnDocument: 'after', runValidators: true }
    );
}

// tick or untick one task ('tasks.$' is the task that matched tasks._id)
export function updateApplicationTaskById(id, userId, taskId, done) {
    return Application.findOneAndUpdate({ _id: id, user: userId, 'tasks._id': taskId }, { $set: { 'tasks.$.done': done } }, { returnDocument: 'after', runValidators: true });
}

// remove one task from the checklist
export function deleteApplicationTaskById(id, userId, taskId) {
    return Application.findOneAndUpdate({ _id: id, user: userId }, { $pull: { tasks: { _id: taskId } } }, { returnDocument: 'after' });
}

// delete application from trackboard
export function deleteApplicationById(id, uid) {
    return Application.findOneAndDelete({ _id: id, user: uid });
}

export default Application;