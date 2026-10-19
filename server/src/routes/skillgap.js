import { Router } from 'express';
import mongoose from 'mongoose';
import { devUser } from '../middleware/devUser.js';
import { apiErrors } from '../middleware/apiErrors.js';
import { analyzeSkillGap, generateTailoredResume, rescoreDraft, tailorChatTurn, AIServiceError } from '../services/aiService.js';
import SkillGapResult from '../models/SkillGapResult.js';
import { toProfile } from '../utils/profile.js';
import { cleanDraft, cleanOverrides, draftToProfile } from '../utils/tailorDraft.js';

const router = Router();
router.use(devUser);

const MAX_DESCRIPTION = 20000;
const MAX_MESSAGE = 2000;
const MAX_LABEL = 80;
const str = (v) => (typeof v === 'string' ? v.trim() : '');

// Express 5 forwards async errors to apiErrors (below), so handlers need no try/catch.

// Lean row owned by the caller, or null after sending 404 (not 403, so ids can't be probed).
async function loadOwned(req, res, select = '') {
  const q = mongoose.isValidObjectId(req.params.id) ? SkillGapResult.findById(req.params.id) : null;
  const result = q ? await q.select(select).lean() : null;
  if (!result || !result.user?.equals(req.user._id)) {
    res.status(404).json({ error: 'Result not found' });
    return null;
  }
  return result;
}

// Analyze the user's full profile against one job, then build a tailored resume from it.
router.post('/', async (req, res) => {
  const j = req.body?.job || {};
  const job = {
    jobId: str(j.jobId) || undefined,
    source: str(j.source) || 'manual',
    title: str(j.title),
    company: str(j.company),
    description: str(j.description).slice(0, MAX_DESCRIPTION),
  };
  if (!job.title || !job.description) {
    return res.status(400).json({ error: 'Job title and description are required.' });
  }
  const profile = toProfile(req.user);
  if (!profile.skills.length && !profile.experience.length && !profile.projects.length) {
    return res
      .status(400)
      .json({ error: 'Your profile is empty — add skills or experience on the Profile page first.' });
  }
  // Previous run for the same posting: anchors verdict stability across re-scores.
  const prior = await SkillGapResult.findOne({ user: req.user._id, 'job.title': job.title, 'job.company': job.company })
    .sort({ createdAt: -1 })
    .select('+profileSnapshot')
    .lean();
  const gap = await analyzeSkillGap(profile, job, prior);
  const tailoredResume = await generateTailoredResume(profile, job, gap);
  const result = await SkillGapResult.create({ user: req.user._id, job, ...gap, tailoredResume });
  res.status(201).json({ result });
});

// Registered before '/:id' so "history" isn't treated as an id.
router.get('/history', async (req, res) => {
  const results = await SkillGapResult.find({ user: req.user._id })
    .sort({ createdAt: -1 })
    .limit(50)
    .select('job.title job.company atsScore band label forkedFrom draftScore.atsScore draftScore.band createdAt')
    .lean();
  res.json({ results });
});

router.get('/:id', async (req, res) => {
  const result = await loadOwned(req, res);
  if (result) res.json({ result });
});

