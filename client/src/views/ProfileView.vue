<script setup>
import { ref, reactive, computed, watch, nextTick, onMounted } from 'vue'
import ChipInput from '../components/ChipInput.vue'
import { api } from '../lib/api.js'

let keySeq = 0
const nextKey = () => `k${++keySeq}`

const lines = (t) => (t || '').split('\n').map((s) => s.trim()).filter(Boolean)
const csv = (t) => (t || '').split(',').map((s) => s.trim()).filter(Boolean)
const dedupeCi = (arr) => {
  const seen = new Set()
  return arr.filter((s) => {
    const k = s.toLowerCase()
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}

// API entry -> form row (bullets/skills become text)
const expToForm = (e = {}) => ({
  key: e._id || nextKey(), title: e.title || '', company: e.company || '',
  startDate: e.startDate || '', endDate: e.endDate || '', current: !!e.current,
  bulletsText: (e.bullets || []).join('\n'), skillsText: (e.skills || []).join(', '),
})
const projToForm = (p = {}) => ({
  key: p._id || nextKey(), name: p.name || '', url: p.url || '',
  bulletsText: (p.bullets || []).join('\n'), skillsText: (p.skills || []).join(', '),
})
const eduToForm = (e = {}) => ({
  key: e._id || nextKey(), school: e.school || '', degree: e.degree || '', field: e.field || '',
  startDate: e.startDate || '', endDate: e.endDate || '',
})

const form = reactive({
  educationLevel: '', summary: '', skills: [], targetRoles: [], targetIndustries: [],
  experience: [], projects: [], education: [],
})
const loading = ref(true)
const loadError = ref('')
const saving = ref(false)
const saveError = ref('')
const saved = ref(false)
const dirty = ref(false)
const parsing = ref(false)
const parseError = ref('')
const merged = ref(false)
const file = ref(null)
const aiSummary = ref('')
let loaded = false

function applyProfile(p = {}) {
  loaded = false
  form.educationLevel = p.educationLevel || ''
  form.summary = p.summary || ''
  form.skills = [...(p.skills || [])]
  form.targetRoles = [...(p.targetRoles || [])]
  form.targetIndustries = [...(p.targetIndustries || [])]
  form.experience = (p.experience || []).map(expToForm)
  form.projects = (p.projects || []).map(projToForm)
  form.education = (p.education || []).map(eduToForm)
  dirty.value = false
  // re-enable dirty tracking only after the watcher has flushed
  nextTick(() => { loaded = true })
}

watch(form, () => { if (loaded) { dirty.value = true; saved.value = false } }, { deep: true })

onMounted(async () => {
  try {
    const { profile } = await api('/api/profile')
    applyProfile(profile)
  } catch (e) {
    loadError.value = e.message
    applyProfile({})
  } finally {
    loading.value = false
  }
})

function payload() {
  return {
    educationLevel: form.educationLevel.trim(),
    summary: form.summary.trim(),
    skills: form.skills,
    targetRoles: form.targetRoles,
    targetIndustries: form.targetIndustries,
    experience: form.experience.map(({ title, company, startDate, endDate, current, bulletsText, skillsText }) => ({
      title, company, startDate, endDate: current ? '' : endDate, current,
      bullets: lines(bulletsText), skills: csv(skillsText),
    })),
    projects: form.projects.map(({ name, url, bulletsText, skillsText }) => ({
      name, url, bullets: lines(bulletsText), skills: csv(skillsText),
    })),
    education: form.education.map(({ school, degree, field, startDate, endDate }) => ({
      school, degree, field, startDate, endDate,
    })),
  }
}

async function save() {
  saving.value = true
  saveError.value = ''
  saved.value = false
  try {
    const { profile } = await api('/api/profile', { method: 'PUT', body: payload() })
    applyProfile(profile)
    merged.value = false
    aiSummary.value = ''
    saved.value = true
  } catch (e) {
    saveError.value = e.message
  } finally {
    saving.value = false
  }
}

function onFile(e) {
  file.value = e.target.files?.[0] || null
  parseError.value = ''
}

async function parseResume() {
  if (!file.value) return
  parsing.value = true
  parseError.value = ''
  try {
    const fd = new FormData()
    fd.append('resume', file.value)
    const { draft } = await api('/api/profile/resume/parse', { method: 'POST', body: fd })
    mergeDraft(draft || {})
  } catch (e) {
    parseError.value = e.message
  } finally {
    parsing.value = false
  }
}

function mergeDraft(d) {
  if (d.summary) {
    if (!form.summary.trim()) form.summary = d.summary
    else if (d.summary.trim() !== form.summary.trim()) aiSummary.value = d.summary
  }
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
  merged.value = true
  dirty.value = true
}

function useAiSummary() {
  form.summary = aiSummary.value
  aiSummary.value = ''
}

const addExp = () => form.experience.push(expToForm())
const addProj = () => form.projects.push(projToForm())
const addEdu = () => form.education.push(eduToForm())
const removeAt = (list, i) => list.splice(i, 1)

const levels = ['High school', 'Diploma', 'Undergraduate', 'Postgraduate', 'Other']
const levelOptions = computed(() =>
  form.educationLevel && !levels.includes(form.educationLevel) ? [form.educationLevel, ...levels] : levels,
)
</script>

<template>
  <section class="pb-5">
    <div class="mb-4">
      <h1 class="h3 mb-1">Your profile</h1>
      <p class="text-body-secondary mb-0">
        Your full history lives here. Skill Gap Analysis only ever draws from what you save on this page.
      </p>
    </div>

    <div v-if="loading" class="d-flex align-items-center gap-2 text-body-secondary mb-3" role="status">
      <span class="spinner-border spinner-border-sm" aria-hidden="true"></span> Loading profile…
    </div>
    <div v-if="loadError" class="alert alert-danger" role="alert">{{ loadError }}</div>

    <!-- Import -->
    <div class="card shadow-sm mb-4">
      <div class="card-body">
        <h2 class="h5">Import from resume</h2>
        <p class="text-body-secondary small mb-3">
          Upload a PDF (max 5 MB) and AI will draft your profile. This takes a few seconds, and nothing is saved until you click Save Profile.
        </p>
        <div class="row g-2 align-items-end">
          <div class="col-12 col-md">
            <label for="resume-file" class="form-label">Resume (PDF)</label>
            <input id="resume-file" type="file" class="form-control" accept="application/pdf" :disabled="parsing" @change="onFile" />
          </div>
          <div class="col-12 col-md-auto">
            <button type="button" class="btn btn-primary w-100" :disabled="!file || parsing" @click="parseResume">
              <span v-if="parsing" class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>
              {{ parsing ? 'Parsing…' : 'Parse with AI' }}
            </button>
          </div>
        </div>
        <div class="mt-3" aria-live="polite">
          <div v-if="parseError" class="alert alert-danger mb-0" role="alert">{{ parseError }}</div>
          <div v-if="merged" class="alert alert-info alert-dismissible mb-0" role="status">
            AI draft merged below — review, edit, then Save Profile.
            <button type="button" class="btn-close" aria-label="Dismiss" @click="merged = false"></button>
          </div>
        </div>
      </div>
    </div>

    <form @submit.prevent="save">
      <!-- Basics -->
      <div class="card shadow-sm mb-4">
        <div class="card-body">
          <h2 class="h5 mb-3">Basics</h2>
          <div class="row g-3">
            <div class="col-12 col-md-4">
              <label for="p-level" class="form-label">Education level</label>
              <select id="p-level" v-model="form.educationLevel" class="form-select">
                <option value="">Select…</option>
                <option v-for="l in levelOptions" :key="l" :value="l">{{ l }}</option>
              </select>
            </div>
            <div class="col-12">
              <label for="p-summary" class="form-label">Summary</label>
              <textarea id="p-summary" v-model="form.summary" class="form-control" rows="4" placeholder="A few sentences about you, your strengths and what you're aiming for."></textarea>
              <div v-if="aiSummary" class="alert alert-secondary mt-2 mb-0 py-2 small">
                <div class="fw-semibold mb-1">AI suggested summary</div>
                <p class="mb-2">{{ aiSummary }}</p>
                <button type="button" class="btn btn-sm btn-outline-primary me-2" @click="useAiSummary">Use AI summary</button>
                <button type="button" class="btn btn-sm btn-link text-body-secondary" @click="aiSummary = ''">Keep mine</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Skills + targets -->
      <div class="card shadow-sm mb-4">
        <div class="card-body">
          <h2 class="h5 mb-3">Skills &amp; targets</h2>
          <div class="mb-4">
            <ChipInput v-model="form.skills" id="p-skills" label="Skills" placeholder="e.g. Python, SQL, Figma — press Enter" />
          </div>
          <div class="row g-4">
            <div class="col-12 col-md-6">
              <ChipInput v-model="form.targetRoles" id="p-roles" label="Target roles" placeholder="e.g. Data Analyst Intern" />
            </div>
            <div class="col-12 col-md-6">
              <ChipInput v-model="form.targetIndustries" id="p-ind" label="Target industries" placeholder="e.g. Fintech" />
            </div>
          </div>
        </div>
      </div>

      <!-- Experience -->
      <div class="card shadow-sm mb-4">
        <div class="card-body">
          <div class="d-flex justify-content-between align-items-center mb-3">
            <h2 class="h5 mb-0">Experience</h2>
            <button type="button" class="btn btn-sm btn-outline-primary" @click="addExp">+ Add experience</button>
          </div>
          <p v-if="!form.experience.length" class="text-body-secondary mb-0">No experience yet — add one or import a resume.</p>
          <div v-for="(x, i) in form.experience" :key="x.key" class="border rounded p-3 mb-3 bg-body-tertiary">
            <div class="row g-2">
              <div class="col-12 col-md-6">
                <label :for="`e-title-${x.key}`" class="form-label small">Title</label>
                <input :id="`e-title-${x.key}`" v-model="x.title" class="form-control" />
              </div>
              <div class="col-12 col-md-6">
                <label :for="`e-co-${x.key}`" class="form-label small">Company</label>
                <input :id="`e-co-${x.key}`" v-model="x.company" class="form-control" />
              </div>
              <div class="col-6 col-md-3">
                <label :for="`e-s-${x.key}`" class="form-label small">Start</label>
                <input :id="`e-s-${x.key}`" v-model="x.startDate" class="form-control" placeholder="Jan 2024" />
              </div>
              <div class="col-6 col-md-3">
                <label :for="`e-e-${x.key}`" class="form-label small">End</label>
                <input :id="`e-e-${x.key}`" v-model="x.endDate" class="form-control" placeholder="Aug 2024" :disabled="x.current" />
              </div>
              <div class="col-12 col-md-6 d-flex align-items-end">
                <div class="form-check mb-2">
                  <input :id="`e-c-${x.key}`" v-model="x.current" type="checkbox" class="form-check-input" />
                  <label :for="`e-c-${x.key}`" class="form-check-label">I currently work here</label>
                </div>
              </div>
              <div class="col-12">
                <label :for="`e-b-${x.key}`" class="form-label small">Bullets (one per line)</label>
                <textarea :id="`e-b-${x.key}`" v-model="x.bulletsText" class="form-control" rows="4"></textarea>
              </div>
              <div class="col-12">
                <label :for="`e-k-${x.key}`" class="form-label small">Skills used (comma-separated)</label>
                <input :id="`e-k-${x.key}`" v-model="x.skillsText" class="form-control" />
              </div>
            </div>
            <button type="button" class="btn btn-sm btn-outline-danger mt-3" @click="removeAt(form.experience, i)">Remove experience</button>
          </div>
        </div>
      </div>

      <!-- Projects -->
      <div class="card shadow-sm mb-4">
        <div class="card-body">
          <div class="d-flex justify-content-between align-items-center mb-3">
            <h2 class="h5 mb-0">Projects</h2>
            <button type="button" class="btn btn-sm btn-outline-primary" @click="addProj">+ Add project</button>
          </div>
          <p v-if="!form.projects.length" class="text-body-secondary mb-0">No projects yet — add one or import a resume.</p>
          <div v-for="(x, i) in form.projects" :key="x.key" class="border rounded p-3 mb-3 bg-body-tertiary">
            <div class="row g-2">
              <div class="col-12 col-md-6">
                <label :for="`p-n-${x.key}`" class="form-label small">Name</label>
                <input :id="`p-n-${x.key}`" v-model="x.name" class="form-control" />
              </div>
              <div class="col-12 col-md-6">
                <label :for="`p-u-${x.key}`" class="form-label small">URL</label>
                <input :id="`p-u-${x.key}`" v-model="x.url" type="url" class="form-control" placeholder="https://" />
              </div>
              <div class="col-12">
                <label :for="`p-b-${x.key}`" class="form-label small">Bullets (one per line)</label>
                <textarea :id="`p-b-${x.key}`" v-model="x.bulletsText" class="form-control" rows="3"></textarea>
              </div>
              <div class="col-12">
                <label :for="`p-k-${x.key}`" class="form-label small">Skills used (comma-separated)</label>
                <input :id="`p-k-${x.key}`" v-model="x.skillsText" class="form-control" />
              </div>
            </div>
            <button type="button" class="btn btn-sm btn-outline-danger mt-3" @click="removeAt(form.projects, i)">Remove project</button>
          </div>
        </div>
      </div>

      <!-- Education -->
      <div class="card shadow-sm mb-4">
        <div class="card-body">
          <div class="d-flex justify-content-between align-items-center mb-3">
            <h2 class="h5 mb-0">Education</h2>
            <button type="button" class="btn btn-sm btn-outline-primary" @click="addEdu">+ Add school</button>
          </div>
          <p v-if="!form.education.length" class="text-body-secondary mb-0">No education yet — add one or import a resume.</p>
          <div v-for="(x, i) in form.education" :key="x.key" class="border rounded p-3 mb-3 bg-body-tertiary">
            <div class="row g-2">
              <div class="col-12 col-md-6">
                <label :for="`s-n-${x.key}`" class="form-label small">School</label>
                <input :id="`s-n-${x.key}`" v-model="x.school" class="form-control" />
              </div>
              <div class="col-12 col-md-6">
                <label :for="`s-d-${x.key}`" class="form-label small">Degree</label>
                <input :id="`s-d-${x.key}`" v-model="x.degree" class="form-control" />
              </div>
              <div class="col-12 col-md-6">
                <label :for="`s-f-${x.key}`" class="form-label small">Field of study</label>
                <input :id="`s-f-${x.key}`" v-model="x.field" class="form-control" />
              </div>
              <div class="col-6 col-md-3">
                <label :for="`s-s-${x.key}`" class="form-label small">Start</label>
                <input :id="`s-s-${x.key}`" v-model="x.startDate" class="form-control" />
              </div>
              <div class="col-6 col-md-3">
                <label :for="`s-e-${x.key}`" class="form-label small">End</label>
                <input :id="`s-e-${x.key}`" v-model="x.endDate" class="form-control" />
              </div>
            </div>
            <button type="button" class="btn btn-sm btn-outline-danger mt-3" @click="removeAt(form.education, i)">Remove school</button>
          </div>
        </div>
      </div>

      <!-- Save bar -->
      <div class="profile-savebar border rounded bg-body shadow p-3 d-flex flex-wrap align-items-center gap-3">
        <button type="submit" class="btn btn-primary" :disabled="saving || loading">
          <span v-if="saving" class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>
          {{ saving ? 'Saving…' : 'Save Profile' }}
        </button>
        <span v-if="dirty" class="badge text-bg-warning">Unsaved changes</span>
        <div aria-live="polite" class="flex-grow-1">
          <span v-if="saved && !dirty" class="text-success-emphasis fw-semibold">Profile saved</span>
          <span v-if="saveError" class="text-danger-emphasis" role="alert">{{ saveError }}</span>
        </div>
      </div>
    </form>
  </section>
</template>

<style scoped>
.profile-savebar {
  position: sticky;
  bottom: 1rem;
  z-index: 10;
}
</style>
