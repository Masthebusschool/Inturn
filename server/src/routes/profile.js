import { Router } from 'express';
import multer from 'multer';
import { devUser } from '../middleware/devUser.js';
import { apiErrors } from '../middleware/apiErrors.js';
import { extractPdfText } from '../services/pdfText.js';
import { parseResume } from '../services/aiService.js';
import { PROFILE_FIELDS, toProfile } from '../utils/profile.js';
import { canonical } from '../utils/skillNormalize.js';
import { s, strList, objList, lowerKey } from '../utils/sanitize.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// Resume parsing needs no DB, so it sits before devUser. Nothing is saved here —
// the client shows the draft for review and saves it via PUT /api/profile.
// (Express 5 forwards async errors to apiErrors below, so no try/catch boilerplate.)
router.post('/resume/parse', upload.single('resume'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Upload a PDF in the "resume" field.' });
  if (req.file.buffer.subarray(0, 5).toString('latin1') !== '%PDF-') {
    return res.status(400).json({ error: 'Only PDF files are supported.' });
  }
  let text;
  try {
    text = await extractPdfText(req.file.buffer);
  } catch {
    return res.status(422).json({ error: 'Could not read this PDF. It may be corrupted or password-protected.' });
  }
  if (text.length < 30) {
    return res
      .status(422)
      .json({ error: 'Could not read any text from this PDF (scanned/image PDFs are not supported).' });
  }
  res.json({ draft: await parseResume(text) });
});

router.use(devUser);

// "Postgres" and "PostgreSQL" are the same skill; fall back to lowercase if normalising leaves nothing.
const skillKey = (t) => canonical(t) || t.toLowerCase();

const STRING_FIELDS = ['summary', 'educationLevel'];
const clean = {
  summary: s,
  educationLevel: s,
  skills: (v) => strList(v, skillKey),
  targetRoles: (v) => strList(v, lowerKey),
  targetIndustries: (v) => strList(v, lowerKey),
  experience: (v) =>
    objList(v, (e) => ({
      title: s(e.title), company: s(e.company), startDate: s(e.startDate), endDate: s(e.endDate),
      current: e.current === true, bullets: strList(e.bullets), skills: strList(e.skills),
    })),
  projects: (v) =>
    objList(v, (p) => ({ name: s(p.name), bullets: strList(p.bullets), skills: strList(p.skills), url: s(p.url) })),
  education: (v) =>
    objList(v, (e) => ({
      school: s(e.school), degree: s(e.degree), field: s(e.field), startDate: s(e.startDate), endDate: s(e.endDate),
    })),
};

router.get('/', (req, res) => res.json({ profile: toProfile(req.user) }));

// Only whitelisted profile fields are written; email/passwordHash etc. are ignored.
router.put('/', async (req, res) => {
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const fields = PROFILE_FIELDS.filter((f) => f in body);
  // Reject wrong types instead of silently wiping a saved list (e.g. experience: "oops" -> []).
  const bad = fields.find((f) => (STRING_FIELDS.includes(f) ? typeof body[f] !== 'string' : !Array.isArray(body[f])));
  if (bad) {
    return res.status(400).json({ error: `${bad} must be ${STRING_FIELDS.includes(bad) ? 'a string' : 'an array'}.` });
  }
  for (const f of fields) req.user[f] = clean[f](body[f]);
  await req.user.save();
  res.json({ profile: toProfile(req.user) });
});

router.use(apiErrors);

export default router;
