# Named Resumes — Design

Date: 2026-10-20
Status: Approved (brainstorming), pending implementation plan

## Problem

Inturn's current resume/profile editor (`ProfileView.vue`) is a single stacked form backed by
fields directly on the `User` document — one profile per user, no live preview, no concept of
multiple resume versions. The user wants a UI similar to a reference screenshot: a split-pane
"resume details" editor (form on the left, live formatted preview on the right) for **named,
reusable resumes**.

The underlying need, per the user: they typically target a handful of similar roles and
maintain a small library of resumes for them (e.g. "Backend Intern", "Frontend Intern"),
rather than starting from scratch per job application. When starting a new skill-gap analysis
for a job posting, the app should offer their most recently updated resume as the default
starting point, and record which resume was used for which application (traceability).

## Architecture decision

New standalone `Resume` Mongoose collection + `/api/resumes` REST router, matching the
dominant pattern already used for list-style, independently-growing entities in this codebase
(`Shortlist`, `IntelPost`, `SkillGapResult` are all separate collections with their own
routers — `Profile`-on-`User` is the outlier, not the pattern to extend).

Rejected alternatives:
- **Embed `resumes: []` on `User`** — grows the user doc unboundedly, and `SkillGapResult`
  would need to reference an array element rather than a real document id for traceability.
- **Repurpose `SkillGapResult`** — that schema is inherently job-specific (`job.title`,
  `job.description` required, full of scoring fields). Forcing a job-less "standalone resume"
  mode into it conflates two different lifecycles and fights the "no save-back" decision below.

## Data model

`server/src/models/Resume.js` (new), independent of `User`/`Profile`:

```js
{
  user: ObjectId (ref User),
  name: String,              // the resume's own label, e.g. "trial2"
  contact: { fullName, phone, email, linkedin, github, portfolio },
  summary: String,
  skills: [String],
  experience: [{ title, company, location, startDate, endDate, current, bullets: [String] }],
  projects: [{ name, subtitle, startDate, endDate, bullets: [String] }],  // subtitle = tech-stack line
  education: [{ school, degree, field, startDate, endDate, grade, bullets: [String] }],
  timestamps: true           // updatedAt drives "most recently updated" sort/default
}
```

Resumes are **independent snapshots**: creating one optionally copies the user's current
`User`-level profile fields (skills/experience/projects/education) as a starting point, or
starts blank. After creation a resume never syncs with the base Profile or with other
resumes — editing one touches only that document.

`SkillGapResult` gains one additive field for traceability (no behavior change when absent):

```js
sourceResume: { resume: ObjectId (ref Resume), name: String, resumeUpdatedAt: Date }
```

A snapshot of which resume (and which version of it) seeded that job's tailored draft —
history only, not a live link.

## API

`server/src/routes/resumes.js` (new, mounted at `/api/resumes`), same `devUser` middleware +
ownership pattern (404-not-403 on a foreign id) already used by `shortlist.js`/`skillgap.js`:

- `GET /` — list own resumes, `{ id, name, updatedAt }` only, sorted `updatedAt desc`.
- `POST /` — create. Body `{ name, seed: 'profile' | 'blank' }`. `seed: 'profile'` copies
  `skills/experience/projects/education` from the `User` doc via the existing `toProfile()`
  helper and prefills `contact.fullName`/`contact.email` from `user.name`/`user.email`;
  `'blank'` starts empty.
