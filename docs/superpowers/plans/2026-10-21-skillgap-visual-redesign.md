# Skill Gap Workspace Visual Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply a Swiss/Minimalist spacing, typography, and surface-color pass across the Skill Gap workspace (`SkillGapView.vue` and its child components) so the page reads with real breathing room instead of "squeezy," without changing any behavior, data, or the app's brand color.

**Architecture:** Pure template-class and scoped-CSS edits across 6 existing Vue SFCs. No new components, no new props/events, no server changes. A disciplined 8px-based spacing scale (16/24/32/48px) replaces today's inconsistent mix of `g-2`/`g-3`/`p-2`/`p-3` utility classes; section headings step up from Bootstrap's `.h5` to `.h4 fw-semibold`; the page gets a light-gray canvas background so white cards separate by contrast; paragraph-length text moves from `line-height: 1.5` to `1.6`.

**Tech Stack:** Vue 3 `<script setup>`, Bootstrap 5 (utility classes + scoped `<style>` blocks), Vite. No new dependencies.

## Global Constraints

- No new npm dependency, no new Google Font / network font request (spec: system font stack stays).
- No change to the app's primary accent color — stays Bootstrap default `btn-primary` blue (spec: scope excludes brand color).
- No change to information architecture, component props/events, or behavior — this is template-class and `<style>`-block only. If a step would require changing a `<script setup>` block, that step is out of scope for this plan.
- No change to dark mode (app has none today — don't add one).
- `ScoreReport.vue`'s `.sg-eyebrow` headings (`Resume draft score`, `By category`, etc.) are a deliberate, distinct micro-label pattern for a dense scorecard — **do not** convert them to `.h4`. Only plain `.h5` page-section headers (outside ScoreReport.vue) get the `.h4 fw-semibold` bump. This refines one line of the approved spec (`docs/superpowers/specs/2026-10-21-skillgap-visual-redesign-design.md`, §2) after closer inspection of `ScoreReport.vue`'s actual headings — bumping `.sg-eyebrow` to match page-level headers would flatten hierarchy rather than clarify it, which contradicts the spec's own stated goal.
- Compact/dense sub-patterns stay compact, not bumped to the full `p-4` scale: `TailorChat.vue`'s chat message bubbles and `DraftEditor.vue`'s nested entry sub-cards get a modest `p-2`→`p-3` bump (not `p-4`) — full-page-card padding on a chat bubble or a nested list entry would look wrong, not "less squeezy."
- Verification is manual against the running dev stack (`pnpm dev`) — no automated test changes. `pnpm --filter ./client run build` must stay clean after every task; that's the only automated check.
- Every task's edits are scoped to files inside `client/src/views/SkillGapView.vue` or `client/src/components/skillgap/*.vue`. No other file changes.

---

## Task 1: Page canvas + grid spacing (`SkillGapView.vue`)

**Files:**
- Modify: `client/src/views/SkillGapView.vue:401` (root `<section>`)
- Modify: `client/src/views/SkillGapView.vue:428` (setup row gutter)
- Modify: `client/src/views/SkillGapView.vue:561` (workspace row gutter)
- Modify: `client/src/views/SkillGapView.vue:637-661` (`<style scoped>` block)

**Interfaces:** None — pure markup/CSS, no script changes, no new props/events/classes consumed by other files.

- [ ] **Step 1: Give the page a canvas background**

Change (line 401):
```html
  <section>
```
to:
```html
  <section class="sg-page">
```

- [ ] **Step 2: Widen the two grid rows' gutters**

Change (line 428):
```html
    <div v-if="!result || setupPanel" class="row g-4 mb-4">
```
to:
```html
    <div v-if="!result || setupPanel" class="row g-4 g-xl-5 mb-4">
```

Change (line 561):
```html
      <div class="row g-3">
```
to:
```html
      <div class="row g-4 g-xl-5">
```

- [ ] **Step 3: Add the canvas style rule**

In the `<style scoped>` block, add this rule right after the opening `<style scoped>` line (before `.min-w-0 { min-width: 0; }`):

```css
/* Page canvas: light-gray surface so white cards separate by contrast, not just borders. */
.sg-page { background: var(--bs-tertiary-bg); border-radius: var(--bs-border-radius-lg); padding: 1.5rem; }
```

- [ ] **Step 4: Verify the build is clean**

Run: `pnpm --filter ./client run build`
Expected: `✓ built in <N>ms`, exit code 0, no errors.

- [ ] **Step 5: Manual check**

Run `pnpm dev`, open `http://localhost:5173/skill-gap`. Confirm: the whole page now sits on a visibly light-gray rounded panel (distinct from the white navbar/page background outside it), and both the job-posting/history row and the 3-column workspace row have visibly wider gaps between columns than before, especially on a wide window (≥1200px).

- [ ] **Step 6: Commit**

```bash
git add client/src/views/SkillGapView.vue
git commit -m "feat: add page canvas and wider grid gutters to Skill Gap workspace"
```

---

## Task 2: Page-level section headings + their card padding (`SkillGapView.vue`)

**Files:**
- Modify: `client/src/views/SkillGapView.vue:432` (Job posting heading + its card-body)
- Modify: `client/src/views/SkillGapView.vue:469` (History heading + its card-body)
- Modify: `client/src/views/SkillGapView.vue:533` (workspace job-title heading)

**Interfaces:** None.

- [ ] **Step 1: Bump the three plain `.h5` section headers to `.h4 fw-semibold`, and widen the two content cards' padding to match**

Change (line 431-432 — note the card-body padding bump combined with the heading):
```html
          <div class="card-body">
            <h2 class="h5 mb-3">Job posting</h2>
```
to:
```html
          <div class="card-body p-4">
            <h2 class="h4 fw-semibold mb-3">Job posting</h2>
```

Change (line 469 — `pb-2` stays, it intentionally tightens the gap before the nested list-group):
```html
          <div class="card-body pb-2"><h2 class="h5 mb-0">History</h2></div>
```
to:
```html
          <div class="card-body p-4 pb-2"><h2 class="h4 fw-semibold mb-0">History</h2></div>
```

Change (line 533 — heading only, this card is the workspace toolbar header which stays at its current `py-3` padding per Global Constraints):
```html
            <h2 class="h5 mb-0">{{ result.job.title }}<template v-if="result.job.company"> · {{ result.job.company }}</template></h2>
```
to:
```html
            <h2 class="h4 fw-semibold mb-0">{{ result.job.title }}<template v-if="result.job.company"> · {{ result.job.company }}</template></h2>
```

Note: the "No analysis yet" / "No analyses yet" empty-state `.h5`s (lines ~472, 521) and the loading-state `.h5` (line 508) stay as `.h5` — they're transient/secondary states, not standing section headers, and bumping them would make empty/loading states visually louder than the content they precede. Their card-bodies also stay unbumped for the same reason.

- [ ] **Step 2: Verify the build is clean**

Run: `pnpm --filter ./client run build`
Expected: `✓ built in <N>ms`, exit code 0, no errors.

- [ ] **Step 3: Manual check**

Reload `/skill-gap`. Confirm "Job posting", "History", and the job-title header (once an analysis is open) are visibly larger/bolder than before, the Job-posting form and History card have visibly more internal padding (History's content still sits close under its heading, just with more padding around the whole card), and "No analysis yet" / the loading spinner's text/padding stay unchanged.

- [ ] **Step 4: Commit**

```bash
git add client/src/views/SkillGapView.vue
git commit -m "feat: bump Skill Gap page-level section headings and card padding"
```

---

## Task 3: `ScoreReport.vue` row spacing

**Files:**
- Modify: `client/src/components/skillgap/ScoreReport.vue:46` (outer card gap)
- Modify: `client/src/components/skillgap/ScoreReport.vue:108` (requirement-list gap)
- Modify: `client/src/components/skillgap/ScoreReport.vue:154-179` (`<style scoped>` block)

**Interfaces:** None — no prop/event changes.

- [ ] **Step 1: Widen the gap between the stacked cards and between requirement rows**

Change (line 46):
```html
  <div class="d-flex flex-column gap-3">
```
to:
```html
  <div class="d-flex flex-column gap-4">
```

Change (line 108):
```html
          <ul v-else class="list-unstyled mt-2 mb-0 d-flex flex-column gap-2">
```
to:
```html
          <ul v-else class="list-unstyled mt-2 mb-0 d-flex flex-column gap-3">
```

- [ ] **Step 2: Widen padding on all 4 card-bodies in this file**

This file has 4 plain `<div class="card-body">` (score section, line 48) / `class="card-body"` (category section, line 82) instances, one dynamic `<component :is="..." class="card-body">` (line 105, used for the missing/partial/met requirement groups), and one more plain `class="card-body"` (eligibility section, line 137). Change all 4 occurrences of exactly:
```html
class="card-body"
```
to:
```html
class="card-body p-4"
```
(Confirm each is still attached to the right element — score card-body, category card-body, the dynamic group component, and eligibility card-body — don't touch any other `card-body`-adjacent text.)

- [ ] **Step 3: Give each requirement row more internal padding**

Change in `<style scoped>` (padding bump from §1, plus `line-height: 1.6` from spec §2's paragraph-text line-height rule — this text includes each requirement's `reason`/`evidence` paragraphs):
```css
.sg-row-main { display: block; width: 100%; text-align: left; background: none; border: 0; padding: 0.625rem 0.75rem; color: inherit; font-size: 0.9rem; border-radius: 0.5rem; }
```
to:
```css
.sg-row-main { display: block; width: 100%; text-align: left; background: none; border: 0; padding: 1rem; color: inherit; font-size: 0.9rem; line-height: 1.6; border-radius: 0.5rem; }
```

Change:
```css
.sg-ovr { margin: 0 0.75rem 0.625rem; }
```
to:
```css
.sg-ovr { margin: 0 1rem 1rem; }
```

- [ ] **Step 4: Verify the build is clean**

Run: `pnpm --filter ./client run build`
Expected: `✓ built in <N>ms`, exit code 0, no errors.

- [ ] **Step 5: Manual check**

Open an existing analysis from History (real data already exists from earlier testing — no need for a fresh Gemini call). Confirm the Score/By category/Missing requirements/Partial matches/Met requirements/Eligibility cards all have more padding and more space between them, and each individual requirement row (and its "I have this"/"I don't" buttons) has visibly more padding than before, without changing wording, verdicts, or button behavior.

- [ ] **Step 6: Commit**

```bash
git add client/src/components/skillgap/ScoreReport.vue
git commit -m "feat: widen Score Report card padding and requirement-row spacing"
```

---

## Task 4: `DraftEditor.vue` heading, card padding, and entry spacing

**Files:**
- Modify: `client/src/components/skillgap/DraftEditor.vue:52,55` (card-body padding + heading)
- Modify: `client/src/components/skillgap/DraftEditor.vue` (entry sub-card padding — grep `card-body p-2` in this file for the exact line; verified present as of this plan's writing)

**Interfaces:** None.

- [ ] **Step 1: Bump the main card's padding and the "Resume draft" heading**

Change (line 52):
```html
      <div class="card-body">
```
to:
```html
      <div class="card-body p-4">
```

Change (line 55):
```html
          <h2 class="h5 mb-0">Resume draft</h2>
```
to:
```html
          <h2 class="h4 fw-semibold mb-0">Resume draft</h2>
```

- [ ] **Step 2: Give nested entry sub-cards (experience/project rows) a modest padding bump**

Find the line matching `<div class="card-body p-2">` in this file and change it to:
```html
            <div class="card-body p-3">
```

(Modest bump, not the full `p-4` page-card scale — this is a nested list entry inside the draft editor, not a top-level content card; matches the same reasoning as Task 5's chat-bubble treatment.)

- [ ] **Step 3: Verify the build is clean**

Run: `pnpm --filter ./client run build`
Expected: `✓ built in <N>ms`, exit code 0, no errors.

- [ ] **Step 4: Manual check**

Open an existing analysis, confirm the "Resume draft" heading is visibly larger/bolder, the card itself has more padding, and experience/project entry rows inside the editor have slightly more internal padding — all without changing fields, buttons, or editing behavior.

- [ ] **Step 5: Commit**

```bash
git add client/src/components/skillgap/DraftEditor.vue
git commit -m "feat: bump Resume draft heading and card/entry-row padding"
```

---

## Task 5: `TailorChat.vue` message spacing

**Files:**
- Modify: `client/src/components/skillgap/TailorChat.vue:96` (message bubble padding)

**Interfaces:** None.

- [ ] **Step 1: Give chat message bubbles a modest padding bump**

Change (line 96):
```html
          <div class="card-body p-2">
```
to:
```html
          <div class="card-body p-3">
```

(Same reasoning as Task 4 Step 2 — a chat bubble stays compact even in a spacious design; `p-3` is the right modest bump, not `p-4`.)

- [ ] **Step 2: Verify the build is clean**

Run: `pnpm --filter ./client run build`
Expected: `✓ built in <N>ms`, exit code 0, no errors.

- [ ] **Step 3: Manual check**

Open the Tailor chat tab on an existing analysis with chat history. Confirm message bubbles have a touch more breathing room without looking like oversized cards, and nothing about sending/clearing messages changed.

- [ ] **Step 4: Commit**

```bash
git add client/src/components/skillgap/TailorChat.vue
git commit -m "feat: widen Tailor chat message bubble padding"
```

---

## Task 6: `SkillTodoCard.vue` card padding, heading, and item spacing

**Files:**
- Modify: `client/src/components/skillgap/SkillTodoCard.vue:39,41` (card-body padding + heading)
- Modify: `client/src/components/skillgap/SkillTodoCard.vue:54` (list item gap)

**Interfaces:** None. (This component is used twice in `SkillGapView.vue` — the setup-panel right column and the full-width workspace placement — both render the same way, so this one file edit fixes both.)

- [ ] **Step 1: Bump the card-body padding and the "Skill to-do" heading**

Change (line 39 — `pb-2` stays, it intentionally tightens the gap before the nested list):
```html
    <div class="card-body pb-2">
```
to:
```html
    <div class="card-body p-4 pb-2">
```

Change (line 41):
```html
        <h2 class="h5 mb-0">Skill to-do</h2>
```
to:
```html
        <h2 class="h4 fw-semibold mb-0">Skill to-do</h2>
```

- [ ] **Step 2: Widen the gap inside each to-do row**

Change (line 54):
```html
          <li v-for="t in rows" :key="t._id" class="list-group-item d-flex align-items-start gap-2" :class="{ 'flex-wrap': armedId === t._id }">
```
to:
```html
          <li v-for="t in rows" :key="t._id" class="list-group-item d-flex align-items-start gap-3" :class="{ 'flex-wrap': armedId === t._id }">
```

- [ ] **Step 3: Verify the build is clean**

Run: `pnpm --filter ./client run build`
Expected: `✓ built in <N>ms`, exit code 0, no errors.

- [ ] **Step 4: Manual check**

With at least one skill to-do item present (real data exists from earlier testing), confirm the card has more padding, the "Skill to-do" heading is bumped, and each row (checkbox, skill name, deadline badge, Remove button) has a touch more horizontal gap, in both places the card appears (setup-panel column and full-width workspace placement — toggle "New analysis"/close it to see both).

- [ ] **Step 5: Commit**

```bash
git add client/src/components/skillgap/SkillTodoCard.vue
git commit -m "feat: bump Skill to-do heading and item spacing"
```

---

## Task 7: `ResumePaper.vue` paragraph line-height

**Files:**
- Modify: `client/src/components/skillgap/ResumePaper.vue` (`.sg-paper` rule in `<style scoped>`)

**Interfaces:** None. **Do not touch anything else in this file** — its page-width (`max-width: 650px; margin: 0 auto;`) and natural-flow sizing were fixed earlier this session (per two rounds of live Chrome verification) and must not be reverted or altered. This task is a single-property line-height change only.

- [ ] **Step 1: Bump paragraph line-height per spec §2**

Change:
```css
.sg-paper { background: #fff; color: #212529; padding: 1.75rem; font-size: 0.9rem; line-height: 1.5; border: 1px solid var(--bs-border-color); border-radius: 0.5rem; box-shadow: var(--bs-box-shadow-sm); }
```
to:
```css
.sg-paper { background: #fff; color: #212529; padding: 1.75rem; font-size: 0.9rem; line-height: 1.6; border: 1px solid var(--bs-border-color); border-radius: 0.5rem; box-shadow: var(--bs-box-shadow-sm); }
```

- [ ] **Step 2: Verify the build is clean**

Run: `pnpm --filter ./client run build`
Expected: `✓ built in <N>ms`, exit code 0, no errors.

- [ ] **Step 3: Manual check**

Open the Preview tab on an existing analysis. Confirm the summary paragraph and bullet text have a touch more line spacing, and — critically — that the page still has its realistic width/proportions and the Tailor-chat/Preview column-width swap still works (these are regression checks for earlier-this-session fixes, not new behavior).

- [ ] **Step 4: Commit**

```bash
git add client/src/components/skillgap/ResumePaper.vue
git commit -m "feat: widen Resume Paper preview paragraph line-height"
```

---

## Task 8: Full-page regression pass

**Files:** None modified — verification only.

**Interfaces:** None.

- [ ] **Step 1: Run the full manual checklist from the spec**

With `pnpm dev` running, open `/skill-gap` and an existing History analysis, and confirm every item from the spec's Testing section still holds:
- All 3 columns, every card in this workspace, and the Skill-to-do card read with visibly more breathing room than before Task 1.
- The Preview tab's page-width/proportions fix (from earlier this session) is unregressed — Preview still reads as a realistic-width page, not squeezed.
- The column-width swap when switching Tailor chat ↔ Preview still works (Preview gets the wider column, chat gets the narrower one, and switching back restores the normal ratio).
- The score report's "I have this"/"I don't" override buttons still toggle correctly and the draft editor's live rescore still fires on edits.
- Responsive behavior holds at the offcanvas breakpoint (resize below 1400px — Tailor chat/Preview becomes a drawer) and at a narrow/phone width (resize to ~390px — no horizontal scroll, no overlapping content).

- [ ] **Step 2: Final build check**

Run: `pnpm --filter ./client run build`
Expected: `✓ built in <N>ms`, exit code 0, no errors, no warnings introduced by this plan's changes.

- [ ] **Step 3: Report**

No commit in this task (verification only). Report back: confirmation that every checklist item in Step 1 passed, plus the final build output.
