<script setup>
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { api } from '../lib/api.js'
import {
  BAND_META, rawBand, cloneDraft, draftKey, fieldIdForEvidence, applySuggestion, draftToText, fmtDate,
} from '../lib/skillgap.js'
import SkillTodoCard from '../components/skillgap/SkillTodoCard.vue'
import ScoreReport from '../components/skillgap/ScoreReport.vue'
import DraftEditor from '../components/skillgap/DraftEditor.vue'
import TailorChat from '../components/skillgap/TailorChat.vue'
import ResumePaper from '../components/skillgap/ResumePaper.vue'

const TYPING_MS = 2500 // wait for a pause in typing before paying for a rescore
const APPLY_MS = 1200 // an applied suggestion is a deliberate, discrete edit
const MAX_FOCUS = 6 // server caps focus targets at 6

// ---------- setup area (job form + history) ----------
const job = ref({ title: '', company: '', description: '', applicationDeadline: '' })
const touched = ref(false)
const analyzing = ref(false)
const elapsed = ref(0)
let elapsedTimer = null
const err = ref(null) // { message, code, retry }
const history = ref([])
const historyError = ref('')
const historyLoading = ref(true)
const setupPanel = ref(null) // 'form' | 'history' while a result is open
const loadingResult = ref(false)
const savingCopy = ref(false)

const profile = ref(null)
const profileError = ref('')
const profileEmpty = computed(() => !!profile.value && !(profile.value.skills?.length || profile.value.experience?.length || profile.value.projects?.length))

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

const titleInvalid = computed(() => touched.value && !job.value.title.trim())
const descInvalid = computed(() => touched.value && !job.value.description.trim())
const quota = (e) => e?.code === 'ai_daily_quota'
const fail = (e, retry) => { err.value = { message: e.message, code: e.code, retry } }
const stage = computed(() =>
  elapsed.value < 15 ? 'Reading the posting…' : elapsed.value < 60 ? 'Grading every requirement against your profile…' : 'Writing your tailored draft…')

function histBadge(h) {
  const score = h.draftScore?.atsScore ?? h.atsScore
  const meta = BAND_META[h.draftScore?.band ?? h.band ?? rawBand(score)]
  return { score, meta }
}

async function loadHistory() {
  try {
    const { results } = await api('/api/skillgap/history')
    history.value = results || []
    historyError.value = ''
  } catch (e) {
    historyError.value = e.message
  } finally {
    historyLoading.value = false
  }
}

const todos = ref([])
const todosLoading = ref(true)
const todosError = ref('')
const todoActionError = ref('')
const todoBusy = ref(null)

async function loadTodos() {
  try {
    const { tasks } = await api('/api/learning-tasks')
    todos.value = tasks || []
    todosError.value = ''
  } catch (e) {
    todosError.value = e.message
  } finally {
    todosLoading.value = false
  }
}

// Optimistic so the checkbox moves at once; the original row is restored if the PATCH fails.
async function toggleTodo(t) {
  todoActionError.value = ''
  const next = t.status === 'done' ? 'pending' : 'done'
  const swap = (row) => { todos.value = todos.value.map((x) => (x._id === t._id ? row : x)) }
  swap({ ...t, status: next })
  todoBusy.value = t._id
  try {
    const { task } = await api(`/api/learning-tasks/${t._id}`, { method: 'PATCH', body: { status: next } })
    swap(task)
  } catch (e) {
    swap(t)
    todoActionError.value = e.message
  } finally {
    todoBusy.value = null
  }
}

async function removeTodo(t) {
  todoActionError.value = ''
  todoBusy.value = t._id
  try {
    await api(`/api/learning-tasks/${t._id}`, { method: 'DELETE' })
    todos.value = todos.value.filter((x) => x._id !== t._id)
  } catch (e) {
    todoActionError.value = e.message
  } finally {
    todoBusy.value = null
  }
}

async function loadProfile() {
  try {
    profile.value = (await api('/api/profile')).profile || {}
  } catch (e) {
    profileError.value = e.message
  }
}

