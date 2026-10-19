import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: String,
    name: String,
    educationLevel: String,
    skills: [String],
    targetRoles: [String],
    targetIndustries: [String],
    // Resume profile (additive). Dates are free text ("Jan 2024", "Present").
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

export default mongoose.model('User', userSchema);
