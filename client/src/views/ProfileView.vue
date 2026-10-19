<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { authStore } from '../stores/auth.js'

const router = useRouter()
const ready = ref(false)
const info = ref('')

const user = computed(() => authStore.user)
// e.g. "Undergraduate student | Software Engineering"
const studyLine = computed(() =>
  [user.value.educationLevel && `${user.value.educationLevel} student`, user.value.fieldOfStudy]
    .filter(Boolean)
    .join(' | ')
)

onMounted(async () => {
  if (!authStore.checked) await authStore.fetchMe()
  if (!authStore.isLoggedIn) return router.replace({ name: 'login' })
  if (!authStore.user.profileComplete) return router.replace({ name: 'onboarding' })
  ready.value = true
})

function showUploadResume() {
  info.value = 'Resume upload is coming soon.'
}

// TODO(edit profile step): point to a dedicated edit page once it exists.
function editProfile() {
  router.push({ name: 'onboarding' })
}
</script>

<template>
  <section v-if="ready" class="profile-page">
    <header class="profile-header">
      <div>
        <h1 class="header-title">My Profile</h1>
        <p class="header-subtitle">Manage your personal information and career preferences.</p>
      </div>
      <button type="button" class="btn-primary-inturn" @click="showUploadResume">
        <svg class="icon" viewBox="0 0 16 16" aria-hidden="true">
          <circle cx="8" cy="8" r="8" fill="currentColor" />
          <path d="M8 12V5M5 7.5 8 4.5l3 3" fill="none" stroke="#4e8be6" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
        Upload Resume
      </button>
    </header>

    <div v-if="info" class="alert alert-info py-2" role="status">{{ info }}</div>

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
