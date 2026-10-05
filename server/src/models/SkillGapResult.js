import mongoose from 'mongoose';

const skillGapResultSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    // Snapshot of the posting at analysis time
    job: {
      jobId: String,
      source: String,
      title: String,
      company: String,
    },
    matchedSkills: [String],
    missingSkills: [String],
    recommendations: [String],
  },
  { timestamps: true }
);

export default mongoose.model('SkillGapResult', skillGapResultSchema);