// ---------- open result ----------
const result = ref(null)
const draft = ref(cloneDraft(null))
const overrides = ref({})
const draftScore = ref(null)
const chat = ref([])
const applied = ref([])
const focusKeys = ref([])
const highlight = ref(null)
const applyNote = ref('')
const copied = ref(false)

const canRescore = computed(() => !!result.value?.requirements?.length)
const reportScore = computed(() => draftScore.value || result.value)
const profileScore = computed(() => ({ atsScore: result.value.atsScore, band: result.value.band }))
const focusRows = computed(() => (reportScore.value?.requirements || []).filter((r) => focusKeys.value.includes(r.key)))

// ---------- rescoring ----------
// Guards, each for one failure mode:
//  timer      - debounce, so we don't rescore on every keystroke
//  seq        - a response is applied only if no newer rescore (or result switch) started since
//  ctrl       - aborts the superseded request so it stops costing server work
//  lastKey    - content already sent; identical content is never re-sent
//  lastRev    - monotonic per client so the server can reject out-of-order persistence
const dirty = ref(false) // a debounced rescore is waiting
const rescoring = ref(false)
const rescoreErr = ref(null)
let timer = null
let seq = 0
let ctrl = null
let lastKey = ''
let lastRev = 0
let inflight = null
let nextMs = TYPING_MS // consumed by the key watcher; callers set it just before changing the draft

const currentKey = () => draftKey(draft.value, overrides.value)

function schedule(ms) {
  clearTimeout(timer)
  dirty.value = true
  timer = setTimeout(runRescore, ms)
}

function runRescore() {
  clearTimeout(timer)
  timer = null
  dirty.value = false
  inflight = doRescore()
  return inflight
}

async function doRescore() {
  const mySeq = ++seq
  ctrl?.abort()
  ctrl = new AbortController()
  const key = currentKey()
  lastKey = key
  lastRev = Math.max(Date.now(), lastRev + 1)
  rescoring.value = true
  rescoreErr.value = null
  try {
    const { score } = await api(`/api/skillgap/${result.value._id}/rescore`, {
      method: 'POST',
      body: { draft: draft.value, overrides: overrides.value, rev: lastRev },
      signal: ctrl.signal,
    })
    if (mySeq !== seq) return // a newer rescore owns the UI now
    draftScore.value = score
  } catch (e) {
    if (e.name === 'AbortError' || mySeq !== seq) return
    lastKey = '' // let Retry or the next edit send again
    rescoreErr.value = { message: e.message, code: e.code }
  } finally {
    if (mySeq === seq) rescoring.value = false
  }
}

watch(currentKey, (k) => {
  if (!result.value || !canRescore.value) return
  if (k === lastKey) { // edited back to what was already sent: nothing to do
    clearTimeout(timer)
    timer = null
    dirty.value = false
    return
  }
  const ms = nextMs
  nextMs = TYPING_MS
  schedule(ms)
})

// Duplicate must copy a current draft, so settle any pending or in-flight rescore first.
async function flush() {
  if (timer) await runRescore()
  else await inflight
}

function stopWork() {
  clearTimeout(timer)
  timer = null
  ctrl?.abort()
  seq++
  inflight = null
  dirty.value = false
  rescoring.value = false
  rescoreErr.value = null
}

function openLoaded(r) {
  stopWork()
  result.value = r
  draft.value = cloneDraft(r.draftResume || r.tailoredResume)
  overrides.value = { ...(r.overrides || {}) }
  draftScore.value = r.draftScore || null
  chat.value = r.tailorChat || []
  applied.value = []
  focusKeys.value = []
  highlight.value = null
  applyNote.value = ''
  rightOpen.value = false
  setupPanel.value = null
  err.value = null
  // A stored draftScore means this exact content was already scored; otherwise score it now.
  lastKey = currentKey()
  if (!draftScore.value && canRescore.value) {
    lastKey = ''
    runRescore()
  }
}

