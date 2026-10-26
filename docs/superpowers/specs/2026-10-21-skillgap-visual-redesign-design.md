# Skill Gap Workspace Visual Redesign — Design

Date: 2026-10-21
Status: Approved (brainstorming), pending implementation plan

## Problem

The Skill Gap analysis workspace (`client/src/views/SkillGapView.vue` and its child
components — `ScoreReport.vue`, `DraftEditor.vue`, `TailorChat.vue`, `ResumePaper.vue`,
`SkillTodoCard.vue`) is functionally complete (this session added the deadline field, the
skill to-do list, the wider Preview column, and real-page-width resume preview) but reads as
visually cramped — the user's word was "squeezy." Earlier fixes this session (column widths,
preview sizing) addressed specific layout bugs; this is a broader visual pass across the same
page: spacing, typography, color, and card treatment, not the underlying structure.

## Scope

**In scope:** the Skill Gap workspace only — the 3-column layout and every component rendered
inside it (score report, requirements list, missing-requirements cards, draft editor, tailor
chat, resume preview, skill to-do card, job-posting form, history list).

**Explicitly out of scope:**
- Any other page (Resumes, Profile, Jobs, Mock Interview, Shortlist, Interview Intel). The
  rest of the app is untouched and keeps its current Bootstrap-default look.
- The app's primary brand color. Still Bootstrap's default blue (`--bs-primary` / `btn-primary`)
  — not switching to a different accent — so this page doesn't visually diverge from the rest
  of the (unredesigned) app.
- Dark mode. The app has no theme toggle anywhere (confirmed in the 2026-10-20 named-resumes
  design doc); this redesign targets light mode only, matching the rest of the app.
- Information architecture. Same sections, same data shown, same component boundaries — this
  is a visual/spacing/typography pass, not a restructuring. The 3-column grid and the
  dynamic column-width swap between Tailor-chat/Preview tabs (added earlier this session)
  stay as they are.
- A new web font. Staying on the system font stack (no new Google Fonts network dependency)
  unless requested later — Inter would be the natural pick for this style if revisited.

## Design direction

Style: **Swiss/Minimalist grid** (picked from 3 options sourced via the `ui-ux-pro-max` skill's
design-system search — alternatives considered were "Bento Box Grid" and a flat navy/green
SaaS palette). Characteristics: a disciplined spacing scale, high-contrast neutrals, one accent
color only, clear typographic hierarchy, minimal decoration. Chosen because it's the lowest-risk
option that directly addresses "squeezy" (spacing becomes systematic rather than ad hoc) while
still being a real visual refresh, and it's fully compatible with Bootstrap 5 without a
framework change.

### 1. Spacing system

Bootstrap's existing gap/padding utility classes are used inconsistently across this page today
(`g-2`, `g-3`, `p-3`, `mb-3`, `mb-4` mixed without a clear rule). Replace with a deliberate
8px-based scale, applied uniformly:

- Card body padding: `p-3` (16px) → `p-4` (24px) on all cards in this workspace.
- Inter-card vertical spacing: `mb-3`/`mb-4` → `mb-4` consistently (24px) between stacked cards
  in the left and right columns.
- Row/column gutters: `row g-4` (current) → `row g-4 g-xl-5` so columns get more breathing room
  at wide viewports (≥1200px) without over-spacing on tablet/offcanvas widths.
- Inside components with their own internal lists (requirements, skill chips, to-do items):
  increase item-to-item gap from the current tight `gap-2`/gap-less stacking to `gap-3`.

### 2. Typography

- Section headings (`Resume Draft Score`, `By Category`, `Missing Requirements`, `Resume draft`,
  `Skill to-do`, etc.) step up one visual weight/size level — currently several are plain `h2
  .h5`/`h3` with little differentiation from body text. Bootstrap's `.h5` (currently used for
  most of these) computes to `1.25rem`/`font-weight: 500`; bump to `.h4` sizing (`1.5rem`) at
  `font-weight: 600` for every top-level section header in this workspace, so the page scans
  faster.
  - **Exception:** labels that are already working well stay as-is — e.g. the score number
    (`64/100`) is already large/bold; this only touches section headers and body-text hierarchy,
    not things already doing their job.
