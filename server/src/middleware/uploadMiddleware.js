import multer from 'multer';

export const MAX_RESUME_SIZE = 2 * 1024 * 1024; // 2 MB

// Keeps the file in memory only: we read its text and never save the PDF itself.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_RESUME_SIZE, files: 1 },
  // So file names with non-English characters come through correctly
  defParamCharset: 'utf8',
  fileFilter: (req, file, cb) => {
    if (file.mimetype !== 'application/pdf') {
      const err = new Error('Resume must be a PDF file');
      err.code = 'NOT_PDF';
      return cb(err);
    }
    return cb(null, true);
  },
});

// Reads one PDF from the "resume" form field into req.file.
// Usage: router.post('/', isLoggedIn, receiveResumePdf, controller.fn)
export function receiveResumePdf(req, res, next) {
  upload.single('resume')(req, res, (err) => {
    if (!err)
      return next();
    if (err.code === 'NOT_PDF')
      return res.status(400).json({ errors: [err.message] });
    if (err.code === 'LIMIT_FILE_SIZE')
      return res.status(400).json({ errors: ['Resume must be 2 MB or smaller'] });
    if (err instanceof multer.MulterError)
      return res.status(400).json({ errors: ['Upload one PDF file in the "resume" field'] });
    console.error(err);
    return res.status(500).json({ error: 'An internal error occurred' });
  });
}