- `GET /:id` — full resume document (owned).
- `PUT /:id` — full replace, same shape/pattern as `PUT /api/profile`. Bumps `updatedAt`.
- `DELETE /:id` — delete (owned).
- `POST /:id/duplicate` — copy as a new resume under a new name (the mechanism for "one
  resume per target role"). Body `{ name? }`; defaults to `Copy of <original name>` when
  omitted, matching the existing `SkillGapResult` duplicate route's convention.
- `POST /:id/parse` — thin wrapper around the existing `aiService.parseResume()` (already
  using the `'resume'` model purpose added this session). Returns a draft the client merges
  into *this resume's* fields only, reusing the merge logic already in `ProfileView.vue`'s
  `mergeDraft()`. Never touches `User`/Profile.

**Limits** (matching the string caps already used in `skillgap.js`, e.g. `MAX_LABEL`): resume
`name` capped at 80 chars; bullet/text fields capped the same way `ProfileView.vue`'s payload
already trims/limits its own fields today — no new limits regime, just applied per-field here.

`server/src/routes/skillgap.js` — `POST /` gains an optional `resumeId` in the body. When
present: validate ownership (404 pattern), build the scoring `profile` from that `Resume` doc
(same shape `toProfile()` produces — contact fields are not used in scoring) instead of the
`User`, and stamp `sourceResume` on the created `SkillGapResult`. Omitted `resumeId` behaves
exactly as today — fully backward compatible. `GET /api/skillgap/history` adds
`sourceResume.name` to its lean projection.

## Client

- `client/src/views/ResumesView.vue` (new) — "My Resumes" list: name, last-updated,
  Edit/Duplicate/Delete per row, "+ New resume" (prompts name + Profile-copy-vs-blank choice,
  `POST`s, routes into the editor).
- `client/src/views/ResumeEditorView.vue` (new) — the split-pane page from the reference
  screenshot:
  - Top bar: back-to-list arrow, editable resume name + "Resume details" subtitle,
    Upload PDF / Cancel / Save. No dark-mode toggle here — that's already global in `App.vue`.
  - Left pane: stacked form sections — Contact, Summary, Skills, Experience, Projects,
    Education — following the same field patterns as `ProfileView.vue`, plus the new Contact
    block (full name, phone, email, LinkedIn, GitHub, portfolio).
  - Right pane: sticky live preview via a new `client/src/components/resumes/ResumePreview.vue`
    — **not** a reuse of the existing `ResumePaper.vue` (left untouched, so the job-tailoring
    flow in `SkillGapView.vue` doesn't regress). Styled to match the screenshot: centered name
    header, "·"-separated contact line, uppercase section headers with right-aligned dates,
    italic secondary line for project tech-stack / education grade.
- Router: `/resumes` (list), `/resumes/:id` (editor). Nav link added alongside the existing
  Profile/Jobs/Skill Gap entries.
- `client/src/views/SkillGapView.vue` — the job-analysis setup form gains a resume picker:
  dropdown from `GET /api/resumes`, sorted `updatedAt desc`, pre-selected to the most recent,
  plus a "Use base Profile instead" option (the only choice when the user has zero resumes).
  Selected id is sent as `resumeId` on `POST /api/skillgap`. The history panel shows
  `sourceResume.name` next to each entry's job title/company.

## Explicitly out of scope (this spec)

- **Save-back**: tailoring a draft for a specific job (existing `draftResume`/`tailorChat`
  flow) never writes back into the resume library. One-way: resume → seeds a job draft, and
  that's it. Decided to keep v1 scope tight.
- **Skill-gap learning to-do list**: a separate feature the user raised mid-session (auto-add
  missing/partial requirements to a to-do list with a deadline derived from the job's
  application period). Needs its own brainstorm — there's no structured job-deadline field
  anywhere in the codebase today (`jobs.js` routes are still `notImplemented` stubs), so it
  isn't a simple addition. To be designed next, separately.
- **Structured job application deadlines** — blocked on the job-board feature not existing yet.
- Contact fields live only on `Resume`; base `Profile`/`User` and `ProfileView.vue` are
  unchanged by this feature.
- No new export/download beyond what already exists for the tailored-resume print flow.

## Testing

- Server: route tests for `resumes.js` CRUD + ownership (404 on foreign id, same pattern as
  existing route tests), and a `skillgap.js` test covering `resumeId` present vs. absent.
- Client: manual verification per `CLAUDE.md` standards — run the dev stack, create/edit/
  duplicate/delete a resume, confirm the live preview matches edits, confirm the skill-gap
  picker defaults to the most recently updated resume and `sourceResume` shows in history.
