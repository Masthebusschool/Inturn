import { PDFParse } from 'pdf-parse';
import * as resumeAnalyzer from '../services/resumeAnalyzer.js';

// Far longer than any real resume; stops very large bodies being analyzed
const MAX_TEXT_LENGTH = 50000;

// Collapses runs of spaces and blank lines, keeping one line per line of the resume.
function cleanText(text) {
  return text
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n');
}

export const uploadResume = async (req, res) => {
  if (!req.file)
    return res.status(400).json({ errors: ['Choose a PDF file to upload'] });

  // The browser's file type can be faked, so check the file really starts like a PDF
  if (req.file.buffer.subarray(0, 5).toString() !== '%PDF-')
    return res.status(400).json({ errors: ['Resume must be a PDF file'] });

  const parser = new PDFParse({ data: req.file.buffer });
  try {
    // No "-- 1 of 2 --" page markers: they would end up in the resume text
    const result = await parser.getText({ pageJoiner: '' });
    const text = cleanText(result.text);

    // Scanned resumes are images, so there is no text to read
    if (!text)
      return res.status(400).json({ errors: ['No text found in this PDF. Upload a text-based PDF, not a scanned one'] });

    return res.json({
      resume: {
        fileName: req.file.originalname,
        pageCount: result.total,
        wordCount: text.split(/\s+/).length,
        text,
      },
    });
  }
  catch (e) {
    if (e.name === 'PasswordException')
      return res.status(400).json({ errors: ['This PDF is password protected. Remove the password and try again'] });
    if (e.name === 'InvalidPDFException' || e.name === 'FormatError')
      return res.status(400).json({ errors: ['This PDF could not be read. It may be damaged'] });
    console.error(e);
    return res.status(500).json({ error: 'An internal error occurred' });
  }
  finally {
    await parser.destroy();
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
