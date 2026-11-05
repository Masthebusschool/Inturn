<script setup>
import { reactive, ref, computed, watch, nextTick, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { api } from '../lib/api.js'
import ResumePreview from '../components/resumes/ResumePreview.vue'
import ConfirmButton from '../components/common/ConfirmButton.vue'
import { setMatchingResume } from "../stores/jobMatch.js";
import { contactLinks } from '../utils/contact.js'
import { canonical } from '../utils/skillNormalize.js'
import { lines, csv, nextKey, expToForm, projToForm, expFromForm, projFromForm } from '../utils/resumeForm.js'

const props = defineProps({ id: { type: String, required: true } })
const router = useRouter()

const eduToForm = (e = {}) => ({
  key: e._id || nextKey(), school: e.school || '', degree: e.degree || '', field: e.field || '', grade: e.grade || '',
  startDate: e.startDate || '', endDate: e.endDate || '', bulletsText: (e.bullets || []).join('\n'),
})

const addExp = () => form.experience.push(expToForm())
const addProj = () => form.projects.push(projToForm())
const addEdu = () => form.education.push(eduToForm())
const removeAt = (list, i) => list.splice(i, 1)

const form = reactive({
  name: '',
  contact: { fullName: '', phone: '', email: '', links: [] },
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
// Only the profile (primary) resume feeds Internship Discovery matching
let isPrimary = false

// "+ Add info" mini-form for a new contact link
const addingLink = ref(false)
const newLink = reactive({ label: '', value: '' })
const newLinkError = ref('')

function openAddLink() {
  newLink.label = ''
  newLink.value = ''
  newLinkError.value = ''
  addingLink.value = true
}

function confirmAddLink() {
  const label = newLink.label.trim()
  const value = newLink.value.trim()
  if (!label || !value) { newLinkError.value = 'Enter both a section name and a value'; return }
  form.contact.links.push({ label, value })
  addingLink.value = false
}

function applyResume(r = {}) {
  loaded = false
  form.name = r.name || ''
  isPrimary = !!r.primary
  // contactLinks also lifts legacy linkedin/github/portfolio values into the list; the server drops those fields on save
  form.contact = {
    fullName: r.contact?.fullName || '',
    phone: r.contact?.phone || '',
    email: r.contact?.email || '',
    links: contactLinks(r.contact).map((l) => ({ ...l })),
  }
  form.summary = r.summary || ''
  form.skills = [...(r.skills || [])]
  form.experience = (r.experience || []).map(expToForm)
  form.projects = (r.projects || []).map(projToForm)
  form.education = (r.education || []).map(eduToForm)
  updateJobMatchingSkills();
  dirty.value = false
  nextTick(() => { loaded = true })
}

watch(form, () => {if (loaded) {dirty.value = true; saved.value = false; updateJobMatchingSkills();}}, { deep: true });

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
    contact: {
      fullName: form.contact.fullName,
      phone: form.contact.phone,
      email: form.contact.email,
      links: form.contact.links.map((l) => ({ label: l.label.trim(), value: l.value.trim() })),
    },
    summary: form.summary.trim(),
    skills: form.skills,
    experience: form.experience.map(expFromForm),
    projects: form.projects.map(projFromForm),
    education: form.education.map(({ school, degree, field, grade, startDate, endDate, bulletsText }) => ({
      school, degree, field, grade, startDate, endDate, bullets: lines(bulletsText),
    })),
  }
}

const previewData = computed(() => ({
  contact: form.contact,
  summary: form.summary,
  skills: form.skills,
  experience: form.experience.map((e) => ({
    title: e.title, company: e.company, location: e.location, startDate: e.startDate,
    endDate: e.current ? 'Present' : e.endDate, bullets: lines(e.bulletsText),
  })),
  projects: form.projects.map((p) => ({
    name: p.name, startDate: p.startDate, endDate: p.endDate, bullets: lines(p.bulletsText), skills: csv(p.skillsText),
  })),
  education: form.education.map((e) => ({
    school: e.school, degree: e.degree, field: e.field, grade: e.grade,
    startDate: e.startDate, endDate: e.endDate, bullets: lines(e.bulletsText),
  })),
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

function leave() {
  router.push('/resumes')
}

const parsing = ref(false)
const parseError = ref('')

// Skills only: keys on canonical() (spacing/alias-insensitive) rather than plain lowercase,
// so "Java Script" from an upload doesn't sit next to an existing "JavaScript" as a duplicate.
function dedupeCi(arr) {
  const seen = new Set()
  return arr.filter((x) => {
    const k = canonical(x)
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}

function mergeDraft(d) {
  // Contact fields overwrite (not merge-if-blank): a resume created via "Start from Profile" is
  // pre-filled with your account identity, and an uploaded PDF's real contact info should win over that.
  for (const k of ['fullName', 'phone', 'email']) {
    if (d.contact?.[k]) form.contact[k] = d.contact[k]
  }
  for (const link of contactLinks(d.contact)) {
    const existing = form.contact.links.find((l) => l.label.trim().toLowerCase() === link.label.trim().toLowerCase())
    if (existing) existing.value = link.value
    else form.contact.links.push({ label: link.label, value: link.value })
  }
  if (d.summary && !form.summary.trim()) form.summary = d.summary
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
}

async function onFile(e) {
  const file = e.target.files?.[0]
  e.target.value = '' // allow re-selecting the same file next time
  if (!file) return
  parsing.value = true
  parseError.value = ''
  try {
    const fd = new FormData()
    fd.append('resume', file)
    const { draft } = await api(`/api/resumes/${props.id}/parse`, { method: 'POST', body: fd })
    mergeDraft(draft || {})
    await save() // merged fields autosave so a parse isn't lost if the user navigates away
  } catch (err) {
    parseError.value = err.message
  } finally {
    parsing.value = false
  }
}

function updateJobMatchingSkills() {
  if (!isPrimary) return;
  const resume = payload();
  const skills = [];

  // Main resume skills
  for (let i = 0; i < resume.skills.length; i++) {
    skills.push(resume.skills[i]);
  }

  // Experience skills
  for (let i = 0; i < resume.experience.length; i++) {
    const experienceSkills = resume.experience[i].skills || [];

    for (let j = 0; j < experienceSkills.length; j++) {
      skills.push(experienceSkills[j]);
    }
  }

  // Project skills
  for (let i = 0; i < resume.projects.length; i++) {
    const projectSkills = resume.projects[i].skills || [];

    for (let j = 0; j < projectSkills.length; j++) {
      skills.push(projectSkills[j]);
    }
  }

  setMatchingResume(resume.name, skills);
}
</script>

<template>
  <section class="pb-5">
    <div v-if="loading" class="d-flex align-items-center gap-2 text-body-secondary mb-3" role="status">
      <span class="spinner-border spinner-border-sm" aria-hidden="true"></span> Loading…
    </div>
    <div v-if="loadError" class="alert alert-danger" role="alert">{{ loadError }}</div>

    <template v-if="!loading && !loadError">
      <div class="page-header flex-wrap">
        <ConfirmButton
          label="←"
          trigger-class="btn-neutral-inturn btn-sm-inturn"
          trigger-aria-label="Back to My resumes"
          prompt="Discard unsaved changes?"
          confirm-label="Discard"
          cancel-label="Keep editing"
          :skip="!dirty"
          @confirm="leave"
        />
        <div class="flex-grow-1 min-w-0">
          <input
            v-model="form.name"
            class="input-inturn border-0 px-0 fw-semibold"
            style="font-size: 1.4rem"
            placeholder="Resume name"
            aria-label="Resume name"
          />
          <div class="text-body-secondary small">Resume details</div>
        </div>
        <div class="d-flex flex-wrap align-items-center gap-2 flex-shrink-0 mw-100">
          <label class="btn-neutral-inturn btn-sm-inturn mb-0">
            <span v-if="parsing" class="spinner-border spinner-border-sm me-1" aria-hidden="true"></span>{{ parsing ? 'Parsing…' : 'Upload resume' }}
            <input type="file" accept="application/pdf,.pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.docx" class="d-none" :disabled="parsing" @change="onFile" />
          </label>
          <ConfirmButton label="Cancel" trigger-class="btn-neutral-inturn btn-sm-inturn" prompt="Discard unsaved changes?" confirm-label="Discard" cancel-label="Keep editing" :skip="!dirty" @confirm="leave" />
          <button type="button" class="btn-primary-inturn btn-sm-inturn" :disabled="saving" @click="save">
            <span v-if="saving" class="spinner-border spinner-border-sm me-1" aria-hidden="true"></span>{{ saving ? 'Saving…' : 'Save' }}
          </button>
        </div>
      </div>

      <div v-if="saveError" class="alert alert-danger" role="alert">{{ saveError }}</div>
      <div v-if="parseError" class="alert alert-danger" role="alert">{{ parseError }}</div>
      <div v-if="saved && !dirty" class="alert alert-success py-2" role="status">Resume saved</div>

      <div class="row g-4">
        <div class="col-12 col-lg-6">
          <div class="card-inturn mb-4">
            <div>
              <h2 class="section-title mb-3">Contact</h2>
              <div class="row g-3">
                <div class="col-12 col-md-6">
                  <label for="r-name" class="form-label">Full name</label>
                  <input id="r-name" v-model="form.contact.fullName" class="input-inturn" />
                </div>
                <div class="col-12 col-md-6">
                  <label for="r-phone" class="form-label">Phone</label>
                  <input id="r-phone" v-model="form.contact.phone" class="input-inturn" />
                </div>
                <div class="col-12 col-md-6">
                  <label for="r-email" class="form-label">Email</label>
                  <input id="r-email" v-model="form.contact.email" type="email" class="input-inturn" />
                </div>
              </div>

              <!-- Modular links: LinkedIn, GitHub, Portfolio, or anything else the user adds -->
              <div v-for="(link, i) in form.contact.links" :key="i" class="d-flex align-items-end gap-2 mt-3">
                <div class="flex-grow-1" style="max-width: 35%">
                  <label :for="`r-link-label-${i}`" class="form-label">Section name</label>
                  <input :id="`r-link-label-${i}`" v-model="link.label" class="input-inturn" />
                </div>
                <div class="flex-grow-1">
                  <label :for="`r-link-value-${i}`" class="form-label">{{ link.label || 'Value' }}</label>
                  <input :id="`r-link-value-${i}`" v-model="link.value" class="input-inturn" />
                </div>
                <button type="button" class="btn-neutral-inturn btn-sm-inturn mb-1" :aria-label="`Remove ${link.label || 'link'}`" @click="removeAt(form.contact.links, i)">✕</button>
              </div>

              <div v-if="addingLink" class="mt-3 p-3 border rounded">
                <div class="row g-2">
                  <div class="col-12 col-md-5">
                    <label for="r-new-link-label" class="form-label">Section name</label>
                    <input id="r-new-link-label" v-model="newLink.label" class="input-inturn" list="r-link-suggestions" placeholder="e.g. LinkedIn" />
                    <datalist id="r-link-suggestions">
                      <option value="LinkedIn"></option>
                      <option value="GitHub"></option>
                      <option value="Portfolio"></option>
                      <option value="Website"></option>
                    </datalist>
                  </div>
                  <div class="col-12 col-md-7">
                    <label for="r-new-link-value" class="form-label">Value</label>
                    <input id="r-new-link-value" v-model="newLink.value" class="input-inturn" placeholder="e.g. linkedin.com/in/yourname" @keydown.enter.prevent="confirmAddLink" />
                  </div>
                </div>
                <p v-if="newLinkError" class="small text-danger mt-2 mb-0" role="alert">{{ newLinkError }}</p>
                <div class="d-flex gap-2 mt-2">
                  <button type="button" class="btn-primary-inturn btn-sm-inturn" @click="confirmAddLink">Add</button>
                  <button type="button" class="btn-neutral-inturn btn-sm-inturn" @click="addingLink = false">Cancel</button>
                </div>
              </div>
              <button v-else type="button" class="btn-neutral-inturn btn-sm-inturn mt-3" @click="openAddLink">+ Add info</button>
            </div>
          </div>

          <div class="card-inturn mb-4">
            <div>
              <h2 class="section-title mb-3">Summary</h2>
              <textarea v-model="form.summary" class="input-inturn" rows="4" placeholder="A few sentences about you, your strengths and what you're aiming for."></textarea>
            </div>
          </div>

          <div class="card-inturn mb-4">
            <div>
              <h2 class="section-title mb-3">Skills</h2>
              <p>Be specific - Microsoft Excel instead of Excel</p>
              <input
                class="input-inturn"
                placeholder="Comma-separated, e.g. Python, SQL, Figma"
                :value="form.skills.join(', ')"
                @change="form.skills = csv($event.target.value)"
              />
            </div>
          </div>

          <div class="card-inturn mb-4">
            <div>
              <div class="d-flex justify-content-between align-items-center mb-3">
                <h2 class="section-title mb-0">Experience</h2>
                <button type="button" class="btn-secondary-inturn btn-sm-inturn" @click="addExp">+ Add experience</button>
              </div>
              <p v-if="!form.experience.length" class="text-body-secondary mb-0">No experience yet.</p>
              <div v-for="(x, i) in form.experience" :key="x.key" class="card-muted-inturn mb-3">
                <div class="row g-2">
                  <div class="col-12 col-md-6">
                    <label :for="`re-title-${x.key}`" class="form-label small">Title</label>
                    <input :id="`re-title-${x.key}`" v-model="x.title" class="input-inturn" />
                  </div>
                  <div class="col-12 col-md-6">
                    <label :for="`re-co-${x.key}`" class="form-label small">Company</label>
                    <input :id="`re-co-${x.key}`" v-model="x.company" class="input-inturn" />
                  </div>
                  <div class="col-12 col-md-6">
                    <label :for="`re-loc-${x.key}`" class="form-label small">Location</label>
                    <input :id="`re-loc-${x.key}`" v-model="x.location" class="input-inturn" />
                  </div>
                  <div class="col-6 col-md-3">
                    <label :for="`re-s-${x.key}`" class="form-label small">Start</label>
                    <input :id="`re-s-${x.key}`" v-model="x.startDate" class="input-inturn" placeholder="Jan 2024" />
                  </div>
                  <div class="col-6 col-md-3">
                    <label :for="`re-e-${x.key}`" class="form-label small">End</label>
                    <input :id="`re-e-${x.key}`" v-model="x.endDate" class="input-inturn" placeholder="Aug 2024" :disabled="x.current" />
                  </div>
                  <div class="col-12 d-flex align-items-center">
                    <div class="form-check">
                      <input :id="`re-c-${x.key}`" v-model="x.current" type="checkbox" class="form-check-input" />
                      <label :for="`re-c-${x.key}`" class="form-check-label">I currently work here</label>
                    </div>
                  </div>
                  <div class="col-12">
                    <label :for="`re-b-${x.key}`" class="form-label small">Bullets (one per line)</label>
                    <textarea :id="`re-b-${x.key}`" v-model="x.bulletsText" class="input-inturn" rows="4"></textarea>
                  </div>
                  <div class="col-12">
                    <label :for="`re-k-${x.key}`" class="form-label small">Skills used (comma-separated)</label>
                    <input :id="`re-k-${x.key}`" v-model="x.skillsText" class="input-inturn" />
                  </div>
                </div>
                <button type="button" class="btn-danger-inturn btn-sm-inturn mt-3" @click="removeAt(form.experience, i)">Remove experience</button>
              </div>
            </div>
          </div>

          <div class="card-inturn mb-4">
            <div>
              <div class="d-flex justify-content-between align-items-center mb-3">
                <h2 class="section-title mb-0">Projects</h2>
                <button type="button" class="btn-secondary-inturn btn-sm-inturn" @click="addProj">+ Add project</button>
              </div>
              <p v-if="!form.projects.length" class="text-body-secondary mb-0">No projects yet.</p>
              <div v-for="(x, i) in form.projects" :key="x.key" class="card-muted-inturn mb-3">
                <div class="row g-2">
                  <div class="col-12">
                    <label :for="`rp-n-${x.key}`" class="form-label small">Name</label>
                    <input :id="`rp-n-${x.key}`" v-model="x.name" class="input-inturn" />
                  </div>
                  <div class="col-6">
                    <label :for="`rp-s-${x.key}`" class="form-label small">Start</label>
                    <input :id="`rp-s-${x.key}`" v-model="x.startDate" class="input-inturn" />
                  </div>
                  <div class="col-6">
                    <label :for="`rp-e-${x.key}`" class="form-label small">End</label>
                    <input :id="`rp-e-${x.key}`" v-model="x.endDate" class="input-inturn" />
                  </div>
                  <div class="col-12">
                    <label :for="`rp-b-${x.key}`" class="form-label small">Bullets (one per line)</label>
                    <textarea :id="`rp-b-${x.key}`" v-model="x.bulletsText" class="input-inturn" rows="3"></textarea>
                  </div>
                  <div class="col-12">
                    <label :for="`rp-k-${x.key}`" class="form-label small">Skills / tech stack (comma-separated)</label>
                    <input :id="`rp-k-${x.key}`" v-model="x.skillsText" class="input-inturn" />
                  </div>
                </div>
                <button type="button" class="btn-danger-inturn btn-sm-inturn mt-3" @click="removeAt(form.projects, i)">Remove project</button>
              </div>
            </div>
          </div>

          <div class="card-inturn mb-4">
            <div>
              <div class="d-flex justify-content-between align-items-center mb-3">
                <h2 class="section-title mb-0">Education</h2>
                <button type="button" class="btn-secondary-inturn btn-sm-inturn" @click="addEdu">+ Add school</button>
              </div>
              <p v-if="!form.education.length" class="text-body-secondary mb-0">No education yet.</p>
              <div v-for="(x, i) in form.education" :key="x.key" class="card-muted-inturn mb-3">
                <div class="row g-2">
                  <div class="col-12 col-md-6">
                    <label :for="`red-sc-${x.key}`" class="form-label small">School</label>
                    <input :id="`red-sc-${x.key}`" v-model="x.school" class="input-inturn" />
                  </div>
                  <div class="col-12 col-md-6">
                    <label :for="`red-d-${x.key}`" class="form-label small">Degree</label>
                    <input :id="`red-d-${x.key}`" v-model="x.degree" class="input-inturn" />
                  </div>
                  <div class="col-12 col-md-6">
                    <label :for="`red-f-${x.key}`" class="form-label small">Field of study</label>
                    <input :id="`red-f-${x.key}`" v-model="x.field" class="input-inturn" />
                  </div>
                  <div class="col-12 col-md-6">
                    <label :for="`red-g-${x.key}`" class="form-label small">Grade / GPA</label>
                    <input :id="`red-g-${x.key}`" v-model="x.grade" class="input-inturn" placeholder="3.6 / 4.0" />
                  </div>
                  <div class="col-6 col-md-3">
                    <label :for="`red-s-${x.key}`" class="form-label small">Start</label>
                    <input :id="`red-s-${x.key}`" v-model="x.startDate" class="input-inturn" />
                  </div>
                  <div class="col-6 col-md-3">
                    <label :for="`red-e-${x.key}`" class="form-label small">End</label>
                    <input :id="`red-e-${x.key}`" v-model="x.endDate" class="input-inturn" />
                  </div>
                  <div class="col-12">
                    <label :for="`red-b-${x.key}`" class="form-label small">Coursework / bullets (one per line)</label>
                    <textarea :id="`red-b-${x.key}`" v-model="x.bulletsText" class="input-inturn" rows="2"></textarea>
                  </div>
                </div>
                <button type="button" class="btn-danger-inturn btn-sm-inturn mt-3" @click="removeAt(form.education, i)">Remove school</button>
              </div>
            </div>
          </div>
        </div>

        <div class="col-12 col-lg-6">
          <div class="sticky-top" style="top: 1rem">
            <ResumePreview :form="previewData" />
          </div>
        </div>
      </div>
    </template>
  </section>
</template>
