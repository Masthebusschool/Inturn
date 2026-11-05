import mongoose from 'mongoose';

const requirementSchema = new mongoose.Schema(
  {
    key: String,
    text: String,
    tier: String,
    category: String,
    importance: String,
    alternativeGroup: String,
    isEligibility: Boolean,
    verdict: String,
    reason: String,
    evidence: String,
    weight: Number,
    mark: Number,
    earned: Number,
    override: String, // only on draft-score rows the student overrode
  },
  { _id: false }
);

const draftSchema = new mongoose.Schema(
  {
    summary: String,
    skills: [String],
    experience: [{ _id: false, title: String, company: String, bullets: [String] }],
    projects: [{ _id: false, name: String, bullets: [String] }],
  },
  { _id: false }
);

const suggestionSchema = new mongoose.Schema(
  {
    id: String, sectionId: String, field: String, original: String, text: String,
    title: String, company: String, bullets: [String], requirementKeys: [String],
  },
  { _id: false }
);

const skillGapResultSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    // Snapshot of the posting at analysis time
    job: {
      jobId: String,
      source: String,
      title: String,
      company: String,
      description: String,
      applicationDeadline: Date, 
    },
    // The live link back to the Tracker board card this analysis was started from, if any.
    // (job.jobId/job.source above already existed for this purpose but were never populated —
    // see sourceResume's "no live link back" comment for the equivalent on the resume side.)
    application: { type: mongoose.Schema.Types.ObjectId, ref: 'Application', default: null },
    atsScore: { type: Number, min: 0, max: 100 },
    band: { type: String, enum: ['strong', 'moderate', 'emerging', 'low'] },
    requirements: [requirementSchema],
    eligibility: [{ _id: false, key: String, text: String }],
    ungradedCount: { type: Number, default: 0 },
    // Profile text the verdicts were judged against — needed by the gap stability guard.
    profileSnapshot: { type: String, select: false },
    matchedSkills: [String],
    missingSkills: [String],
    recommendations: [String],
    tailoredResume: {
      summary: String,
      skills: [String],
      experience: [{ _id: false, title: String, company: String, bullets: [String] }],
      projects: [{ _id: false, name: String, bullets: [String] }],
    },
    // Traceability snapshot: which saved Resume (and which version of it) seeded this analysis's
    // tailored draft. Set only when the analysis was started from a resume rather than the base
    // Profile; no live link back (see spec's "no save-back" decision).
    sourceResume: new mongoose.Schema(
      { resume: { type: mongoose.Schema.Types.ObjectId, ref: 'Resume' }, name: String, resumeUpdatedAt: Date },
      { _id: false }
    ),
    // Editable copy of the draft. Single-nested so it stays absent until first set.
    draftResume: draftSchema,
    // requirement key -> 'confirmed_have' | 'confirmed_missing' (validated in code)
    overrides: { type: Map, of: String },
    draftScore: new mongoose.Schema(
      {
        atsScore: Number,
        band: String,
        requirements: [requirementSchema],
        matchedSkills: [String],
        missingSkills: [String],
        recommendations: [String],
        ungradedCount: Number,
        scoredAt: Date,
      },
      { _id: false }
    ),
    // Text of the draft that draftScore was judged against (stability prior for the next rescore).
    draftSnapshot: { type: String, select: false },
    // Client-supplied revision of the last persisted rescore; rejects out-of-order writes.
    draftRev: { type: Number, default: 0 },
    tailorChat: [
      {
        _id: false,
        role: { type: String, enum: ['user', 'assistant'] },
        text: String,
        focusKeys: [String],
        asking: Boolean,
        suggestions: [suggestionSchema],
        createdAt: { type: Date, default: Date.now },
      },
    ],
    label: String,
    forkedFrom: { type: mongoose.Schema.Types.ObjectId, ref: 'SkillGapResult' },
  },
  { timestamps: true }
);

skillGapResultSchema.index({ user: 1, createdAt: -1 });
skillGapResultSchema.index({ user: 1, 'job.title': 1, 'job.company': 1, createdAt: -1 });

export default mongoose.model('SkillGapResult', skillGapResultSchema);
