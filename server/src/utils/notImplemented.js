// Placeholder handler: replies 501 until a feature is built.
export function notImplemented(feature) {
  return (req, res) =>
    res.status(501).json({ error: 'Not implemented yet', feature, method: req.method, path: req.originalUrl });
}
