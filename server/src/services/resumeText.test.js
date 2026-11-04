import { test } from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import { readResumeFile } from './resumeText.js';
import { DOCX_MIMETYPE } from '../middleware/uploadMiddleware.js';

// Minimal valid docx: mammoth only needs word/document.xml to extract text.
async function buildDocx(text) {
  const zip = new JSZip();
  zip.file('word/document.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body><w:p><w:r><w:t>${text}</w:t></w:r></w:p></w:body>
</w:document>`);
  return zip.generateAsync({ type: 'nodebuffer' });
}

test('readResumeFile extracts text from a real docx', async () => {
  const buffer = await buildDocx('Test Resume Text');
  const { resume, errors } = await readResumeFile({
    mimetype: DOCX_MIMETYPE,
    buffer,
    originalname: 'resume.docx',
  });
  assert.equal(errors, undefined);
  assert.equal(resume.text, 'Test Resume Text');
  assert.equal(resume.pageCount, null);
  assert.equal(resume.fileName, 'resume.docx');
});

test('readResumeFile rejects a missing file', async () => {
  const { errors } = await readResumeFile(null);
  assert.ok(errors?.length);
});

test('readResumeFile rejects a PDF-mimetype file that does not start with the PDF signature', async () => {
  const { errors } = await readResumeFile({
    mimetype: 'application/pdf',
    buffer: Buffer.from('not actually a pdf'),
    originalname: 'resume.pdf',
  });
  assert.ok(errors?.length);
});

test('readResumeFile rejects a docx-mimetype file that is not a real zip', async () => {
  const { errors } = await readResumeFile({
    mimetype: DOCX_MIMETYPE,
    buffer: Buffer.from('not actually a docx'),
    originalname: 'resume.docx',
  });
  assert.ok(errors?.length);
});
