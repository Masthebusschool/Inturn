# Linking Job Discovery → Tracker Board → Skill Gap Analysis — Design

Date: 2026-11-02
Status: Approved (brainstorming), pending implementation plan

## Problem

Inturn has three features that currently don't talk to each other as much as they should:

- **Job Discovery** (`JobsView.vue`) — browse live MCF listings, "save" one.
- **Application Tracking Board** (`KanbanView.vue`) — columns `Saved → Applied → Interview →
  Offered`, backed by the `Application` model.
- **Skill Gap Analysis** (`SkillGapView.vue`) — score a resume against a job, produce a
  tailored-resume draft, backed by `SkillGapResult`.

Saving a job already creates an `Application` (status `Saved`, `mcfUuid` set) — that link
exists. What's missing: a way to go from a Saved card on the Tracker board straight into a
Skill Gap Analysis for that specific job, with the job details prefilled, and a way for the
board to reflect that an analysis happened.

`SkillGapResult` already has `job.jobId` / `job.source` fields for exactly this purpose, but
nothing in the UI has ever set them — confirmed dead/unused via code read. The model's own
comment on `sourceResume` notes results otherwise have "no live link back" to where they came
from; the same is true for the job side.

## Scope decisions (from brainstorming)

- **Button visibility:** "Tailor Resume" appears only on cards in the `Saved` column. Once an
  application moves to `Applied`, the button disappears — it's a pre-decision tool, not an
  ongoing one.
- **Job description gap:** `Application` currently has no `description` field (only
  title/company/skills[]/salary/deadline/url). Skill Gap's scoring reads free-text
  `description`. Fix: snapshot the MCF description onto `Application.description` at save
  time, so the prefill carries real text, not just a skills list.
- **Link back + resume existing:** Yes. `SkillGapResult` gains a live `application` ref.
  Clicking "Tailor Resume" again on a card that already has an analysis reopens that same
  result (via its existing `forkedFrom` versioning for "save as new") rather than creating a
  duplicate. The card shows a score badge once a linked result exists.
- **Resume selection:** No auto-pick. The existing resume dropdown on `SkillGapView` is left
  as-is; the user still chooses which resume to score, same as the standalone flow today.
- **Status after analysis:** Stays manual. Finishing an analysis does not move the card to
  `Applied` — the user still drags it themselves when they actually submit.

## Data flow

```
Job Discovery "Save"
  → POST /api/applications/discovery-saved { job }
  → jobFromMcf() now also captures job.description
  → Application created: status=Saved, mcfUuid, description (NEW)

Tracker board, Saved column
  → card shows "Tailor Resume" button (+ score badge if skillGapResultId is set)
  → click → router.push /skill-gap?applicationId=<app._id>

SkillGapView on mount (applicationId present)
  → GET /api/applications/:id (NEW endpoint) → prefill title/companyName/skills/
    description/jobDetailsUrl into the job form
  → GET /api/skillgap?applicationId=... (NEW query) :
      found  → load existing SkillGapResult (resume existing analysis)
      none   → leave form ready; resumeId still picked manually by user

User clicks Analyse → POST /api/skillgap { job, resumeId, applicationId (NEW) }
  → job.jobId = mcfUuid, job.source = 'tracker' (existing-but-dead fields, now populated)
  → SkillGapResult.application = applicationId (NEW live link)
  → Application.skillGapResultId = result._id (NEW, written back for the board badge)
```

## Data model changes

`server/src/models/Application.js`:
```js
description: String,              // NEW — snapshot of MCF job description at save time
skillGapResultId: {                // NEW — nullable; powers the Tracker card's score badge
  type: Schema.Types.ObjectId,
  ref: 'SkillGapResult',
  default: null,
}
```

`server/src/models/SkillGapResult.js`:
```js
application: {                     // NEW — the live link back; job.jobId/job.source
  type: Schema.Types.ObjectId,     // (existing fields) get populated with mcfUuid/'tracker'
  ref: 'Application',
  default: null,
}
```

No changes to `Resume` — tailoring stays embedded in `SkillGapResult.tailoredResume`/
`draftResume` as it already works today; this feature doesn't touch that lifecycle.

## Backend changes

- `server/src/models/McfJobs.js` (`jobFromMcf`) — also map the MCF description field onto
  `Application.description`.
- `server/src/routes/applications.js` / `applicationController.js` — add
  `GET /api/applications/:id` (single-application fetch; doesn't exist today, Kanban only
  loads the bulk list via `GET /api/applications`).
- `server/src/routes/skillgap.js` — `POST /` accepts optional `applicationId` in the body;
  when present, sets `SkillGapResult.application`, `job.jobId`/`job.source`, and writes
  `skillGapResultId` back onto the `Application` doc. Add `GET /?applicationId=...` to look
  up the existing result for a given application (used for both "resume existing" and to let
  the board fetch badges in bulk if needed later — out of scope to batch-optimize now).

## Frontend changes

- `KanbanView.vue` / card component: in the `Saved` column only, render a "Tailor Resume"
  button; render a small score badge when `app.skillGapResultId` is set. Button navigates to
  `/skill-gap?applicationId=<id>`.
- `SkillGapView.vue`: on mount, if `route.query.applicationId` is present, fetch the
  application, prefill the job form (title/company/skills/description/jobDetailsUrl), then
  check for an existing linked result and load it if found. The resume dropdown is untouched.

## Edge cases

- **Pre-existing saved jobs** have no `description` (field didn't exist yet) — form just shows
  it blank; user can paste text manually, same as the standalone flow works today for anyone
  not coming from the Tracker.
- **Application deleted/unsaved after analysis** — `SkillGapResult` keeps its own `job`
  snapshot (title/company/description already copied in at creation), so the result itself
  stays intact; only the live `application` ref and the board's badge go stale. No cleanup
  needed — this mirrors how `sourceResume` already tolerates a deleted `Resume`.
- **Double-click "Tailor Resume"** — second click loads the same existing `SkillGapResult`
  (lookup by `applicationId` is idempotent); no duplicate created.

## Explicitly out of scope

- Auto-updating `Application.status` when analysis finishes (confirmed: stays manual).
- Auto-selecting a resume for the user (confirmed: dropdown stays manual).
- Writing tailored output back as a new saved `Resume` document — tailoring remains embedded
  in `SkillGapResult` as it already works today.
- Batch-optimizing badge lookups across the whole board (single `GET ?applicationId=` per
  card is fine at this project's scale; revisit only if it becomes a real bottleneck).
