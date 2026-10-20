<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { api } from '../lib/api.js'

const router = useRouter()
const resumes = ref([])
const loading = ref(true)
const loadError = ref('')
const creating = ref(false)
const createError = ref('')
const busyId = ref('')

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

async function createResume() {
  const name = window.prompt('Name this resume (e.g. "Backend Intern"):')
  if (!name || !name.trim()) return
  const fromProfile = window.confirm('Start from your saved Profile data? Click Cancel to start blank.')
  creating.value = true
  createError.value = ''
  try {
    const { resume } = await api('/api/resumes', { method: 'POST', body: { name: name.trim(), seed: fromProfile ? 'profile' : 'blank' } })
    router.push(`/resumes/${resume._id}`)
  } catch (e) {
    createError.value = e.message
  } finally {
    creating.value = false
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
  if (!window.confirm(`Delete "${r.name}"? This can't be undone.`)) return
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
      <button type="button" class="btn btn-primary" :disabled="creating" @click="createResume">
        <span v-if="creating" class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>+ New resume
      </button>
    </div>

    <div v-if="createError" class="alert alert-danger" role="alert">{{ createError }}</div>
    <div v-if="loadError" class="alert alert-danger" role="alert">{{ loadError }}</div>

    <div v-if="loading" class="d-flex align-items-center gap-2 text-body-secondary" role="status">
      <span class="spinner-border spinner-border-sm" aria-hidden="true"></span> Loading…
    </div>

    <div v-else-if="!resumes.length" class="card shadow-sm">
      <div class="card-body text-center py-5">
        <h2 class="h5">No resumes yet</h2>
        <p class="text-body-secondary mb-0">Create one to get a split-view editor with a live preview.</p>
      </div>
    </div>

    <div v-else class="list-group shadow-sm">
      <div v-for="r in resumes" :key="r._id" class="list-group-item d-flex flex-wrap justify-content-between align-items-center gap-2">
        <RouterLink :to="`/resumes/${r._id}`" class="text-decoration-none flex-grow-1 min-w-0">
          <div class="fw-semibold text-truncate">{{ r.name }}</div>
          <small class="text-body-secondary">Updated {{ fmtDate(r.updatedAt) }}</small>
        </RouterLink>
        <div class="d-flex gap-2 flex-shrink-0">
          <button type="button" class="btn btn-sm btn-outline-secondary" :disabled="busyId === r._id" @click="duplicate(r)">Duplicate</button>
          <button type="button" class="btn btn-sm btn-outline-danger" :disabled="busyId === r._id" @click="remove(r)">Delete</button>
        </div>
      </div>
    </div>
  </section>
</template>
