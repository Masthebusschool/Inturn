<script setup>
import { computed, reactive } from 'vue'
import { BAND_META, rawBand, capInfo, categoryBreakdown } from '../../lib/skillgap.js'

const props = defineProps({
  score: { type: Object, required: true },
  profileScore: { type: Object, default: null },
  isDraft: { type: Boolean, default: false },
  eligibility: { type: Array, default: () => [] },
  overrides: { type: Object, default: () => ({}) },
  focusKeys: { type: Array, default: () => [] },
  editable: { type: Boolean, default: false },
})
const emit = defineEmits(['focus', 'override'])

const reqs = computed(() => props.score.requirements || [])
const bandOf = (s) => BAND_META[s.band] || BAND_META[rawBand(s.atsScore)]
const meta = computed(() => bandOf(props.score))
const cap = computed(() => capInfo(props.score.atsScore, props.score.band, reqs.value))
const cats = computed(() => categoryBreakdown(reqs.value))
const lost = (r) => (r.mark || 0) - (r.earned || 0)
const byLost = (list) => [...list].sort((a, b) => lost(b) - lost(a))
// The override map is the only source of truth for the buttons: score rows lag one rescore behind,
// so falling back to r.override would keep a just-cleared override looking active.
const ovr = (r) => props.overrides[r.key] || null
const rowsOf = (v) => reqs.value.filter((r) => r.verdict === v)
const groups = computed(() => [
  { id: 'missing', title: 'Missing requirements', rows: byLost(rowsOf('missing')), tailor: true, empty: 'Nothing missing.' },
  { id: 'partial', title: 'Partial matches — tailor with AI', rows: byLost(rowsOf('partial')), tailor: true, empty: 'No partial matches.' },
  { id: 'met', title: `Met requirements (${rowsOf('met').length})`, rows: rowsOf('met'), tailor: false, empty: '' },
])
const fmt = (n) => Math.round((n || 0) * 10) / 10
const focused = (k) => props.focusKeys.includes(k)

// Clicking the active choice clears it, so the student can undo a self-report.
function toggle(r, value) {
  emit('override', r.key, ovr(r) === value ? null : value)
}

// Eligibility answers are deliberately local: self-reported, never sent or saved.
const answers = reactive({})
const answer = (k, v) => { answers[k] = answers[k] === v ? null : v }
</script>