async function openResult(id) {
  if (result.value?._id === id) { setupPanel.value = null; return }
  loadingResult.value = true
  err.value = null
  try {
    openLoaded((await api(`/api/skillgap/${id}`)).result)
  } catch (e) {
    fail(e, () => openResult(id))
  } finally {
    loadingResult.value = false
  }
}

async function analyze() {
  touched.value = true
  err.value = null
  if (!job.value.title.trim() || !job.value.description.trim()) return
  analyzing.value = true
  elapsed.value = 0
  elapsedTimer = setInterval(() => elapsed.value++, 1000)
  try {
    const { result: r } = await api('/api/skillgap', {
      method: 'POST',
      body: {
        job: {
          title: job.value.title.trim(),
          company: job.value.company.trim(),
          description: job.value.description.trim(),
          applicationDeadline: job.value.applicationDeadline || undefined,
        },
        ...(selectedResumeId.value && { resumeId: selectedResumeId.value }),
      },
    })
    openLoaded(r)
    loadHistory()
    loadTodos() // the server just added this analysis's skills
  } catch (e) {
    fail(e, analyze)
  } finally {
    clearInterval(elapsedTimer)
    analyzing.value = false
  }
}

async function saveAsNew() {
  if (!result.value || savingCopy.value) return
  savingCopy.value = true
  err.value = null
  try {
    await flush()
    if (rescoreErr.value) throw new Error("Your latest edits couldn't be scored or saved, so the copy would be out of date. Retry the re-score first.")
    const { result: r } = await api(`/api/skillgap/${result.value._id}/duplicate`, { method: 'POST', body: {} })
    openLoaded(r)
    loadHistory()
  } catch (e) {
    fail(e, saveAsNew)
  } finally {
    savingCopy.value = false
  }
}
// ---------- draft edits ----------
function setOverride(key, value) {
  const next = { ...overrides.value }
  if (value) next[key] = value
  else delete next[key]
  nextMs = 0 // an override is a deliberate click: rescore right away
  overrides.value = next
}

function toggleFocus(key) {
  if (focusKeys.value.includes(key)) {
    focusKeys.value = focusKeys.value.filter((k) => k !== key)
    return
  }
  focusKeys.value = [...focusKeys.value, key].slice(-MAX_FOCUS)
  showPane('chat')
  // Point at the draft line that currently carries the evidence, if any.
  const row = reportScore.value.requirements.find((r) => r.key === key)
  const fieldId = fieldIdForEvidence(draft.value, row?.evidence)
  if (fieldId && window.matchMedia('(min-width: 1400px)').matches) highlight.value = { fieldId, n: Date.now() }
}

function onApply(s) {
  const r = applySuggestion(draft.value, s)
  applied.value = [...applied.value, s.id]
  applyNote.value = r.note
  if (draftKey(r.draft, overrides.value) !== currentKey()) nextMs = APPLY_MS
  draft.value = r.draft
  if (r.fieldId) highlight.value = { fieldId: r.fieldId, n: Date.now() }
  if (!window.matchMedia('(min-width: 1400px)').matches) rightOpen.value = false // reveal the edit behind the drawer
}

function resetDraft() {
  const next = cloneDraft(result.value.tailoredResume)
  if (draftKey(next, overrides.value) !== currentKey()) nextMs = APPLY_MS // only when the watcher will consume it
  draft.value = next
}

// ---------- right pane (chat / preview) ----------
const rightOpen = ref(false) // drawer below xxl
const rightCollapsed = ref(false) // hidden column at xxl
const rightTab = ref('chat')
const pane = ref(null)

function showPane(tab) {
  rightTab.value = tab
  rightOpen.value = true
  rightCollapsed.value = false
  nextTick(() => { if (rightOpen.value && !window.matchMedia('(min-width: 1400px)').matches) pane.value?.focus() })
}
const onKey = (e) => { if (e.key === 'Escape' && rightOpen.value) rightOpen.value = false }

const printResume = () => window.print()

async function copyText() {
  try {
    await navigator.clipboard.writeText(draftToText(draft.value))
    copied.value = true
    setTimeout(() => (copied.value = false), 2500)
  } catch {
    applyNote.value = 'Could not copy to clipboard.'
  }
}

