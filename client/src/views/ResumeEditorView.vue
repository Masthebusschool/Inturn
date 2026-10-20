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
