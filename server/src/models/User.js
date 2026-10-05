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
  },
  { timestamps: true }
);

export default mongoose.model('User', userSchema);
