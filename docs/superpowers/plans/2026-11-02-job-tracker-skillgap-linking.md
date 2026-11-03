# Linking Job Discovery, Tracker Board, and Skill Gap Analysis — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `subagent-driven-development` (recommended) or `executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user go from a "Saved" card on the Tracker board straight into a prefilled Skill Gap Analysis for that job, and have the board reflect that an analysis happened.

**Architecture:** Additive, backward-compatible schema fields on the existing `Application` and `SkillGapResult` models (no migration script — new fields are optional/nullable). One new read route (`GET /api/applications/:id`). The existing `POST /api/skillgap` route gains an optional `applicationId` that links the two records both ways. All frontend wiring is route-query-param based (`?applicationId=`), mirroring the existing `?resumeId=` pattern already used by `ResumeAnalysisView.vue` → `SkillGapView.vue`.

**Tech Stack:** Express 5 + Mongoose (server), Vue 3 `<script setup>` + Vue Router (client). Server tests use Node's built-in `node:test` + `node:assert/strict` against a real test MongoDB (`ensureDb`/`startTestServer` helpers in `server/src/test/helpers.js`). There is no frontend test runner in this repo — frontend tasks are verified manually against the running dev server.

## Global Constraints

- Schema changes are additive only (new fields are optional/nullable with sane defaults) — no backfill/migration script, no DB reset needed. Matches this project's "migrations are append-only" rule.
- Match each file's existing idiom when editing it: `server/src/controllers/applicationController.js` and `server/src/routes/applications.js` use `try { ... } catch (err) { next(err) }`; `server/src/routes/skillgap.js` uses no try/catch (Express 5 forwards async errors to its own `apiErrors` middleware automatically — see the comment at the top of that file).
- No HTTP-mocking library is installed in `server/` (no `nock`/`msw`/`sinon`). Do not attempt to unit-test code paths that call the live MyCareersFuture upstream or the Gemini AI service (`server/src/services/aiService.js`) — this codebase already follows that convention (`server/src/routes/skillgap.js` and `server/src/routes/jobs.js` have zero test files for exactly this reason). Verify those specific paths manually against the running app instead.
- There is no frontend test runner (`client/package.json` has no `test` script, no `vitest`/`@vue/test-utils` dependency). Verify frontend tasks by running `npm run dev` from `client/` and `npm run dev` from `server/` (or the project's existing dev-stack process) and clicking through the flow in a browser.
- Spec: `docs/superpowers/specs/2026-11-02-job-tracker-skillgap-linking-design.md`

---

### Task 1: `Application` model — description field, score badge data, single-fetch helper

**Files:**
- Modify: `server/src/models/Application.js`
- Test: `server/src/models/Application.test.js` (new)

**Interfaces:**
- Produces: `toCard(application, skills)` now returns `skillGapScore: number|null` and `skillGapBand: string|null` in its returned object (same function signature as before).
- Produces: `getApplicationByIdAndUser(id, uid)` — returns the full `Application` doc owned by `uid`, or `null` if the id is invalid or not owned by this user.
- Produces: `getApplicationsByUser(uid)` — same signature, now returns docs with `skillGapResultId` populated to `{ _id, atsScore, band }` (or `null`) instead of a bare ObjectId.

- [ ] **Step 1: Write the failing test**

Create `server/src/models/Application.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toCard } from './Application.js';

function baseApp(overrides = {}) {
  return {
    _id: 'app1',
    title: 'Backend Intern',
    companyName: 'Acme',
    status: 'Saved',
    expiryDate: null,
    appliedDate: null,
    interviewAt: null,
    isFavourite: false,
    tasks: [],
    skills: [],
    skillGapResultId: null,
    ...overrides,
  };
}

test('toCard returns null skillGapScore/skillGapBand when no analysis is linked', () => {
  const card = toCard(baseApp(), []);
  assert.equal(card.skillGapScore, null);
  assert.equal(card.skillGapBand, null);
});

test('toCard surfaces the populated skillGapResultId score and band', () => {
  const card = toCard(baseApp({ skillGapResultId: { atsScore: 72, band: 'moderate' } }), []);
  assert.equal(card.skillGapScore, 72);
  assert.equal(card.skillGapBand, 'moderate');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test --workspace server -- --test-name-pattern="toCard"` (or from `server/`: `node --test "src/models/Application.test.js"`)
Expected: FAIL — `card.skillGapScore` is `undefined`, not `null` (property doesn't exist yet on the object `toCard` returns).

- [ ] **Step 3: Write minimal implementation**

In `server/src/models/Application.js`, add two schema fields after `jobDetailsUrl` (around line 24):

```js
        jobDetailsUrl: { type: String },
        description: { type: String }, // full job description text, snapshotted at save time so Skill Gap Analysis has real text to score

        status: { type: String, enum: STATUSES, default: STATUS.SAVED },
        appliedDate: { type: Date }, // opt
        interviewAt: { type: Date, default: null }, // opt
        isFavourite: { type: Boolean, required: true, default: false },
        skillGapResultId: { type: mongoose.Schema.Types.ObjectId, ref: 'SkillGapResult', default: null }, // set once a Skill Gap Analysis is linked to this card
```

Update `toCard` (around line 47-77) to add the two new fields to the returned card object:

```js
export function toCard(application, skills) {
    let completedTasks = 0;
    // get how many tasks completed count
    application.tasks.forEach(task => {
        if (task.done) completedTasks++;
    });

    // get skills matched count
    let skillsMatched = 0;
    application.skills.forEach(skill => {
        if(skills.includes(skill.toLowerCase())) skillsMatched++;
    });

    // add to application cards list
    let card = {
        _id: application._id,
        title: application.title,
        company: application.companyName,
        status: application.status,
        expiryDate: application.expiryDate,
        appliedDate: application.appliedDate,
        interviewAt: application.interviewAt,
        isFavourite: application.isFavourite,
        tasks: application.tasks, // [{ _id, text, done }] for the checklist modal
        prep: `${completedTasks} / ${application.tasks.length}`,
        matched: skillsMatched,
        total: application.skills.length,
        // null until a Skill Gap Analysis is linked (see skillGapResultId); populated by getApplicationsByUser
        skillGapScore: application.skillGapResultId?.atsScore ?? null,
        skillGapBand: application.skillGapResultId?.band ?? null,
    };

    return card;
}
```

Update `getApplicationsByUser` (around line 82-84) to populate the score/band:

```js
// get all specified user's applications
export function getApplicationsByUser(uid) {
    return Application.find({ user: uid }).populate('skillGapResultId', 'atsScore band');
}
```

Add a new helper after `findDuplicateApplication` (around line 112), used by Task 2's new route:

```js
// get one application owned by this user, used to prefill Skill Gap Analysis from a saved job
export function getApplicationByIdAndUser(id, uid) {
    if (!mongoose.isValidObjectId(id)) return null;
    return Application.findOne({ _id: id, user: uid });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run (from `server/`): `node --test "src/models/Application.test.js"`
Expected: PASS — both tests green.

- [ ] **Step 5: Commit**

```bash
git add server/src/models/Application.js server/src/models/Application.test.js
git commit -m "feat: add description and skillGapResultId fields to Application model"
```

---

### Task 2: `GET /api/applications/:id` route

**Files:**
- Modify: `server/src/controllers/applicationController.js`
- Modify: `server/src/routes/applications.js`
- Test: `server/src/routes/applications.test.js` (new)

**Interfaces:**
- Consumes: `getApplicationByIdAndUser(id, uid)` from Task 1.
- Produces: `getApplicationById(req, res, next)` controller — `GET /api/applications/:id` returns the raw `Application` doc as JSON (200), or `{ error: 'Application not found' }` (404) for an invalid id, a missing application, or one owned by another user.

- [ ] **Step 1: Write the failing test**

Create `server/src/routes/applications.test.js`:

```js
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import applicationsRouter from './applications.js';
import Application from '../models/Application.js';
import SkillGapResult from '../models/SkillGapResult.js';
import User from '../models/User.js';
import { ensureDb, startTestServer } from '../test/helpers.js';

const TITLE_PREFIX = '__test_applications__';
let base, close, userId;

before(async () => {
  await ensureDb();
  ({ base, close } = await startTestServer('/api/applications', applicationsRouter));
  const user = await User.findOneAndUpdate(
    { email: 'dev@inturn.local' },
    { $setOnInsert: { email: 'dev@inturn.local', name: 'Dev Student' } },
    { upsert: true, returnDocument: 'after' }
  );
  userId = user.id;
});

after(async () => {
  await Application.deleteMany({ title: new RegExp(`^${TITLE_PREFIX}`) });
  await SkillGapResult.deleteMany({ 'job.title': new RegExp(`^${TITLE_PREFIX}`) });
  await close();
  await mongoose.disconnect();
});

test('GET /:id returns the application with its description; a foreign/invalid id 404s', async () => {
  const created = await Application.create({
    user: userId,
    title: `${TITLE_PREFIX} get`,
    companyName: 'Acme',
    description: 'Full job description text.',
  });

  const ok = await fetch(`${base}/${created._id}`);
  assert.equal(ok.status, 200);
  const app = await ok.json();
  assert.equal(app.title, `${TITLE_PREFIX} get`);
  assert.equal(app.description, 'Full job description text.');

  const notAnId = await fetch(`${base}/not-an-id`);
  assert.equal(notAnId.status, 404);

  const validButMissing = await fetch(`${base}/${new mongoose.Types.ObjectId()}`);
  assert.equal(validButMissing.status, 404);

  const otherUser = await Application.create({
    user: new mongoose.Types.ObjectId(),
    title: `${TITLE_PREFIX} foreign`,
    companyName: 'Acme',
  });
  const foreign = await fetch(`${base}/${otherUser._id}`);
  assert.equal(foreign.status, 404);
});

test('GET / surfaces skillGapScore/skillGapBand once a SkillGapResult is linked', async () => {
  const created = await Application.create({
    user: userId,
    title: `${TITLE_PREFIX} badge`,
    companyName: 'Acme',
  });

  const before = await (await fetch(`${base}/`)).json();
  const beforeCard = before.find((c) => c._id === String(created._id));
  assert.equal(beforeCard.skillGapScore, null);

  const result = await SkillGapResult.create({
    user: userId,
    job: { title: `${TITLE_PREFIX} badge`, company: 'Acme', description: 'x' },
    atsScore: 81,
    band: 'strong',
  });
  created.skillGapResultId = result._id;
  await created.save();

  const after = await (await fetch(`${base}/`)).json();
  const afterCard = after.find((c) => c._id === String(created._id));
  assert.equal(afterCard.skillGapScore, 81);
  assert.equal(afterCard.skillGapBand, 'strong');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `server/`): `node --test "src/routes/applications.test.js"`
Expected: FAIL — first test gets 404 for the valid-id case too (no route registered for `GET /:id`), or a different error entirely.

- [ ] **Step 3: Write minimal implementation**

In `server/src/controllers/applicationController.js`, add the import (line 1-12, extend the existing destructured import) and the new controller function. Change the import block at the top to:

```js
import {
    getApplicationsByUser,
    createApplication,
    findDuplicateApplication,
    updateApplicationStatusById,
    updateApplicationInterviewDateById,
    updateApplicationFavouriteById,
    addApplicationTaskById,
    updateApplicationTaskById,
    deleteApplicationTaskById,
    deleteApplicationById,
    getApplicationByIdAndUser
} from "../models/Application.js";
```

Add the new controller after `getApplications` (after line 45):

```js
// Get one application by id, used to prefill Skill Gap Analysis from a saved job
export async function getApplicationById(req, res, next) {
    try {
        const uid = req.session.user.id;
        const application = await getApplicationByIdAndUser(req.params.id, uid);

        if (!application) return res.status(404).json({ error: 'Application not found' });
        return res.json(application);

    } catch (err) {
        console.log("Err at get application by id controller: " + err);
        next(err);
    }
}
```

In `server/src/routes/applications.js`, add the route. It must come after `/discovery-saved` (line 10) so that literal path isn't swallowed by `:id`, and before the `PATCH /:id` route for readability — insert after line 12:

```js
router.get('/', isLoggedIn, applcationController.getApplications);
router.post('/', isLoggedIn, applcationController.addApplication);
router.get("/discovery-saved", getDiscoverySavedJobs);
router.post("/discovery-saved", saveDiscoveryJob);
router.delete("/discovery-saved/:jobId", removeDiscoverySavedJob);
router.get('/:id', isLoggedIn, applcationController.getApplicationById);
router.patch('/:id', isLoggedIn, applcationController.updateStatus);
```

- [ ] **Step 4: Run test to verify it passes**

Run (from `server/`): `node --test "src/routes/applications.test.js"`
Expected: PASS — both tests green.

- [ ] **Step 5: Commit**

```bash
git add server/src/controllers/applicationController.js server/src/routes/applications.js server/src/routes/applications.test.js
git commit -m "feat: add GET /api/applications/:id to prefill Skill Gap Analysis"
```

---

### Task 3: Snapshot the job description when a job is saved from Job Discovery

**Files:**
- Modify: `server/src/models/McfJobs.js`
- Modify: `server/src/routes/jobs.js`
- Modify: `server/src/controllers/applicationController.js`
- Test: `server/src/models/McfJobs.test.js` (new)

**Interfaces:**
- Produces: `jobFromMcf(mcfJob)` now also returns a `description` field (plain text, HTML tags stripped), same as its other fields.
- Produces: `fetchJobDetail(uuid)` exported from `server/src/routes/jobs.js` — fetches the full MCF job detail for one posting (same upstream call the existing `GET /:id` route already makes).
- Consumes (in `applicationController.js`): `fetchJobDetail` to backfill `description` when the client only had the compact (list-card) job object, which has no `description` field at all.

**Why this task exists:** the Job Discovery list's "Save" button (`JobsView.vue` line 193, `toggleSaved(job.uuid)`) sends the *compact* job object (`compactJob()` in `jobs.js`, which never includes `description`) unless the user had already opened that job's detail modal first (`selectedJob`, fetched via `GET /api/jobs/:id`, which does include `description` as raw HTML). So most saves need a server-side backfill, not just a client-side pass-through.

- [ ] **Step 1: Write the failing test**

Create `server/src/models/McfJobs.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { jobFromMcf } from './McfJobs.js';

test('jobFromMcf strips HTML from the description into plain text', () => {
  const details = jobFromMcf({
    uuid: 'abc123',
    title: 'Backend Intern',
    hiringCompany: { name: 'Acme' },
    description: '<p>Build <b>APIs</b>.</p><ul><li>Node.js</li><li>Mongo</li></ul>',
  });
  assert.equal(details.description, 'Build APIs.\n\n• Node.js\n• Mongo');
});

test('jobFromMcf returns an empty description when the job has none (compact list job)', () => {
  const details = jobFromMcf({ uuid: 'abc123', title: 'Backend Intern' });
  assert.equal(details.description, '');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `server/`): `node --test "src/models/McfJobs.test.js"`
Expected: FAIL — `details.description` is `undefined`, not a string (the field doesn't exist yet).

- [ ] **Step 3: Write minimal implementation**

In `server/src/models/McfJobs.js`, add a `htmlToText` helper above `jobFromMcf` and set `description` in its return value:

```js
// Picks the job details we need out of one MyCareersFuture API job
// The result is spread straight into a new Application

// MCF's description is an HTML string; convert it to plain text for scoring/display,
// same conversion JobsSelect.vue already does client-side for the detail modal.
function htmlToText(html) {
  let text = html || '';
  text = text.replace(/<br\s*\/?>/gi, '\n');
  text = text.replace(/<\/p>/gi, '\n\n');
  text = text.replace(/<\/li>/gi, '\n');
  text = text.replace(/<li[^>]*>/gi, '• ');
  text = text.replace(/<[^>]*>/g, '');
  text = text.replace(/&nbsp;/gi, ' ');
  text = text.replace(/&amp;/gi, '&');
  text = text.replace(/&lt;/gi, '<');
  text = text.replace(/&gt;/gi, '>');
  text = text.replace(/&quot;/gi, '"');
  text = text.replace(/&#39;/g, "'");
  return text.trim();
}

export function jobFromMcf(mcfJob) {
  // MCF has two companies, the one actually hiring and the agency that posted the job
  // use the hiring company, if there isn't one use the poster, if neither use an empty object
  let company;
  if (mcfJob.hiringCompany) {
    company = mcfJob.hiringCompany;
  } else if (mcfJob.postedCompany) {
    company = mcfJob.postedCompany;
  } else {
    company = {};
  }

  // MCF gives [{ skill: 'Python', uuid: '...' }], we only keep the names ['Python']
  const skills = [];
  if (mcfJob.skills) {
    mcfJob.skills.forEach(s => {
      skills.push(s.skill);
    });
  }

  // salary and metadata might be missing, so use empty objects instead
  let salary = {};
  if (mcfJob.salary) salary = mcfJob.salary;

  let metadata = {}; // MCF keeps the dates and job link inside metadata
  if (mcfJob.metadata) metadata = mcfJob.metadata;

  return {
    mcfUuid: mcfJob.uuid,
    title: mcfJob.title,
    companyName: company.name,
    companyLogoUrl: company.logoUploadPath,
    skills: skills,
    salaryMin: salary.minimum,
    salaryMax: salary.maximum,
    expiryDate: metadata.expiryDate,
    jobDetailsUrl: metadata.jobDetailsUrl,
    description: htmlToText(mcfJob.description),
  };
}
```

In `server/src/routes/jobs.js`, export a reusable detail-fetch function and use it from the existing route. Replace the `router.get("/:id", ...)` handler (lines 636-654):

```js
export async function fetchJobDetail(uuid) {
  return fetchUpstream(upstreamUrl + "/" + uuid);
}

router.get("/:id", async (req, res) => {
  if (!/^[a-f0-9]{32}$/i.test(req.params.id)) {
    return res.status(400).json({
      error: "Invalid job ID",
    });
  }

  try {
    const job = await fetchJobDetail(req.params.id);

    return res.json(job);
  } catch {
    return res.status(502).json({
      error: "Could not retrieve job details.",
    });
  }
});
```

In `server/src/controllers/applicationController.js`, import `fetchJobDetail` and backfill the description in `saveDiscoveryJob` when it's missing. Add to the import block at the top:

```js
import { jobFromMcf, jobFromForm } from "../models/McfJobs.js";
import { fetchJobDetail } from "../routes/jobs.js";
```

In `saveDiscoveryJob` (around line 262), right after `const details = jobFromMcf(job);`:

```js
    const details = jobFromMcf(job);

    // The list card's "Save" button sends the compact job (no description) — only the
    // detail modal's job object has it. Best-effort backfill; a failure here must not
    // block saving the card (the user can paste the description in manually later).
    if (!details.description) {
      try {
        const fullJob = await fetchJobDetail(job.uuid);
        details.description = jobFromMcf(fullJob).description;
      } catch {
        // leave it blank
      }
    }

    if (!details.companyName) {
      details.companyName = "Company undisclosed";
    }
```

- [ ] **Step 4: Run test to verify it passes**

Run (from `server/`): `node --test "src/models/McfJobs.test.js"`
Expected: PASS — both tests green.

- [ ] **Step 5: Manually verify the backfill path (not unit-testable — live upstream call)**

With the dev stack running (`npm run dev` from the repo root), open Job Discovery, click "Save" directly on a list card (do **not** open its detail modal first), then check the card now has a non-empty `description` in MongoDB (e.g. via `mongosh` or Compass) or by confirming Step 2 of Task 7 shows real text prefilled on the Skill Gap page for that job.

- [ ] **Step 6: Commit**

```bash
git add server/src/models/McfJobs.js server/src/models/McfJobs.test.js server/src/routes/jobs.js server/src/controllers/applicationController.js
git commit -m "feat: snapshot job description onto Application when a job is saved"
```

---

### Task 4: `SkillGapResult` model — live link back to `Application`

**Files:**
- Modify: `server/src/models/SkillGapResult.js`

**Interfaces:**
- Produces: `SkillGapResult.application` — nullable `ObjectId` ref to `Application`, settable by Task 5.

- [ ] **Step 1: Write the implementation (schema-only change, no test — see note)**

In `server/src/models/SkillGapResult.js`, add the field after `job` (around line 49), before `atsScore`:

```js
    job: {
      jobId: String,
      source: String,
      title: String,
      company: String,
      description: String,
      applicationDeadline: Date, // "apply by" date, typed in manually until the real job board exists
    },
    // The live link back to the Tracker board card this analysis was started from, if any.
    // (job.jobId/job.source above already existed for this purpose but were never populated —
    // see sourceResume's "no live link back" comment for the equivalent on the resume side.)
    application: { type: mongoose.Schema.Types.ObjectId, ref: 'Application', default: null },
    atsScore: { type: Number, min: 0, max: 100 },
```

**Note on testing:** a bare additive schema field with no behavior of its own has nothing to unit-test in isolation — Task 5's route test exercises it (asserts `result.application` gets set).

- [ ] **Step 2: Commit**

```bash
git add server/src/models/SkillGapResult.js
git commit -m "feat: add live application link to SkillGapResult"
```

---

### Task 5: `POST /api/skillgap` links back to the `Application` when started from the Tracker board

**Files:**
- Modify: `server/src/routes/skillgap.js`
- Test: `server/src/routes/skillgap.test.js` (new) — covers only the applicationId-linking logic (see constraint below), not the AI-calling parts of this route.

**Interfaces:**
- Consumes: `Application` model (direct import, matching this file's existing style of importing models directly rather than via helper functions — see `Resume`/`SkillGapResult` imports already in this file).
- Produces: `POST /api/skillgap` now accepts an optional `applicationId` in the body. When present and owned by the caller, the created `SkillGapResult.application` is set to it, and that `Application.skillGapResultId` is set to the new result's id. An `applicationId` that doesn't exist or isn't owned by the caller returns `404` before any AI call is made.

**Constraint:** this route calls `analyzeSkillGap`/`generateTailoredResume` (`server/src/services/aiService.js`, backed by `@google/genai`) — a real external AI call with no mock available in this codebase (see Global Constraints). The test below only exercises the `applicationId` validation that happens *before* that call; it intentionally does not cover the full POST → AI → link-back round trip. Verify that full path manually (Step 4 below).

- [ ] **Step 1: Write the failing test**

Create `server/src/routes/skillgap.test.js`:

```js
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import skillgapRouter from './skillgap.js';
import Application from '../models/Application.js';
import User from '../models/User.js';
import { ensureDb, startTestServer } from '../test/helpers.js';

const TITLE_PREFIX = '__test_skillgap_link__';
let base, close, userId;

before(async () => {
  await ensureDb();
  ({ base, close } = await startTestServer('/api/skillgap', skillgapRouter));
  const user = await User.findOneAndUpdate(
    { email: 'dev@inturn.local' },
    { $setOnInsert: { email: 'dev@inturn.local', name: 'Dev Student' } },
    { upsert: true, returnDocument: 'after' }
  );
  userId = user.id;
});

after(async () => {
  await Application.deleteMany({ title: new RegExp(`^${TITLE_PREFIX}`) });
  await close();
  await mongoose.disconnect();
});

test('POST / 404s for an applicationId the caller does not own, before calling the AI service', async () => {
  const foreignApp = await Application.create({
    user: new mongoose.Types.ObjectId(),
    title: `${TITLE_PREFIX} foreign`,
    companyName: 'Acme',
  });

  const res = await fetch(`${base}/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      job: { title: 'Backend Intern', company: 'Acme', description: 'Build APIs.' },
      applicationId: String(foreignApp._id),
    }),
  });
  assert.equal(res.status, 404);
});

test('POST / 404s for a garbage applicationId', async () => {
  const res = await fetch(`${base}/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      job: { title: 'Backend Intern', company: 'Acme', description: 'Build APIs.' },
      applicationId: 'not-an-id',
    }),
  });
  assert.equal(res.status, 404);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `server/`): `node --test "src/routes/skillgap.test.js"`
Expected: FAIL — both requests proceed past where the 404 should happen (no `applicationId` handling exists yet), most likely erroring out later or returning a different status once they hit the real AI call.

- [ ] **Step 3: Write minimal implementation**

In `server/src/routes/skillgap.js`, add the `Application` import at the top (after line 7, `import Resume from '../models/Resume.js';`):

```js
import Resume from '../models/Resume.js';
import Application from '../models/Application.js';
```

In the `POST '/'` handler, insert the applicationId lookup right after the `job` validation (after line 53, `}`, before `const resumeId = str(req.body?.resumeId);`):

```js
  if (!job.title || !job.description) {
    return res.status(400).json({ error: 'Job title and description are required.' });
  }

  // Set when the analysis started from the Tracker board's "Tailor Resume" button.
  const applicationId = str(req.body?.applicationId);
  let application;
  if (applicationId) {
    application = mongoose.isValidObjectId(applicationId)
      ? await Application.findOne({ _id: applicationId, user: req.user._id })
      : null;
    if (!application) return res.status(404).json({ error: 'Application not found' });
  }

  const resumeId = str(req.body?.resumeId);
```

Then wire the link into the create call and write the id back onto the `Application`. Replace lines 82-91:

```js
  const result = await SkillGapResult.create({
    user: req.user._id, job, ...gap, tailoredResume, ...(sourceResume && { sourceResume }),
    ...(application && { application: application._id }),
  });
  if (application) {
    await Application.updateOne({ _id: application._id }, { skillGapResultId: result._id });
  }
  // The analysis is saved; a to-do sync failure must not turn it into a 500.
  try {
    await syncLearningTasksFromResult(req.user._id, result);
  } catch (e) {
    console.error('[skillgap] learning-task sync failed:', e);
  }
  res.status(201).json({ result });
});
```

- [ ] **Step 4: Run test to verify it passes**

Run (from `server/`): `node --test "src/routes/skillgap.test.js"`
Expected: PASS — both tests green.

- [ ] **Step 5: Manually verify the full link-back (not unit-testable — live AI call)**

With the dev stack running, save a job from Job Discovery, open the Tracker board, click "Tailor Resume" on that card (this flow doesn't fully exist until Task 6/7 are done — come back to this step after finishing those two tasks), run a real analysis, then confirm: (a) the new `SkillGapResult` doc has `application` set to that card's id, and (b) the `Application` doc now has `skillGapResultId` set to that result's id.

- [ ] **Step 6: Commit**

```bash
git add server/src/routes/skillgap.js server/src/routes/skillgap.test.js
git commit -m "feat: link SkillGapResult back to its Application when analysis starts from the Tracker board"
```

---

### Task 6: Tracker board — "Tailor Resume" button and score badge

**Files:**
- Modify: `client/src/components/apptrackingboard/ApplicationCard.vue`
- Modify: `client/src/views/KanbanView.vue`

**Interfaces:**
- Produces: `ApplicationCard.vue` emits `tailor-resume` with the `app` object when its new button is clicked.
- Consumes (in `KanbanView.vue`): listens for `tailor-resume` and navigates to `/skill-gap?applicationId=<app._id>`.

**Verification for this task is manual** (no frontend test runner in this repo — see Global Constraints).

- [ ] **Step 1: Add the button + badge to `ApplicationCard.vue`**

In `client/src/components/apptrackingboard/ApplicationCard.vue`, add `tailor-resume` to the emits declared in the script block (line 5, next to `defineProps`):

```js
const props = defineProps({ app: Object });
const emit = defineEmits(['tailor-resume']);
```

Add the button in the template, replacing the existing `<slot>` block (lines 50-52) with:

```html
    <!-- only while the card is still in Saved: this is a pre-decision tool, not an ongoing one -->
    <button
      v-if="app.status === 'Saved'"
      type="button"
      class="btn btn-sm btn-outline-primary w-100 mt-2"
      v-on:pointerdown.stop
      v-on:click="emit('tailor-resume', app)"
    >
      <span v-if="app.skillGapScore != null" class="badge text-bg-light border me-1">{{ app.skillGapScore }}</span>
      Tailor Resume
    </button>

    <slot>
      <!-- Insert Dropdown Button to shift to other columns -->
    </slot>
```

(`v-on:pointerdown.stop` matches the existing mobile `<select>` in `KanbanView.vue` line 309 — both stop the card's own `pointerdown` drag-start handler from firing when the user means to interact with a control on the card, not drag it.)

- [ ] **Step 2: Wire it up in `KanbanView.vue`**

Add the router import (line 1-10, alongside the existing Vue imports):

```js
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
```

Add the router instance and handler near the other top-level `const`s (after line 27, `const user = computed(() => authStore.user);`):

```js
const user = computed(() => authStore.user);
const router = useRouter();
const kanbanColumns = ['Saved', 'Applied', 'Interview', 'Offered'];

function goToSkillGap (card) {
  router.push({ path: '/skill-gap', query: { applicationId: card._id } });
}
```

Listen for the new event on `<ApplicationCard>` in the board loop (line 305):

```html
              <ApplicationCard :app="app" v-on:tailor-resume="goToSkillGap">
```

- [ ] **Step 3: Manually verify**

Run `npm run dev` from `client/` (and the server dev stack). Open the Tracker board. Confirm: a "Tailor Resume" button shows on every card in the Saved column and on no other column's cards; clicking it navigates to `/skill-gap?applicationId=<that card's id>`; dragging a Saved card still works (the button doesn't start a drag).

- [ ] **Step 4: Commit**

```bash
git add client/src/components/apptrackingboard/ApplicationCard.vue client/src/views/KanbanView.vue
git commit -m "feat: add Tailor Resume button and score badge to Saved Tracker cards"
```

---

### Task 7: Skill Gap Analysis page — prefill from a Tracker card, resume an existing analysis

**Files:**
- Modify: `client/src/views/SkillGapView.vue`

**Interfaces:**
- Consumes: `GET /api/applications/:id` (Task 2), `openResult(id)` (already exists in this file, line 283).
- Produces: when the page is opened as `/skill-gap?applicationId=<id>`, it either opens that application's existing linked analysis (if `skillGapResultId` is set) or prefills the job form from that application's title/company/description/deadline. The `applicationId` (and the application's `mcfUuid`, as `job.jobId`/`job.source`) is included in the next `POST /api/skillgap` call so the link gets created.

**Verification for this task is manual** (no frontend test runner in this repo — see Global Constraints).

- [ ] **Step 1: Track the incoming `applicationId`**

In `client/src/views/SkillGapView.vue`, add state near the other route-query-derived state (after line 56, `const selectedResumeId = ref('')`):

```js
const route = useRoute()
const resumes = ref([])
const selectedResumeId = ref('')
const applicationId = ref(typeof route.query.applicationId === 'string' ? route.query.applicationId : '')
const applicationMcfUuid = ref('')
```

- [ ] **Step 2: Load and prefill from the application**

Add a new function after `loadResumes` (after line 69, its closing `}`):

```js
// Coming from the Tracker board's "Tailor Resume" button: either resume the analysis
// already linked to this card, or prefill the job form from the card's saved details.
async function loadFromApplication() {
  if (!applicationId.value) return
  try {
    const app = await api(`/api/applications/${applicationId.value}`)
    if (app.skillGapResultId) {
      await openResult(app.skillGapResultId)
      return
    }
    applicationMcfUuid.value = app.mcfUuid || ''
    job.value = {
      title: app.title || '',
      company: app.companyName || '',
      description: app.description || '',
      applicationDeadline: app.expiryDate ? app.expiryDate.slice(0, 10) : '',
    }
  } catch {
    // application missing/deleted since the link was created — leave the blank form
  }
}
```

- [ ] **Step 3: Send the link when analyzing**

In `analyze()` (lines 296-325), change the `api('/api/skillgap', ...)` call's body (lines 306-314) to:

```js
      body: {
        job: {
          title: job.value.title.trim(),
          company: job.value.company.trim(),
          description: job.value.description.trim(),
          applicationDeadline: job.value.applicationDeadline || undefined,
          ...(applicationId.value && { jobId: applicationMcfUuid.value || undefined, source: 'tracker' }),
        },
        ...(selectedResumeId.value && { resumeId: selectedResumeId.value }),
        ...(applicationId.value && { applicationId: applicationId.value }),
      },
```

- [ ] **Step 4: Call it on mount**

In `onMounted` (lines 417-423), add the call:

```js
onMounted(() => {
  loadProfile()
  loadHistory()
  loadTodos()
  loadResumes()
  loadFromApplication()
  window.addEventListener('keydown', onKey)
})
```

- [ ] **Step 5: Manually verify**

With the dev stack running: (a) save a job from Job Discovery, go to the Tracker board, click "Tailor Resume" — confirm the Skill Gap job form opens prefilled with that job's real title/company/description/deadline; (b) run an analysis, then go back to the Tracker board — confirm the card now shows the score badge (Task 6); (c) click "Tailor Resume" on that same card again — confirm it reopens the same analysis instead of showing a blank form; (d) go back to Task 5's Step 5 and confirm the `SkillGapResult.application`/`Application.skillGapResultId` link now round-trips end to end.

- [ ] **Step 6: Commit**

```bash
git add client/src/views/SkillGapView.vue
git commit -m "feat: prefill Skill Gap Analysis from a Tracker board card and resume its linked analysis"
```

---

## Self-Review

**Spec coverage:** every "Scope decision" and "Backend/Frontend change" bullet in the design spec maps to a task above — button-only-on-Saved (Task 6), description snapshot-on-save (Task 3), link back + resume existing (Tasks 4/5/7), manual resume selection (untouched, Task 7 doesn't add auto-pick), manual status after analysis (untouched, no task changes `status`). The spec's originally-proposed `GET /api/skillgap?applicationId=` lookup route turned out to be unnecessary once `Application.skillGapResultId` (Task 1) exists — Task 7 resumes an existing analysis via the already-existing `GET /api/skillgap/:id`, one request cheaper than the spec's sketch. Same approved behavior, simpler mechanism.

**Placeholder scan:** no TBD/TODO; every step shows real code.

**Type consistency:** `getApplicationByIdAndUser` (Task 1) → used by `getApplicationById` (Task 2) → `GET /api/applications/:id` → consumed as `api(`/api/applications/${applicationId.value}`)` in Task 7, reading `app.skillGapResultId`, `app.mcfUuid`, `app.title`, `app.companyName`, `app.description`, `app.expiryDate` — all real fields on the raw `Application` doc Task 2 returns (not the `toCard()` shape, which is list-only). `SkillGapResult.application` (Task 4) is set in Task 5's `POST /`; nothing downstream reads it directly (it's traceability, same as `sourceResume`) — consistent with the spec.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-11-02-job-tracker-skillgap-linking.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using `executing-plans`, batch execution with checkpoints

Which approach?
