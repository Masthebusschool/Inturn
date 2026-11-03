import mongoose from 'mongoose';
import Resume from '../models/Resume.js';
import * as resumeAnalyzer from '../services/resumeAnalyzer.js';
import { readResumePdf } from '../services/resumeText.js';

// Reads the text out of an uploaded PDF. Onboarding sends it on to the AI parser,
// which saves it as a resume in My Resumes.
export const uploadResume = async (req, res) => {
  try {
    const { resume, errors } = await readResumePdf(req.file);
    if (errors)
      return res.status(400).json({ errors });
    return res.json({ resume });
  }
  catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'An internal error occurred' });
  }
};

// Scores one resume from My Resumes with the rule-based checks in resumeAnalyzer.js
export const reviewResume = async (req, res) => {
  try {
    const { id } = req.params;
    const resume = mongoose.isValidObjectId(id)
      ? await Resume.findOne({ _id: id, user: req.session.user.id })
      : null;
    if (!resume)
      return res.status(404).json({ error: 'Resume not found' });

    return res.json({
      resume: { id: resume.id, name: resume.name, updatedAt: resume.updatedAt },
      review: resumeAnalyzer.reviewResume(resume.toObject()),
    });
  }
  catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'An internal error occurred' });
  }
};
