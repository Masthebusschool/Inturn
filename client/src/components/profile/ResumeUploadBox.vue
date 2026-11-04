<script setup>
import { ref, computed } from 'vue'
import { resumeStore } from '../../stores/resume.js'
import { uploadResume } from '../../api/resume.js'
import { PROFILE_LIMITS } from '../../utils/profileOptions.js'

// Click or drag a PDF here. Uses the same upload as the profile page and keeps the
// result in resumeStore, so the profile and resume analysis pages see it too.
const emit = defineEmits(['uploaded'])

const fileInput = ref(null)
const uploading = ref(false)
const dragging = ref(false)
const errors = ref([])
const resume = computed(() => resumeStore.resume)

function chooseFile() {
  fileInput.value.click()
}

function handleChosen(event) {
  const file = event.target.files[0]
  // Clear the input so choosing the same file again still triggers "change"
  event.target.value = ''
  if (file) upload(file)
}

function handleDrop(event) {
  dragging.value = false
  const file = event.dataTransfer.files[0]
  if (file) upload(file)
}

const DOCX_MIMETYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

async function upload(file) {
  // Same checks as the server, so the user finds out without waiting for the upload
  const name = file.name.toLowerCase()
  const isSupported = file.type === 'application/pdf' || name.endsWith('.pdf')
    || file.type === DOCX_MIMETYPE || name.endsWith('.docx')
  if (!isSupported) {
    errors.value = ['Resume must be a PDF or Word (.docx) file']
    return
  }
  if (file.size > PROFILE_LIMITS.resumeMB * 1024 * 1024) {
    errors.value = [`Resume must be ${PROFILE_LIMITS.resumeMB} MB or smaller`]
    return
  }

  errors.value = []
  uploading.value = true
  try {
    const data = await uploadResume(file)
    resumeStore.resume = data.resume
    emit('uploaded', data.resume)
  } catch (e) {
    errors.value = e.errors ?? [e.message]
  } finally {
    uploading.value = false
  }
}
</script>

<template>
  <div>
    <input
      ref="fileInput"
      type="file"
      accept="application/pdf,.pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.docx"
      class="d-none"
      aria-label="Resume file"
      @change="handleChosen"
    />

    <div v-if="errors.length" class="alert alert-danger py-2" role="alert">
      <div v-for="error in errors" :key="error">{{ error }}</div>
    </div>

    <!-- Uploaded: show the file, with a way to replace it -->
    <div v-if="resume && !uploading" class="resume-file" aria-live="polite">
      <svg class="file-icon" viewBox="0 0 16 16" aria-hidden="true">
        <path d="M3 1.5h7l3 3v10H3zM10 1.5v3h3M5.5 8h5M5.5 10.5h5M5.5 13h3" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
      <div class="file-meta">
        <p class="file-name mb-0">{{ resume.fileName }}</p>
        <p class="muted mb-0">
          <template v-if="resume.pageCount != null">{{ resume.pageCount }} {{ resume.pageCount === 1 ? 'page' : 'pages' }} · </template>{{ resume.wordCount }} words
        </p>
      </div>
      <button type="button" class="btn-link-inturn" @click="chooseFile">Replace</button>
    </div>

    <!-- Not uploaded yet (or uploading): the drop zone -->
    <button
      v-else
      type="button"
      class="drop-zone"
      :class="{ dragging }"
      :disabled="uploading"
      @click="chooseFile"
      @dragover.prevent="dragging = true"
      @dragleave="dragging = false"
      @drop.prevent="handleDrop"
    >
      <span v-if="uploading" class="spinner-border text-primary" aria-hidden="true"></span>
      <svg v-else class="upload-icon" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 16V5M7.5 9.5 12 5l4.5 4.5M4 15v3.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
      <span class="drop-title">{{ uploading ? 'Reading your resume...' : 'Click to upload or drag your resume here' }}</span>
      <span class="muted">PDF or Word (.docx), up to {{ PROFILE_LIMITS.resumeMB }} MB</span>
    </button>
  </div>
</template>

<style scoped>
.drop-zone {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.4rem;
  width: 100%;
  padding: 2rem 1rem;
  background: var(--inturn-surface);
  border: 2px dashed var(--inturn-primary);
  border-radius: var(--r-md);
  color: var(--inturn-text);
  cursor: pointer;
}

.drop-zone:hover,
.drop-zone.dragging {
  background: var(--inturn-primary-soft);
}

.drop-zone:focus-visible {
  outline: none;
  box-shadow: 0 0 0 0.2rem rgba(78, 139, 230, 0.35);
}

.drop-zone:disabled {
  cursor: progress;
}

.upload-icon {
  width: 36px;
  height: 36px;
  color: var(--inturn-primary);
}

.drop-title {
  font-weight: 600;
}

.muted {
  color: var(--inturn-text-muted);
  font-size: 0.85rem;
}

.resume-file {
  display: flex;
  align-items: center;
  gap: 0.85rem;
  padding: 0.9rem 1rem;
  background: var(--inturn-surface);
  border: 1px solid var(--inturn-border);
  border-radius: var(--r-md);
}

.file-icon {
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  color: var(--inturn-primary);
}

.file-meta {
  flex: 1;
  min-width: 0;
}

.file-name {
  font-weight: 600;
  overflow-wrap: anywhere;
}
</style>
