import mongoose from 'mongoose';

const sourceSchema = new mongoose.Schema(
  {
    skillGapResult: { type: mongoose.Schema.Types.ObjectId, ref: 'SkillGapResult' },
    job: { title: String, company: String },
    verdict: String,
    deadline: Date,
  },
  { _id: false }
);

const learningTaskSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    skillKey: { type: String, required: true }, // canonical() form, the dedupe key
    skillText: String, // human label from the first analysis that surfaced it
    status: { type: String, enum: ['pending', 'done'], default: 'pending' },
    // Earliest known source deadline. NO default: the sync's $min relies on the field being
    // absent (not null) when open-ended, because BSON null sorts below every date.
    deadline: Date,
    sources: [sourceSchema],
    doneAt: Date,
  },
  { timestamps: true }
);

// Also serves user-only queries (user is the prefix), so no separate user index.
learningTaskSchema.index({ user: 1, skillKey: 1 }, { unique: true });

export default mongoose.model('LearningTask', learningTaskSchema);
