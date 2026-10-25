import mongoose from 'mongoose';

const resumeSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true },
    contact: {
      fullName: String, phone: String, email: String, linkedin: String, github: String, portfolio: String,
    },
    summary: String,
    skills: [String],
    experience: [
      {
        title: String, company: String, location: String, startDate: String, endDate: String,
        current: { type: Boolean, default: false }, bullets: [String], skills: [String],
      },
    ],
    projects: [{ name: String, startDate: String, endDate: String, bullets: [String], skills: [String] }],
    education: [
      { school: String, degree: String, field: String, startDate: String, endDate: String, grade: String, bullets: [String] },
    ],
  },
  { timestamps: true }
);

resumeSchema.index({ user: 1, updatedAt: -1 });

export default mongoose.model('Resume', resumeSchema);
