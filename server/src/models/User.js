import mongoose from 'mongoose';
import Shortlist from './Shortlist.js';
import SkillGapResult from './SkillGapResult.js';
import IntelPost from './IntelPost.js';
import Resume from './Resume.js';
import LearningTask from './LearningTask.js';
import Application from './Application.js';

// Inturn targets polytechnic and university students. Keep in sync with
// EDUCATION_LEVELS in client/src/utils/profileOptions.js.
export const EDUCATION_LEVELS = ['Polytechnic', 'Undergraduate', 'Postgraduate', 'PhD'];

// Default starter questions for a new user's Interview Journal
const DEFAULT_QUESTIONS = [
  {
    sourceId: 'default-1',
    category: 'Technical',
    company: '',
    text: 'Explain a full-stack feature you built and how you implemented it.',
    tip: 'Outline how you plan before coding, and give one real example.',
    savedResponse: '',
    savedAt: '',
  },
  {
    sourceId: 'default-2',
    category: 'Collaboration',
    company: '',
    text: 'Tell me about a disagreement with a teammate over a technical approach.',
    tip: 'Focus on how you listened, compromised and what the outcome was.',
    savedResponse: '',
    savedAt: '',
  },
  {
    sourceId: 'default-3',
    category: 'Problem Solving',
    company: '',
    text: 'Describe a difficult bug you encountered and how you diagnosed and fixed it.',
    tip: 'Walk through your debugging process, the tools you used, and what you learned from it.',
    savedResponse: '',
    savedAt: '',
  },
];

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

    // Set on each successful login; older accounts simply lack it until they next log in.
    lastLoginAt: Date,

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
    targetIndustries: {
      type: [{ type: String, trim: true, minLength: 1, maxLength: [50, 'Each industry must not exceed 50 characters'] }],
      validate: [(arr) => arr.length <= 10, 'You can add at most 10 industries'],
    },
    // Skills, work experience, projects and summaries live on each Resume, not here
    // (target industries are the exception: they stay on the account).
    // utils/profile.js toProfile() reads the user's primary resume (see utils/primaryResume.js).

   // Mock Interview Journal questions & saved reflections
    journalQuestions: {
      type: [
        {
          sourceId: { type: String, default: '', maxLength: 100},
          category: { type: String, default: 'General', trim: true, maxLength: 50 },
          company: { type: String, default: '', trim: true, maxLength: 80 },
          text: { type: String, required: true, trim: true, maxLength: 500 },
          tip: { type: String, default: '', trim: true, maxLength: 500 },
          savedResponse: { type: String, default: '', maxLength: 4000 },
          savedAt: { type: String, default: '' },
        },
      ],
      default: () => DEFAULT_QUESTIONS,
    },
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
    targetIndustries: user.targetIndustries ?? [],
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

export function recordLogin(userId) {
  return User.updateOne({ _id: userId }, { $set: { lastLoginAt: new Date() } });
}

export async function deleteUser(userId) {
  // Cascade delete: private data belongs only to this user
  await Shortlist.deleteMany({ user: userId });
  await SkillGapResult.deleteMany({ user: userId });
  await Resume.deleteMany({ user: userId });
  await LearningTask.deleteMany({ user: userId });
  await Application.deleteMany({ user: userId });
  await IntelPost.updateMany({ author: userId }, { author: null });  // Keep community intel posts, but detach them from the deleted user
  await IntelPost.updateMany(
    { upvotedBy: userId },
    { $pull: { upvotedBy: userId }, $inc: { upvotes: -1 } }
  );
  return User.findByIdAndDelete(userId);
}