- Body/secondary text line-height goes from the current default (~1.5, inherited from Bootstrap)
  to `1.6` for paragraph-length content (summaries, AI draft text, requirement reasons) — short
  labels, badges, and buttons keep normal line-height.
- No new font — system font stack (`-apple-system, Segoe UI, Roboto, ...`, Bootstrap's default)
  stays. No network font request added.

### 3. Color & surfaces

- Page background: currently plain white (`var(--bs-body-bg)`, which is white). Shift the
  **page** background (outside cards) to Bootstrap's `--bs-tertiary-bg` (a very light gray,
  already a Bootstrap theme variable — no new color token needed) so white cards separate from
  the page via contrast instead of relying only on borders/shadows.
- Cards themselves stay white (`#fff`), keep their existing `shadow-sm` + `1px solid
  var(--bs-border-color)` — fully flat/shadowless was considered and rejected per the approved
  design: a totally flat look risked reading as "bare" rather than polished for a student
  project demo.
- Accent color: unchanged — Bootstrap's default primary blue. No new palette introduced.
- Status/score colors: unchanged — `BAND_META`'s existing variant colors (strong/moderate/
  emerging/low → success/warning/etc. Bootstrap text-bg classes) already satisfy the
  "don't convey meaning by color alone" rule (they're paired with text labels like "Moderate
  match") and aren't part of this redesign.

### 4. Cards

- Consistent `border-radius` across every card in this workspace (audit for any card currently
  missing the standard Bootstrap card radius or using an inconsistent one).
- Padding standardized to `p-4` per the spacing system above.
- No change to shadow depth, hover states, or card semantics (which card shows what) — purely
  the padding/radius/border consistency pass.

### 5. Layout rhythm

- The 3-column structure (left: score/requirements, middle: draft editor, right: chat/preview)
  and this session's dynamic width swap (Preview tab gets `col-xxl-6`, draft editor shrinks to
  `col-xxl-3`, vs. the normal `col-xxl-5`/`col-xxl-4` chat split) are **unchanged** — this
  redesign layers spacing/typography/color onto the existing structure, it doesn't rework it.
- Apply the spacing scale (§1) to the gaps between the three columns and between stacked cards
  within each column, so the whole page reads less dense without changing what's where.

### 6. Component-level polish (applying §1-4 throughout, no new components)

- `ScoreReport.vue`: requirement rows get more vertical padding/gap; the "I have this"/"I don't"
  button pair gets slightly more spacing from the requirement text above it.
- Skill chips (missing/matched skills, skill to-do items): more padding and gap between chips so
  they don't read as a dense wall.
- `SkillTodoCard.vue`, history list rows, missing-requirements cards: same padding/spacing
  normalization, no behavior change.
- `DraftEditor.vue` / `TailorChat.vue` / `ResumePaper.vue`: spacing/typography only — none of
  this session's earlier fixes (page-width preview, column-width swap) are touched or reverted.

## Testing

Visual-only change, no new server logic and no change to any API contract or component props/
events. Verification is manual, against the running dev stack, matching this session's
established pattern:
- Run `pnpm dev`, open `/skill-gap`, open an existing analysis from History (real data already
  exists from this session's testing — no need to burn more Gemini quota).
- Confirm all 3 columns, every card in this workspace, the Tailor-chat/Preview tab swap, and the
  Skill-to-do card read with visibly more breathing room than before, with no regressions to:
  - the Preview tab's page-width/proportions fix (earlier this session),
  - the column-width swap when switching Tailor chat ↔ Preview,
  - the score report's "I have this"/"I don't" override buttons and the draft editor's live
    rescore behavior,
  - responsive behavior at the offcanvas breakpoint (<1400px) and on a narrow/phone width.
- No automated test coverage needed or expected (no logic changed); `pnpm --filter ./client run
  build` must stay clean as the only automated check.