<template>
  <div class="d-flex flex-column gap-4">
    <section class="card shadow-sm" aria-labelledby="sg-score-h">
      <div class="card-body p-4">
        <h2 id="sg-score-h" class="sg-eyebrow mb-2">{{ isDraft ? 'Resume draft score' : 'Profile score' }}</h2>
        <div class="d-flex align-items-center gap-3">
          <div class="sg-big" :class="`sg-tone-${meta.variant}`" role="img" :aria-label="`Score ${score.atsScore} out of 100`">
            <span class="sg-big-num">{{ score.atsScore }}</span><span class="sg-big-of">/100</span>
          </div>
          <div>
            <span class="badge border" :class="`text-bg-${meta.variant}`">{{ meta.label }}</span>
            <p v-if="isDraft && profileScore" class="small text-body-secondary mb-0 mt-1">
              Full profile: {{ profileScore.atsScore }} ({{ bandOf(profileScore).label }})
            </p>
          </div>
        </div>
        <div class="progress sg-bar mt-3" role="presentation">
          <div class="progress-bar" :class="`bg-${meta.variant}`" :style="{ width: score.atsScore + '%' }"></div>
        </div>
        <p v-if="cap.capped" class="sg-note mt-3 mb-0" role="note">
          <strong>Capped at Moderate:</strong>
          <template v-if="cap.blockers.length">
            "{{ cap.blockers[0].text }}"<template v-if="cap.blockers.length > 1"> (and {{ cap.blockers.length - 1 }} more)</template>
            is a required must-have that's missing. Fix or confirm it to reach Strong.
          </template>
          <template v-else>a required must-have is missing. Fix or confirm it to reach Strong.</template>
        </p>
        <p v-if="score.ungradedCount > 0" class="small text-body-secondary mt-2 mb-0">
          {{ score.ungradedCount }} requirement{{ score.ungradedCount === 1 ? '' : 's' }} could not be graded and {{ score.ungradedCount === 1 ? 'is' : 'are' }} left out of the score.
        </p>
        <p v-if="!reqs.length" class="sg-note mt-3 mb-0" role="note">
          This analysis predates requirement scoring — re-run it to get a live score, per-requirement feedback and tailoring.
        </p>
      </div>
    </section>

    <section v-if="cats.length" class="card shadow-sm" aria-labelledby="sg-cat-h">
      <div class="card-body p-4">
        <h2 id="sg-cat-h" class="sg-eyebrow mb-2">By category</h2>
        <table class="table table-sm align-middle mb-0 sg-cats">
          <thead>
            <tr><th scope="col">Category</th><th scope="col" class="text-end">Marks</th><th scope="col" class="text-end">Covered</th><th scope="col" class="text-end">Weight</th></tr>
          </thead>
          <tbody>
            <tr v-for="c in cats" :key="c.category">
              <th scope="row" class="fw-normal">
                {{ c.label }}
                <div class="progress sg-mini" role="presentation"><div class="progress-bar" :class="c.coverage >= 75 ? 'bg-success' : c.coverage >= 40 ? 'bg-warning' : 'bg-danger'" :style="{ width: c.coverage + '%' }"></div></div>
              </th>
              <td class="text-end text-nowrap">{{ fmt(c.earned) }}/{{ fmt(c.possible) }}</td>
              <td class="text-end">{{ c.coverage }}%</td>
              <td class="text-end">{{ c.share }}%</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <template v-if="reqs.length">
      <section v-for="g in groups" :key="g.id" class="card shadow-sm">
        <component :is="g.id === 'met' ? 'details' : 'div'" class="card-body p-4">
          <component :is="g.id === 'met' ? 'summary' : 'h2'" class="sg-eyebrow mb-0" :class="{ 'sg-summary': g.id === 'met' }">{{ g.title }}</component>
          <p v-if="!g.rows.length && g.empty" class="small text-body-secondary mt-2 mb-0">{{ g.empty }}</p>
          <ul v-else class="list-unstyled mt-2 mb-0 d-flex flex-column gap-3">
            <li v-for="r in g.rows" :key="r.key" class="sg-row" :class="{ 'is-focused': focused(r.key) }">
              <component
                :is="g.tailor ? 'button' : 'div'"
                class="sg-row-main"
                :type="g.tailor ? 'button' : undefined"
                :aria-pressed="g.tailor ? focused(r.key) : undefined"
                @click="g.tailor && emit('focus', r.key)"
              >
                <span class="d-flex flex-wrap align-items-center gap-1 mb-1">
                  <span class="badge" :class="r.tier === 'required' ? 'text-bg-dark' : 'text-bg-secondary'">{{ r.tier === 'required' ? 'Required' : 'Preferred' }}</span>
                  <span v-if="ovr(r)" class="badge text-bg-info">Self-confirmed</span>
                  <span class="small text-body-secondary ms-auto text-nowrap">{{ fmt(r.earned) }}/{{ fmt(r.mark) }} marks</span>
                </span>
                <span class="d-block fw-medium">{{ r.text }}</span>
                <span v-if="r.reason" class="d-block small text-body-secondary mt-1">{{ r.reason }}</span>
                <span v-if="g.id === 'partial' && r.evidence" class="d-block small fst-italic sg-quote mt-1">"{{ r.evidence }}"</span>
              </component>
              <div v-if="editable" class="btn-group btn-group-sm sg-ovr" role="group" :aria-label="`Self-report for ${r.text}`">
                <button type="button" class="btn btn-outline-success" :class="{ active: ovr(r) === 'confirmed_have' }" :aria-pressed="ovr(r) === 'confirmed_have'" @click="toggle(r, 'confirmed_have')">I have this</button>
                <button type="button" class="btn btn-outline-secondary" :class="{ active: ovr(r) === 'confirmed_missing' }" :aria-pressed="ovr(r) === 'confirmed_missing'" @click="toggle(r, 'confirmed_missing')">I don't</button>
              </div>
            </li>
          </ul>
        </component>
      </section>
    </template>

    <section v-if="eligibility.length" class="card shadow-sm" aria-labelledby="sg-elig-h">
      <div class="card-body p-4">
        <h2 id="sg-elig-h" class="sg-eyebrow mb-1">Eligibility checklist</h2>
        <p class="small text-body-secondary">Self-reported — not AI-graded and not saved. Recruiters often filter on these.</p>
        <ul class="list-unstyled mb-0 d-flex flex-column gap-3">
          <li v-for="e in eligibility" :key="e.key">
            <div :id="`sg-el-${e.key}`" class="small mb-1">{{ e.text }}</div>
            <div class="btn-group btn-group-sm" role="group" :aria-labelledby="`sg-el-${e.key}`">
              <button type="button" class="btn btn-outline-success" :class="{ active: answers[e.key] === 'yes' }" :aria-pressed="answers[e.key] === 'yes'" @click="answer(e.key, 'yes')">Yes</button>
              <button type="button" class="btn btn-outline-danger" :class="{ active: answers[e.key] === 'no' }" :aria-pressed="answers[e.key] === 'no'" @click="answer(e.key, 'no')">No</button>
            </div>
          </li>
        </ul>
      </div>
    </section>
  </div>
