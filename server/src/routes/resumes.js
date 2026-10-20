import { Router } from 'express';
import mongoose from 'mongoose';
import { devUser } from '../middleware/devUser.js';
import { apiErrors } from '../middleware/apiErrors.js';
import { toProfile } from '../utils/profile.js';
import { canonical } from '../utils/skillNormalize.js';
import { s, strList, objList } from '../utils/sanitize.js';
import Resume from '../models/Resume.js';

const router = Router();
const MAX_NAME = 80;
const skillKey = (t) => canonical(t) || t.toLowerCase();

router.use(devUser);

// ---- sanitising (mirrors profile.js's PUT cleaning, plus contact + resume-only fields) ----
const cleanContact = (c) => ({
  fullName: s(c?.fullName), phone: s(c?.phone), email: s(c?.email),
  linkedin: s(c?.linkedin), github: s(c?.github), portfolio: s(c?.portfolio),
});
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
  const resumes = await Resume.find({ user: req.user._id }).sort({ updatedAt: -1 }).select('name updatedAt').lean();
  res.json({ resumes });
});

router.post('/', async (req, res) => {
  const name = s(req.body?.name).slice(0, MAX_NAME);
  if (!name) return res.status(400).json({ error: 'Resume name is required.' });
  const seed = req.body?.seed === 'profile' ? 'profile' : 'blank';

  let fields = { contact: {}, summary: '', skills: [], experience: [], projects: [], education: [] };
  if (seed === 'profile') {
    const p = toProfile(req.user);
    fields = {
      contact: { fullName: s(req.user.name), email: s(req.user.email), phone: '', linkedin: '', github: '', portfolio: '' },
      summary: p.summary,
      skills: p.skills,
      experience: p.experience.map((e) => ({ ...e, location: '' })),
      projects: p.projects.map(({ name: n, bullets, skills }) => ({ name: n, bullets, skills, startDate: '', endDate: '' })),
      education: p.education.map((e) => ({ ...e, grade: '', bullets: [] })),
    };
  }

  const resume = await Resume.create({ user: req.user._id, name, ...fields });
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

router.use(apiErrors);

export default router;
