import { Router } from 'express';
import mongoose from 'mongoose';
import { isLoggedIn, loadUser } from '../middleware/authMiddleware.js';
import { receiveResumeFile } from '../middleware/uploadMiddleware.js';
import { apiErrors } from '../middleware/apiErrors.js';
import { toProfile } from '../utils/profile.js';
import { getPrimaryResume, getOrCreatePrimaryResume, createResume } from '../utils/primaryResume.js';
import { canonical } from '../utils/skillNormalize.js';
import { s, strList, objList } from '../utils/sanitize.js';
import { cleanContact } from '../utils/contact.js';
import { readResumeFile, MAX_TEXT_LENGTH } from '../services/resumeText.js';
import { parseResume, AIServiceError } from '../services/aiService.js';
import Resume from '../models/Resume.js';

const router = Router();
const MAX_NAME = 80;
const skillKey = (t) => canonical(t) || t.toLowerCase();

router.use(isLoggedIn, loadUser);

// ---- sanitising of resume request bodies ----
const cleanExperience = (v) =>
  objList(v, (e) => ({
    title: s(e.title), company: s(e.company), location: s(e.location), startDate: s(e.startDate), endDate: s(e.endDate),
    current: e.current === true, bullets: strList(e.bullets), skills: strList(e.skills, skillKey),
  }));
const cleanProjects = (v) =>
  objList(v, (p) => ({
    name: s(p.name), startDate: s(p.startDate), endDate: s(p.endDate), bullets: strList(p.bullets), skills: strList(p.skills, skillKey),
  }));
const cleanEducation = (v) =>
  objList(v, (e) => ({
    school: s(e.school), degree: s(e.degree), field: s(e.field), startDate: s(e.startDate), endDate: s(e.endDate),
    grade: s(e.grade), bullets: strList(e.bullets),
  }));

function cleanBody(body) {
  return {
    name: s(body?.name).slice(0, MAX_NAME),
    contact: cleanContact(body?.contact),
    summary: s(body?.summary),
    skills: strList(body?.skills, skillKey),
    experience: cleanExperience(body?.experience),
    projects: cleanProjects(body?.projects),
    education: cleanEducation(body?.education),
  };
}

// Lean row owned by the caller, or null after sending 404 (not 403, so ids can't be probed).
// Not .lean(): PUT/DELETE need a live document to call .save()/.deleteOne() on.
async function loadOwned(req, res, select = '') {
  const q = mongoose.isValidObjectId(req.params.id) ? Resume.findById(req.params.id) : null;
  const resume = q ? await q.select(select) : null;
  if (!resume || !resume.user.equals(req.user._id)) {
    res.status(404).json({ error: 'Resume not found' });
    return null;
  }
  return resume;
}

router.get('/', async (req, res) => {
  const resumes = await Resume.find({ user: req.user._id }).sort({ updatedAt: -1 }).select('name updatedAt primary').lean();
  res.json({ resumes });
});

// Registered before /:id so "primary" isn't read as an id.
router.get('/primary', async (req, res) => {
  res.json({ resume: await getPrimaryResume(req.user._id) });
});

// The Profile page edits only these three sections; each is replaced only when present in the body.
router.patch('/primary', async (req, res) => {
  const body = req.body ?? {};
  const resume = await getOrCreatePrimaryResume(req.user._id);
  if (body.skills !== undefined) resume.skills = strList(body.skills, skillKey);
  if (body.experience !== undefined) resume.experience = cleanExperience(body.experience);
  if (body.projects !== undefined) resume.projects = cleanProjects(body.projects);
  await resume.save();
  res.json({ resume });
});

router.post('/', async (req, res) => {
  const name = s(req.body?.name).slice(0, MAX_NAME);
  if (!name) return res.status(400).json({ error: 'Resume name is required.' });
  const seed = req.body?.seed === 'profile' ? 'profile' : 'blank';

  let fields = { contact: {}, summary: '', skills: [], experience: [], projects: [], education: [] };
  if (seed === 'profile') {
    const p = await toProfile(req.user);
    fields = {
      contact: { fullName: s(req.user.name), email: s(req.user.email), phone: '', links: [] },
      summary: p.summary,
      skills: p.skills,
      experience: cleanExperience(p.experience), // also drops the source subdoc _ids
      projects: cleanProjects(p.projects),
      education: p.education.map((e) => ({ ...e, grade: '', bullets: [] })),
    };
  }

  const resume = await createResume(req.user._id, { name, ...fields });
  res.status(201).json({ resume });
});

router.get('/:id', async (req, res) => {
  const resume = await loadOwned(req, res);
  if (resume) res.json({ resume });
});

router.put('/:id', async (req, res) => {
  const resume = await loadOwned(req, res);
  if (!resume) return;
  const clean = cleanBody(req.body);
  if (!clean.name) return res.status(400).json({ error: 'Resume name is required.' });
  Object.assign(resume, clean);
  await resume.save();
  res.json({ resume });
});

router.delete('/:id', async (req, res) => {
  const resume = await loadOwned(req, res);
  if (!resume) return;
  await resume.deleteOne();
  res.json({ ok: true });
});

router.post('/:id/duplicate', async (req, res) => {
  const resume = await loadOwned(req, res);
  if (!resume) return;
  const name = s(req.body?.name).slice(0, MAX_NAME) || `Copy of ${resume.name}`;
  const copy = await Resume.create({
    user: req.user._id, name,
    contact: resume.contact, summary: resume.summary, skills: resume.skills,
    experience: resume.experience, projects: resume.projects, education: resume.education,
  });
  res.status(201).json({ resume: copy });
});

// Upload and text extraction are shared with the resume analysis feature (resumeText.js).
router.post('/:id/parse', receiveResumeFile, async (req, res) => {
  const resume = await loadOwned(req, res, '_id user'); // loadOwned's ownership check needs `user` even when the route doesn't
  if (!resume) return;
  const { resume: parsed, errors } = await readResumeFile(req.file);
  if (errors) return res.status(400).json({ errors });
  res.json({ draft: await parseResume(parsed.text) });
});

// Hand-over from Resume Analysis ("AI deep analysis"): the text was already extracted from the
// uploaded PDF, so it is parsed into a new named resume without uploading the file again.
router.post('/from-text', async (req, res) => {
  const text = s(req.body?.text);
  if (!text) return res.status(400).json({ errors: ['Upload your resume before analyzing it'] });
  if (text.length > MAX_TEXT_LENGTH) return res.status(400).json({ errors: ['Resume text is too long to analyze'] });
  const name = s(req.body?.name).slice(0, MAX_NAME) || 'Uploaded resume';

  const draft = await parseResume(text);
  const resume = await createResume(req.user._id, { name, ...draft });
  res.status(201).json({ resume });
});

router.use((err, req, res, next) => {
  if (err instanceof AIServiceError) return res.status(err.status).json({ error: err.message, code: err.code });
  next(err);
});
router.use(apiErrors);

export default router;