</template>

<style scoped>
.sg-eyebrow { font-size: 0.75rem; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: var(--bs-secondary-color); }
.sg-summary { cursor: pointer; }
.sg-big { display: flex; align-items: baseline; line-height: 1; color: var(--sg-c, var(--bs-body-color)); }
.sg-big-num { font-size: 3.25rem; font-weight: 700; font-variant-numeric: tabular-nums; }
.sg-big-of { font-size: 0.9rem; color: var(--bs-secondary-color); margin-left: 0.15rem; }
.sg-tone-success { --sg-c: var(--bs-success-text-emphasis); }
.sg-tone-warning { --sg-c: var(--bs-warning-text-emphasis); }
.sg-tone-info { --sg-c: var(--bs-info-text-emphasis); }
.sg-tone-danger { --sg-c: var(--bs-danger-text-emphasis); }
.sg-bar { height: 0.5rem; }
.sg-bar .progress-bar { transition: width 0.3s ease-out; }
.sg-mini { height: 0.25rem; margin-top: 0.25rem; }
.sg-cats { font-size: 0.85rem; font-variant-numeric: tabular-nums; }
.sg-note { background: var(--bs-warning-bg-subtle); color: var(--bs-warning-text-emphasis); border-left: 3px solid var(--bs-warning); border-radius: 0.25rem; padding: 0.5rem 0.75rem; font-size: 0.875rem; }
.sg-row { border: 1px solid var(--bs-border-color); border-radius: 0.5rem; background: var(--bs-body-bg); transition: border-color 0.15s, box-shadow 0.15s; }
.sg-row.is-focused { border-color: var(--bs-primary); box-shadow: 0 0 0 0.15rem var(--bs-primary-bg-subtle); }
.sg-row-main { display: block; width: 100%; text-align: left; background: none; border: 0; padding: 1rem; color: inherit; font-size: 0.9rem; line-height: 1.6; border-radius: 0.5rem; }
button.sg-row-main { cursor: pointer; }
button.sg-row-main:hover { background: var(--bs-tertiary-bg); }
button.sg-row-main:focus-visible { outline: 2px solid var(--bs-primary); outline-offset: -2px; }
.sg-quote { border-left: 2px solid var(--bs-border-color); padding-left: 0.5rem; }
.sg-ovr { margin: 0 1rem 1rem; }
.sg-ovr .btn { min-height: 2rem; }
@media (prefers-reduced-motion: reduce) { .sg-bar .progress-bar, .sg-row { transition: none; } }
</style>
