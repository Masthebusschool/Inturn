import multer from 'multer';

export const MAX_RESUME_SIZE = 2 * 1024 * 1024; // 2 MB

export const DOCX_MIMETYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

// Keeps the file in memory only: we read its text and never save the upload itself.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_RESUME_SIZE, files: 1 },
  // So file names with non-English characters come through correctly
  defParamCharset: 'utf8',
  fileFilter: (req, file, cb) => {
    if (file.mimetype !== 'application/pdf' && file.mimetype !== DOCX_MIMETYPE) {
      const err = new Error('Resume must be a PDF or Word (.docx) file');
      err.code = 'UNSUPPORTED_FILE_TYPE';
      return cb(err);
    }
    return cb(null, true);
  },
});

// Reads one PDF or DOCX from the "resume" form field into req.file.
// Usage: router.post('/', isLoggedIn, receiveResumeFile, controller.fn)
export function receiveResumeFile(req, res, next) {
  upload.single('resume')(req, res, (err) => {
    if (!err)
      return next();
    if (err.code === 'UNSUPPORTED_FILE_TYPE')
      return res.status(400).json({ errors: [err.message] });
    if (err.code === 'LIMIT_FILE_SIZE')
      return res.status(400).json({ errors: ['Resume must be 2 MB or smaller'] });
    if (err instanceof multer.MulterError)
      return res.status(400).json({ errors: ['Upload one PDF or Word (.docx) file in the "resume" field'] });
    console.error(err);
    return res.status(500).json({ error: 'An internal error occurred' });
  });
}
