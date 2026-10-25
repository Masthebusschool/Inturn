import { PDFParse } from 'pdf-parse';

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

/**
 * Reads the text out of an uploaded resume PDF.
 * Shared by the resume upload and the AI features (Skill Gap, resume editor),
 * so every page applies the same rules.
 * @param {Object} file req.file from receiveResumePdf
 * @returns {Promise<{ resume?: { fileName, pageCount, wordCount, text }, errors?: string[] }>}
 *   errors is set when the file is the user's problem (show it with status 400);
 *   anything unexpected is thrown, so the route answers 500
 */
export async function readResumePdf(file) {
  if (!file)
    return { errors: ['Choose a PDF file to upload'] };

  // The browser's file type can be faked, so check the file really starts like a PDF
  if (file.buffer.subarray(0, 5).toString() !== '%PDF-')
    return { errors: ['Resume must be a PDF file'] };

  const parser = new PDFParse({ data: file.buffer });
  try {
    // No "-- 1 of 2 --" page markers: they would end up in the resume text
    const result = await parser.getText({ pageJoiner: '' });
    const text = cleanText(result.text);

    // Scanned resumes are images, so there is no text to read
    if (!text)
      return { errors: ['No text found in this PDF. Upload a text-based PDF, not a scanned one'] };
    if (text.length > MAX_TEXT_LENGTH)
      return { errors: ['Resume text is too long to analyze'] };

    return {
      resume: {
        fileName: file.originalname,
        pageCount: result.total,
        wordCount: text.split(/\s+/).length,
        text,
      },
    };
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