// Re-score the student's edited draft against the stored requirements and autosave it.
router.post('/:id/rescore', async (req, res) => {
  const r = await loadOwned(req, res, '+profileSnapshot +draftSnapshot');
  if (!r) return;
  if (!r.requirements?.length) {
    return res.status(400).json({ error: 'This analysis predates requirement scoring — re-run it to get a live score.' });
  }
  const draft = cleanDraft(req.body?.draft);
  const overrides = cleanOverrides(req.body?.overrides, new Set(r.requirements.map((x) => x.key)));
  const rev = Number.isFinite(req.body?.rev) && req.body.rev > 0 ? req.body.rev : Date.now();
  const fullProfile = toProfile(req.user);
  // Anchor stability on the last draft score when there is one, else on the original analysis.
  const prior = r.draftScore
    ? { requirements: r.draftScore.requirements || [], profileSnapshot: r.draftSnapshot }
    : { requirements: r.requirements, profileSnapshot: r.profileSnapshot };

  const { snapshot, stats, ...score } = await rescoreDraft({
    draftProfile: draftToProfile(draft, fullProfile.education),
    job: r.job,
    requirements: r.requirements,
    prior,
    overrides,
  });
  score.scoredAt = new Date();

  // The rev guard stops a slow, older rescore from overwriting a newer one.
  const w = await SkillGapResult.updateOne(
    { _id: r._id, user: req.user._id, $or: [{ draftRev: { $lt: rev } }, { draftRev: { $exists: false } }] },
    { $set: { draftResume: draft, overrides, draftScore: score, draftSnapshot: snapshot, draftRev: rev } }
  );
  res.json({ score, stats, saved: w.matchedCount === 1 });
});

router.post('/:id/tailor', async (req, res) => {
  const message = str(req.body?.message);
  if (!message || message.length > MAX_MESSAGE) {
    return res.status(400).json({ error: `Message must be 1–${MAX_MESSAGE} characters.` });
  }
  const r = await loadOwned(req, res);
  if (!r) return;
  const requirements = r.draftScore?.requirements || r.requirements || [];
  const validKeys = new Set(requirements.map((x) => x.key));
  const focusKeys = (Array.isArray(req.body?.focusKeys) ? req.body.focusKeys : []).filter((k) => validKeys.has(k));
  const draft = cleanDraft(req.body?.draft || r.draftResume || r.tailoredResume);

  const turn = await tailorChatTurn({
    job: r.job, draft, fullProfile: toProfile(req.user), requirements, focusKeys, history: r.tailorChat || [], message,
  });
  const now = new Date();
  const u = { role: 'user', text: message, focusKeys, asking: false, suggestions: [], createdAt: now };
  const a = { role: 'assistant', text: turn.reply, focusKeys, asking: turn.asking, suggestions: turn.suggestions, createdAt: now };
  // Persisted only after Gemini succeeded, so a failed turn leaves no half-conversation.
  await SkillGapResult.updateOne({ _id: r._id }, { $push: { tailorChat: { $each: [u, a], $slice: -100 } } });
  res.json({ messages: [u, a], meta: turn.meta });
});

router.delete('/:id/tailor', async (req, res) => {
  const r = await loadOwned(req, res);
  if (!r) return;
  await SkillGapResult.updateOne({ _id: r._id }, { $set: { tailorChat: [] } });
  res.json({ ok: true });
});

// Fork a result (e.g. "Save as new version"): the client flushes any pending rescore first.
router.post('/:id/duplicate', async (req, res) => {
  const r = await loadOwned(req, res, '+profileSnapshot +draftSnapshot');
  if (!r) return;
  const label = str(req.body?.label).slice(0, MAX_LABEL) || `Copy of ${r.label || r.job?.title || 'analysis'}`;
  const copy = await SkillGapResult.create({
    user: r.user,
    job: r.job,
    atsScore: r.atsScore,
    band: r.band,
    requirements: r.requirements,
    eligibility: r.eligibility,
    ungradedCount: r.ungradedCount,
    profileSnapshot: r.profileSnapshot,
    matchedSkills: r.matchedSkills,
    missingSkills: r.missingSkills,
    recommendations: r.recommendations,
    tailoredResume: r.tailoredResume,
    draftResume: r.draftResume,
    overrides: r.overrides,
    draftScore: r.draftScore,
    draftSnapshot: r.draftSnapshot,
    draftRev: r.draftRev,
    tailorChat: [],
    forkedFrom: r._id,
    label,
  });
  // Re-read so the select:false snapshots stay out of the response.
  res.status(201).json({ result: await SkillGapResult.findById(copy._id).lean() });
});

router.use((err, req, res, next) => {
  if (err instanceof AIServiceError) return res.status(err.status).json({ error: err.message, code: err.code });
  next(err);
});
router.use(apiErrors);

export default router;
