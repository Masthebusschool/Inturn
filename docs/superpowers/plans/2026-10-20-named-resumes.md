# Named Resumes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user create, edit, duplicate and delete named, reusable resumes (independent of the base Profile) in a split-pane editor with a live formatted preview, and pick one as the starting point for a skill-gap job analysis.

**Architecture:** A new standalone `Resume` Mongoose collection + `/api/resumes` REST router (mirroring the existing `Shortlist`/`SkillGapResult` pattern), a new split-pane Vue editor page with its own live-preview component, and additive wiring into the existing `skillgap.js` route/`SkillGapResult` schema so an analysis can be seeded from a saved resume instead of the base Profile, with a `sourceResume` snapshot kept for history.

**Tech Stack:** Node 24 / Express 5 / Mongoose 9 (server), Vue 3 `<script setup>` + Vue Router + Bootstrap 5 (client), Node's built-in `node:test` runner (no new test dependency — none exists in this repo today).

## Global Constraints

- Node >=22.12.0 (root `package.json` engines field) — already satisfied; `node --test` requires no new dependency.
- No new npm dependencies anywhere in this plan. Reuse what's already installed: `express`, `mongoose`, `multer`, `cors` (server); `vue`, `vue-router`, `bootstrap` (client).
- All new server routes sit behind the existing `devUser` middleware and use the existing 404-not-403 ownership pattern (`skillgap.js`'s `loadOwned`) — never a different auth story.
- Destructive/input client actions use `window.confirm`/`window.prompt`, matching the existing pattern in `DraftEditor.vue`/`TailorChat.vue` — no new modal library.
- All client HTTP calls go through the existing `client/src/lib/api.js` `api()` wrapper — never raw `fetch`.
- Short display-name fields (`Resume.name`) are length-capped the same way `skillgap.js`'s `MAX_LABEL` caps `label` (80 chars). Content fields (`summary`, `contact.*`, experience/project/education bullets) are trim-only, uncapped — matching `profile.js`'s existing PUT cleaning, which `cleanBody` explicitly mirrors. (Clarified during Task 2's review: the original wording here implied universal capping; the actual, correct precedent caps only short labels and AI-bound pasted text like `skillgap.js`'s `description`, not free-form content fields.) Reuse the extracted sanitizers (Task 1) rather than re-inventing cleaning logic per file.
- No automated test calls the live Gemini API (the user is currently quota-limited, and nothing in this repo mocks it). AI-touching paths (`POST /api/resumes/:id/parse`'s success path, `skillgap.js`'s `resumeId` wiring) are verified manually against the running dev stack, with exact commands given in-task — consistent with `CLAUDE.md`'s "verify against the running app" standard. Pure logic that doesn't call AI (CRUD, ownership, the `profileFromResume` mapping) gets real automated tests.
- Spec reference: `docs/superpowers/specs/2026-10-20-named-resumes-design.md` (approved, committed as `c5af362`, with one post-approval factual correction already applied — no dark-mode toggle exists anywhere in the client, so the editor doesn't add one).

---

## Task 1: Resume model, sanitizer extraction, and `POST`/`GET /api/resumes`

**Files:**
- Create: `server/src/models/Resume.js`
- Create: `server/src/utils/sanitize.js`
- Modify: `server/src/routes/profile.js:1,37-84` (import shared sanitizers instead of defining them locally)
- Create: `server/src/routes/resumes.js`
- Modify: `server/src/index.js` (mount the new router)
- Modify: `server/package.json` (add `test` script)
- Create: `server/src/test/helpers.js`
- Create: `server/src/routes/resumes.test.js`

**Interfaces:**
- Produces (used by later tasks): `Resume` model (default export) with shape `{ user, name, contact: { fullName, phone, email, linkedin, github, portfolio }, summary, skills: [String], experience: [{ title, company, location, startDate, endDate, current, bullets: [String], skills: [String] }], projects: [{ name, startDate, endDate, bullets: [String], skills: [String] }], education: [{ school, degree, field, startDate, endDate, grade, bullets: [String] }], timestamps }`.
- Produces: `server/src/utils/sanitize.js` exports `s(v)`, `strList(v, keyOf?)`, `objList(v, build)`, `lowerKey(t)` — pure string/array cleaners, no imports.
- Produces: `resumes.js` exports a default Express router mounted at `/api/resumes`, with a local (not exported) `cleanBody(body)` and `loadOwned(req, res, select?)` used by later tasks in the same file.
- Produces: `server/src/test/helpers.js` exports `async startTestServer(mountPath, router) -> { base, close }` and `async ensureDb()`.

- [ ] **Step 1: Create the `Resume` model**

`server/src/models/Resume.js`:

```js
import mongoose from 'mongoose';

const resumeSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true },
    contact: {
      fullName: String, phone: String, email: String, linkedin: String, github: String, portfolio: String,
    },
    summary: String,
    skills: [String],
    experience: [
      {
        title: String, company: String, location: String, startDate: String, endDate: String,
        current: { type: Boolean, default: false }, bullets: [String], skills: [String],
      },
    ],
    projects: [{ name: String, startDate: String, endDate: String, bullets: [String], skills: [String] }],
    education: [
      { school: String, degree: String, field: String, startDate: String, endDate: String, grade: String, bullets: [String] },
    ],
  },
  { timestamps: true }
);

resumeSchema.index({ user: 1, updatedAt: -1 });

export default mongoose.model('Resume', resumeSchema);
```

- [ ] **Step 2: Extract shared sanitizers out of `profile.js`**

Create `server/src/utils/sanitize.js`:

```js
// Shared request-body sanitisers for profile-like string/array/object-list fields.
export const s = (v) => (typeof v === 'string' ? v.trim() : '');

// keyOf (optional) returns the comparison key for dedupe; first occurrence wins, original text is stored.
export const strList = (v, keyOf) => {
  const out = [];
  const seen = new Set();
  for (const x of Array.isArray(v) ? v : []) {
    const t = s(x);
    if (!t) continue;
    if (keyOf) {
      const k = keyOf(t);
      if (seen.has(k)) continue;
      seen.add(k);
    }
    out.push(t);
  }
  return out;
};

// Build each entry, then drop entries whose text/array fields are all blank.
export const objList = (v, build) =>
  (Array.isArray(v) ? v : [])
    .filter((x) => x && typeof x === 'object')
    .map(build)
    .filter((e) => Object.values(e).some((val) => (Array.isArray(val) ? val.length > 0 : typeof val === 'string' && val)));

export const lowerKey = (t) => t.toLowerCase();
```

Now point `server/src/routes/profile.js` at it instead of its local copies. Replace this block (currently lines 37–64):

```js
// ---- PUT sanitising ----
const s = (v) => (typeof v === 'string' ? v.trim() : '');
// keyOf (optional) returns the comparison key for dedupe; first occurrence wins, original text is stored.
const strList = (v, keyOf) => {
  const out = [];
  const seen = new Set();
  for (const x of Array.isArray(v) ? v : []) {
    const t = s(x);
    if (!t) continue;
    if (keyOf) {
      const k = keyOf(t);
      if (seen.has(k)) continue;
      seen.add(k);
    }
    out.push(t);
  }
  return out;
};
// Build each entry, then drop entries whose text/array fields are all blank.
const objList = (v, build) =>
  (Array.isArray(v) ? v : [])
    .filter((x) => x && typeof x === 'object')
    .map(build)
    .filter((e) => Object.values(e).some((val) => (Array.isArray(val) ? val.length > 0 : typeof val === 'string' && val)));

const lowerKey = (t) => t.toLowerCase();
```

with:

```js
// ---- PUT sanitising ----
import { s, strList, objList, lowerKey } from '../utils/sanitize.js';
```

Since that `import` must live at the top of the file with the other imports (ESM import statements are not valid mid-file), actually do this as two edits:
1. Add `import { s, strList, objList, lowerKey } from '../utils/sanitize.js';` to the top import block (after the existing `import { canonical } from '../utils/skillNormalize.js';` line).
2. Delete the local `s`/`strList`/`objList`/`lowerKey` definitions shown above (just delete those lines — everything below, `skillKey` and the `STRING_FIELDS`/`clean` object, stays as-is since it only *uses* these helpers).

- [ ] **Step 3: Verify `profile.js` still has no syntax errors**

Run: `node --check server/src/routes/profile.js`
Expected: no output (exit code 0).

- [ ] **Step 4: Create the resumes router with `POST /` and `GET /`**

`server/src/routes/resumes.js`:

```js
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

router.use(apiErrors);

export default router;
```

- [ ] **Step 5: Mount the router**

In `server/src/index.js`, add the import alongside the other route imports:

```js
import profileRouter from './routes/profile.js';
import resumesRouter from './routes/resumes.js';
```

And mount it alongside `app.use('/api/profile', profileRouter);`:

```js
app.use('/api/profile', profileRouter);
app.use('/api/resumes', resumesRouter);
```

- [ ] **Step 6: Add the `test` script**

In `server/package.json`, add to `"scripts"`:

```json
"test": "node --test src"
```

(Resulting `"scripts"` block has `dev`, `start`, and now `test`.)

- [ ] **Step 7: Create the test server helper**

`server/src/test/helpers.js`:

```js
import 'dotenv/config';
import express from 'express';
import mongoose from 'mongoose';
import http from 'node:http';

// Boots a real HTTP server wrapping `router` behind express.json(), on an ephemeral port.
// Tests hit it with fetch(`${base}/...`). Mirrors how index.js wires a router, minus logging.
export async function startTestServer(mountPath, router) {
  const app = express();
  app.use(express.json());
  app.use(mountPath, router);
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();
  return { base: `http://127.0.0.1:${port}${mountPath}`, close: () => new Promise((r) => server.close(r)) };
}

let connected = false;
export async function ensureDb() {
  if (connected) return;
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI not set — copy server/.env.example to server/.env and fill it in before running tests.');
  }
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
  connected = true;
}
```

- [ ] **Step 8: Write the failing tests**

`server/src/routes/resumes.test.js`:

```js
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import resumesRouter from './resumes.js';
import Resume from '../models/Resume.js';
import User from '../models/User.js';
import { ensureDb, startTestServer } from '../test/helpers.js';

