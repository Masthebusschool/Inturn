// One document = one saved job.
import mongoose from 'mongoose';

const shortlistSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    jobId: { type: String, required: true },
    source: { type: String, enum: ['arbeitnow', 'adzuna'] },
    title: String,
    company: String,
    location: String,
    url: String,
    status: { type: String, enum: ['Interested', 'Applied', 'Heard back'], default: 'Interested' },
  },
  { timestamps: true }
);

export default mongoose.model('Shortlist', shortlistSchema);
