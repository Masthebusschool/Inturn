import multer from 'multer';
import mongoose from 'mongoose';

// Router-level error handler (mounted at the end of our routers only). Always JSON { error }.
export function apiErrors(err, req, res, next) {
  if (res.headersSent) return next(err);
  if (err instanceof multer.MulterError) {
    const msg = err.code === 'LIMIT_FILE_SIZE' ? 'PDF must be 2 MB or smaller' : err.message;
    return res.status(400).json({ error: msg });
  }
  const status = err.status ?? err.statusCode;
  if (Number.isInteger(status) && status >= 400 && status <= 599) {
    return res.status(status).json({ error: err.message });
  }
  if (err instanceof mongoose.Error.ValidationError || err instanceof mongoose.Error.CastError) {
    return res.status(400).json({ error: err.message });
  }
  console.error('[api] Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
}
