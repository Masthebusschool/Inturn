<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { authStore } from '../stores/auth.js'
import { resumeStore } from '../stores/resume.js'
import { uploadResume } from '../api/resume.js'
import { PROFILE_LIMITS } from '../utils/profileOptions.js'

const router = useRouter()
const ready = ref(false)

// Resume upload: the hidden file input is opened by the "Upload Resume" button
const fileInput = ref(null)
const uploading = ref(false)
const uploadErrors = ref([])
// In the shared store, so the resume analysis page can read it too
const resume = computed(() => resumeStore.resume)

const user = computed(() => authStore.user)
// e.g. "Undergraduate student | Software Engineering"
const studyLine = computed(() =>
  [user.value.educationLevel && `${user.value.educationLevel} student`, user.value.fieldOfStudy]
    .filter(Boolean)
    .join(' | ')
)

onMounted(async () => {
  if (!authStore.checked) await authStore.fetchMe()
  if (!authStore.isLoggedIn) return router.replace('/login')
  // No education level yet: onboarding has not been done
  if (!authStore.user.educationLevel) return router.replace('/onboarding')
  ready.value = true
})

function chooseResume() {
  fileInput.value.click()
}

async function handleResumeChosen(event) {
  const file = event.target.files[0]
  // Clear the input so choosing the same file again still triggers "change"
  event.target.value = ''
  if (!file) return

  // Same checks as the server, so the user finds out without waiting for the upload
  const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
  if (!isPdf) {
    uploadErrors.value = ['Resume must be a PDF file']
    return
  }
  if (file.size > PROFILE_LIMITS.resumeMB * 1024 * 1024) {
    uploadErrors.value = [`Resume must be ${PROFILE_LIMITS.resumeMB} MB or smaller`]
    return
  }

  uploadErrors.value = []
  uploading.value = true
  try {
    const data = await uploadResume(file)
    resumeStore.resume = data.resume
  } catch (e) {
    uploadErrors.value = e.errors ?? [e.message]
  } finally {
    uploading.value = false
  }
}

// TODO(edit profile step): point to a dedicated edit page once it exists.
function editProfile() {
  router.push('/onboarding')
}
</script>

<template>
  <section v-if="ready" class="profile-page">
    <header class="profile-header">
      <div>
        <h1 class="header-title">My Profile</h1>
        <p class="header-subtitle">Manage your personal information and career preferences.</p>
      </div>
      <input
        ref="fileInput"
        type="file"
        accept="application/pdf,.pdf"
        class="d-none"
        aria-label="Resume PDF file"
        @change="handleResumeChosen"
      />
      <button type="button" class="btn-primary-inturn" :disabled="uploading" @click="chooseResume">
        <span v-if="uploading" class="spinner-border spinner-border-sm" aria-hidden="true"></span>
        <svg v-else class="icon" viewBox="0 0 16 16" aria-hidden="true">
          <circle cx="8" cy="8" r="8" fill="currentColor" />
          <path d="M8 12V5M5 7.5 8 4.5l3 3" fill="none" stroke="#4e8be6" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
        {{ uploading ? 'Uploading...' : 'Upload Resume' }}
      </button>
    </header>

    <div v-if="uploadErrors.length" class="alert alert-danger py-2" role="alert">
      <div v-for="error in uploadErrors" :key="error">{{ error }}</div>
    </div>

    <article v-if="resume" class="resume-card" aria-live="polite">
      <div class="resume-summary">
        <svg class="resume-icon" viewBox="0 0 16 16" aria-hidden="true">
          <path d="M3 1.5h7l3 3v10H3zM10 1.5v3h3M5.5 8h5M5.5 10.5h5M5.5 13h3" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
        <div class="resume-meta">
          <p class="resume-name mb-0">{{ resume.fileName }}</p>
          <p class="muted mb-0">
            {{ resume.pageCount }} {{ resume.pageCount === 1 ? 'page' : 'pages' }} · {{ resume.wordCount }} words
          </p>
        </div>
        <span class="badge text-bg-success">Uploaded</span>
      </div>
      <div class="text-end">
        <RouterLink to="/profile/resume-analysis" class="btn-primary-inturn btn-analyze">
          <svg class="icon" viewBox="0 0 16 16" aria-hidden="true">
            <path d="M2 14h12M4 11V8M8 11V4M12 11V6.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
          </svg>
          Analyze my resume
        </RouterLink>
      </div>
    </article>

    <article class="profile-card">
      <div class="identity">
        <div class="avatar" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <circle cx="12" cy="8" r="4" fill="none" stroke="currentColor" stroke-width="1.5" />
            <path d="M4 20c0-4 3.6-6 8-6s8 2 8 6z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" />
          </svg>
        </div>
        <div class="identity-text">
          <h2 class="name">{{ user.name }}</h2>
          <p class="muted mb-0">{{ user.email }}</p>
          <p v-if="studyLine" class="muted mb-0">{{ studyLine }}</p>
        </div>
      </div>

      <hr class="divider" />

      <section class="profile-section">
        <h3 class="section-title">Education</h3>
        <p v-if="user.institution" class="mb-0">{{ user.institution }}</p>
        <p v-else class="muted mb-0">No institution added yet.</p>
      </section>

      <section class="profile-section">
        <h3 class="section-title">My Skills</h3>
        <ul class="skill-list">
          <li v-for="skill in user.skills" :key="skill" class="skill">{{ skill }}</li>
        </ul>
      </section>

      <section class="profile-section">
        <h3 class="section-title">Target Industries</h3>
        <p v-if="user.targetIndustries.length" class="mb-0">{{ user.targetIndustries.join(', ') }}</p>
        <p v-else class="muted mb-0">No target industries added yet.</p>
      </section>

      <div class="text-end">
        <button type="button" class="btn-primary-inturn btn-edit" @click="editProfile">
          <svg class="icon" viewBox="0 0 16 16" aria-hidden="true">
            <path d="M11.5 1.5a1.4 1.4 0 0 1 2 2L5 12l-3 1 1-3z" fill="currentColor" />
          </svg>
          Edit profile
        </button>
      </div>

      
    </article>
  </section>
