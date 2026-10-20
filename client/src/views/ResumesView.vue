<script setup>
import { ref, onMounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { api } from '../lib/api.js'
import ConfirmButton from '../components/common/ConfirmButton.vue'

const router = useRouter()
const resumes = ref([])
const loading = ref(true)
const loadError = ref('')
const showCreate = ref(false)
const newName = ref('')
const nameError = ref('')
const creatingSeed = ref('') // '' | 'profile' | 'blank'
const createError = ref('')
const busyId = ref('')
const armedId = ref('')
const nameInput = ref(null)
const newBtn = ref(null)

const icon = { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': 1.75, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true' }

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

function openCreate() {
  showCreate.value = true
  createError.value = ''
  nameError.value = ''
  nextTick(() => nameInput.value?.focus())
}

function closeCreate() {
  if (creatingSeed.value) return
  showCreate.value = false
  newName.value = ''
  nameError.value = ''
  createError.value = ''
  nextTick(() => newBtn.value?.focus())
}

async function createResume(seed) {
  const name = newName.value.trim()
  if (!name) {
    nameError.value = 'Give your resume a name first.'
    nameInput.value?.focus()
    return
  }
  creatingSeed.value = seed
  createError.value = ''
  try {
    const { resume } = await api('/api/resumes', { method: 'POST', body: { name, seed } })
    router.push(`/resumes/${resume._id}`)
  } catch (e) {
    createError.value = e.message
  } finally {
    creatingSeed.value = ''
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
      <button v-if="!showCreate" ref="newBtn" type="button" class="btn btn-primary" @click="openCreate">+ New resume</button>
    </div>

    <div v-if="showCreate" id="new-resume-panel" class="card shadow-sm border-primary-subtle mb-4">
      <div class="card-body p-4">
        <form novalidate @submit.prevent="createResume('profile')" @keydown.esc="closeCreate">
          <h2 class="h5 mb-1">New resume</h2>
          <p class="small text-body-secondary mb-3">Name it after the role you're targeting so it's easy to pick later.</p>

          <label for="new-resume-name" class="form-label fw-semibold">Resume name</label>
          <input
            id="new-resume-name"
            ref="nameInput"
            v-model="newName"
            name="resumeName"
            class="form-control"
            :class="{ 'is-invalid': nameError }"
            maxlength="80"
            autocomplete="off"
            placeholder="e.g. Backend Intern…"
            :disabled="!!creatingSeed"
            :aria-invalid="nameError ? 'true' : undefined"
            :aria-describedby="nameError ? 'new-resume-name-err' : undefined"
            @input="nameError = ''"
          />
          <div v-if="nameError" id="new-resume-name-err" class="invalid-feedback" role="alert">{{ nameError }}</div>

          <fieldset class="mt-4 mb-0">
            <legend class="form-label fw-semibold fs-6 mb-2">How do you want to start?</legend>
            <div class="row g-2">
              <div class="col-12 col-sm-6">
                <button type="submit" class="nr-option is-default w-100 h-100 text-start" :disabled="!!creatingSeed">
                  <span class="d-flex gap-3">
                    <svg v-bind="icon" class="nr-icon"><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" /></svg>
                    <span class="d-block">
                      <span class="d-block fw-semibold">
                        <template v-if="creatingSeed === 'profile'"><span class="spinner-border spinner-border-sm me-1" aria-hidden="true"></span>Creating…</template>
                        <template v-else>Start from Profile</template>
                      </span>
                      <span class="d-block small text-body-secondary mt-1">Copies your saved summary, skills, experience, projects and education. Edit anything afterwards.</span>
                    </span>
                  </span>
                </button>
              </div>
              <div class="col-12 col-sm-6">
                <button type="button" class="nr-option w-100 h-100 text-start" :disabled="!!creatingSeed" @click="createResume('blank')">
                  <span class="d-flex gap-3">
                    <svg v-bind="icon" class="nr-icon"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5" /></svg>
                    <span class="d-block">
                      <span class="d-block fw-semibold">
                        <template v-if="creatingSeed === 'blank'"><span class="spinner-border spinner-border-sm me-1" aria-hidden="true"></span>Creating…</template>
                        <template v-else>Start blank</template>
                      </span>
                      <span class="d-block small text-body-secondary mt-1">Empty sections to fill in yourself — or use Upload PDF in the editor to import an existing resume.</span>
                    </span>
                  </span>
                </button>
              </div>
            </div>
          </fieldset>
          <div class="form-text">Press Enter to start from Profile.</div>

          <div v-if="createError" class="alert alert-danger py-2 small mt-3 mb-0" role="alert">{{ createError }}</div>

          <div class="d-flex justify-content-end mt-3">
            <button type="button" class="btn btn-sm btn-outline-secondary" :disabled="!!creatingSeed" @click="closeCreate">Cancel</button>
          </div>
        </form>
      </div>
    </div>

    <div v-if="loadError" class="alert alert-danger" role="alert">{{ loadError }}</div>

    <div v-if="loading" class="d-flex align-items-center gap-2 text-body-secondary" role="status">
      <span class="spinner-border spinner-border-sm" aria-hidden="true"></span> Loading…
    </div>

    <div v-else-if="!resumes.length">
      <div v-if="!showCreate" class="card shadow-sm">
        <div class="card-body text-center py-5">
          <h2 class="h5">No resumes yet</h2>
          <p class="text-body-secondary mb-0">Create one to get a split-view editor with a live preview.</p>
          <button type="button" class="btn btn-primary btn-sm mt-3" @click="openCreate">Create your first resume</button>
        </div>
      </div>
    </div>

    <div v-else class="list-group shadow-sm">
      <div v-for="r in resumes" :key="r._id" class="list-group-item d-flex flex-wrap justify-content-between align-items-center gap-2">
        <RouterLink :to="`/resumes/${r._id}`" class="text-decoration-none flex-grow-1 min-w-0">
          <div class="fw-semibold text-truncate">{{ r.name }}</div>
          <small class="text-body-secondary">Updated {{ fmtDate(r.updatedAt) }}</small>
        </RouterLink>
        <div class="d-flex flex-wrap align-items-center gap-2">
          <button v-if="armedId !== r._id" type="button" class="btn btn-sm btn-outline-secondary" :disabled="busyId === r._id" @click="duplicate(r)">Duplicate</button>
          <ConfirmButton
            label="Delete"
            prompt="Delete this resume? This can't be undone."
            confirm-label="Delete"
            :trigger-aria-label="`Delete ${r.name}`"
            :busy="busyId === r._id"
            :disabled="busyId === r._id"
            @armed="(on) => { armedId = on ? r._id : (armedId === r._id ? '' : armedId) }"
            @confirm="remove(r)"
          />
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.nr-option { display: block; padding: 0.875rem 1rem; border: 1px solid var(--bs-border-color); border-radius: var(--bs-border-radius-lg); background: var(--bs-body-bg); color: var(--bs-body-color); transition: border-color 0.15s, background-color 0.15s, box-shadow 0.15s; }
.nr-option.is-default { border-color: var(--bs-primary-border-subtle); }
.nr-option:hover:not(:disabled) { border-color: var(--bs-primary); background: var(--bs-primary-bg-subtle); }
.nr-option:focus-visible { outline: 0; border-color: var(--bs-primary); box-shadow: 0 0 0 0.25rem rgba(var(--bs-primary-rgb), 0.25); }
.nr-option:disabled { opacity: 0.65; cursor: not-allowed; }
.nr-icon { width: 1.25rem; height: 1.25rem; color: var(--bs-primary); flex-shrink: 0; margin-top: 0.125rem; }
@media (prefers-reduced-motion: reduce) { .nr-option { transition: none; } }
</style>
