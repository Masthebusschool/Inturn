import mongoose from 'mongoose';
import Shortlist from './Shortlist.js';
import SkillGapResult from './SkillGapResult.js';
import IntelPost from './IntelPost.js';
import Resume from './Resume.js';
import LearningTask from './LearningTask.js';

// Inturn targets polytechnic and university students.
export const EDUCATION_LEVELS = ['Polytechnic', 'Undergraduate', 'Postgraduate'];

const userSchema = new mongoose.Schema(
  {
    // Account: filled at sign up
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      maxLength: [50, 'Name must not exceed 50 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/, 'Email format is invalid'],
    },
    // Hidden by default: only login reads it, via retrieveUserWithPassword().
    passwordHash: { type: String, required: true, select: false },

    // Profile: filled during onboarding, editable later
    educationLevel: {
      type: String,
      enum: { values: EDUCATION_LEVELS, message: 'Invalid education level' },
    },
    institution: {
      type: String,
      trim: true,
      maxLength: [100, 'Institution must not exceed 100 characters'],
    },
    fieldOfStudy: {
      type: String,
      trim: true,
      maxLength: [100, 'Field of study must not exceed 100 characters'],
    },
    skills: {
      type: [{ type: String, trim: true, minLength: 1, maxLength: [50, 'Each skill must not exceed 50 characters'] }],
      validate: [(arr) => arr.length <= 30, 'You can add at most 30 skills'],
    },
    targetIndustries: {
      type: [{ type: String, trim: true, minLength: 1, maxLength: [50, 'Each industry must not exceed 50 characters'] }],
      validate: [(arr) => arr.length <= 10, 'You can add at most 10 industries'],
    },
    targetRoles: [String], // From the team scaffold; not asked in the UI yet.
    resume:{
      fileName: String,
      pageCount:Number,
      wordCount:Number,
      text:String,
      uploadedAt:Date,
    },
    // Resume profile from the Skill Gap feature (Mas). Read by toProfile() in utils/profile.js;
    // no page edits these on the User yet. Dates are free text ("Jan 2024", "Present").
    summary: String,
    experience: [
      {
        title: String,
        company: String,
        startDate: String,
        endDate: String,
        current: { type: Boolean, default: false },
        bullets: [String],
        skills: [String],
      },
    ],
    projects: [{ name: String, bullets: [String], skills: [String], url: String }],
    education: [{ school: String, degree: String, field: String, startDate: String, endDate: String }],
  },
  { timestamps: true }
);

const User = mongoose.model('User', userSchema);
export default User;

// Only these fields are ever sent to the browser (never passwordHash).
export function toPublicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    educationLevel: user.educationLevel,
    institution: user.institution,
    fieldOfStudy: user.fieldOfStudy,
    skills: user.skills,
    targetIndustries: user.targetIndustries,
  };
}

export function createUser(user) {
  return User.create(user);
}

export function retrieveUserById(userId) {
  return User.findById(userId);
}

export function retrieveUser(criterias) {
  return User.findOne(criterias);
}

// Login is the only place that needs the password hash.
export function retrieveUserWithPassword(criterias) {
  return User.findOne(criterias).select('+passwordHash');
}

export function updateUser(userId, updateValues) {
  return User.findByIdAndUpdate(userId, updateValues, { returnDocument: 'after', runValidators: true });
}

export async function deleteUser(userId) {
  // Cascade delete: private data belongs only to this user
  await Shortlist.deleteMany({ user: userId });
  await SkillGapResult.deleteMany({ user: userId });
  await Resume.deleteMany({ user: userId });
  await LearningTask.deleteMany({ user: userId });
  // Keep community intel posts, but detach them from the deleted user
  await IntelPost.updateMany({ author: userId }, { author: null });
  await IntelPost.updateMany(
    { upvotedBy: userId },
    { $pull: { upvotedBy: userId }, $inc: { upvotes: -1 } }
  );
  return User.findByIdAndDelete(userId);
}