const NAME_PREFIX = '__test_resumes__';
let base, close;

before(async () => {
  await ensureDb();
  ({ base, close } = await startTestServer('/api/resumes', resumesRouter));
});

after(async () => {
  await Resume.deleteMany({ name: new RegExp(`^${NAME_PREFIX}`) });
  await close();
  await mongoose.disconnect();
});

test('POST / creates a blank resume and GET / lists it newest-first', async () => {
  const res = await fetch(`${base}/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: `${NAME_PREFIX} blank`, seed: 'blank' }),
  });
  assert.equal(res.status, 201);
  const { resume } = await res.json();
  assert.equal(resume.name, `${NAME_PREFIX} blank`);
  assert.deepEqual(resume.skills, []);

  const listRes = await fetch(`${base}/`);
  const { resumes } = await listRes.json();
  assert.ok(resumes.some((r) => r.name === `${NAME_PREFIX} blank`));
});

test('POST / with seed "profile" copies the dev user\'s skills', async () => {
  const user = await User.findOneAndUpdate(
    { email: 'dev@inturn.local' },
    { $addToSet: { skills: `${NAME_PREFIX}-skill` } },
    { upsert: true, returnDocument: 'after' }
  );
  const res = await fetch(`${base}/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: `${NAME_PREFIX} from-profile`, seed: 'profile' }),
  });
  const { resume } = await res.json();
  assert.ok(resume.skills.includes(`${NAME_PREFIX}-skill`));
  // cleanup the skill we injected on the shared dev user
  user.skills = user.skills.filter((sk) => sk !== `${NAME_PREFIX}-skill`);
  await user.save();
});

test('POST / rejects a missing name', async () => {
  const res = await fetch(`${base}/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ seed: 'blank' }),
  });
  assert.equal(res.status, 400);
});
```

- [ ] **Step 9: Run the tests**

Run: `pnpm --filter ./server run test`
Expected: `# pass 3`, `# fail 0` (requires `server/.env` with a reachable `MONGODB_URI` — same requirement `npm run dev` already has).

- [ ] **Step 10: Commit**

```bash
git add server/src/models/Resume.js server/src/utils/sanitize.js server/src/routes/profile.js server/src/routes/resumes.js server/src/routes/resumes.test.js server/src/test/helpers.js server/src/index.js server/package.json
git commit -m "feat: add Resume model and POST/GET /api/resumes"
```

---

## Task 2: `GET/PUT/DELETE /api/resumes/:id`

**Files:**
- Modify: `server/src/routes/resumes.js` (add three routes, before `router.use(apiErrors);`)
- Modify: `server/src/routes/resumes.test.js` (append tests)

**Interfaces:**
- Consumes: `loadOwned(req, res, select?)`, `cleanBody(body)`, `MAX_NAME`, `Resume` from Task 1 (same file/module).
- Produces: nothing new consumed by later tasks beyond the router itself.

- [ ] **Step 1: Write the failing tests (append to `resumes.test.js`, before the closing of the file)**

```js
test('GET /:id returns the resume; a foreign/invalid id 404s', async () => {
  const created = await (await fetch(`${base}/`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: `${NAME_PREFIX} get`, seed: 'blank' }),
  })).json();

  const ok = await fetch(`${base}/${created.resume._id}`);
  assert.equal(ok.status, 200);
  assert.equal((await ok.json()).resume.name, `${NAME_PREFIX} get`);

  const notAnId = await fetch(`${base}/not-an-id`);
  assert.equal(notAnId.status, 404);

  const validButMissing = await fetch(`${base}/${new mongoose.Types.ObjectId()}`);
  assert.equal(validButMissing.status, 404);
});

test('PUT /:id replaces fields and bumps updatedAt', async () => {
  const created = await (await fetch(`${base}/`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: `${NAME_PREFIX} put`, seed: 'blank' }),
  })).json();

  const res = await fetch(`${base}/${created.resume._id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: `${NAME_PREFIX} put-renamed`,
      contact: { fullName: 'Aiden Lim', phone: '', email: '', linkedin: '', github: '', portfolio: '' },
      summary: 'Updated summary', skills: ['SQL', 'sql'], experience: [], projects: [], education: [],
    }),
  });
  assert.equal(res.status, 200);
  const { resume } = await res.json();
  assert.equal(resume.name, `${NAME_PREFIX} put-renamed`);
  assert.equal(resume.contact.fullName, 'Aiden Lim');
  assert.deepEqual(resume.skills, ['SQL']); // deduped case-insensitively, same as profile.js
});

test('PUT /:id rejects an empty name', async () => {
  const created = await (await fetch(`${base}/`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: `${NAME_PREFIX} put-empty`, seed: 'blank' }),
  })).json();
  const res = await fetch(`${base}/${created.resume._id}`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: '  ', contact: {}, summary: '', skills: [], experience: [], projects: [], education: [] }),
  });
  assert.equal(res.status, 400);
});

