# Skill-Gap To-Do List Implementation Plan

> **For agentic workers:** Execute task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every fresh skill-gap analysis (`POST /api/skillgap`) automatically adds its missing/partial *skills* to one unified, per-user to-do list (deduped across jobs, deadline = earliest known job `applicationDeadline`), shown as a persistent card on the Skill Gap page where items can be ticked done or removed.

**Architecture:** New `LearningTask` Mongoose collection (one row per user+canonical skill) + `/api/learning-tasks` router (list / toggle / delete), a sync helper in `server/src/utils/learningTasks.js` called from `skillgap.js`'s `POST /` right after the result is saved, and a presentational `SkillTodoCard.vue` rendered by `SkillGapView.vue`.

**Tech Stack:** Express 5 / Mongoose 9 (server), Vue 3 `<script setup>` + Bootstrap 5 (client), `node:test` (`pnpm --filter ./server run test`). pnpm workspaces, not npm.

## Locked decisions (product owner) and judgment calls

1. **Trigger:** automatic, only on `POST /api/skillgap` (fresh analysis). NOT `/rescore`, `/tailor`, `/duplicate`.
2. **Filter (judgment call, easy to revisit):** a requirement becomes a to-do iff `verdict ∈ {missing, partial}` AND `category ∈ SKILL_CATEGORIES = ['technical','domain','soft_skill']`. `qualification` (degree/GPA/citizenship), `responsibility` and `other` are skipped. `SKILL_CATEGORIES` is the *same* list `summarizeGap()` already uses for matched/missing skills, so it is hoisted to one exported constant in `skillGapScoring.js` — change it there to revisit the filter.
3. **Dedupe:** one row per `(user, skillKey)`, `skillKey = canonical(req.key || req.text)` (`utils/skillNormalize.js`). Empty key → skip. Within one result, first occurrence of a key wins.
4. **Deadline:** each source's deadline = that result's `job.applicationDeadline` as-is. Row deadline = earliest non-null source deadline; no source deadline → open-ended (field absent, not an error).
5. **Done is sticky (judgment call):** a later analysis reaffirming a `done` skill does NOT flip it back to pending; it only appends a source (and may lower the deadline).
6. **Delete is a real delete:** a later analysis that still finds the skill missing will re-create it. (Accepted; revisit with a "dismissed" status if it proves noisy.)
7. **Sources** keep traceability (`skillGapResult` id, job title/company, verdict, deadline), capped at the last 20 (`$slice`, mirrors `tailorChat`'s `$slice: -100`) so re-running the same posting can't grow a row unboundedly.
8. **UI placement:** inside `SkillGapView.vue`, always visible. Setup mode (`!result || setupPanel`): in the right-hand column under History (and alone in that column when the form panel is open). Workspace mode (result open, no setup panel): full-width card below the workspace. Same view-level state feeds both spots, so switching never refetches.
9. **Sync failure never fails the analysis:** the result is already saved; a sync error is logged and the 201 still goes out.

## Global constraints

- No new dependencies. All client HTTP via `client/src/lib/api.js`'s `api()`. Destructive client actions confirm with `window.confirm` (existing pattern).
- New router follows `resumes.js` exactly: `router.use(devUser)`, local `loadOwned(req, res, select?)` returning 404 (not 403) for invalid/foreign ids, `router.use(apiErrors)` last.
- Tests never call Gemini. The sync helper is exercised directly with hand-built result objects.
- Test cleanup: `canonical()` strips `_`, so a `__test_` prefix would not survive into `skillKey`. Test requirement keys use the token `testlt` (`testlt-python` → skillKey `testlt python`); cleanup is `LearningTask.deleteMany({ skillKey: /^testlt / })`. Never delete or assert on non-test rows — tests share the real dev DB and the real dev user.

---

## Task 1: Model + sync helper + wiring (server)

**Files:**
- Modify: `server/src/utils/skillGapScoring.js` — export `SKILL_CATEGORIES = ['technical', 'domain', 'soft_skill']`; make `summarizeGap` use it instead of its local `skillCats`.
- Create: `server/src/models/LearningTask.js`
- Create: `server/src/utils/learningTasks.js`
- Create: `server/src/utils/learningTasks.test.js` (pure, no DB)
- Modify: `server/src/routes/skillgap.js` — call the sync after `SkillGapResult.create` in `POST /` only.

**Model** (`LearningTask.js`):

```js
const sourceSchema = new mongoose.Schema(
  {
    skillGapResult: { type: mongoose.Schema.Types.ObjectId, ref: 'SkillGapResult' },
    job: { title: String, company: String },
    verdict: String,
    deadline: Date,
  },
  { _id: false }
);
const learningTaskSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    skillKey: { type: String, required: true }, // canonical() form, the dedupe key
    skillText: String, // human label from the first analysis that surfaced it
    status: { type: String, enum: ['pending', 'done'], default: 'pending' },
    // Earliest known source deadline. NO default: the sync's $min relies on the field being
    // absent (not null) when open-ended, because BSON null sorts below every date.
    deadline: Date,
    sources: [sourceSchema],
    doneAt: Date,
  },
  { timestamps: true }
);
// Also serves user-only queries (user is the prefix), so no separate user index.
learningTaskSchema.index({ user: 1, skillKey: 1 }, { unique: true });
```

**Helper** (`utils/learningTasks.js`) exports:

- `todoCandidates(requirements) -> [{ skillKey, skillText, verdict }]` — pure. Applies decision 2 + 3 above. Tolerates `undefined`/non-array input (returns `[]`) and Mongoose subdocs (plain property access).
- `compareTasks(a, b)` — pure comparator for the list order: pending before done; then deadline ascending with missing deadlines LAST; then `createdAt` ascending. Write it without relying on `Infinity - Infinity === NaN` tricks — explicit branches.
- `async syncLearningTasksFromResult(userId, result)` — builds one upsert per candidate and runs a single `LearningTask.bulkWrite(ops, { ordered: false })` (skip the call when there are no candidates). Each op:

```js
const deadline = result.job?.applicationDeadline || undefined;
{
  updateOne: {
    filter: { user: userId, skillKey },
    update: {
      // status only on insert => a done item stays done (decision 5)
      $setOnInsert: { skillText, status: 'pending' },
      $push: {
        sources: {
          $each: [{ skillGapResult: result._id, job: { title: result.job?.title, company: result.job?.company }, verdict, deadline }],
          $slice: -20,
        },
      },
      // $min on an absent field sets it; on a present one keeps the earlier date (decision 4).
      ...(deadline && { $min: { deadline } }),
    },
    upsert: true,
  },
}
```

**Wiring** in `skillgap.js` `POST /`, between `SkillGapResult.create(...)` and `res.status(201)`:

```js
// Decision 9: the analysis is saved; a to-do sync failure must not turn it into a 500.
try {
  await syncLearningTasksFromResult(req.user._id, result);
} catch (e) {
  console.error('[skillgap] learning-task sync failed:', e);
}
```

**Unit tests** (`utils/learningTasks.test.js`, pure, same style as `resumeProfile.test.js`):
- [ ] keeps missing+partial technical/domain/soft_skill; drops `met`; drops qualification/responsibility/other.
- [ ] key = `canonical(key || text)`: `rest-apis` and text `REST APIs` both → `rest`; falls back to `text` when `key` empty; skips when both canonicalize to `''`.
- [ ] dedupes within one requirements list (first wins); returns `[]` for `undefined`.
- [ ] `compareTasks`: pending before done; earlier deadline first; no-deadline after any deadline; `createdAt` tiebreak.

- [ ] Run `pnpm --filter ./server run test` — all pass (existing 13 + new).

## Task 2: `/api/learning-tasks` router + DB-backed tests (server)

**Files:**
- Create: `server/src/routes/learningTasks.js`
- Modify: `server/src/index.js` — `import learningTasksRouter from './routes/learningTasks.js'` and `app.use('/api/learning-tasks', learningTasksRouter)` right after the `/api/resumes` mount.
- Create: `server/src/routes/learningTasks.test.js`

**Routes** (all behind `devUser`, `apiErrors` last, `loadOwned` copied from `resumes.js` but for `LearningTask` with message `'Task not found'`):
- `GET /` → `{ tasks }`: `LearningTask.find({ user }).select('-user').lean()`, then `.sort(compareTasks)` in JS (lists are small; Mongo sorts nulls first, which is the wrong way round).
- `PATCH /:id` body `{ status: 'pending' | 'done' }` → anything else 400 `{ error: 'Status must be "pending" or "done".' }`. Sets `doneAt = new Date()` when moving to done (keep the existing `doneAt` if it is already done), clears `doneAt` (`undefined`) when moving to pending. `await task.save()` → `{ task }`.
- `DELETE /:id` → `{ ok: true }`.

**Tests** (`routes/learningTasks.test.js`, follow `resumes.test.js`: `ensureDb()` + `startTestServer('/api/learning-tasks', router)` in `before`; `after` deletes `skillKey: /^testlt /`, closes, disconnects). Get the dev user's id the same way `devUser` does (`User.findOneAndUpdate({ email: 'dev@inturn.local' }, { $setOnInsert: { email: 'dev@inturn.local', name: 'Dev Student' } }, { upsert: true, returnDocument: 'after' })`). Build fake results as plain objects `{ _id: new mongoose.Types.ObjectId(), job: { title, company, applicationDeadline }, requirements: [...] }` and call `syncLearningTasksFromResult` directly. Only ever look at `testlt` rows.

- [ ] **sync: filter** — one result with missing technical, partial soft_skill, met technical, missing qualification → exactly the 2 expected rows exist, both `pending`, each with 1 source carrying the result id, job title/company, verdict.
- [ ] **sync: cross-job dedupe** — result A key `testlt-SQL`, result B key `TESTLT_sql` → ONE row `testlt sql` with 2 sources.
- [ ] **sync: earliest deadline** — A deadline 2026-12-01, B 2026-11-15, C 2026-12-20 (same skill) → row deadline 2026-11-15.
- [ ] **sync: null handling** — first source no deadline → row has no deadline; second with 2026-11-30 → set; third with none → still 2026-11-30.
- [ ] **sync: done is sticky** — mark a row done (PATCH), sync again → still `done`, `doneAt` kept, sources grew by 1.
- [ ] **GET /** — creates (via sync) pending-late, pending-early, pending-no-deadline, and one PATCHed to done; the `testlt` subset of the response is in order early, late, no-deadline, done. Response rows have no `user` field.
- [ ] **PATCH /:id** — done sets `doneAt`; pending clears it; `{ status: 'nope' }` → 400; `not-an-id` → 404; another user's row (synced with `new mongoose.Types.ObjectId()` as user) → 404 and row unchanged.
- [ ] **DELETE /:id** — own row → 200 and gone from GET; another user's row → 404 and still exists.
- [ ] **ownership on GET** — the other user's row never appears.
- [ ] Run `pnpm --filter ./server run test` — all pass.

## Task 3: Client — `SkillTodoCard.vue` + wiring in `SkillGapView.vue`

**Files:**
- Modify: `client/src/lib/skillgap.js` — export `fmtDate` (move the exact one-liner out of `SkillGapView.vue`; the view then imports it). Leave `ResumesView.vue` alone.
- Create: `client/src/components/skillgap/SkillTodoCard.vue` (presentational, like `ScoreReport.vue`: props + emits, no API calls)
- Modify: `client/src/views/SkillGapView.vue`

**API** (server, Tasks 1–2): `GET /api/learning-tasks` → `{ tasks: [{ _id, skillKey, skillText, status: 'pending'|'done', deadline?, doneAt?, sources: [{ skillGapResult, job: { title, company }, verdict, deadline? }], createdAt, updatedAt }] }` (sorted). `PATCH /api/learning-tasks/:id` `{ status }` → `{ task }`. `DELETE /api/learning-tasks/:id` → `{ ok: true }`.

**`SkillTodoCard.vue`**
- Props: `tasks` (Array), `loading` (Boolean), `error` (String, load error), `actionError` (String), `busyId` (String|null). Emits: `toggle(task)`, `remove(task)`.
- Local: `showDone` ref (false). Computed `pending` / `done` = `tasks` split by status, each sorted by deadline asc (missing last) then `createdAt` — so an item un-ticked from done drops back into its right place without a refetch.
- Markup, matching the History card: `card shadow-sm`; `card-body pb-2` header with `h2.h5.mb-0` "Skill to-do" + a pending-count badge, and a one-line `small text-body-secondary` subtitle "Missing and partial skills from all your analyses". States: `loading` → "Loading…" (`role="status"`), `error` → `text-danger-emphasis small`, no tasks → empty-state `<p>` ("Nothing here yet — skills you're missing or only partly match in an analysis are added automatically."), `actionError` → small `text-danger-emphasis` line above the list.
- `list-group list-group-flush` rows (`list-group-item d-flex align-items-start gap-2`), scrollable like `.sg-history` (`max-height: 26rem; overflow-y: auto`):
  - `form-check-input` checkbox, `:checked="t.status === 'done'"`, `:disabled="busyId === t._id"`, `@change="emit('toggle', t)"`, with a real `<label :for>` on the skill text (unique id per row, e.g. `` `todo-${t._id}` ``).
  - Skill text (`fw-semibold`; done → `text-decoration-line-through text-body-secondary`).
  - Second line, `small text-body-secondary`: deadline badge `Due {{ fmtDate(t.deadline) }}` or `No deadline` (`badge text-bg-light border fw-normal`), then source hint `· {{ sourceHint(t) }}` where `sourceHint` = unique `job.company || job.title` across sources, joined with `, ` (truncate with `text-truncate`).
  - Remove: `btn btn-sm btn-link text-body-secondary p-0 ms-auto` (or `btn-close`) with `:aria-label="`Remove ${t.skillText}`"`, `:disabled="busyId === t._id"`, `@click="emit('remove', t)"`.
- Under the pending list, when `done.length`: a `btn btn-sm btn-link` toggle "Show completed (N)" / "Hide completed (N)" with `:aria-expanded`, revealing the done rows (same row markup — render one row template for both lists, e.g. a `v-for` over a small inline array or a local `<template>`; don't duplicate the row markup twice).

**`SkillGapView.vue`**
- State next to history: `todos` (ref []), `todosLoading` (ref true), `todosError` (ref ''), `todoActionError` (ref ''), `todoBusy` (ref null).
- `loadTodos()` — same shape as `loadHistory()` (`api('/api/learning-tasks')`, `tasks || []`).
- `toggleTodo(t)` — **optimistic** (keeps the native checkbox in sync even on failure): compute next status, replace the row in `todos` immediately with `{ ...t, status: next }`, set `todoBusy`, `PATCH`; on success replace the row with the server's `task`; on failure restore the original row and set `todoActionError`. Clear `todoActionError` at the start of each action.
- `removeTodo(t)` — `window.confirm(`Remove "${t.skillText}" from your to-do list?`)`; `DELETE`; on success filter it out; on failure set `todoActionError`.
- `onMounted`: add `loadTodos()` next to `loadHistory()`. In `analyze()`: call `loadTodos()` right after the existing `loadHistory()` (new items were just created server-side).
- Template — exactly one `<SkillTodoCard>` instance renders at a time, both bound to the same props/handlers:
  1. Setup row: change the History column so the column itself renders whenever the setup row does (`col-12 col-lg-5`), containing History (`v-if="!result || setupPanel === 'history'"`, unchanged markup) followed by the to-do card (`mt-4` when History is shown above it, or use `d-flex flex-column gap-4` on the column).
  2. Workspace: after the workspace (outside `<template v-if="result && !analyzing">` so it doesn't depend on `analyzing`), `<SkillTodoCard v-if="result && !setupPanel" class="mt-4" ... />`.
- Remove the local `fmtDate` definition and import it from `../lib/skillgap.js`.
- [ ] `pnpm --filter ./client run build` succeeds with no new warnings.

## Task 4: Review + verification (orchestrator)

- [ ] Review the full diff against this plan and the codebase's existing patterns; fix directly.
- [ ] `pnpm --filter ./server run test` — quote output.
- [ ] Live check against the running stack: seed `testlt`-style rows for the dev user via the sync helper (or one real analysis), open `/skill-gap` in the browser, verify card in setup mode / form panel / history panel / workspace mode, toggle done/undone, show-completed disclosure, remove (confirm). Clean up anything created for verification. State plainly in the report what was and was not verified in a real browser.