onMounted(() => {
  loadProfile()
  loadHistory()
  loadTodos()
  loadResumes()
  window.addEventListener('keydown', onKey)
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey)
  clearInterval(elapsedTimer)
  stopWork()
})
</script>

<template>
  <section class="sg-page">
    <div class="mb-3">
      <h1 class="h3 fw-semibold mb-1">Skill Gap Analysis</h1>
      <p class="text-body-secondary mb-0">
        Paste a job posting to see how your profile scores, then tailor a resume draft and watch its score move.
      </p>
    </div>

    <div v-if="profileEmpty" class="alert alert-warning" role="status">
      Add your skills or import your resume first —
      <RouterLink to="/profile" class="alert-link">go to Profile</RouterLink>.
    </div>
    <p v-else-if="profileError" class="small text-body-secondary">Profile check unavailable: {{ profileError }}</p>

    <!-- Compact bar once a result is open -->
    <div v-if="result" class="d-flex flex-wrap gap-2 mb-3">
      <button type="button" class="btn btn-sm btn-outline-primary" :aria-expanded="setupPanel === 'form'" @click="setupPanel = setupPanel === 'form' ? null : 'form'">New analysis</button>
      <button type="button" class="btn btn-sm btn-outline-secondary" :aria-expanded="setupPanel === 'history'" @click="setupPanel = setupPanel === 'history' ? null : 'history'">History ({{ history.length }})</button>
    </div>

    <div aria-live="assertive">
      <div v-if="err" class="alert alert-danger d-flex justify-content-between align-items-center gap-2" role="alert">
        <span>{{ err.message }}</span>
        <button v-if="!quota(err) && err.retry" type="button" class="btn btn-sm btn-outline-danger flex-shrink-0" @click="err.retry()">Retry</button>
      </div>
    </div>

    <div v-if="!result || setupPanel" class="row g-4 g-xl-5 mb-4">
      <div v-if="!result || setupPanel === 'form'" class="col-12 col-lg-7">
        <form class="card shadow-sm" novalidate @submit.prevent="analyze">
          <div class="card-body p-4">
            <h2 class="h4 fw-semibold mb-3">Job posting</h2>
            <div class="mb-3">
              <label for="sg-title" class="form-label">Job title <span class="text-danger" aria-hidden="true">*</span></label>
              <input id="sg-title" v-model="job.title" class="form-control" :class="{ 'is-invalid': titleInvalid }" required aria-required="true" :disabled="analyzing" />
              <div class="invalid-feedback">Enter the job title.</div>
            </div>
            <div class="mb-3">
              <label for="sg-company" class="form-label">Company</label>
              <input id="sg-company" v-model="job.company" class="form-control" :disabled="analyzing" />
            </div>
            <div class="mb-3">
              <label for="sg-desc" class="form-label">Job description <span class="text-danger" aria-hidden="true">*</span></label>
              <textarea id="sg-desc" v-model="job.description" rows="9" class="form-control" :class="{ 'is-invalid': descInvalid }" required aria-required="true" placeholder="Paste the full job posting here" :disabled="analyzing"></textarea>
              <div class="invalid-feedback">Paste the job description.</div>
            </div>
            <div class="mb-3">
              <label for="sg-deadline" class="form-label">Application deadline <span class="text-body-secondary">(optional)</span></label>
              <input id="sg-deadline" v-model="job.applicationDeadline" type="date" class="form-control" :disabled="analyzing" />
              <div class="form-text">Used to set deadlines on your skill-gap to-do list.</div>
            </div>
            <div v-if="resumes.length" class="mb-3">
              <label for="sg-resume" class="form-label">Resume to use</label>
              <select id="sg-resume" v-model="selectedResumeId" class="form-select" :disabled="analyzing">
                <option value="">Use base Profile</option>
                <option v-for="r in resumes" :key="r._id" :value="r._id">{{ r.name }}</option>
              </select>
            </div>
            <button type="submit" class="btn btn-primary w-100" :disabled="analyzing">
              <span v-if="analyzing" class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>
              {{ analyzing ? 'Analyzing…' : 'Analyze' }}
            </button>
          </div>
        </form>
      </div>

      <div class="col-12 col-lg-5 d-flex flex-column gap-4">
        <div v-if="!result || setupPanel === 'history'" class="card shadow-sm">
          <div class="card-body p-4 pb-2"><h2 class="h4 fw-semibold mb-0">History</h2></div>
          <div v-if="historyLoading" class="px-4 pb-3 text-body-secondary small" role="status">Loading…</div>
          <div v-else-if="historyError" class="px-4 pb-3 text-danger-emphasis small">{{ historyError }}</div>
          <p v-else-if="!history.length" class="px-4 pb-3 mb-0 text-body-secondary">No analyses yet.</p>
          <div v-else class="list-group list-group-flush rounded-bottom sg-history">
            <button
              v-for="h in history"
              :key="h._id"
              type="button"
              class="list-group-item list-group-item-action d-flex justify-content-between align-items-center gap-2"
              :class="{ active: result && result._id === h._id }"
              :aria-current="result && result._id === h._id ? 'true' : undefined"
              :disabled="loadingResult"
              @click="openResult(h._id)"
            >
              <span class="text-truncate">
                <span class="fw-semibold d-block text-truncate">{{ h.job?.title }}<template v-if="h.job?.company"> · {{ h.job.company }}</template></span>
                <small :class="result && result._id === h._id ? '' : 'text-body-secondary'">{{ fmtDate(h.createdAt) }}<template v-if="h.sourceResume?.name"> · {{ h.sourceResume.name }}</template><template v-if="h.label"> · {{ h.label }}</template></small>
              </span>
              <span class="badge flex-shrink-0 border" :class="`text-bg-${histBadge(h).meta.variant}`">{{ histBadge(h).score }} · {{ histBadge(h).meta.label.replace(' match', '') }}</span>
            </button>
          </div>
        </div>
        <SkillTodoCard
          :tasks="todos"
          :loading="todosLoading"
          :error="todosError"
          :action-error="todoActionError"
          :busy-id="todoBusy"
          @toggle="toggleTodo"
          @remove="removeTodo"
        />
      </div>
    </div>

    <!-- Honest loading state: first-time analyses are slow -->
    <div v-if="analyzing" class="card shadow-sm mb-4" role="status">
      <div class="card-body py-4 text-center">
        <span class="spinner-border mb-3" aria-hidden="true"></span>
        <p class="h5 mb-1">{{ stage }}</p>
        <p class="text-body-secondary mb-2"><span class="fw-semibold">{{ elapsed }}s</span> elapsed (stage is an estimate)</p>
        <p class="small text-body-secondary mb-0 mx-auto" style="max-width: 36rem">
          First-time analysis of a new posting can take up to ~100 seconds — we read the posting, grade every requirement, then write your tailored draft. Re-running the same posting is much faster.
        </p>
      </div>
    </div>
    <div v-else-if="loadingResult" class="card shadow-sm mb-4" role="status">
      <div class="card-body text-center py-4"><span class="spinner-border me-2" aria-hidden="true"></span>Loading result…</div>
    </div>

    <div v-if="!result && !analyzing && !loadingResult" class="card shadow-sm">
      <div class="card-body text-center py-5">
        <h2 class="h5">No analysis yet</h2>
        <p class="text-body-secondary mb-0 mx-auto" style="max-width: 34rem">
          Submit a job posting and you'll get a requirement-by-requirement match score, a tailored resume draft you can edit with a live score, and an AI assistant to close the gaps truthfully.
        </p>
      </div>
    </div>

    <!-- Workspace -->
    <template v-if="result && !analyzing">
      <header class="sg-head card shadow-sm mb-4">
        <div class="card-body py-3 px-4 d-flex flex-wrap align-items-center gap-3">
          <div class="me-auto min-w-0">
            <h2 class="h4 fw-semibold mb-0">{{ result.job.title }}<template v-if="result.job.company"> · {{ result.job.company }}</template></h2>
            <small class="text-body-secondary">
              Analyzed {{ fmtDate(result.createdAt) }}<template v-if="result.job?.applicationDeadline"> · Apply by {{ fmtDate(result.job.applicationDeadline) }}</template><template v-if="result.label"> · <span class="badge text-bg-light border fw-normal">{{ result.label }}</span></template>
            </small>
          </div>
          <div class="small" role="status" aria-live="polite">
            <span v-if="!canRescore"></span>
            <span v-else-if="rescoreErr && !dirty && !rescoring" class="text-danger-emphasis">
              {{ rescoreErr.message }}
              <button v-if="!quota(rescoreErr)" type="button" class="btn btn-sm btn-outline-danger ms-1 py-0" @click="runRescore">Retry</button>
            </span>
            <span v-else-if="dirty" class="text-body-secondary">Changes pending…</span>
            <span v-else-if="rescoring" class="text-body-secondary"><span class="spinner-border spinner-border-sm me-1" aria-hidden="true"></span>Re-scoring draft… usually 5–20s, instant if nothing changed</span>
            <span v-else class="text-success-emphasis">Draft score up to date</span>
          </div>
          <div class="d-flex flex-wrap gap-2">
            <button type="button" class="btn btn-sm btn-outline-secondary" :disabled="savingCopy || !canRescore" @click="saveAsNew">
              <span v-if="savingCopy" class="spinner-border spinner-border-sm me-1" aria-hidden="true"></span>Save as new version
            </button>
            <button type="button" class="btn btn-sm btn-primary" @click="showPane('chat')">Tailor chat</button>
            <button type="button" class="btn btn-sm btn-outline-primary" @click="showPane('preview')">Preview</button>
            <button v-if="!rightCollapsed" type="button" class="btn btn-sm btn-outline-secondary d-none d-xxl-inline-flex" @click="rightCollapsed = true">Hide panel</button>
          </div>
        </div>
      </header>

      <p v-if="applyNote" class="alert alert-info py-2 small" role="status">{{ applyNote }}</p>

      <div class="row g-4 g-xl-5 g-xxl-4">
        <div class="col-12 col-lg-4 col-xxl-3">
          <div class="sg-left" tabindex="0" role="region" aria-label="Score report" :aria-busy="dirty || rescoring">
            <ScoreReport
              :class="{ 'sg-stale': (dirty || rescoring) && draftScore }"
              :score="reportScore"
              :profile-score="profileScore"
              :is-draft="!!draftScore"
              :eligibility="result.eligibility || []"
              :overrides="overrides"
              :focus-keys="focusKeys"
              :editable="canRescore"
              @focus="toggleFocus"
              @override="setOverride"
            />
          </div>
        </div>

        <div class="col-12 col-lg-8" :class="rightCollapsed ? 'col-xxl-9' : 'col-xxl-5'">
          <DraftEditor v-model="draft" :highlight="highlight" @reset="resetDraft" />
        </div>

        <div class="sg-right-col col-xxl-4" :class="{ 'd-xxl-none': rightCollapsed }">
          <div v-if="rightOpen" class="offcanvas-backdrop fade show d-xxl-none" @click="rightOpen = false"></div>
          <aside ref="pane" class="offcanvas-xxl offcanvas-end sg-right" :class="{ show: rightOpen }" tabindex="-1" aria-label="Tailor chat and preview">
            <div class="sg-pane-head d-flex align-items-center gap-2 px-3 pt-2 border-bottom">
              <div class="nav nav-tabs border-0 flex-grow-1" role="tablist">
                <button id="sg-tab-chat" type="button" class="nav-link" :class="{ active: rightTab === 'chat' }" role="tab" :aria-selected="rightTab === 'chat'" aria-controls="sg-panel-chat" @click="rightTab = 'chat'">Tailor chat</button>
                <button id="sg-tab-preview" type="button" class="nav-link" :class="{ active: rightTab === 'preview' }" role="tab" :aria-selected="rightTab === 'preview'" aria-controls="sg-panel-preview" @click="rightTab = 'preview'">Preview</button>
              </div>
              <button type="button" class="btn-close d-xxl-none mb-2" aria-label="Close panel" @click="rightOpen = false"></button>
            </div>
            <div class="sg-pane-body">
              <div v-show="rightTab === 'chat'" id="sg-panel-chat" class="h-100" role="tabpanel" aria-labelledby="sg-tab-chat">
                <TailorChat
                  v-model:messages="chat"
                  :result-id="result._id"
                  :focus="focusRows"
                  :draft="draft"
                  :applied-ids="applied"
                  @apply="onApply"
                  @remove-focus="toggleFocus"
                  @clear-focus="focusKeys = []"
                />
              </div>
              <div v-if="rightTab === 'preview'" id="sg-panel-preview" class="h-100 overflow-auto p-3" role="tabpanel" aria-labelledby="sg-tab-preview">
                <div class="d-flex flex-wrap gap-2 mb-2">
                  <button type="button" class="btn btn-sm btn-outline-secondary" @click="copyText">{{ copied ? 'Copied' : 'Copy as text' }}</button>
                  <button type="button" class="btn btn-sm btn-primary" @click="printResume">Print / Save as PDF</button>
                </div>
                <p class="small text-body-secondary">AI draft built only from your profile — review it before using.</p>
                <ResumePaper :draft="draft" :profile="profile" />
              </div>
            </div>
          </aside>
        </div>
      </div>

      <!-- Always mounted (teleported to <body>), hidden on screen; the only thing window.print() shows -->
      <Teleport to="body"><ResumePaper print :draft="draft" :profile="profile" /></Teleport>
    </template>

    <SkillTodoCard
      v-if="result && !setupPanel"
      class="mt-4"
      :tasks="todos"
      :loading="todosLoading"
      :error="todosError"
      :action-error="todoActionError"
      :busy-id="todoBusy"
      @toggle="toggleTodo"
      @remove="removeTodo"
    />
  </section>