test('DELETE /:id removes it; a second GET 404s', async () => {
  const created = await (await fetch(`${base}/`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: `${NAME_PREFIX} delete`, seed: 'blank' }),
  })).json();
  const del = await fetch(`${base}/${created.resume._id}`, { method: 'DELETE' });
  assert.equal(del.status, 200);
  const after = await fetch(`${base}/${created.resume._id}`);
  assert.equal(after.status, 404);
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `pnpm --filter ./server run test`
Expected: the four new tests FAIL with 404s (routes don't exist yet — Express's unmatched-route fallthrough inside the router returns no response/ connection reset, or a 404 from `apiErrors`'s absence of a matching route — either way, not the asserted 200/400).

- [ ] **Step 3: Implement the three routes**

In `server/src/routes/resumes.js`, insert before `router.use(apiErrors);`:

```js
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
```

- [ ] **Step 4: Run tests again**

Run: `pnpm --filter ./server run test`
Expected: `# pass 7`, `# fail 0`.

- [ ] **Step 5: Commit**

```bash
git add server/src/routes/resumes.js server/src/routes/resumes.test.js
git commit -m "feat: add GET/PUT/DELETE /api/resumes/:id"
```

---

## Task 3: `POST /api/resumes/:id/duplicate`

**Files:**
- Modify: `server/src/routes/resumes.js`
- Modify: `server/src/routes/resumes.test.js`

**Interfaces:**
- Consumes: `loadOwned`, `s`, `MAX_NAME`, `Resume` (Task 1/2, same file).

- [ ] **Step 1: Write the failing tests**

Append to `resumes.test.js`:

```js
test('POST /:id/duplicate defaults to "Copy of <name>"', async () => {
  const created = await (await fetch(`${base}/`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: `${NAME_PREFIX} original`, seed: 'blank' }),
  })).json();
  const res = await fetch(`${base}/${created.resume._id}/duplicate`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}),
  });
  assert.equal(res.status, 201);
  const { resume } = await res.json();
  assert.equal(resume.name, `Copy of ${NAME_PREFIX} original`);
  assert.notEqual(resume._id, created.resume._id);
});

test('POST /:id/duplicate accepts a custom name', async () => {
  const created = await (await fetch(`${base}/`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: `${NAME_PREFIX} source`, seed: 'blank' }),
  })).json();
  const res = await fetch(`${base}/${created.resume._id}/duplicate`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: `${NAME_PREFIX} custom-copy` }),
  });
  const { resume } = await res.json();
  assert.equal(resume.name, `${NAME_PREFIX} custom-copy`);
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `pnpm --filter ./server run test`
Expected: both new tests FAIL (no `/duplicate` route yet).

- [ ] **Step 3: Implement the route**

Insert before `router.use(apiErrors);` in `resumes.js`:

```js
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
```

- [ ] **Step 4: Run tests again**

Run: `pnpm --filter ./server run test`
Expected: `# pass 9`, `# fail 0`.

- [ ] **Step 5: Commit**

```bash
git add server/src/routes/resumes.js server/src/routes/resumes.test.js
git commit -m "feat: add POST /api/resumes/:id/duplicate"
```

---

## Task 4: `POST /api/resumes/:id/parse`

**Files:**
- Modify: `server/src/routes/resumes.js`
- Modify: `server/src/routes/resumes.test.js`

**Interfaces:**
- Consumes: `extractPdfText` from `server/src/services/pdfText.js`, `parseResume` + `AIServiceError` from `server/src/services/aiService.js` (both already exist, confirmed this session), `loadOwned`.

- [ ] **Step 1: Write the failing tests (validation paths only — the success path calls live Gemini and is verified manually in Step 5)**

Append to `resumes.test.js`:

```js
test('POST /:id/parse 404s for a foreign/invalid resume id before touching the upload', async () => {
  const res = await fetch(`${base}/${new mongoose.Types.ObjectId()}/parse`, { method: 'POST' });
  assert.equal(res.status, 404);
});

test('POST /:id/parse rejects a missing file', async () => {
  const created = await (await fetch(`${base}/`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: `${NAME_PREFIX} parse-nofile`, seed: 'blank' }),
  })).json();
  const res = await fetch(`${base}/${created.resume._id}/parse`, { method: 'POST' });
  assert.equal(res.status, 400);
});

test('POST /:id/parse rejects a non-PDF upload', async () => {
  const created = await (await fetch(`${base}/`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: `${NAME_PREFIX} parse-badtype`, seed: 'blank' }),
  })).json();
  const form = new FormData();
  form.append('resume', new Blob(['not a pdf'], { type: 'text/plain' }), 'resume.txt');
  const res = await fetch(`${base}/${created.resume._id}/parse`, { method: 'POST', body: form });
  assert.equal(res.status, 400);
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `pnpm --filter ./server run test`
Expected: the three new tests FAIL (no `/parse` route yet).

- [ ] **Step 3: Add multer and the route**

In `server/src/routes/resumes.js`, add to the imports:

```js
import multer from 'multer';
import { extractPdfText } from '../services/pdfText.js';
import { parseResume, AIServiceError } from '../services/aiService.js';
```

Add below the `const skillKey = ...` line:

```js
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });
```

Insert the route before `router.use(apiErrors);`:

```js
router.post('/:id/parse', upload.single('resume'), async (req, res) => {
  const resume = await loadOwned(req, res, '_id');
  if (!resume) return;
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
```

And change the final error-handling block from just `router.use(apiErrors);` to also catch `AIServiceError` first, matching `skillgap.js`'s pattern:

```js
router.use((err, req, res, next) => {
  if (err instanceof AIServiceError) return res.status(err.status).json({ error: err.message, code: err.code });
  next(err);
});
router.use(apiErrors);
```

- [ ] **Step 4: Run tests again**

Run: `pnpm --filter ./server run test`
Expected: `# pass 12`, `# fail 0`.

- [ ] **Step 5: Manually verify the success path against the running app**

This calls live Gemini (`modelFor('resume')`), so it isn't automated. With the dev stack running (`pnpm dev`) and a real PDF resume file at hand:

```bash
# Create a resume to attach the parse to, capture its id from the response, then:
curl -s -X POST http://localhost:3000/api/resumes -H "Content-Type: application/json" -d '{"name":"manual-verify","seed":"blank"}'
curl -s -X POST http://localhost:3000/api/resumes/<id-from-above>/parse -F "resume=@/path/to/resume.pdf"
```

Expected: `201`/`200` JSON with a `draft` object shaped like `parseResume()`'s return value (`summary`, `skills`, `experience`, `projects`, `education`). If the Gemini quota is still exhausted, expect the `ai_daily_quota` error shape instead (`{ error, code: "ai_daily_quota" }`, HTTP 429) — that's the correct behavior, not a bug; re-verify once quota resets.

- [ ] **Step 6: Commit**

```bash
git add server/src/routes/resumes.js server/src/routes/resumes.test.js
git commit -m "feat: add POST /api/resumes/:id/parse"
```

---

## Task 5: `SkillGapResult.sourceResume` + `profileFromResume` helper

**Files:**
- Modify: `server/src/models/SkillGapResult.js`
- Create: `server/src/utils/resumeProfile.js`
- Create: `server/src/utils/resumeProfile.test.js`

**Interfaces:**
- Produces: `profileFromResume(resume) -> { email, name, educationLevel, summary, skills, targetRoles, targetIndustries, experience, projects, education, updatedAt }` — same shape `toProfile()` produces, consumed by Task 6's `skillgap.js` wiring.
- Produces: `SkillGapResult.sourceResume = { resume: ObjectId, name: String, resumeUpdatedAt: Date } | undefined`.

- [ ] **Step 1: Write the failing test**

`server/src/utils/resumeProfile.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { profileFromResume } from './resumeProfile.js';

test('profileFromResume maps a resume into the scoring-profile shape, excluding contact fields', () => {
  const resume = {
    contact: { fullName: 'Aiden Lim', email: 'aiden@example.com' },
    summary: 'Second-year IS student.',
    skills: ['Node.js', 'SQL'],
    experience: [{ title: 'Intern', company: 'Acme', bullets: ['Built APIs'], skills: ['Node.js'] }],
    projects: [{ name: 'CampusSwap', bullets: ['Built a marketplace'], skills: ['React'] }],
    education: [{ school: 'SMU', degree: 'BSc', field: 'IS' }],
    updatedAt: new Date('2026-01-01'),
  };
  const profile = profileFromResume(resume);
  assert.equal(profile.summary, 'Second-year IS student.');
  assert.deepEqual(profile.skills, ['Node.js', 'SQL']);
  assert.equal(profile.experience[0].company, 'Acme');
  assert.equal(profile.projects[0].name, 'CampusSwap');
  assert.equal(profile.education[0].school, 'SMU');
  assert.equal(profile.email, ''); // contact is a different namespace; nothing in scoring reads it
  assert.equal(profile.name, '');
  assert.deepEqual(profile.updatedAt, new Date('2026-01-01'));
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test server/src/utils/resumeProfile.test.js`
Expected: FAIL — `Cannot find module './resumeProfile.js'`.

- [ ] **Step 3: Implement `profileFromResume`**

`server/src/utils/resumeProfile.js`:

```js
const plain = (arr) => (arr || []).map((x) => (x && typeof x.toObject === 'function' ? x.toObject() : x));

// Maps a Resume document into the same shape toProfile() produces, for skill-gap scoring
// (analyzeSkillGap / generateTailoredResume read only summary/skills/experience/projects/education).
// email/name are left blank: a resume's contact block is a different namespace from profile
// identity, and nothing in the scoring path reads either field.
export function profileFromResume(resume) {
  return {
    email: '',
    name: '',
    educationLevel: '',
    summary: resume.summary || '',
    skills: [...(resume.skills || [])],
    targetRoles: [],
    targetIndustries: [],
    experience: plain(resume.experience),
    projects: plain(resume.projects),
    education: plain(resume.education),
    updatedAt: resume.updatedAt,
  };
}
```

- [ ] **Step 4: Run the test again**

Run: `node --test server/src/utils/resumeProfile.test.js`
Expected: `# pass 1`, `# fail 0`.

- [ ] **Step 5: Add `sourceResume` to `SkillGapResult`**

In `server/src/models/SkillGapResult.js`, insert after the `tailoredResume: { ... },` block (right before the `// Editable copy of the draft...` comment):

```js
    // Traceability snapshot: which saved Resume (and which version of it) seeded this analysis's
    // tailored draft. Set only when the analysis was started from a resume rather than the base
    // Profile; no live link back (see spec's "no save-back" decision).
    sourceResume: new mongoose.Schema(
      { resume: { type: mongoose.Schema.Types.ObjectId, ref: 'Resume' }, name: String, resumeUpdatedAt: Date },
      { _id: false }
    ),
```

- [ ] **Step 6: Run the full server test suite**

Run: `pnpm --filter ./server run test`
Expected: `# pass 13`, `# fail 0` (12 from Tasks 1–4 plus this task's 1).

- [ ] **Step 7: Commit**

```bash
git add server/src/models/SkillGapResult.js server/src/utils/resumeProfile.js server/src/utils/resumeProfile.test.js
git commit -m "feat: add sourceResume tracking field and profileFromResume helper"
```

---

## Task 6: Wire `resumeId` into `POST /api/skillgap` and `GET /api/skillgap/history`

**Files:**
- Modify: `server/src/routes/skillgap.js:1-59,62-69`

**Interfaces:**
- Consumes: `Resume` (Task 1), `profileFromResume` (Task 5).

- [ ] **Step 1: Add the imports**

At the top of `server/src/routes/skillgap.js`, add to the existing import block:

```js
import Resume from '../models/Resume.js';
import { profileFromResume } from '../utils/resumeProfile.js';
```

- [ ] **Step 2: Replace the `POST /` handler**

Replace (current lines 32–59):

```js
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
```

with:

```js
// Analyze the user's profile (or a saved resume) against one job, then build a tailored resume from it.
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

  const resumeId = str(req.body?.resumeId);
  let profile;
  let sourceResume;
  if (resumeId) {
    const resumeDoc = mongoose.isValidObjectId(resumeId) ? await Resume.findById(resumeId) : null;
    if (!resumeDoc || !resumeDoc.user.equals(req.user._id)) {
      return res.status(404).json({ error: 'Resume not found' });
    }
    profile = profileFromResume(resumeDoc);
    sourceResume = { resume: resumeDoc._id, name: resumeDoc.name, resumeUpdatedAt: resumeDoc.updatedAt };
  } else {
    profile = toProfile(req.user);
  }
  if (!profile.skills.length && !profile.experience.length && !profile.projects.length) {
    return res.status(400).json({
      error: resumeId
        ? 'That resume is empty — add skills or experience to it first.'
        : 'Your profile is empty — add skills or experience on the Profile page first.',
    });
  }
  // Previous run for the same posting: anchors verdict stability across re-scores.
  const prior = await SkillGapResult.findOne({ user: req.user._id, 'job.title': job.title, 'job.company': job.company })
    .sort({ createdAt: -1 })
    .select('+profileSnapshot')
    .lean();
  const gap = await analyzeSkillGap(profile, job, prior);
  const tailoredResume = await generateTailoredResume(profile, job, gap);
  const result = await SkillGapResult.create({
    user: req.user._id, job, ...gap, tailoredResume, ...(sourceResume && { sourceResume }),
  });
  res.status(201).json({ result });
});
```

- [ ] **Step 3: Surface `sourceResume.name` in the history list**

Replace (current line 66):

```js
    .select('job.title job.company atsScore band label forkedFrom draftScore.atsScore draftScore.band createdAt')
```

with:

```js
    .select('job.title job.company atsScore band label forkedFrom draftScore.atsScore draftScore.band createdAt sourceResume.name')
```

- [ ] **Step 4: Static syntax check**

Run: `node --check server/src/routes/skillgap.js`
Expected: no output (exit code 0).

- [ ] **Step 5: Manually verify against the running app (calls live Gemini — not automated, same reasoning as Task 4 Step 5)**

With the dev stack running and at least one saved resume (from Task 1's routes) that has skills/experience:

```bash
curl -s -X POST http://localhost:3000/api/skillgap -H "Content-Type: application/json" \
  -d '{"job":{"title":"Backend Intern","description":"Looking for a backend intern with SQL and Node.js experience."},"resumeId":"<a-real-resume-id>"}'
curl -s http://localhost:3000/api/skillgap/history
```

Expected: the first call's JSON `result` has no `sourceResume` omission — it should include `sourceResume: { resume, name, resumeUpdatedAt }` matching the resume used. The second call's `results` array should show that entry with `sourceResume.name` populated. Then repeat the first call *without* `resumeId` and confirm the created result has no `sourceResume` field at all (backward-compatible path unchanged).

- [ ] **Step 6: Commit**

```bash
git add server/src/routes/skillgap.js
git commit -m "feat: let skill-gap analysis start from a saved resume"
```

---

## Task 7: Client router, nav link, and `ResumesView.vue` (list page)

**Files:**
- Modify: `client/src/router/index.js`
- Modify: `client/src/App.vue`
- Create: `client/src/views/ResumesView.vue`

**Interfaces:**
- Consumes: `api()` from `client/src/lib/api.js`; server routes `GET/POST /api/resumes`, `POST /api/resumes/:id/duplicate`, `DELETE /api/resumes/:id` (Tasks 1–3).
- Produces: route `/resumes` (name `resumes`) and `/resumes/:id` (name `resume-editor`, prop `id`) for Task 8 to fill in.

- [ ] **Step 1: Add the routes**

In `client/src/router/index.js`, add after the `/profile` route:

```js
  { path: '/resumes', name: 'resumes', component: () => import('../views/ResumesView.vue') },
  { path: '/resumes/:id', name: 'resume-editor', component: () => import('../views/ResumeEditorView.vue'), props: true },
```

(`ResumeEditorView.vue` doesn't exist until Task 8 — that's fine, Vite resolves the dynamic import lazily and nothing navigates there yet.)

- [ ] **Step 2: Add the nav link**

In `client/src/App.vue`, add a new `<li class="nav-item">` right after the Profile link:

```html
          <li class="nav-item"><RouterLink class="nav-link" active-class="active" to="/profile">Profile</RouterLink></li>
          <li class="nav-item"><RouterLink class="nav-link" active-class="active" to="/resumes">Resumes</RouterLink></li>
```

- [ ] **Step 3: Create `ResumesView.vue`**

`client/src/views/ResumesView.vue`:

```vue
<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { api } from '../lib/api.js'

const router = useRouter()
const resumes = ref([])
const loading = ref(true)
const loadError = ref('')
const creating = ref(false)
const createError = ref('')
const busyId = ref('')

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '')

async function load() {
  loading.value = true
  loadError.value = ''
  try {
    const { resumes: r } = await api('/api/resumes')
    resumes.value = r
  } catch (e) {
    loadError.value = e.message
  } finally {
    loading.value = false
  }
}
onMounted(load)

async function createResume() {
  const name = window.prompt('Name this resume (e.g. "Backend Intern"):')
  if (!name || !name.trim()) return
  const fromProfile = window.confirm('Start from your saved Profile data? Click Cancel to start blank.')
  creating.value = true
  createError.value = ''
  try {
    const { resume } = await api('/api/resumes', { method: 'POST', body: { name: name.trim(), seed: fromProfile ? 'profile' : 'blank' } })
    router.push(`/resumes/${resume._id}`)
  } catch (e) {
    createError.value = e.message
  } finally {
    creating.value = false
  }
}

async function duplicate(r) {
  busyId.value = r._id
  try {
    await api(`/api/resumes/${r._id}/duplicate`, { method: 'POST', body: {} })
    await load()
  } catch (e) {
    loadError.value = e.message
  } finally {
    busyId.value = ''
  }
}

async function remove(r) {
  if (!window.confirm(`Delete "${r.name}"? This can't be undone.`)) return
  busyId.value = r._id
  try {
    await api(`/api/resumes/${r._id}`, { method: 'DELETE' })
    resumes.value = resumes.value.filter((x) => x._id !== r._id)
  } catch (e) {
    loadError.value = e.message
  } finally {
    busyId.value = ''
  }
}
</script>

<template>
  <section class="pb-5">
    <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-4">
      <div>
        <h1 class="h3 mb-1">My resumes</h1>
        <p class="text-body-secondary mb-0">Keep a few versions ready for the roles you're targeting, then tailor one per application.</p>
      </div>
      <button type="button" class="btn btn-primary" :disabled="creating" @click="createResume">
        <span v-if="creating" class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>+ New resume
      </button>
    </div>

    <div v-if="createError" class="alert alert-danger" role="alert">{{ createError }}</div>
    <div v-if="loadError" class="alert alert-danger" role="alert">{{ loadError }}</div>

    <div v-if="loading" class="d-flex align-items-center gap-2 text-body-secondary" role="status">
      <span class="spinner-border spinner-border-sm" aria-hidden="true"></span> Loading…
    </div>

    <div v-else-if="!resumes.length" class="card shadow-sm">
      <div class="card-body text-center py-5">
        <h2 class="h5">No resumes yet</h2>
        <p class="text-body-secondary mb-0">Create one to get a split-view editor with a live preview.</p>
      </div>
    </div>

    <div v-else class="list-group shadow-sm">
      <div v-for="r in resumes" :key="r._id" class="list-group-item d-flex flex-wrap justify-content-between align-items-center gap-2">
        <RouterLink :to="`/resumes/${r._id}`" class="text-decoration-none flex-grow-1 min-w-0">
          <div class="fw-semibold text-truncate">{{ r.name }}</div>
          <small class="text-body-secondary">Updated {{ fmtDate(r.updatedAt) }}</small>
        </RouterLink>
        <div class="d-flex gap-2 flex-shrink-0">
          <button type="button" class="btn btn-sm btn-outline-secondary" :disabled="busyId === r._id" @click="duplicate(r)">Duplicate</button>
          <button type="button" class="btn btn-sm btn-outline-danger" :disabled="busyId === r._id" @click="remove(r)">Delete</button>
        </div>
      </div>
    </div>
  </section>
</template>
```

- [ ] **Step 4: Manually verify in the browser**

Run: `pnpm dev` (starts client + server), open `http://localhost:5173/resumes`.
Expected: "My resumes" page loads with an empty state; "+ New resume" prompts for a name, then a start-from-Profile confirm, `POST`s, and (since `ResumeEditorView.vue` doesn't exist yet) shows Vite's "Failed to resolve import" dev overlay when it navigates to `/resumes/:id` — that's expected until Task 8. Go back to `/resumes` and confirm the new resume now appears in the list with "Updated just now". Confirm Delete removes it (with the confirm dialog) and Duplicate creates a second row.

- [ ] **Step 5: Commit**

```bash
git add client/src/router/index.js client/src/App.vue client/src/views/ResumesView.vue
git commit -m "feat: add My Resumes list page"
```

---

## Task 8: `ResumeEditorView.vue` core — Contact/Summary/Skills, live preview, load/save/cancel

**Files:**
- Create: `client/src/components/resumes/ResumePreview.vue`
- Create: `client/src/views/ResumeEditorView.vue`

**Interfaces:**
- Consumes: `api()`; `GET/PUT /api/resumes/:id` (Task 2).
- Produces: `ResumePreview.vue` prop `form: { contact, summary, skills, experience, projects, education }` (array fields are plain arrays, not textarea-backed) — Task 9 extends the editor's `form`/`previewData` with real experience/projects/education rows, same shape this task establishes for the empty-array case.

- [ ] **Step 1: Create the preview component**

`client/src/components/resumes/ResumePreview.vue`:

```vue
<script setup>
defineProps({
  form: { type: Object, required: true }, // { contact, summary, skills, experience, projects, education } — see ResumeEditorView's previewData
})

const dateRange = (e) => [e.startDate, e.endDate].filter(Boolean).join(' – ')
const contactLine = (c) => [c.phone, c.email, c.linkedin, c.github, c.portfolio].filter(Boolean).join(' · ')
</script>

<template>
  <article class="rp-paper">
    <header class="rp-head">
      <div class="rp-name">{{ form.contact.fullName || 'Your name' }}</div>
      <div v-if="contactLine(form.contact)" class="rp-contact">{{ contactLine(form.contact) }}</div>
    </header>

    <p v-if="form.summary" class="rp-summary">{{ form.summary }}</p>

    <template v-if="form.education.length">
      <h3 class="rp-h">Education</h3>
      <div v-for="(e, i) in form.education" :key="i" class="mb-3">
        <div class="d-flex justify-content-between gap-2">
          <span class="fw-semibold">{{ e.school }}</span>
          <span v-if="dateRange(e)" class="text-body-secondary small flex-shrink-0">{{ dateRange(e) }}</span>
        </div>
        <div v-if="e.degree || e.field || e.grade" class="fst-italic small">
          {{ [e.degree, e.field].filter(Boolean).join(', ') }}<template v-if="e.grade"> | {{ e.grade }}</template>
        </div>
        <ul v-if="e.bullets.length" class="mb-0 ps-3 small"><li v-for="(b, j) in e.bullets" :key="j">{{ b }}</li></ul>
      </div>
    </template>

    <template v-if="form.projects.length">
      <h3 class="rp-h">Personal Projects</h3>
      <div v-for="(p, i) in form.projects" :key="i" class="mb-3">
        <div class="d-flex justify-content-between gap-2">
          <span class="fw-semibold">{{ p.name }}</span>
          <span v-if="dateRange(p)" class="text-body-secondary small flex-shrink-0">{{ dateRange(p) }}</span>
        </div>
        <div v-if="p.skills.length" class="fst-italic small">({{ p.skills.join(', ') }})</div>
        <ul v-if="p.bullets.length" class="mb-0 ps-3 small"><li v-for="(b, j) in p.bullets" :key="j">{{ b }}</li></ul>
      </div>
    </template>

    <template v-if="form.experience.length">
      <h3 class="rp-h">Professional Experience</h3>
      <div v-for="(x, i) in form.experience" :key="i" class="mb-3">
        <div class="d-flex justify-content-between gap-2">
          <span class="fw-semibold">{{ x.title }}<template v-if="x.company"> — {{ x.company }}</template><template v-if="x.location"> · {{ x.location }}</template></span>
          <span v-if="dateRange(x)" class="text-body-secondary small flex-shrink-0">{{ dateRange(x) }}</span>
        </div>
        <ul v-if="x.bullets.length" class="mb-0 ps-3 small"><li v-for="(b, j) in x.bullets" :key="j">{{ b }}</li></ul>
      </div>
    </template>

    <template v-if="form.skills.length">
      <h3 class="rp-h">Skills</h3>
      <p class="mb-0 small">{{ form.skills.join(' · ') }}</p>
    </template>
  </article>
</template>

<style scoped>
.rp-paper { background: #fff; color: #212529; padding: 1.75rem; font-size: 0.9rem; line-height: 1.5; border: 1px solid var(--bs-border-color); border-radius: 0.5rem; box-shadow: var(--bs-box-shadow-sm); }
.rp-head { text-align: center; border-bottom: 2px solid #212529; padding-bottom: 0.6rem; margin-bottom: 1rem; }
.rp-name { font-size: 1.5rem; font-weight: 700; letter-spacing: 0.02em; }
.rp-contact { color: #495057; font-size: 0.8rem; margin-top: 0.2rem; }
.rp-summary { margin-bottom: 1rem; }
.rp-h { font-size: 0.78rem; letter-spacing: 0.08em; text-transform: uppercase; border-bottom: 1px solid #dee2e6; padding-bottom: 0.2rem; margin: 1.1rem 0 0.6rem; }
</style>
```

- [ ] **Step 2: Create the editor view (core fields only — Experience/Projects/Education arrive in Task 9)**

`client/src/views/ResumeEditorView.vue`:

```vue
<script setup>
import { reactive, ref, computed, nextTick, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { api } from '../lib/api.js'
import ResumePreview from '../components/resumes/ResumePreview.vue'

const props = defineProps({ id: { type: String, required: true } })
const router = useRouter()

const lines = (t) => (t || '').split('\n').map((x) => x.trim()).filter(Boolean)
const csv = (t) => (t || '').split(',').map((x) => x.trim()).filter(Boolean)

const form = reactive({
  name: '',
  contact: { fullName: '', phone: '', email: '', linkedin: '', github: '', portfolio: '' },
  summary: '',
  skills: [],
  experience: [],
  projects: [],
  education: [],
})

const loading = ref(true)
const loadError = ref('')
const saving = ref(false)
const saveError = ref('')
const saved = ref(false)
const dirty = ref(false)
let loaded = false

function applyResume(r = {}) {
  loaded = false
  form.name = r.name || ''
  form.contact = { fullName: '', phone: '', email: '', linkedin: '', github: '', portfolio: '', ...(r.contact || {}) }
  form.summary = r.summary || ''
  form.skills = [...(r.skills || [])]
  form.experience = []
  form.projects = []
  form.education = []
  dirty.value = false
  nextTick(() => { loaded = true })
}

onMounted(async () => {
  try {
    const { resume } = await api(`/api/resumes/${props.id}`)
    applyResume(resume)
  } catch (e) {
    loadError.value = e.message
  } finally {
    loading.value = false
  }
})

function payload() {
  return {
    name: form.name.trim(),
    contact: { ...form.contact },
    summary: form.summary.trim(),
    skills: form.skills,
    experience: [],
    projects: [],
    education: [],
  }
}

const previewData = computed(() => ({
  contact: form.contact,
  summary: form.summary,
  skills: form.skills,
  experience: [],
  projects: [],
  education: [],
}))

async function save() {
  saving.value = true
  saveError.value = ''
  saved.value = false
  try {
    const { resume } = await api(`/api/resumes/${props.id}`, { method: 'PUT', body: payload() })
    applyResume(resume)
    saved.value = true
  } catch (e) {
    saveError.value = e.message
  } finally {
    saving.value = false
  }
}

function cancel() {
  if (dirty.value && !window.confirm('Discard unsaved changes?')) return
  router.push('/resumes')
}

// Placeholder for Task 10 (Upload PDF); wired here so the button exists but does nothing destructive yet.
const parsing = ref(false)
function onFile() {}
</script>

<template>
  <section class="pb-5">
    <div v-if="loading" class="d-flex align-items-center gap-2 text-body-secondary mb-3" role="status">
      <span class="spinner-border spinner-border-sm" aria-hidden="true"></span> Loading…
    </div>
    <div v-if="loadError" class="alert alert-danger" role="alert">{{ loadError }}</div>

    <template v-if="!loading && !loadError">
      <div class="d-flex flex-wrap align-items-center gap-3 mb-4">
        <RouterLink to="/resumes" class="btn btn-outline-secondary btn-sm" aria-label="Back to My resumes">&larr;</RouterLink>
        <div class="flex-grow-1 min-w-0">
          <input
            v-model="form.name"
            class="form-control form-control-lg border-0 px-0 fw-semibold"
            style="font-size: 1.4rem"
            placeholder="Resume name"
            aria-label="Resume name"
            @input="dirty = loaded ? true : dirty"
          />
          <div class="text-body-secondary small">Resume details</div>
        </div>
        <div class="d-flex gap-2 flex-shrink-0">
          <label class="btn btn-outline-secondary btn-sm mb-0">
            <span v-if="parsing" class="spinner-border spinner-border-sm me-1" aria-hidden="true"></span>{{ parsing ? 'Parsing…' : 'Upload PDF' }}
            <input type="file" accept="application/pdf" class="d-none" :disabled="parsing" @change="onFile" />
          </label>
          <button type="button" class="btn btn-outline-secondary btn-sm" @click="cancel">Cancel</button>
          <button type="button" class="btn btn-primary btn-sm" :disabled="saving" @click="save">
            <span v-if="saving" class="spinner-border spinner-border-sm me-1" aria-hidden="true"></span>{{ saving ? 'Saving…' : 'Save' }}
          </button>
        </div>
      </div>

      <div v-if="saveError" class="alert alert-danger" role="alert">{{ saveError }}</div>
      <div v-if="saved && !dirty" class="alert alert-success py-2" role="status">Resume saved</div>

      <div class="row g-4">
        <div class="col-12 col-lg-6">
          <div class="card shadow-sm mb-4">
            <div class="card-body">
              <h2 class="h5 mb-3">Contact</h2>
              <div class="row g-3">
                <div class="col-12 col-md-6">
                  <label for="r-name" class="form-label">Full name</label>
                  <input id="r-name" v-model="form.contact.fullName" class="form-control" />
                </div>
                <div class="col-12 col-md-6">
                  <label for="r-phone" class="form-label">Phone</label>
                  <input id="r-phone" v-model="form.contact.phone" class="form-control" />
                </div>
                <div class="col-12 col-md-6">
                  <label for="r-email" class="form-label">Email</label>
                  <input id="r-email" v-model="form.contact.email" type="email" class="form-control" />
                </div>
                <div class="col-12 col-md-6">
                  <label for="r-linkedin" class="form-label">LinkedIn</label>
                  <input id="r-linkedin" v-model="form.contact.linkedin" class="form-control" />
                </div>
                <div class="col-12 col-md-6">
                  <label for="r-github" class="form-label">GitHub</label>
                  <input id="r-github" v-model="form.contact.github" class="form-control" />
                </div>
                <div class="col-12 col-md-6">
                  <label for="r-portfolio" class="form-label">Portfolio</label>
                  <input id="r-portfolio" v-model="form.contact.portfolio" class="form-control" />
                </div>
              </div>
            </div>
          </div>

          <div class="card shadow-sm mb-4">
            <div class="card-body">
              <h2 class="h5 mb-3">Summary</h2>
              <textarea v-model="form.summary" class="form-control" rows="4" placeholder="A few sentences about you, your strengths and what you're aiming for."></textarea>
            </div>
          </div>

          <div class="card shadow-sm mb-4">
            <div class="card-body">
              <h2 class="h5 mb-3">Skills</h2>
              <input
                class="form-control"
                placeholder="Comma-separated, e.g. Python, SQL, Figma"
                :value="form.skills.join(', ')"
                @change="form.skills = csv($event.target.value)"
              />
            </div>
          </div>
        </div>

        <div class="col-12 col-lg-6">
          <div class="sticky-top" style="top: 1rem">
            <div class="text-body-secondary small mb-2">Live preview</div>
            <ResumePreview :form="previewData" />
          </div>
        </div>
      </div>
    </template>
  </section>
</template>
```

Watching `form` for the `dirty` flag only covers the name input in this task (via `@input`) — Task 9 switches this to a proper `watch(form, ...)` once the repeatable sections exist, matching `ProfileView.vue`'s established pattern.

- [ ] **Step 3: Manually verify in the browser**

With `pnpm dev` running, go to `/resumes`, create a resume (or open one created in Task 7), and confirm:
- The editor loads at `/resumes/:id` with the Contact/Summary/Skills cards on the left and a live preview on the right.
- Typing in Full name / Summary / Skills updates the preview immediately (centered name, "·"-joined contact line, uppercase "Skills" section).
- Save persists changes (reload the page — they're still there); Cancel with unsaved changes prompts to discard; the back arrow returns to `/resumes`.

- [ ] **Step 4: Commit**

```bash
git add client/src/components/resumes/ResumePreview.vue client/src/views/ResumeEditorView.vue
git commit -m "feat: add resume editor core (Contact/Summary/Skills + live preview)"
```

---

## Task 9: `ResumeEditorView.vue` — Experience, Projects, Education sections

**Files:**
- Modify: `client/src/views/ResumeEditorView.vue`

**Interfaces:**
- Consumes/extends the `form`/`previewData`/`payload()`/`applyResume()` established in Task 8, same file.

- [ ] **Step 1: Add row-form converters and key generator**

In the `<script setup>` block, right after the `csv` helper, add:

```js
let keySeq = 0
const nextKey = () => `k${++keySeq}`

const expToForm = (e = {}) => ({
  key: e._id || nextKey(), title: e.title || '', company: e.company || '', location: e.location || '',
  startDate: e.startDate || '', endDate: e.endDate || '', current: !!e.current,
  bulletsText: (e.bullets || []).join('\n'), skillsText: (e.skills || []).join(', '),
})
const projToForm = (p = {}) => ({
  key: p._id || nextKey(), name: p.name || '', startDate: p.startDate || '', endDate: p.endDate || '',
  bulletsText: (p.bullets || []).join('\n'), skillsText: (p.skills || []).join(', '),
})
const eduToForm = (e = {}) => ({
  key: e._id || nextKey(), school: e.school || '', degree: e.degree || '', field: e.field || '', grade: e.grade || '',
  startDate: e.startDate || '', endDate: e.endDate || '', bulletsText: (e.bullets || []).join('\n'),
})

const addExp = () => form.experience.push(expToForm())
const addProj = () => form.projects.push(projToForm())
const addEdu = () => form.education.push(eduToForm())
const removeAt = (list, i) => list.splice(i, 1)
```

- [ ] **Step 2: Wire them into `applyResume`, `payload`, and `previewData`**

Replace (in `applyResume`):

```js
  form.experience = []
  form.projects = []
  form.education = []
```

with:

```js
  form.experience = (r.experience || []).map(expToForm)
  form.projects = (r.projects || []).map(projToForm)
  form.education = (r.education || []).map(eduToForm)
```

Replace (in `payload()` — the one whose `contact` line reads `contact: { ...form.contact },`):

```js
    contact: { ...form.contact },
    summary: form.summary.trim(),
    skills: form.skills,
    experience: [],
    projects: [],
    education: [],
```

with:

```js
    contact: { ...form.contact },
    summary: form.summary.trim(),
    skills: form.skills,
    experience: form.experience.map(({ title, company, location, startDate, endDate, current, bulletsText, skillsText }) => ({
      title, company, location, startDate, endDate: current ? '' : endDate, current,
      bullets: lines(bulletsText), skills: csv(skillsText),
    })),
    projects: form.projects.map(({ name, startDate, endDate, bulletsText, skillsText }) => ({
      name, startDate, endDate, bullets: lines(bulletsText), skills: csv(skillsText),
    })),
    education: form.education.map(({ school, degree, field, grade, startDate, endDate, bulletsText }) => ({
      school, degree, field, grade, startDate, endDate, bullets: lines(bulletsText),
    })),
```

Replace (in the `previewData` computed — the one whose `contact` line reads `contact: form.contact,`, no spread):

```js
  contact: form.contact,
  summary: form.summary,
  skills: form.skills,
  experience: [],
  projects: [],
  education: [],
```

with:

```js
  contact: form.contact,
  summary: form.summary,
  skills: form.skills,
  experience: form.experience.map((e) => ({
    title: e.title, company: e.company, location: e.location, startDate: e.startDate,
    endDate: e.current ? 'Present' : e.endDate, bullets: lines(e.bulletsText),
  })),
  projects: form.projects.map((p) => ({
    name: p.name, startDate: p.startDate, endDate: p.endDate, bullets: lines(p.bulletsText), skills: csv(p.skillsText),
  })),
  education: form.education.map((e) => ({
    school: e.school, degree: e.degree, field: e.field, grade: e.grade,
    startDate: e.startDate, endDate: e.endDate, bullets: lines(e.bulletsText),
  })),
```

- [ ] **Step 3: Switch dirty-tracking to a `watch(form, ...)`, matching `ProfileView.vue`**

Add the import and the watcher. Change:

```js
import { reactive, ref, computed, nextTick, onMounted } from 'vue'
```

to:

```js
import { reactive, ref, computed, watch, nextTick, onMounted } from 'vue'
```

Add after the `applyResume` function definition:

```js
watch(form, () => { if (loaded) { dirty.value = true; saved.value = false } }, { deep: true })
```

Remove the now-redundant inline tracker on the name input — change:

```html
            @input="dirty = loaded ? true : dirty"
```

to nothing (delete that attribute; the `watch` above covers it since `form.name` is part of `form`).

- [ ] **Step 4: Add the three repeatable-section cards**

Insert into the template, in the left column (`col-12 col-lg-6`), right after the Skills card's closing `</div>` (the one that closes `<div class="card shadow-sm mb-4">` containing the Skills `<h2>`), and before the closing `</div>` of `col-12 col-lg-6`:

```html
          <div class="card shadow-sm mb-4">
            <div class="card-body">
              <div class="d-flex justify-content-between align-items-center mb-3">
                <h2 class="h5 mb-0">Experience</h2>
                <button type="button" class="btn btn-sm btn-outline-primary" @click="addExp">+ Add experience</button>
              </div>
              <p v-if="!form.experience.length" class="text-body-secondary mb-0">No experience yet.</p>
              <div v-for="(x, i) in form.experience" :key="x.key" class="border rounded p-3 mb-3 bg-body-tertiary">
                <div class="row g-2">
                  <div class="col-12 col-md-6">
                    <label :for="`re-title-${x.key}`" class="form-label small">Title</label>
                    <input :id="`re-title-${x.key}`" v-model="x.title" class="form-control" />
                  </div>
                  <div class="col-12 col-md-6">
                    <label :for="`re-co-${x.key}`" class="form-label small">Company</label>
                    <input :id="`re-co-${x.key}`" v-model="x.company" class="form-control" />
                  </div>
                  <div class="col-12 col-md-6">
                    <label :for="`re-loc-${x.key}`" class="form-label small">Location</label>
                    <input :id="`re-loc-${x.key}`" v-model="x.location" class="form-control" />
                  </div>
                  <div class="col-6 col-md-3">
                    <label :for="`re-s-${x.key}`" class="form-label small">Start</label>
                    <input :id="`re-s-${x.key}`" v-model="x.startDate" class="form-control" placeholder="Jan 2024" />
                  </div>
                  <div class="col-6 col-md-3">
                    <label :for="`re-e-${x.key}`" class="form-label small">End</label>
                    <input :id="`re-e-${x.key}`" v-model="x.endDate" class="form-control" placeholder="Aug 2024" :disabled="x.current" />
                  </div>
                  <div class="col-12 d-flex align-items-center">
                    <div class="form-check">
                      <input :id="`re-c-${x.key}`" v-model="x.current" type="checkbox" class="form-check-input" />
                      <label :for="`re-c-${x.key}`" class="form-check-label">I currently work here</label>
                    </div>
                  </div>
                  <div class="col-12">
                    <label :for="`re-b-${x.key}`" class="form-label small">Bullets (one per line)</label>
                    <textarea :id="`re-b-${x.key}`" v-model="x.bulletsText" class="form-control" rows="4"></textarea>
                  </div>
                  <div class="col-12">
                    <label :for="`re-k-${x.key}`" class="form-label small">Skills used (comma-separated)</label>
                    <input :id="`re-k-${x.key}`" v-model="x.skillsText" class="form-control" />
                  </div>
                </div>
                <button type="button" class="btn btn-sm btn-outline-danger mt-3" @click="removeAt(form.experience, i)">Remove experience</button>
              </div>
            </div>
          </div>

          <div class="card shadow-sm mb-4">
            <div class="card-body">
              <div class="d-flex justify-content-between align-items-center mb-3">
                <h2 class="h5 mb-0">Projects</h2>
                <button type="button" class="btn btn-sm btn-outline-primary" @click="addProj">+ Add project</button>
              </div>
              <p v-if="!form.projects.length" class="text-body-secondary mb-0">No projects yet.</p>
              <div v-for="(x, i) in form.projects" :key="x.key" class="border rounded p-3 mb-3 bg-body-tertiary">
                <div class="row g-2">
                  <div class="col-12">
                    <label :for="`rp-n-${x.key}`" class="form-label small">Name</label>
                    <input :id="`rp-n-${x.key}`" v-model="x.name" class="form-control" />
                  </div>
                  <div class="col-6">
                    <label :for="`rp-s-${x.key}`" class="form-label small">Start</label>
                    <input :id="`rp-s-${x.key}`" v-model="x.startDate" class="form-control" />
                  </div>
                  <div class="col-6">
                    <label :for="`rp-e-${x.key}`" class="form-label small">End</label>
                    <input :id="`rp-e-${x.key}`" v-model="x.endDate" class="form-control" />
                  </div>
                  <div class="col-12">
                    <label :for="`rp-b-${x.key}`" class="form-label small">Bullets (one per line)</label>
                    <textarea :id="`rp-b-${x.key}`" v-model="x.bulletsText" class="form-control" rows="3"></textarea>
                  </div>
                  <div class="col-12">
                    <label :for="`rp-k-${x.key}`" class="form-label small">Skills / tech stack (comma-separated)</label>
                    <input :id="`rp-k-${x.key}`" v-model="x.skillsText" class="form-control" />
                  </div>
                </div>
                <button type="button" class="btn btn-sm btn-outline-danger mt-3" @click="removeAt(form.projects, i)">Remove project</button>
              </div>
            </div>
          </div>

          <div class="card shadow-sm mb-4">
            <div class="card-body">
              <div class="d-flex justify-content-between align-items-center mb-3">
                <h2 class="h5 mb-0">Education</h2>
                <button type="button" class="btn btn-sm btn-outline-primary" @click="addEdu">+ Add school</button>
              </div>
              <p v-if="!form.education.length" class="text-body-secondary mb-0">No education yet.</p>
              <div v-for="(x, i) in form.education" :key="x.key" class="border rounded p-3 mb-3 bg-body-tertiary">
                <div class="row g-2">
                  <div class="col-12 col-md-6">
                    <label :for="`red-sc-${x.key}`" class="form-label small">School</label>
                    <input :id="`red-sc-${x.key}`" v-model="x.school" class="form-control" />
                  </div>
                  <div class="col-12 col-md-6">
                    <label :for="`red-d-${x.key}`" class="form-label small">Degree</label>
                    <input :id="`red-d-${x.key}`" v-model="x.degree" class="form-control" />
                  </div>
                  <div class="col-12 col-md-6">
                    <label :for="`red-f-${x.key}`" class="form-label small">Field of study</label>
                    <input :id="`red-f-${x.key}`" v-model="x.field" class="form-control" />
                  </div>
                  <div class="col-12 col-md-6">
                    <label :for="`red-g-${x.key}`" class="form-label small">Grade / GPA</label>
                    <input :id="`red-g-${x.key}`" v-model="x.grade" class="form-control" placeholder="3.6 / 4.0" />
                  </div>
                  <div class="col-6 col-md-3">
                    <label :for="`red-s-${x.key}`" class="form-label small">Start</label>
                    <input :id="`red-s-${x.key}`" v-model="x.startDate" class="form-control" />
                  </div>
                  <div class="col-6 col-md-3">
                    <label :for="`red-e-${x.key}`" class="form-label small">End</label>
                    <input :id="`red-e-${x.key}`" v-model="x.endDate" class="form-control" />
                  </div>
                  <div class="col-12">
                    <label :for="`red-b-${x.key}`" class="form-label small">Coursework / bullets (one per line)</label>
                    <textarea :id="`red-b-${x.key}`" v-model="x.bulletsText" class="form-control" rows="2"></textarea>
                  </div>
                </div>
                <button type="button" class="btn btn-sm btn-outline-danger mt-3" @click="removeAt(form.education, i)">Remove school</button>
              </div>
            </div>
          </div>
```

- [ ] **Step 5: Manually verify in the browser**

Open a resume in the editor. Add an experience row, a project row, and an education row; fill them in (including comma-separated skills and multi-line bullets); confirm the live preview updates immediately under "Professional Experience" / "Personal Projects" / "Education" with right-aligned dates and the italic skills line under each project. Save, reload the page, confirm everything persisted. Remove a row and confirm it disappears from both the form and the preview.

- [ ] **Step 6: Commit**

```bash
git add client/src/views/ResumeEditorView.vue
git commit -m "feat: add Experience/Projects/Education sections to the resume editor"
```

---

## Task 10: `ResumeEditorView.vue` — Upload PDF (parse + merge)

**Files:**
- Modify: `client/src/views/ResumeEditorView.vue`

**Interfaces:**
- Consumes: `POST /api/resumes/:id/parse` (Task 4).

- [ ] **Step 1: Replace the placeholder `onFile` with real parse-and-merge logic**

Replace:

```js
// Placeholder for Task 10 (Upload PDF); wired here so the button exists but does nothing destructive yet.
const parsing = ref(false)
function onFile() {}
```

with:

```js
const parsing = ref(false)
const parseError = ref('')

function dedupeCi(arr) {
  const seen = new Set()
  return arr.filter((x) => {
    const k = x.toLowerCase()
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}

function mergeDraft(d) {
  if (d.summary && !form.summary.trim()) form.summary = d.summary
  form.skills = dedupeCi([...form.skills, ...(d.skills || [])])
  const addNew = (list, incoming, keyOf, toForm) => {
    const have = new Set(list.map(keyOf))
    for (const item of incoming) {
      const f = toForm(item)
      const k = keyOf(f)
      if (!have.has(k)) { have.add(k); list.push(f) }
    }
  }
  const lc = (...xs) => xs.map((x) => (x || '').trim().toLowerCase()).join('|')
  addNew(form.experience, d.experience || [], (x) => lc(x.title, x.company), expToForm)
  addNew(form.projects, d.projects || [], (x) => lc(x.name), projToForm)
  addNew(form.education, d.education || [], (x) => lc(x.school, x.degree), eduToForm)
}

async function onFile(e) {
  const file = e.target.files?.[0]
  e.target.value = '' // allow re-selecting the same file next time
  if (!file) return
  parsing.value = true
  parseError.value = ''
  try {
    const fd = new FormData()
    fd.append('resume', file)
    const { draft } = await api(`/api/resumes/${props.id}/parse`, { method: 'POST', body: fd })
    mergeDraft(draft || {})
  } catch (err) {
    parseError.value = err.message
  } finally {
    parsing.value = false
  }
}
```

This reuses the same merge-by-dedupe logic as `ProfileView.vue`'s `mergeDraft()`, scoped to this resume's own `form` instead of the base profile — nothing here touches `/api/profile`.

- [ ] **Step 2: Show parse errors in the template**

Add right after the existing `<div v-if="saveError" ...>` line:

```html
      <div v-if="parseError" class="alert alert-danger" role="alert">{{ parseError }}</div>
```

- [ ] **Step 3: Manually verify against the running app (calls live Gemini — not automated)**

With `pnpm dev` running and a real PDF resume at hand, open a resume in the editor, click "Upload PDF", pick the file. Expected: the button shows "Parsing…", then the Summary/Skills/Experience/Projects/Education fields fill in with extracted data (new rows appended, not replacing anything already typed), and the live preview updates to match. If Gemini quota is still exhausted, expect the `ai_daily_quota` message to surface in `parseError` — correct behavior, re-verify once quota resets.

- [ ] **Step 4: Commit**

```bash
git add client/src/views/ResumeEditorView.vue
git commit -m "feat: wire Upload PDF parse-and-merge into the resume editor"
```

---

## Task 11: `SkillGapView.vue` resume picker

**Files:**
- Modify: `client/src/views/SkillGapView.vue`

**Interfaces:**
- Consumes: `GET /api/resumes` (Task 1), `POST /api/skillgap` with `resumeId` (Task 6).

- [ ] **Step 1: Load the resume list**

Add to the imports/state near the top of `<script setup>` (alongside the existing `profile`/`profileError` refs):

```js
const resumes = ref([])
const selectedResumeId = ref('')

async function loadResumes() {
  try {
    const { resumes: r } = await api('/api/resumes')
    resumes.value = r
    if (!selectedResumeId.value && r.length) selectedResumeId.value = r[0]._id // already sorted updatedAt desc
  } catch {
    // Non-fatal: the form just falls back to "Use base Profile" if this fails.
  }
}
```

Call it in `onMounted`. Change:

```js
onMounted(() => {
  loadProfile()
  loadHistory()
  window.addEventListener('keydown', onKey)
})
```

to:

```js
onMounted(() => {
  loadProfile()
  loadHistory()
  loadResumes()
  window.addEventListener('keydown', onKey)
})
```

- [ ] **Step 2: Add the picker to the job-posting form**

In the template, inside the job form's `<div class="card-body">` (the one with the `sg-title`/`sg-company`/`sg-desc` fields), insert a new field right before the submit button:

```html
            <div v-if="resumes.length" class="mb-3">
              <label for="sg-resume" class="form-label">Resume to use</label>
              <select id="sg-resume" v-model="selectedResumeId" class="form-select" :disabled="analyzing">
                <option value="">Use base Profile</option>
                <option v-for="r in resumes" :key="r._id" :value="r._id">{{ r.name }}</option>
              </select>
            </div>
```

- [ ] **Step 3: Send `resumeId` with the analysis**

Replace (current line 220):

```js
      body: { job: { title: job.value.title.trim(), company: job.value.company.trim(), description: job.value.description.trim() } },
```

with:

```js
      body: {
        job: { title: job.value.title.trim(), company: job.value.company.trim(), description: job.value.description.trim() },
        ...(selectedResumeId.value && { resumeId: selectedResumeId.value }),
      },
```

- [ ] **Step 4: Show which resume was used, in the history list**

In the history list item template (the `<small>` showing `fmtDate(h.createdAt)` and `h.label`), add `sourceResume.name` alongside `label`. Replace:

```html
                <small :class="result && result._id === h._id ? '' : 'text-body-secondary'">{{ fmtDate(h.createdAt) }}<template v-if="h.label"> · {{ h.label }}</template></small>
```

with:

```html
                <small :class="result && result._id === h._id ? '' : 'text-body-secondary'">{{ fmtDate(h.createdAt) }}<template v-if="h.sourceResume?.name"> · {{ h.sourceResume.name }}</template><template v-if="h.label"> · {{ h.label }}</template></small>
```

- [ ] **Step 5: Manually verify against the running app (the analysis call hits live Gemini — not automated)**

With `pnpm dev` running and at least two saved resumes: open `/skill-gap`, confirm the "Resume to use" dropdown appears, defaults to the most-recently-updated resume, and lists "Use base Profile" plus every saved resume. Submit an analysis with a resume selected; once it completes, open History and confirm the new entry's subtitle shows that resume's name. Submit a second analysis with "Use base Profile" selected and confirm its history entry shows no resume name (unchanged, backward-compatible behavior).

- [ ] **Step 6: Commit**

```bash
git add client/src/views/SkillGapView.vue
git commit -m "feat: let skill-gap analysis start from a saved resume (client)"
```

---

## Task 12: Final end-to-end walkthrough

**Files:** none (verification only).

- [ ] **Step 1: Run the full server test suite one more time**

Run: `pnpm --filter ./server run test`
Expected: all tests from Tasks 1–5 pass (`# pass 14`, `# fail 0`).

- [ ] **Step 2: Full manual walkthrough against the running dev stack**

Run: `pnpm dev`. In the browser:
1. `/resumes` → create two resumes, one "from Profile" and one blank, with different names (e.g. "Backend Intern", "Frontend Intern").
2. Open the blank one in the editor: fill in Contact, Summary, Skills, one Experience row, one Project row, one Education row (with grade + coursework bullet). Confirm the live preview matches the reference layout (centered name/contact header, uppercase section headers with right-aligned dates, italic project-skills/education-grade lines, in Education → Personal Projects → Professional Experience → Skills order). Save.
3. Use "Upload PDF" on that resume with a real resume PDF; confirm fields merge in without wiping what was already typed, and watch for the quota error if Gemini is still exhausted (expected, not a bug).
4. Go back to `/resumes`, confirm both resumes list with correct "Updated …" timestamps, Duplicate one, Delete the duplicate.
5. Go to `/skill-gap`, confirm the resume picker defaults to the most recently updated resume, run an analysis with it selected, confirm the result looks sane and History shows the resume's name next to that entry.
6. Run an analysis with "Use base Profile" selected and confirm it behaves exactly as it did before this feature (no `sourceResume` shown).

- [ ] **Step 3: Report status**

Per `CLAUDE.md`'s end-of-session habit: note any step above that didn't pass (e.g. quota-blocked AI paths) explicitly rather than silently calling the feature done — those are expected/known, not failures, but should be named.
