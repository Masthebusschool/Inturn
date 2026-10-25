import * as User from '../models/User.js';
import * as resumeAnalyzer from '../services/resumeAnalyzer.js';
import { readResumePdf, MAX_TEXT_LENGTH } from '../services/resumeText.js';

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

// Runs the analyzer on resume text the page got back from uploadResume.
export const analyzeResume = (req, res) => {
  const body = req.body ?? {};
  const text = String(body.text ?? '').trim();

  if (!text)
    return res.status(400).json({ errors: ['Upload your resume before analyzing it'] });
  if (text.length > MAX_TEXT_LENGTH)
    return res.status(400).json({ errors: ['Resume text is too long to analyze'] });

  try {
    return res.json({
      skills: resumeAnalyzer.extractSkills(text),
      review: resumeAnalyzer.reviewResume(text),
    });
  }
  catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'An internal error occurred' });
  }
};
 
export const getResume = async (req, res) => {
  try {
    const user = await User.retrieveUserById(req.session.user.id);
    if (!user)
      return res.status(404).json({ error: 'User not found' });
    
    return res.json({ resume: user.resume?.fileName ? user.resume : null });
  }
  catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'An internal error occurred' });
  }
};
