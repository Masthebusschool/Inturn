// `author` is stored for moderation only and must NEVER be exposed in API
// responses: posts are shown anonymously.
import mongoose from 'mongoose';

const intelPostSchema = new mongoose.Schema(
  {
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    company: { type: String, required: true },
    role: { type: String, required: true },
    questions: [String],
    experience: String,
    upvotes: { type: Number, default: 0 },
    upvotedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  },
  { timestamps: true }
);

export default mongoose.model('IntelPost', intelPostSchema);
