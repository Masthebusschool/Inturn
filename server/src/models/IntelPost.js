const MAX_QUESTIONS = 10;

const intelPostSchema = new mongoose.Schema(
  {
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    type: { type: String, enum: ['Experience', 'Interview questions'], required: true },
    title: { type: String, required: true, trim: true, maxlength: 150 },
    company: { type: String, required: true, trim: true, maxlength: 80 },
    role: { type: String, required: true, trim: true, maxlength: 100 },
    questions: {
      type: [{ type: String, trim: true, maxlength: 300 }],
      validate: {
        validator: (arr) => arr.length <= MAX_QUESTIONS,
        message: `A post can have at most ${MAX_QUESTIONS} questions.`,
      },
    },
    experience: { type: String, trim: true, maxlength: 2000 },
    upvotes: { type: Number, default: 0 },
    upvotedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  },
  { timestamps: true }
);