</template>

<style scoped>
/* Page canvas: light-gray surface so white cards separate by contrast, not just borders. */
.sg-page { background: var(--bs-tertiary-bg); border-radius: var(--bs-border-radius-lg); padding: 1.5rem; }
@media (max-width: 767.98px) { .sg-page { padding: 1rem; } }
.min-w-0 { min-width: 0; }
.sg-history { max-height: 26rem; overflow-y: auto; --bs-list-group-item-padding-x: 1.5rem; }
.sg-stale { opacity: 0.7; transition: opacity 0.15s; }

/* Left pane: sticky with its own scroll once it sits beside the editor. */
@media (min-width: 992px) {
  .sg-left { position: sticky; top: 1rem; max-height: calc(100dvh - 2rem); overflow-y: auto; padding: 2px; }
}

/* Right pane: slide-over drawer below xxl (Bootstrap offcanvas-xxl), in-grid sticky panel at xxl. */
.sg-right { --bs-offcanvas-width: min(100vw, 28rem); display: flex; flex-direction: column; background: var(--bs-body-bg); }
.sg-pane-body { flex: 1 1 auto; min-height: 0; }
.sg-pane-head .nav-link { cursor: pointer; }
@media (max-width: 1399.98px) {
  .sg-right-col { display: contents; }
  .sg-right { z-index: 1045; }
}
@media (min-width: 1400px) {
  .sg-right {
    /* Bootstrap makes .offcanvas-xxl transparent (!important) at xxl; keep the pane white on the gray canvas. */
    background-color: var(--bs-body-bg) !important;
    position: sticky; top: 1rem; height: calc(100dvh - 2rem);
    border: 1px solid var(--bs-border-color); border-radius: var(--bs-border-radius-lg);
    box-shadow: var(--bs-box-shadow-sm); overflow: hidden;
  }
}
@media (prefers-reduced-motion: reduce) { .sg-stale { transition: none; } }
</style>