</template>

<style scoped>
.profile-page {
  max-width: 760px;
}

.profile-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  padding: 1rem 1.25rem;
  margin-bottom: 1.5rem;
  background: #fff;
  border: 1px solid #dee2e6;
  border-radius: 8px;
}

.header-title {
  font-size: 1.15rem;
  font-weight: 700;
  margin-bottom: 0.15rem;
}

.header-subtitle {
  font-size: 0.8rem;
  margin-bottom: 0;
}

.profile-card {
  padding: 2.5rem 2rem 2rem;
  background: #f3f3f3;
  border-radius: 24px;
}

.identity {
  display: flex;
  align-items: center;
  gap: 1.5rem;
  padding: 0 0.5rem 1.25rem;
}

.avatar {
  flex-shrink: 0;
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: #dde7f8;
  color: #212529;
  display: flex;
  align-items: center;
  justify-content: center;
}

.avatar svg {
  width: 28px;
  height: 28px;
}

.name {
  font-size: 1.35rem;
  font-weight: 700;
  margin-bottom: 0.2rem;
}

.muted {
  color: #6c757d;
  font-size: 0.9rem;
}

.divider {
  margin: 0 0 1.5rem;
  opacity: 0.4;
}

.profile-section {
  padding: 0 0.25rem;
  margin-bottom: 1.25rem;
}

.section-title {
  font-size: 1.1rem;
  font-weight: 700;
  margin-bottom: 0.5rem;
}

.skill-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
  list-style: none;
  padding: 0;
  margin: 0;
}

.skill {
  padding: 0.3rem 0.85rem;
  background: #e3ecfb;
  color: #3c70b3;
  border-radius: 999px;
  font-size: 0.85rem;
}

.btn-primary-inturn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  background: #4e8be6;
  color: #fff;
  border: none;
  border-radius: 10px;
  padding: 0.5rem 1.25rem;
  white-space: nowrap;
}

.btn-primary-inturn:hover {
  background: #3c70b3;
}

.btn-primary-inturn:disabled {
  opacity: 0.7;
}

/* RouterLink styled as a button */
.btn-analyze {
  margin-top: 0.75rem;
  text-decoration: none;
}

.btn-analyze:hover {
  color: #fff;
}

.resume-card {
  padding: 1rem 1.25rem;
  margin-bottom: 1.5rem;
  background: #fff;
  border: 1px solid #dee2e6;
  border-radius: 8px;
}

.resume-summary {
  display: flex;
  align-items: center;
  gap: 0.85rem;
}

.resume-icon {
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  color: #4e8be6;
}

.resume-meta {
  flex: 1;
  min-width: 0;
}

.resume-name {
  font-weight: 600;
  overflow-wrap: anywhere;
}

.resume-text {
  margin-top: 0.75rem;
}

.resume-text summary {
  color: #3c70b3;
  font-size: 0.9rem;
  cursor: pointer;
}

.resume-text pre {
  max-height: 320px;
  overflow: auto;
  margin: 0.5rem 0 0;
  padding: 0.75rem;
  background: #f8f9fa;
  border-radius: 6px;
  font-size: 0.8rem;
  white-space: pre-wrap;
}

.btn-edit {
  margin-top: 1.5rem;
  padding: 0.4rem 1.1rem;
  border-radius: 6px;
}

.icon {
  width: 16px;
  height: 16px;
}

@media (max-width: 576px) {
  .profile-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .profile-card {
    padding: 1.75rem 1.25rem;
  }

  .identity {
    gap: 1rem;
    padding: 0 0 1.25rem;
  }
}
</style>
