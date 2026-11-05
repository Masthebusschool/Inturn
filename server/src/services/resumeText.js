import { PDFParse } from 'pdf-parse';
import mammoth from 'mammoth';
import { DOCX_MIMETYPE } from '../middleware/uploadMiddleware.js';

// Far longer than any real resume; stops very large bodies being analyzed
export const MAX_TEXT_LENGTH = 50000;

// Collapses runs of spaces and blank lines, keeping one line per line of the resume.
function cleanText(text) {
  return text
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n');
}

// Wraps up a cleaned, length-checked text body into the shared resume result shape.
function toResumeResult(file, text, pageCount) {
  if (!text)
    return { errors: ['No text found in this file. Upload a text-based resume, not a scanned image'] };
  if (text.length > MAX_TEXT_LENGTH)
    return { errors: ['Resume text is too long to analyze'] };

  return {
    resume: {
      fileName: file.originalname,
      pageCount,
      wordCount: text.split(/\s+/).length,
      text,
    },
  };
}

async function readPdf(file) {
  // The browser's file type can be faked, so check the file really starts like a PDF
  if (file.buffer.subarray(0, 5).toString() !== '%PDF-')
    return { errors: ['Resume must be a PDF or Word (.docx) file'] };

  const parser = new PDFParse({ data: file.buffer });
  try {
    // No "-- 1 of 2 --" page markers: they would end up in the resume text
    const result = await parser.getText({ pageJoiner: '' });
    return toResumeResult(file, cleanText(result.text), result.total);
  }
  catch (e) {
    if (e.name === 'PasswordException')
      return { errors: ['This PDF is password protected. Remove the password and try again'] };
    if (e.name === 'InvalidPDFException' || e.name === 'FormatError')
      return { errors: ['This PDF could not be read. It may be damaged'] };
    throw e;
  }
  finally {
    await parser.destroy();
  }
}

async function readDocx(file) {
  // The browser's file type can be faked; a .docx is a zip, so check it really starts like one
  if (file.buffer.subarray(0, 2).toString() !== 'PK')
    return { errors: ['This Word document could not be read. It may be damaged'] };

  try {
    const result = await mammoth.extractRawText({ buffer: file.buffer });
    return toResumeResult(file, cleanText(result.value), null);
  }
  catch {
    return { errors: ['This Word document could not be read. It may be damaged'] };
  }
}

/**
 * Reads the text out of an uploaded resume (PDF or DOCX).
 * Shared by the resume upload and the AI features (Skill Gap, resume editor),
 * so every page applies the same rules.
 * @param {Object} file req.file from receiveResumeFile
 * @returns {Promise<{ resume?: { fileName, pageCount, wordCount, text }, errors?: string[] }>}
 *   errors is set when the file is the user's problem (show it with status 400);
 *   anything unexpected is thrown, so the route answers 500
 */
export async function readResumeFile(file) {
  if (!file)
    return { errors: ['Choose a PDF or Word (.docx) file to upload'] };

  if (file.mimetype === DOCX_MIMETYPE)
    return readDocx(file);

  return readPdf(file);
}
